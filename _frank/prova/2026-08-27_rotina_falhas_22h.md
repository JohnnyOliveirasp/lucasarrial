# Rotina das Falhas — 27/08/2026, ronda das 22h UTC (Claude, dono da fila)

Método serial (regra 8, ordem de 21/08): um incidente por vez, até o fim.
Papéis (regra 14-A): o Vigia abre e anota; eu investigo, decido e fecho.
`git checkout main && git pull --ff-only origin main` → já estava em dia.
Índice de ordens lido antes de tocar em qualquer coisa. Ordem vigente:
`2026-08-27_vigia_so_erro_de_sistema.md` (14-C).

## Placar

| | |
|---|---|
| Abertos no início (sem `aguardando_aluno`) | **6** |
| Abertos no fim | **7** (abri o `#164`) |
| **Fechados nesta ronda** | **0** — e explico por quê no item 5 |
| **Alunos que passaram a ter resposta** | **1** (Zethe) |
| **Causa de sistema cravada e corrigida** | **1** (`#164`, com PR) |
| PR aberto | **1** (`#75`, só texto, 3 locales) |
| Escalado ao Johnny na hora | **1** (msg 501) |
| Afirmação de ronda anterior derrubada por medição | **2** |
| Crédito / GPU / migration / merge / e-mail em massa | **nada tocado** |

---

## 1. Qual incidente peguei, e por que não foi o mais velho

Pela regra 8 eu pego o mais antigo **com aluno afetado**. Os três mais velhos
não estão nessa condição:

- **`#11`** (37 dias) — travado na migration `scripts/97`, que segue não
  aplicada. Os 3 afetados já foram apurados em 18/08 e nenhum espera. Bloqueio
  único: aval do Johnny.
- **`#99`** e **`#120`** — os dois alunos já foram respondidos hoje; o que
  falta nos dois é **decisão comercial** do Lucas/Johnny, não dono.
- **`#153`** — tratado na ronda das 21h, parado no PR #73 (aval).

O mais antigo com **gente esperando de verdade** era o **`#151`**, aberto
12:17Z, 4 ocorrências, reaberto automaticamente às 21:10Z porque **a aluna
respondeu**. Peguei este. (A ronda das 21h apontou o `#160` como próximo; o
`#151` é 6h mais velho, tem aluna pagante com prazo vencendo em 4 dias, e a
bola tinha acabado de voltar pra casa.)

## 2. A primeira coisa que fiz foi conferir o estado atual — e ele tinha virado

Regra: *"já resolveu sozinho? é o caso mais comum"*. Foi meio caso.

A nota mais recente do incidente, escrita às **21h26Z**, afirma:
*"studio_projects=0 e video_projects=0 — ela nunca abriu projeto de vídeo em
3 dias"*. **Medido às 21h45Z:**

| | |
|---|---|
| `video_projects` | **1** (`44ba8c1f`, `kind=sales`, `draft`, criado **19:53:25Z**) |
| Vídeos Clone prontos hoje | **3** (18:46, 19:24, 20:36Z — cobrados 1.995 + 1.995 + 4.095) |
| Áudios prontos hoje | **5** (16:10 → 17:44Z) |
| Saldo | 60.958 → **47.628** |

**Ela destravou sozinha por volta das 16h10Z e passou a tarde produzindo.** A
nota das 21h26Z já nascia falsa: repetiu a medição das 14h53Z sem reconferir.

Isso me obrigou a uma correção pública: **eu tinha afirmado a ela, por e-mail**,
que ela nunca conseguira abrir projeto nenhum. Corrigi com todas as letras no
e-mail de hoje. **Lição pra próxima ronda:** nesta base, 5h bastam pra uma
afirmação virar mentira — reconferir o aluno antes de reaproveitar medição de
ronda anterior, mesmo que a ronda seja da mesma noite.

## 3. A causa que eu cravei: o botão que treina voz não se chama treinar

O que continuava travado era o que **ela pediu**: subir áudio novo pra clonar.

Ela escreveu às **15:10Z, estando com `pathname` em `/app/voice-cloning`**:

> *"Não tem a opção treinar voz. **já vim aqui várias vezes**. tem a opção
> gerar voz, mas só aparece minha voz, Elizete S Castro"*

E às **21:07Z**, por e-mail:

> *"não consegui introduzir os áudios para serem clonados. Preciso de ajuda"*

**Ela estava olhando pro botão.**

### Conferi antes de acusar a UI de esconder

`voice-cloning/page.tsx:66` → `canTrain = team || creditsTotal >= TRAINING_CREDIT_COST`
(10.000). Ela tem 47.628. **O botão estava renderizado e visível na tela dela.**
Não há trava técnica, não há limite de vozes. O defeito é o **nome**.

### A medição

O produto inteiro chama a ação de **treinar**:

| onde | texto |
|---|---|
| `voiceCloning.subtitle` — **a mesma tela** | "**Treine** a sua voz do jeito que precisar" |
| `voiceCloning.empty` | "Você ainda não **treinou** nenhuma voz" |
| `statuses.awaiting_training` | "Falta você **treinar**" / "Pronta pra **treinar**" |
| `paywall.titleNoCredits` | "Créditos insuficientes para **treinar**" |
| **a tela de destino** (`voice-cloning/new`) | eyebrow "01 · **Treinar voz**", botão "**Treinar voz** ({duration})" |
| `rejectedCta` — **já existia** | "+ **Treinar nova voz**" |

Mas o único botão que leva até lá dizia **"+ Gerar Nova Voz"**, e o H1 dizia
**"Gerar Voz"** — e "Gerar" é o verbo da **outra** ação do produto
(`generateAudioTitle` = "Gerar Áudio", `pickVoiceCta` = "Gerar áudio").

**O botão e a tela que ele abre se contradiziam.**

### O agravante que eu não esperava: os bots acertam o nome que o produto errou

O chat do app deu **4 caminhos diferentes em 11 minutos** (14:59→15:10Z)
mandando ela procurar "Treinar Voz". E a **Fast mandou um 5º por e-mail** (uid
215, **21:10:16Z** — 38 minutos antes do meu): *"menu Vozes > Treinar Voz …
clique em 'Enviar arquivos de áudio'"*. Nenhum desses elementos existe com esse
nome.

**Seis caminhos inventados para um botão que existe com outro nome.** Os bots
usam o vocabulário do resto do produto; o produto é o único lugar que não usa.

### Tamanho da classe — sinal, não prova individual

**42** alunos distintos já perguntaram sobre "treinar voz" no chat; **25** deles
com `pathname` em `/voice-cloning`, a própria tela do botão.

Registro como **sinal**. **Não afirmo** que os 25 foram barrados pelo rótulo —
parte pode só estar perguntando como começar, e não abri a conversa de cada um.
A prova individual é só a da Zethe, com as palavras dela e a tela em que estava.

## 4. O fato que muda o caso inteiro: cordas vocais

E-mail dela, uid 340, 21:07Z:

> *"Mas na garganta eu não aguento. **Por isso procurei FastCloner. Tenho
> problema nas cordas vocais** … Garganta, não grava mais nada."*

E, sobre o clone:

> *"o clone, não quero de jeito nenhum. Não tem como! Ninguém vai assistir
> alguém tão desolado como ficou meu clone. Ficaram sem emoção nenhuma."*

Ela comprou o produto **para substituir a própria voz**. O que ela não consegue
usar é exatamente o que ela veio comprar — e **não pode gravar material novo**
pra tentar de novo.

⚠️ **Isso invalida o pedido que a ronda das 15h fez a ela**: aquele e-mail pediu
*"mande 25 a 30 minutos"* de gravação nova. **Retirei por escrito**, com estas
palavras: *"esquece o que eu escrevi sobre gravar de 25 a 30 minutos"*.

Ela também explicou os 7 blocos de 5min que eu tinha medido: **o gravador dela
cortava sozinho aos 5 minutos**. Confirma os 7 `sha256` distintos e mata a
hipótese de inflação de duração pela nossa ingestão.

## 5. Por que eu não fechei o `#151`

Porque a queixa central dela é **qualidade/ritmo** ("cantada", "sem emoção"),
que **não se mede daqui** e precisa de ouvido humano. Fechar agora seria
`fixed` sem ter resolvido — regra 14, que a ordem de 21/08 **não** afrouxou.

Já descartado por medição (rondas anteriores + esta), pra ninguém refazer:

- arquivos corrompidos/não-áudio → 7/7 `.wav` reais, 2.100s;
- referência cortada no meio da palavra (defeito Katia) → *"pontas batem"*;
- instabilidade entre gerações → 2,463 vs 2,444 pal/s;
- duplicata de arquivo → `sha256` todos diferentes;
- **cobrança dupla → conferido por `ref_type`, nunca por `kind`**: zero estorno,
  treino cobrado 10.000 **uma única vez**;
- os 3 débitos de 1.320 no mesmo `ref_id` → legítimos por desenho
  (`images/[id]/video/route.ts`), regerar é pago e sobrescreve.

**Falta:** ouvido humano no A/B; a resposta dela sobre quanto tempo tem o
material novo; e a decisão comercial do Johnny.

Também **não repeti** a promessa de "aumentar a pausa". Conferi antes:
`generate/route.ts:233-242` aceita `chunk_silence_ms` por geração, então é
tecnicamente possível — **mas o pacing foi desligado por ordem do Johnny em
24/08** (caso Kessuly: 93 vozes ficaram "muito pior"). Ofereci só como amostra
opcional, sob pedido dela, e não toquei em `tts_silence_ms`.

## 6. O que eu fiz, com a prova

1. **E-mail à aluna** — enviado **21:48:01Z**, uid **217**, **conferido na pasta
   Enviados depois do envio** (bcc suporte@). Traz: o nome real do botão; a
   retirada do pedido de gravar; a alternativa de retreinar com os 35min **já
   enviados**, sem ela gravar nada (com a ressalva honesta de que é o mesmo
   material e pode sair parecido); a correção da minha afirmação errada; "não
   apague a voz"; e sobre o acesso vencer 31/08, que **não tenho autonomia** —
   **não prometi prorrogação nem reembolso**.
2. **PR #75** — `fix/inc151-botao-treinar-voz`, commit `446fdb3`. Só texto, 3
   locales. `JSON.parse` OK nos 3, `npx tsc --noEmit` **exit 0**. **Não
   mergeado.**
3. **`#164` aberto** (`1c56eb7a`, `kind=ui`) — a classe do rótulo, com o PR
   anexado, pra não morrer quando o `#151` fechar.
4. **`#151` anotado** (10 notas), status mantido `investigating`.
5. **Telegram ao Johnny, msg 501** — escalado **na hora**, como manda a regra do
   aluno pagante travado sem solução.
6. **Telegram msg 502** — regra 7, só fato consumado.

## 7. Decisões que são do Johnny (a lista cresceu em 1)

1. **Migration `scripts/97`** — trava o `#11` há **37 dias**. Segue não aplicada.
2. **PR #73** (`#153`) — aberto, parado.
3. **PR #74** (`#157`, manual) — aberto ontem, só texto.
4. **PR #75** (`#164`, rótulo do botão) — aberto hoje, só texto.
5. **`#161`** — backfill dos 189 cadastros + PR.
6. 🔴 **NOVO — Zethe (`#151`): prorrogar o acesso além de 31/08? reembolso?**
   Ela tem problema nas cordas vocais, comprou pra substituir a voz, e rejeitou
   o clone. Escalado às 21h50Z (msg 501). **Não prometi nada a ela.**
7. **`avisar_grupo.cjs` não funciona fora do servidor** e falha **em silêncio** —
   segue como estava.

## 8. Ferramentas que estavam só nesta máquina (corrigido nesta ronda)

`git status` acusou **3 arquivos nunca commitados**, de rondas anteriores:
`listar_arquivos_da_voz.cjs`, `ddl_aplicado.cjs` e um json de prova. O primeiro
é **citado pela própria ordem da rotina** ("liste os ARQUIVOS da voz PRIMEIRO")
e pelas notas do `#151` — ou seja, uma ferramenta que a ordem manda usar existia
**só no meu working tree**. Mesma família do "fix preso em branch" de 19/08.
Conferi que os dois `.cjs` são **somente leitura** (sem `update/insert/delete`,
sem `--confirmar`, sem `PutObject`) e **commitei na main** junto com este log.

## 9. O que eu NÃO fiz

Não mergeei PR nenhum — **nada do que escrevi hoje está em produção**. Não
apliquei migration (em particular, **não a 97**). Não gastei GPU, não retreinei,
não gerei amostra. Não toquei em crédito, acesso, assinatura nem estorno de
ninguém. Não apaguei voz nem projeto. Não mandei e-mail em massa — só **um**
e-mail individual, para a aluna do caso que eu estava tratando (regra 8). Não li
a caixa do suporte@ para triagem: só `--de` e `--enviados --para` no endereço
dela. Não fechei incidente nenhum, e o item 5 diz por quê.

## 10. Para a próxima ronda

1. **Zethe (`#151`)**: ela responde quanto tempo tem o material novo? Se for
   < 20min, o caminho é retreino com os 35min já enviados — **sem ela gravar**.
   E o Johnny precisa decidir prazo/reembolso **antes de 30/08**.
2. **`#164`**: se o Johnny liberar o PR #75, mergear e **conferir na main
   deployada** — card completo não é produção.
3. **`#160`** (Telma, pedido de produto) segue `open` e sem dono desde 18h41Z.
   É o próximo pela regra 8 entre os acionáveis — eu não o toquei.
4. **Conferir se Ronald, Cássio, Sandra e Luziélia responderam.**
5. O `#153` ganhou insumo novo: a Fast mandou caminho inventado por e-mail
   (uid 215) 38min antes da resposta humana. Vale anotar lá.
