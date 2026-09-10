# Fecho do dia — relatório noturno de 09/09 (escrito 10/09 ~01:00–01:40Z)

Consolidado das ~24h desde o relatório anterior (09/09 01:10Z → 10/09 01:40Z).
Todo número aqui foi **medido nesta ronda de fecho**, com o instrumento nomeado
na linha. Onde repito medição de outra ronda, digo de quem é e de que hora.

Canal: ordem do Johnny de 31/08 — o aviso sai **no grupo**, com
`notify-grupo.sh`. Nada no privado.

---

## 0. Um quase-acidente meu, antes de qualquer número

Comecei a ronda no checkout `/home/johnny/Projects/lucasarrial`, que está na
branch `feat/resumo-diario-grupo-suporte` e cujo último commit é de **09/09
13:16Z**. Olhando só pra ele, o dia parecia ter **parado às 13:16Z** — quase
escrevi "12 horas sem ronda nenhuma" no relatório.

Estava errado. O `git fetch` mostrou a `origin/main` com **38 commits** no dia,
o último às **10/09 00:51Z**. O trabalho todo aconteceu; o que estava velho era
a minha cópia.

Fica escrito porque já custou caro antes (`04442c3`, *"o quase-acidente do log
em branch feat/ na ronda 20h"*) e porque o erro é traiçoeiro: ele não dá erro
nenhum, só produz um relatório confiante e falso. **Regra que vale pra próxima
ronda de fecho: `git fetch` ANTES de contar qualquer coisa, e conte sobre
`origin/main`, nunca sobre a branch em que o checkout calhou de estar.**

---

## 1. O que eu resolvi hoje

### 1.1 Oito chamados fechados — o primeiro dia com saldo positivo em uma semana

Sete fecharam dentro de 09/09 e um logo depois da virada. Medido em
`incidents.resolved_at`, não em log de ronda:

| id | hora | o que era |
|---|---|---|
| `3ca22d47` | 01:52Z | 5 alunos com acesso ativo presos fora da própria conta (resgate de compra órfã casando só por e-mail) |
| `8a37c48e` | 11:43Z | aluno em Portugal precisava pagar por multibanco — pagamento confirmado em 3 fontes |
| `3ad6b6da` | 11:47Z | **#319** — a Fast mandava pagar um Pix que já tinha vencido há 9 dias |
| `8135ff66` | 13:50Z | **#320** — a Fast lia o e-mail do aluno com o texto corrompido em 25 de 60 casos |
| `c55786cd` | 16:50Z | **#323** — a Fast não sabia que dia era hoje e repetia prazo vencido como futuro |
| `5009d7ab` | 21:51Z | **#260** — a Fast afirmou a uma aluna um estorno que nunca existiu |
| `c1673a34` | 22:52Z | **#267** — aluna não conseguia baixar o vídeo do Vídeo História |
| `f9e12b9b` | 00:43Z (10/09) | **#324** — dois compradores do SGP pagaram, não receberam nada, e o sistema os marcou como avisados |

**Saldo do dia: 15 abriram, 7 fecharam (−8).** Não escondo o sinal: a fila
piorou. Mas o dia anterior fechou **zero** com 12 abrindo, então a curva mudou
de direção pela primeira vez desde 03/09.

### 1.2 Fechei o PR #221, que estava armado pra desfazer um conserto que já está no ar

Este é o único item em que eu **agi** nesta ronda, e ele estava parado por um
motivo estrutural: o Vigia sinalizou o risco em **quatro rondas seguidas**
(18h, 20h, 22h e 00hZ) e **não pode fechar PR** (regra 14-A). Quem fecha sou eu.

O **PR #221** (`feat/fast-sabe-a-data-de-hoje`) resolve o mesmo **#323** que o
**PR #222** já resolveu e que está em produção desde 16:47Z. Ele cria um
`data-hoje.ts` **em paralelo** ao `hoje.ts` que está no ar e mexe no **mesmo**
`manual.ts`. Mergeado, passaria por cima do conserto vivo.

**Conferi linha a linha antes de fechar, não pelo título.** Li o
`frontend/src/lib/agent/hoje.ts` da `main` (linhas 64–73) contra as sete
asserções dos testes do #221:

| o que o #221 exige | está na `main`? |
|---|---|
| data em dd/mm/aaaa | sim (`dataPorExtensoBR`) |
| dia da semana calculado, em português | sim |
| fuso de Brasília, vira o dia às 00h de SP | sim (`TZ = "America/Sao_Paulo"`, com a nota de por que o UTC quebraria) |
| não repetir prazo vencido como futuro | sim (linha 70) |
| não inventar prazo novo | sim (linha 71) |
| escalar pro humano | sim (linha 70, "escale (regra 3)") |
| a data não pode virar cálculo de garantia (#198) | sim (linha 73) — entrou pelo **PR #223**, `c188a38`, 16:53Z |

A redação é outra; a regra é a mesma, e as duas pontas (#222 + #223) já cobrem
o #221 inteiro. Fechado com a justificativa completa no próprio PR.
**Reversível de propósito:** se aparecer algo ali que a dupla não cobre, é só
reabrir.

### 1.3 Sete correções em produção — e a prova é do servidor, não do GitHub

Sete PRs mergeados na `origin/main` no dia (mais um logo após a virada):

| PR | commit | o que corrige | merge |
|---|---|---|---|
| #218 | `ecf58d9` | a Fast para de mandar pagar Pix/boleto já vencido (#319) | 11:44Z |
| #220 | `857986c` | e-mail do aluno decodificado pelo charset **declarado** (#320) | 13:45Z |
| #222 | `573ed89` | a Fast passa a saber que dia é hoje (#323) | 16:47Z |
| #223 | `c188a38` | a data de hoje não pode reabrir o #198 (garantia continua vindo pronta) | 16:53Z |
| #226 | `b2e2da6` | a causa do e-mail de boas-vindas que não saiu para de ser jogada fora (#324) | 18:53Z |
| #227 | `832be61` | o botão Baixar do Vídeo História salva o arquivo (#267) | 22:47Z |
| #225 | `5e78ce2` | falha de envio de boas-vindas não vira "já enviado" para sempre (#324) | 23:53Z |
| #229 | `3f25c18` | o teto absorve o pico de setup, que era a causa do estouro (#15) | 00:51Z (10/09) |

**Confirmação de que está NO AR** — lida no Hetzner, não em Action verde:

- `BUILD_ID` = **`qkqOzMV490IAQgVHA500f`**, gerado **10/09 00:53:33Z** — ou seja,
  **depois** do último merge do dia (`3f25c18`, 00:51Z). Todos os oito estão
  dentro deste build.
- `pm2 aiverse` **online desde 10/09 00:54:27Z**, isto é, rodando este build e
  não um anterior.

---

## 2. O que precisa de você

Ordenado por quem está esperando há mais tempo. Cada item é sim ou não.

1. **Os 15 vitalícios (#313, `2d0509b4`) — honra ou revoga?** Parado há **28h**,
   nona ronda pedindo. Comprador de **curso** ganhou a plataforma vitalícia de
   graça (15 entitlements, 12 pessoas; 1 já está com acesso vivo até 2030).
   Enquanto não houver resposta, **os 19 alunos do #312 não podem ser tratados**
   e o **Victor** (`ae6b4bd1`, **31h**, cobrou reembolso pela 2ª vez às 18:42Z)
   continua sem resposta. É uma decisão que está segurando três filas.
2. **Reembolso: eu processo ou você processa?** São **7 chamados de reembolso** e
   **13 tocando dinheiro** entre os 57 abertos — Victor, Lucila (R$ 291,
   assinatura em dobro, cobrou 2×), Simone (R$ 672,00 + R$ 303,40, compras de
   31/08). Reembolso é ação no gateway e fala em nome da empresa sobre dinheiro:
   está fora do meu teto (§06). **Me autoriza a responder e processar, ou você
   assume?**
3. **A varredura de crédito de trial (`expire_trial_credits`) segue desligada —
   22º dia. Religa?** Eu mesmo desliguei em 18/08, depois que a primeira rodada
   real zerou 14 pessoas. Parado hoje: **108 pessoas, 8.212.661 créditos**
   (83 já passaram do dia 10). Religar mexe em saldo de 108 de uma vez, muito
   acima de qualquer teto meu. Se for sim, eu rodo **seco primeiro**, com os
   nomes na tela, e só executo depois do seu ok na lista.
4. **DDL `104_avisos_enviados.sql`: aplico?** Terceiro dia parado. Sem ele, 8
   colunas não existem e quem escreve nelas **cai no catch em silêncio** — a
   telemetria parece ligada e não mede nada. Migration é sempre sua (§06).
5. **#226 (`702cc916`, 199h = 8,3 dias): estorno das gerações que o nosso próprio
   QA reprovou e a gente entregou?** É o item mais velho da fila que depende só
   de decisão. Ele destrava o #234 junto.

Fora isso, **nada precisa de você** — o resto da fila é trabalho meu, não
decisão sua.

---

## 3. O que subiu pra produção

Tabela completa em §1.3. Resumo: **8 PRs**, `BUILD_ID`
**`qkqOzMV490IAQgVHA500f`** gerado 10/09 00:53:33Z, `pm2 aiverse` online desde
00:54:27Z. Confirmado no servidor.

---

## 4. Estado geral

**Chamados:** **57 abertos** (`investigating`) + **11 `aguardando_aluno`** =
**68 não-fechados**. Eram **45** abertos na virada do dia (vigia 09/09 00hZ).
No dia: 15 entraram, 7 fecharam; os 2 que faltam pra fechar a conta são casos
que voltaram de `aguardando_aluno` — **não conferi um a um, então não afirmo,
registro como ponta solta**.

**Mais antigos, com idade:** `d3d8d1b2` (41d, geração de áudio com tempo de
execução estourado — o PR #229 desta madrugada ataca exatamente ele),
`ce6e157d` (22d, 10 ocorrências, a aluna testou hoje e diz que persiste),
`6c38c99d` (17d), `506b7c3a` (8d, Alana), `702cc916` (8d, espera você).

**Presos na varredura: 4.** Conferidos um a um, nenhum abandonado:
- `marcelopersonalthe32` · 298.950 cr · **31 dias** sem voz. Bola com ele desde
  27/08 (escrito 3×, última carta com pergunta binária). A falha de 10/08 foi
  nossa; o que trava agora é o arquivo dele.
- `tania-araujo` · 200.000 cr · **5 dias** em `awaiting_training`.
- `hellengrasso` · 95.375 cr · **3 dias** — 5 de 7 arquivos perdidos no envio;
  o fix da tela muda já está no ar.
- 1 `training_job` obsoleto (a voz já está `ready`): escrituração, ninguém
  esperando.
- +1 fora da fila: `luanmarcal.com`, import quebrou em 29/08 (arquivo não
  público no Drive), **12 dias**.

**Pagante sem acesso: 0.** Medido com `pagante_trancado.cjs`, que conferiu
**192 suspeitos um a um na Hotmart viva** — 0 trancado, 0 na fronteira, 0 sem
prova. Os 192 que ficam trancados estão certos: 16 cancelaram, 167
inadimplentes, 9 trial que nunca virou pagamento.

**Dinheiro:** lista de estorno em dia — 10 tipos, **3.031 linhas varridas**
(ontem 2.895), nenhum tipo desconhecido.

**Vídeo Clone:** **72 prontos, 0 falha** nas últimas 24h. 2 gerando agora, os
dois em execução na GPU (não é fila parada).

**GPU:** os três endpoints respondendo 200, **fila zero nos três**. Treino de
voz 6 ready / 0 running; Vídeo Clone 2 running e **3 throttled** — como a fila
está em zero, ninguém está esperando por isso. Nada a fazer.

**⚠️ O número que piorou, e a culpa é minha:** a fila de recados do
`agent_state` foi de **34** (06/09) pra **63 recados + 2 patches**. O mais antigo
é de **01/09 18:25Z — 8,3 dias**. **26 estão parados há mais de 3 dias e 31
tocam dinheiro** (reembolso, cobrança, compra paga sem conta). **19 chegaram só
hoje.** Isso é a §1-B/1-C do `03_ROTINA.md` sendo desobedecida em silêncio, e
não é fila de log: são pessoas esperando resposta e dinheiro. **Assumo: eu não
drenei hoje, nem ontem.** É o primeiro item da minha próxima ronda.

**Um item de vigilância, medido e NÃO promovido a chamado:** o bounce de
`diretoria@ollem.com.br` (23:15Z) não é caixa cheia nem endereço inexistente —
é o **nosso IP de envio** (`104.207.68.48`) **bloqueado na dnsbl.spfbl.net**.
O Vigia varreu a fila inteira: sai **1 registro só**. Uma ocorrência não é
surto, então fica como vigilância. **Se aparecer um segundo, muda de figura** —
isso atinge todo mundo, não um aluno.

---

## 5. O que eu decidi NÃO fazer, e por quê

- **Não drenei a fila do `agent_state`** nesta ronda. Seriam 63 recados, muitos
  exigindo resposta a aluno, e fazer isso às pressas no fecho é como se erra —
  a regra 8 é serial de propósito. Preferi reportar o tamanho honesto do buraco
  a limpá-lo pela metade e dizer que limpei.
- **Não toquei em crédito de ninguém.** Nem os 108 do trial, nem os 12 com saldo
  negativo que o Vigia mapeou. Saldo negativo no onboarding é **autorizado por
  design** (`credits/service.ts:77-85`, decisão sua de 21/08) e acusar sem abrir
  o código que cobra é repetir o `#100`.
- **Não uni os chamados `918b598d` e `76e68853`** (mesmo aluno, welrisson, dois
  canais). Ficam marcados pra quem tratar não contar duas vezes.

---

## 6. A lição do dia

**A cópia do repositório é um instrumento, e instrumento velho mente com
confiança.** O erro de §0 não teria dado erro nenhum: teria produzido um
relatório coerente, com data, hora e commits reais, dizendo que a operação
parou às 13:16Z. O jeito de pegar isso não é ler com mais atenção — é **fazer
`fetch` antes de contar**, do mesmo jeito que se checa o `error` da consulta
antes de acreditar num zero (armadilha 1 do `03_ROTINA.md`). São a mesma
armadilha em roupas diferentes: **a fonte silenciosamente desatualizada.**
