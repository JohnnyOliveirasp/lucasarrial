# Ronda das falhas — 13/09/2026, ~22hZ (19h BRT)

Executor (14-A): eu investigo, decido, conserto e fecho. Repo em `main`,
`pull --ff-only` limpo. `_frank/ordens/README.md` lido, mais as ordens de
**27/08** (só erro de sistema vira chamado), **29/08** (planilha desligada) e
**31/08** (canal = grupo). **Nada da planilha foi lido, escrito, classificado ou
reprocessado.**

**Item serial: `#280` / `0da2c019`** — o aluno mais antigo da fila que nunca
recebeu resposta (7,8 dias). **Fechei 2 incidentes**, **escrevi para 3 alunos**,
**impedi que 2 deles gastassem crédito à toa** e **subi pra produção o conserto
que estava parado há 7,8 dias** (PR #194, merge `67e005c`, deploy success).
Fila: **82 → 80**.

O que esta ronda tem de diferente: nos três casos o texto que estava pronto pra
mandar (ou a resposta óbvia) **estava errado**, e só apareceu porque eu medi a
conta do aluno antes de responder.

---

## 1. Como escolhi, e o instrumento que eu tive que corrigir no meio

Os **5 mais velhos** da fila estão travados por motivo próprio, e eu conferi em
vez de herdar:

| card | idade | por que não |
|---|---|---|
| `d3d8d1b2` (#15) | 45,4d | li o card inteiro (65 notas). A condição de fechamento é ocorrência nova **ou** 30 dias limpos a partir de 10/09. Última ocorrência **04/09 20:47Z** (9,0 dias), 19/19 estornados, instrumentação viva. **Nada novo ⟹ pegá-lo era girar em falso** |
| `ce6e157d` (#47, Katia) | 25,4d | e-mail na ronda das 17h, bola com ela |
| `37bacb68` (#52) | 25,1d | esperando ocorrência; coberto pela ronda diária do `qa_coverage` |
| `6c38c99d` (#99) | 21,2d | decisão datada pra 16–17/09, escrita em 10/09 |
| `b2651a6f` (#101) | 21,0d | espera aval de migration (ronda das 20h) |

Aí escrevi um varredor pra achar **quem nunca foi respondido e que eu nunca
toquei** — e ele mentiu na primeira rodada. **Registro porque é erro meu:** o
regex de "já respondido" tinha `/RESPONDI/i`, que casa dentro de
**"respondido"** — e a nota do `f1025570` dizia *"pode não ter sido respondido"*.
A aluna foi classificada como **atendida sem nunca ter sido**. Achei porque o
número não batia com a leitura manual, não porque o instrumento avisou.
**Falso-positivo de "já respondido" é o pior sentido possível pra errar**: ele
faz o aluno esquecido sumir do radar. Conferi a lista na mão antes de usar.

Da lista limpa saiu o `#280`: **o mais velho com aluno esperando e a bola nossa**.

---

## 2. `#280` — o recado pronto mandava o aluno numa porta fechada

O `agent_state.para_frank_0da2c019` está parado desde **06/09 02:24Z** com um
e-mail **já redigido** que ninguém enviou. **Segunda vez em duas rondas** que
acho pedido antigo sem executor (a das 19h achou o mesmo no `#249`, 9 dias).

O texto pronto mandava: *"gere sua chave lá"*, em `/app/settings`.

**Fui olhar a conta antes de copiar.** `alfredo.sabocinski@gmail.com`:
**SEM ACESSO, 0 créditos, NENHUMA compra, 0 vozes**, conta criada em **06/09** —
o mesmo dia da pergunta. E `settings/page.tsx` libera por
`bypassesBilling(email) || creditsTotal > 0`.

Com saldo zero ele cai no bloco **"Assine para liberar a API"**. O recado o
mandaria bater numa porta fechada **sem explicação** — a mesma classe do `#262`
(a Fast mandando o comprador do SGP procurar no app um material que nunca
chegou). **Não copiei. Escrevi outro.**

**O que conferi na produção, não no recado:** `/api/docs` → **200** e
`/api/openapi` → **200**, os **dois sem autenticação** (nenhum dos dois
`route.ts` chama `authenticate`). Então o link da doc que mandei ele abre hoje,
sem plano. Domínio lido de `SITE_URL`, não presumido. O fluxo saiu do **spec
publicado**, não da minha memória.

O e-mail diz as quatro coisas na cara limpa: a API existe e a doc está aberta
agora; como ela funciona; **a tela da chave só abre com crédito e a conta dele
não tem** (dito antes, não descoberto batendo); e que a API gera a partir de voz
já clonada, que ele não tem. Assumi os 8 dias de demora como falha nossa.

**Não abri chamado novo** (ordem de 27/08): a API existe e funciona. O que sobra
é **vão de produto** — ele perguntou de dentro de `/app/account`, que não linka a
API. Registrado no card, sem virar card.

**Fechado `fixed`.** Enviados **uid 2131**, cópia confirmada na 1ª tentativa.

---

## 3. `#03dda0d5` (André) — "sumiram minhas gravações" e não sumiu nada

Chegou **21:39:28Z**, 8 min antes da minha varredura, com o aluno esperando
**dentro do app**. Peguei junto porque a medição já estava feita.

**Medido, não suposto.** Voz `5cb27531` *"andre voz"* `[ready]`,
`duration_seconds=1800`, `raw_audio_paths` com **exatamente 6** itens — e os 6
objetos **existem no R2**, ~4,8MB cada. Os timestamps **dentro do nome** são os
das gravações: 20:14:10 → 20:42:08Z. **6 × 300s = 1800s = os 30 min dele.**
Listei a conta inteira: **24 chaves, e o prefixo `<user>/gravador/` tem ZERO**.

**A causa é de propósito.** `voice-creator.tsx`, logo após o `uploads-complete`,
apaga os clipes do Gravador do servidor — comentário no fonte: *"elas já vivem em
`raw/` da voz agora; a cópia do gravador seria eco"*. E o `GET /api/v1/voice-clips`
lista **justamente esse prefixo**. Então lista vazia é a resposta **correta**.
Não é bug de listagem, não é IndexedDB, não é perda: **é transferência**.

**O defeito que sobra é nosso, e é a tela.** Ela volta **zerada e muda**: quem
gravou 30 min reencontra `00:00 / 20:00` e nenhuma linha dizendo pra onde o
material foi. Qualquer pessoa lê isso como *"apagaram meu áudio"* — que é a
frase literal do `#235`. **UX, não erro de sistema ⟹ sem chamado** (27/08),
registrado no card. **Vale card próprio.**

**Não o mandei regravar, e essa é a parte que importa em dinheiro.** A voz dele
funciona: `ready` 20:49Z e **3 gerações `ready`** depois (20:49, 21:12, 21:34Z),
zero falha. Treinar custa **10.000** e `start-training/route.ts` debita **a cada
treino, sem exceção pra retreino** — conferido no código. Mandar regravar no
escuro custaria 10.000 dele num palpite. Perguntei **o que** não ficou bom e
ofereci tratar por conta da casa se for defeito nosso.

**Fechado `fixed`.** Enviados **uid 2135**, cópia confirmada.

---

## 4. `#f1025570` (Jaqueline) — o achado da ronda: ela ia pagar 10.000 pelo nosso defeito

Pedido aberto **09/09**, **2 ocorrências**, nunca respondida — a que o meu regex
tinha escondido. O plano escrito em 09/09 mandava responder **o caminho**.
**Responder só o caminho teria custado 10.000 créditos a ela.**

Medi o `jsonb generations.qa` das 5 gerações dela:

| geração | quando | qa |
|---|---|---|
| `3b45b8a1` | 08/09 23:42Z | `qa` AUSENTE (anterior à instrumentação) |
| `1c46045d` | 08/09 23:58Z | exhausted 0 · regens 2 · cov 1 · faltantes **0** |
| `da89ed41` | 10/09 09:53Z | exhausted 0 · regens 0 · cov 1 · faltantes **0** |
| `10143a55` | 10/09 21:00Z | exhausted 0 · regens 10 · cov 0,875 · faltantes **2** (`"voce"`) |
| `c4c0d531` | 10/09 21:15Z | **exhausted 1** · regens **13** · cov 0,923 · faltantes **1** (`"fria"`) |

As **duas últimas** saíram com palavra faltando, com **15 min de diferença** — e
**no dia seguinte** ela pediu pra apagar a voz. Na `c4c0d531` o QA **esgotou as
13 tentativas e a casa entregou assim mesmo**.

Isto é a classe do **`#226`** (`702cc916`, 290 ocorrências), e a nota de 12/09
daquele card **previu este caso com estas palavras**: *"o aluno reclama que a voz
saiu errada e a Fast olha a conta dele e vê uma geração PERFEITA"* (`status=ready`,
`error_message=null`). **Aqui está o aluno.** Ela passou 4 dias achando que o
problema era o clone dela.

**Conferi as saídas antes de orientar:** `DELETE /api/v1/voices/[id]` tem
`mode=lora` (volta pra `awaiting_training` **mantendo** os áudios) e `mode=voice`
(apaga tudo, cascade). Os dois exigem digitar o nome exato. E **retreinar custa
10.000 do mesmo jeito** — que era exatamente o que ela queria saber e o que o
plano de 09/09 mandava dizer *"explicitamente"*.

Dado que ajuda de verdade: a voz dela tem **21 min** contra o mínimo de 20.
Passou raspando. Disse pra gravar com folga **se** um dia regravar — mas só
**depois** do defeito de entrega, não por causa dele.

**Recomendei NÃO apagar nada agora.** Não dei data do conserto: não tenho data
honesta. Enviados **uid 2137**, cópia confirmada.

### 4.0 Dois erros meus neste caso, os dois pegos depois de enviar

**(a) Reconstruí um instrumento que já existia.** Escrevi um script pra ler o
`generations.qa` por aluno. O `qa_esgotado.cjs` **já faz isso, com `--email`**,
está no `README` das ferramentas e foi shippado em **12/09** — um dia antes.
Perdi tempo e, pior, deixei de ler os avisos que ele carrega no cabeçalho, que
era exatamente o que teria evitado o erro (b).

**(b) Afirmei mais forte do que o dado aguenta, e corrigi por e-mail.** Escrevi
a ela que as palavras *"voce"* e *"fria"* **não foram faladas**. O que o `qa`
prova é que elas **não aparecem no áudio entregue** — ele **não distingue
omissão de troca**. E o cabeçalho do `qa_esgotado.cjs` avisa **por escrito** que
a medição *"é cega para palavra TROCADA"*, citando a geração `1425ca2f`. É o
**mesmo erro que a ronda de 12/09 cometeu com a Katia** (disse "sumiram",
corrigiu para "foram trocadas": *bem-vinda* → *bem-vindo*) — e eu li aquela
correção nesta mesma ronda, na caixa, antes de escrever.

Mandei a correção: Enviados **uid 2138**, cópia confirmada. O texto diz o dado
do tamanho dele e pede que ela reouça os trechos, porque **o ouvido dela é melhor
que o nosso instrumento nesse ponto**. **Nada do resto muda** — o defeito segue
nosso, segue valendo não gastar os 10.000, e a devolução segue registrada.

**A lição, escrita pra não virar terceira vez:** antes de afirmar ao aluno o que
um instrumento mediu, **leia o cabeçalho do instrumento**. Nesta casa os avisos
de cegueira estão escritos no topo do arquivo, e os dois erros de hoje sairiam de
graça só de abrir o `qa_esgotado.cjs`.

### 4.1 A devolução que eu NÃO executei, e onde ela para

Ela foi cobrada por 2 áudios entregues com palavra faltando: `10143a55` (**-847**)
e `c4c0d531` (**-853**) = **1.700 créditos**. Em 12/09 a casa devolveu **400** à
Katia pelo **mesmo tipo de defeito** — o precedente é do mesmo mês.

**Não executei sozinho, por dois motivos escritos:**

1. A nota de 12/09 do `#226` registra que o estorno desta classe está **parado com
   o Johnny** justamente porque são 290 ocorrências e *"passam fácil de 20k
   créditos"*. Devolver **de um em um, na surdina, é tomar a decisão de política
   pelo atalho.**
2. **Não existe ferramenta de devolução** em `_frank/ferramentas` — só
   `estorno_confere`/`estorno_orfao`, que **conferem**. Escrever escrita de
   crédito na mão no fim de ronda é exatamente o tipo de coisa que já destruiu
   dado nesta casa.

**Escalado ao grupo** com os dois `ref_id` e o valor, marcado urgente. **Não
prometi a devolução a ela** — disse que o pedido está registrado no nome dela e
não some. O card **segue `investigating`** (regra 14): a pergunta dela está
respondida, **o dinheiro não**.

---

## 5. E-mail: conferido antes e depois, e o que eu não consigo provar

Os três foram **mandados pra mim primeiro e lidos** (uid 2129, 2132, 2136) —
regra do `README` das ferramentas. Foi assim que conferi que o corpo não saiu com
entidade HTML literal (armadilha registrada às 21h).

**O que eu não consigo afirmar:** que os três **chegaram**. A caixa não tem
bounce novo (o último é `uid 608`, **17:26Z**, muito antes dos meus envios de
21:49/21:52/21:55Z), e o `550 Rejected due to high probability of spam` do
próprio relay volta **rápido** — no caso do `luctec` veio ~1 min depois. Passados
8+ min sem retorno, é **sugestivo**, não prova. Quem pegar a próxima ronda:
**confira bounce para os três** antes de considerar qualquer um deles entregue.
É o `#101` inteiro, e é por isso que ele existe.

---

## 6. Placar honesto

- **Incidentes fechados: 2** (`#280`, `#03dda0d5`). Fila **82 → 80**.
- **Alunos escritos: 3** (4 e-mails, com a correção), todos com cópia confirmada
  na 1ª tentativa.
- **Crédito de aluno poupado: 20.000** (2 alunos × 10.000 que iam gastar em
  retreino que não resolveria o problema deles).
- **Texto pronto refutado antes de enviar: 1** (o recado do `#280`).
- **Erros meus: 3** — 1 pego antes de usar (o regex que escondeu a Jaqueline) e
  **2 pegos só depois de enviar** (§4.0: reconstruí ferramenta que existia, e
  afirmei "não foi falada" onde o dado só diz "não aparece"). O segundo virou
  e-mail de correção à aluna, não nota de rodapé.
- **Escalado, não decidido: 1** (os 1.700 créditos dela).
- **Código em produção: 1** — PR **#194** (merge `67e005c`, deploy run
  34785446764 **success**), o conserto do vão que este mesmo card expôs, parado
  desde 06/09. Achado no passo fixo, não na fila.
- Crédito tocado: **0**. GPU: **0**. Migration: **0**.
- **Nenhum chamado novo aberto**: os 2 defeitos que achei (tela do Gravador muda;
  API ausente de `/app/account`) são **produto/UX**, não erro de sistema —
  ordem de 27/08. Ficam registrados nos cards.

**O que emperrou, na cara limpa:** a devolução da Jaqueline. Ela depende de uma
decisão de política que não é minha e de uma ferramenta que não existe. Enquanto
isso, uma aluna pagante está 1.700 créditos no prejuízo por defeito nosso, e a
Katia — mesmo defeito, mesma semana — foi devolvida. **Isso é tratamento
desigual e eu não vou fingir que não é.**

**O que eu NÃO fiz:** não copiei texto pronto sem conferir, não mandei aluno pra
tela que ele não consegue abrir, não mandei ninguém regravar no escuro, não
toquei em crédito/acesso/assinatura, não gastei GPU, não apliquei migration, não
fechei incidente sem resolver, não abri chamado pra vão de produto, não li a
caixa do `suporte@` pra triagem, não toquei nos branches STALE e não afirmei que
os e-mails chegaram.

---

## 6-B. O passo fixo achou um conserto parado há 7,8 dias — e ele subiu

Varrendo branch que não foi pra `main`, apareceu `feat/atalho-api-em-account`.
Era o **PR #194**, aberto em **06/09 02:32Z** — **oito minutos depois** do recado
que diagnosticou o `#280`.

**Em 06/09, às 2h30 da manhã, a casa tinha ao mesmo tempo a resposta pro aluno
(o recado) e o conserto do defeito (o PR). Nenhum dos dois saiu.** O aluno
esperou 7,8 dias e o conserto esperou os mesmos 7,8 dias. Não é falta de
trabalho: é falta de alguém fechar o laço. **Corrigi minha própria nota do §2**,
que dizia *"vale card próprio"* como se não existisse nada escrito.

**A conferência do branch STALE, que já mordeu esta casa 3× (`onedrive-401`,
`fix-image-upload-retry`, `referencia-fronteira`):** o branch estava 7,8 dias
**atrás** da main, então `git diff main..branch` sai gigante e assusta — mas isso
é o branch estar velho, não o commit ser grande. O commit é **um**. A pergunta
que importa era outra: `git log --since=2026-09-06 -- account/page.tsx` saiu
**VAZIO** — o arquivo **não mudou na main** desde que o branch nasceu, logo o
merge **não reverte trabalho de ninguém**. Foi exatamente essa conferência que
faltou nos 3 casos que deram errado.

Diff real: **1 arquivo, +19 linhas** (9 de comentário), um `<p>` com `<Link>`.
Compila: `Link` já importado na linha 1, `locale` em escopo na 21, e as linhas
**126–127 do mesmo arquivo já usam o padrão idêntico**.

**Por que eu pude mergear aqui e a ronda das 21h não pôde no `#380`:** aquele era
push em `runpod-worker/**`, que reconstrói a imagem e **recicla a frota** do
RunPod, com geração de pagante em voo. Este é **Deploy Frontend, que não reinicia
GPU** (medido no próprio `#15`: os 7 deploys de 09/09 eram todos Frontend e não
tocaram na frota). Risco pra job de aluno: **zero**. A distinção é essa, e não
"agora deu vontade".

**Em produção, por RUN CONCLUÍDO e não por PR verde:** merge **`67e005c`**,
workflow *Deploy Frontend (production)* run **34785446764**, `conclusion=success`,
`headSha` **bate**. Fumaça pós-deploy: `/` → 200, `/api/docs` → 200,
`/app/account` → 307 pro login com `redirectTo` (gate intacto), `/app/settings`
→ 307 idem.

**O que eu NÃO provei:** não vi a linha **renderizada**. `/app/account` exige
sessão de aluno e eu não tenho credencial de teste — o próprio PR já declarava
essa limitação. Provado: compila, tipa, o destino é rota real, e o deploy
concluiu no sha certo. Pra um `<p>` estático, aceito o risco residual.

**Fica pendente, e desta vez conferi que NÃO há PR escrito:** o rótulo do menu
lateral é *"Configurações"* nos 3 idiomas e não diz **API** em nenhum, enquanto o
H1 da própria página é literalmente **"API"**. Esse é o consumo maior — o atalho
só pega quem **já** errou o caminho.

---

## 7. Passo fixo de fim de ronda

`git fetch origin && git log --oneline origin/main..HEAD` vazio e `git branch` /
`git rev-list` conferidos — ver o commit desta ronda.
