# Rotina das falhas — 01/09/2026, ~18hZ

Ordens lidas antes de tocar em qualquer coisa: índice `ordens/README.md`,
`2026-08-29_desligar_vigia_e_frank.md` (planilha fora do perímetro),
`2026-08-27_vigia_so_erro_de_sistema.md`, canal de 31/08 (grupo).
Método serial (regra 8, 21/08).

Placar de entrada, consulta **sem cláusula de status**: **18 não-fechados**
(1 open + 10 investigating + 7 `aguardando_aluno`). Bate com o Vigia das 18hZ.

## A escolha do incidente, e por que não foi o mais antigo

O mais antigo com aluno afetado é o **`6c38c99d`** (Luciano, 23/08, 9 dias).
Fui ler antes de pular: ele está `aguardando_aluno` **com razão** — recebeu em
29/08 a avaliação técnica medida (frames comparados, degradação do motor
provada num clipe de 6s), o estorno de 630 cr foi conferido por `ref_type` e o
aluno não respondeu desde então. Regra 8: mandou o e-mail, anotou a data, saiu
do colo. **Não mexi.**

Peguei o **`954ca6c9` — Johnathan Pires**, o mais antigo que está de fato *no
meu colo*: pagante, parado há 5 dias, e escalado pelo Vigia em **5 rondas
seguidas** sem nunca ter sido resolvido.

## O fato que 5 rondas repetiram errado

As rondas e o Vigia vinham registrando *"Johnathan, pagante de R$ 2.391, parado
na fila manual sem dono"*, com a implicação de que ele comprou a plataforma.

Medi. **Ele pagou os R$ 2.391 — mas não pela plataforma.** São três compras
avulsas de **curso**, todas em 27/08, todas APPROVED:

| produto | valor | pedido |
|---|---|---|
| Fábrica de Conteúdo Invisível | R$ 297 | HP2705120177 |
| Sistema de Geração Pronto | R$ 597 | HP3595813880 |
| Comunidade Presença Lucrativa | R$ 1.497 | HP0272337557 |

Assinatura do FastCloner: **zero**. Linhas em `entitlements` com o e-mail dele:
**zero**. Ou seja, o `aluno.cjs` lendo *"SEM ACESSO, 0 créditos, compras
NENHUMA"* **está certo** — e este caso **não** é o bug de compra órfã do
`3ca22d47`: ele não aparece naquela lista e não existe entitlement nenhum para
casar. Duas classes diferentes que estavam sendo somadas na mesma frase.

## A hipótese que eu levantei e derrubei sozinho

Antes de levar ao Johnny, testei se o curso libera a plataforma. Primeira
medição: **26 compradores** desses cursos, **nenhum** comprou o FastCloner, e
ainda assim **13 têm entitlement ativo**. Isso parecia prova de que a compra do
curso concede acesso — e eu estava a um passo de reportar isso como regra.

Fui na origem antes de afirmar. As 16 entitlements desse grupo foram criadas
**todas em 2026-06-09**, num lote único (18 no dia inteiro, 16 órfãs, 17 sem
`access_until`). É **cohort de importação antiga**, não concessão automática.

**Conclusão: hoje o curso NÃO libera a plataforma. Era correlação, não regra.**

Registro porque é exatamente o tipo de achado plausível-e-errado que a ordem de
20/08 manda não repetir — e desta vez ele morreu antes de virar decisão.

### Armadilha de SQL medida no caminho

Duas, e as duas dariam número errado com cara de número certo:

1. **`NOT IN (subquery com NULL)` devolve 0 em silêncio.** Minha primeira
   passada deu `0` e `0` onde a segunda deu `13` — resultados contraditórios na
   mesma pergunta. Se eu tivesse rodado só a primeira, teria concluído "nenhum
   comprador de curso tem acesso".
2. **`LEFT JOIN` + `count()` conta LINHAS, não pessoas** — inflou 13 para 24.

Refeito com `EXISTS`/`NOT EXISTS` + `IS NOT NULL`. Quem for medir esta classe
de novo: use isso, não join com count.

## O que pesa contra nós — e é o núcleo da decisão

Foi a **nossa** operação que colocou ele no fluxo de onboarding:

- 3 avatares gerados por conta da casa (28/08 02:12, −1.575, perdoados em 30/08);
- o áudio pedido a ele repetidas vezes;
- e-mail de 29/08 10:50 prometendo *"nós mesmos rodamos o processamento da sua
  voz, você não precisa mandar mais nada"*.

Ele cumpriu a parte dele **por completo desde 27/08** (15 mp4, link correto,
conferido). A expectativa foi criada por nós, não por ele. Depois disso o
importador foi desativado (ordem de 29/08, decisão nossa) e o caso ficou sem
dono.

## Dinheiro

Nada a estornar, nada cobrado. Ledger conferido: só os 3× −525 de avatar de
onboarding (negativo autorizado) e o +1.575 de perdão em 30/08. Saldo 0.
Nenhum treino cobrado porque **nenhum treino ocorreu** — ele tem **0 vozes**.

Nota lateral: o texto do perdão de 30/08 diz *"o material (voz e/ou avatares)
foi entregue pela planilha"*. A parte "voz" é **falsa** — ele nunca teve voz.
Mesmo padrão do `#171`: nota afirmando entrega que não aconteceu.

## Aluno avisado — promessa de hoje cumprida

Às **16:00Z** ele escreveu: *"Preciso que alguém da equipe entre em contato
comigo para explicar direito o andamento, tudo está bem confuso pra mim."*
Às **16:05Z** a Fast prometeu contato da equipe *"hoje ainda"* (Enviados uid
414). Faltavam ~2h40 e ninguém tinha ido.

Escrevi às 18hZ — **Enviados uid 426, 1ª tentativa**, bcc `suporte@`, endereço
com match único em `profiles`, ensaiado em `--dry-run` e lido inteiro antes.
No e-mail: a linha do tempo completa, que as 3 compras são **curso** e que a
plataforma é produto separado, a assunção de que a expectativa foi criada por
nós, e que nada foi cobrado. **Não prometi data** — promessa de data sem dono
foi exatamente o erro de sexta. **Não antecipei veredito comercial nenhum.**

## Erro meu nesta ronda, e a correção

Ao anotar, marquei o chamado como `aguardando_aluno`. **Estava errado** e
corrigi 5 minutos depois. Não há nada esperando do aluno: quem deve resposta é
o Johnny. `aguardando_aluno` teria enfiado o caso no **limbo que o Vigia mede há
3 rondas** (7 chamados fora de toda contagem) e teria transferido para o aluno
uma espera que é nossa. Voltou para `investigating`, onde aparece e cobra.

## Bloqueio real, único

**Decisão do Johnny:** libera o processamento da voz (custo: 1 treino) ou
comunica que a plataforma é produto separado. Levado ao **grupo** às 18hZ com os
números acima. **6ª ronda pedindo.**

Os dois bloqueios técnicos antigos (`66b217d5` quota/`drive.ts`, `e8c2bbc1`
subpasta) estão `ignored` desde 29/08 e **assim devem ficar**: nasceram da
planilha, que saiu por ordem. Não reabri e não devem ser reabertos.

## Perímetro da ordem de 29/08

Nada de planilha foi lido, escrito, classificado ou reprocessado. O caso do
Johnathan foi tratado pelo lado que **não** é planilha: pagamento, entitlement,
crédito e comunicação com o aluno.

## Passo fixo de fim de ronda

`git log --oneline origin/main..HEAD` conferido após o commit deste log.
Esta ronda **não criou branch de código** — nenhum fix ficou preso.
O check de 49 branches divergentes continua sendo ruído conhecido (card
`936eb605` **falhou**; segue sem dono útil), registrado na ronda das 17hZ.

## Estado final

Um incidente levado até o limite do que não depende de decisão alheia: **fato
central corrigido, hipótese falsa derrubada antes de virar recomendação, aluno
respondido dentro da promessa do dia, dinheiro conferido, erro próprio corrigido
e registrado.** Não fechado — porque não está resolvido, e o que falta é uma
decisão comercial que não é minha.
