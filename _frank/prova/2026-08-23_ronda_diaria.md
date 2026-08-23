# Ronda diária 23/08 — medições cruas

Varredura pedida com três ordens explícitas: rodar `varredura_travados.cjs`
conferindo o campo `error`, rodar `prova_raio.cjs` tratando **147 (18/08)** como
"o problema mais grave aberto", e listar incidentes com idade.

A segunda ordem estava **desatualizada**. Registro aqui por que, e o que rodei
no lugar.

---

## 1. Os 147 continuam mortos — e o 118 de hoje não é notícia

`prova_raio.cjs` devolveu **118** hoje (era 147 em 18/08, 68 em 19/08).

**Não reportei isso como melhora de 29.** O número foi derrubado em 19/08
(commit `8c9c4c2`, playbook X): ele conta `entitlements.status='active'` +
saldo > 0 + `access_until` vencido, ou seja, **mede o nosso banco**, e o nosso
banco não prova assinatura. A própria oscilação 147 → 68 → 118 é o sintoma que
o playbook X manda desconfiar: métrica que balança 2× de um dia pro outro está
medindo o lote da virada das 12:00, não o problema.

Rodei `pagante_trancado.cjs`, que cruza com a Hotmart:

```
suspeitos no nosso banco (a conta antiga, a que mente): 118
🔴 PAGANTE TRANCADO — pagou de verdade e está sem acesso: 0
🟡 NA FRONTEIRA — venceu na virada das 12:00: 27
⚪ TRANCAR ESTÁ CERTO: 33 cancelaram · 52 inadimplentes · 6 trial que nunca pagou
>>> 0 pagante(s) trancado(s) · 27 na fronteira · 0 sem prova
```

**27 + 33 + 52 + 6 = 118.** Fecha exato, e **0 sem prova** — não sobrou nenhum
caso em que a Hotmart não respondeu. A decomposição fechar é o que separa
"provei" de "o script imprimiu um zero".

Teste do playbook X aplicado: *"consigo apontar UMA pessoa que pagou e está sem
acesso?"* Não consigo nomear ninguém. Logo é **número, não problema**.

---

## 2. Filas — os zeros foram conferidos, não assumidos

`varredura_travados.cjs`: **0 parados** nas 7 combinações (`voices`
uploading/validating e training, `training_jobs`, `generations`,
`image_generations`, `video_clones`, `react_jobs`).

O script imprime `⚠️ <tabela>: <mensagem>` para qualquer consulta que erre, e o
detector "pagante sem voz" tem `try/catch` que cospe o erro cru. **Nenhum `⚠️`
apareceu na saída** — li o fonte para confirmar que os caminhos de erro existem
de verdade antes de aceitar o zero (armadilha do playbook W).

Sobrou o que já se sabia: **4 pagantes com crédito e sem nenhuma voz pronta** —
`jrfengenhariadf` (29 dias), `leandro.fitoway` (24), `ivanildezuca` (15),
`marcelopersonalthe32` (13). Os dois primeiros são os de `rejected_too_short`
de julho, ainda sem contato.

---

## 3. Kessuly — o débito existe, o estorno não

Reconferi **por `ref_type`, nunca por `kind`**, sem confiar na nota do Vigia:

```
2026-08-19T18:43  -9240  ref_type=video_clone  ref=4e35fd9c   <- o vídeo
2026-08-19T18:00 +10000  ref_type=voice_train_refund          <- estorno ANTERIOR
>>> existe video_clone_refund? NAO
video_clone 4e35fd9c [ready]
```

Saldo hoje 77.930, acesso até 26/08. O vídeo está **`ready`** — foi entregue.
A pergunta dela sobre o dinheiro (uid 249, 22/08 15:48 UTC) está há ~19h sem
nenhuma resposta.

**Por que não estornei:** a queixa é de **qualidade** de um produto entregue, e
julgar qualidade exige ouvir — regra 9-D, eu não ouço. A trava **não é valor**:
9.240 cabe no teto de 20.000/caso e o dia fechou em 5.370 de 100.000. É
competência de julgamento. Pergunta binária foi pro Johnny.

**O que sustenta o lado dela:** a referência da voz `c3514f54` (`ref/auto.wav`)
tem **30.000000s cravados** no ffprobe — corte de janela fixa no meio da
palavra, defeito nosso, mesma classe da Katia. O material bruto (2396s) está ok.

---

## 4. Resto da ronda

- **Patches do Vigia** (`agent_state` `patch_%`): **0**.
- **Recados `tell_frank`** (`para_frank_%`): **0**.
- **Incidentes abertos: 2** — `7963388e` (Kessuly, 0,6 d) e `60f3e9e2`
  (feedback do João Rezende, 0,0 d). Nenhum é falha de plataforma em aberto.
- **Sweeps vivos:** `sweep-clones` e `mail-sweep` responderam **200, 0 erros**.
  `trial_expiry` responde `DESATIVADA MANUALMENTE 18/08` — é o desligamento
  deliberado pós-zeramento, não uma quebra.
- **GPU:** fila 0 nos dois endpoints. `throttled=1` no InfiniteTalk (datacenter,
  nada a fazer no código). Os contadores `failed` (108 / 150) são acumulados
  históricos, não falhas de hoje.
- **Dinheiro pendurado:** 1 `image_generation` falhada em 24h. Devoluções do dia
  **5.370 cr** (`video_clone_refund` 3.570 + `studio_scene_refund` 1.800).
  ⚠️ O `payment_event` de +500.000 no mesmo período **não é devolução**, é
  concessão de plano — somá-lo daria 505.370 e um falso estouro do teto de 100k.

---

## 5. Fora da rotina: o backlog de PR

**16 PRs abertos**, o mais velho de 18/08 (5 dias); 12 têm ≥ 3 dias. A regra 5
diz que não há humano esperando pra aprovar e que PR parado é código que não
protege ninguém — mas pelo menos 4 estão legitimamente travados no Johnny:
**#4 e #5** (migration 82), **#18** (migration 85, não aplicada) e **#17**
("NÃO MERGEAR SEM OK DO JOHNNY" no título). Migration precisa de aval (regra 21).

---

## Lição da ronda

Uma ordem de varredura pode envelhecer. O baseline "147, o problema mais grave
aberto" veio de 18/08 e foi refutado em 19/08 — **rodar só o script pedido teria
produzido um relatório inteiramente honesto sobre uma pergunta errada**, e
"melhorou de 147 pra 118" soaria como progresso real.

O playbook W diz que erro de consulta o script pega, mas pergunta errada não.
Isso vale também para a pergunta que **o próprio pedido** carrega: antes de
reportar um número como problema, verifique se aquele número ainda é problema.
