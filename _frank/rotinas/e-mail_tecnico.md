# Rotina — vigiar o e-mail e agir no que é técnico

Ordem do Johnny, 19/08: *"cria um cron para você acompanhar os e-mails
recebidos, e o que for destinado à equipe técnica você precisa agir"*.

Roda de 2 em 2 horas. Este arquivo é a fonte da rotina — o cron só aponta pra
cá, então mudança de procedimento se faz **aqui**, não no texto do agendamento.

---

## Por que a rotina existe

A Fast responde e-mail sozinha. Quando ela não dá conta, escreve um marcador
na última linha da resposta:

| marcador | o que o código faz hoje |
|---|---|
| `[ESCALAR-TECNICO: ...]` | **abre incidente** com assinatura `fast-email:<email do aluno>` |
| `[ESCALAR: ...]` | **não abre nada** — vira uma linha de log do pm2 que ninguém lê |

A segunda linha é o buraco: cobrança, cancelamento, reembolso e dúvida de conta
usam o marcador comum. A Fast já respondeu ao aluno *"a equipe vai verificar"* e
ninguém foi avisado. Foi o que aconteceu com a Viviana. Enquanto esse buraco não
for fechado no código, **esta rotina é o único olho que existe sobre ele**.

Por isso a varredura tem duas frentes: o que virou incidente, e o que não virou.

---

## Frente 1 — o que virou incidente (técnico)

```
select * from incidents
  where signature like 'fast-email:%'
    and status in ('open','investigating')
```

Para cada um: ler `sample_error` (guarda o corpo cru do e-mail do aluno,
inclusive a resposta da Fast citada com `>`), identificar o aluno pelo
`affected_emails`, e **agir**:

1. `node _frank/ferramentas/aluno.cjs <email>` — estado real da conta: saldo,
   assinatura, gerações, falhas, estornos.
2. Achar a causa. Falha de geração já estornada não é "resolvido": o aluno
   continua sem o que ele queria.
3. Consertar o que é seguro e reversível (reprocessar, destravar, corrigir
   referência quebrada). As ferramentas destrutivas nascem em modo seco — rodar
   **sem** `--confirmar` primeiro, sempre.
4. Escrever a `resolution_note` no incidente e fechar. Incidente resolvido sem
   nota é incidente que volta.

## Frente 2 — o que NÃO virou incidente (o buraco)

```
node _frank/ferramentas/ler_caixa.cjs --ultimos 25 --corpo 2500
```

Leitura pura: `BODY.PEEK`, só `SEEN`, nunca toca no não-lido (o não-lido é a
fila da Fast — se eu marcar como lido, ela nunca responde aquele aluno).

Procurar nas respostas dos alunos os sinais de escalação silenciosa:
*"a equipe vai verificar"*, *"vou chamar alguém da equipe"*, *"aguarde o
retorno"*, e principalmente aluno **cobrando resposta pela segunda vez**.
Cruzar com os incidentes: se não existe incidente pra aquele e-mail, **abrir
um** (`reported_by: 'frank'`) e tratar como as da frente 1.

Sinal de alarme que vem antes de qualquer métrica: aluno escrevendo
*"já pedi ajuda várias vezes"*. Isso é fila perdida, e vai na frente do relatório.

---

## O que eu NÃO faço sozinho

- **Não respondo o aluno.** E-mail pra terceiro precisa do "pode" do Johnny,
  toda vez. Eu escrevo o texto e mostro pra ele.
- **Não mexo em saldo.** Crédito só muda por varredura automática ou com ordem
  explícita dele.
- **Não toco em e-mail não lido.** Nem pra "dar uma olhada".
- **Não fecho incidente sem consertar.** Fechar por antiguidade é apagar o
  problema, não resolver.

## O relatório

Vai pelo Telegram, curto, português, sem jargão:

- **Primeiro** o que precisa de decisão dele (aluno esperando, algo que eu não
  posso fazer sozinho).
- Depois o que eu já resolvi, com o número: quantos incidentes, quantos alunos.
- Nada novo? Manda **"nenhum e-mail técnico novo, N incidentes seguem abertos"**.
  Silêncio nunca é relatório — ele não distingue "está tudo bem" de "o cron
  morreu".
