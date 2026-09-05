# Ronda das falhas — 05/09/2026 ~18:40–18:55Z (Frank, dono da fila)

Fila no início: **25 abertos + 13 aguardando aluno**.

**Resultado: o Vídeo Clone continua sem prova de vida e eu troquei de
incidente. Peguei o `#265` (janela de garantia) e levei até onde dava sem o
Johnny: PR #191, com o defeito medido, decomposto e testado. E a ronda passada
carregou um item que já estava morto há 5 horas.**

---

## 1. `gh pr list` primeiro — quarta ronda seguida em que paga

20 PRs abertos. Nenhum é o #190 (mergeado ontem à noite pelo padrão da ronda
das 17h). Os cinco mais novos são de hoje: #189, #188, #187, #186, #185.

## 2. Vídeo Clone: nada mudou, e "nada" aqui é um fato, não uma desculpa

Deploy da imagem nova às 17h47:54Z. Medido agora, 18h41Z:

| o que eu perguntei | resposta |
|---|---|
| débito ou estorno `video_clone*` depois do deploy | **zero linha** |
| linha nova em `video_clones` depois do deploy | **zero** |
| última falha conhecida | segue 17h29:33Z (`ederonline1`) |

**54 minutos, nenhuma tentativa.** É sábado 15h40 BRT, então plausível — mas
plausível não é medido, e eu não vou chamar de resolvido um deploy verde. A
ronda das 15h já se avisou contra isso ("health verde cego") e a das 17h
repetiu ("deploy verde e ferramenta sem prova de vida"). Continua valendo.

**Em que passo está travado, com nome:** (a) o "pode" pra queimar GPU num teste
por conta da casa foi pedido ao grupo às 17h58Z e não voltou; (b) conferir se o
volume foi populado exige um pod com o volume montado, que custa dinheiro e não
é meu mandato. **Não repedi.** 47 minutos depois do primeiro pedido, insistir é
pressão, não atendimento — é a mesma régua que apliquei ao Carlos Augusto hoje
de manhã e não vou afrouxar quando o incomodado sou eu.

Regra 8 é explícita: travou, diga em que passo e vá pro próximo. Fui.

## 3. A ronda das 17h carregou um morto na lista

O log das 17h fecha com: *"Solon: cobrança em dobro dispara 06/09 12h. Se a
ronda de amanhã cedo não pegar, ele é cobrado."*

**Isso era falso quando foi escrito.** A perna do Solon caiu às **12h38:43Z de
hoje** — ele mesmo pediu o cancelamento às 12h24:34Z e a Hotmart registrou
`CANCELLED_BY_SELLER` 14 minutos depois. Está anotado no `#254` desde 12h45Z,
pela minha própria nota, com a medição no `#262`.

Como o erro entrou: o item foi copiado do bloco "herdado e não tocado hoje" de
uma ronda anterior sem releitura da nota mais recente do card. **O que
"herdado" quer dizer é "não trabalhei nisto", não "continua verdadeiro"** — e
listar pendência sem reconferir transforma o log num boato que se propaga entre
rondas. O custo real: eu ia começar esta ronda pelo Solon, como exceção de
"dinheiro sendo cobrado errado agora", e teria gasto o turno num caso fechado.

**Regra que passa a valer:** item repetido de ronda anterior só entra no
relatório depois de reler a última nota do card. Se não deu pra reler, entra
escrito como *não reconferido*.

O que sobrou de verdade no `#254`: Jackson (proposta parada com o Johnny desde
04/09 21:19Z) e Carlos Augusto (R$194 por ciclo, próximo débito 22/09, lembrete
previsto pra 07/09). Nenhum tem data de amanhã.

## 4. Escolhi o `#265`, e não o mais antigo — por quê

Os três mais antigos estão travados **em terceiro**, não em mim:

| card | idade | travado em |
|---|---|---|
| `#15` timeout | 37 dias | aval do Johnny pra migration 82, pedido hoje 11h50Z |
| `#222` órfãs | 4 dias | já medido que **nenhuma** chave automática resgata a população |
| Vídeo Clone | hoje | item 2 acima |

O `#265` estava `open` desde 14h52 com **zero nota** — ninguém tinha confirmado
sequer se era real.

## 5. O título do `#265` está enganoso, e isso importa

Ele diz *"57 alunos estão DENTRO da janela agora e o sistema diz FORA"*. Lido
assim, são 57 vítimas de um bug. Medindo na fonte e decompondo:

| recorte | alunos |
|---|---|
| mantendo a âncora de hoje, corrigindo **só** a constante | **3** |
| dependem de a **renovação reabrir a garantia** | **54** |

Os 54 não são bug: são uma **decisão de dinheiro** que não é minha. Tratar os
57 como um número só faria o conserto parecer 19× maior do que é **e**
embutiria uma decisão do Johnny dentro de um PR técnico, onde ela passaria sem
ninguém perceber que foi tomada.

## 6. O defeito real, e ele erra para os DOIS lados

`warranty_date` está presente em **694 de 694** compras pagas — zero ausências.
Janela real, em compras pagas:

| dias | compras pagas |
|---|---|
| 6 | 648 |
| 7 | 17 |
| 14 | 24 |
| 15 | 3 |
| 30 | 1 |

O card só registrava metade do estrago:

- **14/15/30 dias** → a constante fechava cedo e a Fast dizia **FORA a quem
  estava DENTRO**. São os 3.
- **6 dias** (a esmagadora maioria) → ela **abria um dia a mais** do que a
  Hotmart honra. Isso é literalmente o *"promete dinheiro que não volta"* que o
  `#198` criou esta função pra impedir. Medido: **0 alunos nesse vão agora** —
  mas isso é sorte de calendário, não segurança, e por isso conta como defeito.

**Os 3, com nome e prazo:**

| aluno | garantia real até | o que a Fast diria hoje |
|---|---|---|
| `katiasalvador32@` | **06/09 — amanhã** | FORA |
| `luanmarcal.com@` | 13/09 | FORA desde hoje 05:47Z |
| `zicasantos08@` | 10/09 | FORA |

O `luanmarcal` é o **mesmo** que aparece na varredura de travados: import
quebrou em 29/08, 8 dias, nunca chegou a ter voz. **A pessoa com mais motivo
pra pedir dinheiro de volta era justamente a que o sistema mandava calar.**

## 7. Por que passou 6 dias: a função que decide dinheiro não tinha um teste

E não *dava* pra ter. Ela morava dentro do `account.ts`, que importa
`@/lib/db/admin` — `node --test` nem carrega o módulo. Errar ali não quebra
nada: **o texto sai bonito e errado**.

Separei a decisão pura em `frontend/src/lib/agent/garantia.ts`, **sem nenhum
import**, com o `agora` entrando por parâmetro (prazo testado com relógio real
vira teste que passa hoje e quebra amanhã sozinho, sem ninguém ter mexido em
nada).

## 8. Dois achados que o card não tinha

**O "7 dias" também estava no PROMPT** — `manual.ts:388-393` e
`mail-respond.ts:124`. Só trocar a conta deixaria a *instrução* reintroduzindo
pelo texto o número que o *código* parou de usar. Os dois passaram a mandar
citar a **DATA**, nunca um número de dias.

**Armadilha de parse:** no MESMO payload, `approved_date` vem em **epoch ms** e
`warranty_date` vem **ISO**. Passar o ISO pelo conversor de epoch devolve
`null` e a compra cai fora da conta **em silêncio** — sem erro, só uma pessoa a
menos na medição. Tem parse próprio e teste dedicado.

## 9. Entrega

**PR #191**, branch `fix/garantia-warranty-date-real`, commit `ed0f266`.

Conservadorismo mantido nas quatro pontas, todas pro lado de **não prometer
reembolso a mais**: vale a janela que **fecha primeiro**; `00:00Z` é o **fim**,
sem esticar pro fim do dia; sem `warranty_date` legível vira **ESCALAR** — não
existe constante de reserva, porque foi a constante que produziu o incidente.

Prova: **10/10** no arquivo novo (amostras reais; o caso da Katia, com uma
compra de R$0 e uma paga, prova de uma vez o filtro de compra paga **e** a
regra do "fecha primeiro" — sem o filtro, a adesão de R$0 fecharia a janela
dela em 30/08), **31/31** nos testes de agent existentes, `tsc` e `eslint`
limpos nos 5 arquivos.

## 10. O que eu NÃO fiz

Não fechei incidente e **não marquei `fixed`** — PR aberto não é produção, e sem
merge a Fast continua dizendo FORA pra Katia hoje. Não mexi na âncora. Não
escrevi pra nenhum dos 3 alunos: **nenhum pediu reembolso**, e oferecer
devolução a quem não pediu é gastar dinheiro do Johnny por iniciativa própria.
Não mergeei PR, não apliquei migration, não mexi em crédito, não estornei, não
gastei GPU, não toquei em nada da planilha (ordem de 29/08) e não li a caixa do
`suporte@` pra triagem.

## 11. Próxima ronda começa por aqui

1. **`gh pr list` primeiro.** Quarta seguida em que paga.
2. **Vídeo Clone: voltou?** Conte pelo extrato (`ref_type='video_clone_refund'`),
   não por `video_clones`. Só vale **geração `ready` no banco** — não vale
   health do RunPod, não vale PR mergeado, não vale deploy verde.
3. **Se a primeira geração pós-deploy falhar**, suspeita nº 1 é volume não
   populado, e o cuidado nº 1 é **não deixar acumular tentativa**: cada uma é
   uma chance de deixar diretório pela metade no volume persistente e
   transformar o apagão em permanente.
4. **`#265`: o PR #191 mergeou?** Se sim, confira a linha em produção antes de
   marcar `fixed`. **Se passar de 06/09 sem merge, a Katia perdeu a janela** —
   escreva isso no relatório em vez de deixar sumir.
5. **Item repetido de ronda anterior só entra depois de reler a última nota do
   card** (item 3). Se não deu pra reler, escreva *não reconferido*.
6. Continuam parados com o Johnny, sem repetir o pedido: migration 82 (`#15`),
   "pode" do teste de GPU (Vídeo Clone), renovação-reabre-garantia (`#265`),
   proposta do Jackson (`#254`).

## Registro

`git checkout main && git pull --ff-only origin main` limpo no início. Fila
lida pela varredura, não pela caixa do `suporte@` (ordem de 19/08). Estorno em
dia (10 tipos, 2.814 linhas, nenhum tipo desconhecido). Uma nota via
`anotar_incidente.cjs` no `#265` (`71410a81`), releitura conferida em 1 linha
afetada, `open` → `investigating`, 1 → 2 notas. Nenhum e-mail a aluno. Um aviso
ao **GRUPO** (o PR, o prazo da Katia e a pergunta da renovação), nunca ao
privado — ordem de canal de 31/08. Código por branch `feat/`+PR; log commitado
na **main**.
