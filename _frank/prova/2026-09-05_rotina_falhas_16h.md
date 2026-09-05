# Ronda das falhas — 05/09/2026 ~16:41–16:55Z (Frank, dono da fila)

Fila no início: **23 abertos + 13 aguardando aluno**. Segui o serial no mesmo
incidente da ronda anterior: **Vídeo Clone fora do ar** — a exceção da regra 8
(produção fora do ar) continua valendo, porque continua fora do ar.

**Resultado da ronda: a produção segue caída, agora com um 4º aluno pagante — e
o número que eu reportei às 15h50 estava errado para menos.**

---

## 0. Fiz o passo que faltou na ronda passada

A ronda das 15h terminou com a lição *"antes de investigar, rodar `gh pr list`"*.
Foi a primeira coisa que fiz. **PR #190 continua `OPEN`, sem revisor, desde
15h41:06Z.** Custou 10 segundos e evitou que eu diagnosticasse tudo de novo.

## 1. A pergunta da ronda: "o Vídeo Clone voltou?"

Não. E o jeito como eu quase respondi errado é o achado principal.

Olhando `video_clones`, a última tentativa era **15h18Z**. Nada depois. Pela
tabela, a leitura natural seria *"ninguém tentou, não dá para saber se voltou"* —
e eu teria fechado a ronda sem resposta.

Só que a varredura mostrou um incidente novo, **`#271`, aberto 16h26 e visto
16h31Z**, para `ederonline1@gmail.com`. Um aluno que **não tem uma única linha em
`video_clones`** — nem hoje, nem nunca.

## 2. Por que a tabela não serve para contar falha

O detector (`failure-alert.ts`) não lê `video_clones`: ele conta **estornos** no
extrato (`ref_type='video_clone_refund'`, janela 6h, threshold 2). Fui no extrato:

| aluno | falhas (extrato) | linhas em `video_clones` |
|---|---|---|
| pcezardireito@icloud.com | 9 | 2 |
| rafaluanravi29@gmail.com | 5 | 5 |
| lux.neuropsi@gmail.com | 3 | 3 |
| ederonline1@gmail.com | **3** | **0** |

**20 falhas de 4 alunos.** Eu reportei às 15h50 *"10 falhas, 3 alunos"* — metade.

A causa não é bug novo: é o **DELETE do histórico**, que apaga a row de verdade
(não há soft-delete) e deixa só o rastro no extrato. Está documentado desde
20/08. O que ninguém tinha notado é a **consequência para medição**:

> Contar apagão por `video_clones` subestima **justamente os alunos que mais
> tentaram** — porque são eles que limpam o histórico depois de encher a tela de
> erro. O extrato não some. É por ele que se conta.

## 3. Duas coisas que eu escrevi às 15h50 e estavam erradas

**(a) A janela, de novo, e para o lado contrário.** Escrevi *"primeira falha
15h03:23Z"*. A primeira é **14h46:58Z**, 16 min antes. Último sucesso segue
11h26:49Z. Janela real de incerteza: **11h26:49 → 14h46:58Z (3h20)**.

Na ronda passada eu corrigi essa mesma janela uma vez e ainda assim entreguei
ela errada, porque corrigi o número sem trocar a fonte que o produziu.

**(b) O "quirk do detector" não era quirk — o detector estava certo.** Eu anotei
que o `#264` tinha `first_seen_at` 15 min antes da primeira falha e
`occurrences=8` para 2 falhas, e escrevi *"anotei para ninguém procurar bug onde
não tem"*. Está errado: `first_seen_at` 14h48:05 casa **exatamente** com o
estorno de 14h48:05.050, e as 8 ocorrências casam com os 9 estornos do
pcezardireito. Ele viu tudo. **Quem perdeu evento foi a minha consulta**, e eu
publiquei a minha cegueira como defeito do instrumento.

É o erro mais caro dos dois: desacreditar o instrumento que estava certo ensina
a próxima ronda a ignorá-lo.

## 4. A ponta solta do `#269` está fechada

O aluno relatou 3 falhas, e eu não achei a de **11h55 BRT (=14h55Z)** *"em
nenhum status"*, deixando no ar se havia tentativa sem rastro. **Ela existe:**
estorno 14h55:46.178Z, `ref_id e5752e5d-…`, débito casado de −2730 às 14h55:42Z.
Falta só a row, apagada pelo DELETE.

O aluno estava certo e a Fast estava certa. Não é tentativa fantasma nem ponto
cego novo — é a mesma história do §2.

## 5. Prova de que a produção segue caída (16h31Z)

As 3 tentativas do `ederonline1`: débito → estorno em **~3 segundos**
(16h25:53 → 16h25:56; 16h26:52 → 16h26:55; 16h30:59 → 16h31:02).

Morrer em 3s é a assinatura do apagão: o job não chega na inferência, cai no
`DownloadAndLoadWav2VecModel` que não acha os pesos. **A última falha conhecida
passa de 15h18Z para 16h31:02Z.**

## 6. Dinheiro: reconferido nas 20, não nas 10

20 débitos `ref_type='video_clone'` × 20 estornos `ref_type='video_clone_refund'`,
casados **1-a-1 por `ref_id`**, nenhum débito órfão. **Ninguém perdeu crédito.**

O único débito sem estorno na janela é `d15a199b` (vitor.dutra, −5880, 11h26:50Z)
e ele está **correto**: foi o último sucesso, status `ready`. Um detector ingênuo
de "débito sem estorno" apontaria ele como vítima.

Conferido por `ref_type`, **nunca por `kind`** — o estorno grava
`kind='extra_purchase'` (armadilha de 20/08 que quase pagou em dobro a 13 alunos).

## 7. O aluno novo era pagante e ninguém tinha falado com ele

`ederonline1@gmail.com`: **R$ 252,45** avulsa (Fábrica de Conteúdo Invisível,
13/08) + **R$ 97** assinatura (21/08), ambas COMPLETE na Hotmart viva. Conferido
por `pagou_de_verdade.cjs` — não pela coluna `ja_pagou`, que está suspensa e lê
"nunca pagou" para todo mundo.

Os outros 3 foram avisados às 15h28Z. Ele entrou às 16h25 e **não tinha recebido
nada**. Conferi a Enviados antes de escrever (`nada encontrado`), e escrevi:
falha é nossa, não é sua foto/áudio/conta; os 3 estornos de 1.680 já estão na
conta; pare de tentar até voltar.

Enviado **16h47Z, cópia confirmada em Enviados uid 1084**.

Duas diferenças em relação ao e-mail que a Fast mandou aos outros 3, de
propósito: **não afirmei hora precisa da quebra** (eu não tenho, são 3h20 de
incerteza) e **não prometi prazo de conserto**. O `#260` já é sobre a Fast
preencher com o que soa tranquilizador quando não tem o dado; não vou repetir a
classe no mesmo dia.

## 8. Dívida com aluno subiu para 4

Os 3 das 15h28Z + o ederonline1. Todos com **promessa escrita** de e-mail quando
voltar. `#264`, `#266`, `#267`, `#268`, `#269` e `#271` **não podem ir para
`fixed`** sem: geração real com sucesso no banco + os **4** e-mails + nota de
resolução.

## 9. O que eu NÃO fiz

Não fechei incidente, não marquei `fixed`, não mexi em crédito, não estornei,
**não gastei GPU**, não apliquei migration, não mergeei PR, não escrevi código,
não toquei em nada da planilha (ordem de 29/08) e não li a caixa do `suporte@`
para triagem — só a Enviados, para não escrever em duplicata.

**Não consertei a queda.** O conserto é o PR #190 + **rebuild da imagem do
worker**, e deploy não é meu (regra 2). Fiz o que era meu: medir direito, corrigir
o que eu tinha medido errado, avisar o aluno que ninguém tinha avisado e manter a
condição de fechamento travada.

## 10. O que continua aberto

- **Vídeo Clone fora do ar há ~5h** (última falha 16h31Z, 4º aluno). Bloqueado em
  **revisão do PR #190 + rebuild da imagem**. Não é falta de conserto, é falta de
  quem mergeie e reconstrua.
- **4 alunos** com e-mail prometido para quando voltar.
- Herdado e **não tocado hoje**: `#265` (57 alunos com janela de garantia errada),
  migration 82 travando o `#15`, 21 PRs parados, Luciano (cobrança 19/09),
  Marcelo (garantia 11/09).

## 11. Próxima ronda começa por aqui

1. **`gh pr list` primeiro.** Funcionou hoje, manter.
2. **Vídeo Clone voltou?** Conte pelo **extrato**
   (`ref_type='video_clone_refund'`), não por `video_clones` — a tabela perde as
   tentativas dos alunos que apagam o histórico. E confirme volta por **geração
   real `ready` no banco**, não por health do RunPod (verde cego, §4 da ronda
   15h), não por PR mergeado e não por deploy anunciado: **sem rebuild da imagem,
   merge não conserta nada**.
3. **Se voltou:** os **4** e-mails prometidos ANTES de fechar `#264` e irmãos.
4. **Se não voltou:** cobrar de novo no grupo. Ritmo medido hoje: ~1 aluno novo
   por hora batendo na parede (3 alunos às 15h, o 4º às 16h25).

## Registro

`git checkout main && git pull --ff-only origin main` limpo no início. Fila lida
pela varredura, não pela caixa do `suporte@` (ordem de 19/08). Estorno em dia
(10 tipos, 2.812 linhas, nenhum tipo desconhecido). Três incidentes anotados via
`anotar_incidente.cjs` (`#271` open→investigating, `#264`, `#269`), os três com
releitura conferida em 1 linha afetada. Um e-mail a aluno (regra 8: individual,
caso que eu estava tratando, decidido sozinho), cópia confirmada em Enviados.
Dois avisos ao **GRUPO** (o apagão em curso e o e-mail ao aluno), nunca ao
privado — ordem de canal de 31/08. Log commitado na **main**.
