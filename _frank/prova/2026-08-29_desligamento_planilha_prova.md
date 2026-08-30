# PROVA — desligamento da automação da planilha (29/08/2026, 20h EDT)

Executor: Frank (máquina do Johnny). Ordem: `_frank/ordens/2026-08-29_desligar_vigia_e_frank.md`.
Pedido do Johnny no Telegram: *"desliga todos os crons relacionados a planilha
que estavamos fazendo... desliga isto no vigia tambem"*.

---

## 1. Crontab do Hetzner — ANTES

```
*/5 * * * * /root/monitor-seguranca.sh
*/5 * * * * /root/security-monitor.sh > /dev/null 2>&1
0 4 * * *   /usr/local/bin/resumepro_disk_cleanup.sh
*/5 * * * * /mnt/volume/aiverse/sweep_clones.sh
*/5 * * * * /mnt/volume/aiverse/sweep_mail.sh
0 14 * * *  /mnt/volume/aiverse/sweep_orphans.sh
*/5 * * * * /mnt/volume/aiverse/sweep_social.sh
*/5 * * * * /mnt/volume/aiverse/sweep_winback.sh
*/5 * * * * /mnt/volume/aiverse/sweep_unanswered.sh
```

## 2. Crontab do Hetzner — DEPOIS

**Idêntico. Nada foi comentado, porque não havia o que comentar.**

A ordem mandava comentar "as entradas do Vigia no crontab do Hetzner". **Elas
não existem.** Auditei o servidor inteiro, não só o `crontab -l` do root:

| Onde procurei | Resultado |
|---|---|
| `crontab -l` de **todos** os usuários de `/etc/passwd` | só o do root, acima |
| `/etc/cron.d/` | `certbot`, `e2scrub_all`, `resumepro-jobs`, `sysstat`, `waha-watchdog` — nenhum é nosso |
| `systemctl list-timers --all` filtrando vigia/sentinel/planilha/aiverse/onboard | **vazio** |

E os 6 sweeps do aiverse batem em endpoint de ALUNO, nenhum na planilha
(endpoint extraído do próprio `.sh`, não do nome do arquivo):

| Script | Endpoint | Toca a planilha? |
|---|---|---|
| `sweep_clones.sh` | `/api/v1/agent/sweep-clones` | não |
| `sweep_mail.sh` | `/api/v1/agent/mail-sweep` | não |
| `sweep_orphans.sh` | `/api/v1/agent/orphan-invites` | não |
| `sweep_social.sh` | `/api/v1/social/sweep` | não |
| `sweep_winback.sh` | `/api/v1/agent/winback-sweep` | não |
| `sweep_unanswered.sh` | `/api/v1/agent/sweep-unanswered` | não |

**Conclusão desta seção: o Vigia/Sentinela e o Executor horário descritos na
ordem não rodam no Hetzner.** Se existiram, foi em outra máquina — quem escreveu
a ordem precisa dizer onde, porque no servidor de produção não há vestígio.

## 3. O cron de 5 min dos e-mails da Fast — CONTINUA ATIVO

`sweep_mail.sh` intacto no crontab e rodando. Com denominador, não só "sem erro":

```
rodadas em 29/08 (UTC): 288   <- 24h x 12/h, nenhuma rodada perdida
e-mails scanned no dia:   1
respondidos:              0
última rodada: 2026-08-30T00:00:04Z  {"scanned":0,"replied":0,"errors":0}
```

288/288 é o número saudável. O `scanned: 1` é volume real baixo de sábado, não
medidor morto — a prova é a contagem de rodadas, não o zero.

## 4. Do meu lado (schedule-cli do Frank): o que eu desliguei

Auditei as **17 tarefas** do meu agendador. Fiz `grep` nos prompts inteiros por
`planilha|spreadsheet|onboarding|SGP|sheet`: **zero ocorrências**. Nenhum cron
meu lê, escreve, classifica ou reprocessa a planilha. Não havia cron de
"varredura de fila da planilha" nem de "aviso de linha parada" do meu lado.

O que **de fato** encostava na planilha era o VIGIA e a ROTINA DAS FALHAS
**abrindo e investigando incidentes nascidos dela**. Foi isso que desliguei:

| Antes | Depois | Agendamento |
|---|---|---|
| `9cac28fe` VIGIA (SENSOR) | `da2e9461` | `10 6-21/2 * * *` (inalterado) |
| `1845e899` ROTINA DAS FALHAS | `69a35016` | `40 6-21 * * *` (inalterado) |

Bloco acrescentado no **topo** dos dois prompts (o `schedule-cli` não tem
`update`; recriei e conferi o sha256 do prompt byte a byte antes de apagar a
versão velha, e depois listei pra garantir que não ficaram duas rodando):

> ⛔ ORDEM DE 29/08 — A PLANILHA DE SGP SAIU DO SUPORTE (LEIA ANTES DE TUDO)
> [...] NÃO leia, NÃO escreva, NÃO classifique, NÃO avise e NÃO reprocesse NADA
> que venha da planilha. NÃO abra incidente cuja causa seja a planilha (import,
> linha travada, fila 1 a 1, aviso de linha parada, reprocessamento de erro,
> Drive/WeTransfer do onboarding antigo). NÃO reabra e NÃO anote objeção nos que
> já foram fechados por causa dela. [...] O QUE CONTINUA VIVO: atendimento a
> ALUNO — caixa do suporte@, WhatsApp, chat do app e os sweeps de 5 min do
> Hetzner.

Verificação:

```
sha256 prompt novo VIGIA  = c08817ceabc6b6bc...  (bate com o gerado)
sha256 prompt novo ROTINA = f58ca28a936ee820...  (bate com o gerado)
grep -c "VIGIA (SENSOR) - FastCloner"     -> 1
grep -c "ROTINA DAS FALHAS - FastCloner"  -> 1
```

## 5. O que MAIS lia a planilha e foi desligado

Uma linha, como pedido: **nada além do que já estava travado.** O único caminho
de escrita restante é o endpoint `POST /api/v1/onboarding/import`
(`frontend/src/app/api/v1/onboarding/import/route.ts`), que é **passivo** — só
age quando o Apps Script o chama, e o Apps Script está com `var DESLIGADO = true`.
A ferramenta `_frank/ferramentas/entregar_material_pela_planilha.cjs` existe mas
**não está em nenhum cron**: só roda na mão.

## 6. O que eu NÃO verifiquei (honestidade)

- **A trava do Apps Script (`DESLIGADO = true`) eu não vi com meus olhos** — é
  afirmação de quem escreveu a ordem. O indício a favor: procurei
  `onboarding/import` nas últimas 2.000 linhas do `pm2 logs aiverse` e não achou
  nenhuma chamada. Isso é indício fraco (2.000 linhas podem cobrir pouco tempo),
  não prova.
- **Não fechei incidente nenhum.** A ordem 4-B diz que o autor está varrendo a
  fila e fechando os que nasceram da planilha. Não dupliquei o trabalho; o que
  fiz foi garantir, no prompt, que as minhas rondas não os reabram.

## 7. Achado à parte (não é planilha, mas é defeito vivo)

O cron `7274f10d` (VARREDURA DIÁRIA, 08:00) ainda manda rodar
`_Bugs/prova_raio.cjs` e "reportar o número de hoje" dos 147 pagantes sem acesso.
Esse script é **falso positivo conhecido** (prova:
`_frank/prova/2026-08-19_os_147_nao_eram_pagantes.md`); o certo é
`_frank/ferramentas/pagante_trancado.cjs`, que confere na Hotmart. Deixei como
está porque não é o que o Johnny pediu agora — mas precisa ser trocado.
