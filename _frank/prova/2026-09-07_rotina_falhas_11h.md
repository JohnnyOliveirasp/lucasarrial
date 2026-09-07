# Ronda das falhas — 07/09, ~11h40Z (08h40 BRT)

Frank, **dono da fila** (regra 14-A). Método serial da ordem de 21/08.

Repo sincronizado (`main`, `pull --ff-only`) e `_frank/ordens/README.md` lido antes de
tocar em qualquer coisa. Nada da planilha foi lido, classificado, aberto ou reaberto
(ordem de 29/08). Canal: ordem de 31/08 — aviso no **GRUPO**, nada no privado.
Turno: 08h40 BRT, **dentro** da janela 08h–23h.

---

## 0. A ronda em uma linha

**Achei uma ronda RODANDO EM PARALELO com a minha (PID 951743, viva desde 11:32Z) —
ela já respondeu a Elane às 11:28Z sem que eu soubesse. O e-mail dela é bom e eu
confirmei os fatos, mas a cronologia derruba a manchete: a aluna usou as PRÓPRIAS
vozes 8 vezes antes de tocar na voz de catálogo que o e-mail aponta como "o motivo
principal".**

---

## 1. Fila: 40 não-fechados (era 37 às 10hZ)

| status | agora | 10hZ |
|---|---|---|
| investigating | 25 | 25 |
| aguardando_aluno | 12 | 12 |
| **open** | **3** | **0** |
| | **40** | **37** |

(fixed **199** · ignored **44** — nenhum se moveu.)

Os 3 `open` nasceram DEPOIS da ronda das 10hZ: **#289** (nova ocorrência 10:59Z),
**#293** (11:15Z) e **#294** (11:40Z, bounce `sunesacristina01@gmail.com`). A janela
não foi calma; ela virou logo depois da medida anterior.

**Nada fechado voltou a disparar:** varri `fixed`/`ignored` com `last_seen_at >
resolved_at` sem recorte. Sai **um só**, o **#8** (fechado 09/08, último disparo
22/08) — antigo, conhecido, não disparou nesta janela. Décima segunda ronda igual.

## 2. ⚠️ DUAS RONDAS NO MESMO QUADRO AO MESMO TEMPO

Medido, não deduzido: `ps` mostra o PID **951743** (`claude-agent-sdk`, opus) vivo
desde **11:32Z**, ainda rodando ao fim da minha ronda (12min+ de elapsed). Ele
escreveu nota no #293 às **11:29:16Z** e mandou e-mail à aluna às **11:28:53Z** —
os dois **antes de eu começar**, e sem que nada no quadro sinalizasse dono.

Isto é o risco do **#259** ("a Fast responde duas vezes a mesma mensagem") acontecendo
um nível acima: não é a Fast duplicando resposta, são **dois donos na mesma fila**.
A regra 14-A diz *um incidente = um dono*, mas não existe trava que faça valer —
nenhum lock, nenhum campo de posse, nenhum aviso. Foi sorte eu ter conferido o
`Sent` antes de escrever: **eu ia mandar o segundo e-mail para a Elane.**

Registro como **decisão do Johnny**, não como chamado — não sei se a segunda ronda
foi disparada de propósito, e não invento causa.

## 3. O item serial: Elane (#293, 8 ocorrências, aluna escalando)

Peguei este e não a cabeça da fila porque aluno esperando vem antes de limpeza, e
porque havia diagnóstico fresco prestes a fechar o caso. Os mais velhos seguem
travados onde a ronda das 10hZ já documentou (**#15** espera o "pode" da migration
82; **#222** com a bola do aluno desde 03/09; o resto `aguardando_aluno`).

### O que o e-mail das 11:28Z acertou — e eu confirmei, um por um

Não aceitei a conclusão de graça. Fui conferir os três fatos checáveis:

1. **As 2 últimas gerações usaram mesmo a voz `07ff9217`** (07/09 01:51 e 02:35).
   **Verdade.**
2. **Essa voz é de catálogo.** `is_stock = TRUE` — uma das **32** vozes stock sob
   `vozes@fastcloner.com`, ao lado de Alexa, Camila, João. **Não é vazamento entre
   contas.** O e-mail chamou de *"de outra pessoa"*: impreciso e capaz de assustar
   por privacidade, mas a substância ("voz pronta da plataforma") está lá.
3. **O controle "Pausa entre frases" existe de verdade** —
   `voice-generator.tsx:280`, opções Natural (`null`) / 250 / 550, default Natural.
   O conselho é acionável. E os transcripts de referência **são** de estilos
   diferentes, como o e-mail disse: `Elane` é leitura formal de telejornal
   (*"...nos próximos telejornais"*), `Elane ckis` é fala espontânea (*"Eu estava no
   trabalho, eu cheguei meio dia..."*). Descrição honesta.

**É trabalho bem feito.** Registro o positivo porque a ronda também serve pra isso.

### O que a cronologia derruba

A manchete é *"achei o motivo principal"*. A ordem dos fatos diz outra coisa:

| quando | voz usada |
|---|---|
| 06/09 21:00 → 07/09 00:57 | **8 gerações com as PRÓPRIAS vozes** (`2f07e0e1`, `4d9a645f`) |
| 07/09 01:51 e 02:35 | 2 gerações com a stock `Juliana` |

Ela se decepcionou com os próprios clones **primeiro** e só então foi na voz de
catálogo. **A Juliana é a fuga, não a causa.** Explica no máximo as 2 últimas
gerações — não a reclamação de 8 ocorrências que vem desde 06/09.

### E a queixa de origem tem base medida

`speech_rate_wps`: **2,44** (Elane) e **2,59** (Elane ckis), contra **2,905** de média
nas 154 vozes de aluno prontas, com **p10 = 2,303**. As duas no lado **lento** da
régua. *"Fala arrastada"* não é impressão dela: é medível, e é sobre os clones dela.
(`reference_rate_wps` nulo nas duas — a métrica não foi calculada.)

### O que eu fiz, e o que deliberadamente não fiz

**Não reenviei e-mail.** Já saiu um às 11:28Z; segunda resposta ao mesmo caso é
literalmente o **#259**. Gravei a correção no card (`agent_notes` 2 → 3, 1 linha
afetada, conferida na releitura) para que a próxima ronda **não feche o #293 pelo
e-mail enviado**.

**Dado errado no card:** `affected_emails` traz `elaneckis@gmail.com`, que **não tem
profile**. A conta é `elaneyani@gmail.com` (`5c803ec4`), dona das duas vozes. Anotado,
não corrigido — mexer em `affected_emails` com outra ronda viva no mesmo card é como
se perde nota.

## 4. Árvore local suja na `main` (não é meu, não commitei)

`git status` na `main` traz 6 arquivos modificados e 2 não rastreados
(`frontend/src/lib/video/audio-eligibility.ts` e `.test.ts`, mais mensagens i18n e
`audio-picker`). Não é da minha ronda e não tem commit. **Não commitei e não descartei**
— trabalho de outra pessoa em cima da `main` local. Só registro que está lá.

## 5. Fim de ronda — passo fixo

- `git fetch origin && git log --oneline origin/main..HEAD` → conferido no §6.
- Nenhum fix meu preso em branch: **não abri branch e não escrevi código** nesta ronda.

## 6. O que eu NÃO fiz

Não fechei incidente, não reabri, não mexi em crédito/acesso/plano, não estornei, não
apliquei migration, não mergeei PR, não disparei GPU nem geração de teste, não
respondi aluno e não toquei em nada da planilha. Leitura do `Sent` foi só para evitar
e-mail duplicado — não é triagem de caixa. **A única escrita foi 1 nota no #293.**

## 7. Precisa de DECISÃO do Johnny

1. 🔴 **DUAS rondas rodando no mesmo quadro** (§2). Quase virou segundo e-mail para a
   mesma aluna. Ou desliga uma, ou cria posse de incidente — hoje não existe trava.
2. 🔴 **#293 não pode ser fechado pelo e-mail das 11:28Z** (§3). A causa de origem
   (ritmo 2,44/2,59 contra média 2,905) segue aberta.
3. 🔴 **`migration 82`** — segue destravando o #15 (39 dias, 18 afetados). Pendente.
4. 🔴 **8 pagantes restituídos e ainda não avisados** — o "pode" está pendente desde
   **04/09**. É a decisão mais barata e mais atrasada da lista.
5. 🔴 **#265: 43 pessoas dentro da garantia, 7 perdem HOJE/amanhã (08/09).**
6. 🟡 **#226 / #234** — cobrar ou estornar as gerações reprovadas pelo nosso QA.
7. 🟡 **#254 / Diego** — o prazo do próprio Frank vence **08/09**: resta 1 dia.
8. 🟡 **3 queimados do Vídeo Clone** (43h/38h/37h) — causa curada, alunos não avisados.
