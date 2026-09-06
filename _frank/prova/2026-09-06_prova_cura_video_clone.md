# 06/09 — Prova de cura do Video Clone, e o instrumento que subcontou o apagão

> Duas medições hoje. A das **15:0xZ** (abaixo, seção 1) está certa no que
> mediu. A das **15:2xZ** (seções 2 em diante) descobriu que a TABELA
> `video_clones` **não é o registro das falhas** — e por isso a primeira
> medição, a lista dos "sete da promessa" e o roteiro do dia estavam com o
> raio do apagão errado. Fica tudo aqui, inclusive o que eu errei.

## 1. A cura, provada no R2 (reproduzida duas vezes)

`video_path` está preenchido **também nas linhas `failed`** — é o destino
pretendido, gravado na criação, não a prova de entrega. Concluir cura por
`video_path is not null` daria 100% de sucesso inclusive durante o apagão.
A prova é `HeadObject` no R2 (bucket `voices-clone-ai-verse`).

Script: `_Bugs/prova_cura_video_clone.cjs` · janela de 20h

| conjunto | linhas | objeto REAL no R2 |
|---|---|---|
| `ready` | 22 | **22** |
| `failed` | 18 | **0** |

Contraprova passou: o instrumento distingue os dois conjuntos. Não é
"ausência de falha" — são 22 entregas materializadas, a mais recente minutos
antes da medição (06/09 14:51Z).

## 2. O instrumento cego: aluno apaga a falha, e a falha some do banco

`DELETE /api/v1/video-clone` (`route.ts:319+`) apaga a linha **de vez** para
clone finalizado — não existe `deleted_at` em `video_clones`. O aluno limpa a
tela e o registro da falha deixa de existir. O que sobrevive é a **contabilidade**.

Medido, casando `credit_transactions.ref_id` com as tabelas:

| fonte | falhas do apagão |
|---|---|
| ledger (`ref_type='video_clone_refund'`) | **53** |
| ainda existem em `video_clones` | 27 |
| em `video_projects` / `react_jobs` / `render_jobs` | 0 |
| **sumiram** | **26** |

⚠️ **Regra que nasce daqui:** para "quem foi atingido" e "quanto", a fonte é o
**ledger**, nunca `video_clones`. A tabela responde "o que o aluno ainda vê na
tela", que é outra pergunta. A prova de CURA (seção 1) continua válida — ela
pergunta se o objeto existe no R2, e para isso a linha viva basta.

## 3. O apagão, medido pela contabilidade

- Janela real: **05/09 14:46:58Z → 23:12:25Z = 8h25m** (18 min mais cedo do que
  a versão anterior dizia — o primeiro estorno é de 14:46:58Z).
- **53 falhas · 9 alunos · 200.350 cr devolvidos.**
- Cada uma das 53 tem débito `video_clone` e estorno `video_clone_refund`
  casados **por `ref_id`** (regra do incidente 5009d7ab: nunca por timestamp,
  nunca por regex no JSON). Débito e estorno batem centavo a centavo em todas.
  **Nenhum aluno pagou por falha do apagão.**
- Causa (raw_error): `DownloadAndLoadWav2VecModel — Error no file named
  pytorch_model.bin`; nas notas dos incidentes `12c8b224` / `85c9a45a`:
  `transformers` subiu 5.14.1 → 5.16.1 numa rebuild sem teto de versão e o
  `Wav2Vec2Encoder` parou de devolver `hidden_states`.
- PR #190 (`feat/wav2vec-caminho-certo`) mergeado 17:25Z, verde 17:47Z, e as
  falhas seguiram até 23:12Z: **o PR não foi o que curou**. Recuperação a
  partir de 23:41Z.

## 4. Quem foi atingido de verdade (ledger), e o que aconteceu depois

| aluno | falhas | cr devolvidos | linhas que sobraram | prontos pós-cura | último pronto |
|---|---|---|---|---|---|
| pcezardireito@icloud.com | **11** | 30.030 | **0** | 0 | — |
| renatarcpsi@gmail.com | 8 | 69.720 | 3 | 2 | 06/09 13:48Z |
| bilaherrmann@gmail.com | 6 | 16.375 | 6 | **7** | 06/09 14:16Z |
| costa.anaelson@gmail.com | 6 | 23.310 | 6 | 0 | — |
| smilefastrio@gmail.com | 6 | 18.975 | **0** | 2 | 06/09 14:24Z |
| rafaluanravi29@gmail.com | 5 | 7.185 | 5 | 0 | — |
| ederonline1@gmail.com | 4 | 6.720 | 1 | 1 | 06/09 00:31Z |
| clayton@arcoiristintas.com | 4 | 19.425 | 3 | 0 | — |
| lux.neuropsi@gmail.com | 3 | 8.610 | 3 | 2 | 06/09 14:51Z |

O que a lista velha ("os sete da promessa") errava, e o tamanho do erro:
- **pcezardireito** aparecia com **0 falhas**. Tinha **11** — é o mais atingido
  do apagão inteiro. As 11 linhas foram apagadas.
- **smilefastrio** aparecia com **0**. Tinha **6**.
- **renatarcpsi**: 3 → **8**. **ederonline1**: 1 → **4**. **clayton**: 3 → **4**.
- **bilaherrmann** e **clayton** não estavam na lista. bilaherrmann levou 6.

## 5. Decisão: NÃO escrever aos alunos (e a prova de por quê)

Os 9 **já foram avisados duas vezes**, e cinco deles três. Conferido na caixa
de enviados, um por um:

| quando | assunto |
|---|---|
| 05/09 15:28–23:26 | "O Video Clone esta fora do ar — o problema e nosso, e seus creditos voltaram" (todos os 9) |
| 06/09 00:36–00:37 | "Voltou: voce ja pode gerar o seu Video Clone" (todos os 9) |
| 06/09 01:08 | "Vídeo Clone voltou a funcionar — pode gerar de novo" (**duplicata**, 5 alunos) |

Os rascunhos `2026-09-06_A_nao_tentaram.html` e `..._B_ja_geraram.html` seriam a
**terceira ou quarta** mensagem dizendo a mesma coisa, e abrem com "Prometi te
avisar quando voltasse" — promessa que já foi cumprida há ~14h. Mandar é a
mensagem genérica que a **regra 11** proíbe e repete o incidente `3565a46b`
(a Fast respondendo duas vezes a mesma coisa). **Não enviados.** Os rascunhos
ficam no diretório como registro da decisão.

Verificado antes de decidir (e é o que sustenta a decisão): o estorno que os dois
rascunhos afirmam existe mesmo, casado por `ref_id`, nas 53. A afirmação era
verdadeira — o problema é que já tinha sido feita.

## 6. Renata: não respondeu, e o acesso não venceu

- **Não respondeu.** Busca por remetente na INBOX volta vazia; contraprova
  (`--ultimos 5`) traz mensagens normalmente, então o vazio é ausência real,
  não instrumento cego. Fila de não-lidos da Fast = **0**.
- **Acesso ativo até 30/09**, não venceu: o entitlement renovou **hoje às
  14:13Z** (+100.000 cr, `payment_event / subscription_grant`, "recarga do
  ciclo"). Quando os e-mails de 05/09 20:28 e 06/09 00:37 foram escritos, a data
  06/09 12:00Z era a verdadeira — ela renovou depois. O e-mail não mentiu; o
  roteiro de hoje é que estava lendo um dado vencido.
- **Já voltou a gerar:** 2 vídeos hoje, o último 13:48Z, com objeto no R2.
- **O que continua em aberto:** o e-mail de 06/09 00:37 prometeu a ela, com
  todas as letras, que o caso foi "levado à diretoria", pediu que ela dissesse
  o que seria justo, e prometeu **acompanhar até ter retorno**. Ela não pediu
  nada. A promessa é nossa e continua de pé — e é decisão comercial
  (Johnny/Lucas), não minha. Levada adiante, não executada.

## 7. O acesso que venceu hoje 06/09 12:00Z é o do Paulo, não o da Renata

`pcezardireito@icloud.com` (Paulo Moura) — a troca de nome no roteiro escondeu
o caso mais delicado do dia:
- **11 falhas no apagão**, todas estornadas (30.030 cr). O mais atingido.
- **Cancelou em 31/08 20:39Z** — *antes* do apagão. Não foi churn causado pela
  falha; isso está descartado.
- Entitlement `canceled`, trial iniciado 30/08, `access_until` 06/09 12:00Z:
  venceu no horário normal.
- `pagou_de_verdade.cjs`: **nenhum pagamento neste e-mail** (Hotmart + Stripe),
  assinatura de R$ 0,00. ⚠️ Isso não prova que a pessoa nunca pagou — pode ter
  comprado com outro e-mail (armadilha dos incidentes #214/#218). Não conferi
  por nome/CPF.
- Ficou com **46.007 cr** e seguiu gerando (11 clones + 6 imagens em 05/09).

Pela regra 9 é o caso de "cancelou dentro do trial sem nunca pagar → zera".
Pela **9-A**, quem decide tirar crédito é o Johnny, sempre, em qualquer valor.
**Não toquei em nada.** Está aqui como pergunta, não como proposta executada.

## 8. Premissas do roteiro que o dado derrubou

1. "apagão passou de 24h" → falso: **8h25m**.
2. "acesso da Renata vencia 06/09" → o acesso é dela até **30/09**; quem venceu
   hoje 12:00Z foi o **Paulo** (seção 7).
3. "PR da trava de manutenção `feat/video-clone-manutencao`" → não existe.
   `git ls-remote` vazio, nenhum PR; contraprova com branch conhecida
   (`feat/dedupe-envio-email`) e busca conhecida (`estorno`) responderam normal,
   então o vazio é ausência real.
4. "27 falhas, 8 alunos" (medição minha das 15:0xZ) → **53 falhas, 9 alunos**.
   Errei por medir na tabela que o aluno pode apagar (seção 2).
