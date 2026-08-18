# Rotina das falhas — rodada das 15h BRT (18h UTC) de 18/08

Fila no início: **1 incidente** (`investigating`). Fila no fim: **0**.
Varredura de travados no fim da rodada: **nada preso, nada aberto**.

---

## Incidente b7d31552 — Viviana Cotua (tecnologylegacy@gmail.com) → `fixed`

Aberto 18/08 01:10 UTC pela Fast, 3 ocorrências, última 02:55 UTC.
Relato: *"presiono generar y no pasa nada"* no Video Clone, desde 17/08.

### O que era (provado, não deduzido)

Falha silenciosa de **UI**, não de backend. O botão Gerar era
`disabled={!image || !audio || submitting || !!uploading}`
(`clone-studio.tsx:432`) **sem tooltip, toast ou texto**. Faltando foto e/ou
áudio, o clique não produzia nada.

Prova, e é o que fecha o caso:

| Fato | Evidência |
|---|---|
| Ela nunca teve voz nenhuma | `voices` = **0 linhas** |
| Logo, não tinha áudio pra escolher | botão morto **permanentemente** |
| Funcionou assim que existiu um áudio | clone `45b5f4de`, 18/08 03:40 UTC, `status: ready`, −3675 |
| O áudio veio do computador dela | `audio_path .../video-clone/uploads/80f81929….mp3` |

Descartados com dado na mão: backend, navegador/cache (ela já tinha testado),
crédito (saldo intacto), acesso (valia às 01:10).

### O que eu fiz

- **`b9c4c9c`** na `main` — botão só desabilitado durante upload/envio;
  faltando insumo o clique escreve no `<p role="alert">` o que falta, e sugere
  MP3 pra quem não tem voz. 3 idiomas, incluindo **ES** (idioma dela).
  `tsc --noEmit` e `eslint` limpos, conferidos por mim, não só pelo executor.
- **Confirmado no servidor** antes de fechar o incidente:
  `clone-studio.tsx:437` já tem o `disabled` novo e o chunk
  `.next/static/chunks/app/[locale]/app/videos/clone/page-fd749a238f72e6b3.js`
  contém as chaves novas. Action verde **não** foi aceito como prova.
- **`b8acd66`** — playbooks **O** (botão mudo) e **P** (fix pronto ≠ fix no ar).

### O fix anterior que não existia

A nota do VIGIA de 18/08 12:15 dizia que a correção estava pronta na branch
`agent/fix-video-clone-botao-silencioso`. **Essa branch não existe no repo** e
o código mudo seguia em `origin/main` às 18h — 6 horas parecendo entregue.
Refiz do zero. Virou o playbook P.

### Desfecho humano — ruim, e é o que importa

Ela não esperou:

| Hora (UTC) | O quê |
|---|---|
| 18/08 14:40 | recarga do ciclo **+100.000** (Plano Founder, US$ 22, 2ª cobrança) |
| 18/08 16:52 | Hotmart marca **DISPUTE** → `chargeback`, assinatura **CANCELED** |

Ficou com **195.800 créditos** e **sem acesso**. Pagou de verdade duas vezes e
reverteu depois de dois dias levando FAQ genérico de navegador.

**Não decidi nada disso sozinho** e mandei as duas binárias pro Johnny às
15h BRT (não esperei o relatório, porque é dinheiro):

1. o saldo de 195.800 fica ou zera? *(minha recomendação: zera — o dinheiro
   voltou pra ela, então não há pagamento. Mas crédito não se toca sem a
   palavra dele.)*
2. escrevo pra ela ou deixo quieto? *(minha recomendação: quieto — depois de
   chargeback, qualquer contato vira conversa de reembolso, alçada dele e do
   Lucas.)*

### Achado estrutural

A Fast respondeu **FAQ genérico duas vezes sem abrir a conta** (viola a
regra 11). Se alguém tivesse aberto, "zero vozes" aparecia na primeira
consulta. Foi isso que gerou o *"acha que eu não tentei isso antes?"*.

### Quantos mais estão na mesma situação

550 perfis têm crédito. Destes, **185 não têm nenhuma voz** e 193 não têm voz
pronta — todos expostos à mesma parede muda, e é por isso que o conserto foi
de UI e vale pros 185, não só pra ela.

⚠️ **Não dá pra contar quem bateu na parede**: o clique nunca chegou ao
servidor. Esse número não existe e não vou inventar um.

---

## Fora do FastCloner, mas atrapalhava esta rotina

`FrankClaw/scripts/notify.sh` mandava a resposta do Telegram pro `/dev/null`:
falha de envio era **indistinguível de sucesso**. Eu "avisava" o Johnny sem ter
como saber se chegou — mesmo modo de falha do `|| 'Done.'`. Corrigido: agora
confirma o envio ou falha alto. Testado, canal confirmado de pé.
