# Vigia do e-mail técnico — 20/08, 03:2x UTC

**Nada novo entrou.** Último e-mail de aluno segue sendo o uid 179 (Luciano,
19/08 23:30 UTC) — o mesmo da rodada anterior. Fila da Fast (não-lidos) = **0**,
intacta. Nenhum incidente novo aberto.

O trabalho desta rodada não foi triagem nova: foi **fechar o único buraco de prova
que sobrou** da rodada das 02h, e **impedir que um caso fechado no painel virasse
um aluno esquecido**.

---

## 1. Li o print do Luciano — que ninguém tinha lido

O incidente `43f37482` carregava, em letras maiúsculas, a própria lacuna:
`O PRINT NAO FOI LIDO (anexo nao baixado pelo ler_caixa)`. Toda a conclusão de
"não falta crédito" estava apoiada em inferência do banco, sem nunca ter olhado o
que o aluno de fato via na tela.

```
node _frank/ferramentas/ler_caixa.cjs --anexos 179
✓ _Bugs/anexos/179/0-image.png (41KB, IMAGE/PNG)
flags do uid 179 antes: [\Seen] · depois: [\Seen] ✓ intactas
não-lidos no INBOX antes: 0 · depois: 0 ✓ fila da Fast intacta
```

**O que a tela dele mostra:** dashboard logado como *Luciano Vilanova da Silva /
lucvila@gmail.com*, contador **"13.409 créditos"** no topo.

Conferido contra a conta **agora** (`aluno.cjs lucvila@gmail.com`): `13.409`,
acesso ATIVO até 30/08. **Zero divergência entre o que ele vê e o que temos.**
O diagnóstico deixa de ser dedução e passa a ser evidência direta: não há crédito
devido a ele.

## 2. Reabri o incidente de propósito

Às 02:47 o caso foi para `ignored` com nota correta — do ponto de vista técnico,
não há o que consertar. Só que `ignored` **some do painel**, e o aluno **não foi
respondido**. Essa é exatamente a sequência que transformou a Viviana em disputa
de cartão: caso tecnicamente encerrado, humano ainda esperando.

Voltei para `investigating` e registrei o porquê. Só fecha depois que a resposta
sair. **Prazo das 24h dele estoura hoje, 20/08 23:30 UTC.**

## 3. Corrigi o texto que estava pronto pra enviar (e teria voltado como problema)

A versão anterior do rascunho explicava o e-mail de onboarding indevido e terminava
com *"você não precisa fazer nada, é só continuar usando"*. Está tecnicamente
correta e mesmo assim é uma armadilha:

| fato | consequência do texto antigo |
|---|---|
| saldo 13.409 | ele acha que está tudo normal |
| custo por Vídeo Clone: 4.000–9.000 | dá ~2 vídeos |
| próximo grant: **30/08** (`date_next_charge`) | ~10 dias sem crédito |

Ele escreveu justamente porque esperava uma recarga. Responder sem dizer *quando*
a próxima entra é garantir o mesmo aluno voltando em dois dias, mais irritado, com
razão. Reescrevi (`_frank/rascunhos/2026-08-20_resposta_lucvila.html`):

- a recarga do ciclo **já entrou, em 06/08** — o crédito cai no `APPROVED` do
  pagamento, não no fechamento da fatura que ele viu em 14/08;
- **próxima recarga: 30/08**, explícita;
- aviso honesto de que o saldo atual dá cerca de dois vídeos até lá.

Não mencionei os 100.000 créditos **a mais** que ele recebeu pelo bug antigo do
`external_id` (2 ciclos pagos, 3 recargas). Ele não perguntou isso, está a favor
dele, e levantar o assunto só planta medo de estorno.

---

## Frente 1 — incidentes `fast-email:%`

19 no total. Depois desta rodada: **1 investigating** (lucvila, acima), 13 fixed,
5 ignored. Nenhum outro vivo.

## Frente 2 — escalação silenciosa (o buraco do `[ESCALAR: ...]`)

`ler_caixa --ultimos 25 --corpo 2500` (BODY.PEEK, só SEEN). Varri a janela atrás de
*"a equipe vai verificar"*, *"vou chamar alguém da equipe"*, *"aguarde o retorno"* e
aluno cobrando pela segunda vez. **Único sinal na janela:** Viviana
(`tecnologylegacy`, uid 157) — incidente existe e está `fixed` (estorno de US$22 +
cancelamento). **Nenhuma escalação silenciosa sem incidente. Nada novo pra abrir.**

---

## Decisões que dependem do Johnny

1. **Luciano** — autorizar o envio. Texto pronto e revisado. Prazo hoje 23:30 UTC.
2. **Kátia** — reconferido agora: `acesso ATIVO até 2026-08-22`, 82.655 créditos,
   **nada foi estendido**. Ela perdeu ~2 dias por bug nosso e a pergunta binária
   sobre estender segue sem resposta. Mexer em acesso não é minha alçada.

## O que eu NÃO fiz

- Não respondi nenhum aluno.
- Não toquei em saldo nem em acesso.
- Não toquei no não-lido (fila = 0, provado antes e depois no `--anexos`).
- Não fechei incidente nenhum — reabri um.
