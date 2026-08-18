# Rotina das falhas — rodada das 18h BRT (21h UTC) de 18/08

Fila no início: **2 incidentes** (`investigating`). Fila no fim: **2** (os mesmos,
ambos com nota nova). Varredura de travados: **0 itens presos**. Dinheiro
pendurado nas últimas 24h: **nenhum** (5 falhas, 5 estornadas).

Nenhum aluno esperando. Não fechei incidente: as duas causas raiz continuam
de pé e a regra 14 é clara.

O que esta rodada entregou foi **matar 6 hipóteses com dado** e trocar o
diagnóstico do incidente novo de "erro genérico do RunPod" para
**fast-fail determinístico por entrada**.

---

## Incidente 2663506d — Vídeo Clone (lip-sync), fcdnanda@hotmail.com

Aberto hoje 20:18 UTC pela `burst-rule`, depois da rodada das 17h. Título diz
"2 em 6h"; são **3** falhas de fato (20:16:27, 20:17:26, 20:19:09).

### 1. A aluna está inteira (o caso mais comum, e era este de novo)

Fernanda Cristina (conta desde 10/08, acesso ativo até 20/08, 78.345 créditos):

| Fato | Evidência |
|---|---|
| 3 débitos da ferramenta | −4.620 às 20:16:28, 20:17:26, 20:19:10 |
| 3 estornos automáticos, valor **exato** | +4.620 às 20:17:06, 20:18:03, 20:19:46 |
| Ela mesma refez, sem ajuda | 20:36:50 e 20:49:46 → **2 vídeos `ready`** |
| Não ficou travada | imagem 20:49 `ready`; nada preso na varredura |

**Não escrevi pra ela.** Não reclamou (o incidente veio da `burst-rule`, não
de e-mail), não ficou sem entrega, e o crédito está em dia. Avisar de uma
falha que ela já contornou e que já foi estornada é ruído, não cuidado —
mesmo critério aplicado ao André na rodada das 17h. Se o Johnny discordar, é
um comando e eu escrevo.

### 2. O achado da rodada: é fast-fail, não OOM/timeout/capacidade

Tempo **débito → estorno** das 3 falhas: **38,0s · 36,6s · 36,2s**.
As 2 gerações que deram certo levaram **~8 min** (vídeo no R2 às 20:45:04 e
20:58:02).

> O worker morre em ~37s, de forma consistente, contra ~8 min de render
> normal. O orçamento de timeout do tier é ~41 min.

Isso derruba de uma vez OOM durante difusão, `executionTimeout` e fila. O
worker **rejeita/quebra logo na entrada**, por caminho determinístico.

### 3. Descartado nesta rodada, com dado

1. **Queda/instabilidade global** — NÃO. Na mesma janela rodaram 28 jobs.
   `diretoria@grupoperes.com.br` teve `ready` no **mesmo endpoint -e1** às
   20:17:29 (3s depois da falha dela em -e1) e `alcinalivre@gmail.com` `ready`
   em **-e2** às 20:19:31 (22s depois da falha dela em -e2).
2. **Endpoint/worker ruim** — NÃO. As 3 falhas se dividem entre -e2, -e1, -e2.
   Os dois endpoints atenderam outros alunos nos mesmos segundos.
3. **Teto de `num_frames`/duração** — NÃO. Levantei a hipótese porque as
   falhas eram 1100 frames e os sucessos 1075. Derrubada com dado: o tier
   `480p-v3` tem **478 jobs em 45 dias com só 4 falhas**, e há sucessos em
   **2275, 2250, 2250** frames. Na mesma janela rodaram `ready` de 2200 e 2221.
   1100 não é teto de nada.
4. **Áudio corrompido/truncado** — NÃO. Baixei o mp3 que falhou (`45641b83`) e
   um que funcionou (`43f65359`): `ffprobe` limpo nos dois, mp3 48000Hz mono
   128kbps. Bytes/segundo idêntico (16018 vs 16021) — o que falhou **não está
   truncado**. Única diferença: 43,944s vs 42,840s.
5. **Imagem de entrada** — NÃO. As 3 falhas usaram `images/6e0db1c2…/result.png`
   e o sucesso das 20:36 usou **exatamente a mesma imagem**.
6. **Botão mudo corrigido hoje (b9c4c9c)** — NÃO tem relação (era UI, não
   chegava ao backend), como já anotado pelo executor.

### 4. O que sobrou

O job é determinístico **por entrada**: as 3 tentativas usaram o **mesmo**
áudio e falharam; os 2 áudios diferentes passaram. O erro cru do RunPod é
literalmente `Job processing failed`, sem OOM nem timeout na string — por isso
o `friendlyCloneError` cai no texto genérico.

Nota técnica: em `480p-v3`, `num_frames = floor(dur)*25 + 25` e o template usa
`trim_to_audio: false` — 43,944s vira 1100 frames (44,00s de vídeo para
43,944s de áudio). **Não consegui provar que é isso.**

---

## Incidente d3d8d1b2 — Geração de áudio: tempo de execução estourado

Conferido: `last_seen_at` continua 18/08 18:05:41 e `occurrences` continua 12
— **nenhuma reincidência em 3,1h**. O aluno daquela ocorrência
(`namaiimoveis@gmail.com`) segue inteiro e gerou vídeo clone `ready` às 18:47
e 20:01 de hoje. Mantido `investigating`.

---

## O bloqueio é o mesmo nos DOIS incidentes

Os dois estão parados pelo mesmo motivo estrutural: **o motivo real da falha
só existe no log do worker no RunPod, que expira ~30 min depois do job
terminar.** Nos dois casos o agente chegou depois da janela (as falhas da
Fernanda são de 20:16-20:19; a rodada começou ~45 min depois). Já foi provado
com HTTP 404 na rodada das 17h.

> Não é problema de execução, é de **captura**. Enquanto o próximo passo de
> qualquer um dos dois for "puxar o log depois", os dois ficam parados pra
> sempre, independente de quem assumir a rodada.

**Proposta levada ao Johnny como binária** (precisa de aval por gastar GPU):
rodar **uma** reprodução por conta da casa, com exatamente aquele áudio+imagem
em `480p-v3`, sem cobrar a aluna, e puxar o log do RunPod **dentro** da janela
de 30 min. É o único caminho que captura a causa real e confirma de vez se é
determinístico por entrada. Não executei sozinho: gasta GPU.

---

## Estado geral no fim da rodada

- Travados: **0**. Incidentes abertos: **2** (ambos com nota desta rodada).
- Falhas em 24h: **5** (3 vídeo clone, 1 áudio, 1 imagem) — **todas estornadas**,
  0 sem estorno.
- Sweeps **vivos** (rodando de 5 em 5 min, `errors: 0` no bloco `sweep`).
- ⚠️ `trial_expiry` devolve erro em **toda** rodada do sweep desde 18/08:
  `"DESATIVADA MANUALMENTE 18/08: deteccao de pagante errada, zerou 14
  pagantes. Nao reativar sem novo teste."` — isso é a trava proposital do
  incidente de zeramento, **não** é falha nova. Fica registrado porque ela
  polui o log de toda rodada e o próximo agente vai tropeçar nela.

## Armadilha reencontrada (a nº 1 do 03_ROTINA)

Duas consultas minhas voltaram vazias por coluna inexistente
(`generations.tier`, `image_generations.runpod_job_id`) e uma terceira por
`profiles.credits`. Em todas eu chequei o `error` antes de acreditar no zero,
como o manual manda. **Continua valendo: consulta que erra volta vazia.**
Também paginei o `video_clones` (1.407 linhas em 45 dias) porque o Supabase
corta em 1.000 — a primeira análise, sem paginar, teria me deixado concluir
sobre uma amostra truncada.
