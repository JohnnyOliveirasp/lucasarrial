# RONDA DAS FALHAS — 19/09, ~21hZ

Dono da fila (14-A). Ronda anterior: `2026-09-19_rotina_falhas_20h.md`.

**Método serial (regra 8):** peguei **UM** cartão — o `35a808ad` / **#357**
(Kevin), o que a ronda das 20hZ deixou indicado: 8,1 dias sem ninguém tocar **e**
acusação de **cobrança indevida**, que é a classe que a prioridade manda olhar
primeiro. **Fechou.**

**E o achado desta ronda é contra mim.** Uma afirmação que EU escrevi nas 20hZ
está errada, e o erro é da mesma família que a própria nota das 20hZ denunciou:
**confundi o valor PADRÃO de uma flag com o ALCANCE do instrumento**, e declarei
cegueira que não existia. §3.

---

## 0. Passo fixo — reconciliação dos envios (#101)

```
756 lidas da pasta "Sent" = 679 já tinham linha + 77 fora da janela + 0 escrituráveis
🕳️ cartas que saíram e não têm linha, DENTRO da janela: 0
```

Conferido com o irmão de leitura (`2026-09-18_enviados_x_tabela.cjs`): **0 carta
depois do corte**, veredito "buraco é PASSIVO".

Pasta **749 → 756** desde as 20hZ; tabela **672 → 679**. As 7 do intervalo
nasceram com linha. As **77 anteriores a 14/09 14:06:31Z seguem sem decisão** —
decisão de produção, não de ronda, e eu não a tomei.

## 1. Estado da fila

| status | 20hZ | 21hZ |
|---|---|---|
| fixed | 289 | 289 |
| investigating | 81 | **80** |
| ignored | 60 | **61** |
| aguardando_aluno | 36 | 36 |
| open | 1 | 1 |

O único movimento é meu: o `35a808ad` saiu de `investigating` para `ignored`.

### 1.1 Classe "precisa ver / ouvir" (ordem de 17/09)

**2 cartões**, o mais velho parado há **1,3 dia** — medido com o
`percepcao_travada.cjs`, que confere a **última** nota. (A consulta crua da
ordem de 17/09 dá 13 / 18,1d porque casa o histórico inteiro; é teto, não fila.
Já estava escrito no §1.1 das 20hZ.)

### 1.2 Contabilidade da fila

`2026-09-19_aberto_mas_ja_respondido.cjs`: **36** chamados abertos **já têm carta
enviada** depois de nascerem; **22** não têm. Ordem de visita, não veredito.

### 1.3 Pagante trancado

`pagante_trancado.cjs`: **0 pagante trancado**, 0 na fronteira, **1 sem prova**
(`drfabiovilhena29@`, sem subscriber code no payload).

---

## 2. `35a808ad` / **#357** — não era cobrança indevida, e ele já tinha cancelado

`35a808ad` · aberto **11/09 16:36Z** · **Kevin Ferreira de Santana**,
`luminous.assessoria@gmail.com` · chat do app em `/app/settings`:
*"estão cobrando no meu cartão sem minha autorização. como cancelo?"*

### 2.1 A baixa dizia "já respondido" — fui abrir a carta

A nota de `suporte@` de 11/09 18:09Z diz que o aluno **já foi respondido**. A
família `#334`/`#347` ensinou que isso pode ser **carta de outro assunto**, então
não aceitei a baixa: **abri a carta**.

`Sent` **uid 1863** · 11/09 **17:25:52Z** · *"A cobranca de hoje NAO foi feita - e
como cancelar a assinatura"*. Li o corpo inteiro. É do assunto certo, o histórico
que ela conta está **correto**, e ela ensina a cancelar em `compras.hotmart.com`.
**Baixa verdadeira.**

### 2.2 O aluno agiu em cima dela

`entitlements ddcfe813` · status **`canceled`** · `cancellation_date`
**2026-09-14T18:14:13Z**, webhook gravado **18:14:15Z** (2s depois). Ele cancelou
**sozinho, 3 dias após a carta, pelo caminho que ela indicou.**

### 2.3 A acusação, medida

`pagou_de_verdade.cjs`:

| cobrança | valor | status | data |
|---|---|---|---|
| rec#1 (adesão) | R$ 0 | COMPLETE | 11/08 |
| rec#2 `HP2878209041` | R$ 97 | **COMPLETE** | 18/08 |
| rec#3 | R$ 97 | **OVERDUE** | — |
| rec#3 (2ª linha) | R$ 97 | **OVERDUE** | — |

**Uma única mensalidade paga, e ela é dele.** As duas linhas de rec#3 são
**retry**, não duplicidade — **ambas OVERDUE**, e a armadilha `#138` diz que
**OVERDUE não é pagamento**. Extrato bate: **+100.000 cr** `subscription_grant` em
18/08.

### 2.4 Classe `#222` refutada — no nosso escopo, e digo o limite

O Vigia levantou que o débito no cartão podia estar em **outro e-mail**. Busquei
`entitlements` por **nome** (`Kevin%Santana`) e por **telefone** (`991088640`):
**1 única conta**, esta. **Limite honesto:** isso cobre o **nosso banco**, não o
cartão dele — e a carta de 11/09 já o mandou contestar no banco se vir lançamento
que não veio daqui.

### 2.5 O ponto 1 do Vigia (`#290`) se resolveu — e a ironia está medida

Em 11/09 o Vigia mediu **"SEM ACESSO com 176.788 créditos"**: pagante trancado.
Hoje: `access_until` **2026-10-11 12:00Z**, créditos **176.788** intactos.

**Quem devolveu o acesso foi o próprio evento de CANCELAMENTO de 14/09**, que
trouxe a data no payload. A janela de trancamento foi ~11/09→14/09 e já passou.
Conferi a classe inteira agora (§1.3): **0 pagante trancado hoje.**

### 2.6 Entregue

Ele **nunca voltou** (`occurrences=1`, `last_seen_at` 11/09 16:36Z) e **não pediu**
a devolução dos R$ 97 que a carta ofereceu. Mesmo assim mandei **uma** carta — não
repetição, **fato novo**: *cancelar não fechou a conta*. Acesso até **11/10**,
**176.788 créditos** e a voz *"Kevin - SGP"* continuam lá (regra final do crédito,
20/08: crédito comprado é dele). Repeti que nada mais foi debitado por nós e
mantive de pé a oferta de encaminhar a devolução de 18/08.

`Sent` **uid 2929**, registrada em `emails_enviados` (origem `ronda-manual`).

### 2.7 Por que `ignored` e não `fixed`

**Não houve defeito nosso.** A cobrança era legítima, a plataforma não errou e
**nenhum código foi consertado**. Marcar `fixed` alegaria conserto que não
existiu — regra 14. Mesmo critério do `#310`. Nota conferida na releitura:
4 → 5 notas, array preservado, 1 linha afetada.

---

## 3. >>> ERRATA CONTRA MIM: a Ellen NÃO ficou sem resposta

A nota das 20hZ (e o log daquela ronda, §2.1) afirma: **"Ninguém respondeu. 8,9
dias. É o padrão exato que a ordem de 17/09 proibiu."**

**É falso.**

`Sent` **uid 1666** · 10/09 **20:26:51Z** · *"Parte disso eu resolvo agora - e a
outra parte eu nao vou prometer"*. A queixa dela entrou **10/09 19:32Z**.
**Resposta em 54 minutos, no mesmo dia.** Abri e li: assunto certo (entonação),
honesta, reconhece a limitação. **O que ficou 8,9 dias parado foi o CARTÃO, não a
aluna.**

### 3.1 Por que eu errei

Eu escrevi nas 20hZ que *"a leitura da pasta só alcança desde 14/09"*. **Não é
limite da pasta — é o valor PADRÃO da flag `--desde`.** Rodei agora com
`--desde 05-Sep-2026`: vieram **1198** cartas anteriores ao corte. E o
`uid_por_message_id.cjs --para ellen.atp@gmail.com` achou as duas cartas dela em
segundos.

**Confundi o padrão do instrumento com o alcance do instrumento** e, em cima
disso, declarei uma cegueira que não existia. É literalmente o padrão que a nota
das 20hZ nomeou no próprio §6: *"a evidência não foi conferida na fonte"* — desta
vez fui eu, e contra um instrumento que já estava na minha mão.

> **Regra que fica: antes de escrever "o instrumento não alcança", rode-o com o
> parâmetro aberto.** Zero com filtro padrão não é zero.

### 3.2 O que NÃO cai (conferido antes de escrever a errata)

- **A medição das 20hZ fica inteira.** Régua de F0, os −1,80 semitons de
  *"…como começar?"*, os +1,91 de *"Fácil, não é?"*, a refutação da pontuação e a
  das referências: tudo saiu de instrumento, nada de parecer.
- **A minha carta (uid 2918) não fica falsa e não contradiz a de 10/09** —
  conferi as duas lado a lado, porque carta que já saiu para pagante **se
  confere, não se torce**. A de 10/09 manda **aumentar** a pausa entre frases; a
  minha diz que os `....` servem bem para pausa e só não devem entrar **no meio
  de uma pergunta**. Somam, não brigam.
- A única frase que ficou torta é a abertura *"Desculpe a demora para voltar com
  uma resposta de verdade"*. Como **resposta com medição**, a demora de 9 dias é
  real; como *"você ficou sem resposta"*, não. **Não escrevi uma 3ª carta** só
  para ajustar isso: seria ruído sobre assunto que ela já tem resolvido, e ela
  segue em `aguardando_aluno` esperando o *"pode rodar"*.

### 3.3 Duas dívidas da casa que ninguém tinha registrado no cartão

A carta de 10/09 prometeu, por escrito:

1. **"eu te aviso pessoalmente quando melhorar — você não vai precisar cobrar."**
   O conserto é o **PR #92**, **DRAFT desde 28/08**. Quem mexer no #92 **tem que
   avisar a Ellen**.
2. **"Se você gerar e ficar ruim, me avise que eu devolvo os créditos."**
   Medido, para ninguém pagar em dobro nem de menos: as 4 tentativas
   (**−3.971 cr**) foram em 10/09 **a partir de 18:56Z**, **ANTES** da carta das
   20:26Z — a promessa **não as cobre retroativamente**. Os **10.000 cr** de
   11/09 foram **retreino de voz**, não geração, e também não caem na letra dela.
   **Não estornei nada.** Mas a decisão que subiu ao Johnny nas 20hZ ("a casa deve
   os 3.971?") agora vai **com este dado a mais**: a casa já se ofereceu por
   escrito a devolver crédito dessa classe.

Errata gravada no `4ce9f365`: 6 → 7 notas, array preservado, status inalterado.

---

## 4. Fatos consumados desta ronda

1. **Reconciliação dos envios** — 756 = 756, 0 escrituráveis, conferida por
   instrumento independente.
2. **`35a808ad` / #357 (Kevin) FECHADO** depois de 8,1 dias parado, com a
   acusação de cobrança indevida **medida e refutada** na fonte.
3. **Uma carta a aluno** — Kevin (`luminous.assessoria@`), Enviados **uid 2929**.
4. **Errata contra mim mesmo** gravada no `4ce9f365`: a Ellen foi respondida em
   54 minutos, não ficou 9 dias sem resposta.
5. **Duas promessas em aberto da casa à Ellen** descobertas e registradas.
6. **Quatro linhas no grupo** — o fechamento, a carta, a errata e as duas dívidas.

## 5. O que eu NÃO fiz

- **Não estornei nada** — nem os R$ 97 do Kevin (dinheiro da Hotmart, não crédito
  da casa; devolução é decisão do Johnny), nem os 3.971 / 10.000 da Ellen.
- **Não cancelei nem mexi em assinatura, acesso ou crédito de ninguém.**
- **Não escrevi uma 3ª carta à Ellen** (§3.2).
- **Não gastei GPU.**
- **Não abri chamado novo.** A janela de trancamento do Kevin (11/09→14/09) já
  passou e a classe está em 0 hoje — abrir chamado para defeito que não reproduz
  seria inflar a fila.
- **Não mergeei nada.** PRs **#351**, **#355** e **#356** seguem abertos; o **#92**
  segue draft.
- **Não mudei o `enviados_x_tabela.cjs`** por causa do §3.1: o instrumento está
  certo, quem leu errado fui eu. A regra ficou escrita aqui e no cartão.
- **Não decidi o backfill das 77 cartas** do #101.
- **Não li a caixa do suporte@ para triagem.**
- **Nada da planilha** (ordem de 29/08).

## 6. Para quem pegar a próxima ronda

1. **Antes de escrever "o instrumento não alcança", rode com o parâmetro
   aberto** (§3.1). `--desde` tem padrão **14-Sep-2026**; a pasta vai muito
   além disso.
2. **Para saber se a casa já escreveu a um aluno**, o caminho barato é
   `2026-09-19_uid_por_message_id.cjs --para <e-mail>` e depois
   `2026-09-18_dump_enviada.cjs <uid> --texto`. **Sempre leia o corpo** — baixa
   de "já respondido" não prova assunto (§2.1).
3. **O controle cego do §3 das 20hZ continua valendo**: nenhum agente foi provado
   como ouvido ou olho. Para áudio está **refutado**. Para imagem/vídeo, **assuma
   quebrado até provar**.
4. **Próximos por abandono** (lista das 20hZ, já sem o `35a808ad`):
   `797b64aa` (mcpaganatto@, 8,0d), `ec35016e` (welrisson@, 8,0d), `94843173`
   (rodrigo.limas.1978@, 7,2d — **pediu devolução total**). Comece cruzando com
   os **36 abertos que já têm carta** (§1.2): boa parte da fila é contabilidade,
   não trabalho.
5. **Se alguém mexer no PR #92**, a Ellen tem de ser avisada — é promessa escrita
   da casa (§3.3).
