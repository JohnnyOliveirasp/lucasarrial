# RONDA DAS FALHAS — 22/09/2026, ~00h40–01h20Z

Dono da fila (regra 14-A). Método serial da ordem de 21/08 (regra 8). Canal:
ordem de 31/08 — **tudo que é FastCloner saiu no GRUPO** (`notify-grupo.sh`),
nada no privado do Johnny. Ordem de 29/08 respeitada: **nada da planilha** foi
lido, escrito, classificado ou reprocessado.

**Cartões fechados nesta ronda: 0.** **Aluno respondido: 1 (Simone, #301).**
**Escalações ao grupo: 2 (Carlos #254 urgente, Simone #301).**
**Notas gravadas e conferidas: 2 (#254, #301).**

Fechei zero e digo isso na primeira linha de propósito. Os dois casos que
peguei estão **travados em decisão do Johnny**, não em trabalho meu — e a
regra 14 continua inteira: não marco `fixed` o que não resolvi.

---

## 0. Passos fixos da ronda — os dois limpos

| passo | resultado |
|---|---|
| `reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar` | 984 lidas · 907 já tinham linha · 77 fora da janela · **0 escrituráveis** · contagem fecha 984=984 |
| `enviados_x_tabela.cjs` (irmão de leitura, independente) | **VEREDITO: 0 carta depois do corte** ✔ |
| `percepcao_travada.cjs` (ordem de 17/09) | controle positivo OK (#310 reencontrado) · 504 incidentes varridos · **0 travado em percepção**, mais velho 0d |

As 77 anteriores a 14/09 14:06:31Z seguem **sem decisão**, como o README já
registra. Não mexi: `cobreDesde` é decisão de produção, não de ronda.

---

## 1. 🔴 Carlos (#254) — o prazo virou HOJE e ninguém respondeu

**Estado remedido ao vivo** (`assinatura_em_dobro.cjs`), idêntico ao de 18hZ:

| assinatura | dono | até | pago |
|---|---|---|---|
| `MY5O3KWB` (hotmail) | **ÓRFÃO** | 2026-09-22 | R$97 13/08 + R$97 28/08 |
| `UMJP7PDY` (gmail) | `38bf5777` | 2026-09-22 | R$97 28/08 |

R$291 pagos. **A perna órfã levou R$194 e não entregou crédito nenhum.**

**O que esta ronda acrescenta é o relógio.** A ronda de 21/09 18hZ escreveu
"cobra amanhã". Amanhã é hoje: as duas pernas renovam **22/09 12:00 UTC** e
faltavam **~11h20** quando escrevi. Conferi as rondas de 22h, 22h40, 23h,
23h40 e o vigia de 00hZ: **nenhuma tocou neste caso.** O pedido ao grupo de
18hZ ficou ~7h sem resposta e o prazo não esperou.

**Re-escalei ao grupo UMA vez**, com relógio duro e duas opções decidíveis:
(A) cancelar só a perna órfã, (B) autorizar a ligação. Sem dado pessoal na
mensagem — telefone e CPF ficam no cartão, não no Telegram.

**Por que eu não cancelo sozinho, por escrito de novo:** o `--orfa` do
`cancelar_assinatura.cjs` exige **pedido POR ESCRITO do titular** (linha 50 /
regra 9-C). O Carlos nunca respondeu, então a salvaguarda está **certa** em
barrar. Técnica pronta e ensaiada (card `32ffdf4c`); **falta autorização, não
falta técnica.** Não revogo salvaguarda de dinheiro sozinho.

**Achado lateral que corrige o vocabulário:** "canal esgotado" vale só pro
**e-mail** (10 cartas, 2 endereços, 0 resposta). Confirmei nesta ronda que o
**telefone existe e está preenchido** (`contato_do_comprador.cjs HP1582409804`).
Nunca foi usado. Não liguei: ação externa precisa do "pode".

**Não mandei a 11ª carta** — o canal está medido como esgotado e uma carta a
mais não acrescenta fato nenhum. Seria ruído, não zelo.

---

## 2. 🟠 Simone (#301) — 9 dias de silêncio NOSSO, e eu corrijo o que o cartão dava a entender

Peguei como item serial 2 pelo critério "nota mais parada" (9,1d).

**O silêncio era real e era nosso.** Última carta a ela: 12/09 (uid 2036).
Última mensagem dela: 12/09 14:20:52Z (uid 592, os dois comprovantes). Conferi
com `ler_caixa --de`: **ela não voltou a escrever.** Ou seja, ela fez o que a
casa pediu e ficou 9 dias sem resposta — **depois** de a carta de 11/09 22:49Z
prometer *"assim que você me mandar um dos itens acima eu sigo com ele até o
fim e te respondo, inclusive se a resposta for ruim"*. Promessa quebrada por 9
dias. Foi silêncio assim que fez a Viviana explodir.

**Abri os dois comprovantes e olhei eu mesmo** (tenho visão — não despachei o
que eu podia ver). `ler_caixa --anexos 592`, flags do uid 592 intactas
(`[\Seen]` antes e depois), não-lidos 0 antes e 0 depois:

- **R$ 672,00** — 31/08/2026 08:34 — Aprovada — 6x de R$ 112,00
- **R$ 303,40** — 31/08/2026 08:23 — Aprovada — 10x de R$ 30,34
- Cartão Virtual, SIMONE ANDRADE, final 5257. **Soma R$ 975,40.**

### ⚠️ A correção que esta ronda entrega no caso

A nota de 12/09 22:33Z diz "comprovantes recebidos, abertos e conferidos" e
conclui *"a bola está com quem decide devolução"*. **Os valores conferem — mas
as imagens NÃO LOCALIZAM O DINHEIRO**, e isso muda o que falta.

As duas telas são a tela do **banco dela**: valor, data, status, parcelamento,
cartão e "Pagamento: Online". **Não têm nome de estabelecimento, nem código de
transação, nem plataforma.** E as duas estão **cortadas exatamente** no ponto
em que o nome da loja costuma aparecer (logo abaixo de "Pagamento / Online").

Portanto *"temos o comprovante"* **não** significa *"sabemos em que conta o
dinheiro caiu"* — e era essa a leitura que o cartão permitia. Quem pegasse o
caso depois escalaria uma decisão que ainda não dá para tomar.

**Por isso a bola voltou pra mim, e eu joguei.** Escrevi a ela agora — Sent
**uid 3154**, cópia CONFIRMADA, registrado em `emails_enviados`
(`origem=ronda-manual`, chave `simone-301-falta-estabelecimento`). A carta
assume os 9 dias com todas as letras, confirma os dois valores conferidos por
mim, explica que a tela do banco não mostra o destinatário, e pede **uma coisa
pequena com três formas de dar**: (a) rolar aquela mesma tela e printar a parte
de baixo, (b) a linha da fatura com o descritor, ou (c) só dizer em que site
finalizou. Reafirma que o pedido vale a data **07/09**, que ela não perdeu
prazo, que não precisa reenviar foto/áudio e que ninguém vai pedir assinatura.
**Não prometi data de estorno** — continuo sem poder cumprir.

**Em que passo trava:** (a) resposta dela com o estabelecimento; (b) **decisão
e acesso do Johnny**, porque os R$ 975,40 entraram pelo processo antigo
(`sgp_pedidos e51653b8`) e não existem em Hotmart nem em `payment_events` —
remedido em 12/09 varrendo 7.186 vendas por CPF, nome e prefixo: **zero**. Não
dá para estornar daqui o que a nossa API não enxerga. Mandei a carta e anotei a
data, então pela regra 8 o item **saiu do meu colo**.

**Não confundir com a ordem de 29/08:** este cartão não nasce da planilha,
nasce de um pedido de reembolso. A planilha aparece só como o lugar por onde a
compra entrou — fato de contexto, não causa do chamado.

---

## 3. O padrão que os dois casos desenham

Os dois itens mais antigos que peguei hoje **não estão parados por falta de
trabalho técnico**. Estão parados em **decisão de dinheiro que é do Johnny**:

| cartão | o que falta | há quanto tempo |
|---|---|---|
| #254 Carlos | autorizar cancelar a perna órfã **ou** a ligação | pedido no grupo desde 21/09 18hZ (~7h), **vence hoje 12:00Z** |
| #301 Simone | acesso/decisão sobre R$ 975,40 fora do nosso gateway | desde 12/09 (**9 dias**) |

Registro isso como padrão porque a fila tem 102 abertos e 48 com 7d+, e contar
"48 cartões velhos" esconde que **parte deles não é backlog de execução, é fila
de decisão**. Vale medir isso direito numa próxima ronda: quantos dos 48 estão
esperando humano decidir vs. esperando alguém trabalhar.

---

## 4. Estado da fila (medido, não lembrado)

- **102 abertos** · **48 com 7d+** (`idade_dos_abertos.cjs`)
- **51 abertos já tiveram carta** depois de nascer (`aberto_mas_ja_respondido.cjs`)
  — ordem de visita, **não veredito**; o próprio script proíbe fechar por ele.
- **0 travados em percepção** (`percepcao_travada.cjs`)

---

## 5. Armadilhas que me pegaram hoje (ficam registradas)

1. **`emails_enviados` devolveu 0 cartas pra Simone e isso NÃO era silêncio.**
   A carta dela é de 12/09, **anterior ao corte** de 14/09 14:06:31Z — está
   entre as 77 "fora da janela". Quem consultar só a tabela para um caso
   anterior ao corte lê "nunca escrevemos" e manda carta em cima de carta. Para
   antes do corte, **a fonte é a pasta Sent**, não a tabela. É a irmã gêmea da
   armadilha do `caplastica@GMAIL` de 21/09: zero de instrumento que não cobre
   a pergunta não é zero medido.
2. **`resolverIncidente` devolve `{incidente, via, avisos}`, não o incidente
   cru.** Passar o retorno direto pro `anexarNota` lança
   *"sem id resolvido"*. Use `.incidente`. (Falhou e eu corrigi — o helper
   fez o certo ao morrer em vez de dar UPDATE em alvo nulo.)
3. **`profiles` não tem `credits` nem `full_name`** (são
   `credits_subscription`/`credits_extra` e `display_name`). Consulta com
   coluna errada **morre**, e isso é bom: erro alto é melhor que zero
   silencioso.

---

## 6. O que eu NÃO fiz, de propósito

- **Não cancelei** a assinatura órfã do Carlos (9-C pede pedido escrito do
  titular; não revogo salvaguarda de dinheiro sozinho).
- **Não liguei** pro telefone dele (ação externa, precisa do "pode").
- **Não mandei a 11ª carta** pro Carlos (canal e-mail medido como esgotado).
- **Não estornei** nada, **não mexi em crédito**, **não prometi data**.
- **Não fechei** cartão nenhum — nenhum dos dois estava resolvido.
- **Não toquei na planilha** (ordem de 29/08).
