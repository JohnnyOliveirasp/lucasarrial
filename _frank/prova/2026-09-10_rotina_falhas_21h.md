# Ronda das falhas — 10/09/2026, ~20h30–20h50Z (17h30–17h50 BRT)

Dono da fila (14-A). Backlog **serial**. `main` + `pull --ff-only` antes de
tocar em nada. Índice de ordens lido primeiro.

Ordem de **29/08** respeitada: nada da planilha lido, escrito, classificado,
avisado ou reprocessado; nenhum chamado de causa-planilha aberto ou reaberto.
Ordem de canal de **31/08**: os dois avisos desta ronda saíram **no grupo**.

**Fechado: PR #55**, superado e perigoso de mergear — medido na `main`, não
herdado de nota. **Escalado: Marcelo**, com relógio de ~30h.
**Nenhum aluno recebeu e-mail nesta ronda, e o §2 diz por que isso é decisão.**

---

## 1. Por que não peguei o mais antigo: os 5 de cima estão bloqueados

A regra manda o mais antigo **com aluno afetado**. Conferi um a um em vez de
herdar o veredito da ronda anterior:

| # | idade | por que não avança hoje |
|---|---|---|
| `#15` | 30/07 | `last_seen` 04/09, **zero ocorrência nova**. A condição escrita no próprio cartão (falha nova sob a régua nova, ou 30 dias limpos a partir de 10/09) não foi atingida. |
| `#47` | 19/08 | aluna avisada **hoje**, cópia confirmada. Regra 8: esperar aluno não é estar travado. |
| `#99` | 23/08 | espera **decisão comercial**. E-mail prometido para **16–17/09**, não antes. |
| `#223` | 01/09 | espera **uma frase do Johnny**. Escalado ontem, urgente. Não re-escalei: sem fato novo, é ruído. |
| `#226` | 01/09 | o próprio cartão diz *"o que precisa de DECISÃO (não é minha)"* — falhar o job sem cobrar, entregar avisando, ou seguir em silêncio. É **escolha de produto**. |

`#234` (02/09, 609 gerações) está **vivo e sendo trabalhado**: 33 notas, a
última hoje **16h47Z**. Não é abandono e não se fecha numa ronda — trava em
timestamp de palavra, que é pesquisa, não conserto.

**O padrão, que importa mais que qualquer um deles:** o topo da fila **não está
parado por engenharia**. Está parado por decisão.

---

## 2. Aluno esperando, que vem antes da fila

### `marcelopersonalthe32` — escalado ao grupo, relógio de ~30h

Pagante de verdade (`pagou_de_verdade.cjs`): **R$ 562** no total — R$ 368,64 em
27/07, R$ 97 em 12/08, R$ 97 em 05/09 (`APPROVED`).

Ele pediu **por escrito** para sair em **09/09**, dentro do prazo que **nós**
demos. A garantia da cobrança de 05/09 fecha **12/09 00:00**.

Medi agora, e é isto que ninguém tinha medido: **a assinatura dele continua
`active`**, `access_until` 05/10. Ou seja, sem alguém encerrar, **cobra de novo
em 05/10** um aluno que já pediu para sair.

Escalei ao grupo com o código da transação (`HP0618766977`), não com o e-mail
dele. **Não cancelei e não estornei**: é ação externa na Hotmart, não é minha, e
a decisão é do Johnny. Ele já foi avisado por e-mail (ronda das 12h, uid 1592)
de que o caminho da Hotmart é dele e fecha amanhã.

### `hellengrasso` — não escrevi, e escrever seria repetir um erro nosso conhecido

Ela aparece na varredura como *"acesso até 2026-09-12"*, com 4 dias sem voz e
95.375 créditos. A leitura óbvia — *"o acesso dela vence em 2 dias, avise"* — é
**falsa**, e é exatamente a armadilha de um chamado aberto nosso: para
assinatura `ACTIVE`, essa data é a **próxima cobrança**, não vencimento.

Conferi antes de escrever: `status = active`, `raw_event.subscription.status =
ACTIVE`. **Ela não perde nada em 12/09.** Mandar "seu acesso vence" seria dar
prazo falso — que já queimou 27.436 créditos de outra aluna em 07/09.

O resto do caso está certo: falha nossa (5 de 7 arquivos não chegaram), ela foi
escrita em 06/09, o fix da tela subiu em `1ba71a5`, **nada foi cobrado dela**. A
bola é dela há 4 dias, e a régua da casa pede segunda tentativa a partir de 7.
**Nada a fazer hoje** — e isso é resultado, não omissão.

---

## 3. O que eu consertei: um PR que ia derrubar produção estava na fila de "decidir"

### O achado

O **PR #55** (*"trava(video-clone): rosto fora de camera nao cobra nem vai pra
GPU"*, aberto **25/08**) estava listado na ronda das 12h como 🟡 *"vale decidir
junto"*. O título se lê como se fosse a cura do **#335** — o gate de rosto que
cobra cena larga. **Não é**, e mergear seria regressão.

### A medição, feita na `main`, não na descrição do PR

O gate **já está em produção por outro caminho**:
`frontend/src/lib/video-clone/face-gate.ts` (commit `97fa8cc`), chamado em
`api/v1/video-clone/route.ts:155`, **antes da cobrança**, com
`faceGateMessage()` avisando o aluno que não foi cobrado. O `#131`, que gerou o
PR, está `fixed`.

O PR #55 criava um **segundo** arquivo — `lib/video/face-check.ts`, caminho
diferente — e somava **+23 linhas no MESMO `route.ts`**. Mergear hoje poria
**duas chamadas de visão em sequência antes de cobrar**, duas implementações
concorrentes e conflito no route. É a armadilha do `feat/onedrive-401` e do
`feat/fix-image-upload-retry`, pela terceira vez.

Comparei item a item antes de descartar, para não jogar fora fix melhor:

| | main (`97fa8cc`) | PR #55 |
|---|---|---|
| modelo | claude-haiku-4-5 | gpt-4o-mini |
| critérios | `frontal` + `mouth_visible` | **idênticos** |
| fail-open | sim | sim |
| timeout | 30s | 15s |
| presigned | 600s | 300s |
| chave de desligar | `VIDEO_CLONE_FACE_GATE=0` | não tem |

A main é **no mínimo equivalente** e ainda traz o kill-switch. O PR não trazia
nada que a main não tenha.

### O que isso NÃO resolve, e por que o #335 continua aberto

**Nenhuma das duas versões mede o TAMANHO do rosto no quadro.** Os critérios
são os mesmos nos dois. Cena larga com rosto pequeno **continua passando e
continua sendo cobrada** — que é a causa dos **7 clones** cobrados do
`mastroianni` em 09–10/09. Fechar o PR não deixa buraco: o buraco é o `#335`,
segue aberto, e agora tem a nota dizendo onde se mexe (`face-gate.ts` na main).

### Verificação, depois de gravar

- `gh pr view 55` → `state: CLOSED`, com o porquê comentado no próprio PR.
- `#335` (`81438b60`): `agent_notes` **1 → 2**, **1 linha afetada** conferida na
  releitura. Status **inalterado** (`investigating`) — de propósito: o defeito
  não foi corrigido, só desfiz a confusão sobre quem o corrige.
- ⚠️ O branch `feat/trava-foto-frontal-clone` **continua no origin**. Não apaguei
  (destrutivo, e não é minha alçada). Fica registrado como stale, ao lado dos
  outros três.

---

## 4. O número que explica a fila melhor que qualquer cartão

**28 PRs abertos.** O mais antigo é o **PR #4, de 18/08 — 23 dias.**

Vários atacam incidente que **ainda está aberto na fila** — #203 (o e-mail que
diz ao assinante pagante que ele não tem a plataforma, 15 alunos), #200 (#251),
#198, #189, #188. O trabalho **foi feito**; ele não está em produção.

Isto não é opinião de processo: é a regra da casa medida ao vivo — *"card
completed não significa em produção; só a main deploya"*. A fila não baixa
porque **o conserto está escrito e parado**, não porque ninguém consertou.

---

## 5. O que eu NÃO fiz, de propósito

- **Não escrevi para nenhum aluno** (§2 — os dois casos, com o motivo medido).
- Não cancelei assinatura, não estornei, não creditei, não mexi em acesso.
- Não gastei GPU. Não apliquei migration.
- Não mergeei nada. **Não apaguei branch no origin.**
- Não re-escalei `#223`/`#341` — já escalados, sem fato novo.
- Não toquei nos arquivos não commitados do `/sgp` (rotas, `sessao.ts`,
  `messages/*.json`): **não são meus.**

## 6. Fim de ronda

- `git log --oneline origin/main..HEAD` → conferido **vazio** após o push.
- Nenhum fix preso em branch: nesta ronda **não escrevi código de produto** —
  o que mudou foi um PR fechado, uma nota de incidente e este log.
- Avisos do fato consumado postados **no grupo** (ordem de 31/08), uma linha por
  fato: o escalonamento do Marcelo e o fechamento do PR #55.

## 7. Para quem pegar a próxima

1. **Marcelo**: se o Johnny não decidir até **12/09 00:00**, a garantia fecha e a
   assinatura **cobra de novo em 05/10**. Confira `entitlements.status` antes de
   supor que alguém resolveu.
2. **`hellengrasso`**: 12/09 é **cobrança, não vencimento**. Não mande prazo.
   Segunda tentativa a partir de **13/09** (7 dias).
3. **`#335`** é o dono da lacuna do gate de rosto — não existe branch pronto.
   Mexe-se em `face-gate.ts` na main, acrescentando medida de enquadramento.
4. **`#99`**: e-mail em **16–17/09** se ele seguir em silêncio. Não antes.
5. **28 PRs abertos, o mais velho de 23 dias** (§4). Antes de escrever fix novo,
   vale conferir se ele já existe parado — o PR #55 provou que um deles já não
   servia mais.
