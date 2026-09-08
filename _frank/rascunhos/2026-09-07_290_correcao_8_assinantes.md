# Rascunho pronto — correção aos 8 do #290 (aguarda "pode" do Johnny)

**Status: NÃO ENVIADO.** É lote de 8, e lote precisa do "pode" (REGRA 8, 21/08).
Está escrito e conferido pra que o "pode" seja uma palavra, não uma tarefa.

## Por que este e-mail existe

Os 8 compraram **SGP + assinatura FastCloner no MESMO checkout** (order bump —
os códigos provam: `HP3698277513C1` / `HP3698277513C2`). O nosso e-mail de 04/09
disse a eles que a assinatura **não** estava incluída e era "contratada à parte".
Era falso para os 8.

Medido em 07/09 13hZ, na Hotmart viva (`pagou_de_verdade`) e no banco:

| e-mail | nome | assinatura até | saldo | já logou? |
|---|---|---|---|---|
| max@md2net.com.br | Max Rabello Madsen | 2026-09-13 | 100.000 | **SIM** (04/09 16:48Z) |
| cris_evangelista22@hotmail.com | Cristiane Evangelista | 2026-09-13 | 100.000 | não |
| rmf174@gmail.com | Rodolfo Martins Ferreira | 2026-09-19 | 100.000 | não |
| flaviamalavazi@gmail.com | Flavia Telaroli | 2026-09-20 | 100.000 | não |
| rutifortuna8@gmail.com | Ruti Fortunato da Silva | 2026-09-20 | 100.000 | não |
| fmgimael@gmail.com | Fernando Marques Gimael | 2026-09-29 | 100.000 | não |
| malmeida313@yahoo.com | Mauro F. F. de Almeida | 2026-09-30 | 100.000 | não |
| atendimento@dropweb.com.br | José Carlos D. L. Filho | 2026-10-02 | 100.000 | não |

**7 de 8 nunca entraram.** Todos têm entitlement ativo e 100.000 créditos parados.

## O agravante que só apareceu agora

A ÚLTIMA palavra nossa pra eles é o uid da série *"Sua conta do Sistema de
Geracao Pronto esta pronta"* (04/09 ~15h30Z), e esse e-mail traz **as duas coisas
juntas**: o link pessoal de definir senha **e** o parágrafo falso. Ou seja, a
mesma mensagem abre a porta e manda a pessoa não entrar.

E o link de senha é **`type=recovery`, validade limitada, emitido em 04/09** —
3 dias atrás. Não medi a expiração no Supabase, mas token de recovery de 3 dias
não deve estar vivo. Por isso o texto abaixo **não** manda usar aquele link:
manda usar "esqueci minha senha", que funciona sempre.

Os 8 têm senha definida pelo lote e e-mail confirmado (`auth.users`), então o
fluxo de redefinição é o caminho certo — não precisam se cadastrar de novo.

## Texto (versão de quem NUNCA entrou — 7 pessoas)

> Assunto: Corrigindo o que te dissemos: a sua assinatura da plataforma ESTÁ ativa
>
> Olá, {NOME}. Escrevo para corrigir uma informação errada que nós te demos.
>
> No dia 4 de setembro você recebeu um e-mail nosso sobre o Sistema de Geração
> Pronto que dizia: *"o Sistema de Geração Pronto não inclui a assinatura da
> plataforma FastCloner — se você também quiser usar a plataforma, ela é
> contratada à parte"*.
>
> **Isso estava errado no seu caso, e o erro foi nosso.** Na sua compra, a
> assinatura da plataforma veio junto, no mesmo checkout. Você já pagou por ela.
>
> O que é verdade sobre a sua conta hoje:
>
> - A sua assinatura da plataforma está **ativa**, e ela **renova
>   automaticamente em {DATA}**. Essa data não é um prazo para você usar: é o dia
>   em que a Hotmart cobra o próximo mês.
> - Você tem **100.000 créditos** disponíveis, parados, esperando você.
> - **Não há nada a mais para contratar nem para pagar agora.**
>
> Como entrar (a sua conta já existe, não precisa se cadastrar):
>
> 1. Acesse https://fastcloner.com/app
> 2. Clique em "Esqueci minha senha" e use exatamente este e-mail: {EMAIL}
> 3. Defina a sua senha e pronto — os créditos já estão lá.
>
> Obs.: no e-mail de 4 de setembro havia um link para definir senha. Ele tinha
> prazo e a essa altura provavelmente expirou — por isso o caminho acima é o
> "Esqueci minha senha", que vale sempre.
>
> O Sistema de Geração Pronto (a montagem do seu clone pela nossa equipe) segue
> normalmente pelo https://fastcloner.com/sgp — uma coisa não substitui a outra.
> Você tem as duas.
>
> Se qualquer coisa não bater com o que escrevi aqui, responda este e-mail que eu
> verifico na hora.
>
> Abraço,
> Equipe FastCloner

## Texto (versão do Max — ele JÁ entrou)

Mesma correção, sem o bloco "como entrar" e sem a frase de nunca ter acessado.
Troca os passos 1-3 por:

> Você já acessou a plataforma em 4 de setembro, então a porta está aberta: é só
> entrar em https://fastcloner.com/app com este mesmo e-mail. A sua assinatura
> está ativa, renova em 13/09, e os 100.000 créditos estão na conta.

## Como enviar, se o "pode" vier

Um a um, `enviar_email.cjs`, **sem `--bcc`** (8 é lote; o resumo vai num aviso só
no grupo, conforme o README das ferramentas).

---

## ⚠️ CORREÇÃO DE 08/09 ~11hZ — o rascunho carregava o defeito do `a0bc1f7e`

**O texto acima, como estava escrito em 07/09, cometeria em lote o erro que a
casa abriu como incidente no mesmo dia.** Corrigido acima antes de qualquer
envio; registro aqui porque o raciocínio importa mais que a linha trocada.

A frase original era *"a sua assinatura da plataforma está **ativa até {DATA}**"*,
com {DATA} preenchida a partir de `entitlements.access_until`. Medido hoje na
fonte, nos **8**: `access_until` é **exatamente igual** a
`raw_event->purchase->date_next_charge`, e `raw_event->subscription->status` é
**ACTIVE** nos 8 (`LTY61KB0`, `E1239TIK`, `CL0KLOQ8`, `WEVYYE64`, `JJ54Q2L2`,
`AQA0PSFE`, `3847B6V3`, `E1BGOQEH`).

Para assinatura ACTIVE essa data é a **próxima cobrança**, não um vencimento.
"Ativa até 13/09" lido por quem paga significa "acaba em 13/09" — é a mesma
confusão que o `a0bc1f7e` (aberto 08/09 00:16Z) mediu ter custado **27.436
créditos queimados em 8h** por uma aluna que recebeu prazo falso da casa. Enviar
o rascunho como estava repetiria isso em **8 pessoas de uma vez**, e ainda por
cima em gente que nunca entrou e portanto tem os 100.000 intactos para queimar.

**A inversão que isso provoca na leitura do card:** ninguém dos 8 está "perdendo
a janela". Os 8 **renovam e são cobrados de novo** (13/09 Max e Cristiane, 19/09,
20/09 x2, 29/09, 30/09, 02/10). O relógio não é "corra antes que expire", é
**"em 13/09 duas pessoas pagam o segundo mês de uma plataforma que a nossa
própria carta disse que elas não tinham"**. É argumento de dinheiro, não de
prazo, e é mais forte.
