# Rotina das falhas — 03/09/2026, ~01h40–02hZ

Ordens lidas antes de tocar em qualquer coisa: índice `ordens/README.md`, canal de 31/08 (tudo do
FastCloner vai no **grupo**), `2026-08-29_desligar_vigia_e_frank.md` (planilha desativada) e
`2026-08-20_dono_da_fila_e_fila_zerada.md`. Método serial (regra 8, 21/08).

## Placar

| | entrada | saída |
|---|---|---|
| abertos (`open`+`investigating`) | **5** | **5** |
| aguardando aluno | 10 | 10 |

Placar parado, e desta vez com um fato novo dentro: **o aluno do caso serial foi escrito** e o
chamado dele parou de carregar carimbo de resolvido. Não fechei nada porque o que trava o `#202`
é decisão comercial do Johnny, e fechar sem ela seria o fechamento falso que esta mesma ronda
está desfazendo.

Entrou **1 chamado novo** desde a ronda anterior: `#237` (`92b1cc85`, "não conta nada na
plataforma", 20:38Z) — não peguei, motivo no §3.

---

## §0 — Antes da fila: quem estava esperando

Varredura rodada primeiro (prioridade: aluno antes de limpeza de fila). **2 itens presos**, os
mesmos da ronda anterior, nenhum novo:

- **`marcelopersonalthe32@gmail.com`** — decidido na ronda das 01h e **não reabri**: já foi
  avisado 3× (uid 58, 182, 341), o último e-mail cobre o caso inteiro e a bola é dele. Um quarto
  e-mail em 4 dias é ruído.
- **`luanmarcal.com@gmail.com`** — import quebrado do onboarding antigo. **Planilha: a ordem de
  29/08 me proíbe de ler, classificar, avisar ou reprocessar.** Registro e não toco. **4ª ronda
  seguida.**

Nenhum outro aluno travado: `generations` presas +2h = 0, `voices` em `training` +2h = 0, lista de
estorno em dia (10 tipos, 2.690 linhas, nenhum tipo desconhecido).

---

## §1 — O serial: `#202` (Vinícius Lorandi), e um compromisso que vencia hoje

Pelo método serial o `#202` é o mais antigo com aluno esperando que está na minha mão: aberto
**30/08 23:45Z**, `open`, 3 dias. (O `#47` é mais antigo mas está com a aluna; o `#226` está em
decisão do Johnny pela 5ª ronda; o `#234` é o defeito técnico irmão do `#47`.)

### O compromisso vencia HOJE, e foi cumprido

A nota de 01/09 deixou escrito, para a ronda seguinte herdar: *"se a decisão comercial não vier
até **03/09**, a ronda que pegar este incidente escreve ao Vinícius dizendo o estado real, mesmo
sem resposta do Johnny."*

Hoje é 03/09. Conferi: a decisão **não veio**, e ele **não respondeu** (INBOX: zero mensagens
dele; nosso último contato foi 31/08 17:47Z, há ~32h).

**E-mail enviado 03/09 01h47Z** — cópia **confirmada** em Enviados **uid 478**, **nenhum bounce**
(e o bounce do `#201` volta em ~2s, então ausência aqui é sinal, não torcida). Individual, sobre
caso que estou tratando: **regra 8, decidi sozinho**. Sem `--bcc`, precedente do `#201`.

O que o e-mail diz: as 3 transações repetidas com valor e código; não houve cobrança dobrada; ele
**não precisa mandar nada** (reforcei a dispensa do comprovante/CPF); a pergunta comercial segue
com a direção e **ainda não foi decidida**. **Recusei inventar prazo** — prometi *comportamento*
("continuo te escrevendo até ter desfecho"), não data. Ele já recebeu uma informação errada minha;
um prazo que eu não controlo seria a segunda. **Não prometi crédito, não prometi acesso, não
liberei nada.**

### A nota das 01h07Z voltou a afirmar o erro original — medi antes de dizer isso

Ela afirma *"`vlorandi@gmail.com` segue SEM ACESSO, 0 créditos e **NENHUMA compra**"* e conclui
*"só a busca na Hotmart por CPF/nome/cartão confirma"*. Medição minha agora:

| instrumento | o que devolve |
|---|---|
| `aluno.cjs` (nosso banco) | "compras: NENHUMA", SEM ACESSO, 0 créditos |
| `pagou_de_verdade.cjs` (Hotmart viva) | **PAGOU** — 3 avulsas APPROVED, **R$ 2.697,60** |

HP3517088140 (R$ 297, 29/08), HP2540995505 (R$ 597, 29/08), HP0167002846 (R$ 1.803,60, 30/08) —
**no próprio e-mail dele**. O script inclusive imprime sozinho: *"Esta pessoa PAGOU, mas não pela
assinatura do FastCloner (…) **Não trate como 'nunca pagou' (#173)**."*

**As duas frases são verdadeiras em instrumentos diferentes e foram somadas como se fossem uma.**
Ele não tem compra **do FastCloner** — por isso o `aluno.cjs` diz NENHUMA. Ler esse campo como
verdade de pagamento é **a cegueira do `#173` reencenada por outro instrumento**. Não é
desatenção: é o mesmo formato de erro, e por isso merece conserto de processo e não bronca.

**O perigo não é acadêmico.** "Só a busca por CPF/nome/cartão confirma" manda a próxima ronda
pedir o CPF ao Vinícius — prova da qual ele já foi dispensado **por escrito** em 31/08, depois de
termos pedido a ele uma vez e ao Johnathan **duas**. Seria a **quarta** vez que a casa pede a um
pagante que prove uma compra que está na nossa mão.

### O carimbo órfão, limpo

O `#202` estava `open` carregando `resolution_note = "enviado email"` e
`resolved_commit = 5b8afad` — commit de **outro subsistema** (o manual da Fast, PR #141). É a
classe do `#232`. Limpo agora pela guarda dos três campos do `anotar_incidente.cjs`
(`resolved_at`/`resolved_by`/`resolved_commit` saem juntos), com a `resolution_note` marcada
**SEM VALOR** e o motivo escrito. **1 linha afetada, conferida na releitura pelo banco**, nas duas
gravações (notas 8 → 9).

---

## §2 — O erro chegou ao Johnny no relatório, e isso é o que mais importa

`_frank/prova/2026-09-03_relatorio_noturno.md` carrega as duas afirmações:

- linha 66: *"NENHUMA compra, nenhum entitlement com esse `buyer_email`"*
- linhas 132-133: *"Não procurei Zica Santos nem Vinícius Lorandi na Hotmart: **não tenho acesso à
  conta**. Só o Johnny ou o Lucas confirmam pagamento lá."*

A segunda é falsa desde o **PR #138** (`c5955f7`, em produção **31/08 19:39Z**): o
`pagou_de_verdade.cjs` lê `/sales/history?buyer_email=`. Rodei nesta ronda, **nos dois nomes**.

**Zica Santos não precisava de busca nenhuma** — o `#214` já estava apurado desde 31/08 **nas
notas do próprio chamado**: assinatura paga e ativa em **`zicasantos08@hotmail.com`** (entitlement
até 19/09, +100.000 créditos, uso real em 01/09); ela entra na conta gratuita do gmail. Já avisada
por e-mail (uid 402). A resposta estava dentro do incidente e não foi lida.

**Consequência prática:** o relatório apresenta o caso ao Johnny como *"não dá pra saber se
pagou"*. **Dá, e está medido.** A pergunta que é dele nunca foi essa — é se **compra de CURSO dá
direito a crédito dentro do FastCloner**.

**Anexei uma RETRATAÇÃO ao próprio relatório** (não reescrevi as linhas originais — ficam como
estavam, convenção de retratação da casa), para que quem ler o documento leia a correção junto.

---

## §3 — O que eu NÃO fiz, de propósito

- **Não peguei o `#237`** ("não conta nada na plataforma", 20:38Z, 0 `affected_emails`). É o mais
  novo e o serial manda ir pelo mais antigo com aluno esperando. Fica para a próxima ronda.
- **Não decidi a pergunta comercial** do `#202`/`#173`/Cristina/Robert. Não é minha: envolve
  liberar acesso e crédito. **5ª ronda pendente.**
- **Não liberei crédito, acesso nem estorno** para o Vinícius, e não mexi em saldo de ninguém.
- **Não fechei o `#202`.** Nada foi consertado (não há defeito nosso a consertar nele) e não é
  `ignored`. Também **não é `aguardando_aluno`**: eu disse a ele que não precisa fazer nada, então
  a bola não é dele.
- **Não fechei o `#214`** (Zica). A nota de 01/09 diz *"só confirme com ela antes de encerrar"* e
  eu não confirmei nesta ronda — fechar por conta própria seria fechar no escuro. Fica registrado
  como candidato limpo a fechamento.
- **Não corrigi a causa** de o `aluno.cjs` "compras: NENHUMA" ser lido como verdade de pagamento.
  O conserto honesto é o script dizer o que **não** cobre (mesma linha do `--completo` do `sql.cjs`
  e do `pagou_de_verdade.cjs`, que já avisa sozinho). É conserto de instrumento, merece PR próprio
  e revisão — não vou empurrar no fim da noite. **Fica como pendência nomeada, não como sobra.**
- **Não mergeei PR nenhum** (`#15`, `#41`, `#42`, `#160`, `#161`, `#162`, `#163`, `#165`). O
  **`#161`** é o que fecha o buraco do `resolved_commit` órfão que eu limpei **na mão** aqui.
- **Não toquei** em GPU, voz, áudio nem migration (102 segue não aplicada, **8ª ronda**).
- Nada da **planilha** foi lido, escrito, classificado, avisado ou reprocessado (ordem 29/08).
- **Não li a caixa do `suporte@` para triagem.** As únicas leituras foram `--de vlorandi` e
  `--enviados --para vlorandi` (o caso que eu estava tratando) e `--ultimos 6` para conferir
  bounce do meu próprio envio.
- **Não afirmo** nada sobre áudio: não ouvi nada nesta ronda.

## Pendências que atravessam rondas

| item | estado |
|---|---|
| **Decisão comercial: compra de CURSO dá crédito no FastCloner?** (`#202` R$ 2.697,60, `#173` R$ 2.391,00, Cristina R$ 185,61, Robert R$ 684,92) | **5ª ronda**. Premissa que foi ao Johnny estava errada — corrigida hoje |
| **Decisão de produto do `#226`** (QA esgota: falhar sem cobrar ou entregar avisando?) | **5ª ronda** |
| PR **#161** (reabertura deixa `resolved_commit` órfão) | aberto — limpei o `#202` na mão hoje |
| PRs **#41/#42** (teto de 2MB) | 13º dia |
| **Migration 102** (`#232`) sem aplicar, aguarda Johnny | **8ª ronda** |
| `aluno.cjs` "compras: NENHUMA" lido como verdade de pagamento | **nova** — §3 |
| `aviso-orfao*` fora do git | resolvido na ronda das 01h (PR #165) |
| `#214` (Zica) pronto para fechar, falta confirmar com a aluna | **nova** |
