# Ronda das falhas — 10/09/2026, ~17h30–18h20Z (14h30–15h20 BRT)

Dono da fila (14-A). Backlog **serial**. Repo em `main`, `pull --ff-only` antes
de tocar em nada. Índice de ordens lido primeiro.

Ordem de **29/08** respeitada: nada da planilha lido, escrito, classificado,
avisado ou reprocessado; nenhum chamado de causa-planilha aberto ou reaberto.
Ordem de canal de **31/08**: o aviso desta ronda foi **no grupo**.

**Item serial:** `#47` (`ce6e157d`, Katia) — **não fechei**, e o §5 diz por quê.
**Aluna avisada: uid 1641, cópia CONFIRMADA.**

---

## 0. Por que este cartão, e não o mais antigo

A regra manda o mais antigo **com aluno afetado**. O mais antigo é o `#15`
(30/07). Conferi eu mesmo em vez de herdar o veredito: ele está bloqueado por
condição de fechamento escrita na própria última nota — fecha com (a) a próxima
falha de `executionTimeout` sob a régua nova (PR #229, em produção desde 10/09
00:51Z) ou (b) 30 dias limpos a partir de 10/09. Não há ocorrência nova desde
04/09. Não há o que fazer nele hoje, e forçar trabalho ali seria teatro.

O `#47` é o seguinte na fila por idade (19/08) e tinha **aluna pagante esperando
com duas promessas escritas da casa em aberto**. Aluno esperando vem antes da
limpeza da fila.

---

## 1. O achado principal: a "decisão pendente" não existia

A Fast escreveu para a Katia em **08/09** (uid 1336) e em **09/09** (uid 1437)
dizendo que a extensão do acesso dela *"foi levada a quem decide, marcada como
urgente"* e *"já está em andamento"*. A nota de 09/09 do cartão registrou o
mesmo: escalado, pendente.

**Não havia nada a decidir.** A ordem `2026-08-20_REGRA_FINAL_CREDITO.md` —
palavras do Johnny, auditadas (`update_id` 231582805 e 231582818) — já responde:

> "Aluno pagou, tem créditos. Parou de pagar, não terá mais créditos novos e
> usa os que tem até acabar." + "Frank, mantém o acesso, e acabou."

E a mesma ordem instrui, textualmente: *"aplique a regra acima e feche. Não
escale, não peça confirmação."* **A escalação de 08/09 foi ela mesma uma
violação da ordem vigente**, e o preço foi 48h+ de uma aluna pagante achando que
perderia 176.420 créditos, mais duas promessas da casa sem lastro.

Registro isso sem suavizar porque o erro é nosso e é de processo, não da aluna.

## 2. Não acreditei na ordem sozinha — conferi, porque ia prometer dinheiro

Antes de escrever "você não perde nada", fui atrás do que **de fato** trava:

| o que conferi | resultado |
|---|---|
| gate da geração | **saldo**, não data — `voices/[id]/generate/route.ts:145-167`, `images/generate/route.ts:155-175`, `videos/[id]/videos/route.ts:155-163`, `start-training/route.ts:100-119`. O `hasActiveAccess()` ali só escolhe o **texto do CTA**. |
| gate das telas | por crédito, como a ordem de 18/08 mandou — `roteiro/page.tsx:57` (`creditsTotal >= ROTEIRO_COST`), `videos/edicao/page.tsx:44` (`creditsTotal > 0`). |
| quem zera `credits_subscription` | `grep` por update/set/zero no `lib/` e `app/api/`: **vazio**. Só a RPC de trial. |
| a RPC de trial alcança ela? | **Não, por dois caminhos independentes** (`85_trial_expiry_v2.sql:110+`): o CTE `trials` exige valor 0 **e** `recurrence_number = 1`; e mesmo se entrasse, o CTE `paid` casa e o loop faz `outcome='paid'; continue`. |
| ela pagou mesmo? | `pagou_de_verdade.cjs`: **sim** — assinatura rec#2 **15 GBP COMPLETE** (22/08) + 2 avulsas pagas (45,90 e 270 GBP). |

**A prova que vale mais que a leitura de código:** a conta nasceu em 14/08, a
carência de trial é 10 dias, o sweep roda de 5 em 5 minutos — e **17 dias depois**
do vencimento dessa carência ela ainda tem `credits_subscription = 174.665`. O
varredor demonstravelmente não a mira. Isso é observação, não inferência.

⚠️ **Armadilha anotada:** a moeda desta conta é **GBP**, não BRL. Quem for somar
valor aqui não pode converter no automático.

## 3. O que eu disse a ela (uid 1641)

Sem maquiagem, nesta ordem: (i) não perde nada no 15/09, com o número exato do
saldo, e que a "decisão em andamento" que prometemos duas vezes **não existia** —
desculpa explícita; (ii) a ressalva honesta de que a tela pode passar a exibir
CTA de "assine" depois do dia 15, que isso é só texto olhando a data, e que me
avise se alguma tela barrar de verdade; (iii) o resultado cru das 3 réguas no
áudio de ontem (`b6df1a7e`): última palavra **presente**, sem corte de player,
sem corte de emenda; (iv) que a entonação/fim-de-frase segue **sem causa achada
e sem data**, com essas palavras; (v) que não precisa regravar os 50 min nem
correr contra o dia 15; (vi) que ela não deve mais nenhum teste para nós.

## 4. O que sobra, e é decisão de ouvido humano

Repor `tts_silence_ms = 466` **na voz dela**. Ajustado à mão em 21/08 e
**aprovado por ouvido** em A/B contra 220; zerado em 24/08 junto com outras 92
vozes pela reversão global do caso Kessuly.

**Por que a reversão pode não valer para ela:** o comentário que documenta a
reversão (`voices/finalize-training.ts:397-404`) nomeia a causa do estrago como
*"crossfade 0 e 1,5-1,9s de silêncio inserido"* — borda suja de pedaço exposta no
ar. O valor dela é **466ms, cerca de 1/4 disso**, e passou por ouvido humano
**antes** do zeramento. A reversão mirava o caminho **automático** de escrita no
treino mais o zeramento em bloco; não consta conferência caso a caso.

**Eu não decido isso**: é julgamento de qualidade sonora, e eu meço áudio mas não
o escuto. Custo zero de GPU e de crédito, reversível num `UPDATE`. **Não prometi
à aluna** — mencionei apenas que existe um caminho aberto, sem prazo, justamente
para não criar a 3ª promessa sem lastro neste cartão. Levado ao grupo.

## 5. Por que NÃO fechei (regra 14)

A queixa de **entonação / "final de frase estranho" continua sem causa medida**.
As três réguas dizem o que o áudio **não** tem; nenhuma explica o que ela ouve.
Fechar agora seria trocar "descartei os suspeitos conhecidos" por "resolvido" —
exatamente o erro que este cartão já cometeu antes.

## 6. Achado lateral: a Katia não é caso único (medido)

Saiu do próprio item serial, então medi o alcance antes de largar. **Não
trabalhei** — anotado no `#303` (`a0bc1f7e`, mesma raiz: `account.ts` monta o
contexto do agente só com a data) em vez de abrir cartão duplicado.

- 673 perfis com `access_until` vencendo nos próximos 30 dias; 671 com saldo.
- **74** com entitlement `canceled` (a classe exata dela) = **10.941.013 cr**.
- Separando por **pagamento real** (`payment_events` hotmart APPROVED/COMPLETE
  com `price.value > 0`): **53 pagaram** = **9.138.139 cr** que **não se perdem**.
- Os outros **21** (1.802.874 cr) **não têm** pagamento > 0 no nosso banco.
  **Não afirmo nada sobre eles**: pode ser trial, mas pode ser e-mail divergente
  (a classe do `#222`, que voltou 7 vezes). Caso a caso, não em bloco.
- Urgência: 5 dos que pagaram vencem até 12/09 — dois **amanhã (11/09)** com
  ~200 mil créditos cada.

O sistema **já se comporta certo**; quem está errado é a **mensagem** que a casa
dá. Não escrevi para os outros 73: e-mail em massa depende do "pode" do Johnny
(REGRA 8). Perguntado no grupo.

## 7. Fim de ronda

- Log commitado **na main** (nunca em branch de feature).
- `git log --oneline origin/main..HEAD` conferido **vazio** depois do push.
- **Nenhum commit de código.** Esta ronda não produziu código: o trabalho foi
  medição, uma correção de informação ao aluno e duas anotações de cartão. Não
  há PR para citar e eu não inventei um.
- Nenhuma migration, nenhum DDL, nenhuma GPU, nenhum crédito movido, nenhum
  acesso alterado. Custo desta ronda: zero.
- Grupo avisado (regra 7): e-mail à aluna (fato consumado) + as duas decisões
  que dependem de gente.
- **Árvore suja que continua não sendo minha:** o trabalho do SGP solto
  (`sessao.ts`, `page.tsx`, rotas `sgp/*`, os 3 `messages/*.json`, mais arquivos
  novos fora de branch) segue lá, apontado desde a ronda das 16h. Não commitei:
  não é meu, não passou por PR e eu não testei. Terceira ronda seguida
  registrando isso — se ninguém assumir, vira cartão.
