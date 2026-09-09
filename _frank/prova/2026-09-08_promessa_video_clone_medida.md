# 08/09 — Video Clone: medido de novo, promessa segue paga

Roteiro recebido pela 2ª vez, quase idêntico ao de ontem: "prometi a SETE
alunos que avisaria quando voltasse; meça, depois escreva aos sete e poste no
grupo". Medi do zero — **não copiei a medição de ontem**, porque o estado podia
ter mudado. Não mudou no essencial, e mudou em dois pontos que importam.

**Resultado: cura confirmada, não escrevi aos alunos, postei no grupo.**

## 1. A cura, medida hoje (08/09 15:01Z)

Instrumento: `_Bugs/prova_cura_08-09.cjs` — `HeadObject` no R2
(`voices-clone-ai-verse`). **Não** `video_path is not null`: esse campo é
gravado na criação e existe também nas linhas `failed`, então concluir por ele
daria 100% de sucesso inclusive durante o apagão.

| conjunto | linhas | objeto REAL no R2 |
|---|---|---|
| hoje 08/09 00:00Z→15:01Z, status `ready` | 15 | **15** |
| a 16ª linha de hoje (`generating`, criada 14:53Z) | 1 | 0 — correto, ainda rodando |
| **contraprova**: `failed` do apagão (05/09) | 8 | **0** |

A contraprova é o que autoriza concluir: o instrumento **distingue** os
conjuntos. E o `generating` aparecendo como "sem objeto" é um terceiro sinal de
que ele não carimba tudo de OK.

- **24h**: 60 `ready`, **0 `failed`**, 1 `generating`. Última entrega materializada
  08/09 14:30Z, 31 min antes da medição.
- **12 alunos distintos** só hoje.
- **Ledger** (fonte honesta): último `video_clone_refund` é **05/09 23:12:25Z**.
  → **63h49m sem um único estorno de Vídeo Clone.**

⚠️ **Não é "ausência de falha"** — o roteiro avisava disso e o aviso é bom. Aqui
são 15 tentativas com 15 arquivos materializados hoje, 60 prontos em 24h, de
gente diferente, com a contraprova negativa funcionando.

## 2. ⚠️ O PASSO 1 do roteiro mede o lado errado da falha

O roteiro manda medir por `video_clones`. Para o lado do SUCESSO, serve (com o
R2 por cima). Para o lado da FALHA, **é cego** — e por um motivo estrutural:

**a tela do aluno deixa apagar o vídeo que falhou, e isso apaga a linha.**

Medido hoje, o mesmo dia 05/09 por dois instrumentos:

| instrumento | falhas | alunos atingidos |
|---|---|---|
| `video_clones` com `status='failed'` | **6** | **6** |
| ledger `credit_transactions.ref_type='video_clone_refund'` | **53** | **9** |

Quem confiar na tabela conclui um apagão 9x menor e perde 3 dos 9 atingidos —
inclusive **pcezardireito, o MAIS atingido do dia (11 falhas)**, que sumiu
inteiro da tabela. Isso já tinha sido descoberto em 06/09; hoje reconfirmei com
os dois números lado a lado. **Falha se conta pelo dinheiro devolvido, nunca
pela tabela.**

## 3. As premissas do roteiro, de novo (as mesmas caem)

1. **"se o apagão passou de 24h, isso é notícia"** → não passou. **8h25m27s**
   (05/09 14:46:58Z → 23:12:25Z), 53 falhas, 9 alunos, 200.350 cr devolvidos.
   Encerrado há **63h**. A notícia não existe, então não postei notícia.
2. **"o acesso da Renata vencia 06/09"** → ela **renovou** e está ativa até
   **30/09**; já gerou 2 vídeos depois da cura.
3. **"o PR da trava `feat/video-clone-manutencao`"** → **não existe**.
   `git ls-remote` enxerga **130 branches** (contraprova de que o instrumento
   não está mudo) e nenhuma é essa; **26 PRs abertos**, nenhum é esse. Não há
   decisão de merge a cobrar — e a condição do roteiro ("se o apagão
   continuar") também é falsa.
4. **"PR #190 não curou"** → confere. Quem curou foi o **#192** (pin
   `transformers==5.14.1`).

## 4. Por que NÃO escrevi aos sete

Conferi a caixa de **Enviados**, um por um:

| aluno | já recebeu |
|---|---|
| rafaluanravi29 | 3 mensagens — 05/09 15:28 "fora do ar" · 06/09 00:36 "voltou" · 06/09 01:08 **duplicata** do "voltou" |
| costa.anaelson | 3 mensagens — mesmo padrão, incluindo a duplicata de 01:08 |

**A promessa "aviso quando voltar" foi paga em 06/09 00:36–00:37Z** — e para
cinco deles foi paga *duas* vezes. Uma carta hoje seria a **3ª ou 4ª** dizendo a
mesma coisa, abrindo com "prometi te avisar quando voltasse". É a genérica que a
**regra 11** proíbe.

O argumento mais forte não é o histórico, é o uso. **8 dos 9 atingidos já
geraram com sucesso depois da cura:**

| aluno | falhas no apagão | prontos pós-cura | último |
|---|---|---|---|
| bilaherrmann | 6 | 8 | 06/09 23:14Z |
| lux.neuropsi | 3 | 4 | 07/09 02:51Z |
| smilefastrio | 6 | 4 | 06/09 19:52Z |
| clayton | 4 | 2 | **07/09 21:54Z** |
| renatarcpsi | 8 | 2 | 06/09 13:48Z |
| pcezardireito | 11 | 2 | 06/09 19:17Z |
| ederonline1 | 4 | 1 | 06/09 00:31Z |
| rafaluanravi29 | 5 | 1 | **07/09 22:02Z** |
| **costa.anaelson** | **6** | **0** | — |

⚠️ **Mudou desde ontem:** ontem `rafaluanravi29` e `clayton` estavam com **0**
prontos pós-cura e eu os listei como "não voltaram". Ambos voltaram na noite de
07/09 (21:54Z e 22:02Z). Foi por isso que remedi hoje em vez de reusar a
medição de ontem — a lista de ontem já estaria errada.

⚠️ A lista dos "sete" do roteiro continua errada quanto ao raio: **clayton** e
**bilaherrmann** foram atingidos e nunca estiveram nela. São **9**, não 7.

## 5. Renata: continua sem responder — e a promessa continua aberta

- `ler_caixa --de renatarcpsi@gmail.com` → **vazio**.
- **Contraprova obrigatória** (consulta que erra volta vazia): `--ultimos 5`
  devolve mensagens normalmente, **488 na caixa**, e `--fila` = **0**
  não-lidos. Então não há resposta dela escondida na fila da Fast. O vazio é
  **ausência real**, não instrumento cego.
- Ela **não pediu nada** — a condição do roteiro ("se ela respondeu, leve ao
  Lucas") **não se cumpriu**. Não vou dizer "a Renata pediu", porque seria falso.
- **Mas a nossa promessa é incondicional:** o e-mail de 06/09 00:37 diz que o
  caso foi levado adiante e que acompanharíamos **até ter retorno**. Escalei
  ontem, **não voltou resposta em ~24h**. Levei ao grupo de novo hoje, marcado
  como 2ª e última cobrança (regra 27: no máximo 2 trocas por assunto). É
  decisão comercial de Johnny/Lucas, não minha.

## 6. O caso que sobrou de verdade: Anaelson

`costa.anaelson@gmail.com` é o **único dos 9 que não voltou**, e não é problema
técnico — conferi a conta hoje:

- acesso **ATIVO até 29/09**, **153.759 créditos**, os 23.310 do apagão
  devolvidos corretamente (casados débito↔estorno);
- **nada trava ele**. Simplesmente não tenta desde **05/09 19:58Z**, quando
  levou a 6ª falha seguida.

São 6 tentativas frustradas e 3 e-mails nossos. Provavelmente desistiu. Uma
carta **pessoal, com o dado dele** (não a genérica) é diferente do que recusei
no §4 — mas é retenção/comercial, então perguntei no grupo antes de mandar.

## 7. O que fiz

Uma mensagem só no grupo (`avisar_grupo.cjs` via ssh do próprio Hetzner — a
WAHA só escuta em 127.0.0.1), densa, com o estado medido e as **duas decisões
que são de gente**: cortesia da Renata, e o sinal verde pra carta do Anaelson.
Enviada 08/09 ~15:10Z.

⚠️ Continua valendo o achado de ontem: a rota `ask_humans` corta `checked` e
`question` em **600 chars em silêncio** (`actions/route.ts:172+`). Esta mensagem
tem ~1.900 — teria ido pela metade sem ninguém perceber. `avisar_grupo.cjs` não
trunca.

## 8. A lição

**Uma promessa cobrada duas vezes não vira duas dívidas.** O mesmo roteiro
chegou ontem e hoje pedindo a mesma carta; a dívida foi paga em 06/09 e os
alunos provaram isso *usando o produto*. O que muda de um dia pro outro não é a
promessa, é o **dado** — e foi remedir que mostrou que dois dos "que não
voltaram" tinham voltado na madrugada. **Meça de novo mesmo quando a resposta
de ontem parecia definitiva; nunca refaça o envio só porque pediram de novo.**
