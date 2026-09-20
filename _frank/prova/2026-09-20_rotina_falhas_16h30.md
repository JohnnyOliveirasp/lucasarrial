# Ronda das falhas — 20/09, ~16h40–17h30Z (Frank)

Item serial: **#371 / `23f8123d`** (Alice Silveira) — **o mesmo da ronda das
15h30**, retomado porque o cartão que o levava adiante (`9c2f6751`, no `coder`)
**falhou sem entregar nada**. Pela regra 8 o item continua meu até o fim, e o
fim não chegou.

**O achado desta ronda é contra mim mesmo: a conclusão principal da ronda das
15h30 estava errada.** Detalhe no §2. Não é nuance — foi o tipo de erro que, se
tivesse virado código, teria barrado as fotos da aluna de propósito e chamado
isso de conserto.

Ordem de 29/08 respeitada: **nada da planilha** foi lido, escrito, classificado
ou reprocessado. Canal: ordem de 31/08 — **nada no privado do Johnny**; por que
não houve post no grupo está no §6.

## Placar

- Fila: **90 abertos** no início da ronda (era 89 às 15h30: **+1**).
- Fechados `fixed`: **0**. Honesto, não omissão — nada subiu pra produção (§5).
- Alunos respondidos: **0** — e há uma dívida declarada com a Alice (§4).
- Crédito devolvido: **0** — não havia o que devolver (o gate roda antes da
  cobrança; recusa não cobra).
- Passo fixo dos envios: **860 lidas, 0 carta fora da tabela** depois do corte.
- Percepção travada: **1** pelo instrumento (falso positivo conhecido, o #450).
- Pagante trancado: **0** · fronteira **0** · sem prova **1**.
- Cartões: **1 falhado** herdado (`9c2f6751`), **1 aberto** (`8dbdf34f`, coder).

---

## 0. Passos fixos, antes de qualquer coisa

**Reconciliar os envios** (`--corte=2026-09-14T14:06:31Z --confirmar`): **860**
cartas lidas da pasta `Sent`, **783** já tinham linha, **77** fora da janela do
corte, **0 escrituráveis, 0 recusadas**. A contagem fecha (860 = 860).

O instrumento independente (`2026-09-18_enviados_x_tabela.cjs`) dá o veredito
**"0 carta depois do corte"**. Buraco segue **passivo**.

(Ronda das 15h30: 853 lidas / 776 com linha. **+7 cartas, todas já com linha.**)

As **77 anteriores a 14/09 14:06:31Z** seguem sem decisão, como o README manda.

**Percepção travada:** instrumento **1** (o #450, falso positivo já declarado em
18/09 — o casador continua re-levantando cartão que já saiu da classe).

---

## 1. Por que este cartão, e o que o `coder` fez com ele

O `9c2f6751` voltou **`failed`**, com a mensagem padrão de worker que não
produziu saída: *"provável incapacidade pra essa tarefa"*.

**A culpa é de roteamento, e é minha.** O cartão pedia, no passo 1, *corrigir o
gabarito* — ou seja, **olhar sete fotos e decidir o papel de cada uma**. Isso é
tarefa de percepção, e eu mandei pro `coder`, que é modelo de código. A ordem de
17/09 existe exatamente pra isso e eu passei por cima dela na ronda anterior.

Lição registrada no banco (`remember-cli` #1743): tarefa que exige **julgar
imagem** vai pro `olho`; o `coder` entra **depois**, com o veredito na mão.

---

## 2. O erro da ronda das 15h30, e a âncora pra ele não voltar

O §3 do log das 15h30 afirmou que **o gabarito da régua estava errado** e que 4
das 7 fotos da Alice deveriam ser re-rotuladas `"negativo"` porque **o olhar
dela está desviado**. Eu conferi as imagens hoje e o que está errado é **aquela
conclusão**.

**O motivo é objetivo e citável — não é opinião sobre foto.** O SYSTEM em
produção (`face-gate.ts` na main, linhas 16-20) define o critério em texto:

> `frontal` = *"the main person's face is turned toward the camera (up to ~30°
> of yaw/pitch is fine); false if in profile, looking down at something, head
> tilted away, back of head, or no clear human face"*
> `mouth_visible` = *"the mouth is visible and not covered"*

O critério é **pose da cabeça + boca visível**. **Direção do olhar não é
critério.** Logo as 7 da Alice são `alvo`, e o gabarito **original** estava
certo. Eu julguei as fotos por uma régua de "olhos na lente" **que o produto
nunca prometeu** — e que o lip-sync não precisa, porque quem sincroniza é a
boca.

Isso também reabilita a conclusão de **13/09** (*"a cláusula de gaze ficou
agressiva demais"*), que a ronda das 15h30 tinha declarado inválida.

**Duas leituras independentes, e eu registro a divergência em vez de escondê-la.**
Baixei as 9 imagens da régua do R2 (`/tmp/img371`) e o `olho` leu as mesmas 9 sem
ver a minha leitura:

| imagem | eu leio | `olho` lê | papel pelo CONTRATO |
|---|---|---|---|
| `b5c6dea7` | frontal, olhar na lente | frontal, lente | **alvo** |
| `4100fc07` (gerada) | frontal, olhar na lente | frontal, lente | **alvo** |
| `2b274f51` | close, frontal, boca visível | *"boca obstruída"* ❌ | **alvo** |
| `128b3050` | olhar desviado | *"olhar na lente"* | **alvo** |
| `0e6a538a` | olhar desviado | *"olhar na lente"* | **alvo** |
| `5f610dda` / `8cd4c73c` | olhar desviado | *"olhar na lente"* | **alvo** |
| itamar `8cd37f59` | cabeça pra baixo | *"cabeça e olhar pra baixo"* | **negativo** |
| itamar `40b59813` | frontal, cartilha | frontal, lente | **positivo** |

Nós **divergimos no detalhe do olhar em 4 imagens**, e o `olho` **erra feio** a
`2b274f51` (chama de boca obstruída uma foto em close com a boca inteiramente
visível — eu abri o arquivo). **Mas as duas leituras chegam ao mesmo veredito
pelo contrato**, porque o contrato não pergunta pelo olhar.

**É por isso que a divergência importa mais que o acordo:** ela prova que
julgamento visual — meu ou de modelo — **não serve de gabarito**. Foi
julgamento visual que fez esta conclusão inverter duas vezes em sete dias. O
que serve de gabarito é o texto do contrato. Escrevi isso na nota do incidente
pra ninguém inverter uma terceira vez.

---

## 3. O branch: dois acertos e um erro, agora separados

`feat/371-gate-deterministico` (`d3824d1`) segue **sem PR** — reconferido hoje
por `git ls-remote` (o branch existe) e `gh pr list --state all --limit 400`
(o "371" que aparece é o PR do `fix/entrar-aluno-token-hash`, outro assunto).

**Acerta (1) — `temperature: 0`.** A chamada ia sem `temperature` e o default da
API é 1.0: um classificador **binário**, que decide se o aluno usa um produto
pago, estava **sorteando**. A prova é dura e está no conjunto: `5f610dda` e
`8cd4c73c` são **byte a byte o mesmo arquivo** (116.869 b nos dois) e tiveram
**placar diferente**. Isto é defeito real e o conserto é legítimo.

**Acerta (2) — o diagnóstico de ancoragem.** O SYSTEM velho trazia **um** exemplo
de `reason` ("olhando pra baixo, pra tábua na mesa") e **17 das 21 recusas
repetiram essa frase**, inclusive em foto com o olhar na lente. O modelo
papagaiava o exemplo.

**Erra (3) — a cláusula que ele põe no lugar.** *"Reprova o olhar preso num
objeto fora do quadro"* **não é atributo visual verificável**: exige inferir
**intenção** de uma foto parada. É por isso que ela sobre-barra na prática
mesmo com a intenção certa.

**Refuto a justificativa do autor do branch** de que *"a cláusula do olhar é o
que segura o controle negativo"*. **Não segura.** O controle negativo é a
`8cd37f59` do Itamar, e nela a **cabeça** está virada pra baixo, não só o olhar
— o `olho` leu isso de forma independente. Ela é barrada por **pose**, critério
que **já está no contrato**. Se boca em sombra também tem que barrar, isso é
trabalho do `mouth_visible`. Usar gaze pra salvar esse controle **mascara
especificação ruim**.

Essa refutação não é só minha: submeti a conclusão a uma crítica adversarial
antes de escrevê-la (o `critic` está **fora do ar** — *"Not logged in"* — e o
desafio foi feito pelo `glm`). Ele acrescentou o ponto que eu não tinha: o
problema de fundo é que **os controles não estão decompostos**, e por isso
ninguém consegue dizer *qual cláusula* segura *qual* negativo. Incorporei isso
no cartão.

---

## 4. A aluna: a dívida que eu declaro em vez de enterrar

Nada mudou no estado dela desde as 15h30 (acesso expirou hoje 12:00Z, zero
`video_clones`, cortesia e não pagante — reconferido: `pagante_trancado.cjs`
dá **0 trancados, 0 na fronteira**).

**O que eu devo dizer, e digo:** a carta de 15h30 (Enviados **uid 3022**)
afirmou a ela que o gate **"acerta"** ao barrar as fotos em que o olhar dela vai
pro lado. **Pelo contrato isso é falso** — essas fotos deveriam passar.

**Não mandei carta nova hoje**, e a razão é ela, não o meu conforto: a
orientação **acionável** que ela recebeu continua correta e é a que importa
(*não precisa tirar foto nova; a falha é nossa; ainda não está no ar*), e o
produto segue quebrado pra ela de qualquer forma. Uma segunda carta só com
nuance técnica não muda **nada** que ela possa fazer hoje, e ela já levou uma
promessa quebrada de sete dias.

**A correção não fica enterrada:** está escrita na nota do incidente com a
instrução explícita de que **a próxima carta pra ela — quando o conserto subir —
tem que corrigir isso na cara**. Se alguém discordar e quiser a carta hoje, o
caso está documentado pra isso ser uma decisão, não um esquecimento.

---

## 5. Por que eu não fecho o #371

O defeito segue **vivo em produção**: as linhas 70-71 da main continuam sem
`temperature`. A fila de recusas continua enchendo (**31 recusas, 20 alunos
distintos**, 15→19/09). Nada subiu. Fechar hoje seria `fixed` sem resolver, que
é a regra 14 — e a regra 14 não afrouxou.

**Passo que falta, nomeado:** re-medir com o gabarito **ancorado no contrato** e
com os controles **decompostos** (pose, boca e >30° medidos separadamente), e só
então decidir se a cláusula de olhar **sai** ou **vira atributo verificável**.

---

## 6. Frota e canal

Cartão **`8dbdf34f`** despachado pro `coder` — agora com o escopo certo, porque
a parte de **julgar imagem já foi feita** (§2) e o que sobrou é mecânico:
corrigir o gabarito citando o contrato, **decompor o controle negativo em três
categorias** (pose · boca · >30°) buscando candidatas na `face_gate_recusas`,
medir ANTES × DEPOIS em 5 rodadas, e só então mexer na cláusula de gaze.
Critério de aceite exigindo **os dois lados** (alvos 5/5 **e** cada categoria de
negativo barrando 5/5 **e** zero flip **e** as duas cópias idênticas com
veredito igual), PR com a tabela, **sem mergear**.

**`critic` fora do ar** (*"Not logged in"*) — registrado aqui porque é
instrumento de revisão que a casa achava que tinha e não tem.

**Por que não houve post no grupo.** A regra 7 manda postar **fato consumado**:
incidente fechado, fix em produção, ou carta pra aluno. Nesta ronda não houve
**nenhum dos três** — e ela é explícita em não postar progresso parcial, porque
o Lucas está no grupo e ruído mata o canal. A correção do §2 e a dívida do §4
entram no **relatório consolidado da noite**. Registro a decisão aqui pra ser
decisão declarada, não omissão silenciosa.
