# 11/09 — Video Clone: medido pela 3ª vez. Não escrevi aos alunos.

Mesmo roteiro chegou em **07/09, 08/09 e hoje**. Remedi do zero (não copiei a
medição de 08/09 — o estado podia ter mudado; mudou em 1 ponto, no fim).

**Resultado: cura confirmada e antiga. Não escrevi aos sete. Não postei notícia
de apagão. Levei as 2 decisões de gente direto ao Johnny.**

## 1. A cura, medida hoje (11/09 15:00Z)

Instrumento: `_Bugs/2026-09-11_provar_clones_r2.cjs` — `HeadObject` no R2
(`voices-clone-ai-verse`). **Não** `video_path is not null`: esse campo é
gravado na criação e existe também nas linhas `failed` — concluir por ele daria
100% de sucesso inclusive durante o apagão.

| conjunto | linhas | MP4 REAL no R2 |
|---|---|---|
| `ready` nas últimas 24h | 62 | **62** (3,09–18,61 MB) |
| últimos `ready` dos 7 do roteiro | 13 + 3 | **16** |
| **contraprova**: `failed` do apagão | 8 | **0** |

A contraprova é o que autoriza concluir: o instrumento **distingue** os
conjuntos. Sem ela, "62/62 OK" poderia ser um instrumento cego dizendo sim.

- **Prova ao vivo:** a linha `33569fb5` estava `generating` às 14:47Z e fechou
  `ready` durante esta medição. O pipeline não está só "sem falhar" — está
  **produzindo agora**.
- Última entrega materializada: **11/09 14:47Z**, 13 min antes da medição.

## 2. Falha se conta pelo DINHEIRO, nunca pela tabela

Confirmado de novo (achado de 06/09, reconfirmado em 08/09): a tela do aluno
deixa apagar o vídeo que falhou, e isso **apaga a linha**. Medindo o mesmo
apagão por dois instrumentos:

| instrumento | falhas | alunos |
|---|---|---|
| `video_clones.status='failed'` | 24 | 6 |
| ledger `credit_transactions.ref_type='video_clone_refund'` | **53** | **9** |

Quem confia na tabela perde 3 dos 9 atingidos — inclusive **pcezardireito, o
mais atingido do dia**. O PASSO 1 do roteiro ("consulte video_clones") mede bem
o SUCESSO, mas é **cego pro lado da falha**.

- **Último estorno de Vídeo Clone da história: 05/09 23:12:25Z.**
  → **141h48m (5,9 dias) sem um único estorno.**

## 3. As premissas do roteiro — as mesmas 4 caem

1. **"se o apagão passou de 24h é notícia"** → **não passou**: **8h25m27s**
   (05/09 14:46:58Z → 23:12:25Z), 53 falhas, 9 alunos, 200.350 cr devolvidos.
   Encerrado há **142h**. Não existe notícia, então não postei notícia.
2. **"o acesso da Renata vencia 06/09 e ela perdeu dias"** → ela **renovou**:
   ativo até **30/09**, 137.660 cr, recarga de ciclo em 06/09 14:13. E gerou
   **2 vídeos com sucesso** depois da cura (9,26 MB e 14,95 MB, conferidos).
3. **"o PR da trava `feat/video-clone-manutencao`"** → **não existe**. Não está
   nos PRs (nenhum estado) nem em `git ls-remote --heads`. Não há decisão de
   merge a cobrar — e a condição ("se o apagão continuar") é falsa de todo jeito.
4. **"PR #190 (d1ce203d) subiu verde 17:47Z e não curou"** → confere, e o
   roteiro erra o horário: #190 mergeou **05/09 17:25:52Z**. Quem curou foi o
   **#192** (pin `transformers==5.14.1`), mergeado **22:45:35Z** — primeiro
   sucesso **23:41:33Z**.

## 4. Por que NÃO escrevi aos sete

Conferi **Enviados**, um por um. Os sete já receberam o "voltou" em
**06/09 00:36–01:27Z** — e cinco receberam **duas vezes** (duplicata de 01:08).
Uma carta hoje seria a **3ª ou 4ª**, abrindo com "prometi te avisar quando
voltasse", sobre um apagão encerrado há 6 dias.

O argumento mais forte não é o histórico, é o **uso**: 8 dos 9 atingidos já
geraram com sucesso depois da cura, com arquivo conferido no R2. Eles não
precisam ser avisados de que voltou — **eles já usaram**.

A promessa foi paga em 06/09. **Promessa cobrada 3 vezes não vira 3 dívidas.**

## 5. Renata: não respondeu (e o vazio é real, não instrumento cego)

- `ler_caixa --de renatarcpsi@gmail.com` → **vazio**.
- **Contraprova:** `--caixas` mostra **573 lidas no INBOX** e `--fila` = **0
  não-lidos**. A busca varre tudo e não há resposta escondida na fila da Fast.
  O vazio é **ausência real**.
- A condição do roteiro ("se ela respondeu, leve ao Lucas") **não se cumpriu**.
  Não vou dizer "a Renata pediu" — seria falso.
- **Mas o e-mail de 06/09 00:37 já afirmou a ela que o caso foi levado adiante
  e que acompanharíamos até ter retorno.** Isso é dívida nossa, independente de
  ela responder. Foi levado ao grupo em **07/09 e 08/09** — **duas vezes, sem
  resposta**. Um 3º post seria o mesmo erro do §4. Levei ao Johnny direto.

## 6. O caso que sobrou: Anaelson

`costa.anaelson@gmail.com` — **o único dos 9 que não voltou**, e não é técnico:

- acesso **ATIVO até 29/09**, **153.759 créditos**, os 23.310 do apagão
  devolvidos corretamente (débito↔estorno casados, conferidos);
- **nada trava ele.** Não tenta desde **05/09 19:58Z**, quando levou a **6ª
  falha seguida em 5 minutos**. São 6 dias de silêncio.

Provavelmente desistiu. Carta **pessoal com o dado dele** ≠ a genérica que
recusei no §4 — mas é retenção/comercial, então não mando sem sinal verde.
Pedido no grupo em 08/09, sem resposta. Repassado ao Johnny.

## 7. O que mudou desde 08/09

Só uma coisa, e é a que importa: **mais 3 dias de estabilidade** (63h → 142h
sem estorno) e **Anaelson continua sem voltar**. Nenhum dos 9 regrediu.

## 8. A lição

**Remedir é barato; reenviar é irreversível.** O roteiro chegou pela 3ª vez com
premissas de 05/09 congeladas — apagão em curso, acesso da Renata vencendo, PR
de trava aberto. Nenhuma delas era verdade hoje. Se eu tivesse obedecido o
PASSO 3 sem medir, sete alunos pagantes receberiam a 4ª carta anunciando o fim
de um apagão que eles mesmos já esqueceram. **O roteiro descreve o passado; o
banco descreve o agora. Meça sempre o agora.**
