# Rotina das Falhas — 29/08/2026, ~17h UTC (dono da fila)

Abertura: `git checkout main && git pull --ff-only origin main` → já atualizado.
Índice de ordens lido antes de tocar em qualquer coisa. Ordens aplicadas:
`2026-08-20_dono_da_fila_e_fila_zerada.md` (14-A + armadilhas), regra 8 de 21/08
(serial + e-mail individual sem pedir permissão), `2026-08-27_vigia_so_erro_de_sistema.md`
(14-C) e regra 7 (só fato consumado).

Ronda anterior das falhas: 01h UTC. Vigia: 16h UTC.

---

## Placar

| | |
|---|---|
| Incidentes fora de `fixed`/`ignored` na abertura | **7** |
| Incidentes que **fechei** | **2** — `#6` (fixed) e `#186` (ignored) |
| Incidentes que levei ao fim sem fechar | **1** — `#99` → `aguardando_aluno` |
| Incidentes que anotei | **2** — `#184` e `#180` |
| Aluno para quem escrevi | **1** — Luciano de Pinho (`#99`), pagante |
| Incidentes que abri | **nenhum** |
| **Código em produção** | **nenhum meu** — verifiquei o de terceiros (§4) |
| Crédito que toquei | **nenhum** |
| GPU/retreino que disparei | **nenhum** |
| Migration | **nenhuma** |

---

## 1. `#6` — FECHADO. O balde mais antigo da fila (21/07) tinha duas causas

Escolha do serial pela régua da regra 8: mais antigo com aluno afetado, e em
empate o de mais gente — `#6` ganhou nos dois (3 e-mails, aberto desde 21/07).

A assinatura `generation:infra_storage:failed to download <url>` misturava:

- **(A) julho** — tropeço transitório de download do R2. 6 gerações, 14–15/07:
  4 do `arthurpetkowiczr@gmail.com`, 2 da `daniela.oliveira.bertoli@gmail.com`.
- **(B) 29/08 15:50Z** — **LoRA morto**: voz copiada cujo `lora_path` aponta pra
  pasta de outro dono e morre quando a origem é apagada. O presign nunca falha,
  então a plataforma **cobrava**, mandava pro RunPod e só lá dava o erro.

**Passo 1 do manual ("já resolveu sozinho?") pagou:** os dois alunos de julho
**voltaram a gerar com sucesso** — arthur em 17/07 19:45, daniela em 20/07 18:44,
ambos DEPOIS das falhas — e nenhum dos dois usou a plataforma desde então.
Ninguém estava esperando. **Não escrevi pra eles**: e-mail sobre tropeço de julho
já estornado e resolvido sozinho é ruído, não atendimento.

**Dinheiro, casado por `ref_id` e SEM filtrar por `kind`:** as 6 gerações têm 2
linhas cada (`generation` −400 + `generation_refund` +400), soma por objeto = **0**
nas 6. Quitadas. A ocorrência de hoje (`069563db`, conta de teste do Johnny) **não
tem nenhuma linha** em `credit_transactions` — não houve débito, logo **não há
estorno a fazer**. Não paguei em dobro (armadilha do `#152`).

**Fix em produção, conferido e não herdado:** PR #122 (`d182346`, merge `23fa33b`),
mergeado 16:10:11Z, deploy `Deploy Frontend (production)` run **33262221661 =
SUCCESS**. Li o diff: `generate/route.ts:118` faz HEAD no LoRA **antes de cobrar**
→ 409 `voice_needs_retraining` com zero crédito; e `ehFalhaTransitoria` passou a
cobrir `failed to download`, com trava pra **não** reenviar quando o arquivo sumiu
de vez. Conferi que `frontend/src/lib/r2/exists.ts` existe e **falha ABERTO** (só
404 confirmado bloqueia) — o que é o comportamento certo.

**Censo re-medido por mim:** 977 vozes com `lora_path`, **2** com pasta de outro
dono, e as 2 são cópias de teste do `johnny.oliveirasp`. Exposição de aluno: **zero**.

**O que NÃO afirmo:** que todo `lora_path` da base aponta pra objeto vivo — não
rodei HEAD nas 977. O risco residual está coberto pelo próprio fix, que confere na
hora de gerar e não cobra.

## 2. `#186` — FECHADO como `ignored`. Não era defeito: era marcação manual

Mesma classe do `#6`, mesma conta de teste. **A string do erro não existe no
código** — `grep` na árvore inteira não acha *"(a voz de origem foi apagada)"*; a
única parecida é `generate/route.ts:127`, com texto diferente. Alguém marcou a voz
de teste na mão às 16:09:44Z durante a sessão do PR #122 e o detector transformou
a linha em chamado. 14-C §2: mesma classe já aberta = ocorrência, não chamado novo.
Registrei qual checagem faltou (§3.1, "já existe?") — o detector automático não faz
busca por classe na fila.

## 3. `#99` — Luciano. A avaliação técnica que a gente prometeu e nunca fez

**Aluno PAGANTE** (`pagou_de_verdade`: R$97 APPROVED 26/08), esperando desde
28/08 23:55. A Fast prometeu avaliação técnica do vídeo em 28/08 20:00 e ela nunca
foi feita. Fiz: **baixei os arquivos do R2 e olhei**, não inferi do caminho.

**A correção que importa — o erro é nosso.** A Fast disse **duas vezes** que era o
enquadramento da foto. A imagem da última tentativa dele (`images/895205c5/result.png`,
**941×1672**) é ele **do peito pra cima, rosto grande, nítido, olhando pra câmera**.
O conselho já tinha sido cumprido. Insistir na foto seria a **terceira** resposta
errada pro mesmo aluno pagando. O diagnóstico estava certo pra `uploads/41f8bb6d.jpg`
(torso inteiro, 2304×4096, rosto pequeno no quadro) e **errado** pra a que ele
realmente usou — ninguém tinha olhado **qual das duas**.

**O que medi no vídeo** (mesmo recorte, mesma escala, foto × quadros):

- **frame 0** sai **fiel** à foto: nítido, textura de barba e pele preservadas;
- **frame 72 (2,9s)** e **frame 190 (7,6s)** perdem definição — pele lisa, barba
  embolada, rosto se afastando do original;
- o motor entrega **480×832** (`config.ts`, both tiers). É teto, não ajuste.

Ou seja: o "artificial" nasce **no nosso motor ao longo do clipe**, não na foto dele.

**Dinheiro:** os 630 cr do clipe `8a87c68c` **já foram estornados** em 29/08 01:55
(`video_clone_refund`, +630, casado por `ref_id`; soma 0 com o −630). **Não estornei
de novo.** Os 3.885 cr do clone de 37s (`88378833`) não foram estornados e **eu não
estornei**: vídeo entregue com sucesso, dentro de limitação declarada — estorno ali
é cortesia comercial, decisão do Johnny, não minha.

**Escrevi pra ele** (regra 8, decido sozinho): SMTP do suporte@, bcc suporte@,
ensaiado em `--dry-run` e lido inteiro antes de sair, endereço batido contra
`profiles` (1 match único, sem homônimo — armadilha do Cláudio Sityá). Assumi o
erro, dei os números, disse que não adianta gastar crédito testando foto nova, e
confirmei o estorno dos 630.

Status **`aguardando_aluno`, não `fixed`** — não consertei código nenhum; o que
havia de nosso era a resposta, e ela saiu.

### Achado pro Johnny (não virou chamado — 14-C, é produto/decisão)

`frontend/src/lib/video-clone/config.ts:45` promete que o rosto se afasta *"em
áudios longos (acima de ~40s)"*. **Medi degradação visível num clipe de 6 segundos.**
A descrição subestima o limite — e é exatamente por isso que o atendimento cai na
desculpa da foto: se a cópia diz que só degrada acima de 40s, sobra culpar o aluno.
Foi por Telegram.

## 4. `#184` e `#180` — anotados, e o que trava não é código

**`#184` (cota do Drive) tem fix EM PRODUÇÃO**, conferido por mim: PR #114
(`4ae0c3a`), merge 15:55:03Z, deploy run **33261539642 = SUCCESS**. Li o que subiu:
`erro-dono.ts` virou decisão pura testável e o regex `NOSSO` passou a incluir
*"limitou temporariamente"* e *"cota de tráfego"* — cota não cai mais em
`dependeDoAluno`. **Não fechei**: a régua escrita às 13:51Z era *"PR mergeado **E** o
import dele rodando de verdade"*, e a segunda metade não aconteceu. Baixar a régua
pra carimbar `fixed` seria furar a regra 14 por pressa.

**`#180` é o que realmente trava, e está parado há ~40 horas.** As duas únicas
`onboarding_runs` do Johnathan (28/08 02:12 e 02:16) falharam em `etapa_falha='audio'`
com *"a pasta do Drive está vazia"*, `audios_pedidos=0`. **Não existe run posterior.**
O defeito é `_Code_final.gs:397` (`DriveApp.getFiles()` não desce em subpasta) e
**roda no Google Apps Script — `git push` na main não alcança**. O patch está escrito,
com teto de profundidade e de arquivos, em `_frank/prova/2026-08-29_patch_180_apps_script.md`
desde a ronda das 01h. **Falta mão humana no editor.** Escalei de novo por Telegram
com o número das 40h.

⚠️ Os dois são do mesmo aluno e **se enfileiram**, não são duplicata: a cota só vira
problema real dele depois que o import conseguir listar os arquivos.

**Não re-disparei o import dele** e digo por quê: gasta GPU/crédito, tem vários
passos, e eu não teria como acompanhar até o fim dentro desta ronda. Disparar sem
conferir vira `done` falso.

## 5. Processo — o grupo segue mudo nesta máquina (6ª ronda)

`avisar_grupo.cjs --fato` abortou com `WAHA_API_URL/WAHA_API_KEY ausentes nesta
máquina` (a WAHA só escuta em `127.0.0.1` no servidor). **Tentei a rota real antes
de desistir**: não há alias de servidor em `~/.ssh/config` e o `known_hosts` está
hasheado. Isso é **provisionamento**, não falta de tentativa. Montei a mensagem em
`--seco`, li, e os fatos foram por Telegram (msgs **621**, **623**, **624**).
Pela 14-C isto é processo: 1 linha aqui + 1 mensagem pro Johnny. **Não digo que
avisei o grupo, porque não avisei.**

## 6. Fila no fim da ronda

**5 abertos** (era 7): `#99` `aguardando_aluno`, `#180` e `#184` `investigating`
(ambos Johnathan), `#187` (varredura cega, do Vigia), `#188` (atendimento, chegou
17:22Z — não peguei: o serial desta ronda já estava em três frentes e ele é do
turno seguinte).

Nenhum aluno pagante travado sem resposta ao fim da ronda.
