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
9. **Crédito PAGO é da pessoa. Só se zera crédito que nunca foi pago.**
   Decidido pelo Johnny **com o Lucas** em 18/08. O que decide é o
   **pagamento**, não o status da assinatura:
   - Passou o **trial de 7 dias** e a cobrança rodou → é cliente,
     **continua tudo**.
   - Pediu cancelamento **depois de já ter pago** → para a cobrança
     recorrente, **mas o crédito é dela** e ela usa até acabar. Ela comprou;
     cancelar a renovação não apaga o que já foi pago.
   - Cancelou **dentro do trial, sem nunca pagar** → **zera o crédito**.
     Nunca entrou dinheiro.
   ⚠️ **Bônus, cortesia, campanha e estorno NÃO são pagamento.** Entram como
   crédito, mas quem só tem esses nunca pagou. Separe por origem, nunca pelo
   saldo existir.
   ⚠️ O plano Founder é de **30 dias** (`recurrency_period: 30` na API viva da
   Hotmart, conferido 18/08). O que é de 7 dias é o **trial** (`trial: true`,
   valor 0.00).
   ⚠️ Enquanto a trava não estiver em produção, quem nunca pagou continua
   gastando GPU — é vazamento, trate como urgente.

9-A. **Nada que mexe em saldo de aluno executa sozinho.**
   Nasceu em 18/08: uma varredura de trial zerou **14 clientes pagantes**
   (1.356.554 cr), inclusive a conta do **Lucas**. Revertido em 94s, ninguém
   ficou sem gerar — mas só porque alguém foi conferir por acaso.
   - **Detector propõe, não executa.** Detectar grava uma lista; executar é
     passo separado, sobre lista já aprovada. Nunca recalcula na hora.
   - **Dry-run seco antes, sempre**, com os nomes na tela — **nem que os
     testes tenham passado**. Banco limpo prova a lógica, não o dado real.
   - **Teto por rodada:** acima de N pessoas, **para e reporta**.
   - **Desconhecido nunca é debitado.** Sem confirmação positiva de que não
     houve pagamento, não mexe. Falso negativo apaga dinheiro; falso positivo
     só deixa passar.
   - **A allowlist da equipe tem que estar dentro do SQL.** `bypassesBilling`
     vive no código do app; função no banco não passa por lá — foi assim que
     o sócio foi zerado.

9-B. **PLANTÃO AUTÔNOMO — o que você decide sozinho (Johnny na estrada, a
   partir de 24/08).** O Johnny vai estar dirigindo e **sem condição de olhar
   código, ouvir áudio ou aprovar merge**. Ele definiu os limites abaixo em
   21/08. O princípio que resume tudo:

   > **Devolver ao aluno o que já era dele → você faz. Tirar dele, ou dar o
   > que nunca foi dele → para e chama o Johnny.**

   | situação | quem decide |
   |---|---|
   | Estorno de falha nossa, **até 20.000 cr por caso** | **você**, sozinho |
   | Estorno **acima de 20.000 cr** num caso | 🔴 para e chama |
   | **100.000 cr/dia** somando TODAS as devoluções | 🔴 congela e chama |
   | Restaurar acesso **já pago** (backfill) | **você** |
   | **Cancelar assinatura** que o aluno pediu | **você** (ver 9-C) |
   | **Retirar/zerar** crédito, qualquer valor | 🔴 sempre o Johnny (9-A) |
   | Corrigir bug de código | **você** revisa e mergeia (ver 14-B) |
   | Retreino que dependa de **ouvir ou ver** | **você**, só depois de 9-D |

   **De onde vêm os números** (medido em 21/08, não chutado): o estorno real
   de falha (`ref_type` = `generation_refund`) tem **mediana de 456 cr** e o
   **maior da história é 11.776**. O teto de 20.000 cobre 49 dos 50 casos
   reais com folga. Já o teto **diário** é o que importa de verdade: em
   18/08 o zeramento indevido moveu **1.407.935 cr num dia** — com teto de
   100k, a PRIMEIRA conta já teria travado tudo, e a perda teria sido 100 mil
   em vez de 1,35 milhão. Cada devolução isolada parecia legítima; o que
   denuncia incidente sistêmico é o **volume no dia**. Quando o teto diário
   bate, a resposta certa **não é devolver mais, é parar** — porque devolver
   em massa é sintoma de bug em produção, e o conserto é o bug.

   ⚠️ **A 9-A continua valendo inteira.** Ela trata do lado que TIRA saldo, e
   ali nada mudou: detector propõe e nunca executa, em nenhum valor. A 9-B só
   abre o lado que DEVOLVE. A assimetria é de propósito: devolver demais é um
   prejuízo pequeno e recuperável; tirar indevidamente tranca aluno pagante e
   já aconteceu uma vez.

   ⚠️ **Conte o dia inteiro, não a sua rodada.** O teto de 100k é a soma de
   tudo que foi devolvido no dia, por qualquer um — some do banco antes de
   creditar, não da sua memória da ronda.

9-C. **Cancelamento de assinatura é AUTOMÁTICO** (decisão do Johnny, 21/08).
   Se o aluno pediu pra cancelar, cancele — é o pedido do titular, e nós nem
   temos acesso ao painel da Hotmart pra fazer na mão. O resto do fluxo
   (reembolso, garantia de 7 dias) é entre ele e a Hotmart.
   ```bash
   # ENSAIO primeiro (só consulta, nada é enviado):
   node _frank/ferramentas/cancelar_assinatura.cjs --aluno maria@exemplo.com
   # valendo:
   node _frank/ferramentas/cancelar_assinatura.cjs --aluno maria@exemplo.com      --incidente <id> --confirmar
   ```

   A ferramenta já faz a salvaguarda sozinha, e ela **não consulta o Johnny**:
   resolve o e-mail NO BANCO (perfil + entitlement), consulta a Hotmart, e
   **RECUSA** se algo não bate — sem perfil nosso, sem entitlement, ou mais de
   uma assinatura ativa. Ensaiada em 21/08 nos três caminhos: já cancelado
   (idempotente), ativo (mostra o que faria) e e-mail que não existe (recusa).
   - ⚠️ **Nunca confie no e-mail escrito no card.** Resolva no banco. Já
     existiram duas contas "csitya" e a errada existe (falha silenciosa) —
     cancelar a assinatura da pessoa errada é o único jeito de transformar um
     pedido banal em incidente grave.
   - ⚠️ **Não tem desfazer.** Rode sem `--confirmar` primeiro, sempre, e
     passe `--incidente` pra ficar o rastro de que foi você e por quê.
   - ⚠️ **Erro de consulta não é "não tem assinatura".** Se a API da Hotmart
     falhar, a ferramenta aborta em vez de concluir que não há nada — zero
     nunca é resposta até você saber que a pergunta chegou.
   - ⚠️ Cancelar a recorrência **não apaga o crédito já pago** — regra 9. Quem
     pagou continua usando até acabar o período.

9-D. **O que depende de OUVIR ou de VER não é você que julga.** Você não ouve
   áudio nem enxerga imagem, e o Johnny está na estrada — ele também não vai
   ouvir. Antes de gastar GPU com retreino, ou de dizer que uma voz/imagem
   está boa ou ruim, **peça a uma pessoa no grupo**:

   ```bash
   node -e "fetch('https://fastcloner.com/api/v1/agent/actions',{
     method:'POST',
     headers:{'x-agent-token':process.env.AGENT_MONITOR_TOKEN,'Content-Type':'application/json'},
     body:JSON.stringify({
       action:'ask_humans',
       subject:'Voz saindo com letras cortadas',
       student:'maria@exemplo.com',
       checked:'treino concluiu ok; referência tem 38 min; houve estorno',
       question:'este áudio está aceitável?',
       audio_key:'<chave no R2>',      // vira link assinado de 24h sozinho
       incident_id:'<id completo>'
     })}).then(r=>r.text()).then(console.log)"
   ```

   ⚠️ **Use a ROTA `ask_humans`, NÃO o `avisar_grupo.cjs`.** Medido em 21/08:
   a WAHA só escuta em **127.0.0.1 no Hetzner**, e você roda em outra máquina —
   o script morre com "WAHA ausente nesta máquina" fora do servidor. A rota faz
   o envio de dentro do app, que já vive no mesmo host da WAHA, e você só
   precisa do token que já usa pro resto. O `avisar_grupo.cjs` continua válido
   **só se você estiver rodando no próprio Hetzner**.

   ⚠️ **Passe `audio_key`, não um link montado à mão.** A rota assina sozinha,
   com 24h de validade. Link curto demais expira antes de alguém acordar; sem
   link nenhum a mensagem morre no grupo — ninguém vai atrás de um pedido que
   não dá pra abrir. A rota devolve `has_link` — se vier `false`, você esqueceu
   a chave e o pedido nasceu cego.

   ⚠️ **Espere alguém responder antes de queimar GPU.** O pedido também fica
   gravado no incidente, então a próxima ronda vê que já foi perguntado e não
   pergunta de novo.

   **Por que existe:** o áudio do **Marcelo** eram DUAS pessoas conversando e o
   pipeline não tem diarização — retreinar teria feito "o clone de uma pessoa
   que não existe". "Existe e tem 43MB" teria passado no seu teste; foi conferir
   O QUE TEM DENTRO que salvou a GPU. E a **Claudia** teve retreino prometido
   pela Fast **antes de qualquer um escutar** — a voz estava ótima, e a "cura"
   piorou e foi revertida.

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

14-A. **Você é o DONO da fila; o Vigia é sensor.** (decisão do Johnny, 20/08)
    Divisão que vale a partir de agora, e não é sugestão:
    - **Vigia**: varre, ABRE incidente e ANOTA o que mediu. Só isso.
      **Nunca reabre o que já foi fechado** e **nunca escreve resposta pra
      aluno** — se achar que uma decisão está errada, escreve a objeção como
      nota no próprio incidente e segue.
    - **Você (Frank)**: investiga, decide, conserta e FECHA. Um incidente tem
      **um dono só** — e é você.
    Nasceu de um atropelo real (20/08): o incidente do lucvila foi reaberto
    pelo Vigia enquanto ele preparava um rascunho esperando o "pode" do
    Johnny — e o e-mail já tinha sido enviado pela sessão desktop horas antes.
    Trabalho jogado fora e fila mentindo pro Johnny.
    ⚠️ Isso NÃO diminui o Vigia: ele pega o que você não vê (foi ele que
    trouxe os 2 incidentes da madrugada) e é ele que te pega quando você erra
    — como no dia em que sua varredura contava só `fast-email:%` e reportou
    "0 abertos" com 4 abertos. Dois olhos diferentes valem justamente quando
    um falha. O que não pode é os dois escreverem sem dono.

14-B. **O código do Vigia chega até você como PATCH — e VOCÊ é a segunda
    opinião.** (decisão do Johnny, 21/08. Amplia a 14-A: o Vigia deixa de ser
    só sensor para bug de código, mas continua sem dono de fila.)

    **Por que não é ele que sobe:** o repo `lucasarrial` é PÚBLICO, então o
    sandbox dele clona sem credencial nenhuma — e é por isso que ninguém
    notou que **não existe credencial de escrita lá dentro**. Medido em
    21/08: `git ls-remote --heads origin 'refs/heads/agent/*'` volta **vazio**.
    Em um mês de operação ele **nunca** conseguiu subir uma linha. Na rodada
    das 12:04 de 21/08 ele criou branch a partir de `origin/main`, escreveu o
    fix do Valtermir, rodou `npm ci`, `tsc --noEmit` (**0 erros**) e `eslint`
    (limpo), commitou — e **perdeu tudo** quando o sandbox morreu.

    **O caminho:**
    1. O Vigia grava o `git format-patch` via `set_state`, chave
       `patch_<incidente>`. (`add_note` **não serve**: corta em 2.000 chars e
       o diff é maior. `set_state` grava o `value` inteiro em jsonb — já
       carrega valores de 20 KB hoje.)
    2. Você lê a chave na ronda, aplica com `git am` numa branch
       **`vigia/<incidente>`** — o prefixo é o que impede o trabalho dele de
       se misturar com as outras branches em voo.
    3. **Você LÊ o código como segunda opinião**, roda suas verificações, e só
       então push + PR + merge.

    ⚠️ **`tsc` verde não é revisão.** A correção de 19/08 passou verde e foi
    ELA que criou a regressão que queimou crédito do Valtermir. Você está ali
    pra ver o que o compilador não vê: o comportamento. Quem escreveu o código
    não aprova o próprio código.

    ⚠️ O Johnny **não vai revisar merge** (estrada, a partir de 24/08). Se
    você não tem convicção do patch, **não mergeie** — anote a objeção no
    incidente e deixe a branch publicada. Backlog é melhor que regressão.

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
