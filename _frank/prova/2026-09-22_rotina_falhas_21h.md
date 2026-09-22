# Ronda das falhas — 22/09/2026 ~21hZ (Frank, dono da fila)

Serial pela regra 8. Não escrevi pra aluno, não mexi em crédito/acesso/
entitlement, não cancelei assinatura, não mergeei nada, não gastei GPU.
Gravei UMA nota de incidente (#494 / `719c9af6`) e este log.

## Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar` | 1066 lidas = 989 já com linha + 77 fora da janela + **0 escrituráveis**. Contagem fecha (1066 = 1066). |
| `enviados_x_tabela.cjs` (irmão de leitura) | **0 carta depois do corte** fora da tabela. Veredito: buraco PASSIVO. |
| `percepcao_travada.cjs` | **0** card travado em percepção (controle positivo #310 reencontrado, 510 varridos). |
| `garantia_na_fila.cjs` | 6 perderam a janela · 1 vence em 48h · **0** na perna da renovação. |
| `idade_incidentes.cjs` | **105 abertos**. 30d+: 3 · 15–30d: 16 · 7–15d: 37 · 3–7d: 28 · <3d: 21. |

## Os 3 mais velhos estão TODOS travados na mesma pessoa, e nenhum é alçada minha

Peguei a fila pela ordem da regra 8 (mais antigo com aluno afetado) e os três
primeiros pararam no mesmo lugar. Digo o passo exato de cada um e sigo:

| # | Idade | Passo que emperrou | Dono |
|---|---|---|---|
| `c726c5ae` | 105,2d | "pode" pro merge do PR #214 + semear o dedupe na mesma janela; e a decisão de dinheiro dos 23 com assinatura viva e zero acesso | Johnny |
| `b706b32e` | 39,8d | merge do PR #398 + decisão dos 10.000 cr do Heitor | Johnny |
| `f1ada07e` | 18,0d | "pode" do reembolso (parado há **18 dias**) + a frase escrita do titular (9-C) | Johnny + aluno |

Não reabri a análise de nenhum dos três: está escrita e medida nas rondas de
20–22/09. Repetir a medição deles é o que queimou o `#479` em três rondas
seguidas. **Próxima cobrança da classe do `c726c5ae` cai em 26/09**
(`GGMWWE5Q`) — é o relógio mais curto dos três.

## O que peguei: #494 (`719c9af6`) — Vídeo Clone, "realismo"

Escolhido por ser o mais velho **com aluno afetado que não depende do Johnny
pra andar**: 21,9d, 9 alunos, `open`.

### A medição da classe FECHOU — a dívida (a) de 20/09 está quitada

Com o lote despachado pelo vigia às 18:21Z e o veredito das 20:15Z, a classe
foi de 4 vídeos / 3 alunos para **10 vídeos / 9 de 9 alunos**. Lip-sync
absolvido em **10 de 10**; corpo e mãos com movimento **ZERO em 10 de 10**.
A tese do cartão ("a queixa não é lip-sync, é corpo parado") foi ao único
teste que podia derrubá-la e não caiu.

Aceitei a medição do vigia **com o controle positivo dele** (ffprobe no
`6ebf6649`, 21,16s / 529 frames — o caso de maior divergência), não de graça.
Não refiz o que já estava provado.

### Parei antes de escrever pros 7, e o motivo é o erro que quase cometi

Fui cumprir a dívida (b) — "faltam 7 alunos pra responder com a verdade
medida". Consultei `emails_enviados`: 27 cartas pra 7 deles, e **zero linha**
pra `ricardo@inventivebox.pt` e `contato@mastroiannioliveira.com.br`. Ia
tratar como 21 dias de silêncio absoluto e escrever na hora.

**Não é silêncio, e os cartões deles provam:**

- **ricardo** tem o `#d392f1d4` (13/09, `aguardando_aluno`) com a nota "ASSISTI
  AO VIDEO" e a medição inteira do `6ebf6649`. Ele chegou pelo **chat do app**
  — resposta por chat não vira linha em `emails_enviados`.
- **mastroianni** tem DOIS cartões `fixed` (`#3528dd59`, `#972e8a4d`) com
  entrega conferida em **13/09**, ou seja **antes do corte** de 14/09
  14:06:31Z: está dentro das 77 cartas que a reconciliação exclui de propósito
  e que nunca foram escrituradas.

> **Lição, que já estava escrita e eu quase atropelei:** ausência de linha em
> `emails_enviados` **não é prova de silêncio**. O próprio
> `aberto_mas_ja_respondido.cjs` avisa isso na saída ("sem carta depois de
> nascer: 23 — isto NÃO é prova de silêncio"). Quem for responder esta classe
> tem de abrir o **cartão do aluno** antes, não a tabela.

Foi também o segundo tropeço de método da ronda: a primeira consulta que fiz
pra `profiles`/`emails_enviados` voltou **zero pra todos os 9**, e eu quase
reportei a classe inteira como sem conta e sem carta. Era bug meu — `full_name`
em vez de `display_name`, `destinatario` em vez de `to_email`. Só apareceu
porque a regra manda **imprimir o erro cru antes de acreditar em qualquer
zero**. Com as colunas certas: 9 de 9 têm perfil e 27 cartas existem.

### Quem da classe ainda está na casa (medido agora em `profiles`)

7 dos 9 seguem **pagantes e ativos hoje**; 1 está saindo
(`fabianabedin2016`, pedido de cancelamento, acesso até 30/09); 1 **já saiu
reembolsada** (`tuquinha36`, reembolso em 17/09, hoje `free` e
`access_until` NULL). `contato@mastroiannioliveira` está com **874 créditos**,
praticamente zerado. O cartão já registrava 1 cancelamento (#411) e 1 pedido
de reembolso (#412) nascidos desta classe — com a tuquinha, sobe pra 3 o que
a classe já custou.

### Por que NÃO saiu carta em leva daqui

7 pagantes receberem no mesmo dia a frase *"o motor não move o corpo e nenhuma
foto conserta isso"* é, na prática, um **comunicado de limitação de produto**
pra classe inteira. Isso é e-mail em MASSA e cai na regra 8 de 21/08 (precisa
do "pode"), não em resposta individual. Carta individual de caso que eu esteja
tratando eu mando sozinho e **não segurei nenhuma** nesta ronda; o que não vou
fazer é transformar 7 respostas individuais num anúncio coletivo sem o Johnny
saber — ainda mais com o "pode" de reembolso desta casa parado há 18 dias.

### O que segue ferindo e não depende de medição nenhuma

A casa continua respondendo queixa de realismo com dica de **enquadramento de
foto**. Com 10 vídeos medidos, o controle do Igor decide: mesma conta, mesmo
motor, a foto correta levou a nota de **5,0 → 7,5** (a piscada voltou, a boca
ficou nítida) e os braços seguiram parados **nos dois**. Enquadramento melhora
o ROSTO — a dica não é inútil — mas **não alcança quem reclama de corpo
parado**. Quem recebe essa dica refaz foto e paga geração de novo perseguindo
um efeito que o motor não produz.

Notas de 6,5 a 7,5 (média **6,92**): não é vídeo quebrado, é vídeo bom que
parece estátua. O remédio é de **produto**, não conserto de bug — e produto,
preço e estorno são do Johnny e do Lucas.

### Status: segue `open`, de propósito

Não é `fixed` (regra 14: nada foi resolvido pros alunos) e não é
`aguardando_aluno` (mentiria sobre quem deve o próximo passo — quem deve é a
CASA). Próximo passo com dono e nome: decisão de produto sobre o que esta
classe ouve, e o "pode" pro texto que vai a eles.

## Ferramenta nova (read-only)

`_frank/ferramentas/2026-09-22_ler_cartao.cjs` — lê um cartão por prefixo com
as N últimas notas. Só LÊ. Nasceu porque `id` é `uuid` e não aceita `LIKE`
(`operator does not exist: uuid ~~ unknown`), então ela puxa e filtra o
prefixo no cliente.

## Fim de ronda

- `git log --oneline origin/main..HEAD` conferido **vazio** após o push deste log.
- Nada tocado em código de produção: uma nota de incidente, uma ferramenta de
  leitura e este log.
- O passo de `git branch` + `git rev-list main..<branch>` do manual **continua
  inútil neste repo** (~190 falsos positivos por causa do merge por squash) —
  já registrado na ronda das 20hZ. O que responde "tem conserto pronto fora do
  ar?" é `gh pr list --state open` mais conferência por **conteúdo** na
  `origin/main`.
