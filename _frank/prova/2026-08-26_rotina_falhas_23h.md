# Rotina das Falhas — 26/08/2026, ronda das 23h UTC

Dono da fila: Claude. Método serial (regra 8, ordem de 21/08).
Entrada: `git checkout main && git pull --ff-only origin main` → já em dia em
`21dbe35`. Índice de ordens lido. Ronda anterior committada: **22h UTC**.

**Placar honesto: 0 incidente fechado, 0 e-mail pra aluno, 0 crédito devolvido
(não havia o que devolver), 0 código meu. O que esta ronda entrega é a CAUSA do
`#146`, medida e localizada na linha — e ela refuta as duas hipóteses que
estavam em pé, inclusive a que eu herdei escrita dentro do próprio incidente.
O `#146` continua `investigating` porque o fix não está em produção: a metade
que resolve de verdade mexe em crédito e eu não subo isso sem o Johnny.**

---

## 1. O serial: `#146` (`e4d8b6ce`), e por que não peguei o mais antigo

A regra 8 manda pegar o mais antigo com aluno afetado. O mais antigo é o `#52`
(19/08). **Não o peguei, e a justificativa é medição, não conveniência:** a
ronda das 22h mediu que no `#52` não há aluno esperando (13 dos 14 geraram áudio
depois da própria falha; o 14º nunca pagou) e não há crédito devido (as 20
falhas com débito têm as 20 com estorno). O `#52` está bloqueado num card de
observabilidade que **não** está em produção (§5) e a pergunta que o fecha virou
"por que 80% das entregas precisam de regeneração" — não fecha numa ronda.

Os outros abertos: `#99` (Luciano) e `#120` (Sandra) esperam **decisão de
pessoa**, não trabalho técnico; `#143` espera a linha do Johnny; `#97` não
dispara há 3 dias.

O `#146` é o único aberto que era **diagnosticável e consertável hoje**, e o
Vigia que o abriu deixou explícito que a investigação do código é do dono da
fila. Peguei esse.

## 2. As duas hipóteses que estavam em pé, e a medição que derruba as duas

**(a) A do Vigia** — *"o portão pode não estar somando o conjunto todo"* (marcada
por ele mesmo como hipótese, não medição). **Refutada:** a MESMA voz, com os
MESMOS 10 arquivos, foi medida pelo próprio portão às 19h49 e gravou
`duration_seconds = 1719` (28min39s). O portão mede esse material certo.

**(b) A do "EXECUTOR"**, já escrita dentro do incidente às 22h25Z — timeout de
90s / `MAX_FILES=12` / truncagem do stderr do ffmpeg em `speech-estimate.ts`.
**Refutada pelo código, sem precisar de dado:** os três caminhos derrubam
`estimate.reliable`, e o chamador (`import.ts:583`) **já faz fail-open** em
`!reliable` — manda pra `awaiting_training`, nunca pra `rejected_too_short`.
Nenhum dos três consegue produzir esta recusa. O plano recomendado por essa nota
("fail-open no portão") pedia implementar uma coisa **que já existe há tempo no
arquivo**.

Registro isso sem ironia e com o meu nome junto: eu comecei a ronda com a mesma
hipótese do timeout na cabeça e só não a segui porque fui ler o chamador antes de
escrever. **Nota de incidente não é medição** — a de 22h25Z tinha o formato de um
diagnóstico pronto e estava errada nos três itens.

## 3. A causa real: o portão não mediu porque não rodou

`importTrainingAudios`, `frontend/src/lib/onboarding/import.ts:449-478`:

```
.eq("name", ONBOARDING_VOICE_NAME).order("created_at", {ascending: true}).limit(1)
if (existing && existing.status !== "uploading") {
  result.skipped = fileIds.length;               // pula TUDO, sem baixar nada
  return { ...result, voice_status: existing.status };
}
```

Dois defeitos independentes na mesma guarda:

1. **Estado terminal de FALHA é tratado como "já pronto".** `rejected_too_short`
   e `failed` não são conclusão, são falha. Material novo mandado depois é
   pulado sem download e sem medição.
2. **Pega a voz MAIS ANTIGA** (`created_at ASC limit 1`), não a atual. Aluno que
   já consertou segue sendo julgado pela primeira falha.

Depois, `route.ts:368-371` converte esse `voice_status` **herdado** em e-mail ao
aluno afirmando *"o áudio enviado soma menos de 20 minutos"* — uma afirmação
sobre material que o sistema nunca olhou.

**A prova, no caso que abriu o chamado.** Run `f7a26c5e` (26/08 19h31):
`resultado->audios = {"imported":0, "skipped":10, "voice_id":"8dafbf91",
"voice_status":"rejected_too_short"}`. A voz `8dafbf91` é de **24/08**, tem **1
arquivo**, `duration_seconds = 72` (setenta e dois segundos) e o `updated_at`
dela **não se moveu em 26/08**. O aluno tinha acabado de mandar 10 arquivos com
28 minutos.

## 4. Blast radius medido — e o que ele NÃO é

Todas as 20 recusas com esse motivo em 14 dias. **18 não mediram nada**
(`imported = 0`). Separando as 18 pelo fileId do link de áudio, que é o que
distingue "mesmo material" de "material novo":

| o que era | n | o dano |
|---|---|---|
| áudio pedido **já estava** na voz | 16 | veredito legítimo, mas **e-mail de recusa duplicado** (robson 3×, itabenke 3×, isabella 3×, adrianomarques 2×, aleciotenório 2×, kelinnavelar 2×) |
| coluna de áudio trazia **o link da foto** | 1 | kelinnavelar levou recusa de ÁUDIO por causa de uma FOTO |
| áudio **genuinamente novo**, recusado sem ser olhado | 2 | rafaelleitemacedo (22/08) e ycarlosk (26/08) |

As outras 2 (itabenke 1ª run, definidameta) **mediram de verdade**: recusa
legítima, ficam de fora.

**Duas coisas que eu quase reportei errado e conferi antes:**

- **kelinnavelar.** Ela apareceu como "reenviou áudio em 25/08 e foi ignorada" —
  seria a vítima viva do chamado. Fui ver o run: `audios_link` e `images_link`
  são **o mesmo link**, e ele importou um `.jpg`. Ela não mandou áudio novo. A
  recusa dela de 13/08 (1174s = 19min34s, **26 segundos** abaixo da porta) é
  medição legítima e continua de pé.
- **rafaelleitemacedo.** O caso dele é o defeito (2) puro e é pior do que parece:
  ele **já tinha voz `ready` desde 16/08** e mesmo assim levou, em 22/08, um
  e-mail dizendo que o áudio dele tinha menos de 20 minutos — porque a guarda leu
  a voz reprovada de 13/08 e ignorou a boa.

**Quem está parado agora:** 5 alunos com zero voz pronta e a única voz em
`rejected_too_short` — adrianomarques (14/08), robson (14/08), kelinnavelar
(13/08), isabella.abasup (22/08), definidameta (25/08). **Os 5 NUNCA PAGARAM**
(`pagou_de_verdade.cjs`, Hotmart viva; a assinatura R$0 APPROVED da definidameta
é trial, não pagamento). Caem na **REGRA FINAL DE CRÉDITO de 20/08**, assunto
encerrado: **não** restaurei crédito, **não** restaurei acesso, **não** gastei
GPU com nenhum deles, e **não** reabri a decisão.

**Nenhum pagante está bloqueado por este defeito hoje.** O único pagante atingido
(ycarlosk, virou pagante 26/08 14h13, R$97) escapou **por sorte**: refez por
outro caminho — o uploader da tela, que não tem esta guarda — 18 minutos depois.

**Por que isso importa mesmo sem pagante parado:** o defeito **tranca a porta**.
Depois de uma recusa, o caminho da planilha nunca mais olha material novo daquele
aluno. É o mecanismo real por trás do enquadramento do `#139` — em parte não é o
aluno que desiste, é a casa que se recusa a olhar de novo.

## 5. O que eu delegei, e a decisão que é do Johnny

**Card `93f56e4d` no `coder`**, com o diagnóstico pronto, os arquivos e linhas, a
lista do que **não** investigar (os três becos refutados na §2) e os testes
exigidos. Fix partido em duas metades **por risco de dinheiro**:

- **Parte A** — `route.ts` para de afirmar duração quando o run não mediu nada
  (`imported === 0`). Mata o e-mail mentiroso e os 16 duplicados. **Não cobra
  ninguém.**
- **Parte B** — voltar a olhar material novo depois de uma recusa. É o que
  destranca a porta, e **cobra**: conferi que `dispararTreinoOnboarding`
  (`onboarding/treino.ts`) debita `TRAINING_CREDIT_COST` e, por decisão do Johnny
  de 21/08, **não tem trava de saldo** — o aluno fica negativo até assinar.
  Reabrir a porta pra quem reenviar áudio significa cobrar.

**Não subo a Parte B sem o "pode" do Johnny.** Avisado no Telegram
(message_id 474), com a pergunta separada do relatório, como manda a ordem.

## 6. Higiene do fim, e um achado nela

- `git log --oneline origin/main..HEAD` → **vazio**. Nada meu preso local.
- **Achado:** o card `daeb037d`, que a ronda das 22h delegou e o board marca como
  **completed**, está no **PR #63, ABERTO** desde 21h56Z. O código **não está em
  produção**. É exatamente a armadilha que a ordem manda checar ("card completed
  não significa em produção") — registro sem mexer: não é meu card e não revisei
  o conteúdo dele.
- Não mergeei PR nenhum às cegas.

## 7. O que eu NÃO fiz

Não fechei nem reabri incidente nenhum — o `#146` segue `investigating`, porque a
causa está **localizada mas não corrigida em produção** (regra 14). Não escrevi
pra aluno: os 2 com material novo recusado (ycarlosk, rafaelleitemacedo) **já
estão gerando** com voz pronta, e os 5 parados nunca pagaram e caem na regra
encerrada de crédito — escrever pra eles hoje seria, na prática, convidar trial
churnado a voltar, que é decisão comercial do Johnny/Lucas, não minha. Não toquei
em crédito, acesso, assinatura nem estorno. Não apliquei migration. Não rodei
GPU, whisper, `--curar` nem `--medir`. Não escrevi código. Não mexi em cron nem
em ordem. Não reabri o `d3d8d1b2`, o `#139` nem a decisão das 55.
**Não postei no grupo:** a regra 7 pede fato consumado (incidente fechado, fix em
produção, e-mail pra aluno) e não tenho nenhum dos três.

## 8. Para quem pegar a próxima ronda

- **O `#146` está com a causa na mão.** Se o Johnny liberar a Parte B, o trabalho
  é revisar o PR do card `93f56e4d` e subir. Se não liberar, subir só a Parte A já
  para o e-mail mentiroso.
- **Não gaste ronda** com timeout de 90s, `MAX_FILES` ou stderr do ffmpeg no
  `speech-estimate.ts`. Refutado pelo código na §2, com o motivo escrito.
- **Desconfie de nota de incidente com cara de diagnóstico pronto.** A de 22h25Z
  no `#146` estava errada nos três itens e recomendava implementar uma proteção
  que já existe no arquivo desde antes.
- **O `#139` precisa ser reenquadrado** quando o `#146` fechar: parte do "recusado
  e nunca voltou" é porta trancada, não desistência.
- **PR #63 continua aberto** (§6). Enquanto não entrar, o `#52` não ganha a
  telemetria que a ronda das 22h pediu.
