# Rotina das Falhas — 28/08/2026, ~23h UTC (dono da fila)

Abertura: `git checkout main && git pull --ff-only origin main` → já atualizado,
árvore limpa. Índice de ordens lido antes de tocar em qualquer coisa. Ordens
aplicadas: `2026-08-20_dono_da_fila_e_fila_zerada.md` (14-A + armadilhas
medidas), `2026-08-27_vigia_so_erro_de_sistema.md` (14-C), regra 8 de 21/08
(serial + e-mail individual sem pedir permissão) e regra 7 (só fato consumado
no grupo).

Ronda anterior das falhas: 21h UTC. Vigia: 22h UTC.

---

## Placar

| | |
|---|---|
| Incidentes fora de `fixed`/`ignored` na abertura | 3 |
| Aluno para quem escrevi | **1** — Rodrigo (`#167`) |
| Incidentes que abri | **0** |
| Incidentes que anotei | **3** — `#167`, `#168`, `#153` |
| Incidentes que fechei | **0** novos (o `#167` já estava `fixed`; o que fiz foi **dar a ele uma resolução de verdade**) |
| **Código na main** | **PR #96 → `db03c98`**, deploy `33218251924` **SUCCESS** em 2m41s (22:52Z) |
| Crédito que toquei | **nenhum** |
| GPU/retreino que disparei | **nenhum** |
| Migration | **nenhuma** |

---

## 1. A escolha do serial, declarada

Régua da regra 8: *o mais antigo com aluno afetado; empate, mais gente
sofrendo*. Fila com 3 abertos, percorrida por idade **conferindo o estado atual
antes de descartar** (passo 1 do manual):

| candidato | idade | por que não / por que sim |
|---|---|---|
| `#133` | 3,2 d | **Saiu do meu colo.** E-mail à Giovanna mandado hoje 20:47Z pela ronda das 21h; o que resta são os 30.000 de cortesia, acima do meu teto, decisão do Johnny. Esperar resposta de aluno não é estar travado. |
| `#153` | 1,4 d | Aberto. A causa central (parar de re-fechar) é decisão do Johnny, já escalada 3×; pela regra 27 não escalo a quarta. **Mas ele apontou pro caso vivo** — ver abaixo. |
| `#176` | 0,2 d | Mais novo, e ninguém sem resposta agora. |

**Peguei o `#167`**, que a varredura acusou no bloco *"fechado em cima do
próprio disparo e ninguém voltou"*: 6ª ocorrência às **22:23:12Z**, fechada
**22:23:13Z** — 1,3 s — última **há 20 minutos** quando a ronda abriu. É a
classe do `#153` com gente escrevendo agora. Prioridade da ordem: aluno
esperando vem antes da limpeza da fila.

## 2. `#167` — não era limite da plataforma, era omissão do manual

**Rodrigo Silva, `braboblindagem@gmail.com`.** Pagante, conta de 27/08, acesso
até 03/09, **84.415 créditos**. Conta inteira sã: 1 voz `ready`, 4 áudios
`ready`, 5 imagens `ready`, 1 clone `ready`. Nada travado, nada quebrado.

Ele pediu **cinco vezes**, desde 17:05Z, um react apontando o dedo pra cima,
sem falar, de 3 a 7 segundos — e disse que tinha **visto o Lucas fazendo**.

O que a casa respondeu, cru do `help_messages`:

| hora | o que a Fast disse |
|---|---|
| 21:58:45Z | *"esse tipo de react detalhado que você viu o Lucas fazer provavelmente usa **outras ferramentas** (tipo HeyGen, D-ID ou edição de vídeo tradicional)"* |
| 21:59:59Z | *"pode ser outra ferramenta que a galera do curso usa"* |
| 22:23:14Z | *"pelo manual que tenho, o Vídeo Clone não tem campo de prompt pra descrever gestos"* |

O `pathname` das mensagens dele é **`/app/images`** — a tela onde fica o botão
**Animar**. Cliente pagante mandado pra concorrência estando na tela certa.
Última frase dele, 22:23:02Z: *"o suporte não respode"*.

### O recurso existe e faz exatamente o que ele pediu

`POST /api/v1/images/[id]/video` aceita **`prompt_pt` de movimento em texto
livre**, até 2.000 chars, traduzido por Haiku antes de ir ao modelo —
`images/[id]/video/route.ts:66-71`. Clipe de **4 s, 9:16, 720p**
(`lib/video/tiers.ts:66-67`), Bronze 1.320 · Prata 7.900 · Gold 9.000
(`tiers.ts:32-62`). UI: painel `components/image/image-animate.tsx`. Com 84.415
créditos, ele podia ter feito de manhã.

### O que eu conferi antes de acusar (14-C §3)

A parte da resposta sobre o **Vídeo Clone estava certa**: ele não faz gesto
mesmo — `video-clone/route.ts:85-102` aceita só `image_key`,
`image_generation_id`, `audio_key`, `generation_id` e `tier`, sem campo de
prompt. **O defeito não é mentira sobre o clone, é omissão**: o manual da Fast
tinha as duas seções separadas e **nunca as ligava**, então ela lia "não dá" e
parava. Meia verdade que na prática funciona como "a casa não faz".

### Dinheiro: conferido pela régua certa, nada a devolver

Por **`ref_type`**, nunca por `kind` (armadilha de 20/08): o ledger dele
**não tem nenhuma linha de estorno** — nem `generation_refund`, nem
`support_refund`. O clone `d7935234` está `ready` e foi cobrado **−1.760** em
`ref_type=video_clone` às 14:41:44Z, que é **80 cr/s × 22 s exatos**. Cobrança
certa, nada pendente.

**E aí apareceu um segundo fato inventado:** às 15:33:28Z a Fast escreveu a ele
*"Os créditos já voltaram automaticamente (2.310 cr)"*. **Não voltaram e não era
pra voltar** — o vídeo foi entregue. O número 2.310 não existe em lugar nenhum
na conta dele. Escrevi isso pra ele em vez de deixar descobrir sozinho.

### O e-mail

**22:47:13Z, conferido em Enviados uid 299.** Endereço batido contra `profiles`
**e** `affected_emails` antes de mandar (armadilha do Cláudio Sityá). Ensaiado
em `--dry-run` e lido inteiro antes de sair. Bcc `suporte@`.

Conteúdo: o caminho do Animar passo a passo; os custos dos 3 tiers com o saldo
dele do lado; a orientação de começar pelo **Bronze** pra testar barato; a
divisão entre as duas ferramentas (react com gesto → Animar; ele falando →
Vídeo Clone); e o que **realmente** não existe (picture-in-picture, que ele
também pediu — aí a negativa é verdadeira). **Não prometi** que o modelo acerta
o gesto de primeira: ele interpreta o texto. Ofereci **um** clipe por conta da
casa se o primeiro sair fora do que ele descreveu — **condicionado a ele pedir**,
nada de GPU sem pedido.

## 3. A causa, corrigida em produção — PR #96 (`db03c98`)

Só texto do system prompt, em `frontend/src/lib/agent/manual.ts`. Nenhuma rota,
nenhum schema, nenhuma migration, nenhum crédito. O arquivo vai inteiro no
prompt do **chat** (`brain.ts:7`) **e** do **e-mail** (`mail-respond.ts`) — os
dois canais pegam a correção.

1. **Seção `Animar imagem`**: declara que é a única ferramenta da casa com
   prompt de movimento e a resposta certa pra gesto/react/expressão; os números
   (4 s, 9:16, 720p, sem fala, imagem do histórico do Gerador); começar pelo
   Bronze; o modelo **interpreta** o texto, não prometer acerto de primeira;
   **proíbe** mandar pra ferramenta de fora por causa de gesto; e registra que
   picture-in-picture não existe.
2. **Bloco `LIMITE DO LIP-SYNC`**: mantém a limitação (é verdade e continua
   tendo que ser dita com todas as letras) mas **obriga a segunda metade da
   frase** — react com gesto e sem fala → Animar imagem.

**Como conferi, e onde eu não parei (14-B: "tsc verde não é revisão"):**
`npx tsc --noEmit` verde, **e** renderizei `buildAgentSystem()` e **li o trecho
na saída** (17.170 chars) pra garantir que o texto novo não quebrou o template
literal nem deixou `${}` cru vazando. Conferi também que não briga com a regra 2
do próprio manual (`linha 243`, "outras ferramentas não é seu assunto"):
reforça, não contradiz.

## 4. O que isto muda na leitura do `#153` (anotado lá)

Até hoje o `#153` media *"o chamado fecha e ninguém do lado humano volta"*, e o
Vigia refinou às 16h para *"a promessa de retorno humano fica sem dono"*.

O `#167` mostra um **terceiro modo, e o mais caro**: **o aluno foi respondido,
duas vezes, e as duas respostas estavam erradas** — e o auto-fechamento garantiu
que ninguém revisasse. Uma das duas foi **minha**, o e-mail das 19:54Z (uid 288).

Por que isso importa: enquanto o padrão era "aluno sem resposta", a métrica de
saúde possível era *"alguém respondeu?"*. **Este caso passa nessa métrica** — e
mesmo assim o aluno terminou o dia escrevendo "o suporte não responde". Fechar
em 1,3 s não remove só o dono da resposta: **remove o dono da conferência da
resposta**.

Não fecho o `#153` (regra 14): o comportamento de re-fechar continua igual
(`entregar.ts:73-118` fecha; `help/route.ts:151-158` não fecha e reabre). É
decisão do Johnny, normatizada em 24/08 e já escalada 3× — pela regra 27 não
escalo a quarta, registro a evidência nova e paro.

## 5. Correção de um fechamento MEU (`#168`)

Eu fechei o `#168` às 19:54Z com *"queixa = gesto = limite do lip-sync, não
bug"* e mandei o e-mail com essa conclusão. **Estava pela metade**, e a metade
que faltou era a que resolvia o problema dele. O aluno voltou a escrever **duas
vezes** depois daquele e-mail — o fechamento não segurou porque a resposta não
servia, não porque ele fosse teimoso.

**A lição, escrita no chamado pra não repetir:** eu confirmei a limitação no
arquivo que gera o vídeo e fechei. Não perguntei *"então QUAL ferramenta da casa
faz isso?"*. **Confirmar que o caminho A não serve não é responder à pergunta do
aluno.** Quando a queixa é "quero fazer X", a investigação só acaba quando eu
varri o produto atrás de X — não quando provei que o lugar onde ele estava não
faz.

## 6. Processo: o grupo continua mudo nesta máquina

`avisar_grupo.cjs` depende de `WAHA_API_URL`/`WAHA_API_KEY`, que não existem
aqui (WAHA roda em `127.0.0.1` no servidor). É a **quarta** ocorrência hoje
(Vigia 18h, rondas 19h40 e 21h, esta). Os fatos consumados desta ronda **não
chegaram ao grupo por lá**; foram por Telegram. Não digo que avisei no grupo,
porque não avisei. Pela 14-C isto é **processo**: 1 linha aqui + Telegram, sem
chamado.

---

## Pro Johnny — o que é decisão dele

1. **Os 30.000 da Giovanna** (`#133`) seguem pendentes, acima do meu teto.
   Único motivo daquele chamado continuar aberto.
2. **A decisão do `#153`** (parar de re-fechar quando já houve entrega
   anterior) segue sem resposta desde 24/08. A evidência acumulada agora tem:
   1 chargeback (`#154`, 27/08) **e** um pagante ativo que recebeu duas
   respostas erradas sem ninguém conferir (`#167`, hoje).
3. **Vale uma varredura do mesmo tipo de omissão no manual.** O defeito de hoje
   não foi a Fast inventar (isso foi o `#175`/`#178`) — foi ela **saber metade**.
   Provavelmente há outros pares "ferramenta A não faz X / ferramenta B faz X"
   sem referência cruzada. Se ele quiser, na próxima ronda eu mapeio.

## O que eu NÃO fiz

- Não gastei GPU, não disparei retreino, não cobrei nem devolvi crédito de
  ninguém.
- Não apliquei migration.
- Não abri chamado novo: a classe já estava aberta no `#153` (14-C §3.1) e a
  queixa do aluno já tinha os `#167`/`#168`.
- Não li a caixa do `suporte@` pra triagem; só `--enviados --para` no endereço
  do Rodrigo, do caso que eu estava tratando.

---

## Fim de ronda — conferência fixa

```
git fetch origin
git log --oneline origin/main..HEAD   → VAZIO
git rev-parse --abbrev-ref HEAD       → main
git status --short                    → limpo
git branch / git rev-list main..<br>  → nenhum fix preso em branch
```

O código desta ronda foi por **branch `fix/` + PR com base `main`** (PR #96),
**mergeado** (`db03c98`) e com deploy conferido — não ficou preso em branch,
que foi o risco de 19/08. Este log vai **direto na `main`**.
