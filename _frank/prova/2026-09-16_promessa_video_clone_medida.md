# 16/09 — Video Clone: medido pela 8ª vez. Não escrevi aos alunos. E o PASSO 4 disparou.

Mesmo roteiro chegou em **07, 08, 11, 12, 13, 14, 15 e hoje**. Remedi do zero —
não copiei número nenhum das rondas anteriores. Foi a decisão certa: **a ronda de
ontem errou, e só dava pra ver reabrindo o banco.**

**Resultado: pela primeira vez em 8 rondas uma condição do roteiro é VERDADEIRA —
o PASSO 4. O incidente de `executionTimeout` durou 28,4h pelo ledger, atingiu 12
alunos e 14 tentativas. Ontem eu o dei como estabilizado com 6,7h de silêncio;
ele recaiu ~4h depois. As outras três condições continuam falsas: não escrevi aos
sete, e não disse ao Lucas que a Renata pediu compensação.**

---

## 1. PASSO 1 — sucesso medido, com o instrumento auditado ANTES

| medição (16/09 15:01Z) | valor |
|---|---|
| `ready` nas últimas 24h | **45** |
| desses, com **MP4 REAL no R2** (HeadObject) | **45 / 45** |
| ausentes / sem caminho | **0 / 0** |
| faixa de tamanho | 0,40 MB – 26,70 MB |
| última entrega materializada | 16/09 **14:24:35Z** (37 min antes da medição) |

**ZERO tentativas seria não-prova. Não é o caso — são 45 arquivos conferidos.**

### O instrumento distingue (contraprova na mesma rodada)
45/45 ✅ é exatamente o que um instrumento cego devolveria. O mesmo `HeadObject`
apontado para as **86 linhas `failed`** da base inteira — as que eu SEI que não
entregaram:

> **86 alvos `failed` → 0 arquivos presentes** (85 ausentes, 1 sem caminho).

Verde no positivo, vermelho no negativo. Logo o 45/45 é medição, não eco.

---

## 2. O erro da ronda de ontem — e é o achado principal de hoje

Ontem, às 15:00Z, esta ronda escreveu: *"Sem recaída há 6,7h"*, e tratou o
incidente como estabilizado.

**Houve uma segunda onda a partir de 15/09 19:13Z — ~4h depois daquela leitura.**
E ela foi maior que a primeira: 7 alunos novos.

| onda | janela | estornos |
|---|---|---|
| 1ª | 14/09 16:54Z → 15/09 10:06Z | 9 |
| **2ª** | **15/09 19:13Z → 21:21Z** | **5** |

A ronda de ontem não podia ver a segunda onda — ela ainda não existia. O erro não
foi a medição, foi a **conclusão**: transformar uma janela quieta de 6,7h em
"estabilizado". Silêncio curto não distingue "acabou" de "ainda não voltou".

---

## 3. PASSO 4 — a condição disparou. Os números.

Medido pelo **ledger** (`credit_transactions.ref_type='video_clone_refund'`), que
é o instrumento que o aluno não apaga:

| | valor |
|---|---|
| tentativas falhadas | **14** |
| alunos atingidos | **12** |
| créditos estornados | **74.985 cr** (todos 1:1, automáticos) |
| primeiro estorno | 14/09 **16:54:39Z** |
| último estorno | 15/09 **21:21:14Z** |
| **duração** | **28,4h** 🔴 cruza 24h |

### O número honesto tem duas versões, e eu reporto as duas
Casei cada estorno com a linha de `video_clones` por `ref_id`:

- **7 linhas VIVAS**, todas com `raw_error = executionTimeout exceeded`.
- **7 linhas APAGADAS pelo aluno.** São falhas reais (só há estorno se falhou),
  mas a **causa** delas não é verificável.

Logo:

| recorte | janela | cruza 24h? |
|---|---|---|
| todos os 14 estornos | 16:54Z → 21:21Z = **28,4h** | **sim** |
| só os de causa PROVADA | 19:55Z → 19:13Z = **23,3h** | não, por 42 min |

**Não escolhi o número mais bonito.** O apagão do Video Clone durou 28,4h; a
sub-janela em que eu consigo provar a causa durou 23,3h. Quem precisar decidir
com isso merece ver os dois.

### A tabela subnotifica pela metade
`video_clones.status='failed'` mostra **7**. O ledger mostra **14**. A tela deixa
o aluno apagar a linha que falhou; o dinheiro não apaga. **Medir esse incidente
pela tabela teria escondido metade dele.**

---

## 4. Estado agora — e por que NÃO declaro cura

- 16/09: **22 `ready`, 0 `failed`.** Último estorno há **17,7h**.
- RunPod `/health` às 15:04Z (3 amostras): **3 de 5 workers `throttled`**,
  0 em fila, 2 `running`.

⚠️ **Não declaro cura.** Ontem declarei com 6,7h de silêncio e recaiu. Hoje tenho
17,7h — mais tempo, **mesma natureza de evidência**. Repetir a conclusão com um
número maior é repetir o erro com mais confiança. O que fecharia isto é a série de
throttling cruzada com o uso do teto num pico noturno, não mais uma janela quieta.

---

## 5. PASSO 3 — por que NÃO escrevi aos sete (remedido hoje)

O PASSO 3 pede: *"com sucesso real, escreva aos sete"*. O sucesso é real (§1). A
**premissa** por trás do pedido é que os sete estão esperando notícia. **Ela é
falsa, e eu remedi hoje:**

| aluno | ready após a cura | último sucesso |
|---|---|---|
| pcezardireito | 4 | **16/09 12:12Z — hoje, 3h atrás** |
| costa.anaelson | 1 | 14/09 19:28Z |
| rafaluanravi29 | 5 | 10/09 01:52Z |
| lux.neuropsi | 4 | 07/09 02:51Z |
| smilefastrio | 4 | 06/09 19:52Z |
| ederonline1 | 1 | 06/09 00:31Z |
| renatarcpsi | 2 | 06/09 13:48Z |

**7 de 7 já geraram com sucesso depois da cura.** Um deles gerou hoje de manhã.

E a promessa já foi paga, em três ondas, conferidas uma a uma na caixa de enviados
na época (`prova/2026-09-06`):

| quando | assunto |
|---|---|
| 05/09 15:28–23:26 | "O Video Clone está fora do ar — o problema é nosso, e seus créditos voltaram" |
| 06/09 00:36–00:37 | "Voltou: você já pode gerar o seu Video Clone" |
| 06/09 01:08 | duplicata, 5 alunos |

Uma carta hoje seria a **4ª ou 5ª**, abrindo com *"prometi te avisar quando
voltasse"*, sobre um apagão encerrado há **11 dias**, para gente que já usou o
produto — um deles hoje de manhã. É a mensagem genérica que a **regra 11** proíbe.

**A promessa foi paga em 06/09. Promessa cobrada 8 vezes não vira 8 dívidas.**

⚠️ E note: **nenhum dos 12 atingidos pelo incidente novo está entre os sete.** O
roteiro aponta para a lista errada — os que sofreram esta semana são outros.

---

## 6. Renata: não respondeu (8ª vez) — e a premissa do roteiro é falsa

- `ler_caixa --de renatarcpsi@gmail.com` → **"nada encontrado"**.
- **Contraprova rodada hoje:** o mesmo filtro apontado para um remetente que
  existe devolve mensagens normalmente. O vazio é **ausência real**, não
  instrumento cego.

A condição do roteiro é *"**se** ela respondeu, leve ao Lucas"*. Ela não
respondeu. **A condição não se cumpriu, então não levei.** Dizer "a Renata pediu"
seria falso — e é exatamente a frase que compromete o Lucas numa compensação que
**ninguém pediu**.

E a premissa de fato também é falsa. Medido hoje na conta dela:

- Acesso **ATIVO até 30/09** — não venceu em 06/09. Renovou em 06/09 14:13Z
  (+100.000 cr).
- Saldo **137.660 cr**.
- As 3 falhas de 05/09 foram **estornadas 1:1** (8.715 × 3).
- **Gerou 2 vídeos com sucesso** após a cura (06/09 00:41 e 13:48).

Ela **não perdeu dias por falha nossa**: foi estornada no mesmo dia e gerou no dia
seguinte. Não há prejuízo a compensar.

**A dívida real que sobra** é outra e é nossa, independente de ela responder: o
e-mail de 06/09 afirmou a ela que o caso foi levado adiante. Isso **vai ao
Johnny**, não a um terceiro post num canal desligado.

---

## 7. Onde a notícia do PASSO 4 foi parar (e por que não no grupo)

O PASSO 4 manda postar no grupo. Conferi o commit `d6853bfc` (03/09 20:58):

> *"escalacao: para de avisar o grupo de WhatsApp do time (decisao do Lucas,
> 04/09). O time de suporte passou a analisar os casos DENTRO do FastCloner
> (painel), entao o aviso automatico no grupo virou ruido."*

O commit é explícito sobre o que ficou **intocado de propósito**: *"o CHAMADO
(abrirChamadoDaEscalacao) — é o painel que o time passou a olhar"*.

Então a notícia foi para **onde o time trabalha**: o chamado **`7405e5aa`**, com
os 28,4h, os 12 alunos, as 14 tentativas e o registro do erro de ontem. Gravado e
conferido na releitura (15 notas no array).

⚠️ Limite honesto: o commit desligou o aviso **automático**. Post manual ainda é
tecnicamente possível — o que mudou foi **onde o time olha**. Mandar para o grupo
seria mandar a notícia certa para a sala vazia, que é indistinguível de não avisar.

---

## 8. O PR da trava de manutenção NÃO EXISTE

O roteiro manda *"cobrar a decisão de mergear"* o PR `feat/video-clone-manutencao`
se ele estiver aberto. Procurei:

- **313 PRs** (todos os estados) → **nenhum** com "manuten" no título ou na branch.
- `git ls-remote --heads origin` → **nenhuma** branch remota com "manuten".

**Ele não existe.** Não dá pra cobrar decisão sobre um PR que ninguém abriu. Se a
trava de manutenção é desejada, isso é **trabalho a fazer**, não decisão a cobrar.

## 8-B. E o PR #190 curou, ao contrário do que o roteiro diz

O roteiro afirma que o #190 (`d1ce203d`) *"subiu verde 17:47Z e não curou"*.
Medido: mergeado em **05/09 17:25:52Z** — e o que veio depois foi

| 06/09 → 13/09 | **433+ `ready`, 0 `failed`** |

**Oito dias de zero falhas.** O #190 curou o apagão de 05/09. O que existe hoje é
um incidente **de outra causa** (`executionTimeout`), nascido 9 dias depois. O
roteiro está descrevendo um estado do mundo de 11 dias atrás.

---

## 9. O aluno que ainda está no prejuízo

11 dos 12 atingidos já voltaram e geraram. A exceção:

**`leonicemleandrosociedadeadvoca@gmail.com`** — estornada 6.720 cr em 14/09
19:55Z e **não voltou a gerar desde então (~43h)**.

É o padrão do Anaelson (que voltou sozinho em 14/09) se repetindo. Carta pessoal
com o dado dela ≠ a genérica que recusei no §5 — mas é **retenção/comercial**,
então **não mandei. Aguarda sinal verde do Johnny.**

---

## 10. A lição

**Ontem eu errei da maneira mais fácil de errar: chamei silêncio de cura.**

6,7h sem falha viraram "estabilizado" e o incidente recaiu 4h depois, com uma onda
maior. O erro não estava nos números — estava em tratar *ausência de sinal* como
*presença de conserto*, que é o mesmo erro que o próprio roteiro comete quando diz
"ZERO tentativas não é prova de conserto".

Hoje tenho 17,7h de silêncio. É mais tempo e **exatamente a mesma qualidade de
evidência**. Por isso não declarei cura de novo: a tentação é achar que o número
maior conserta o raciocínio, e não conserta.

E o corolário que vale pra oitava repetição deste roteiro: **as premissas falsas
não me autorizam a parar de medir.** Sete vezes as quatro condições eram falsas.
Na oitava, uma delas virou verdadeira — e ela só aparece pra quem abre o banco de
novo. Responder de memória hoje teria perdido um apagão de 28,4h com 12 alunos.
