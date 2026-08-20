# Vigia do e-mail técnico — 20/08, 02:2x UTC

**Resumo: nada novo entrou.** Nenhum e-mail de aluno desde 19/08 23:30 UTC (uid 179,
Luciano). Fila da Fast (não-lidos) = **0** — ela respondeu tudo. Nenhum incidente
novo aberto nesta rodada, nenhum fechado (o único vivo não está resolvido).

---

## Frente 1 — incidentes `fast-email:%`

19 no total: **1 investigating**, 13 fixed, 5 ignored.

### `43f37482` · Luciano — `lucvila@gmail.com` · investigating

**Reconferido AGORA, não copiado da nota anterior** (`aluno.cjs lucvila@gmail.com`):

    conta 149ab7b9 desde 29/07 · acesso ATIVO até 30/08 · compra 30/07 active
    saldo = 13.409 créditos  -> BATE com o print que ele mandou
    voz f61eec10 [ready] 30min desde 30/07
    uso diário e normal: vídeo em 12, 14, 15, 16, 17, 18 e 19/08
    último débito -6.160 (Vídeo Clone Turbo 77s) em 19/08 17:04

Não está travado, não perdeu acesso, não é credor de nada. Diagnóstico inalterado:
a queixa nasceu do onboarding indevido de 18/08 11:00 ("crie sua conta") disparado
pra quem já tinha conta desde 29/07 — causa (teto de 1000 do PostgREST no
`hasAccount` do orphan-outreach) já corrigida no card 5043097c.

**Por que segue aberto:** falta só o "pode" do Johnny pra eu escrever ao aluno.
Não respondo terceiro sozinho. Texto pronto em
`_frank/rascunhos/2026-08-20_resposta_lucvila.html`.
**Prazo das 24h estoura 20/08 23:30 UTC** (~21h a partir de agora).

---

## Frente 2 — escalação silenciosa (o buraco do `[ESCALAR: ...]`)

`ler_caixa --ultimos 25 --corpo 2500` (BODY.PEEK, só SEEN, não-lido intocado).
Cruzei os 10 alunos que aparecem na janela contra a tabela `incidents`:

| aluno | sinal | incidente | estado |
|---|---|---|---|
| tecnologylegacy (Viviana) | "vou encaminhar pra equipe" + cobrou 2x | existe | fixed (estorno US$22 + cancelamento) |
| jolenesaraiva (Josilene) | "vocês passaram quase um mês" | existe x2 | fixed / ignored (100k bônus) |
| katiasalvador32 (Kátia) | "vou pedir pra equipe técnica olhar" | existe x2 | fixed (áudio refeito + entregue) |
| valterpjunior (VP) | erro recorrente no upload | existe | fixed (retry + erro real na tela) |
| lkolle (Luis) | pede link PIX | existe | fixed |
| itamar.vanzin | "clone não está ficando legal" | existe | ignored (uso do fluxo, não bug) |
| lucvila (Luciano) | créditos "não atualizados" | existe | **investigating** |
| ricardopereirawinckler | agradecimento | — | encerrado pelo próprio aluno |
| chaplainfabio | dúvida de idioma | — | respondida |

**Nenhuma escalação silenciosa sem incidente.** Nada novo pra abrir.

---

## Achado de método desta rodada

Fui verificar no IMAP se o e-mail de entrega da Kátia (19/08 ~22h40 UTC) tinha
saído mesmo. **A pasta `Sent` tem 2 mensagens, e as duas são os testes do card
d1baee63** (19/08 23:31 e 23:32 UTC).

Isso **não** significa que os e-mails anteriores não foram enviados: o
`appendToSentFolder` só entrou no ar às 23:32 UTC de 19/08. Tudo que saiu antes
disso foi por SMTP sem cópia em `Sent`, e por isso é **inauditável pelo IMAP**.

Duas consequências, registradas pra ninguém afirmar demais:

1. Não tenho prova independente, via `Sent`, de nenhum e-mail anterior a
   19/08 23:32 UTC. O que corrobora a entrega da Kátia é indireto: geração
   `[ready]` às 19/08 21:07 na conta dela, compatível com o áudio refeito.
2. **De agora em diante dá pra auditar**: todo envio novo aparece em
   `ler_caixa --enviados`. Esse passa a ser o teste padrão de "o aluno foi
   mesmo avisado?".

---

## Decisões que dependem do Johnny (nenhuma é minha alçada)

1. **Luciano** — autorizar o envio da resposta. Texto pronto. Prazo 20/08 23:30 UTC.
2. **Kátia** — acesso vence **22/08** (2 dias) e ela perdeu ~2 dias por bug nosso.
   A pergunta binária de extensão foi mandada e **segue sem resposta**;
   conferido agora: `acesso ATIVO até 2026-08-22`, nada foi estendido.
   Mexer em acesso/crédito não é minha alçada.

## O que eu NÃO fiz

- Não respondi nenhum aluno.
- Não toquei em saldo nem em acesso.
- Não toquei no não-lido (fila = 0, intacta).
- Não fechei incidente nenhum — o único vivo não está resolvido.
