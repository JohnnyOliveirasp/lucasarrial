# Rotina das falhas — 02/09/2026, ~20:00Z

Ordens lidas antes de tocar em qualquer coisa: índice `ordens/README.md`, canal de 31/08 (tudo
do FastCloner vai no **grupo**), `2026-08-29_desligar_vigia_e_frank.md` (planilha desativada) e
`2026-08-20_dono_da_fila_e_fila_zerada.md`. Método serial (regra 8, 21/08).

## Placar

| | entrada | saída |
|---|---|---|
| abertos (`open`+`investigating`) | **5** | **5** |
| aguardando aluno | 10 | 10 |

**Não fechei nenhum incidente, e isto não é ronda vazia.** O item que peguei (`#234`) não tinha
como fechar: o que existe hoje é instrumentação em **sombra**, que mede e não conserta. O que a
ronda entregou foi a **medição que faltava** — e ela **derruba um alarme** que eu mesmo estava
prestes a dar.

## Ordem serial

Por regra 8 (mais antigo **com aluno afetado**): o `#47` (Katia, 19/08) e o `#235` (Alana) estão
**com a bola no aluno** — trabalhados às 17h45Z e 18h41Z, esperando resposta e print. Esperar
aluno não é estar travado. O `51d86460` (10:17Z) é defeito de processo interno, sem aluno
sofrendo. Sobra o **`#234` / `f8587cef`**: 609 gerações, 237 alunos, 272 vozes — de longe o que
tem mais gente sofrendo.

---

## §1 — `#234`: pela primeira vez em 5 rondas, "mergeado" É produção

As 4 rondas anteriores registraram "card `completed` não é produção". **Desta vez é**, e a prova
não é o merge:

- PR **#153** (`2bc1c75`, merge `cc73be3`) + build `Build RunPod Worker` **33656746238 SUCCESS**
  (16:44Z + 24m16s → **~17:08Z**).
- **Prova de produção, no banco:** das **17** gerações criadas depois das 17:08Z, **13** carregam
  a chave `tail_interno_*` em `generations.qa`. Das **28** anteriores, **nenhuma**. As 4 sem a
  chave têm `qa={}` e `runpod_job_id=null` — outro caminho, não passaram pelo worker.

Build de imagem **não é** endpoint rodando a imagem; por isso a prova é o dado de geração real,
não o log do GitHub Actions.

## §2 — A medição da sombra, e o alarme que eu **não** vou dar

Sombra em produção (≥17:08Z, 13 gerações): **171** fronteiras internas checadas, **19**
reprovadas (**11,1%**), 0 `none`, **19** em `tail_interno_sombra` — nenhuma pontuou, **nenhuma
entrega mudou de rumo**. `tail_interno_word_flagged=0`, coerente com a 2ª prova por palavra vir
desligada.

### ⚠️ A correção que importa
Por **geração** a sombra reprova **7/13 = 53,8%**, contra os **14,3%** da varredura histórica.
Parece explosão de 3,7×. **Não é.** A taxa por geração depende do **tamanho do texto** (mais
fronteiras = mais chance de ter ≥1 ruim) e a amostra de hoje é pesada em texto longo (5 gerações
de 100s+). A régua justa é **por fronteira**:

| régua | ruins / total | taxa |
|---|---|---|
| varredura histórica (4.258 entregas) | 1.355 / 14.921 | **9,08%** |
| áudio entregue hoje (13 gerações) | 6 / 66 | **9,1%** |

Bate na segunda casa. **O defeito está estável, não piorou.** Quem citar "53,8%" como
agravamento estará comparando réguas diferentes — registro isso justamente porque eu quase fiz.

## §3 — As duas réguas não medem a mesma coisa (e isso decide a próxima ação)

A sombra julga o **fim de cada chunk dentro do worker** (171 eventos). A régua do áudio entregue
só enxerga fronteira que virou silêncio digital ≥120ms no mp3 final (**66** eventos) — muita
emenda de chunk não deixa silêncio e é **invisível** ali. Confronto geração a geração:

| | sombra (interno chk/flag) | entregue (fronteiras/decapitadas) |
|---|---|---|
| 7bac4fb9 | 48 / **9** | 5 / **1** |
| 342e54fd | 17 / **1** | 17 / **2** |
| 9f39e6b6 | 6 / **1** | 6 / **1** |
| a6fdc411 | 7 / **1** | 5 / **1** |
| 4aeefb29 | 27 / 0 | 20 / **1** ← sombra **perdeu** |
| 6874a938 | 1 / **1** | 1 / 0 ← entregue **limpo** |
| 35f799fd | 11 / **2** | 5 / 0 ← entregue **limpo** |
| c71d516e | 9 / **4** | 2 / 0 ← entregue **limpo** |
| 3589d4c1, 9c05d63d, 42da1e85, a2f8fd29, 1e9c1335 | 0 flag | 0 |

**Recall ~80%** (pegou 4 das 5 gerações realmente defeituosas), **precisão ~57%** (4 de 7).

### Conclusão operacional: **não virar a chave pra `reprovando` agora**
Com precisão de ~57%, ligar o peso 100 força regeneração em geração que está **boa**. O custo já
é visível: a `7bac4fb9` sozinha gastou **33 regens**. A chave é por env
(`TTS_TAIL_QA_INTERNO_MODO`), **não exige deploy** — então não há pressa nenhuma em virar. O
certo é juntar amostra maior e apertar a régua antes. Isto **confirma com número** a escolha de
sombra do PR #153, que até agora era só prudência.

## §4 — Achado novo, que não é do `#234`

A `4aeefb29` tem corte no **fim do arquivo** (t=113,216s = duração exata, `sil=0`, release 30ms,
platô −37,3dB) e o QA do **último chunk** — que existe desde 26/08 e **não** é a novidade deste
incidente — deixou passar (`tail_checked=3`, `tail_flagged=0`).

**Ressalva honesta:** é caso **marginal** (release 30 contra corte em 35; platô −37,3 contra
corte em −40), bem mais fraco que o caso-índice (10ms / −27,9dB). **Não abri chamado por causa de
um marginal** — noise mata o canal. Fica anotado: se repetir na próxima medição, merece incidente
próprio no caminho do último chunk.

## §5 — Cinco alunos receberam áudio decapitado HOJE

Nenhum reclamou; nenhum está no `affected_emails` do incidente.

| aluno | geração | fronteira | força |
|---|---|---|---|
| renatarondon@icloud.com | 7bac4fb9 | t=84,829s release **0ms** platô **−18,8dB** | **inequívoca — pior que o caso-índice da Katia** |
| wilson.nfaustino@yahoo.com.br | 342e54fd | t=66,617s (0ms/−27,5dB) **e** t=78,352s (5ms/−36,5dB) | 1 inequívoca + 1 mediana |
| claudionirqs@gmail.com | 9f39e6b6 | t=24,412s (30ms/−31,9dB) | mediana |
| brunodalcum@gmail.com | a6fdc411 | t=14,823s (35ms/−33,9dB) | marginal, no limiar |
| samanthacarvalho188@gmail.com | 4aeefb29 | t=113,216s (fim do arquivo) | marginal |

Placar de evidência dito na cara: **2 inequívocas, 2 medianas, 2 marginais**. O próprio Vigia
registrou que o limiar foi calibrado em **um** positivo conhecido — ordem de grandeza aguenta,
precisão de laboratório não.

## §6 — O que eu NÃO fiz, de propósito

- **Não virei a chave do gate** — muda comportamento de produção e gasta GPU.
- **Não refiz áudio de ninguém** — `refazer_audio_conta_da_casa.cjs` dispara GPU, e a regra é não
  gastar sem o aluno pedir.
- **Não escrevi pros 5 alunos.** Avisar 5 pessoas que **não reclamaram** sobre defeito que elas
  não notaram é decisão de produto/marca, não minha, e encosta em comunicação em massa (precisa
  do "pode" do Johnny). Levei os 5 nomes + a proposta de refazer por conta da casa **pro grupo**.

## §7 — Pendência da descrição do incidente: RESOLVIDA

`cauda_decepada.cjs`, `cauda_alcance.cjs` e `_frank/prova/cauda_decepada.jsonl` estão **tracked**
(`git ls-files` confirma). A varredura de 20min/2GB não evapora mais. Era pendência nomeada do
dono da fila; sai da lista.

## Observação lateral, não investigada

**28 perfis** (de 1.782) com `credits_extra` **negativo**, vários no mesmo valor exato (−11.575,
−10.000). Todos com `credits_subscription` positivo e **saldo total positivo** — ninguém
bloqueado, ninguém cobrado errado agora. Valor repetido cheira a **artefato de contabilidade**,
não a vazamento. **Não abri incidente e não provei nada nos dois sentidos** — por isso não
disparou a exceção de dinheiro da regra 8. Fica registrado para uma ronda que o tenha como alvo.

## Limites da minha prova, ditos na cara

1. **Amostra de uma tarde**: 13 gerações, 171 fronteiras internas, 66 fronteiras entregues. A
   sombra só começou 17:08Z — não existe mais dado que isso. A comparação das duas réguas vale
   **para estas 13** e não é generalizável sozinha.
2. **Não rodei nada em runtime do worker.** Li o banco (`generations.qa`) e medi os mp3
   entregues. A afirmação de que a sombra "não mudou nenhuma entrega" vem de
   `tail_interno_sombra == tail_interno_flagged`, que é leitura de contador, não observação.
3. **A régua é a mesma do Vigia**, com o limiar calibrado em 1 positivo. Rodei `--ensaio` antes
   de usar e ela reproduziu os 3 casos classificados à mão (1 cortado, 2 limpos) — mas isso
   valida a régua nos 3, não no universo.
4. **Errei uma consulta e quase reportei zero aluno.** Meu primeiro `select` em `profiles` pediu
   `full_name`, coluna que não existe; o PostgREST devolveu erro e minha leitura preguiçosa virou
   "(sem perfil)" nos 5. A coluna é `display_name`. Registro porque é exatamente a armadilha do
   zero que o manual manda não acreditar — e eu quase acreditei.
5. **`#234` continua `investigating` e é o certo.** Sombra mede, não conserta. Fechar aqui seria
   marcar `fixed` sem resolver (regra 14).

## Registro de rotina

- `anotar_incidente`: `#234` (`f8587cef`) nota **1 → 2**, status **inalterado**, `resolution_note`
  0 chars, **1 linha afetada**, conferido na releitura.
- Nada da **planilha** foi lido, escrito, classificado, avisado ou reprocessado (ordem 29/08).
- Nenhuma GPU, nenhum crédito, nenhuma migration, nenhum e-mail a aluno.
- Grupo: postado com `notify-grupo.sh`. **Nada foi para o privado do Johnny** (ordem 31/08).
- `_frank/ferramentas/assinatura_em_dobro.cjs` segue **untracked** — não é meu e não é desta
  ronda. **4ª ronda seguida** registrando em vez de commitar trabalho de outro agente em silêncio.
