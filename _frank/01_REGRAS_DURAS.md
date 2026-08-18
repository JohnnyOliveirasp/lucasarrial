# 01 — Regras duras

Cada regra aqui nasceu de um prejuízo real. Não são preferências.

## Deploy

1. **Deploy é só `git push` na `main`.** O GitHub Action builda e manda pro
   Hetzner, e o pm2 reinicia sozinho. Leva ~3 minutos.
2. **NUNCA edite código direto no servidor por SSH.** O próximo deploy
   sobrescreve e o bug volta — parecendo assombração. SSH serve pra ler log,
   rodar script operacional e disparar sweep. Nada de `vim` em arquivo do app.
3. **nginx é manual.** Se precisar mexer, avise o Johnny antes.
4. Antes de commitar: `npx tsc --noEmit` **e** `npx eslint <arquivos>` na pasta
   `frontend/`. Código que não compila não sobe.
5. **Onde você commita depende do tamanho — o deploy é sempre o mesmo.**
   - **Urgência de aluno ou fix pequeno** → commit direto na `main`. Aluno
     travado não espera branch.
   - **Feature multi-card**, com vários agentes escrevendo em paralelo →
     branch `feat/<nome>`. Se cada pedaço cair solto na `main`, meia
     funcionalidade vai pra produção. **Você mesmo faz o merge** quando o
     *conjunto* passa em `tsc --noEmit` + `eslint`: não há humano esperando
     pra aprovar PR, e PR parado é código que não protege ninguém.
   - Nos dois casos, **o que dispara o deploy é a `main`**. A regra 1 não
     muda: nada chega no servidor por outro caminho.

## Dinheiro do aluno

6. **Falha nossa não se cobra.** Se o produto quebrou, o aluno não paga — e se
   já pagou, devolve (`add_extra_credits`). Regra explícita do Johnny.
7. **Nunca dispare treino/clone/imagem em nome do aluno sem que ele peça** —
   isso gasta crédito dele. Exceção: quando for compensação por erro nosso,
   e aí **sem cobrar**.
8. ⚠️ Se você rodar algo por conta da casa (sem débito) e aquilo falhar, o
   estorno automático credita mesmo assim — o aluno ganha crédito que nunca
   pagou. Ou você cobra normal, ou aceita esse efeito de propósito. Decida
   conscientemente e escreva no relatório.
9. **Crédito é o único portão.** Não invente bloqueio novo por assinatura,
   plano ou qualquer outra coisa.

## Falar com aluno

10. **E-mail pra aluno sai pelo SMTP do `suporte@fastcloner.com` (porta 587).**
    Pelo Resend chega como *"AI Clone Verse"* (domínio antigo) e queima a
    confiança — já aconteceu na frente de cliente.
11. **Nunca mande resposta genérica de FAQ pra quem já tentou o óbvio.** Olhe
    a conta ANTES de responder: créditos, acesso, últimas gerações, erros.
    Uma aluna explodiu em 17/08 exatamente por isso ("acha que eu não tentei
    isso antes?").
12. Diga **o que aconteceu de verdade**, inclusive quando a culpa é nossa.
    Nada de "instabilidade momentânea" pra encobrir bug.
13. **Nunca prometa prazo de retreino ou correção que você não controla.**

## Incidentes

14. Corrigiu de verdade → status **`fixed`** na hora, com `resolution_note` e o
    commit. Erro do próprio usuário → **`ignored`**. Nunca deixe "investigando"
    o que já acabou, e **nunca marque `fixed` sem ter resolvido** (a Fast fez
    isso com uma aluna que continuava zerada).

## Produção intocável

15. **Nunca recrie um endpoint do RunPod.** O volume de rede prende a região e
    o endpoint novo nasce sem os modelos. Endpoints atuais em `02_ACESSOS.md`.
16. **A chave HeyGen do Lucas é SÓ LEITURA.** Teste que consome crédito, quem
    roda é ele.
17. **Nunca apague lockfile** (`package-lock.json` etc.) nem instale pacote
    publicado há menos de 7 dias (proteção contra ataque de cadeia de
    suprimentos — protocolo completo no `CLAUDE.md` da raiz).
18. **Nunca comite `.env*`, chave, token ou senha.** Se precisar mostrar uma
    variável, mostre só o **nome**.

## Dados

19. **Antes de apagar ou sobrescrever qualquer coisa, olhe o que tem lá.**
    Apagar registro de aluno é irreversível.
20. Ao apagar linha "morta", confirme que ela é morta mesmo — em 18/08 quase
    apaguei vozes cujo áudio estava salvo, esperando resgate.
21. **Migration de banco precisa do aval do Johnny.** Ver `06_...LIMITES.md`.

## Código

22. Máximo **400 linhas por arquivo**. Passou disso, separe.
23. Comentário explica **por que**, não o que — de preferência contando o bug
    que originou aquilo (é assim que o próximo agente aprende).
24. Componente de UI: procure padrão pronto (shadcn/21st) antes de inventar.
25. Script operacional, dump, print e investigação vão pra **`_Bugs/`**
    (na raiz ou em `frontend/_Bugs/`), nunca soltos na árvore.
26. Mensagem de commit em português, no formato `tipo(escopo): o que mudou` +
    o **porquê** no corpo, terminando com:
    `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
