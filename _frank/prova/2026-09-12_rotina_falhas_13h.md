# Ronda das falhas — 12/09/2026 ~12h40–13h00Z (09h40 BRT)

Canal: ordem de **31/08** — tudo de FastCloner vai pro **grupo**, e só pro grupo.
Este arquivo é o log técnico; a mensagem do grupo é o resumo dele. Aviso do
grupo **enviado** (`notify-grupo.sh`, confirmado).

Repo em `main`, `pull --ff-only` limpo. Li `_frank/ordens/README.md`, a ordem de
**27/08** (só erro de sistema vira chamado) e a de **29/08** (planilha
desligada). **Nada da planilha foi lido, escrito, classificado ou
reprocessado.**

Fila na entrada: **80 abertos** (3 com 30d+, 33 na faixa 3–7d). `now()` medido
no banco = **2026-09-12 12:41:49Z**.

---

## 0. Qual incidente peguei, e por que não foi o mais antigo

Regra 8 manda pegar o mais antigo **com aluno afetado**. Peguei o **`#364`**, de
hoje, e o motivo é explícito para poder ser contestado:

- os dois mais velhos (94,9d — `#2d0509b4` e `#c726c5ae`) são **decisão de
  política parada com o Johnny**, e o `c726c5ae`/`#312` foi trabalhado na ronda
  das 11hZ (relabelado, 19 pagantes). Não fecham nesta ronda por esforço meu;
- o `#364` tinha **uma pessoa viva esperando em silêncio**, com desfecho
  definitivo e **sem ninguém para tropeçar nela** (fila de não-lidos = 0). É o
  caso que a prioridade da ordem manda pôr na frente da limpeza da fila.

O `#363` (Rodrigo, R$ 1.194,90, garantia vence **hoje 21h BRT**) **não está no
meu colo**: e-mail enviado e escalado como urgente às 10:49Z pela ronda das
11hZ, e a devolução é execução do Johnny. Repeti o relógio no aviso do grupo,
sem repostar o caso (regra 7 — não poste progresso parcial).

---

## 1. `#364` — a causa NÃO era a que o título dizia

### A suspeita que eu levantei e **derrubei** (registro porque quase virou erro)

`aluno.cjs` devolveu para `rafaelzan@me.com`: **SEM ACESSO, 0 créditos, compras
NENHUMA** — e a Hotmart viva devolveu **PAGOU R$ 894,00** (R$ 597 "Sistema de
Geração Pronto" + R$ 297 "Fábrica de Conteúdo Invisível", ambas APPROVED em
11/09). Isso tem a forma exata de *pagante trancado*, e eu cheguei a tratá-lo
como tal.

**A medição derrubou a suspeita**, e a fonte é código, não opinião:
`frontend/src/app/api/v1/webhooks/hotmart/route.ts:93-97` diz, com todas as
letras, que o SGP é aceito **só** para disparar o e-mail do portal e que **"Ele
NÃO ganha acesso, crédito nem entitlement"**. Ele comprou SGP + Fábrica;
**nenhum dos dois dá acesso à plataforma**. Logo `plan=free`, `access_until`
nulo e 0 créditos são o **desenho**, não defeito.

> **Sobre dinheiro, explicitamente (lição do `#152`): NÃO afirmo defeito de
> cobrança, NÃO proponho estorno, nenhum `ref_id` foi casado.** `credits_cost=0`
> na geração — conta da casa, nada foi cobrado dele.

### A causa real, com `arquivo:linha` na `main` de hoje

A row: `image_generations e568b3cd` — `status=failed`,
`kie_model='gpt-image-2-image-to-image'`, **`retry_count=0`**,
`kie_raw_error='your prompt was flagged by website as violating content policies.'`

**Eu abri as 4 fotos de referência** (baixadas do R2 e olhadas uma a uma, não
inferidas): 4 retratos impecáveis do mesmo homem, jaleco clínico, óculos, fundo
branco neutro, do busto pra cima. O prompt é o `AVATAR_SOCIAL` da casa
(`onboarding/avatares.ts:73`): *"professional social portrait, chest up, neutral
background, soft studio lighting"*. **Não há nada, nem na foto nem no prompt,
que viole política de conteúdo.**

| arquivo:linha | o quê |
|---|---|
| `images/sync.ts:27-29` | `isTransientKieError` casa `/internal error\|try again\|timeout\|temporar\|fetch failed/i`. Moderação **não casa com nada disso** |
| `images/sync.ts:146` | `if ((isTransientKieError(raw) \|\| onFallback) && (await tryImageRetry(id))) return;` → recusa não-transiente + aluno no **titular** (`onFallback=false`) ⟹ condição falsa ⟹ `failImageGeneration` na hora |

O comentário em `sync.ts:136-138` diz que o retry cruzado existe porque *"o
titular pode aceitar o que o Seedream recusou (caso 05/08: 4 alunos morreram no
Seedream sem 2ª chance com o GPT saudável)"*. **A direção espelho nunca foi
ligada.** O fallback está **vivo** em produção: 28 rows
`seedream/5-pro-image-to-image` em 30 dias.

**Alcance, medido e pequeno — não inflo:** `kie_raw_error` de moderação =
**2 ocorrências, 2 pessoas** em toda a base (10/09 e 11/09). É raro. Mas mata em
silêncio e sem segunda chance.

---

## 2. O resgate — e por que ele É a prova da causa

Reenviei as **mesmas 4 fotos** e o **mesmo prompt** para o modelo de fallback,
espelhando o que `tryImageRetry` teria feito se a linha 146 cobrisse moderação
(guardas: aborta se `status`, `retry_count`, `kie_model` ou `credits_cost`
tivessem mudado desde a medição; claim atômico conferido pelo `.select()`).

> Se as fotos ou o prompt violassem política de conteúdo, **o Seedream também
> teria recusado. Não recusou.** Isso encerra a dúvida: era falso positivo.

Desfecho conferido no banco e no R2, não presumido:

| o quê | antes | depois |
|---|---|---|
| `image_generations e568b3cd` | `failed`, retry 0 | **`ready`**, retry 1, `seedream/5-pro`, `image_path` gravado |
| `sgp_pedidos fe00d4e2` | `falhou` | **`pronto`**, `foto_pronta_em` 12:51:36Z |
| `profiles.onboarding_ready_email_at` | nulo | **12:51:36Z** |

**Baixei e OLHEI a imagem entregue** antes de chamar de entrega: é o Rafael
mesmo — mesmo rosto, óculos, barba, jaleco, fundo neutro. **Não houve
degradação silenciosa do fallback.**

**O aluno foi avisado** — conferido na pasta de **Enviados** do `suporte@`, não
no código: **uid 1962** ("Seu clone de foto ficou pronto") e **uid 1961** ("Seus
arquivos estão prontos — falta só o acesso"). **19,2h de silêncio encerradas.**
A cadeia se recuperou sozinha a partir da imagem
(`webhooks/kie/route.ts:65` → `avancarEtapasDoUsuario`).

**Não escrevi e-mail pessoal a ele, de propósito:** a falha foi **silenciosa**
(ele nunca foi informado de problema nenhum e nunca escreveu ao suporte), o
produto está entregue e os e-mails automáticos já dizem a verdade e o que fazer.
Mandar agora um "tivemos uma falha" criaria dúvida sem dar a ele nada para
fazer. **Registro a decisão para poder ser revertida** — se o Johnny preferir,
eu escrevo.

### Defeito menor achado **dentro do próprio PR #246**

O carimbo de `erro` em `etapas.ts` só escreve quando `erro` está nulo e **nunca
limpa**. O pedido voltou para `pronto` **carregando** *"não foi possível gerar o
seu clone a partir das fotos enviadas"* — pedido pronto exibindo um erro que
**culpa as fotos do aluno**. **Limpei à mão** (`update ... where status='pronto'
and erro is not null returning` → **1 linha**, `erro=null` conferido). A
recuperação não tem caminho para zerar o carimbo; quem pegar o cartão do
`etapas.ts` resolve junto.

### Ressalva honesta (não virou cartão)

O e-mail uid 1962 diz *"Agora estamos treinando a sua VOZ — leva cerca de 30
minutos"*, mas a voz dele está pronta desde 11/09 17:43 (uid 1867). O template
assume a ordem foto→voz. Não trava nada e o uid 1961, no mesmo minuto, já diz a
verdade. **Registro para não virar "achado novo" numa próxima ronda.**

---

## 3. ⚠️ A armadilha que eu NÃO caí (e que quase estava pronta)

O PR #246 carimbou no pedido: *"não foi possível gerar o seu clone **a partir
das fotos enviadas**"*. **As fotos dele estão perfeitas.** Mandar esse texto —
ou pedir *"manda outras fotos"* — jogaria o Rafael a falhar de novo **achando
que a culpa é dele**, com fotos que já eram ideais. É exatamente a armadilha
documentada no `curar_msg_envio_incompleto.cjs` (`#72`). **Não repetir.**

---

## 4. Por que o `#364` continua `investigating` e não virou `fixed`

A **instância** está curada e o aluno entregue. A **classe** não: o conserto de
código **não existe em produção**. Fechar agora seria marcar `fixed` sem ter
resolvido (**regra 14**). Dois cartões abertos, ambos `running` com o `coder`:

| cartão | o quê |
|---|---|
| `42f21224` | retry cruzado passar a cobrir recusa por **moderação** no titular (com teste: titular→fallback retenta; já-no-fallback não retenta; não-transiente/não-moderação não regride) |
| `d5fbf171` | a perna do **fracasso** do SGP avisar aluno + grupo (`escalarNoGrupo` já existe em `avisos.ts:251`), com **cadeado** pra não mandar e-mail a cada F5 |

A objeção do Vigia (perna do aviso sem dono) segue de pé — **agora com cartão e
dono**.

---

## 5. Fim de ronda

- `#364`: 3 → **5 notas**, conferido na releitura (1 linha afetada nas duas
  gravações).
- Não fechei nem reabri nada; não toquei em crédito; não mexi na planilha.
- GPU gasta: **uma** geração de imagem na conta da casa (≈ centavos), para
  entregar um produto de R$ 597 que a nossa falha tinha matado — compensação por
  erro nosso, no precedente do `refazer_audio_conta_da_casa.cjs`.
- Aviso do grupo enviado. Log commitado **na `main`**.
