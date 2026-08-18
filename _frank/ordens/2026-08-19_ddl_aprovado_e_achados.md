# ORDEM — DDL aprovado (com uma condição) + os 4 achados

---

## 1. DDL: APROVADO, com uma condição que não é negociável

`scripts/79_profiles_ja_pagou.sql` está bem feito: aditivo, `IF NOT EXISTS`,
reversão escrita dentro do arquivo, índice parcial justificado, e o comentário
conta **por que** existe. É como uma migration deve ser.

### ⚠️ A condição: o `DEFAULT false` é uma bomba armada

`ja_pagou boolean NOT NULL DEFAULT false` faz **todo mundo nascer "nunca
pagou"** — inclusive os 400 alunos que pagam em dia. Enquanto o backfill não
rodar, a coluna diz que **ninguém** no sistema pagou.

**Se a trava do débito subir antes do backfill terminar, o produto inteiro
para pra todos os alunos ao mesmo tempo.**

Então, em ordem rígida:

1. Aplique a migration (só o schema). Nada quebra: nenhum código lê a coluna
   ainda.
2. Rode o backfill.
3. **Confira o resultado antes de qualquer trava**: quantos ficaram `true`,
   quantos `false`, e — o teste que decide — pegue **5 alunos que você sabe
   que pagam** e confirme que os 5 estão `true`. Se um só estiver `false`, o
   backfill está errado e a trava não sobe.
4. Só então o card da trava.

E ponha isso como comentário no próprio arquivo do backfill, não só aqui: quem
ler o SQL daqui a três meses precisa saber que a ordem importa.

### Uma coisa a mais no backfill

Você citou o `GET /sales/history` cruzado com `extra_purchase | stripe_session`
e disse que **ainda não mediu a taxa de casamento** por e-mail. **Meça antes
de rodar.** Se 10% não casarem, esses 10% viram "nunca pagou" por falha de
cruzamento, não por não terem pago — e aí a trava bloqueia cliente pagante.

Quem não casar **não pode virar `false` silenciosamente**. Ou fica com a
origem `manual_johnny` pendente, ou você traz a lista separada. Ausência de
prova não é prova de ausência.

## 2. Achado 4 (HD 404): real, mas o impacto está errado

Você escreveu: *"Qualquer geração roteada pro HD falha."*

**Não existe geração roteada pro HD.** `RUNPOD_ENDPOINT_INFINITETALK_HD_ID`
**não é lida por nenhum arquivo** do `frontend/src` — procurei em todo o
projeto, zero ocorrências. E o Johnny confirmou: **não existe mais HD em
produção; só o Padrão 2.0 e o Turbo.**

O que você achou é uma **variável órfã** no `.env` do servidor. Nenhum aluno
foi afetado, e não há decisão de RunPod a tomar.

**É o playbook M de novo, e agora vale ampliá-lo:** da primeira vez você achou
o `import` e concluiu bloqueio; agora achou a variável no ambiente e concluiu
roteamento. Mesmo erro, superfície diferente. **Variável existir no `.env` não
prova que alguém a lê** — o teste é um `grep` pelo nome dela no código, e ele
custa dez segundos.

**Acrescente isso ao playbook M** com este caso.

## 3. Os outros três achados

- **`sweep_winback` e `social` a cada minuto** — 1.440 chamadas/dia onde 288
  bastam. Você está certo, e não é fila de tempo real. Ver item 4.
- **`health-report` implantada e sem cron** — achado bom. Ela existe pro
  agente de monitoramento; se ninguém chama, ela é código morto **ou** falta o
  cron. Diga qual dos dois você acha que é, com base em quem deveria chamá-la.
- **Cron sem log próprio** — o mais importante dos três, e você viu isso
  sozinho: dá pra provar que disparou, nunca o que fez. É exatamente o buraco
  que o vigia noturno existe pra tapar, e reforça por que o relatório entra na
  espinha e não no fim.

**E a boa notícia é notícia:** nenhum cron morto, os 5 sweeps dispararam com
contagem batendo com a periodicidade. Isso é o oposto do que aconteceu com a
Fast em 08/08, quando ela ficou 2 dias muda e ninguém soube.

## 4. Autorizado mexer no servidor — as duas limpezas juntas

Você não precisa perguntar de novo pra estas duas:

- **Baixar `sweep_winback` e `social` de 1 min pra 5 min** no crontab.
- **Remover a variável órfã** `RUNPOD_ENDPOINT_INFINITETALK_HD_ID` do `.env`
  de produção.

⚠️ Regras: **faça uma de cada vez**, guarde uma cópia do crontab e da linha do
`.env` **antes** de mexer (é a única forma de desfazer), e confira depois que
o `aiverse` continua `online` e que os sweeps seguem disparando na próxima
janela. Se qualquer coisa estranhar, volte a cópia e me diga.

## 5. O `_Bugs` no `.gitignore` — você está certo e a ordem estava errada

Minha ordem mandou usar `_Bugs/<assunto>/` pro que não coubesse no projeto, e
isso não serve pra coisa que precisa ser **lida** por mim. Você percebeu e
moveu pro `_frank/prova/`. Certo.

Fica valendo: **`_Bugs/` é rascunho local** (dump, print, script de uma vez);
**`_frank/` é o que precisa ser lido** — ordem, prova, relatório, playbook.

## 6. Fila

1. Aplicar a migration (schema só).
2. Medir o casamento do `/sales/history` **antes** do backfill.
3. Backfill + a conferência dos 5 pagantes conhecidos.
4. As duas limpezas do item 4.
5. Ampliar o playbook M com o caso da variável órfã.
6. **Fechar a prova**: conta de teste, e as três perguntas do fim — sobretudo
   **quem te reinicia se você cair**.
7. Trial × venda, com o período do `BRL 847.018,43`.
