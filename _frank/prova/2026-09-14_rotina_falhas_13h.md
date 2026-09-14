# Rotina das falhas — 14/09 ~13hZ

Ronda serial (regra 8). O item desta ronda foi o **patch do Vigia parado**
(regra 1-B: antes do resto) — `#387`, a Fast respondendo e-mail sem memória
nenhuma da conversa. Levado até o fim: revisado, **testado contra a caixa
viva**, mergeado, deploy conferido, incidente fechado com nota e commit, chave
apagada, linha no grupo.

Repo em `main`, `pull --ff-only` limpo. `_frank/ordens/README.md` lido antes de
tocar em qualquer coisa. Ordem mais nova do índice é a de **29/08** (planilha
desligada): **não li, não escrevi, não classifiquei e não reprocessei nada da
planilha**. Ordem de canal de **31/08**: o aviso foi pro **grupo**, com
`notify-grupo.sh` — nada no privado do Johnny.

---

## Estado na entrada e na saída

| | entrada (12:40Z) | saída (12:52Z) |
|---|---|---|
| `open` | 1 | 1 |
| `investigating` | 80 | 79 |
| **total aberto** | **81** | **80** |

**Reconciliado:** fechei o `#387` e **não abri nenhum**. A fila baixou 1.

---

## 1. As duas varreduras obrigatórias — as duas limpas

**2-B (`saida_x_assinatura.cjs`), roda em TODA ronda:** 345 incidentes varridos,
26 pessoas, **0 sangrando**. O controle positivo passou nos dois lados (Marcelo
reencontrado à esquerda, `SUR21VU9` devolvido à direita), então isto é **fila
limpa, não cegueira** — a distinção importa porque cegar uma ponta zeraria o
relatório igualzinho.

**`varredura_travados.cjs`:** 2 presos. Nenhum é bug.

- `marcelopersonalthe32@gmail.com` — 35 dias sem voz. É o caso **já resolvido**
  na ronda das 12hZ (assinatura cancelada, conferida na fonte viva). Não sangra.
- `ericb.malzone@gmail.com` — voz parada em `awaiting_training` há 1 dia.
  **Investiguei e NÃO é defeito nosso** (detalhe abaixo).

---

## 2. O aluno que parecia travado e não está — e a armadilha que eu não pisei

O `ericb.malzone@gmail.com` acende o alarme que resume tudo: *acesso vivo,
100.000 créditos, nenhuma voz pronta*. Fui atrás antes de qualquer outra coisa,
porque aluno esperando vem antes de limpeza de fila.

**Os arquivos primeiro** (armadilha medida: foto do Drive em `raw_audio_paths`
já cravou causa errada duas vezes): 13 áudios, todos `.ogg` de WhatsApp, nenhum
intruso. Os arquivos estão certos.

`awaiting_training` **espera o clique DELE** (`start-training/route.ts:93` exige
esse status). A voz nasceu 13/09 09:59; a régua do lembrete
(`lembrete-treino.ts`) manda no **dia 3** e de novo no dia 14. Ele está no dia 1:
**"nova demais", corretamente**. O primeiro lembrete vence 16/09.

⚠️ **A armadilha que quase me pegou:** `access_until = 2026-09-17` parece prazo
vencendo em 3 dias, e com o lembrete caindo no dia 16 daria pânico. **Não é
vencimento: é a data da próxima cobrança de uma assinatura viva** (ele tem
`subscription_grant` de 10/09, compra `active`). É exatamente o defeito do
`a0bc1f7e` (`account.ts:258-263`, a casa manda data de RENOVAÇÃO como se fosse
prazo — 265 contas expostas) e foi o mesmo erro que fez a casa repetir a data
errada da Evelyn. **Ele não perde nada dia 17.** Nenhuma ação, e de propósito.

**Conferi também se a máquina de lembrete está viva**, porque a chave
`lembretes_treino` em `agent_state` **não existe** — o que à primeira vista lê
como "nunca funcionou". Medi antes de acusar: das 13 vozes em
`awaiting_training`, **só a do Eric nasceu depois do corte de backfill**
(`SEM_LEMBRETE_ANTES_DE = 2026-09-06`), e ela ainda não venceu. **Nunca houve
lembrete devido**, então a chave ausente é o estado *correto*, não uma avaria.
Não abri incidente contra isso.

A triagem do corte também continua de pé: toda voz pré-corte pertence a quem
**já tem outra voz `ready`**, exceto os 2 uploads abandonados conhecidos
(`superaspen22`, `emanuelfmguerreiro`) que têm 0 crédito e 0 acesso — mandar
lembrete pra eles seria empurrar os dois num botão que devolve 402.

---

## 3. O serial: `#387` — o canal do dinheiro era o único sem memória

**PR #271, merge `118d6b5`, deploy `Deploy Frontend (production)` run
34845367866 `success`** (conferido **depois** do merge, não presumido).

`mail-respond.ts:291-293` montava um `history` de **uma** mensagem — a que
acabara de chegar. WhatsApp (`respond.ts:264`) e chat do app
(`help/route.ts:288`) carregam a conversa inteira do banco. **O e-mail era o
único canal cego, e é onde moram reembolso e cancelamento.**

O caso que nomeia o incidente é o **Emanuel** (`#7578c587`): exigiu devolução às
**11:09Z** e às **14:15Z** recebeu *"refaça o envio"* — o caminho técnico que ele
acabara de recusar.

Cura pelo banco não existia: `agent_messages` é por `chat_id` do WhatsApp e
`emails_enviados` **não guarda corpo** (migration 108 nem aplicada). A conversa
mora na caixa: INBOX de um lado, pasta de enviados do outro.

### O que eu testei e o Vigia não podia

Ele foi **honesto** e escreveu que não tinha credencial de caixa no sandbox, e
listou 4 pontos não exercitados. **Eu tenho a credencial.** Rodei o **código
real** (via `jiti` — reimplementar provaria a minha cópia, não o patch) contra a
caixa viva. Só leitura: `BODY.PEEK`, nenhuma flag muda, nada enviado.

**Controle POSITIVO** (`emanuelfmguerreiro@gmail.com`, o controle natural dele):

```
6 mensagens em 2508 ms
INBOX (aluno):            1   OK
Pasta de enviados (casa): 5   OK — SEARCH TO funciona e a pasta casa
ordem cronológica:        OK
Message-ID em todas:      OK (o dedup da mensagem atual vai funcionar)
```

Fecha os 4 pontos: (1) o Namecheap **aceita** `UID SEARCH FROM/TO` — o
`fetchUnseen` só usava `UNSEEN/SINCE`, então isso era de verdade desconhecido;
(2) a pasta descoberta **casa** o `TO`; (3) a ordem **sai certa**; (4) custa
**2,5s** contra teto de 20s.

**Controle NEGATIVO** (endereço inexistente): **0 mensagens**, não um despejo da
caixa. Este era o risco que ninguém tinha nomeado: `SEARCH` **ignorado** pelo
servidor devolveria tudo, o fio viria cheio de conversa de outra gente, e o
relatório pareceria ótimo.

Minhas verificações do zero: `tsc --noEmit` → 1 erro (`vitest` em
`resgate-audio.test.ts`) **idêntico na main intocada, rodado por mim** — nenhum
erro novo; `eslint` nos 2 arquivos → limpo. E conferi o que nenhum dos dois tinha
olhado: `respondOne` roda em `for...of` com `await`
(`mail-respond.ts:472-474`), então as sessões IMAP são **sequenciais** — não há
enxame de conexão. Pior caso 8 × 20s = 160s dentro do cron de 5 min.

### Um erro meu, pego antes de virar objeção

Quase recusei o patch alegando que o regex `^\* SEARCH([\d ]*)$/m` não casaria
linha **CRLF** (`[\d ]` não consome `\r`). **Testei antes de escrever:** em
JavaScript o `\r` **também** é terminador de linha pro `$` em modo multiline
(diferente de POSIX), então casa — e é o **mesmo regex do `fetchUnseen`**, que
roda em produção há semanas. Teria sido uma objeção falsa que atrasaria um fix
bom, sustentada por raciocínio que eu não conferi.

A lição é a de 13/09 se repetindo: **achado que confirma a própria tese é o que
menos se confere.** Foi assim que o `#152` quase pagou em dobro.

### Risco residual, anotado e não bloqueante

No timeout o `Promise.race` desiste mas o `fetchThread` segue até o comando em
voo resolver, e só aí o `finally` fecha a sessão. Como as chamadas são
sequenciais, fica limitado a uma sessão por vez.

**Não resolve** (dito na nota do autor): disparo que não passa pelo `respondOne`
— o e-mail das 14:15Z não era resposta a nada — continua sem conferir pedido de
reembolso aberto.

Chave `patch_129106de` apagada com `DELETE` (não `set_state` value null, que
volta `23502` e **deixa a chave lá**). Conferido: 0 sobrando.

---

## 4. O que eu NÃO fiz

- **Nenhum write no mundo externo.** Nenhum e-mail a aluno, nenhum cancelamento,
  nenhum crédito, acesso ou entitlement mexido. Esta ronda não tocou em dinheiro
  de ninguém.
- **Não ataquei a fila de recados** (~77 abertos). Não olhei. Segue como estava.
- **Nenhuma migration.** Nada que dependa de coluna nova.
- **Nada da planilha** (ordem de 29/08).
- Não toquei nos branches STALE (`feat/fix-image-upload-retry`,
  `feat/onedrive-401`, `fix/referencia-fronteira-de-frase-por-palavra`,
  `feat/fabricar-referencia-fronteira-por-palavra`).

---

## 5. O que fica pro Johnny (nada novo — tudo repetido de rondas anteriores)

1. **`#389` — 12 clones entregues (R$ 7.449,00) contra compra contestada, e 7
   ainda em produção.** Continua sendo a única coisa que depende de decisão sua,
   e os 7 seguem sendo montados enquanto não houver resposta. **3ª ronda.**
   Há recado de 11:25Z pedindo pra segurar os 7 antes que virem entrega às cegas.
2. **Reembolsos parados:** Lucila `#299` (R$ 291), Francislaine `#307`, `#309`,
   `#363`.
3. **Emanuel — 180,81 EUR**, parado desde 11/09. **6ª ronda.** O `#387` conserta
   a *causa* de ele ter recebido resposta contraditória; **não devolve o
   dinheiro dele**, que não é minha alçada.
4. **Marcelo — R$ 194 já pagos** por um produto que nunca entregou uma voz.
   Cancelamento feito; devolução não é minha alçada.

---

## Fim de ronda

- `git fetch origin && git log --oneline origin/main..HEAD` → conferido **vazio**
  depois do push deste log.
- Branch `vigia/129106de`: mergeada (PR #271) e **deletada** no origin. Nenhum
  fix preso em branch.
- Deploy da main conferido `success` **antes** de marcar o incidente `fixed` —
  merge não é produção.
- Nenhuma migration nesta ronda.
