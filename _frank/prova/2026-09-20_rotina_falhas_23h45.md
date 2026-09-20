# Ronda das falhas — 20/09, ~23h45Z (Frank, dono da fila)

## Resumo em uma linha

Nenhum incidente fechado. A ronda mediu a CLASSE em vez de re-medir um cartão,
pegou um erro meu antes de virar dano a aluno, e escalou ao grupo a decisão de
uma palavra que segura **~R$ 66 mil** de aluno pagante.

---

## 1. Passos fixos da ronda

### Reconciliação dos envios (passo fixo desde 18/09) — LIMPO

```
node _frank/ferramentas/2026-09-18_reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar
```

- 889 lidas da pasta `Sent` · 812 já tinham linha · **0 dentro da janela sem linha**
- Contagem fecha: 889 = 889, nenhuma carta sumiu na classificação.
- Irmão de leitura independente (`2026-09-18_enviados_x_tabela.cjs`):
  **veredito = 0 carta depois do corte**. O buraco segue PASSIVO.
- As **77 anteriores a 14/09 14:06:31Z** seguem sem decisão (é o que o `--corte`
  exclui). Não decidi: exige o `cobreDesde` na mão, é decisão de produção.

### Estado da fila

- **93** abertos/investigating · **88** com aluno afetado · **39** com 7d+.
- **18** travados em PERCEPÇÃO (consulta da ordem de 17/09), o mais velho com
  **18 dias**. Despachados nesta ronda — item 4.

---

## 2. O item serial, e por que não foi o mais velho

Regra 8 manda pegar o mais antigo com aluno. Os três mais velhos estão **todos
parados na MESMA decisão de produto** (rigor do QA), no grupo desde 17/09:

| cartão | idade | estado |
|---|---|---|
| #15 `d3d8d1b2` | 51d | re-medido hoje 22:47Z; dormente 16d; 0 aluno esperando; 19/19 estornados |
| #226 `702cc916` | 18d | espera a mesma decisão |
| #234 `f8587cef` | 17d | espera a mesma decisão |

Re-medir os três pela enésima vez não entrega nada. **Declarei o bloqueio e
desci para o mais velho ACIONÁVEL: #249 `132f7808` (Glauber).**

---

## 3. #249 — o que esta ronda acrescentou

### 3.1 Quase repeti um erro que a própria casa já tinha proibido

A Sheila (`#447e03da`) tem no checkout `horta.pericias@gmail.com.BR` — domínio
com `.br` sobrando. E-mail para aluno é **pré-autorizado** (regra 8), então eu
teria mandado sozinho.

Sonda SMTP read-only (`EHLO`+`MAIL FROM`+`RCPT`+`RSET`, **sem `DATA`** — não
entrega, não gera bounce):

```
horta.pericias@gmail.com      -> 250 2.1.5 OK
suporte@gmail.com             -> 550 5.2.1 inactive      (controle POSITIVO)
zz9q7x3k2m8v4t7w9r@gmail.com  -> 550 5.1.1 não existe    (controle NEGATIVO)
```

Os controles provam que o servidor **discrimina**, então o 250 é informação real:
a caixa está viva.

**E mesmo assim não mandei.** O cabeçalho do `contato_hotmart.cjs` fixa a regra
em 13/09 (PR #260): trocar `gmail.com.br` por `gmail.com` é o palpite que entrega
a compra de um pagante **na caixa de outra pessoa**. Caixa viva prova que existe
alguém ali; não prova que é a Sheila. É a armadilha do `glauber.neurologia`, que
neste mesmo cartão só morreu por CPF.

> Para a próxima ronda: a sonda já está feita e o endereço está vivo. O que falta
> é **identidade** (CPF/telefone confirmando que a caixa é dela), não
> deliverability. Não mandar antes disso.

### 3.2 Bug na minha própria sonda, pego pelo controle

A 1ª versão mandava `RCPT` depois do `RSET` sem reabrir `MAIL FROM`. O servidor
respondia `503 5.5.1 MAIL first` — e eu teria lido isso como veredito de
endereço. Só o 1º `RCPT` de cada conexão valia; **os dois controles saíram
inválidos**. Corrigido (ciclo completo por destinatário) e só então os números
valem. Mesma família dos 4 erros de denominador deste cartão: quem pegou foi o
controle, não a leitura.

### 3.3 Limite declarado — não consegui sondar iCloud nem Hotmail

iCloud recusou: `550 5.7.1 Mail from IP 35.137.234.207 rejected due to Spamhaus
PBL`. Esse é o IP **desta máquina** (faixa residencial), **não** o do SMTP de
produção. Portanto **não** se conclui que o envio de produção está bloqueado — a
sonda daqui não mede o caminho de produção. Outlook/Hotmail não respondeu no
tempo. As duas pontas seguem **sem medição**.

---

## 4. A classe foi remedida, e ela CRESCEU

`contato_hotmart.cjs --fichas`, controle positivo OK: **12 fichas · 11 com telefone**.

**Pagantes sem acesso: 10 · R$ 8.250,27**

| aluno | valor | desde | idade |
|---|---|---|---|
| Anderson | R$ 733,60 | 06/08 | **44d** |
| Glauber | R$ 694,00 | 15/08 | 36d |
| Thallita | R$ 297,00 | 06/09 | |
| Sunesa | R$ 849,45 | 07/09 | |
| Renato | R$ 1.038,00 | 09/09 | |
| Valdeni | R$ 1.054,32 | 10/09 | |
| Ulysses | R$ 993,45 | 10/09 | |
| Sheila | R$ 649,45 | 13/09 | |
| Aline | R$ 849,45 | **20/09** | pagou HOJE e já quicou |
| Eliane | R$ 1.091,55 | assinante | |

Em 19/09 eram **9 alunos / R$ 7.400,82**. A classe não está estável, está
**crescendo** (~R$850 e 1 aluno em um dia). Fora da conta de propósito:
`luctec@` e `pc.sul157@` (nenhuma compra paga).

### O que eu NÃO fiz, e por quê

Ia reenviar o acesso do Anderson (`#250`, o cartão dizia "reenviar em ~24h" e
estava **15 dias** atrasado). **Li antes de agir e não reenviei**: o cartão já
tinha sido reclassificado — o bounce ACABOU (carta de 14/09 entrou, sem bounce em
5d), e reenviar/gerar recovery novo **sobrescreve `auth.users.recovery_sent_at`**,
que é a prova da entrega. E uma 5ª carta não resolveria: a conta dele está vazia.

---

## 5. A raiz: #426, e a correção de escala que eu mesmo tive que fazer

O `#426` (`5f9eb4db`, investigating) é o cartão de verdade: o lote de 04/09 criou
**309 contas VAZIAS** para gente que comprou. Amostra **14/14 pagantes**.
Estimativa do cartão: **da ordem de R$ 66 mil**.

Detalhe que explica o silêncio: **criar a conta foi o que escondeu essas pessoas
do varredor de compra órfã.**

O que destrava: a Hotmart guarda **telefone do comprador** desde a data da compra
(`/sales/users`, papel BUYER) — conferido, presente nos casos abertos. A frase
"os 309 não têm como ser avisados" não se sustenta mais.

**Escalei ao grupo duas vezes nesta ronda**: a primeira mensagem falava só dos
R$ 8.250,27 das fichas. Corrigi na hora com uma segunda, porque a primeira
subestimava a escala em ~8x.

---

## 6. Despacho da percepção (ordem de 17/09)

18 cartões travados em "precisa ver/ouvir/assistir", o mais velho com 18 dias.
A ordem diz que isso é **despacho, não estado de parada**.

Criado o card `ddfaf5e5` no Mission Board para o **`olho`** (lê imagem, vídeo e
áudio), com os 18 alvos nomeados e regras duras: só leitura, não gastar GPU, não
escrever para aluno, não mudar status, **nunca fingir ter visto** — artefato que
não abre vira bloqueio declarado com motivo concreto.

---

## 7. Dinheiro e segurança

- Não escrevi para nenhum aluno. Não mandei nada para `horta.pericias`.
- Não gastei GPU, não virei chave, não toquei em crédito, acesso, voz nem migration.
- A sonda SMTP não entrega mensagem e não gera bounce.
- Nenhum código subiu nesta ronda.

## 8. O que trava, e com quem

Duas decisões, as duas do Johnny, as duas de uma linha:

1. **Posso falar por WhatsApp com os pagantes sem acesso?** (canal WAHA medido
   WORKING em 06/09; telefone existe para 11 das 12 fichas)
2. **O que a compra avulsa do SGP dá direito dentro do FastCloner?** — comercial,
   não é decisão de ronda.

Sem (1) não falo com ninguém. Sem (2) não entrego nada. Com as duas, começo pelos
mais antigos (44d e 36d).
