# Rotina das falhas — rodada das 17h BRT (20h UTC) de 18/08

Fila no início: **1 incidente** (`investigating`). Fila no fim: **1**
(o mesmo, com nota nova). Varredura de travados: **0 itens presos**.
Dinheiro pendurado nas últimas 24h: **nenhum**.

Não fechei o incidente — a causa raiz continua de pé e a regra 14 é clara.
O que esta rodada entregou foi **eliminar um bloqueio de 11 dias**.

---

## Incidente d3d8d1b2 — "Geração de áudio: tempo de execução estourado"

Aberto 30/07, 12 ocorrências, 11 alunos. Estava `fixed` desde 10/08 e
**reabriu sozinho** às 19:24 UTC de hoje por uma ocorrência nova às 18:05:41.

### 1. O aluno está inteiro (o caso mais comum, e era este)

`namaiimoveis@gmail.com` (André Gabriel), 12ª ocorrência:

| Fato | Evidência |
|---|---|
| Débito da geração que falhou | −1.620 às 18:05 |
| Estorno automático, valor **exato** | +1.620 às 18:43 (`generation_refund`) |
| Ele mesmo refez, sem ajuda | 18:42, 888 chars → `ready` |
| Não ficou travado | imagem 19:17 `ready`, clone 18:47 `ready`, outro gerando 20:01 |
| Conta saudável | acesso ativo até 25/08, 72.957 créditos |

**Não escrevi pra ele.** Não ficou travado, não reclamou (o incidente veio do
ingest automático, `reported_by: null`) e já tinha refeito sozinho antes de
qualquer aviso possível. Mandar e-mail avisando de uma falha que ele já
contornou e que já foi estornada é ruído, não cuidado. Se o Johnny discordar,
é um comando e eu escrevo.

### 2. O achado da rodada: o próximo passo do incidente era impossível

Desde **07/08** as notas repetem o mesmo pedido de ação humana: *"puxar os
logs RunPod dos jobs 32d91ea9, 0d14c98c e o da falha de 08/08 02:11"*. Quatro
rodadas de agentes diferentes reforçaram esse pedido e o incidente não andou.

Testei em vez de repetir o pedido:

```
job 1ccc1ecf-16b2-4594-aa44-312eada257aa-e1
  endpoint 2jcta960kzc2m4 -> HTTP 404 {"detail":"job not found"}
  endpoint 0qd28qwo9ptcp4 -> HTTP 404 {"detail":"job not found"}
```

~2h depois da falha, **já não existe**. O status de job do RunPod expira em
~30 min depois de terminar (já estava escrito no `02_ACESSOS.md`). Logo os
logs de 07/08 e 08/08 evaporaram poucos minutos depois de cada falha, em 2026.

> **Ninguém falhou em executar essa tarefa. A tarefa é inexecutável.**
> Enquanto o próximo passo for "um humano puxa o log depois", este incidente
> fica parado pra sempre.

### 3. Descartado nesta rodada, com dado

- **Capacidade / fila de GPU** — os dois endpoints ociosos na checagem
  (e1: 0 `inQueue`, 0 `inProgress`, 4 idle / 4 ready, 3 throttled;
  e2: 0/0, 3 idle / 3 ready, 1 throttled). Não é fila.
- **Regressão do timeout dinâmico** — a fórmula está no ar
  (`voices/[id]/generate/route.ts:68-71`, `max(30min, 15min + chunks×2min)`).
  O texto tinha **1.620 chars = 11 chunks = teto de 37 minutos**, e o job
  estourou os 37. Um roteiro desse tamanho leva poucos minutos. Isso
  **confirma** a triagem do James de 07/08: é worker **travado (hang)**.
- **Disco cheio do worker (Errno 28)** — levantei essa hipótese porque as
  outras 2 falhas recentes de geração são disso, e **fechei**: foi corrigida
  em 10/08 (`37f27a5` — `TORCHINDUCTOR_CACHE_DIR`/`TMPDIR` próprios, faxina no
  `finally` de todo job, purge acima de 75%). Zero reincidência em 8 dias e
  assinatura diferente. Fica descartada pra não voltar a dar volta.

### 4. O que destrava — e por que não fiz sozinho

O diagnóstico tem que ser capturado **na hora da falha**. Quando o job falha,
o poll **já tem a resposta do RunPod na mão** (`generations/[id]/route.ts:83`)
e joga fora tudo menos o texto do erro — inclusive `executionTime` e
`delayTime`, que **já existem tipados** em `RunpodStatusResponse`
(`runpod/client.ts:85-91`). Guardar isso responde "travou depois de quanto
tempo" sem depender de ninguém puxar log nenhum.

⚠️ **A armadilha que encontrei antes de mexer:** não dá pra simplesmente
concatenar no `error_message`. A assinatura do incidente é montada a partir do
texto do erro (`incidents/classify.ts:87-109`): números viram `#`, mas
identificador alfanumérico (ex.: `workerId`) **não normaliza**, e cada worker
passaria a abrir um incidente novo. **Isso já aconteceu:** o Errno 28 tinha o
path do cache mudando a cada job e a **mesma** falha abriu **4 incidentes de
"1x" cada** — que é exatamente o disfarce que faz uma falha recorrente parecer
quatro acidentes isolados.

Fazer certo é coluna nova (**migration → aval do Johnny, regra 21**) ou passar
o diagnóstico por fora da string que gera a assinatura. **Não improvisei no
caminho do estorno.** Virou binária pro Johnny.

---

## Estado geral no fim da rodada

- Travados: **0**. Incidentes abertos: **1** (este, com nota).
- Falhas em 24h: 2 (1 áudio, 1 imagem) — **as duas estornadas certinho**.
- GPU ociosa nos dois endpoints; `throttled` 3 e 1 é o datacenter sem GPU
  livre, nada a fazer no código.
