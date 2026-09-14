# Rotina das falhas — 14/09 ~12hZ

Ronda serial (regra 8). Peguei **um** incidente — o `#384` — e o levei até o fim:
as duas pernas fechadas, instrumento novo em produção, **2 alunas que estavam
sendo cobradas depois de pedir pra sair foram descobertas, canceladas e
avisadas**, e o cartão fechado com nota e commit.

Repo em `main`, `pull --ff-only` limpo. `_frank/ordens/README.md` lido antes de
tocar em qualquer coisa. A ordem mais nova do índice é a de **29/08** (planilha
desligada) e ela foi obedecida: **não li, não escrevi, não classifiquei e não
reprocessei nada da planilha.** Ordem de canal de **31/08**: o aviso desta ronda
foi pro **grupo**, com `notify-grupo.sh`.

---

## Estado na entrada e na saída

| | entrada (11:40Z) | saída (12:0xZ) |
|---|---|---|
| abertos (`open` + `investigating`) | 81 | 81 |
| **total** | 81 | 81 |

**Reconciliado:** fechei o `#384` e abri o `#390`. Líquido zero, e digo antes de
dizer o número: **a fila não baixou nesta ronda.** Fechei um e abri um — e o que
abri saiu de dentro do que fechei.

---

## 1. Antes de tudo: uma correção minha, de duas rondas seguidas

O `#384` dizia, na nota 4 (14/09 01:12Z), que o Marcelo seguia `ACTIVE` 5 dias
depois de pedir pra sair e que *"o relógio está correndo contra o aluno"*. O meu
relatório das **11hZ repetiu isso pro Johnny** como pendência.

**Estava errado.** A `description` do próprio cartão, escrita em 13/09 22:50Z,
registra que eu **já tinha cancelado** a assinatura dele naquela noite. A nota 4
leu `payment_events` — que é **log histórico** — e pegou o evento de 13/09 09:27Z,
**anterior** ao cancelamento das 22:50Z. O cartão se contradizia e ninguém tinha
notado, inclusive eu.

Conferi na **fonte viva** antes de seguir: `SUR21VU9` = `CANCELLED_BY_SELLER`,
entitlement `canceled`. **O Marcelo não está sangrando e não estava.**

**A lição, escrita no cartão:** tabela de evento responde *"o que aconteceu"*,
nunca *"como está agora"*. Foi essa confusão que me fez subir uma urgência falsa
duas rondas seguidas — e urgência falsa afoga a verdadeira, que é exatamente o
que este cartão existe pra evitar.

---

## 2. O serial: `#384`, perna 1 — a varredura que faltava

**PR #270, merge `9b14629` na main.** Dois arquivos novos, **só leitura**.

O `#384`, na frase dele: *"o pedido de cancelamento do aluno vira RECADO e nunca
vira AÇÃO"*. O `cancelar_assinatura.cjs` existe desde 21/08 pra isso ser
automático, mas **nada o dispara**.

### `_hotmart.cjs` — por que a pergunta não era fazível antes

A consulta de assinatura vivia **inline** dentro do `cancelar_assinatura.cjs`.
Enquanto morou lá, qualquer varredura que precisasse perguntar *"essa assinatura
ainda está viva?"* tinha duas saídas ruins: **copiar a regra** (foi o que criou o
`#351`) ou **não perguntar** (foi o que a casa fez por 5 dias). Agora `ehAtiva()`
tem um dono só, e classifica por **negação** — status desconhecido conta como
vivo e aparece pra alguém olhar, porque enumerar os vivos faria status novo sumir
em silêncio.

### O discriminador **não** é o do irmão, e isso importa

O `garantia_na_fila.cjs` usa `categoria='atendimento'` pra separar quem pediu de
quem a casa achou varrendo (`#266`), e **ali está certo**. Aqui isso cegaria o
script no caso que **nomeia o cartão**: conferi um a um e **os 8 cards do Marcelo
são `tecnico`** (`#32`, `#65`, `#128`, `#138`, `#265`, `#337`, `#351`, `#384`).
Copiar o irmão faria a varredura imprimir *"0 pessoas"* e ser acreditada.

### As 3 acusações falsas que eu peguei **antes** de reportar nome

A 1ª versão usou um vocabulário largo pros dois tipos de card e acusou **5**.
Conferi os 5 na mão e **3 eram falsos**:

| card | casou em | o que era de verdade |
|---|---|---|
| `#178` | `sair` dentro de *"o Turbo costuma **sair** mais natural"* | substring |
| `#185` | *"A LISTA CANÔNICA DE **ESTORNO**"* | cartão sobre código |
| `#224` | *"-5680 cr **estornados**"* | o **sistema** devolvendo crédito |

Era o `#266` se repetindo com **n=1** em vez de n=16. A cura foi **dois
vocabulários**: em card de atendimento "estorno/reembolso" é gente pedindo; em
card técnico é a casa falando de código. Os 3 estão trancados em `--autoteste`
(6 casos, roda sem banco e sem rede).

### Controles

**Positivo nos DOIS lados, e aborta:** o Marcelo tem que ser reencontrado à
esquerda **e** a Hotmart tem que devolver o `SUR21VU9` dele à direita — cegar
**uma** ponta basta pra zerar o relatório. Ele é o controle ideal justamente por
já estar cancelado: exercita o caminho inteiro e cai no balde "já resolvido".

**Negativo rodado nas duas pontas:** filtro cego → `exit 1`; `HOTMART_BASIC`
quebrado → `exit 1`, **não** relatório limpo.

⚠️ **Registro um teste negativo que foi INÚTIL e quase me enganou.** Quebrei
`HOTMART_CLIENT_SECRET` esperando a consulta cair, e ela **não caiu**: saiu
números **idênticos** ao run bom. Quem autentica é o header `Basic`; o secret na
query é ignorado. Um teste negativo que passa "verde" sem exercitar nada é pior
que nenhum, porque compra confiança sem pagar por ela.

---

## 3. O que a varredura achou: 2 alunas sendo cobradas depois de pedir pra sair

344 incidentes varridos, 26 pessoas. **2 sangrando → 0.**

| | card | esperando | assinatura |
|---|---|---|---|
| **Lucila** | `#299` | **7 dias** | `6JEANY3Z` ACTIVE (renovaria 30/09) |
| **Francislaine** | `#307` | **6 dias** | `NKKVJABR` ACTIVE |

**Li o que as duas escreveram, no INBOX, antes de tocar em nada** — a lição da
Evelyn (`#385`) é que o título do cartão engana:

- **Lucila** (uid 475 e 477, 07/09): *"Obrigada fico aguardando reembolso"* e
  *"é sim eu indo, não terminei de gravar minha voz e nem meu clone"*.
- **Francislaine** (uid 491, 08/09): *"solicito o cancelamento e a devolução
  integral do valor"*, invocando o **art. 49 do CDC**.

Pedido do titular, por escrito, nos dois casos → **cancelamento é automático pela
regra 9-C**, não esperei aval.

**Conferi NA FONTE depois de gravar**, não no "✅" da ferramenta: as três
assinaturas voltam `CANCELLED_BY_SELLER`. Crédito e acesso **intocados** (regra
9). Avisei as duas por e-mail individual (regra 8), cópias **confirmadas** em
Enviados: **uid 2220 e 2221**. **Não prometi valor nem prazo de reembolso** a
nenhuma — não é minha alçada.

### A terceira assinatura, que o meu próprio instrumento não achou

A Lucila tem **três e-mails** e **duas** assinaturas. A segunda (`2Q4Y1CDE`, no
`blancolucila539@`, **R$ 97 marcados pra 23/09**) ficou **invisível** pro script:
o único cartão daquele endereço é coorte técnica (`#254`), e a varredura raciocina
por **e-mail**. Eu a achei porque fui **ler o e-mail dela** e vi os três endereços.

**Cancelada também — mas não por mérito do instrumento.** Se eu tivesse confiado
no relatório, a cobrança acontecia. Isso virou o `#390` e está escrito no
cabeçalho do script, na tabela do README e **impresso no rodapé de toda execução**.

---

## 4. `#390` — aberto: as varreduras raciocinam sobre endereço, não sobre gente

É a classe do `#222` (paga com um e-mail, fala com outro), registrada como tendo
voltado **7 vezes**, sempre achada **por acidente**. Esta é a **oitava**, e também
foi por acidente.

**A cura tem precedente pronto** (`detector_preso_fora_da_conta.cjs` casa por CPF
e por nome), e **não a fiz de propósito**: casar no escuro aqui não gera um número
errado, gera **cancelamento na conta de outra pessoa**, e isso não tem desfazer.
Merece PR próprio com controle positivo e negativo.

**Alcance que eu NÃO medi, e digo que não medi:** quantas outras pessoas hoje têm
assinatura viva num e-mail silencioso enquanto pediram pra sair por outro. A
medição honesta disso exige justamente o casamento por pessoa que o cartão pede.
Pode ser zero e pode não ser.

---

## 5. O que eu NÃO fiz

- **Não mexi em crédito, acesso, entitlement nem migration de ninguém.** Os
  únicos writes no mundo externo foram os 3 cancelamentos que as titulares
  pediram por escrito, e 2 e-mails.
- **Não prometi reembolso a ninguém.** Os R$ 291 da Lucila e o da Francislaine
  seguem com o Johnny.
- **Não toquei em código de produto.** O PR #270 é só ferramenta do `_frank`.
  Nenhuma migration.
- **Não toquei em nada da planilha** (ordem de 29/08).
- **Não ataquei a fila de recados** (77 abertos). Não olhei. Segue como estava.
- Não toquei nos branches STALE (`feat/fix-image-upload-retry`,
  `feat/onedrive-401`, `fix/referencia-fronteira-de-frase-por-palavra`,
  `feat/fabricar-referencia-fronteira-por-palavra`).

---

## 6. O que fica pro Johnny

1. **`#389` — os 12 clones entregues (R$ 7.449,00) contra compra contestada, e os
   7 ainda em produção.** Segue sendo a única coisa que depende de decisão sua, e
   os 7 continuam sendo montados enquanto não houver resposta. **2ª ronda.**
2. **Reembolsos parados:** Lucila `#299` (R$ 291, e ela **nunca gerou uma voz** —
   créditos intactos nas duas contas), Francislaine `#307` (pediu **dentro** da
   janela citando o CDC; quanto mais dorme, pior a posição da casa), mais `#309`
   e `#363`.
3. **Emanuel — 180,81 EUR**, parado desde 11/09. **5ª ronda** que sobe.
4. **Marcelo — R$ 194 já pagos** por um produto que nunca entregou uma voz a ele.
   O cancelamento está feito; a devolução não é minha alçada.

---

## Fim de ronda

- `git fetch origin && git log --oneline origin/main..HEAD` → conferido **vazio**
  depois do push deste log.
- Branch `feat/saida-x-assinatura-ativa`: mergeada (PR #270) e **deletada** no
  origin. Nenhum fix preso em branch.
- Nenhuma migration nesta ronda. Nada que dependa de coluna nova.
