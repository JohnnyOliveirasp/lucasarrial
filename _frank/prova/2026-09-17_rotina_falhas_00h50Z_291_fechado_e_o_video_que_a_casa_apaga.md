# Rotina das falhas — 17/09, 00h50Z

**Dono da fila:** Frank (regra 14-A). **Método:** serial (regra 8).
**Itens desta ronda:** **#291** (`1e74923a`) — **FECHADO** (`ignored`,
`resolved_at` 00:44:38,865Z). **#296** (`ab5644be`) — causa achada, aluna
respondida, **segue `investigating`** de propósito. **#439** (`75c33ee1`) —
**ABERTO** por mim, defeito de sistema com dinheiro.
Fila: **85 → 84 abertos**, e depois **84 → 85** com a abertura do #439.
O saldo de cartões é o mesmo de antes; o que mudou é que um buraco que estava
invisível agora tem número.

> **Régua de hora:** este log está em **Z**, seguindo os carimbos das rondas de
> 16/09. 00h50Z de 17/09 = 21h50 BRT de 16/09.

---

## 1. Por que o #291, e não um dos mais velhos

Os oito da frente continuam presos em decisão que não é minha, e **todos** foram
reconferidos hoje pelas rondas das 13h–23h50Z. Reli a tabela do log das 23h50Z e
**não a herdei em silêncio**: conferi no banco quem tinha nota de `frank` e
quando. Os dois que não apareciam naquela tabela eu abri um por um:

| cartão | idade | onde está travado | conferido por mim agora |
|---|---|---|---|
| `#15` `d3d8d1b2` | 48,5 d | 30 dias limpos ou ocorrência sob a régua nova | nota de 16/09 22:05 |
| `#99` `6c38c99d` | 24,3 d | decisão comercial Johnny/Lucas | 16/09 13:46 |
| `#226` `702cc916` | 15,3 d | decisão de produto | 16/09 14:47 |
| `#234` `f8587cef` | 14,4 d | aval de GPU | 12/09 23:47 |
| `#249` `132f7808` | 12,3 d | aval de WhatsApp | 16/09 16:51 |
| `#250` `8c29740f` | 12,3 d | não sobrou canal | 16/09 22:50 |
| `#254` `f1ada07e` | 12,2 d | frase escrita do titular + 9-C | 16/09 17:44 |
| `#263` `5c68eb33` | 11,5 d | definição do Johnny sobre R$ 97 | 14/09 21:47 |
| `#270` `9d9baab6` | 11,4 d | **estorno em escala + e-mail em massa = "pode" do Johnny** | 16/09 11:53 |
| `#288` `df008dcf` | 10,3 d | — | 16/09 16:54 |
| `#290` `446c3ae4` | 10,1 d | — | 16/09 19:53 |
| **`#291`** `1e74923a` | **10,1 d** | ← **peguei este** (última nota de frank: **09/09**, 7 dias) | — |

O #291 era o cartão aberto **mais antigo cujo desfecho inteiro cabia na minha
alçada** e que **ninguém encostava havia 7 dias**.

Confirmei também que o `#294` (`94d3015d`, 9,5 d, Sunesa, R$ 597 de SGP nunca
entregue) **continua travado no aval de WhatsApp** — mesmo bloqueio do `#249`,
levado ao grupo em 13/09. Não o peguei por isso, e registro aqui porque um
pagante de R$ 597 parado há 9,5 dias por falta de um "pode" é coisa que não
merece sumir num rodapé.

---

## 2. #291 — fechado, e a razão é melhor que "não era bug nosso"

**O que era:** a carta *"você está pagando DUAS assinaturas (R$ 291) — qual quer
manter?"* não chegou em `blancolucila539@gmail.com`. Gmail **452-4.2.2**, caixa
sem espaço. O `250` do SMTP mascarou a recusa e a fila teria dado a aluna por
respondida.

**O que eu medi agora, e não herdei:**

1. `varrer_bounces` rodado nesta ronda: o endereço tem **2 bounces**, o último em
   **08/09 22:28:56Z**, e **nada depois**. A decisão de 09/09 (parar de insistir)
   foi respeitada por todos os lados — ninguém voltou a escrever pro canal morto.
2. A aluna **não ficou sem canal**. `contatoecocannabis@gmail.com` entrega
   normal, e ela respondeu por lá **quatro vezes**: uid 475 (07/09 13:09 BRT),
   477 (07/09 13:41), 639 (15/09 10:53) e 646 (16/09 09:51, um "Ok"). Não há
   pergunta nossa pendente com ela.
3. **O risco que mantinha o cartão vivo acabou.** Ensaio do
   `cancelar_assinatura.cjs` (lê Hotmart **e** banco): `2Q4Y1CDE` =
   `CANCELLED_BY_SELLER`, `6JEANY3Z` = `CANCELLED_BY_SELLER`; no nosso banco os
   dois entitlements estão `canceled`. **Ela não será cobrada em 23/09 nem em
   30/09** — que era exatamente o que o cartão existia pra impedir.
4. Regra 9 respeitada: **200.000 créditos + acesso até 23/09** numa conta,
   **200.000 + acesso até 30/09** na outra. Conferido no banco.

**Por que `ignored` e não `fixed`:** a causa é a caixa dela. Não houve conserto
nosso, e carimbar `fixed` sugeriria um que não existiu.

**O que NÃO fechei por tabela:** o reembolso dos R$ 291 já cobrados segue em
`#299` (`eec81565`) e `#254` (`f1ada07e`).

---

## 3. #296 — a queixa de uma aluna virou o defeito da casa

Peguei o `#296` (Leonice) como segundo item: **9,4 d, última nota de `frank` em
07/09** — nove dias. A ocorrência 3 dizia, no chat do app, em 12/09 23:39:54Z, na
tela `/app/videos/edicao`:

> **"minhas cenas estão sendo cobradas e não estao salvas"**

A Fast respondeu 7 segundos depois que ia chamar a equipe. **Ninguém voltou nela.**

### 3.1 As duas hipóteses do Vigia estavam as duas erradas — e a intuição dele, certa

O Vigia (13/09) deixou dois candidatos, e escreveu com todas as letras que não
tinha banco pra fechar. Tinha razão em não fechar. Com banco:

- **(a) "cena cobrada que terminou `failed` some da galeria"** — **refutado**. As
  duas `studio_scenes` dela (`616c1816`, `8d596dd3`) estão `ready`, com
  `image_path` **e** `video_path`. E foram criadas **23:41:48-50**, ou seja
  **depois** da queixa das 23:39:54. Nem eram o assunto.
- **(b) "b-roll da tela de edição sobrescreve e cobra de novo"** — **refutado**.
  Ela **não tem nenhum** débito `ref_type='edicao_broll'`. Zero.

Mas a **forma** do palpite dele — *sobrescrita destrutiva cobrada duas vezes* —
estava certa. Só que noutro órgão.

### 3.2 O defeito, em arquivo e linha

- `frontend/src/lib/images/video-sync.ts:34-36` — `imageVideoKey()` monta a key
  do R2 como `${userId}/images/${imageId}/video.${ext}`: **determinística por id
  da imagem**. Animar a mesma imagem de novo grava **no mesmo objeto**.
- `frontend/src/app/api/v1/images/[id]/video/route.ts:150-161` — cada despacho
  zera `video_path` e sobrescreve `video_kie_task_id`, `video_credits_cost` e
  `video_retry_count` na **mesma linha**. A tabela guarda **um** vídeo por
  imagem, nunca um histórico.
- `…/video/route.ts:163-172` — e **cada despacho debita** o preço do tier.

**N animações pagas → 1 arquivo.** As N-1 anteriores somem do R2 e do banco, sem
linha, sem log, sem nada.

E o aviso da tela (`frontend/messages/pt-BR.json:581`) diz *"Quer outro
movimento? Ajuste o prompt abaixo e gere de novo (novo custo em créditos)."* —
**fala do custo e cala sobre a destruição.**

### 3.3 A conta dela

Casando `ref_id` (nunca `kind` — armadilha de 20/08):

| imagem | débitos `image_video` | total | janela |
|---|---|---|---|
| `dc5fa142` | 3 | −19.320 | 09/09 12:16 → 12:58 |
| `4139414e` | **6** | −49.600 | 10/09 17:30 → 11/09 09:04 |
| `67ae9f87` | 2 | −15.800 | 12/09 23:16:36 → 23:18:50 |

**11 animações pagas, 84.720 créditos, ZERO estorno** (`image_video_refund` = 0
linhas). Pela key, sobra **no máximo 3 arquivos**. O segundo débito do `67ae9f87`
foi **21 minutos antes** da frase dela.

### 3.4 A exposição da casa

Agrupando `credit_transactions` por `user_id+ref_id` em `ref_type='image_video'`
com `amount<0`: **302 imagens, 194 alunos, 1.545.940 créditos** em animações além
da primeira de cada imagem. Por janela entre o primeiro e o último débito da
mesma imagem: `<1min` 8 · `1-5min` 126 · `5-60min` 112 · `1-24h` 31 · `>24h` 25.

> ⚠️ **Isso é EXPOSIÇÃO, não vítima confirmada** — mesma disciplina do `#303`
> (264 perfis de exposição, 1 caso confirmado). Regerar de propósito é
> comportamento previsto do produto e cobrar cada geração tem base. O que **não**
> tem base é a casa apagar o que já foi pago e depois não conseguir provar o que
> entregou.

---

## 4. O que eu NÃO provei, e por que isso é parte do achado

**A casa não tem registro por despacho.** `image_generations` guarda só o estado
**final** — um `task_id`, um `video_path`, um `video_credits_cost`, um
`video_retry_count`, todos sobrescritos. Então eu **não sei** se os 11 despachos
da Leonice entregaram 11 vídeos ou menos. **Não afirmei nenhuma das duas coisas**
— nem pra ela, nem no cartão.

**Nós não sabemos auditar a nossa própria entrega de Animar Imagem.** Esse é o
buraco de baixo, e é maior que a queixa que o revelou.

### O instrumento que eu tentei e REPROVEI

Quis separar "corrida" de "regeração deliberada" pelo tempo entre os débitos, e
pra isso precisava saber quanto demora um vídeo. Tentei medir pela distância
entre `image_video` e `image_video_refund` do mesmo `ref_id`: **43 pares, mediana
320.384 s (3,7 dias), p90 659.881 s.** O instrumento está **contaminado** — esses
estornos foram feitos em lote por rondas passadas, retroativamente, não no
instante da falha. **Descartei a medição em vez de usar um número que parecia
resposta.** Fica registrado pra ninguém repetir a tentativa achando que é nova.

### A hipótese que eu levantei e NÃO confirmei

A trava de concorrência de `route.ts:59-61` lê `video_status` na **linha 51** e
só grava `pending` na **linha 150** — depois de uma tradução no Haiku e do
despacho no Kie. Duas requisições dentro dessa janela passam as duas e debitam as
duas. O par mais curto da Leonice tem **2min14s** e eu **não tenho instrumento**
pra dizer se é corrida ou regeração deliberada. **Quem for consertar precisa
medir isso, não herdar a minha suspeita.**

---

## 5. O que saiu daqui

- **`#439` (`75c33ee1`) aberto** com a medição inteira, os `ref_id`, os
  `arquivo:linha` e os quatro itens do conserto: key versionada, histórico por
  despacho, aviso honesto enquanto o histórico não existe, e **só então** decidir
  estorno.
- **Aluna avisada** — e-mail enviado, cópia **confirmada em Enviados uid 2598**
  (bcc `suporte@lucasarrial.com`). Contém: a causa em português, os 11 × 84.720
  da conta dela, a admissão de que o aviso da tela é omisso, o que ela faz **hoje**
  pra não perder mais (baixar antes de regerar) e — com essas palavras — que eu
  **não sei** quantos ficaram prontos. **Não prometi estorno nem prazo.**
- **Grupo:** dois avisos — o fecho do `#291`, e o `#439` + a decisão que é do
  Johnny (entra na fila do `coder`? estorna quem perdeu vídeo?).

**NÃO ESTORNEI NADA, e isso foi decisão, não esquecimento.** A conta de quem
perdeu vídeo só fecha depois do histórico por despacho existir, e estorno na
escala de 194 alunos é alçada do Johnny (regra 8).

---

## 6. Ruído que eu vi e não tratei (fica anotado, não virou cartão)

`agent_state` tem **105 recados `para_frank_*`**, o mais velho com **13,1 dias**,
e **nada os apaga** — `idade_incidentes.cjs:40-42` lista todos, sem olhar o
status do incidente. O recado `para_frank_1e74923a` ("reenviar o e-mail pra
Lucila") **continua vivo agora, com o cartão fechado**. Isso é exatamente o que
faz uma ronda futura refazer trabalho pronto. **Não abri cartão** (é ruído de
processo, não erro de sistema — ordem de 27/08) e **não apaguei nada à mão**:
mexer em `agent_state` sem ferramenta é como se perderam 21 notas em 21/08.
Fica como proposta pro Johnny: ou o recado morre quando o incidente fecha, ou a
listagem passa a esconder recado de cartão fechado.

---

## 7. Lição desta ronda

**A hipótese do Vigia estava errada nos dois candidatos e certa na forma.** Se eu
tivesse fechado o `#296` refutando (a) e (b) — as duas refutações são sólidas, e
seria fácil parar ali e escrever "medi, não é isso, erro do aluno" — o defeito
teria voltado pra debaixo do tapete com uma nota tecnicamente correta por cima.

O que achou o buraco foi **levar a frase da aluna a sério depois de derrubar as
duas teorias**: ela disse "cobradas e não salvas", e eu fui procurar o que na
conta dela é cobrado e não fica salvo, em vez de procurar onde as hipóteses
mandavam olhar. **Refutar a hipótese não é o fim da investigação — é o começo.**

---

## 8. Conferência de fim de ronda — e um aviso sobre ela

- `git fetch origin && git log --oneline origin/main..HEAD` → **vazio**. O log
  desta ronda está na **main** (`b4430b5`), empurrado.
- **Não houve mudança de código nesta ronda** (o `#439` é cartão de conserto, não
  o conserto). Então não existe fix meu preso em branch — não por eu ter
  auditado, mas porque **não escrevi nenhum**.

⚠️ **O passo do `git rev-list main..<branch>` do manual está inútil neste repo, e
eu não vou fingir que ele passou.** Rodei em todos os branches locais: **160
acusam commit "fora da main"**. Quase todos foram mergeados por **PR com squash**
— o conteúdo está na main, o hash não. O instrumento só sabe comparar hash, então
ele grita 160 vezes e um fix realmente esquecido ficaria **invisível no meio do
grito**. Era exatamente o caso que a regra existia pra pegar (o fix que ficou 9h
preso em 19/08).

**Proposta pro Johnny** (não executei, mexe em histórico): trocar a conferência
por uma que compare **conteúdo**, não hash — `git cherry main <branch>` ou
`git branch --no-merged main` depois de podar branch já mergeado por squash. E,
separado disso, podar os branches mortos no origin que o `README.md` já manda
**não mergear** (`feat/onedrive-401`, `feat/fix-image-upload-retry`,
`fix/referencia-fronteira-de-frase-por-palavra`,
`feat/fabricar-referencia-fronteira-por-palavra`): enquanto eles existirem, todo
mundo depende de lembrar de um aviso em vez de o repositório proteger sozinho.
