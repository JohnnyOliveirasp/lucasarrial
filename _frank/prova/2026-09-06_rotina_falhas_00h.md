# Ronda das falhas — 06/09, ~23h–00hZ (20h BRT)

Frank, **dono da fila** (regra 14-A). Método serial da ordem de 21/08: peguei
**um** item e levei até o fim — fix em produção, aluna avisada, incidente
anotado com o commit.

Repo sincronizado (`main`, `pull --ff-only`) e índice de ordens lido antes de
tocar em qualquer coisa. Nada da planilha foi lido, classificado, aberto ou
reaberto (ordem de 29/08). Canal: ordem de 31/08 — o aviso saiu no **GRUPO**.

---

## 0. A ronda em uma linha

**O card que descrevia a tela muda do envio de áudio foi fechado às 18:26 — e o
conserto dele só foi aberto como PR às 18:38, doze minutos DEPOIS. Por 5h a
fila dizia "resolvido" e a produção seguia com o defeito. Hoje ele entrou em
produção, e a aluna que pagou o preço nesse intervalo foi avisada.**

---

## 1. Por que não peguei os mais antigos

A regra manda o mais antigo com aluno afetado. Conferi os três antes de pular,
medindo hoje em vez de herdar o "precisa de decisão" do relatório anterior:

| card | idade | por que não é meu passo agora |
|---|---|---|
| **#15** `d3d8d1b2` | 30/07 | trava em **migration 82 não aplicada** — reconferido hoje pelo `ddl_aplicado.cjs`: 8 colunas em 3 scripts (82, 96, 106) que o git manda existir e o banco não tem. "Nada de migration sem aval" é ordem permanente. Travado em **aval**, não em investigação. |
| **#222** `3ca22d47` | 01/09 | exaurido de verdade: os 4 pagantes reais **não têm conta em lugar nenhum**, não existe chave automática (e-mail 0/42, normalizado 0/42, CPF 2/42 ambíguos, nome 2/13 e os 2 já atendidos) e **todos já foram escritos**. Pela regra de 21/08, aluno escrito com data anotada **saiu do meu colo**. Nona re-medição seria teatro. |
| **#226** `702cc916` | 01/09 | o que falta é **decisão de produto** (falhar o job / avisar / entregar em silêncio) com 44% de incidência. Não é de script. |

Com os três documentados no passo em que emperram, fui pro gargalo que **é
meu**: o relatório anterior já tinha apontado que fix parado em PR não é fix.
Medi: **28 PRs abertos**, o mais velho de 18/08.

## 2. O item que peguei, e a convergência que decidiu

O `#289` (`4ab7e04d`) descreve o envio de áudio que emudece. Ele estava
**`fixed`**, com `resolved_commit` **NULL**. Para a Elane o fecho estava certo —
a voz dela ficou `ready`, nunca travou, e ela foi avisada. Mas o **defeito de
classe** que o próprio card nomeia (`voice-creator.tsx:890`) seguia solto, e o
conserto estava parado no **PR #201**, aberto **12 minutos depois** do fecho.

E ele não é cosmético. Medi a população que a tela muda produz — `voices` em
`rejected_too_short` com a mensagem de envio incompleto:

| recorte | quantos |
|---|---|
| total | **19 vozes / 11 alunos** |
| últimos 30 dias | **8** |
| últimos 7 dias | **2** |
| mais recente | **hoje** |

**Ressalva que importa mais que o número:** isso *não* prova causalidade. O erro
grava "a aba fechou ou a internet oscilou" e eu **não consigo separar**, por
aluno, quem fechou a aba achando que travou de quem caiu a conexão. O que está
provado é o defeito de tela (teste sobre a linha do tempo real) e que a classe
segue acontecendo.

## 3. Revisei o PR no diff, não na descrição

Lição da ronda anterior aplicada. O PR mexe em 6 arquivos e **não toca na lógica
de upload** — extrai a regra de exibição pra função pura com teste. Rodei eu
mesmo:

- `progresso-envio.test.ts` → **7/7**
- guarda de i18n `chaves.test.ts` → **2/2** (código × JSON por caminho escrito)
- `tsc --noEmit` → único erro é `Cannot find module 'vitest'` em
  `resgate-audio.test.ts`, **arquivo que o PR não toca**, defeito pré-existente
  que o **PR #185** conserta. Não é deste PR e não o segurei por isso.

O miolo da correção: a condição de exibição passou a ser o próprio `busy`, então
**"botão apagado" e "painel na tela" viraram a mesma condição e não conseguem
mais divergir**. Some a isso: o botão para de dizer "Preparando…" durante
minutos de upload; a barra não inventa avanço (`preparando`=0, `finalizando`=100,
só `enviando` usa a medida real do XHR); e após 2min sem byte a tela **avisa**
que parece parado **sem mandar recarregar** — porque mandar recarregar no meio
de um upload que ia se resolver é exatamente o estrago do #289.

## 4. O que subiu — e a prova do desfecho

Merge **`1ba71a5`** na `main` às **23:44:39Z**. **Deploy Frontend (production)**
run `34067735535` = **SUCCESS às 23:47:26Z**, conclusão lida na API, não
presumida.

**Limite do que verifiquei, dito na cara:** conferi merge na main + deploy
SUCCESS no sha exato + testes verdes. **Não abri a tela logada em produção pra
ver o painel com o olho.** A tela é gated por login e a invariante está coberta
por teste, mas "deploy verde" não é "vi funcionando".

## 5. A aluna que pagou o preço no intervalo

`hellengrasso@gmail.com` (`21c7f520`) — **nenhum incidente a cobria**. Conta de
05/09, acesso até 12/09, 95.375 créditos. Voz `9bb9fccf` de 06/09 20:26:
`rejected_too_short`, **2 de 7 arquivos chegaram**, 415s (~6min).

Pagante confirmada no `pagou_de_verdade`: **R$597 Sistema de Geração Pronto** +
47,94 GBP Fábrica de Conteúdo Invisível, ambos APPROVED em 05/09.

A mensagem que ela recebeu **está correta** — é a versão já curada pelo #72/PR
#53: diz 2 de 7, diz que mesmo os 7 dariam ~19min contra o piso de 20min, diz
que a perda foi nossa e diz que nada foi cobrado. **A cura do #72 está
funcionando** — registro isso porque cura antiga que segue certa também é
resultado.

**O achado que vale mais que o defeito de tela, pra ela:** ela comprou o SGP
(R$597), onde a **equipe** monta o clone — e **nunca abriu o pedido**
(`sgp_pedidos` por e-mail e por `user_id` devolve **zero linha**). Pagou pra não
precisar fazer, e estava fazendo sozinha, no caminho que quebrou.

Escrevi pra ela (Sent **uid 1182**, cópia **CONFIRMADA**): o que houve, que a
tentativa não cobrou crédito, que a tela foi corrigida hoje, e o portal `/sgp`
que ela já pagou. **Não decidi nada comercial** — não afirmei o que o SGP dá
direito na plataforma nem toquei em acesso, plano, crédito ou entitlement. Essa
é a mesma pergunta do #246 e continua sendo do Johnny.

## 6. Achado de lado, anotado sem assumir o card (#290)

A `hellengrasso` recebeu o e-mail com o parágrafo do `#290` ("NÃO inclui a
assinatura da plataforma FastCloner", Sent uid 1060) e **não está** em
`affected_emails`. O card mediu "os 8 que nunca logaram" — mas *nunca logou* é o
subconjunto **pior**, não a população **afetada**.

Ressalva honesta, pra não inflar número de ninguém: a linha de assinatura dela
sai **0 GBP APPROVED** com acesso de 7 dias, que lê como **trial** — então ela
pode legitimamente estar fora de "15 assinantes ativos". **Não decidi qual
leitura vale**; deixei anotado que quem fechar o card precisa escolher
explicitamente entre "recebeu", "recebeu e paga" e "recebeu, paga e nunca
logou", porque hoje o card mistura as três e a lista gravada é a mais estreita.
Fechar pela mais estreita é o padrão do #137 outra vez.

## 7. O que eu NÃO fiz

Não gastei GPU, não iniciei treino de ninguém, não mexi em crédito, acesso,
plano ou entitlement, não apliquei migration, não escrevi pra aluno em lote, não
reabri incidente e não toquei em **nada** da planilha (ordem de 29/08).

## 8. Precisa de DECISÃO do Johnny

Seguem de antes, nada novo meu: **migration 82** destrava o **#15** (e a 96 e a
106 estão no mesmo bolo — 8 colunas que o código já escreve e o banco não tem,
telemetria que *parece* ligada e grava zero); **#226** é decisão de produto e
destrava o **#234**; **#222** depende de resposta dos alunos, já escritos;
**#246/#290** é a pergunta comercial do que a avulsa dá direito. Relógios:
**Diego 08/09 12hZ**, **Marcelo 11/09**, **13/09** para os dois do #290.

⚠️ **O gargalo segue sendo a fila de PRs: 28 abertos**, o mais velho de **18/08**.
Baixou 1 hoje. Nesse ritmo a fila cresce mais rápido do que eu mergeio, e cada
PR parado é um defeito que continua cobrando de aluno — como este cobrou da
Hellen 5h depois do card dizer "resolvido".

## 9. As lições

**Fechar o card antes de mergear o fix é fechar sem fechar.** O #289 virou
`fixed` às 18:26 e o PR que o consertava nasceu às 18:38. Nenhuma das duas ações
foi errada isolada — o erro foi a ordem. Enquanto `resolved_commit` estiver
NULL, "fixed" está dizendo que alguém olhou, não que alguém consertou.

**"Nunca logou" não é a mesma pergunta que "foi afetado".** É tentador medir a
população pelo subconjunto que dói mais, porque ele é o mais fácil de defender.
Mas a lista que você grava vira a lista de quem será avisado — e aí o recorte
estreito deixa gente sem aviso *e* sem rastro.

**Aluno pagante às vezes está travado no caminho errado, não no defeito.** A
Hellen ia ficar lutando com o upload que a gente acabou de consertar, quando o
que ela comprou por R$597 foi justamente **não precisar fazer isso**. Consertar
o defeito era necessário e não bastava: o `sgp_pedidos` vazio dizia mais sobre o
problema dela do que a voz rejeitada.
