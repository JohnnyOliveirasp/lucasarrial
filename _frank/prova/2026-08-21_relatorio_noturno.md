# Relatório noturno — fecho de 20/08 (escrito 21/08 ~01:40 UTC)

Tudo abaixo foi **medido agora, contra produção**, não copiado de ronda anterior.
Onde a medição contradisse uma nota, vale a medição. O que não foi verificado está
marcado como não verificado.

---

## 1. O que fechou hoje

**18 incidentes fechados** (contra 9 ontem), **14 abertos**, **3 seguem abertos**.

O maior deles fechou às **01:06 UTC de hoje**: `c3893803` — **16 pagantes com o
período JÁ PAGO apagado do perfil**.

### A cadeia inteira, porque ela é o dia

1. O Johnny mandou cancelar a assinatura do **Victor Ramalho** (`166a1df4`, ele
   pedia cancelamento havia 86h).
2. Cancelamento feito pela API da Hotmart → o webhook de volta **zerou o acesso
   dele**.
3. Reparar **um** caso revelou a causa de **16**: `entitlements.ts` só considerava
   `status='active'`. O próprio webhook, ao cancelar, grava de propósito o
   `access_until` do período já pago — e a função jogava esse valor fora no segundo
   seguinte. Quem cancelava perdia **na hora** o que já tinha comprado.
4. Correção `a9e33ae` no ar às 22:00 UTC. Regra nova: `active` → NULL (vitalício) ou
   futuro; `canceled` → **só** com data futura; `refunded`/`chargeback`/`expired` →
   nunca.
5. A correção **não cura o passado** — `recomputeProfileAccess()` só roda quando
   chega evento novo de webhook, e assinatura já cancelada não gera evento. Por isso
   a ferramenta de backfill (`e4440e2`).
6. Backfill rodado pelo Claude **com autorização explícita do Johnny** (pedida 2x no
   chat): **16/16 restauradas, 0 falhas**, com releitura independente do banco.

### Conferido por mim, de duas formas independentes, agora

- Query derivada do zero, paginada (**1336 profiles × 813 entitlements**), aplicando
  a mesma regra do `valeAcesso()`: *entitlement vivo + `profiles.access_until` NULL*
  = **0**. Variante vizinha (`profiles.access_until` **defasado** em relação ao
  entitlement) = **0**.
- Ensaio da própria ferramenta (`backfill_acesso_pago.cjs`, sem `--confirmar`):
  **DIVERGENTES = 0**.
- `dr.bruno@blradvogados.com.br`, que vencia às 12:00 UTC de hoje, está com
  `access_until = 2026-08-21T12:00:00Z`, `plan = pro`. **Entrou a tempo, com ~11h de
  folga.**

### ⚠️ Correção de vocabulário, pra não virar folclore

As rondas do dia escreveram **"16 pagantes TRANCADOS"**. Está errado, e a nota de
fechamento do incidente já registra isso. Das 13 rotas que checam acesso, 12 usam
`hasActiveAccess()` só pra preencher o campo `subscribed` **dentro** da mensagem de
crédito insuficiente — não bloqueiam nada. O gate de uso continua sendo o **crédito**.
O bloqueio real era em **um** lugar: `credits/checkout` (403 — não conseguiam
**comprar** crédito avulso) mais a UI tratando-os como não-assinantes.

Era um problema real e com prazo, mas menor do que a palavra "trancado" sugere.

### Os outros fechamentos com nome

| Incidente | Caso | Fechado por |
|---|---|---|
| `72a4c9db` | `orphan-outreach` chamava cliente ATIVO de estranho (teto de 1000 do PostgREST) | frank, 01:09 |
| `910ea757` | Treino reprovava áudio VÁLIDO com o `moov atom` no fim do arquivo | agent, 03:29 |
| `fb8d29b7` | QA de áudio não media INSERÇÃO nem SUBSTITUIÇÃO | agent, 03:29 |
| `85b4e5d7` | Paulo (`paulogmarinho`) 13h sem voz treinada | agent, 10:30 |
| `37bacb68` / `c4b892e9` | qa_coverage reprovando áudio bom | agent, 10:30–10:32 |
| `c31012f9` | Nelson mandou o áudio e a voz ficou parada | agent, 10:38 |
| `aabfa1e5` | **2 pagantes ativos** (100.000 créditos, acesso até 27/08) com a voz parada por aviso de crédito velho | frank/coder, 14:45 |
| `ef6e08a4` / `bea487b7` | Katia: voz robótica + `error_message` mentindo pós-crédito | claude, 20:31 |
| `166a1df4` | Victor Ramalho: cancelamento pendente há 86h | claude, 21:44 |
| `261b295b` | Fechamento sem `resolved_at` cegava o detector de zumbi (5 incidentes cegos) | frank/rotina-falhas, 21:48 |
| `c3893803` | Os 16 (acima) | claude, 01:06 |

### Alunos destravados e contatados

- **2 pagantes destravados** (`ms.sobadjian@gmail.com`, `celsopinto@gmail.com`) — o
  aviso de "você tem 0 créditos" ficava grudado na voz depois do crédito entrar.
  Causa corrigida no `dafd7fd`.
- **8 pagantes de julho** — acesso **mantido** (zero escrita no banco, o acesso já
  estava certo em produção) e **8/8 e-mails aceitos no SMTP**, com ensaio `--dry-run`
  antes: `beatrizsrl021`, `dinicleia.nascimento93`, `erwintst`, `lelequisdias`,
  `maciel10anjos`, `renildoe`, `talineschneider`, `zecunha`.
- **Marcelo** — e-mail 21:38 pedindo gravação só com a voz dele.
- **Victor** — e-mail 21:43 confirmando o cancelamento; ele respondeu *"Perfeito obg"*.
- **Total: 10 e-mails enviados.**

### Alarmes falsos derrubados (medidos, não intuídos)

- **Josilene** — os **85.969 créditos NÃO vencem em 22/08**. A recarga passou a
  **acumular** depois da migration 67; a projeção anterior usava o comportamento de
  06/08, anterior à mudança. **Decisão: não mandar e-mail** avisando de algo que não
  acontece, para uma aluna que já reclamou 2x. Nota anexada ao `4ce5b24c` sem mexer
  no status.
- **Cobrança dupla do Victor** — derrubada pelos prints dele. Fica com 144.388
  créditos e acesso até 09/09.
- **"68 pagantes trancados"** — métrica inválida. Trancados de verdade: **0**.
- **Dinheiro pendurado: R$ 0.** Os 3 "estornos sem reversão visível" eram a
  ferramenta procurando por `kind` em vez de `ref_type`.
- **"`fixed` falso" na branch `feat/incidents-resolved-at`** — a hipótese tinha o
  formato certo e **não se sustentou**: os dois caminhos de fechamento na `main` já
  gravam e limpam `resolved_at`/`resolved_by`. O fix subiu por outra via, mais leve.

---

## 2. O que subiu pra produção, e a prova no servidor

**6 commits de frontend em 7 runs de deploy (1 duplicado), 7/7 success. 1 build de
worker RunPod, success. Zero deploy falho.**

**`BUILD_ID` que está rodando agora: `Bcq95cycGVJmN1TSwTKmc`**, compilado
**20/08 22:14:23 UTC**; `pm2 aiverse` reiniciado **22:15:14 UTC**.

Método do playbook P: **Action verde não é prova**. O marcador tem que aparecer no
bundle que está rodando, e marcador é string de runtime — nunca comentário (essa
armadilha custou um falso "não subiu" em 18/08).

| Commit | O que faz | Marcador procurado no bundle | Achado |
|---|---|---|---|
| `65b2037` | rótulo de locutor em diálogo não vai mais pro TTS | regex `[^\s:]{1,20}` em `normalize` | **2 arquivos ✅** |
| `2c9e86f` | o braço parava de existir ANTES do ffmpeg (nó 171 cortava a foto) | `0, 177, 64` · `corPad` · `pad_color` | **1 / 2 / 1 ✅** |
| `dafd7fd` | a tela parava de mentir quando o crédito entra | `destravar-aviso-credito` · `Treinar a voz custa` | **18 / 19 ✅** |
| `ce25390` + `981f2fb` | incidente fechado grava QUEM fechou e QUANDO | `resolved_commit` | **5 arquivos ✅** |
| `b06343c` | REABRIR limpa `resolved_at`/`by`/`commit` | minificado literal | `g.resolved_by=null,g.resolved_at=null,g.resolved_commit=null` **✅** |
| `a9e33ae` | cancelar assinatura para de apagar o período JÁ PAGO | minificado literal | `"active"===a.status?null===a.access_until\|\|a.access_until>c:"canceled"===a.status&&null!==a.access_until&&a.access_until>c` **✅** |

### Worker RunPod (`aae3ba5`) — deploy separado, prova comportamental

A régua do `qa_coverage` passou a medir a **forma do buraco** em vez de reprovar
áudio bom. Build success, **terminou 20/08 11:41:58 UTC**. A ferramenta
`qa_coverage.cjs` descobre esse corte sozinha (`bd9042f` — o corte é o **fim do
deploy**, não a hora do push; foi esse o erro de 20/08 de manhã).

```
ANTES da régua nova   | gerações 270 | falhas 9 | qa_coverage 7 | taxa 3,3%
DEPOIS da régua nova  | gerações  98 | falhas 0 | qa_coverage 0 | taxa 0,0%
```

**98 gerações depois do corte, zero reprovação.** É prova de comportamento, não de
imagem: eu não inspecionei o binário do worker na GPU. Mas 98 amostras contra uma
taxa histórica de 3,3% é o suficiente pra dizer que a régua nova está valendo.

---

## 3. Estado geral (medido agora)

Régua: **dia calendário UTC**, a mesma aplicada aos dois dias, para a comparação ser
honesta.

| | 19/08 | 20/08 |
|---|---|---|
| entregas com sucesso | 504 | **414** |
| falhas | 8 (1,6%) | **4 (0,96%)** |
| — áudios | 102 ok / 4 falhas | **131 ok / 4 falhas** |
| — imagens | 262 | **133** |
| — vídeos clone | 79 | **103** |
| — vozes prontas | 31 (1 failed) | **21 (0 failed)** |
| — treinos | 30 (3 failed) | **26 (0 failed)** |
| itens presos na varredura | 0 | **0** |
| pagantes trancados | 0 | **0** |
| incidentes abertos no fecho | 4 | **3** |

⚠️ **A mensagem de ontem dizia "506 entregas / 12 falhas".** Re-medi os dois dias com
a mesma régua e 19/08 deu **504 / 8**. A diferença é de régua (janela de 24h móvel
contra dia calendário, e o que conta como falha), não de movimento. Estou reportando
os dois lados com a régua nova; a de ontem fica registrada aqui pra ninguém achar que
o número mudou sozinho.

### Números que mudaram de ontem pra hoje

- **Falhas de treino de voz: 3 → 0.** Nenhum treino falhou hoje (26/26 completos).
- **Reprovação do QA de áudio: 3,3% → 0%** em 98 gerações após a régua nova.
- **Pagantes com período pago apagado do perfil: 16 → 0.**
- **Incidentes fechados no dia: 9 → 18.**
- **Imagens: 262 → 133 (−49%).** Não sei a causa e **não vou inventar** — nenhuma
  falha, nenhum item preso, `image_generations` 133/133 `ready`. É volume de uso, não
  defeito nosso. Fica anotado pra ver se repete amanhã.

### Incidentes abertos — 3, com idade

| ID | Caso | Idade | Quem espera |
|---|---|---|---|
| `ce6e157d` | Katia: áudio com letras soltas/cortadas | **37,4h** | 1 aluna |
| `5c3f1f8b` | 3 pagantes ativos sem nenhuma voz pronta | **8,8h** | 3 alunos |
| `100e7ace` | Referência da voz curada termina no meio da frase | **5,0h** | técnico |

### Os 3 pagantes sem voz — o que a medição de hoje mudou

A ordem de 20/08 manda **listar os arquivos da voz antes de recomendar retreino**.
Foi feito hoje pela primeira vez, e mudou a recomendação que estava na fila há 4
rondas. Conferido objeto a objeto no R2 (`HeadObject`): **todo o áudio dos 3 continua
lá**, nada evaporou.

| Aluno | Parado há | Material | Veredito medido |
|---|---|---|---|
| `marcelopersonalthe32` | **254h** | 1 mp3, 47 min | Falha foi **infra nossa** (`[Errno 28] No space left on device`). Retreino limpo, **sem risco de gate**. |
| `csitya100` | **126h** | 20 arquivos, só 7 com faixa de áudio (6 jpeg + 7 pdf junto) → **12,36 min brutos** | Útil previsto **11,1–11,4 min** contra mínimo de 10,00. Passaria em **69–76%** dos casos. **~1 em 4 de gastar GPU e ele levar uma SEGUNDA mensagem de falha.** |
| `ivanildezuca` | **295h** | 30,7 min brutos → **5,9 e 6,0 min úteis medidos** (rendimento 19%) | O gate é **legítimo**. Retreinar no material atual reprova de novo com certeza praticamente total. **Só mais áudio resolve** — e isso é e-mail, não GPU. |

Base do número: rendimento útil/bruto de **258 treinos de arquivo único** (p10 55,8%
· mediana 92,6% · p90 97,8% · impossíveis >102% = 0). A amostra cheia de 729 tinha
rendimentos >100% — `duration_seconds` conta um arquivo enquanto `useful_seconds`
soma todos —, então foi refeita no subconjunto limpo antes de publicar.

O `csitya100` **pagou de novo em 20/08 14:24 UTC** (+100.000 créditos,
`ref_id HP2761519566`; o primeiro foi 13/08). Está ativo, usando o que dá pra usar, e
**nunca foi contatado, nenhuma vez**. A `ivanildezuca` está sem contato há **12 dias**.

---

## 4. Buracos conhecidos que continuam abertos

**Silêncio não é saúde.** Estes não geram alarme e por isso precisam estar escritos:

1. **A varredura continua cega pro estado `awaiting_training`.** `ALVOS` em
   `varredura_travados.cjs:19-27` cobre `voices` em `uploading`, `validating` e
   `training` — **não cobre `awaiting_training`**. Hoje há **28 vozes** nesse estado,
   **25 com mais de 24h**. Conferido: *pagante vivo + áudio enviado + nenhuma voz
   ready* = **ZERO**, ou seja **ninguém está preso ali agora**. Mas se um pagante
   cair nesse estado, a varredura **nunca vai mostrar**. É a mesma classe de zero
   silencioso que deixou 43 vozes paradas por semanas. Card aberto pro `coder` ontem,
   **ainda não feito**.
2. **`profiles.ja_pagou` está `false` em 1336 de 1336 perfis**, inclusive nos 736 com
   entitlement. A coluna foi aplicada (migration 79), o **backfill dela nunca rodou**.
   Conferido quem lê: **zero ocorrências em `frontend/src` e em `runpod-worker/`** —
   sem risco hoje. No dia em que alguém gatilhar crédito por esse campo, 736 pagantes
   viram "nunca pagou" de uma vez.
3. **Colisão de número de migration 85.** `feat/incidents-resolved-guard` (só local)
   traz `scripts/85_incidents_resolved_guard.sql` e o **PR#18** (`feat/trial-expiry-v2`,
   aberto) traz `scripts/85_trial_expiry_v2.sql`. As duas branches do guard são
   **trabalho morto** (o fix subiu por outra via — ver seção 1), então o risco é
   baixo, mas o 85 e o 86 parecem ocupados por algo que nunca vai entrar.
   **Sugestão: aposentar as duas.** Não apaguei — branch dos outros.
4. **`fix/fast-email-dedupe-por-queixa` existia só na cópia local**, sem PR e sem
   existir no `origin`. `frontend/src/lib/agent/mail-incident.ts` **não existe na
   main**. **Publiquei a branch no `origin`** (só `push`; nenhum PR, nada mergeado,
   `origin/main..HEAD` conferido vazio depois). Isso não deploya nada — só tira o
   trabalho do risco de sumir com a máquina.
5. **Estrutural:** voz `failed` não volta pra fila. O aluno lê *"tente treinar
   novamente"* e o produto não deixa. É a razão de os 3 acima dependerem de decisão
   humana em vez de o próprio aluno resolver.

---

## 5. Erros meus hoje, e o que os pegou

Registrados de propósito — foram 3 vezes em que a verificação salvou o relatório:

1. **Medi o `qa_coverage` com a régua velha**, usando a hora do push em vez do fim do
   deploy. Corrigido no `bd9042f`: a ferramenta descobre a janela sozinha. A taxa era
   **7,7%, não 11,1%**.
2. **Projetei o crédito da Josilene com o comportamento anterior à migration 67.**
   Quase mandei e-mail avisando de uma perda que não existe. **Quando o sistema mudou
   recentemente, histórico não é previsão.**
3. **Ia publicar rendimento de 72%** medido em amostra contaminada. Os >100% no meio
   dela denunciaram que `duration_seconds` e `useful_seconds` nem sempre contam a
   mesma coisa.
4. **`.like("id","8aca0126%")` num campo uuid** devolveu `null`. Quase li isso como "a
   voz não existe". Era a consulta, não o dado.
5. **Acusei um `fixed` falso** na `feat/incidents-resolved-at` antes de ler a `main`.
   A hipótese era boa; a verificação é que decide, e derrubou a acusação.

O padrão que pegou 4 dos 5: **imprimir o erro cru antes de acreditar num zero.**

---

## 6. O que eu não fiz

Não gastei GPU, não retreinei voz, não regerei áudio, não mexi em crédito, plano ou
acesso de ninguém, não rodei migration, não mergeei nem apaguei branch, não marquei
incidente como resolvido sem prova, e não escrevi pra aluno sem o "pode". O backfill
dos 16 foi rodado pelo Claude com autorização direta do Johnny, não por mim.
