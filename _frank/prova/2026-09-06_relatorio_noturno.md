# Fecho do dia — relatório noturno de 05/09 (escrito 06/09 ~01:00–01:20Z)

Esta ronda **não abriu frente nova**. Ela fez três coisas: conferiu se o apagão
do Vídeo Clone acabou de verdade, **executou a ação nº 1 que o vigia das 00hZ
deixou pendente** (avisar os alunos queimados de que o produto voltou) e mediu o
tamanho real do incidente, que estava subnotificado pela metade.

---

## 1. O apagão do Vídeo Clone acabou — conferido, não herdado

**Janela:** último sucesso antes da queda **05/09 11h26:50Z**; última falha
**05/09 23h12:19Z**; primeiro sucesso depois **05/09 23h41:33Z**. ≈ **12h15 de
apagão**.

**Prova de que voltou** (não é "o build ficou verde" — é geração de aluno):

| quando (UTC) | aluno | tier | status |
|---|---|---|---|
| 05/09 23:12:19 | bilaherrmann | 480p-v2 | failed ← última falha |
| 05/09 23:41:33 | bilaherrmann | 480p-v2 | **ready** |
| 06/09 00:00:09 | bilaherrmann | 480p-v2 | **ready** |
| 06/09 00:10:54 | luciocaversan | 480p-v3 | **ready** |
| 06/09 00:31:26 | ederonline1 | 480p-v3 | **ready** |
| 06/09 00:41:13 | renatarcpsi | 480p-v3 | **ready** |

**5 sucessos seguidos, 4 alunos diferentes, os dois tiers.** Três deles
(bilaherrmann, ederonline1, renatarcpsi) são vítimas do próprio apagão que
voltaram sozinhas e já levaram o vídeo.

**Correção:** PR **#192** (pin `transformers==5.14.1`), mergeado 22h45:35Z. O PR
#190 (17h25Z) **não** resolveu — houve falha depois dele. Build de produção do
app gerado **22h49:50Z** (BUILD_ID `G2GYtI59cMOo81LYncEyq`), depois do último
merge do dia (#191, 22h48:03Z); pm2 `aiverse` online desde ~23hZ.

⚠️ Ressalva honesta: o #192 é do **worker de vídeo** (imagem RunPod), não do
build do Next. A prova de que ele está no ar é a tabela acima, não o BUILD_ID.

## 2. O incidente era o DOBRO do que a tabela mostra

Contando só `video_clones`: **27 falhas** nas 24h, **101.575 créditos**
debitados, **27 estornos** casados por `ref_id` — **0 falha sem estorno, 0
estorno em dobro**. Dinheiro em dia.

Só que existem, na mesma janela, **26 estornos `video_clone_refund` (98.775
créditos) cujo `ref_id` não tem mais linha em `video_clones`** — todos entre
14h e 21hZ, dentro do apagão:

| hora (UTC) | estornos órfãos | alunos |
|---|---|---|
| 14h | 7 | 1 |
| 15h | 2 | 1 |
| 16h | 3 | 1 |
| 19h | 8 | 3 |
| 20h | 4 | 3 |
| 21h | 2 | 1 |

O aluno apaga a tentativa que falhou e **a falha some da tabela; o estorno
fica**. Então o apagão atingiu **≈53 tentativas, não 27**. Contar pela tabela
subnotifica pela metade — é a mesma armadilha já registrada no #226 em 03/09
("a série pode CAIR sozinha sem nada ser consertado"). **O ledger é a fonte
honesta de tamanho de incidente; a tabela de jobs não é.**

## 3. Ação executada: os alunos queimados foram avisados

O vigia das 00hZ deixou isto como pendência 🔴 nº 1 ("ninguém os avisou de que
funciona"). Feito agora.

Dos 7 atingidos, 3 já tinham voltado e gerado com sucesso sozinhos
(bilaherrmann, ederonline1, renatarcpsi — ver tabela do item 1). Os **4 que não
voltaram** receberam e-mail individual de retomada pelo SMTP do `suporte@`:

| aluno | falhas hoje | e-mail | cópia nos Enviados |
|---|---|---|---|
| Anaelson Costa | 6 | costa.anaelson@gmail.com | uid 1115 |
| Rafaela Silva | 5 | rafaluanravi29@gmail.com | uid 1116 |
| Clayton Machado | 3 | clayton@arcoiristintas.com | uid 1117 |
| Luciano Orcino | 3 | lux.neuropsi@gmail.com | uid 1118 |

Conteúdo: o que houve, que a culpa foi nossa, que voltou às 20h41 BRT, que **os
créditos já voltaram sozinhos** e que podem gerar de novo. Sem promessa nova,
sem jargão. As 4 cópias foram **confirmadas na pasta de enviados** pelo próprio
script (não é "mandei e presumo").

## 4. Fila de recados desentupida (parcial)

`agent_state` tinha **28 recados `para_frank_*` + 3 patches**, o mais antigo com
**103h**. É exatamente o acúmulo que a §1-B do `03_ROTINA.md` manda evitar.

Apaguei com `DELETE` (nunca `set_state` value null, regra medida em 30/08) as
**5 chaves do apagão já tratadas**: `para_frank_85c9a45a`, `_485c3c3f`,
`_41fe25c5`, `_0bf82a53`, `_414a8d2d`. Sobram **23 recados + 3 patches**.

Anotei o fechamento conferido no incidente **85c9a45a** (nota nº 10, status
seguia `fixed`, `resolved_commit` 82a9b91).

## 5. Dívida técnica que NÃO foi paga (registro explícito)

O vigia pediu, junto com o merge: **apagar os diretórios parciais de
`transformers`/`wav2vec` e `TORCH_HOME`/Demucs no volume `ff442v3132` e rodar
`download_models.sh`** antes de liberar. **Isso não foi feito.** O pin resolveu
sem isso.

Por que fica registrado como dívida: o carregador só testa `os.path.exists`.
Enquanto existir diretório parcial no volume persistente, ele vê o caminho, não
baixa, devolve `None` em silêncio e o nó 194 quebra de novo — basta a pinagem
escorregar uma vez. **Mexer nesse volume é produção fora do fluxo normal, então
depende do "sim" do Johnny** (§06, "Pergunte antes").

## 6. Estado do resto (varredura completa desta ronda)

- **Presos:** 3 itens. `marcelopersonalthe32` (298.950 cr, sem voz há 27 dias,
  treino falhou por erro nosso em 10/08), `tania-araujo` (200.000 cr, voz em
  `awaiting_training` há 1 dia), `luanmarcal.com` (import quebrou em 29/08 —
  arquivo do Drive não está público). 1 `training_job` obsoleto, escrituração
  pendente, ninguém esperando.
- **Pagante trancado: 0.** 160 suspeitos conferidos um a um na Hotmart: 15
  cancelaram, 138 inadimplentes, 6 trial que nunca virou pagamento — todos
  trancados **corretamente**. **1 sem prova**: `drfabiovilhena29` (sem subscriber
  code no payload).
- **Compras pagas sem conta na plataforma: 4** órfãs na fila
  (`rodrigoaugusto` 03/09, `neto_rocha` 05/09, `caplastica` 05/09,
  `viniciusjc1903` 06/09 00h35Z). Classe do incidente `3ca22d47` — 6ª vez que
  volta e nunca virou conserto.
- **Chamados:** 18 abertos + 13 aguardando aluno. **Nenhum fechado nesta
  ronda** — a ronda das 01hZ também fechou zero. Duas rondas seguidas sem baixa
  na fila é o número honesto, não uma desculpa.
- **GPU:** saudável. Treino 7/7 workers ready, 0 na fila, 0 throttled. Vídeo
  4 idle + 1 running, 0 na fila, 0 throttled, 0 unhealthy.
- **Crons do Hetzner:** `sweep_mail`, `sweep_clones`, `sweep_social`,
  `sweep_winback`, `sweep_unanswered` de 5 em 5 min, `sweep_orphans` às 14h.
  O cron de e-mail da Fast **continua ativo** (exigência da ordem de 29/08).
- **Estornos gerais:** 10 tipos, 2.854 linhas varridas, nenhum tipo
  desconhecido. 4 sem estorno casado, **todos velhos** (20/08 e 24/08) — nada de
  hoje.
- **Caixa do suporte:** terceira ronda seguida sem e-mail novo de aluno. O
  vigia das 00hZ já marcou isso: silêncio de caixa **não é calmaria**.

## 7. Armadilha de instrumento encontrada nesta ronda

`video_clones` **não tem coluna `updated_at`** e `credit_transactions.ref_id` é
`text` contra `video_clones.id` `uuid`. As duas consultas erram e o Supabase
devolve erro — se o script engolisse o `error`, viraria "0 travados" alegre
(armadilha nº 1 do `03_ROTINA.md`). Conferi o `error` das duas antes de
acreditar em qualquer número deste relatório. O `join` correto é
`vc.id::text = ct.ref_id`.
