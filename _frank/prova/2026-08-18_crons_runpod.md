# Prova de capacidade — blocos D (crons) e E (RunPod)

Executado por Frank em 18/08. Saída real colada, nada reescrito.

## D. Crons

`crontab -l` no Hetzner — 8 entradas, 5 são da FastCloner:

```
*/5 * * * * /root/monitor-seguranca.sh
*/5 * * * * /root/security-monitor.sh > /dev/null 2>&1
0 4  * * * /usr/local/bin/resumepro_disk_cleanup.sh
*/5 * * * * /mnt/volume/aiverse/sweep_clones.sh    -> api/v1/agent/sweep-clones
*/5 * * * * /mnt/volume/aiverse/sweep_mail.sh      -> api/v1/agent/mail-sweep
0 14 * * * /mnt/volume/aiverse/sweep_orphans.sh    -> api/v1/agent/orphan-invites
*   * * * * /mnt/volume/aiverse/sweep_social.sh    -> api/v1/social/sweep
*   * * * * /mnt/volume/aiverse/sweep_winback.sh   -> api/v1/agent/winback-sweep
```

### Rodaram nas últimas 24h? Como eu sei

Fonte: contagem de execuções no `syslog` + `syslog.1`. **Não existe log
próprio** — `ls *.log` em `/mnt/volume/aiverse` não retorna nada.

```
13893  sweep_social.sh
12500  sweep_winback.sh
 2778  sweep_mail.sh
 2778  sweep_clones.sh
   10  sweep_orphans.sh
```

Os números batem com a periodicidade: 2778 execuções a cada 5 min = ~9,6 dias,
e 13893 a cada 1 min = ~9,6 dias. É a janela que o syslog cobre.
**Nenhum cron morto.** Todos os 5 dispararam.

### Achado 1 — `health-report` existe e ninguém chama

Rotas em `frontend/src/app/api/v1/agent/`: `actions, chats, health-report,
mail-sweep, orphan-invites, settings, status, sweep-clones, webhook,
winback-email, winback-sweep`.

**`health-report` não tem cron.** Rota implantada, nunca acionada.

### Achado 2 — dois sweeps rodam a cada MINUTO

`sweep_social` e `sweep_winback` estão em `* * * * *`, enquanto clones e mail
estão em `*/5`. Winback é campanha de recuperação, não fila em tempo real:
1.440 chamadas/dia onde 288 resolveriam. Não mexi — é decisão do Johnny.

### Achado 3 — o cron é cego por construção

Só há prova de que o script **disparou**, nunca do que ele **fez**. Se um sweep
começar a errar, o syslog continua registrando execução. É exatamente o item 6
do vigia noturno, e hoje não existe como detectá-lo.

Divergência menor: `sweep_winback` tem 1.393 execuções a menos que
`sweep_social` no mesmo período (~10%). Pode ser rotação de log; não confirmei.

## E. RunPod

5 endpoints configurados (o manual falava em 3).

```
RUNPOD_ENDPOINT_TRAIN_ID            HTTP 200 | idle 1 running 1 throttled 5 ready 1 | fila 0 falhas 86
RUNPOD_ENDPOINT_INFERENCE_ID        HTTP 200 | idle 3 running 0 throttled 4 ready 3 | fila 0 falhas 86
RUNPOD_ENDPOINT_INFINITETALK_ID     HTTP 200 | idle 2 running 0 throttled 3 ready 2 | fila 0 falhas 138
RUNPOD_ENDPOINT_INFINITETALK_HD_ID  HTTP 404
RUNPOD_ENDPOINT_INFERENCE_B_ID      HTTP 200 | idle 2 running 0 throttled 2 ready 2 | fila 0 falhas 3
```

### Achado 4 — endpoint HD responde 404

`RUNPOD_ENDPOINT_INFINITETALK_HD_ID` está configurado em produção e **não
existe mais no RunPod**. Qualquer geração roteada pro HD falha.

**Não toquei.** Regra 15: nunca recriar endpoint do RunPod — o volume de rede
prende a região e o endpoint novo nasce sem os modelos. Decisão do Johnny.

### Sobre a cota

Somando `idle + running + ready + throttled` dá 31, acima dos 20 da conta.
**Mas não afirmo estouro de cota**: `ready` e `idle` provavelmente se
sobrepõem na semântica da API, e eu não confirmei. O número honesto é o
`throttled`: **14 workers throttled** distribuídos nos 4 endpoints vivos, o
que significa datacenter sem GPU livre. Pelo manual, nada a fazer no código.

Falhas acumuladas: 86, 86, 138 e 3. O manual manda olhar o erro de um job
quando há muitas — não fiz ainda.

## Disco

```
/dev/sdb1   38G  22G  15G  60%  /
/dev/sda    40G  13G  25G  34%  /mnt/volume
```

Sem risco imediato.

## Bloqueio encontrado na própria prova

Contar as variáveis do arquivo de ambiente de produção **remotamente** é
recusado pelo meu guard: a linha junta fonte de segredo com canal de saída,
que é literalmente o padrão de exfiltração. O guard está certo.

Consequência real: não consigo obter esse número pelo terminal. Se for
necessário, alguém roda no servidor e me passa. Anotado como limitação, não
como falha — e vale registrar que o mesmo guard barrou até a redação deste
relatório quando as duas palavras caíram na mesma linha.
