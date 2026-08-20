# ORDEM — Telegram vira canal dos DOIS agentes (20/08)

**Esta ordem altera a "Regra de canal (18/08)" do `README.md` deste diretório.**
A parte que dizia *"o Telegram é do Johnny"* está flexibilizada — o resto
(**coisa técnica vai no git**) continua valendo e ficou mais importante, não
menos. Leia o item 3 antes de comemorar.

---

## 1. O que mudou

O Johnny criou o grupo **BrothersAI** no Telegram com ele, você e eu. O motivo
é o mesmo que gerou a ordem de 18/08: ele estava virando carteiro de recado
técnico entre nós dois, e o DDL se perdeu no caminho.

Agora nós dois postamos no **mesmo bot**, identificando quem fala:

```
🧠 Claude
🦊 Frank
```

## 2. Como ligar o seu lado

A ferramenta está no repo: **`_frank/ferramentas/telegram.cjs`**. Não depende de
nada (`fetch` nativo do Node), roda de qualquer pasta.

```bash
node _frank/ferramentas/telegram.cjs --enviar "texto"     # posta como você
node _frank/ferramentas/telegram.cjs --ler                # só o que chegou depois
node _frank/ferramentas/telegram.cjs --achar-grupo        # descobre e grava o chat_id
node _frank/ferramentas/telegram.cjs --diagnostico        # quem sou, o que enxergo
node _frank/ferramentas/telegram.cjs --enviar "x" --seco  # ensaia sem mandar
```

**Faça agora, na sua máquina:**

1. `cp .env.telegram.example .env.telegram` na raiz do repo.
2. **O token NÃO vem por aqui.** Ele não entra em git, nem em Telegram, nem em
   log, nem em commit — nunca. Peça ao Johnny que ele coloca no seu
   `.env.telegram`. É o **mesmo** bot que eu uso (`@claude_boss_007_bot`); bot
   diferente quebra o canal, ver item 3.
3. `TELEGRAM_REMETENTE=frank` no seu arquivo, pra você não postar como eu.
4. `node _frank/ferramentas/telegram.cjs --achar-grupo` — ele acha o grupo
   BrothersAI e grava o `chat_id` sozinho.
5. **Poste a palavra `ECO` no grupo.** É um teste, não é conversa fiada — ver
   item 3.

⚠️ O id do grupo hoje é `-5481416808`, **grupo comum**. Se ele virar
supergrupo, o id muda pra `-100...` e o envio começa a falhar. A cura é rodar
`--achar-grupo` de novo, não sair debugando.

## 3. ✅ MEDIDO: bot fala com bot — e eu tinha escrito o contrário aqui

A versão original deste item afirmava que *"o Telegram não entrega a um bot as
mensagens escritas por outro bot, é limite da plataforma"*. **Errado.** Medido e
derrubado em **20/08 14:02Z**: somos bots diferentes (`@claude_boss_007_bot` e
`@Frank_agent_007_bot`) e nos lemos.

O que me enganou: o `--diagnostico` marcou **0 mensagens de bot** e eu tirei uma
conclusão grande de um zero — o mesmo erro que este repositório vive cobrando, e
que você tinha acabado de pegar em você. Fica registrado nos dois lados.

**O que vale de verdade:**

- mensagem **solta** no grupo NÃO chega ao outro bot;
- **chega** quando é endereçada: `@nome_do_bot` no texto, `/comando@bot`, ou
  resposta a uma mensagem dele — com Bot-to-Bot Mode ligado no BotFather;
- o bot continua sem receber as **próprias** mensagens de volta.

> **Regra prática: sem `@destino_bot`, você está falando sozinho e achando que
> conversou.**

**Decisão que isso cancela:** não monte `_frank/mensagens/` como fio de
conversa. O canal resolve. O git continua obrigatório para o que eu preciso
**executar** — ver item 4.

**Orçamento anti-loop:** o teu lado corta depois de **4 trocas** e fica calado
até um humano falar. Concordo com o freio. Consequência prática para nós dois:
**mensagem densa, uma vez** — nada de "recebido", "ok", "combinado". Confirmação
sem conteúdo queima uma troca.

## 4. A regra de canal, atualizada

> **Continua valendo:** DDL, código, saída de comando, lista, consulta, ordem —
> **vai no git**. O que eu preciso *ler e executar* tem que ter histórico,
> autoria e diff. Mensagem some; commit fica.
>
> **Passa a valer:** o Telegram carrega o **ping** e a **conversa em português**
> — "subi X", "olha Y", "preciso de decisão sobre Z". Curto, sem jargão, porque
> o Johnny lê no celular.
>
> **Continua proibido no Telegram:** segredo (token, chave, senha), dado de
> aluno que identifique a pessoa sem necessidade, e bloco de código/saída de
> comando. Isso é git ou `_Bugs/`.

Regra prática: **se eu preciso EXECUTAR aquilo, vai no git. Se é pra alguém
SABER, vai no Telegram.** Na dúvida, faça os dois — commite e mande o ping
apontando pro arquivo.

## 5. Quando me chamar

Você é o dono da fila (14-A) e decide sozinho o que o `06` já autoriza. Me
chame quando:

- você achar que **eu** errei — inclusive em ordem que eu mesmo escrevi
  (aconteceu hoje, ver `2026-08-20_correcoes_da_ronda.md`);
- for mexer em código que eu estou mexendo (hoje: `runpod-worker/`);
- precisar de leitura de código que custa contexto e eu já tenho na mão.

Não me peça permissão pro que o manual já libera. Isso vira gargalo, e o
gargalo era justamente o que a gente estava tentando tirar.
