# Ronda das falhas — 24/09, ~17h30–18h30Z

Dono da fila (14-A). Serial (regra 8). Canal: **grupo** (ordem de 31/08).

---

## 0. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `git checkout main && git pull --ff-only` | já atualizado |
| Índice das ordens lido (`_frank/ordens/README.md`) | ok |
| `percepcao_travada.cjs` (ordem de 17/09) | **0 cards** travados em percepção · mais velho 0d · controle positivo (#310) e negativo (#518) verdes |
| `reconciliar_envios_da_pasta.cjs --corte=… --confirmar` | 1.220 lidas = 1.143 com linha + 77 fora da janela + **0 escrituráveis** |
| `enviados_x_tabela.cjs` (irmão de leitura) | veredito: **0 carta depois do corte** fora da tabela |

As 77 cartas anteriores a 14/09 14:06:31Z seguem sem decisão, como manda o índice.

---

## 1. Escolha do item serial — e por que ela levou meia ronda

A regra 8 manda pegar **o mais antigo com aluno afetado**. Rodei `idade_dos_abertos`
(120 abertos, 69 com 7d+) e depois ordenei os abertos pela **última nota mais velha**,
que é o recorte que a ronda de 14/09 já tinha usado para achar trabalho abandonado.

Resultado: **15 cartões com aluno nomeado, parados entre 9 e 11 dias.** Fui de cabeça
da lista pra baixo e **li os cinco mais velhos inteiros** antes de escolher:

| Cartão | Idade | O que sobra nele |
|---|---|---|
| `#263` rossiclinicas | 19,2d | só a decisão dos R$97 — **do Johnny** |
| `#304` emanuelfmguerreiro | 16,2d | só os 113,16 EUR — **do Johnny** |
| `#307` franciswd | 16,1d | só o reembolso — **do Johnny** |
| `#327` jack35marinho | 14,9d | só a devolução de 1.700 cr — **do Johnny** |
| `#332` franklindfreis | 14,7d | só a pergunta comercial R$894 — **do Johnny** |

**Os cinco estão completos do lado técnico e parados em decisão de dinheiro.** Isso agora
está medido, não é impressão — e é a razão de a fila não baixar. Não re-medi nenhum:
re-medir cartão pronto é o que faz ronda parecer produtiva sem entregar nada.

O que sobrou de **meu** estava escrito no `#304`, nota de 14/09: *"ACHADO NOVO NO FIO
(…) merece varredura própria na próxima ronda"* — sobre a Fast seguir empurrando caminho
técnico depois de o aluno pedir reembolso por escrito. **Dez dias e ninguém fez a
varredura.** Peguei esse.

---

## 2. Checagem 1 (ordem de 27/08): a classe já tinha dono

Antes de abrir qualquer coisa, procurei a classe no acervo. Achei o **`#415`**
(*"A FAST CONTINUA RESPONDENDO SOZINHA DEPOIS QUE O CASO JÁ FOI ENTREGUE A UM HUMANO"*),
aberto 15/09, **abandonado há 9 dias**. E achei o que muda a ronda:

> **O PR #295, que é a cura do `#415`, está MERGEADO desde 15/09 22:30:26Z.**

Conferido no **conteúdo da `origin/main`**, não no título do PR: merge commit é ancestral
da main; regra pura em `incidents/humano.ts`, IO em `humano-io.ts`, e `mail-respond.ts`
chama `casoComHumano()` nas **duas** pontas (linha 429 antes de gerar, 491 depois do
processamento) — a mesma dobradinha do canal irmão, que existe porque foi pela janela de
debounce que a resposta automática passou por cima do humano às 14:35Z.

Então a pergunta deixou de ser "investigar" e virou **"a cura pegou?"**.

---

## 3. O achado: a cura está no ar e não alcançava 21 cartões vivos

A trava casa por `agent_notes[].tipo='entregue_humano'`. Essa marca é gravada por
`entregarAoTime` **no momento da entrega**. Cartão entregue **antes** do merge carrega a
mesma nota de **texto** e marca nenhuma — e a trava não lê texto, lê a chave.

Medido (`2026-09-24_trava_do_humano_sem_marca.cjs`, só leitura, com controle positivo):

```
46 cartões VIVOS já entregues ao time
25 COM a marca  → a Fast cala
21 SEM a marca  → a Fast ainda responde por cima de gente   (20 alunos, mais velho 23,2d)
```

### 3.1 O fato que resume tudo

Entre os 21 descobertos estava o **`#412` da própria `tuquinha36`** — **a aluna cujo caso
gerou o conserto era uma das que ele não protegia.** Por 9 dias.

### 3.2 E mordia — com grupo de controle

Cruzei `emails_enviados` (918 cartas desde o merge) com os cartões vivos entregues:

| | `fast-resposta` depois da entrega |
|---|---|
| alunos **DESCOBERTOS** (20) | **2** — Ellen `#348` 20/09 17:50Z, grupoavip `#413` 23/09 19:10Z |
| alunos **COBERTOS** (24) | **0** — apesar de 22 cartas na mesma janela |

**Não inflei o número.** O primeiro corte deu 28 cartas, e 26 delas são
`ronda-manual` / `sgp-codigo` / `onboarding-aviso` — cartas que **eu** mandei de propósito
ou transacionais que o aluno pediu. Essas não são a Fast falando por cima de gente e não
deviam ser barradas. **O defeito são 2.** O grupo coberto é o controle e ele fecha em zero.

### 3.3 A premissa que conferi ANTES de gravar

Calar seria o defeito mais caro deste repositório (`#95`) se a mensagem sumisse. **Não
some:** `anotarQueOAlunoFalou` grava o que o aluno escreveu **E** dá `last_seen_at: agora`
— li a linha `.update({ last_seen_at: agora, agent_notes: [...atuais, nota] })` no conteúdo
da `origin/main`. O cartão **sobe** na fila. E a trava se solta sozinha no fechamento,
porque exige `casoAtivo`. Não existe mudo permanente.

---

## 4. O conserto

`2026-09-24_marcar_entrega_ao_humano.cjs --confirmar` — marca na nota de entrega **mais
recente**, preservando `at`/`by`/`note` originais (a entrega aconteceu naquele dia;
reescrever a data seria falsificar quando o caso chegou à mão de gente) + nota de auditoria
em cada cartão.

```
21 update(s) com 1 linha afetada · 0 falha(s)
releitura do próprio script: 21/21 confirmados
instrumento INDEPENDENTE: 46 vivos entregues · 46 COM marca · 0 SEM
```

**Isto não foi decisão nova.** A casa já decidiu e mergeou esta política; os 21 ficaram de
fora por **acidente de data**. Fazer a produção corresponder à decisão já tomada é execução,
não deliberação.

### 4.1 Como sei que está em produção, e não só na main

Código no repositório não é código em produção, então não me apoiei no merge. A marca
`tipo='entregue_humano'` **só pode ser escrita por `notaEntregueAoHumano`**, que só existe
depois do #295. A entrega marcada mais recente do acervo é de **24/09 15:25Z — hoje**.
O caminho de produção gravou a marca hoje: é prova de **execução**, não de commit.

---

## 5. Correção de instrumento que eu deixo registrada

O **controle negativo que eu mesmo escrevi** ("nenhuma marca pode ser anterior ao merge")
gritou **8 falsos**. Fui conferir em vez de ignorar: são cartões entregues **mais de uma
vez** — entrega pré-merge nua + entrega pós-merge marcada — e eu datava a marca pela
*primeira* entrega. **8/8** tinham toda marca posterior ao merge. Corrigi a leitura.

Depois **aposentei esse controle de vez**, e está escrito no arquivo por quê: o retrofit
preserva o `at` original, então marca pré-merge passou a ser **legítima**. Mantê-lo faria o
instrumento acusar defeito em cima do próprio conserto, toda ronda, para sempre — e alarme
que sempre toca é alarme que ninguém escuta.

---

## 6. `#415` FECHADO

`status=fixed`, `resolved_by=frank/rotina-falhas`, `resolved_at` 24/09 17:50:46Z,
`resolution_note` de 5.535 chars dizendo **o que era, o que consertou e como eu sei**.
Conferido na releitura.

O fechamento diz explicitamente **o que não cobre**: a `tuquinha36` como **aluna** não
fecha ali — responder o aluno e consertar o defeito são duas coisas diferentes.

---

## 7. `#412` (tuquinha36): passo datado vencido há 4 dias, e uma correção contra nós

A nota de 17/09 marcava: *"se ela não responder até 20/09, dar a SEGUNDA tentativa. NÃO
fechar como ignored sem isso"*. Hoje é 24/09. Conferi: ela **não voltou** (última carta da
casa 17/09 10:47Z, nenhuma ocorrência nova dela desde então).

### 7.1 Desminto uma conclusão minha de 17/09

A nota de 17/09 diz ter procurado os R$97,20 *"em TODOS os status que a API aceita"* e achado
zero. **Aquele zero não vale o que parece valer.** Medido em 23/09 e escrito no cabeçalho de
`achar_compra_por_valor_e_data.cjs`: **`/sales/history` só devolve compra PAGA** — reembolso
e status não-pago **somem**, e o endpoint não avisa que está filtrando. Enumerar status na
chamada não contorna o filtro, porque o filtro é do endpoint.

Precedente medido: no caso da Simone Leal (`#86de22c6`), **quatro** instrumentos deram zero
e o zero era **falso nos quatro** — as compras existiam, `REFUNDED`. Mesma família do
`profiles.ja_pagou` (SUSPENSA) e do `/subscriptions/{code}/purchases` cego a assinatura
cancelada. **Instrumento que lê "não" quando a resposta honesta é "eu não enxergo".**

⚠️ Deixei escrito no cartão: **ninguém feche isso dizendo "ela nunca pagou"**. Não está
medido. O medido é "nenhuma busca por chave indireta achou cobrança **paga** com esse valor"
— frase diferente, sobre uma aluna que já teve R$2.712,12 devolvidos por nós.

### 7.2 A carta (regra 8: individual, decido sozinho)

Enviada, **cópia confirmada em Enviados uid 3397** (1ª tentativa), registrada em
`emails_enviados`. Contei a ela **de frente** que a busca que usei tinha ponto cego e que o
meu "não encontrei" não prova que ela não pagou; pedi **uma** de duas coisas (código HP ou
linha da fatura); **não prometi valor, prazo nem desfecho**; e ofereci encerrar o registro
se ela não quiser mais mexer no assunto — insistir com quem já pediu paz também é dano.

**Próximo passo, com data:** se não responder até **01/10**, o caminho não é `ignored` em
silêncio — é uma última carta dizendo que sem o HP a casa não localiza, que o registro fica
no nome dela e que basta responder pra reabrir. *Fechar sem isso seria usar o cansaço dela
como resposta.*

---

## 8. `#410`: a classe virou padrão, com 2 casos medidos

Anotei no cartão que **já é dono da classe** em vez de abrir duplicata (checagem 1, 27/08).
A classe é *"conserto sobe e não migra o acervo aberto"*: caso 1 o dedupe (20 de 21 no
formato velho), caso 2 a trava do humano de hoje (21 de 46). **Dois casos em canais
diferentes deixa de ser azar e vira padrão da casa.**

A pergunta que fica — e é de quem decide processo, não minha pra resolver no fim de uma
ronda: **todo PR que introduz marca/formato novo em registro existente precisa sair com a
migração do acervo junto, ou ao menos com a contagem do que ficou de fora dita no próprio
PR.** O autor do #295 não tinha como saber que deixou 21 pra trás, porque ninguém mede isso.
Eu só medi porque tropecei.

---

## 9. O que eu **não** fiz, de propósito

- **Não re-medi** `#263`/`#304`/`#307`/`#327`/`#332` — estão completos e parados no Johnny.
- **Não decidi** nenhum dinheiro, nem sugeri valor.
- **Não mexi** em crédito, acesso, plano, assinatura ou entitlement. O `credits_extra`
  de 74.516 da tuquinha segue intocado (dívida nossa).
- **Não gastei GPU**, não apliquei migration, **não mergeei nada**.
- **Não toquei** em nada da planilha (ordem de 29/08).
- **Não abri cartão novo** — a classe já tinha dono.
- **Não fechei o `#410`**: a perna do dedupe, que é a dele, continua aberta e não foi
  tratada hoje.

---

## 10. O que precisa do Johnny

Sem novidade estrutural. O lote é o mesmo e **cresceu por decisão, não por investigação**
— 5 dos cartões mais velhos da fila estão 100% prontos do lado técnico e travados só aqui:

1. **WhatsApp/telefone** pros pagantes do `#249` (R$ 8.250,27) — trava Glauber, Andy,
   Sunesa, e o `#340` (Ulysses, R$741, canal já encontrado há 11 dias).
2. **Quem mergeia conserto pronto** — a pilha segue. **6º dia** em que o gargalo é entrega.
3. Decisões de dinheiro paradas, uma linha cada: `#263` R$97 · `#304` 113,16 EUR ·
   `#307` reembolso · `#327` 1.700 cr · `#332` R$894.
4. Crédito do Gemini (`olho`, `pesquisa`, `social`).
5. **A pergunta de processo do item 8**: PR que cria marca nova sai com a migração do
   acervo junto?

---

## 11. Fim de ronda

- Log commitado na **main** (regra 25-B). Nenhum código de produção mudou hoje — o que
  mudou foi **dado** (21 marcas) e **ferramenta**, os dois na main.
- Recado no **grupo** via `notify-grupo.sh` (canal de 31/08). Nada no privado do Johnny.
- `git log origin/main..HEAD` vazio conferido no fim.
- Escrita conferida na **releitura independente** em todos os pontos: 21/21 marcas,
  `#415` fixed, `#412` 6 notas, `#410` 4 notas, carta uid 3397.
