# Relatório noturno 12/09 — consolidado do dia (fechado 13/09 01:10Z)

Medido na ronda de fecho, não copiado das rondas anteriores. Toda afirmação
aqui tem a consulta que a produziu; os scripts ficaram em `_frank/rascunhos/`
(`estado_1209.cjs`, `recados_1209.cjs`, `limpar_fila_1209.cjs`,
`reembolsos_1209.cjs`, `clones2_1209.cjs`, `gpu_1209.cjs`).

## 1. O que foi resolvido (8 incidentes saíram da fila em 12/09)

Sete por mim, um pelo Vitor (`#361`, respondeu a aluna por e-mail).

| # | O que era | Fecho |
|---|---|---|
| #364 | SGP: a perna da FOTO não tinha estado terminal. Imagem morta na moderação do Kie deixava o pedido em `processando` pra sempre — comprador de R$ 94 (rafaelzan@me.com) ficou **19,2h em silêncio**. A morte era falso positivo de moderação sobre o prompt da própria casa | 3 PRs em produção: #246 (786742d), #247 (1aed583), #248 (45f27c6) |
| #349 | SGP: o dedup de foto barrava foto DIFERENTE como repetida (dHash 8x8 não separa "re-salva" de "outra foto da mesma pessoa") e trancava o aluno na tela 2 — 1 pagante ~6h preso | dHash 16x16, régua remedida em 214 fotos / 481 pares, 0 falso-positivo. dc3d941 (PR #243) |
| #365 | O e-mail do código do SGP mandava "digite na tela" sem dizer qual tela e sem link — quem fechasse a aba não tinha caminho de volta | 97b910b (PR #250), 3 pagantes avisados |
| #362 | Voz recusada por ENVIO PERDIDO (falha nossa) não abria chamado nem contato: morria num `console.warn`. Hellen, pagante de 05/09 (GBP 47,94 + R$ 597,00), ficou **6 dias sem uma linha nossa** | patch do Vigia revisado, estendido e subido: 03a7922 (PR #256) |
| #313 | Comprador de CURSO ganhava a plataforma vitalícia de graça (15 entitlements `active` com `access_until` NULL, 12 pessoas) | 36886fa / merge b97e9f47 (PR #242). **A decisão comercial sobre os 12 segue fora da fila** |
| #326 | "Aluno travado na tela 1 do SGP" — premissa medida e **não confirmada** (welrisson concluiu o wizard sozinho em 4 min; o outro caso nunca foi recusado pelo portão) | fechado `ignored`, sem conserto: não mantenho cartão de pé por anedota |
| #366 | Voz "Minha Voz" do alexandre@novaconexao.com — referência conferida intacta | fechado |
| #361 | Aluna mandou vídeo da equipe pra análise | Vitor respondeu por e-mail |

Também subiu, sem fechar cartão: **#52** (o gate da falha passa a incluir o
job_id — falha de job velho para de estornar por cima do reenvio, 676f64f /
PR #252) e a **parte visível do #226** (o suporte passa a enxergar geração
entregue com QA esgotado, 999aeb4 / PR #253).

## 2. Limpeza da fila de recados feita agora (não é relatório, é conserto)

A fila do `agent_state` estava com **68 recados** e **3 patches**. Cruzei cada
chave com o estado do incidente citado: **8 chaves já estavam resolvidas e só
entulhavam a varredura** — exatamente a armadilha da §1-B/1-C (chave que não é
apagada volta em toda ronda e esconde o que importa).

Apagadas com `DELETE` (7 recados + 1 patch):
`para_frank_76e68853` (#326), `para_frank_2245e0b0` (#352),
`para_frank_b68401c2` (#361), `para_frank_4b47a6fd` (#364),
`para_frank_436104f4` (#365), `para_frank_c55df030` (#366),
`patch_12d4db57` (#362, aplicado hoje).

Apagada também `patch_81438b60` (#335): o patch foi **refutado por medição** na
ronda das 21hZ e a objeção está escrita no incidente — rotina §1-B passo 6
manda apagar a chave tanto no aplicado quanto no recusado.

**Resultado: recados 68 → 62, patches 3 → 1.** A dívida real de patch é 1
(`patch_7578c587`, #304, mojibake de um byte ISO-8859-1 na citação do Gmail),
parada há 73h e ainda sem revisão minha.

## 3. Produção — o que está no ar AGORA

- `BUILD_ID=_IpirTvkAmv6VY1vN6rK1`, pm2 `aiverse` **online**, no ar há 3,2h
  (subiu ~21:53Z).
- O último merge de **código** na main foi `03a7922`, 21:47Z. O build rodando
  é posterior a ele → **todos os 7 merges de código de hoje estão no ar**.
  Os commits depois disso (`69d4c01`, `dd96fe4`, `4a7c3f0`, `0fc5ffd`,
  `f85d946`, `8dea54c`) são registro de ronda, não código.
- Conferido pelo BUILD_ID no servidor, não por Action verde.

## 4. Estado geral (medido, não estimado)

- **80 incidentes abertos** (79 `investigating`, 1 `open`) + **10 aguardando
  aluno**. 12 nasceram hoje, 8 fecharam. O saldo do dia é +4.
- **62 recados** na fila, o mais velho **271h** (#226, é decisão do Johnny, não
  trabalho meu). Faixa: 10 acima de 7 dias, 42 entre 2 e 7 dias, 16 abaixo de 48h.
- **1 patch do Vigia** esperando revisão há 73h (#304).
- **3 clones de vídeo rodando** (0,8h a 1,2h, vídeos de 52 a 65s). Conferidos um
  a um na RunPod: os três `IN_PROGRESS`, 3 workers rodando, **fila zero**.
  Não estão travados, estão demorando — `delayTime` de 38 a 50 min antes de
  começar, com 2 workers `throttled` (datacenter sem GPU livre, nada a fazer no
  código). **Não avisei ninguém na hora porque nenhum job está morto.**
- **1 aluno com acesso vivo, crédito no bolso e nenhuma voz pronta**:
  marcelopersonalthe32@gmail.com, sem voz desde 10/08 (**34 dias**), acesso até
  05/10, voz `failed`. Já foi contatado (a mensagem no cartão assume a culpa
  nossa) e é o mesmo aluno do #265 (janela de garantia errada). **Continua sem
  voz — é o item mais velho de aluno vivo que sobrou.**
- **Sweeps vivos**: `sweep-clones` de 5 em 5 min e `mail-sweep` de 10 em 10,
  `errors: 0` em todas as rodadas da última hora; o mail-sweep respondeu 2
  e-mails depois da meia-noite. Nada mudo.
- **Estornos em dia**: 10 tipos, 3.168 linhas varridas, nenhum tipo desconhecido.
- **GPU**: voz com 4 workers idle e fila zero; vídeo com 3 rodando e fila zero.

## 5. Dinheiro parado esperando decisão

**24 dos 80 cartões abertos têm dinheiro em jogo.** Desses, 9 são pedido de
reembolso/cancelamento de aluno parado na fila esperando alguém decidir:

| # | Aluno | Valor | Parado |
|---|---|---|---|
| #363 | Rodrigo | R$ 1.194,90 | 1,0d — **pediu dentro do prazo; a garantia venceu 12/09 00:00Z enquanto ele esperava na NOSSA fila (106h)** |
| #356 | Teresa (tuquinha36) | R$ 2.809,32 (5 compras) | 1,4d — já confirmou por escrito |
| #299 | Lucila | R$ 291 (2 assinaturas) | 5,4d — garantia venceu 10/09 na fila |
| #309 | Victor | 2 compras | 4,3d — garantia venceu 11/09 na fila |
| #223 | Alana | — | 11,4d — garantia venceu 08/09 na fila |
| #360 | wgc.advogado | — | 1,2d — arrependimento em menos de 7 dias |
| #301 | Simone | 2 produtos | 5,3d |
| #307 | franciswd | — | 4,4d — compra 04/09, dentro da garantia |
| #325 | Mara | — | 3,2d — não acha a opção de cancelar |

O padrão é o mesmo do #350, que já está aberto como cartão técnico: **a casa só
olha a garantia quando vai RESPONDER, nunca enquanto o pedido espera na fila.**
O relógio corre dentro da fila e ninguém vê. Três alunos já perderam a janela
assim (Alana, Lucila, Victor) e o Rodrigo foi o quarto, ontem.

Enquanto a decisão de reembolso for caso a caso e minha alçada parar antes
dela, a fila vai continuar produzindo garantia vencida por demora nossa. É por
isso que a pergunta 5 do relatório existe.

## 6. O que eu NÃO fiz e por quê

- Não mexi em crédito de ninguém: os dois blocos grandes (#226, 290 gerações /
  132 alunos; #341, 16 carteiras negativas somando -168.400 cr) passam do teto
  de 20k cr ou dependem de decisão de produto.
- Não respondi os 9 pedidos de reembolso: falar em nome da empresa sobre
  devolução de dinheiro está na lista de "pergunte antes".
- Não cancelei a assinatura órfã do Neto Rocha (code AI2H1K8Y) apesar de ele
  ter pedido por escrito em 04/09 — cancelar assinatura é dinheiro/mundo
  externo. Esse pedido está no grupo desde 05/09 **sem resposta há 197h**, e o
  prazo que dava pra prevenir (04/09 12:00Z) já passou: agora provavelmente é
  estorno, não prevenção. **Esse atraso é meu no sentido de que eu não insisti;
  a decisão nunca foi minha.**
