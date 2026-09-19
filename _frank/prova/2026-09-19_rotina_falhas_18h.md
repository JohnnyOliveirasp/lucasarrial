# RONDA DAS FALHAS — 19/09, ~18hZ

Dono da fila (14-A). Ronda anterior: `2026-09-19_rotina_falhas_17h.md`.

**Método serial (regra 8):** peguei **UM** cartão, o mais abandonado da lista
que a ronda das 17hZ deixou pronta, e o levei até o fim — fix, aluno avisado,
cartão fechado com nota.

**O achado desta ronda contradiz o da anterior, e é por isso que ele importa.**
As 17hZ mediram que 40 de 62 abertos já tinham carta enviada e concluíram, com
razão, que boa parte da fila é *contabilidade atrasada*. O primeiro cartão da
lista era o `#347`. Ele tinha carta. **E não estava resolvido.** A carta era de
**outro assunto**.

O instrumento das 17hZ não errou — ele avisa, em letras grandes, que entrega
**ordem de visita e não veredito**. Esta ronda é a prova de que aquele aviso não
era retórico: **1 de 1 visitado era falso positivo.**

---

## 0. Passo fixo — reconciliação dos envios (#101)

```
737 lidas da pasta "Sent" = 660 já tinham linha + 77 fora da janela + 0 escrituráveis
🕳️ cartas que saíram e não têm linha, DENTRO da janela: 0
```

Conferido com o irmão de leitura (`2026-09-18_enviados_x_tabela.cjs`),
instrumento independente: **0 carta depois do corte**, veredito "buraco é
PASSIVO".

Pasta **728 → 737** desde as 17hZ. As 9 do intervalo já nasceram com linha —
controle compensatório funcionando. O registro local segue inexistente nesta
máquina (`0 cartas`, é gitignored), que é exatamente a razão de a reconciliação
ler o IMAP e não o ledger.

As **77 anteriores a 14/09 14:06:31Z seguem sem decisão** — decisão de produção,
não de ronda, e eu não a tomei.

## 1. Estado da fila

| status | 17hZ | 18hZ |
|---|---|---|
| fixed | 288 | **289** |
| investigating | 84 | **83** |
| ignored | 60 | 60 |
| aguardando_aluno | 34 | 34 |
| open | 1 | 1 |

Total varrido 467, igual. O único movimento é meu: `#347`.

---

## 2. `#347` — a carta existia, e era de outro assunto

`c5d04972` · aberto **10/09 19:22:38Z** · **9 dias** parado · aluno **Raul
Schaefer Neto**, `raulcssavatar@gmail.com`.

### 2.1 O que o cartão realmente pedia

Não era bug. Veio do **formulário do SGP**: ele queria de volta **os áudios
originais que subiu para treinar a voz**. A nota do EXECUTOR (10/09 19:25)
acertou o diagnóstico e deixou o plano certo — achar as chaves no R2, assinar
GET, mandar por e-mail. **Ninguém executou o plano.**

### 2.2 Por que ficou escondido 9 dias

O cartão aparecia como "já respondido" nos instrumentos porque **havia** carta
ao aluno depois da abertura: uid **2312**, 14/09. Só que aquela carta é do
`#396`/`#397` e fala de **cota de API do HeyGen** — assunto que não tem nada a
ver com recuperar arquivo de treino.

É o contra-exemplo que a ronda das 17hZ previu e o segundo em dois dias (o
`#334` foi o primeiro). **Carta depois da abertura continua sendo indício, nunca
prova.**

Também achei **uma segunda nota vencida no minuto em que foi escrita**, no mesmo
padrão que as 17hZ registraram: a nota diz *"pessoa SEM login, então não adianta
responder pelo painel"*. A conta `781e219f` **existe desde 10/09 19:22** e a voz
ficou `ready` às **19:32** — dez minutos **depois** de o cartão nascer. O "sem
login" já era falso quando foi anotado.

### 2.3 O que eu medi antes de prometer qualquer coisa

| pergunta | resposta |
|---|---|
| os 9 caminhos de `raw_audio_paths` existem no R2? | **sim, 9/9** (HEAD em cada um, 0 sumido) |
| são 9 arquivos? | **não — 3.** Por ETag: um `.ogg` de WhatsApp gravado **5x**, e dois `.mp3` gravados **2x** cada |
| os links funcionam? | **sim, 3/3** — GET com range devolveu **HTTP 206** com bytes reais, testado antes de enviar |

A dedupe não é preciosismo: mandar 9 links para 3 arquivos faz o aluno baixar o
mesmo áudio cinco vezes e concluir que a casa se atrapalhou.

### 2.4 Entregue

Carta enviada 19/09, pasta Enviados uid **2911**, registrada em
`emails_enviados` (origem `ronda-manual`). Três links assinados de 7 dias, o
pedido de desculpas pelos 9 dias, e a explicação de por que são 3 e não 9.

Cartão **fixed** com `resolution_note` dizendo o que era e o que foi feito.
**Não** mexi na voz, **não** retreinei, **não** gastei crédito nem GPU — só
leitura.

### 2.5 Vão de produto registrado (não virou chamado)

**O aluno não tem como baixar os próprios áudios de treino.** A tela
`/app/voice-cloning/[id]` mostra só a **contagem** (`page.tsx:61-62`) e o
`GET /api/v1/voices/[id]` **promete no cabeçalho** *"presigned download URLs
onde aplicável"* e **não assina nada** — não há uma única chamada de presign no
arquivo. Ou seja: *"peça pelo painel"* é resposta falsa, o caminho não existe.
Enquanto não existir botão, a entrega é manual — e agora tem instrumento (§4).

---

## 3. `#396` — o item que faltava virou PR, e o cartão NÃO fechou

Ao apurar de onde vinha a carta do §2.2 caí no `#396`, irmão do `#397` (o Vigia
marcou em 14/09: mesma pessoa, mesma queixa, 53 min de diferença, responder uma
vez só). O plano do EXECUTOR tinha **3 itens**.

**Itens (1) e (3): feitos e no ar.** Commit `a7d1640b` (14/09). Conferido em três
camadas, nada herdado de nota:

| prova | resultado |
|---|---|
| `git merge-base --is-ancestor a7d1640b origin/main` | **SIM** |
| li o fonte | `heygen-connect.tsx` mostra `quota.raw` cru, pinta de vermelho em `<= 0` e tem bloco dizendo que **reconectar não resolve** |
| md5 no Hetzner **vs** `origin/main` (3 arquivos) | **idênticos** — `fb46d0df…`, `15246f36…`, `7299547f…` |
| BUILD_ID no servidor | `WWNUFDIavSz44diqsgzgW` |

**Item (2): estava inteiro, e é o perigoso.** `getRemainingQuota` coagia
qualquer resposta inesperada para `0`:

```ts
const raw = typeof data.remaining_quota === "number" ? data.remaining_quota : 0;
```

**`0` é indistinguível de "a cota acabou de verdade".** Basta o HeyGen mudar o
shape (ex.: mover o número para `details.api`) e a tela passa a mostrar, em
vermelho, *"sua cota chegou a zero, recarregue"* para quem está com a cota
cheia — mandando o aluno **gastar dinheiro à toa**, em silêncio, sem erro e sem
log.

Corrigido em **`c4ce2002`**, **PR #356** (base `main`): lê também `details.api`
e, em formato desconhecido, **falha explícito** com `CODIGO_SALDO_ILEGIVEL`.

**A armadilha dentro do conserto**, que quase reproduziu o bug por outro
caminho: `classifyHeygenError` decide por regex `/quota|credit|insufficient/`
sobre a **mensagem**, e qualquer texto honesto sobre saldo casa com ela — o erro
novo voltaria a ser classificado como "cota zerada". Por isso a checagem do
**código** vem **antes** da regex, com teste travando exatamente isso.

**Nenhuma mudança de UI foi necessária:** o `GET` já devolvia `raw: null` no
catch e a tela já renderizava *"não foi possível consultar agora"*. O backend é
que nunca produzia o `null`.

De brinde, `HeygenError` deixou de usar *parameter properties*: é sintaxe que o
type-stripping do Node recusa (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`), e por causa
dela `client.ts` era **impossível de importar num `node --test`** — o arquivo
era intestável pela própria convenção da casa.

Provas: **8 testes novos** passam, os **14** de `imagem-content-type` seguem
passando, `tsc --noEmit` limpo.

**O cartão continua `investigating`, de propósito.** O PR está **aberto**. Só a
main deploya — enquanto não mergear, não está em produção e marcar `fixed` seria
violar a regra 14. Ficou com nota dizendo exatamente isso.

⚠️ **Erro meu, registrado:** a primeira nota do `#396` foi gravada com o trecho
de código **vazio** — escrevi entre crases dentro de aspas duplas e o shell comeu
a expressão antes de chegar ao banco. Gravei nota de correção (notas
concatenam, não sobrescrevem). **Lição:** nota vai entre aspas **simples**.

---

## 4. Instrumento novo

`_frank/ferramentas/2026-09-19_links_do_treino_da_voz.cjs` — dado um e-mail,
acha a voz, dá **HEAD em cada caminho** (o banco listar não prova que o objeto
existe), **deduplica por ETag** e emite links assinados.

Somente leitura: lista, HEAD e assina GET. Não grava, não apaga, não treina, não
gasta crédito nem GPU. O `--dias` recusa acima de 7 em vez de gerar link morto
(limite do SigV4), e caminho sem objeto é listado à parte, para não se prometer
ao aluno o que não existe.

---

## 5. Fatos consumados desta ronda

1. **Reconciliação dos envios** — 737 = 737, 0 escrituráveis, conferida por
   instrumento independente.
2. **`#347` fechado** com entrega real ao aluno, não só diagnóstico.
3. **Uma carta a aluno** — Raul (`raulcssavatar@`), Enviados uid **2911**,
   registrada em `emails_enviados`.
4. **PR #356 aberto** (`c4ce2002`) fechando o item (2) do `#396`.
5. **`#396` anotado** com o que está em produção, o que falta e por que não
   fechou — mais a nota de correção do meu erro de gravação.
6. **Instrumento novo** `2026-09-19_links_do_treino_da_voz.cjs`.
7. **Duas linhas no grupo** — o fechamento e a carta.

## 6. O que eu NÃO fiz

- **Não fechei o `#396`** — PR aberto não é produção.
- **Não mergeei nada.** Os PRs **#351**, **#355** e agora **#356** seguem
  abertos; o `#355` continua esperando a decisão do Johnny.
- **Não escrevi segunda carta** para o Raul sobre o HeyGen: aquilo é o `#397`,
  já respondido e corretamente em `aguardando_aluno`.
- **Não estornei, não concedi crédito, não gastei GPU, não toquei em migration,
  assinatura nem acesso de ninguém.**
- **Não fechei nada em lote.** Visitei um cartão e ele já rendeu um falso
  positivo e um defeito de código.
- **Não decidi o backfill das 77 cartas** do #101.
- **Não li a caixa do suporte@ para triagem.**
- **Nada da planilha** (ordem de 29/08).

## 7. Para quem pegar a próxima ronda

1. **A lista das 17hZ continua válida como ordem de visita** — mas o placar
   agora é **1 visitado, 1 falso positivo**. Trate os 39 restantes como
   *não-lidos*, não como *quase-fechados*.
2. **Antes de fechar, confira se a carta é DO ASSUNTO do cartão.** Não basta
   existir carta depois da abertura. Dois casos em dois dias (`#334`, `#347`)
   morreram exatamente aí. `dump_enviada.cjs <uid> --texto` e leia.
3. **Próximos da lista, por abandono:** `#344` (gusperandio2@, 8,8d), `#348`
   (ellen.atp@, 8,8d), `#357` (luminous.assessoria@, 8,0d), `#343` (welrisson@,
   8,0d), `#358` (mcpaganatto@, 7,9d).
4. **Quando o PR #356 mergear, feche o `#396`** — e confirme em produção por md5
   antes de marcar `fixed`, não pelo Action verde.
5. **Desconfie de "zero" e de "sem" escritos à mão.** Terceiro caso em duas
   rondas: o "pessoa SEM login" do `#347` já era falso quando foi anotado.
6. **Nota de incidente vai entre aspas simples.** Crase dentro de aspas duplas
   vira substituição de comando e a nota chega ao banco mutilada.
