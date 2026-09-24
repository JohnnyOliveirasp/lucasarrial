# Ronda das falhas — 24/09, ~18h40–19h10Z

Dono da fila (14-A). Serial (regra 8). Canal: **grupo** (ordem de 31/08).

---

## 0. Passos fixos

| Passo | Resultado |
|---|---|
| `git checkout main && git pull --ff-only` | já atualizado |
| Índice das ordens (`_frank/ordens/README.md`) | lido |
| `percepcao_travada.cjs` (ordem 17/09) | **0 cards** travados em percepção · mais velho 0d · controles (#310 / #518) verdes · 540 incidentes varridos |
| `reconciliar_envios_da_pasta.cjs --corte=… --confirmar` | 1.229 lidas = 1.152 com linha + 77 fora da janela + **0 escrituráveis** · conta fecha 1.229 = 1.229 |
| `enviados_x_tabela.cjs` (irmão de leitura) | veredito: **0 carta depois do corte** fora da tabela |

As 77 anteriores a 14/09 14:06:31Z seguem sem decisão, como manda o índice.

---

## 1. Escolha do item serial

150 incidentes vivos, 142 com aluno nomeado. Ordenei pela **última nota mais
velha** (o recorte que acha trabalho abandonado, não o `created_at` — que a
ronda das 15hZ já mostrou esconder cartão).

Topo da lista: **`0d18df31` (#377)** — 12,9d de vida, **11,1d sem ninguém
encostar**, 2 alunos. Peguei esse. Os cartões de 14–19d que a ronda das 18hZ
mediu continuam parados em **decisão de dinheiro do Johnny**; não re-medi
nenhum.

---

## 2. O achado: o conserto estava no ar há 9 dias e ninguém mediu

O cartão pedia dois consertos e **os dois já estavam feitos**. O `d8ace93f`
(PR #261) foi mergeado em **15/09 02:20:33Z — um dia depois da última nota do
cartão**. Conferido no **conteúdo da `origin/main`** (`git cat-file`), não no
título do PR; `merge-base --is-ancestor` confirma.

O cartão não estava esperando conserto. Estava esperando **alguém medir**.

### 2.1 Prova de execução, não de commit

**140 pedidos nasceram depois do merge e ZERO tem e-mail no campo nome.** Isso
é comportamento do caminho de produção ao longo de 9 dias — não é leitura de
commit.

### 2.2 Controle de mutação (a guarda pega a regressão)

| árvore | testes |
|---|---|
| limpa | **11/11** |
| mutante A — removo a recusa de e-mail no campo nome | 10/11 (cai 1) |
| mutante B — `semNadaAPreservar = true`, volta a sobrescrever cadastro bom | 9/11 (caem 2) |

Fonte restaurada, `git diff` limpo conferido depois dos dois.

---

## 3. O buraco que o conserto não fechava — 3º caso da classe do #410

As duas pernas guardam a **porta de entrada**. Pedido criado **antes** do merge
já passou pela tela 1 com o nome ruim **gravado**, e a perna 2 só protege quem
**já tem conta**. Pedido antigo + aluno sem conta ⇒ `contaCriada=true` ⇒
`semNadaAPreservar=true` ⇒ o upsert grava `display_name = pedido.nome`.

Medido: dos 398 pedidos, **um** ainda tinha e-mail no campo nome — o
`4d0e4dd1` (Angela), criado 11/09, **em voo quando a trava subiu**.

**Terceiro caso** de *"conserto sobe e não migra o acervo aberto"*: dedupe
(20 de 21), trava do humano (21 de 46), e agora este (1 de 1). A pergunta de
processo do item 8 da ronda das 18hZ segue de pé, e agora com três casos.

Corrigido: `2026-09-24_nome_do_pedido_em_voo.cjs --confirmar` → 1 linha
afetada, releitura independente confere, instrumento independente relido:
**0 pedido com e-mail no campo nome em toda a base**.

### 3.1 O nome não foi inventado — e o que mudou foi o instrumento, não o fato

A nota de 13/09 parou de propósito: *"não tenho nome autoritativo. Não invento
nome de aluno a partir do e-mail."* Estava **certa**, e certa em parar.

O `2026-09-20_contato_do_comprador.cjs` nasceu **7 dias depois** daquela nota e
lê a **Hotmart viva**: lá está `HP0025277184` com `buyer.name` preenchido — o
nome que ela mesma digitou ao pagar. Mesma família do `/sales/history` e do
`profiles.ja_pagou`: **"o nosso banco não tem" nunca foi "não existe"**.

---

## 4. Duas correções contra mim mesmo

**(a) O "ZERO perfis com @" de 13/09 era falso.** Medido hoje sobre os 2.965
perfis **paginados**: são **quatro**, e os quatro são **anteriores** a 13/09
(24/07, 15/08 ×2, 24/08). Assinatura da armadilha das 1.000 linhas do
`03_ROTINA`. **Ressalva que impede o alarme falso:** nenhum dos quatro veio do
SGP (0 pedidos) — entraram pelo cadastro comum, outra porta, **não é o defeito
deste cartão**. Não migrei nenhum: não tenho nome autoritativo para eles.

**(b) O "0 cartas para a Angela" era falso.** `emails_enviados` deu zero — e a
tabela **só começa em 14/09**, o caso dela é 11/09. A pasta **Sent** (remota)
mostra **2 cartas**. Eu quase escrevi no relatório que a casa nunca falou com
ela. É exatamente o zero cego que o cabeçalho do `cartas_para_o_aluno.cjs`
descreve, e ele me pegou.

---

## 5. A Angela, que é o que este cartão tinha de gente dentro

Lido o corpo da carta (Sent, uid 1908), a sequência é esta:

| hora (11/09) | o quê |
|---|---|
| 20:30:52 | recebe o código |
| **20:32:38** | **verifica com sucesso** |
| ~20:33 | escreve pra casa |
| 20:35:09 | resposta automática: *"volta na tela e cola o código"* — **sem link, sem dizer qual tela, repetindo um código que ela já tinha usado** |
| desde então | 13 dias parada no passo da foto, 0 foto, 0 áudio |

Esse defeito do e-mail do código é o **`436104f4`, fechado em 12/09 — um dia
depois de ela tropeçar nele**. Ela é vítima pré-conserto que nunca foi
resgatada: **o padrão do #410 outra vez**, agora machucando uma pessoa.

**Carta enviada** (regra 8, individual, decido sozinho) — uid **3398**
conferido na pasta Sent, registrada em `emails_enviados`. Pedi desculpa pela
resposta confusa, contei o que aconteceu, e **não prometi valor, prazo nem
desfecho**.

### 5.1 O que eu deliberadamente NÃO fiz

**Não mandei ela terminar a configuração.** Todos os alunos que **concluíram**
o SGP têm compra do *Sistema de Geração Pronto* ou do *FastCloner*. A Angela
tem **só a "Fábrica de Conteúdo Invisível"** (1 avulsa de 270,27 BRL, 0
assinatura). O que a avulsa dá direito no SGP é **decisão comercial (#173), do
Johnny**. Convidá-la a subir fotos e gravar áudio seria chamá-la para um
trabalho a que talvez ela não tenha direito — dano novo, não conserto.
Perguntei a ela o que pretendia.

**Promessa com data:** eu disse a ela que não ficaria sem resposta de novo. Se
responder, volta pra mim; **se não responder até 01/10, escrevo de novo**.
Fechar o cartão não apaga essa promessa.

---

## 6. `#377` FECHADO

`status=fixed`, `resolved_at` 24/09 18:51:51Z, `resolved_commit` `d8ace93f`,
`resolution_note` de 5.561 chars dizendo o que era, o que consertou, como sei,
e **o que o fechamento não cobre**. Conferido na releitura, 1 linha afetada.

---

## 7. O que eu vi de passagem e NÃO virou cartão (ordem de 27/08)

### 7.1 85 alunos com pedido parado, e o aviso que nunca foi usado

Um pedido por aluno (o de maior progresso, pra não contar duas vezes quem
perdeu o cookie), parados 3d+ **com e-mail já verificado**:

```
85  alunos parados 3d+          (mais velho 18,2d)
35  sem NENHUMA carta do suporte@
85  sem `avisado_em`  ← 85 de 85
```

O `avisado_em` é escrito pelo endpoint **de admin** (`/admin/sgp/[id]/aviso`):
é um **botão manual que ninguém aperta**. Botão não apertado é **processo, não
defeito de sistema** — por isso vai pro grupo e não vira chamado.

⚠️ **Não conferi pagamento dos 85.** O número acima é "parado + verificado",
não "pagante parado". Digo o que medi.

O **mecanismo** da maioria já tem dono: **`2637ce41`** (pedido inalcançável sem
o cookie), despachado ao `coder` em 22/09, esperando PR. **A Angela não é
desse mecanismo** — ela tem uma linha só, não recomeçou.

### 7.2 O portal do SGP não tem porteiro — e eu NÃO vou chamar isso de prejuízo

`POST /api/v1/sgp/inicio` **não confere compra nenhuma**: zero ocorrência de
`compra`/`purchase`/`pagou`/`entitle`/`acesso` em todo o caminho de entrada
(`inicio/route.ts`, `codigo/route.ts`, `sessao.ts`). Qualquer e-mail começa um
pedido.

Fui medir o prejuízo e **o número não sustenta a acusação**: dos 140 pedidos
em `pronto`, 71 não têm compra do *Sistema de Geração Pronto* **no nosso
banco** — mas quase todos têm compra do **FastCloner**, e o nosso banco é log
de webhook que já provou ser incompleto. **Não tenho `ref_id` de dinheiro
perdido, então isto não vira chamado** (ordem de 27/08). Fica como **pergunta
de produto pro Johnny**: o portal do SGP *deve* ser aberto?

Achado menor, sem cartão: `codigo.ts` comenta `linkDeRetomada` como se
existisse — **não existe em produção** (0 definições na `origin/main`). A
retomada é justamente o que está parado na branch do `2637ce41`.

---

## 8. O que eu não fiz, de propósito

- **Não re-medi** os cartões parados em decisão do Johnny.
- **Não decidi** nenhum dinheiro, não sugeri valor, não falei de direito da
  avulsa com a aluna.
- **Não mexi** em crédito, acesso, plano, assinatura, entitlement ou status de
  pedido. O único dado que mudei foi **um campo de texto** (`nome`).
- **Não gastei GPU**, não apliquei migration, **não mergeei nada**.
- **Não toquei** em nada da planilha (ordem de 29/08).
- **Não abri cartão novo**: o mecanismo dos parados já tem dono (`2637ce41`) e
  o portal aberto não tem prova de dinheiro.
- **Não migrei** os 4 perfis com `@` — não tenho nome autoritativo para eles.

---

## 9. O que precisa do Johnny

Sem novidade estrutural; o lote é o mesmo da ronda das 18hZ. **Novo hoje,
duas linhas:**

1. **A Angela** (`HP0025277184`, 270,27 BRL, só "Fábrica de Conteúdo
   Invisível"): a avulsa dá direito ao SGP? Ela está esperando resposta minha.
2. **O portal do SGP é aberto de propósito?** Sem porteiro em
   `sgp/inicio/route.ts`. Não é prejuízo medido — é pergunta de produto.

E segue de pé, agora com **três casos**: PR que cria marca/formato novo sai com
a **migração do acervo** junto, ou ao menos com a contagem do que ficou de fora
dita no próprio PR?

---

## 10. Fim de ronda

- Log commitado na **main** (regra 25-B). Nenhum código de produção mudou hoje:
  o que mudou foi **um campo de texto** de um pedido e **uma ferramenta nova**.
- Recado no **grupo** via `notify-grupo.sh` (canal de 31/08). Nada no privado.
- `git log origin/main..HEAD` conferido vazio no fim.
- Escrita conferida na **releitura independente** em todos os pontos: pedido
  `4d0e4dd1` relido, `#377` relido, carta uid 3398 confirmada na pasta remota.
