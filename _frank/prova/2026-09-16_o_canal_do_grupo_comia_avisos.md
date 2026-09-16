# 16/09 00h00Z — O canal do grupo comia avisos em silêncio (2 perdidos, 24h)

Ronda das falhas de 15/09 23h40Z, incidente `9ac03612` (#11). **O incidente já
estava tratado quando eu cheguei** — e o achado desta passada é outro: o único
canal do FastCloner estava descartando avisos.

---

## 1. Primeiro: o #11 já estava feito, e eu não refiz

A ronda das 23h40Z rodou minutos antes desta e levou o #11 até onde dava. Medido
antes de tocar em qualquer coisa (notas do próprio chamado, 23:47:36Z e
23:49:14Z, e a transcrição `b0ae517a`):

- 4ª ocorrência (15/09 21:46:06Z) nasceu **com diagnóstico**: `trainer_returncode=1`
  + `torch.OutOfMemoryError` de VRAM. Causa = **recurso**, não código.
- Aluno `ricardoolito@gmail.com` **não está esperando**: voz `f58a158a` ready
  22:53:07Z, avisado 22:53:08Z, **nunca cobrado** (zero linhas em
  `credit_transactions`) — não havia estorno a fazer.
- Chamado **#422** (`bb4d4cd0`) aberto para a prevenção (retentativa de falha
  transitória), **sem código e sem PR**, esperando aval do Johnny pra gastar GPU.
- `investigating` mantido de propósito, com régua escrita pra fechar.
- **O aviso do grupo saiu** (2 envios confirmados `enviado ao grupo`).

**Não repeti nada disso.** Duplicar o aviso no grupo seria o ruído que mata o
canal (regra 27, e o Lucas está lá). O que fiz foi **conferir** e seguir pro que
ninguém tinha visto.

⚠️ Divergência de estado, registrada: o card da ronda dizia `[open]`; o banco diz
`investigating`. O que vale é o banco.

---

## 2. O achado: dois avisos foram RECUSADOS e nunca chegaram ao grupo

Em `FrankClaw/store/prova/telegram-nao-enviados.jsonl`:

| quando | motivo do Telegram |
|---|---|
| 14/09 22:06:03Z | `can't parse entities: Unsupported start tag "24h."` |
| 15/09 00:30:41Z | `can't parse entities: Unsupported start tag "-"` |

**A causa:** o envio ia com `parse_mode=HTML` contra texto operacional cru. Texto
de aviso é cheio de `<` legítimo **no meio do dado** — `"Seria a 4ª carta em
<24h."` e `"37 sem assinatura -> SEM acesso  <- Franklin"`. O Telegram lê aquilo
como tag inválida e **recusa a mensagem inteira**.

**Por que a retentativa não salvou, e por que ela está certa:** a regra 4 do
`telegram-send.sh` não retenta quando a API devolve `ok:false`, porque repetir dá
o mesmo erro e duplica ruído. Está correta. O efeito colateral é que **essa
classe de falha é definitiva**: o aviso morre de vez, por um caractere no meio de
um número.

**O que estava dentro do aviso perdido de 15/09** (o custo real): o achado de que
`goudardexecutivo` e a conta do **próprio Lucas** estão com assinatura ativa,
crédito parado e sem janela de acesso. Ficou 24h sem ninguém ler.

### A armadilha de fundo

O script já fazia a parte difícil certa — grita, sai `!=0` e grava prova em disco,
justamente pra silêncio não parecer saúde. Só que **ninguém lia o arquivo de
prova**. O instrumento funcionou e o resultado dele ficou parado no disco por 24h.
É a família do playbook Q: a prova existia e não foi buscada.

---

## 3. O conserto, e como ele foi provado

`FrankClaw`, commit `17be322`, branch `fix/notify-texto-puro`.

**Texto puro: `parse_mode` foi removido.** Por que não escapar `& < >`: escapar
conserta três caracteres e deixa a **categoria** viva (`parse_mode` pode recusar
por outros motivos). Sem `parse_mode`, `can't parse entities` deixa de existir
como classe de falha.

**Ninguém perde formatação** — conferido com `grep` em todos os chamadores
(`notify.sh`, `notify-grupo.sh`, `frank-watchdog`, `prenotami-loop/cron`,
`limpar-tmp`, `frank-claude-account`, `notify-agent-hook`, `prova-watchdog`):
nenhum manda tag HTML, todos mandam prosa com emoji, que renderiza igual.
Consequência aceita e documentada no código: `<b>negrito</b>` passaria a aparecer
literal. Entregar o aviso feio vale mais que perdê-lo bonito.

**Prova — `scripts/lib/telegram-send.test.sh`:** sobe um Telegram de mentira que
**imita a recusa de parse de verdade** (não é só um `grep` por `parse_mode`) e usa
os **dois textos reais** do arquivo de prova como caso de teste.

- contra o código velho: **3 de 8 falham** (os dois avisos são recusados de novo)
- com o fix: **8/8 passam**

Ele também tranca as regras que já estavam certas: prova em disco na recusa, e
nenhuma retentativa de recusa.

**Prova de ponta a ponta, no Telegram de verdade:** o aviso desta ronda foi
enviado **contendo um `<` de propósito** (`0,27% é <0,3%`) e foi entregue
(`enviado ao grupo`). Sob o código velho, aquela mensagem teria sido recusada.

---

## 4. O outro achado: 10 commits de prova existiam só neste disco

`git branch -r --contains caa23e70` voltou **vazio**. A branch
`feat/resumo-diario-grupo-suporte` **não existia no remoto** e a upstream dela
apontava pra `feat/escalacao-sem-zap-do-time`, que para em `d6853bfc` (04/09).

Ou seja: **10 commits de prova, de 06/09 a 15/09, não estavam em lugar nenhum além
da máquina** — playbook P2 na veia. Empurrei pra
`origin/feat/resumo-diario-grupo-suporte` e confirmei com `--contains`.

Conferi o gatilho antes de empurrar (`deploy.yml` → `push: branches: [main]`):
branch de feature **não dispara deploy**. Nada foi pra produção.

⚠️ **Não commitei** o que estava sem commit (`entregar.ts`,
`refazer_audio_conta_da_casa.cjs` e o `resumo-time`): é trabalho em voo de outra
frente e eu não revisei. Empurrar commit já existente não pede julgamento;
commitar código de outro, sim.

---

## 5. A remedição do achado perdido (não repeti número velho)

O aviso de 15/09 era de 24h atrás, então **remedi antes de reafirmar**:

| conta | entitlement | saldo | `access_until` | `access_source` |
|---|---|---|---|---|
| `goudardexecutivo` | **active** | 76.911 | NULL | NULL |
| `lucas.m.arrial` | **active** | 100.000 | NULL | NULL |
| `valdianycoelho83` | canceled | 99.075 | NULL | NULL |
| `allan-zequini` | canceled | 0 | NULL | NULL |

Mudou em relação ao aviso perdido: o saldo do `goudardexecutivo` era 76.511 e hoje
é **76.911**, e o `access_until` está **NULL**, não "vencido em 13/09".

⚠️ **NÃO provei bloqueio.** Medi estado de banco, não comportamento de gate
(playbook M: achar o campo não prova que ele decide). E `entitlements.status`
**não prova pagamento** — quem sabe é a Hotmart (playbook X). Foi assim que o
número 147 virou 0. Deixei os dois rótulos separados na mensagem do grupo.

**Roteamento:** acesso e assinatura da conta do sócio é **comercial**, não meu
(playbook N). Entreguei aos humanos no grupo e **não mexi em nada**. Não abri
chamado novo: a regra 8 manda não abrir o próximo antes de fechar o da vez, e o
achado já está com quem decide.

**O aviso perdido de 14/09 (Valdene) está SUPERADO** e eu não o repeti: `auth.users`
mostra `recovery_sent_at` = **15/09 23:26:20Z** (carta nova saiu nesta noite, por
outra frente) e `last_sign_in_at` segue **NULL**. Reenviar um relatório de
não-ação de 25h atrás como se fosse novo seria mentir pelo relógio.

---

## 6. O que NÃO fiz

- Não gastei GPU, não apliquei migration, não mexi em crédito de ninguém.
- Não escrevi pra aluno: nenhum dos 4 do #11 está esperando.
- Não mudei o status do #11 nem do #422, e não repeti o aviso deles no grupo.
- Não mergeei nada na `main` — os dois consertos estão em branch publicada.
- Não abri PR do `resumo-time`: não fui eu que escrevi.

## 7. O que fica pendente

1. **`fix/notify-texto-puro` (FrankClaw) espera merge.** O conserto **já está
   ativo** pra mim, porque os scripts rodam da árvore de trabalho — a branch é
   preservação e revisão, não ativação.
2. **#422 continua parado no aval do Johnny** pra gastar GPU na retentativa.
3. **A conta do Lucas e a do `goudardexecutivo`** esperam decisão comercial.
4. **`feat/resumo-diario-grupo-suporte`** tem trabalho sem commit de outra frente
   na máquina. Ainda não está protegido — só os 10 commits estão.
