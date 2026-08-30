# Rotina das Falhas — 30/08/2026, 15h30–16h UTC (= 12h30 BRT) — dono da fila

Abertura: `git checkout main && git pull --ff-only origin main` → já em dia.
Índice de ordens lido antes de tocar em qualquer coisa. A ordem de 29/08
(`desligar_vigia_e_frank`) relida: ela desliga o que atua **pela planilha**, não o
atendimento a aluno. Nada nesta ronda encosta na planilha.

Ronda anterior: **Vigia às 14h UTC** (sensor). Esta é a das falhas, como **dono** (14-A).

---

## Placar

| | |
|---|---|
| Abertos na chegada (`open`/`investigating`) | **2** (#192, #199) |
| Em `aguardando_aluno` | **3** (#99, #196, #197) |
| Incidentes que levei ao fim possível nesta ronda | **1** (#199) |
| **Alunos para quem escrevi** | **1** (Esney, `eesney@gmail.com`) |
| Hipóteses MINHAS que eu derrubei com medição | **2** (14 refs; extensão `.jfif`) |
| Recomendação herdada que eu REJEITEI com medição | **1** (ampliar o regex de transiente) |
| Cards abertos pro `coder` | **1** (`2a5abca5`) |
| Fechados que voltaram a disparar | **0** novos (só o #8 conhecido, último disparo 22/08) |
| Crédito / GPU / migration / código de app tocados por mim | **nada** |

---

## 1. `#199` (Esney Menezes) — peguei pelo serial, e a causa não era a que estava no chamado

Peguei este porque o **#192 segue travado em passo humano** (§3) e o serial manda levar um
até o fim. O chamado nasceu da `burst-rule` às 13:52Z: 3 falhas do Gerador de Imagem em
15 min, todas com `kie_raw_error = "generate playground failed, task id is blank"`.

### Primeiro passo, antes de qualquer teoria: o aluno ainda está travado?

**Não está, e isso muda a urgência.** Depois das 3 falhas ele gerou `ea4cd005` (14:46Z,
5 refs) e `4e800ba2` (14:53Z, 1 ref), as **duas `ready`**. Ele se destravou sozinho
reduzindo as fotos — o que, sem querer, foi a primeira evidência da causa real.

### Dinheiro: refiz a conta, não herdei

Conferido **por `ref_type`, nunca por `kind`** (o estorno grava `kind='extra_purchase'` —
armadilha que quase pagou em dobro pra 13 alunos). 3 débitos de 525 `image_generation`
casados 1:1 por `ref_id` com 3 estornos de 525 `image_refund`. Saldo `97.375 + 1.575 =
98.950`, que é exatamente `100.000 − 5×525 + 3×525`. **Nada devido.** Bate com o que o
Vigia mediu — mas eu refiz, porque herdar número de nota alheia já produziu causa errada
aqui antes.

### A causa: peso total das referências, não a contagem

Medi os **bytes reais no R2** (`HeadObject`, script `_Bugs/medir_payload_refs.cjs`, só
leitura):

| geração | refs | total | maior arquivo | desfecho |
|---|---|---|---|---|
| `f5082a84` | 14 | **340,94 MB** | 28,32 MB | failed |
| `441dca43` | 14 | **340,94 MB** | 28,32 MB | failed |
| `6ddde024` | 14 | **317,39 MB** | 28,32 MB | failed |
| `ea4cd005` (dele) | 5 | 128,94 MB | 28,32 MB | **ready** |
| `4e800ba2` (dele) | 1 | 24,62 MB | 24,62 MB | **ready** |
| 12 sucessos de outros alunos, 14–15 refs | 14–15 | **0,76 – 108,61 MB** | até 12,79 MB | ready |

A separação é limpa: **≤ 128,94 MB funciona, ≥ 317,39 MB falhou 3/3**, e falhou nas **duas
famílias de modelo** (`seedream` e `gpt-image-2`), o que descarta defeito de um modelo só.
Os arquivos são originais de câmera (`DSCF####`), ~24 MB cada. E os sucessos dele usam
**fotos do mesmo conjunto** — logo arquivo individual presta; o que não passa é a soma.

**Limite da minha afirmação, dito na cara:** o limiar **exato** não está provado, e eu não
vou prová-lo gastando GPU/crédito num teste controlado. O que está provado é a separação
acima, não o número de corte do Kie.

### Duas hipóteses minhas que eu derrubei antes de reportar

- **"14 referências é demais"** → **falso**. 15 refs deram `ready` **20 vezes para 11
  alunos**; 14 refs, 4 vezes para 3 alunos. A contagem não separa nada. (Cheguei nela
  sozinho, pela correlação óbvia do caso, e caí no mesmo lugar onde o Vigia já tinha caído.)
- **Armadilha da extensão `.jfif`** (`edc50dc6`) → **falso**, as 14 são `.jpg`/`.jpeg`.

### O defeito NOSSO é outro, e é pior que o buraco no regex

A mensagem que o aluno **lê** na falha é:

> *"Não foi possível gerar esta imagem. Os créditos cobrados foram devolvidos
> automaticamente. **Tente de novo em alguns minutos**."*

Para uma falha **determinística** isso é falso — e **foi essa frase que produziu as 3
tentativas**, ou seja, a própria rajada que abriu este chamado. É o mesmo padrão já
documentado no `2c5bab42` (a recusa que mandava reenviar a mesma gravação). Somado a isso,
`generate/route.ts` valida **só a contagem** (`MAX_REFERENCE_IMAGES = 15`, linhas 57 e 93)
e **nunca os bytes**: aceitamos o envio, debitamos, falhamos e mandamos repetir.

### Decisão minha, CONTRA a recomendação que estava no chamado

O chamado recomendava **ampliar o regex de transiente** (`sync.ts:28`) para casar
`"task id is blank"` e assim disparar a retentativa automática. **Rejeito.** O buraco no
regex existe e foi bem medido pelo Vigia, mas fechá-lo **aqui piora o caso**: manda a
retentativa reenviar um payload deterministicamente grande demais, gasta uma segunda
chamada ao Kie e **atrasa o estorno** do aluno. Retentativa não conserta entrada inválida.
Deixei a proibição explícita no card pro `coder`, com o motivo — se ele discordar, tem que
escrever o porquê na entrega, não mudar por conta própria.

### O que fiz

1. **Escrevi pro aluno** (Esney Menezes, conta criada hoje 13:06Z, trial até 06/09).
   Assumi o erro da mensagem falsa, confirmei que **nada ficou cobrado** com o saldo na
   mão, e dei a regra prática que resolve: **peso somado, não quantidade** — foto de
   celular/WhatsApp pode várias, original de câmera poucas por vez. **Sem prometer data**,
   porque promessa de data sem dono foi exatamente o que deixou o Johnathan esperando 23h.
2. **Card `2a5abca5` pro `coder`**: teto de bytes no `generate/route.ts` **antes** de
   debitar, mensagem útil em pt-BR, **fail-open** se o `HeadObject` falhar (o objetivo é
   evitar cobrança inútil, não criar porta nova de travar aluno), testes, e proibição de
   mexer no regex. Branch `feat/imagens-teto-payload-refs` + PR base `main`, sem merge
   sozinho.

### Por que NÃO fechei

O aluno está atendido e o dinheiro está certo, mas **o defeito de código não está em
produção** — regra 14: `fixed` só quando resolvido. Fica `investigating` **com causa achada
e dono definido**. Próxima ronda: se o PR do card `2a5abca5` estiver mergeado na `main`,
fecha como `fixed` com o commit.

---

## 2. Varredura de saúde da fila

- **Fechados que voltaram a disparar:** só o **#8** (`acf8acd6`, "áudio insuficiente",
  `fixed` em 09/08, último disparo **22/08**) — a reincidência velha e conhecida. **Nada
  de 28–30/08.**
- Não abri chamado com causa na planilha, não reprocessei nada dela, não reabri nada.

## 3. `#192` (Robert Ros) — sexta ronda seguida travada no MESMO passo

**Passo que falta: alguém OUVIR os áudios.** ~18h desde a queixa (29/08 21:23Z), ~13h
desde que os 3 `.ogg` foram pro grupo (30/08 02:03Z). Não avancei **de propósito**:
veredito de qualidade de voz não é meu (regra 9-D), dataset/referência/treino já foram
medidos e fechados como íntegros, e existe promessa registrada ao aluno de que a resposta
viria "dando certo ou não". Inventar veredito seria o pior erro possível aqui.

Não é estar travado por preguiça: é o único item da fila cujo próximo passo **não tem
como ser meu**.

## 4. O que precisa de GENTE (segue igual, e a lista não andou desde as 12h44)

1. **#192 Robert Ros** — 18h esperando um ouvido humano. Áudios no grupo desde 02h03.
2. **#99 Luciano** — garantia vence **02/09, faltam 3 dias**; escalado 5× sem resposta.
3. **Johnathan** — decidir se alguém roda a voz dele no processo manual.
4. **Natanael** — o curso não é nosso produto (provado na Hotmart viva); ele já pediu 2×.

## 5. Limites e o que eu NÃO fiz

- **Não li a caixa do `suporte@` pra triagem** (ordem: a Fast marca como lido e nos
  atropelamos). A fonte foi a fila de incidents.
- **Não gastei GPU nem crédito**: não rodei geração de teste pra achar o limiar exato do
  Kie, e é por isso que o limiar continua sendo *indicado*, não *provado*.
- Não mexi em crédito, acesso, migration nem código de app com as minhas mãos — o fix vai
  por card, branch e PR.
- Não fechei incidente não resolvido. O #199 sai `investigating` porque **está**
  investigating; o #192 sai aberto porque **está** aberto.
