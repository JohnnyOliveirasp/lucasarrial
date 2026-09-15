# 15/09 — Video Clone: medido pela 7ª vez. Não escrevi aos alunos.

Mesmo roteiro chegou em **07/09, 08/09, 11/09, 12/09, 13/09, 14/09 e hoje**.
Remedi do zero — não copiei número nenhum das rondas anteriores.

**Resultado: pela primeira vez em 7 rondas o roteiro esbarrou em algo VERDADEIRO
— mas não o que ele descreve. O apagão de 05/09 continua encerrado há 10 dias.
O que existe é um incidente NOVO, de outra causa, que o roteiro não conhece: 9
gerações mortas por `executionTimeout` entre 14/09 16:54Z e 15/09 08:26Z,
atingindo 8 alunos. Já ticketado (#404). Sem recaída há 6,7h.**

**As quatro condições do roteiro continuam falsas. Não escrevi aos sete, não
postei no grupo, não disse ao Lucas que a Renata pediu.**

---

## 1. PASSO 1 — a prova de sucesso (e a auditoria do instrumento ANTES)

| medição (15/09 15:00Z) | valor |
|---|---|
| `ready` nas últimas 24h | **58** |
| desses, com **MP4 REAL no R2** (HeadObject) | **58 / 58** |
| suspeitos (<100KB) / ausentes | **0 / 0** |
| última entrega materializada | 15/09 **14:50:38Z** (10 min antes da medição) |

**ZERO tentativas seria não-prova. Não é o caso — são 58 arquivos conferidos.**

### 1-A. O instrumento foi auditado HOJE, antes de eu acreditar nele
58/58 ✅ é exatamente o que um instrumento cego devolveria. Rodei a contraprova
(`_Bugs/2026-09-13_contraprova_instrumento_r2.cjs`), que aponta o **mesmo**
HeadObject pras linhas `failed` — as que eu SEI que não entregaram:

> **85 alvos `failed` → 0 arquivos encontrados** (1 sem caminho).

O instrumento **distingue**. Logo o 58/58 é medição, não eco.

---

## 2. O achado de hoje: um incidente NOVO, que não é o apagão do roteiro

8 dias de **zero falhas** (06/09 → 13/09) e aí uma causa nova:

| dia | ready | failed | causa |
|---|---|---|---|
| 05/09 | 8 | 24 | apagão antigo (`transformers`, curado pelo #192) |
| 06→13/09 | 433+ | **0** | — |
| 14/09 | 72 | **5** | **`executionTimeout`** |
| 15/09 | 18 | **2** | **`executionTimeout`** |

`raw_error` das 7 linhas: **`executionTimeout exceeded`**, 100% delas.

### Medido pelo DINHEIRO, que é o instrumento que não apaga
A tela deixa o aluno apagar a linha que falhou; o ledger não apaga. Por isso a
tabela subnotifica — de novo:

| instrumento | tentativas | alunos |
|---|---|---|
| `video_clones.status='failed'` | 7 | 7 |
| `credit_transactions.ref_type='video_clone_refund'` | **9** | **8** |

`welrisson@gmail.com` tem **2 estornos sem linha nenhuma** (14/09 16:54Z e
17:43Z) — apagou as duas. É por isso que a janela real começa **~16:54Z**, e não
19:01Z como a tabela sugere.

- **Janela: 14/09 ~16:54Z → 15/09 08:26Z = ~15,5h.** Não passou de 24h.
- **53.620 cr estornados, todos 1:1, automáticos.** Nenhum aluno no prejuízo.
  Regra 6 cumprida sem intervenção.

---

## 3. A causa: o teto NÃO é o culpado — a GPU ficou lenta

O cartão #404 nasceu com uma pergunta aberta (item 4): *qual é a folga real?* A
casa não sabia, porque `elapsed_seconds` só era gravado quando o job FALHAVA
(0 de 1.986 entregas prontas tinham duração).

**Esse buraco fechou às 00:16Z de hoje** — o patch do Vigia (`dcc6653a`) subiu e
já produziu 17 entregas prontas com duração. A pergunta virou número:

| janela | uso do teto | folga (teto − gasto) | GPU-s por s de áudio |
|---|---|---|---|
| saudável (após 09hZ, 10 entregas) | 7,6% – 61,5% | **19 a 35 min** | **23,9** |
| ruim (00h–04hZ, 7 entregas) | 58,4% – **100,0%** | **0 a 8 min** | **44,5** |
| as 9 mortas | **99,2% – 100,4%** | **0** | >30 |

O orçamento do teto é **30** GPU-s por segundo de áudio (`config.ts:99`). A
janela ruim rodou **acima** do orçamento; a janela boa roda bem abaixo.

> **O teto tem ~19 min de folga em operação normal. O que colapsou foi a folga,
> não o teto que encolheu.**

Uma entrega chegou a **100,0% do teto e ainda assim terminou** (1950 frames,
59,0 min) — a distribuição ficou montada exatamente em cima da linha.

### O mecanismo, medido ao vivo
`GET /v2/9get7wv7trn3wg/health`, 3 amostras às 15:04–15:05Z:

```
{idle:0, ready:0, running:1, throttled:4, unhealthy:0}  →  throttled:3
```

**4 de 6 workers `throttled`** = a RunPod não está conseguindo alocar GPU. Job
alonga → estoura o teto. Fecha com os 44,5 GPU-s medidos.

⚠️ **O que eu NÃO provei:** medi o throttling *depois* do incidente. Não existe
série histórica, então isto é correlação forte com mecanismo plausível, **não
causalidade provada**. Deixei isso escrito no cartão em vez de vender como
conclusão.

**E consertei a falta de série:** `_Bugs/2026-09-15_amostra_throttling_runpod.cjs`
+ cron de hora em hora. Custo zero de token, só observa. No próximo pico noturno
dá pra cruzar `throttled` com o uso do teto e fechar ou derrubar a hipótese.
A ferramenta **aborta** se faltar credencial (testado, exit 1) — nunca devolve
"0 throttled", que seria a leitura tranquilizadora errada.

---

## 4. A armadilha no título do próprio cartão #404 — corrigida

O título diz que cada morte ficou *"entre +2,8s e +11,8s do próprio teto
calculado"*. Isso convida o conserto errado: **"então sobe o teto 12s"**.

**Não.** O job foi **morto no prazo** — o `elapsed` dele *é* o teto, por
construção. Os +2,8s são latência de medição, **não o quanto faltava pra
terminar**. De um job morto não dá pra saber se faltavam 10s ou 40min.

Quem dimensionar o teto por esse número está lendo **a régua de quem matou**,
não a necessidade de quem morreu. Registrado no cartão.

---

## 5. Por que NÃO escrevi aos sete (remedido hoje, não herdado)

Os sete do roteiro foram avisados da volta em **06/09**, vários duas vezes. Não
me apoiei nisso: fui ao banco ver **uso**, que é o argumento forte.

| aluno | gerações OK após a cura | último sucesso |
|---|---|---|
| rafaluanravi29 | 5 | 10/09 01:52Z |
| smilefastrio | 4 | 06/09 19:52Z |
| lux.neuropsi | 4 | 07/09 02:51Z |
| pcezardireito | 2 | 06/09 19:17Z |
| renatarcpsi | 2 | 06/09 13:48Z |
| ederonline1 | 1 | 06/09 00:31Z |
| costa.anaelson | 1 | **14/09 19:28Z** |

**Os 7 de 7 já geraram com sucesso depois da cura.** Uma carta hoje seria a 3ª
ou 4ª, abrindo com *"prometi te avisar quando voltasse"*, sobre um apagão
encerrado há **10 dias**, pra gente que **já usou o produto**.

A promessa foi paga em 06/09. **Promessa cobrada 7 vezes não vira 7 dívidas.**

### O caso Anaelson fechou sozinho
Nas rondas de 13/09 e 14/09 ele era *"o único dos 9 que não voltou"* (8 dias de
silêncio) e estava pendurado esperando sinal verde pra uma carta de retenção.
**Ele voltou sozinho em 14/09 19:28Z e gerou com sucesso.** A carta que eu não
mandei deixou de ser necessária. Fica a lição: pressa pra escrever teria gasto
um contato comercial num problema que se resolveu sem nós.

---

## 6. Renata: continua sem responder — e o filtro foi testado de novo

- `ler_caixa --de renatarcpsi@gmail.com` → **"nada encontrado"** (7ª vez).
- A condição do roteiro (*"se ela respondeu, leve ao Lucas"*) **não se cumpriu**.
  Não vou dizer "a Renata pediu" — seria falso, e é exatamente a frase que
  compromete o Lucas numa compensação que **ninguém pediu**.
- A premissa do roteiro também segue falsa: o acesso dela **não venceu** em
  06/09 — ela renovou, está `active`, e **gerou 2 vídeos com sucesso** após a cura.

**A dívida real que sobra** é outra: o e-mail de 06/09 afirmou a ela que o caso
foi levado adiante. Isso é nosso, independente de ela responder. Já foi ao grupo
em 07/09 e 08/09, **sem resposta** — e ver §7 sobre *por que* não teve resposta.
**Vai ao Johnny, não a um 3º post.**

---

## 7. PASSO 2/3/4 pedem "poste no grupo" — o Lucas desligou esse canal em 04/09

Achado que muda a leitura das rondas anteriores. O commit `d6853bfc`:

> *"escalacao: para de avisar o grupo de WhatsApp do time (decisao do Lucas,
> 04/09). O time de suporte passou a analisar os casos DENTRO do FastCloner
> (painel), entao o aviso automatico no grupo virou ruido."*

O canal que o roteiro manda usar foi **deliberadamente desligado pelo sócio**, e
o time foi movido pro **painel/chamado**. Isso explica retroativamente por que os
posts sobre a Renata em 07/09 e 08/09 morreram sem resposta: **não foram
ignorados — foram pra um canal que o time parou de olhar.**

Por isso a notícia de hoje foi **pro chamado #404**, que é onde o time trabalha,
e não pro grupo. O roteiro descreve um fluxo de antes de 04/09.

⚠️ Limite honesto: o commit desligou o aviso **automático** (`notifyTeamEscalation`);
post manual ainda é tecnicamente possível. O que mudou foi **onde o time olha**.

### E o PASSO 4 não dispara de qualquer jeito
"Se o apagão passou de 24h, é notícia por si": o de 05/09 durou **8h25m** e
acabou há 10 dias; o novo durou **~15,5h**. **Nenhum dos dois cruza 24h.**

---

## 8. O aluno que ainda está no prejuízo — e não é dinheiro

7 dos 8 atingidos **já voltaram e geraram com sucesso**. A exceção:

**`leonicemleandrosociedadeadvoca@gmail.com`** — esperou **52,1 min**, o job
morreu, foi estornada (6.720 cr, 14/09 19:55Z) e **não voltou desde então (~20h)**.

É o padrão do Anaelson se repetindo. Carta pessoal com o dado dela ≠ a genérica
que recusei no §5 — mas é **retenção/comercial**, então **não mandei**.
**Esperando sinal verde do Johnny.**

---

## 9. O que mudou desde 14/09

1. **O PR #251 saiu do limbo**: estava parado 48h nas duas rondas anteriores,
   foi **mergeado às 02:20Z de hoje**. O buraco da paginação fechou.
2. **Apareceu uma causa de falha inédita** (`executionTimeout`), a primeira em
   29 dias, depois de 8 dias de zero falhas.
3. **A folga do teto deixou de ser opinião** — o patch do Vigia entrou em
   produção às 00:16Z e eu medi (§3). O item 4 do #404 está respondido.
4. **O throttling passou a ter série histórica** (cron de hora em hora).
5. **O Anaelson voltou sozinho** — o caso de retenção mais antigo fechou.

---

## 10. A lição

**O roteiro mais repetido é o que mais precisa de medição nova, não de menos.**

Seis vezes esse roteiro chegou e seis vezes as quatro premissas dele eram falsas.
A tentação na sétima é óbvia: responder de memória, "já medi isso, continua
curado". **Se eu tivesse feito isso hoje, teria perdido um incidente ativo** com
8 alunos e 9 gerações mortas — porque ele não estava no roteiro, não estava na
medição de ontem, e só aparece pra quem abre o banco de novo.

E o corolário: **o canal também envelhece.** O roteiro mandava postar num grupo
que o sócio desligou há 11 dias. Obedecer ao pé da letra teria mandado a notícia
certa pro lugar onde ninguém lê — que é indistinguível de não avisar.
