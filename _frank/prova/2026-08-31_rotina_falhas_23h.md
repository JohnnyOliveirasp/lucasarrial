# Rotina das falhas — 31/08/2026, 23hZ

Método serial (regra 8). Peguei UM caso e levei até onde ele dava pra ir.
Ordens lidas antes de tocar em qualquer coisa: `README.md` do índice,
`2026-08-29_desligar_vigia_e_frank.md` (planilha desligada) e
`2026-08-27_vigia_so_erro_de_sistema.md`.

## Estado da fila ao começar

6 abertos (todos `investigating`, todos vindos da Fast), 3 `aguardando_aluno`,
2 itens presos na varredura. Nada da planilha foi lido, escrito ou reprocessado.

## O que eu NÃO peguei, e por quê

**Marcelo** (`marcelopersonalthe32@gmail.com`) aparece na varredura como alarme
vermelho: acesso vivo, 198.950 créditos, sem voz há 22 dias. **Já estava
resolvido** — é o caso mais comum e a primeira coisa que o playbook manda
conferir. Três e-mails (24, 27 e 29/08), o último documentando escuta manual em
8 pontos do arquivo: são mesmo duas pessoas (um homem perguntando, uma mulher
respondendo, ~45/55). Não é o detector errando. Crédito: os 10.000 do treino que
falhou foram estornados em 10/08 — conferido **por `ref_type`
(`voice_train_refund`), não por `kind`**, que grava `extra_purchase` e faria
parecer que ele não foi estornado. Não estornei de novo. Sem resposta dele desde
então: a bola é dele, não nossa. Não reabri e não escrevi de novo.

**Luanmarcal** (import quebrado 29/08): a causa é a planilha/onboarding antigo.
Fora do perímetro por ordem de 29/08. Não abri incidente, não reprocessei.

## O caso que eu peguei: #173

Mais antigo aberto com aluno afetado. O aluno pagou **R$ 2.391,00** (3 compras
avulsas APPROVED, 27/08) e o sistema o lia como "nunca pagou".

Isso já vinha trabalhado nas rondas anteriores: ele foi retratado por e-mail às
16:46Z e o instrumento interno foi consertado pelo PR #138. **Conferi que o
`c5955f7` está mesmo em `origin/main`** (`git branch -r --contains`), porque
nota dizendo "mergeado" não é prova de que está em produção.

### O buraco que ninguém tinha fechado

O #138 consertou `pagou_de_verdade.cjs` — **ferramenta nossa, de uso interno**.
Não tocou no manual da Fast, que é **quem conversa com o aluno**. E o manual
mandava, com todas as letras (`frontend/src/lib/agent/manual.ts:117-118`), ela
dizer:

> "não estou vendo nenhuma compra nem período de teste na sua conta"

…e chamava essa frase de **"diga a verdade"**.

Teste de bolso da ordem de 27/08 — *se o código estivesse certo, isso teria
acontecido?* **Não.** Logo é defeito de sistema, não atendimento. O bloco CONTA
DO ALUNO lê a nossa base (acesso/crédito do FastCloner) e é estruturalmente
**cego** para compra de CURSO na Hotmart, que é pagamento único. O manual manda
afirmar como fato uma coisa que a Fast não tem como enxergar — então ela repete.

**E repetiu depois da medição:** em 31/08 **14:45Z** escreveu a uma aluna *"você
não tem nenhuma cobrança com a gente. Nenhuma compra"* — R$ 185,61 pagos em
27/08. O #138 só subiu às 19:39Z, e de qualquer forma não cobria esse caminho.

População exposta, já medida na ronda das 18h: **370 pessoas** com conta, sem
acesso ativo, que pagaram só curso.

### O que eu fiz

**PR #141**, branch `feat/fast-nao-nega-compra-avulsa`, commit `5995031`.
A Fast passa a afirmar **só o que enxerga** ("nenhuma assinatura ativa nem
período de teste"), nunca nega compra, não pede comprovante ao aluno, acredita
nele e escala. A regra do trial-sem-prova continua inteira. `tsc --noEmit`
limpo. **Não mergeei** — código vai por PR.

> ⚠️ **Erro meu, registrado porque quase custou caro.** A 1ª versão do texto
> tinha **crase** no caminho do script, dentro de `PLATFORM_MANUAL`, que é
> template literal (linhas 42–323). Teria fechado a string e **quebrado o build
> de produção**. Peguei conferindo as crases antes do commit, e só então rodei o
> typecheck. Fica o aviso pra quem editar esse arquivo: nada de crase nem
> `${}` lá dentro.

## Escrituração corrigida: #99

Estava `investigating`; a nota de 29/08 17:51Z encerra dizendo *"STATUS
aguardando_aluno de propósito"*. **A mudança nunca chegou a gravar.** Não foi
reabertura por ocorrência nova: `last_seen_at` (28/08 23:55Z) é **anterior** à
própria nota. É a armadilha já documentada do update que afeta 0 linhas em
silêncio — desta vez deixando um caso resolvido ocupando vaga na fila por 2 dias.

Não aceitei a nota pela palavra dela: li a caixa. A última mensagem do aluno é
de 28/08 20:53 BRT; a nossa avaliação técnica saiu **depois**, em 29/08, e ele
não respondeu. `aguardando_aluno` é o estado honesto. Nada de código foi
consertado aqui e o status **não afirma** que foi.

## O que continua precisando de gente

**Uma decisão, que fecha seis chamados:** o que a compra de CURSO dá direito
dentro do FastCloner. Fecha #173, #196, #202, #205, #208 e #209, e define o que
dizer às outras 366 pessoas que ainda não reclamaram. R$ 7.644 em compras
aprovadas de gente parada na fila esperando isso. Levado ao grupo nesta ronda.

**Achado de produto (14-C, não virou chamado):** `config.ts:45` promete que o
rosto só degrada "em áudios longos (acima de ~40s)"; a degradação foi medida num
clipe de **6s**. Enquanto a cópia disser isso, o atendimento cai na explicação da
foto e sobra culpar o aluno. É decisão/copy, não defeito — vai pro grupo.

## O que eu não fiz

Não liberei acesso, não dei crédito, não estornei, não rodei import, não disparei
treino, não gastei GPU, não fiz migration, não mergeei em `main`, e não escrevi a
nenhum aluno — o do #173 já tinha sido retratado hoje com a informação de que não
precisa fazer mais nada; um segundo e-mail sem fato novo seria ruído.
