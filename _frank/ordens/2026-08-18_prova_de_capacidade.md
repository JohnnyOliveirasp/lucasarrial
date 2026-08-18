# ORDEM — Prova de capacidade (18/08)

O Johnny viaja em 24/08 e leva só um iPad. A partir daí **você é o único que
opera**. Antes disso ele precisa saber, com prova, o que você alcança sozinho
e o que vai travar com ele na estrada.

**Não responda "consigo".** Execute e cole a evidência: uma linha de saída
real, um id, um número, um código HTTP. "Consigo" não vale nada num relatório;
a saída do comando vale.

## Regras da prova

1. **Nada que gaste.** Nenhum treino, clone, geração, busca na Apify, chamada
   paga de LLM ou teste na chave HeyGen do Lucas. Tudo aqui é leitura ou ação
   reversível.
2. **Falha é resultado bom.** Se um bloco não passar, esse é o achado mais
   valioso da prova — é exatamente o que ia te travar dia 25 sem ninguém pra
   destravar. Reporte o erro exato, não uma versão suavizada.
3. **Não conserte no meio da prova.** Anote e siga. Consertar durante mistura
   o que funciona com o que você remendou na hora.
4. **Nenhum valor de credencial** no relatório. Só o nome da variável.

---

## A. Repositório e deploy

- [ ] `git pull` limpo e `git log --oneline -3` batendo com o GitHub.
- [ ] Criar branch, commitar arquivo bobo em `_Bugs/`, push da **branch**
      (não da main), e apagar a branch depois. Prova que a regra 5 é
      executável por você.
- [ ] `gh run list --limit 3` — você enxerga o resultado das Actions?
- [ ] Diga qual foi o **último deploy verde** e a que horas.
- [ ] `gh auth status` — o token tem escopo pra ler Actions, não só `repo`?

## B. Banco (Supabase)

- [ ] Ler: contar linhas de `profiles`, `voices`, `incidents`.
- [ ] Escrever num campo permitido: mude e devolva `resolution_note` de um
      incidente **já fechado**. Prova que o service role escreve.
- [ ] Confirme que **não** consegue rodar DDL pela API (`CREATE TABLE`) — se
      conseguir, me diga, porque muda a conversa sobre migration.
- [ ] Liste as migrations em `scripts/*.sql` e diga **qual é a próxima**.
      (Deve ser a `79` — a última é `78_react_legenda.sql`.)
- [ ] Diga **como** uma migration é aplicada hoje neste projeto. Se você não
      encontrar o procedimento escrito, diga isso com todas as letras: é um
      buraco de operação, não uma pergunta boba.

## C. Servidor (Hetzner)

- [ ] `ssh root@91.99.15.213 "echo ok"`.
- [ ] `pm2 list` — o `aiverse` está `online`? Há quanto tempo? Quantos
      restarts?
- [ ] `pm2 logs aiverse --lines 30` — cole as 3 últimas linhas.
- [ ] `df -h` — quanto resta em `/` e em `/mnt/volume`? (O disco raiz já
      esteve quase cheio.)
- [ ] Confirme que o `.env.local` de produção existe e **quantas** variáveis
      tem. Só a contagem.

## D. Crons — bloco que o Johnny pediu explicitamente

- [ ] `crontab -l` no Hetzner: **liste todas as entradas**, com horário e o
      que cada uma chama.
- [ ] Pra **cada** cron, responda: rodou nas últimas 24h? Como você sabe?
      (Log, `agent_state.last_run`, linha nova no banco — diga a fonte.)
- [ ] Cruze com o que o código espera existir: `sweep-clones`, `mail-sweep`,
      `winback-sweep`, `social/sweep`, `orphan-invites`, `health-report`.
      **Existe rota sem cron? Existe cron chamando rota que não existe mais?**
- [ ] Dispare **um** sweep na mão com `x-agent-token` e mostre a resposta.
- [ ] ⚠️ Um cron que morreu em silêncio é o item 6 do vigia noturno. Se você
      achar um morto **agora**, ele não espera a Onda 1 — conserta hoje.

## E. RunPod

- [ ] `GET /v2/<id>/health` nos **três** endpoints do `02_ACESSOS.md`. Cole
      workers idle/running/throttled de cada um.
- [ ] Soma dos workers configurados — cabe na cota de 20 da conta?
- [ ] Saldo/gasto da conta, se a API devolver.
- [ ] **Não crie, não recrie, não redimensione nada.** Só leitura.

## F. Armazenamento (R2)

- [ ] Listar os primeiros objetos de `R2_BUCKET_VOICES` e do bucket
      `voices-clone-ai-verse`.
- [ ] Fazer um **HEAD** num objeto que você sabe que existe (pegue o caminho
      de uma linha de `voices`) e mostrar o tamanho.
- [ ] Gerar uma URL assinada e confirmar que ela abre (HTTP 200).
- [ ] **Nada de PUT nem DELETE.**

## G. E-mail

- [ ] Rodar `ferramentas/enviar_email.cjs` mandando **pra você mesmo**
      (`suporte@`), assunto `[PROVA] Frank`. Confirme que chegou.
- [ ] Confirme que sai como **FastCloner** pelo SMTP 587, não como
      "AI Clone Verse" pelo Resend (regra 10).
- [ ] Confirme que `AGENT_MAIL_ENABLED` **continua fora** da sua cópia.
      Se estiver lá, pare tudo e me avise: dois agentes respondendo a mesma
      caixa é resposta duplicada na cara do aluno.
- [ ] **Não leia a caixa de entrada** — a Fast lê a cada 5 min e vocês dois
      lendo em paralelo se atropelam.

## H. Incidentes

- [ ] Listar os abertos com idade de cada um.
- [ ] Abrir um incidente de teste, mudar pra `investigating`, fechar como
      `ignored` com nota dizendo que foi teste. Prova o ciclo inteiro.
- [ ] Confirme que o `health-report` responde com o `x-agent-token`.

## I. As suas ferramentas

Rode **todas** as sete de `_frank/ferramentas/` e diga, uma por uma, se
funcionou:

- [ ] `varredura_travados.cjs`
- [ ] `aluno.cjs <email>` (use um aluno real qualquer)
- [ ] `resgatar_voz.cjs` — **modo seco**, sem resgatar de verdade
- [ ] `consertar_referencia.cjs` — modo seco
- [ ] `limpar_fantasmas.cjs` — modo seco
- [ ] `enviar_email.cjs` (já coberto no bloco G)
- [ ] `enviar_email.sh` no servidor

⚠️ Se alguma não tiver modo seco, **isso é um achado**: ferramenta destrutiva
sem ensaio é acidente esperando acontecer. Diga quais não têm.

## J. Provedores externos (só o mínimo que prova acesso)

Uma chamada barata ou gratuita em cada, só pra saber se a chave responde —
e diga o custo de cada uma antes de rodar:

- [ ] Gemini · OpenAI · DeepSeek · Kie — a chave autentica?
- [ ] Apify — **só saldo/conta**, nenhuma busca (o ciclo renova 20/08).
- [ ] Hotmart e Stripe — leitura apenas.
- [ ] HeyGen do Lucas — **nem autenticação**. Não toque.

## K. Build

- [ ] `npx tsc --noEmit` na `frontend/` — passa? Quanto demora?
- [ ] `npx eslint` num arquivo qualquer.
- [ ] Confirme que **não** precisa rodar `npm install` (se precisar, diga —
      e lembre do protocolo de 7 dias do `CLAUDE.md` da raiz).

## L. A sua frota

- [ ] Quais agentes você tem, e qual modelo cada um usa?
- [ ] Prove delegação ponta a ponta: mande um agente simples fazer uma
      consulta e devolver o resultado pra você.
- [ ] Quantos cards em paralelo você aguenta sem se atrapalhar?
- [ ] **Se você cair no meio da noite, quem reinicia você?** Se a resposta é
      "ninguém", diga — é a pergunta mais importante desta prova inteira.

---

## Formato do relatório

Uma tabela, um bloco por linha:

| Bloco | Status | Evidência |
|---|---|---|
| A. Repo | ✅ | último deploy verde 18/08 14:02, run #1234 |
| D. Crons | ⚠️ | 4 crons, `winback-sweep` sem execução há 6 dias |

Legenda: ✅ funciona · ⚠️ funciona com ressalva · ❌ não consigo.

Depois da tabela, **três listas curtas**:

1. **O que vai me travar com o Johnny viajando** — o que é ❌ e não tem
   contorno. É a lista que ele mais precisa ler.
2. **O que tem contorno** — é ❌ ou ⚠️, mas você consegue por outro caminho.
   Diga qual caminho.
3. **O que eu descobri de quebrado** — coisa que a prova achou e ninguém
   sabia. O cron morto entra aqui.

---

## Pendências suas ainda em aberto

Você listou quatro coisas e o Johnny quer o status de cada uma. Responda uma
a uma, junto com a prova:

1. **Incidente da aluna pagante parada** — investigou? Qual playbook aplicou?
   Está fechado? Se ainda está aberto, **isso vem antes da prova**: aluna
   pagante parada não espera exame de capacidade.
2. **Varredura diária de manhã como rotina sua** — agendou? Onde ficou
   registrada (cron do servidor, rotina sua, as duas)? Como você prova amanhã
   que ela rodou? Concordo que é o buraco mais barato de tapar, e ela não
   depende do vigia noturno ficar pronto — **faz hoje**.
3. **Receita do sweep que bate no guard** — qual guard, qual sweep, e o que
   exatamente ele recusa? Consertou ou ainda está batendo? Se mexeu no código,
   qual commit.
4. **Vigia noturno** — a espinha andou? Já tem o DDL das `night_watch_*` pra
   revisão? (Lembre: é a migration **79**.)
