# Ronda das falhas — 24/09, ~20:40–20:50Z

Item serial (regra 8): **`#15` / `d3d8d1b2`** — o mais velho da fila com aluno
afetado (56 dias, 19 e-mails). **FECHADO nesta ronda.**

---

## 1. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar` | 1244 lidas / 1167 já tinham linha / **0 escrituráveis**. Contagem fecha 1244 = 1244. |
| `2026-09-18_enviados_x_tabela.cjs` (irmão de leitura) | **0 carta depois do corte** fora da tabela. Veredito: buraco PASSIVO. |
| `percepcao_travada.cjs` | **0 cartões** travados em percepção · mais velho 0d. Controle positivo (#310) e negativo (#518) OK, 544 varridos. |

As 77 cartas anteriores a 14/09 14:06:31Z seguem **sem decisão** (é o que o
`--corte` exclui) — inalterado, continua decisão de produção, não de ronda.

---

## 2. O que era o `#15`

Hang nativo segurando o GIL congela **todas** as threads Python do worker —
inclusive a do próprio heartbeat. Medido na geração `9555c0d0` (22/09): `visto_em`
e `running_s` param de avançar **juntos**. Sem ninguém vivo pra perceber, o job só
morria no teto do `executionTimeout`.

Na `342e54a1`: **644s** para um texto de **78 chars** (debita o mínimo, 400 cr),
quando o normal é ~2 min. **Não era régua curta — era pendura**, como a ordem de
20/08 já suspeitava.

## 3. O conserto, e a prova de que está no ar

O vigia não podia ser thread (congelaria junto), então virou **processo filho**:
o heartbeat escreve um pulso em arquivo a cada tick e o filho (`worker_watchdog.py`)
SIGKILLa o worker quando um pulso **ATIVO** fica ~105s sem sucessor, postando erro
nomeado no banco **antes** do kill. O retry da RunPod faz o resto.

**Em produção, conferido — não "CI verde e fé":**

- PR #404 → merge **`66a82ff4`**, merged **2026-09-24T19:24:32Z**.
- `git merge-base --is-ancestor 66a82ff4 origin/main` → **ancestral confirmado**.
- Build RunPod do **mesmo sha**: `success` às 19:24:35Z.
- O workflow **não é best-effort**: o passo `saveTemplate` faz
  `grep -q imageName || exit 1`. Run verde **implica** template apontando pra
  imagem nova. (Foi isso que me deixou fechar sem acesso ao painel da RunPod.)
- Vem junto o #403 (`a77c90c9`), que põe `setup_s`/`since_t0_s` na fase.

**Guarda contra regressão (controle de mutação, feito nesta ronda):**

- `test_watchdog_travado.py` → **27/27**, incluindo o teste de integração que sobe
  o `worker_watchdog.py` de verdade e mata um processo-vítima congelado.
- Mutante (a) `return TRAVADO` incondicional — *mataria geração viva de aluno* →
  **3 testes caem**.
- Mutante (b) `if True: return OK` — *vigia vira decoração, volta o teto de 640s* →
  **3 falhas + 1 erro**, e o suite passa de 2s pra **32s** (ninguém mais é morto —
  o próprio tempo denuncia).
- Árvore restaurada, `git status --porcelain runpod-worker/` **vazio**, 27/27 de
  novo. Nenhum mutante commitado.

## 4. Dinheiro: zero a devolver

As **22** gerações da classe (20 do cartão + 2 de rede em 21/07) foram **todas
debitadas E estornadas**, 2 lançamentos cada, soma exatamente **zero**.

⚠️ Conferido por **`ref_type='generation_refund'`**, nunca por `kind`. Reencontrei
a armadilha de 20/08 **intacta**: o estorno do Braulio grava `kind='extra_purchase'`
com nota `"pacote avulso"`. Quem filtrar por `kind` conclui que ninguém foi
estornado — e quase pagamos em dobro por isso uma vez.

## 5. Alunos: 21 de 22 se resolveram sozinhos

Confirmado por geração `ready` **posterior** à falha, aluno a aluno. O caso (1) do
playbook — "já resolveu sozinho?" — era mesmo a maioria.

**O único que não voltou:** `brauliomarcos3@hotmail.com`. Falhou 24/08 15:49Z
(492s), estorno automático 8min22s depois, e **zero geração pronta desde então** —
a falha foi a última coisa que ele fez no produto. Tinha 3 gerações boas antes.

Escrevi pra ele **hoje** (chave `timeout-d3d8d1b2-corrigido`, **uid 3413 confirmado
na pasta remota**): a falha foi nossa, o texto dele estava certo, os 400 cr
voltaram no mesmo dia, a causa está corrigida.

**Não prometi nada de plano/acesso** — ele pagou R$297 de avulsa (*Fábrica de
Conteúdo Invisível*) e a assinatura FastCloner está 0 BRL com 2 ciclos OVERDUE. O
que a avulsa dá direito aqui é **decisão comercial do Johnny (#173)**, não de ronda.

## 6. O que eu **não** estou afirmando

**Não** estou dizendo que a classe parou de acontecer. São ~1,5h e **3 gerações**
(todas `ready`) desde o deploy, e a classe dispara ~1x a cada 2 semanas (1 em 22/09,
1 em 04/09 nos últimos 20 dias). **Isso não é amostra pra provar ausência.**

Fechei pela **causa endereçada + conserto provado no ar + guarda que pega a
regressão** — não por silêncio. Está escrito na nota do cartão: se `last_seen_at`
avançar depois de `2026-09-24T19:24Z`, **reabrir**. Cartão fechado que segue
disparando é o detector de bug nosso (foi assim que o `8d370ef5` escondeu 14
ocorrências). Agora a reincidência chega legível — `worker travado em <fase> chunk
<n>` — em vez de `executionTimeout exceeded` pelado.

---

## 7. Achado de passagem → cartão **#561** (`da5b049e`), aberto

**A migration 96 nunca foi aplicada.** As 4 colunas que
`scripts/96_training_jobs_cura_transcricao.sql` declara **não existem** em
`public.training_jobs`: 0 de 4.

**Não é fila atrasada — foi pulada:** a **97** (`trainer_returncode`,
`trainer_stderr`, `trainer_stdout`) está aplicada, **3 de 3**, por cima dela.
Ordem de numeração não é garantia de aplicação.

Por que ninguém viu: `finalize-training.ts:622` chama `registrarCuraEBuild()` em
toda finalização de treino, e ela é **best-effort de propósito** (o cabeçalho da
própria migration decide isso, e decide **certo** — observabilidade não pode
derrubar o produto). O efeito colateral é que a ausência é **silenciosa**.

O que custa: `worker_image` é o carimbo de identidade do build — o Dockerfile
mantém o `ARG/ENV` no fim do arquivo *de propósito*, comentado como servindo "pra
saber, olhando um treino no banco, QUE imagem o produziu". **Esse instrumento não
existe no banco**, em nenhum dos **1.530** treinos. É exatamente a pergunta que eu
fiz hoje no #15 e tive que responder por CI/sha.

**Não apliquei**: DDL sem aval não é alçada de ronda. A migration é aditiva
(`add column if not exists`, 4 colunas text, sem backfill, sem índice). Vale
conferir junto se **outras** foram puladas no mesmo intervalo.

---

## 8. O que eu não fiz, de propósito

- **Não apliquei migration** (a 96 ficou pro Johnny, com o cartão aberto).
- **Não mergeei nada** — nenhum dos 6 branches STALE do índice foi tocado.
- **Não mexi** em crédito, acesso, plano, assinatura ou status de pedido.
- **Não gastei GPU**, não pedi retreino, não regenerei áudio de ninguém.
- **Não toquei** em nada da planilha (ordem de 29/08).
- **Não li** a caixa do suporte@ pra triagem (a Fast marca como lido).
- **Não decidi** o que a compra avulsa do Braulio dá direito — é comercial.
- **Não reportei número** do `esperando_johnny.cjs`: ele imprimiu **controle
  positivo INCOMPLETO** (1 de 5 sumiu, o `8b8fc4c8`, porque a última nota é um
  retrofit sem marca). O próprio script manda não reportar rodada assim, e o viés
  dele só anda pra baixo — fila menor que a real lida como melhora. Fica medido
  pra próxima ronda **consertar a marca antes** de contar.

## 9. Fim de ronda

- Log commitado na **main** (só o log; nenhum código de produção mudou nesta ronda).
- Recado no **grupo** via `notify-grupo.sh` (canal de 31/08). Nada no privado.
- `git log --oneline origin/main..HEAD` conferido **vazio** no fim.
- **Não criei branch nesta ronda** (nenhum código de produção mudou), então não
  havia fix meu pra ficar preso.

### ⚠️ O passo fixo do `git rev-list` não faz o serviço que o manual pede

Rodei o passo como está escrito ("`git branch` + `git rev-list main..<branch>` pra
conferir que não ficou fix preso") e ele **acusou ~193 branches**. Alarme que dispara
193 vezes não é alarme: ninguém lê, e foi lendo esse tipo de lista que um fix de
aluno ficou 9h preso em 19/08.

E não é só volume — **boa parte é falso positivo**, porque squash-merge deixa o
conteúdo na main com sha diferente. Medido, 334 branches locais:

| Checagem | Acusa |
|---|---|
| `git rev-list main..<branch>` (o do manual) | **~193** |
| `git cherry main <branch>` (conteúdo de verdade fora) | **128** |

Controle, com casos que o próprio índice de ordens já classificou:

- `feat/onedrive-spo-fedauth` → rev-list **1**, cherry **0**. É o fix que **está em
  produção** (PR #60). O manual o acusaria; o `cherry` o inocenta. **Falso positivo.**
- `fix/estorno-treino-por-saldo-pendente` → rev-list **1**, cherry **1**. É STALE de
  verdade (o índice manda não mergear). **Verdadeiro positivo nas duas.**

Ou seja: `git cherry` distingue, `git rev-list` não. **Não mudei o manual** — o passo
fixo é ordem e corrigir ordem não é alçada de ronda. Fica medido e proposto: trocar
`rev-list` por `cherry` e **escopar aos branches tocados na própria ronda**, que é a
pergunta que o passo realmente quer responder ("ficou fix MEU preso?"), em vez de
reauditar 334 branches históricos toda vez.
- Escrita conferida na releitura: cartão `#15` relido (84 notas preservadas, 1 linha
  afetada), carta uid 3413 confirmada na pasta remota, cartão #561 relido.

⚠️ **Achado no fim de ronda, deixado para o dono:** a árvore tem artefatos
**não rastreados** de uma ronda anterior sobre o `75c33ee1` — 1 ferramenta
(`_frank/ferramentas/2026-09-24_simulacao_75c33ee1_estorno_agregado.cjs`), 2 provas
(`_frank/prova/2026-09-24_backup_75c33ee1_perfis_antes.json` e
`..._simulacao_75c33ee1_antes_depois.json`) e 7 rascunhos. **Não commitei**: não é
trabalho meu e não sei se a simulação foi decidida — commitar prova alheia como se
fosse desta ronda é pior que deixar à vista.

Mas registro porque é a **mesma família** do fix que ficou 9h preso num branch em
19/08: arquivo não rastreado é tão invisível quanto arquivo em branch de feature —
some no próximo checkout e leva junto o backup dos perfis de ANTES, que é
justamente o que se usa pra desfazer um estorno agregado se ele sair errado. Quem
rodou aquela simulação: commita ou apaga, mas não deixa em cima da mesa.
