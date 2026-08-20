# Rotina das Falhas — ronda das 17h (2026-08-20, 16:40–17:15 UTC)

Dono da fila: Frank (regra 14-A). Ordem vigente lida:
`_frank/ordens/2026-08-20_dono_da_fila_e_fila_zerada.md` (+ índice do README).

**Resumo em uma linha:** a fila NÃO estava mais zerada — 2 incidentes abertos pelo
Vigia, **2 alunos pagantes destravados de verdade** (63,8h e 61,9h de espera), e uma
varredura lateral achou **3 pagantes ativos sem nenhuma voz pronta** que ninguém
estava olhando porque nunca reclamaram.

---

## 1. Fila de incidentes — conferida paginada, com o `error` cru impresso

`varredura_travados.cjs` disse "2 abertos". Não aceitei o número de cara: reconferi em
`_Bugs/2026-08-20_ronda_16h40_fila.cjs`, paginado e imprimindo o erro cru.

- `incidents`: **64 linhas, `count` exact = 64** (uma página, sem corte de 1000).
- Por status na entrada: `fixed` 47, `ignored` 15, **`investigating` 2**.

Os 2 abertos são do Vigia, de hoje ~16:14/16:15 UTC. Ele fez o papel dele (sensor):
abriu, mediu e anotou. Eu decidi e agi.

Também cruzei os **15 fechados com `last_seen_at` < 24h** (armadilha do `8d370ef5`).
Nenhuma classe de falha órfã nova apareceu; o que apareceu foi por outro caminho,
no item 4.

## 2. `bea487b7` — 2 pagantes destravados (a tela mentia)

**Estado ao chegar:** ms.sobadjian e celsopinto, ambos com **100.000 créditos** e
acesso até 27/08, presos em `awaiting_training` há **63,8h e 61,9h**, com a voz
carregando `error_message` = *"Treinar a voz custa 10.000 créditos e você tem 0"*.

Primeira coisa que fiz foi a pergunta 1 da rotina — **já resolveu sozinho?** Não:
os dois seguiam presos, com a mensagem intacta.

**Corrigi o diagnóstico da nota anterior.** A nota do executor (16:24) dizia que a
frase é escrita em `finalize-training.ts` e `rescue-stuck-uploads.ts`. **Não é.** Essas
duas escrevem outras mensagens. O grep do texto literal aponta um único escritor:
`frontend/src/lib/onboarding/treino.ts:77` — o caminho de treino **automático do
onboarding**. Se o aluno ainda não pagou, ele grava a frase e sai sem treinar; quando
o crédito entra depois (`subscription_grant` em `payments/claim.ts`), **nada limpa a
mensagem nem re-dispara o treino**.

**E o bug é menor do que parecia, o que muda a resposta:** o gate de
`start-training/route.ts` lê o saldo **ao vivo** (`getBalance()`) e, ao reservar a voz,
já grava `error_message: null`. **O servidor nunca recusou esses treinos.** Era tela
mentindo, não porta trancada. Li o código, não deduzi.

**O que fiz:** limpei a `error_message` das 2 vozes. Não disparei treino, não gastei
GPU, não toquei em crédito.

```
LINHAS AFETADAS: 2 (esperado 2)
RELEITURA depois de gravar: 2 linhas, 0 ainda com mensagem  ✅
```

O update foi por `.in(ids)` **com `.select()`**, e reconferi com uma leitura
independente depois da gravação — a armadilha do "update por id inexistente afeta 0
linhas em silêncio".

**Varredura da classe:** 29 vozes em `awaiting_training`, 12 com a mensagem de crédito.
Em **10 a mensagem é VERDADE** (saldo 0 — gate legítimo pela REGRA FINAL DE CRÉDITO).
As 2 mentirosas eram exatamente essas. Bate com a medição do Vigia.

**Segue `investigating`, de propósito.** Os alunos foram destravados, mas **o gerador
continua vivo** — marcar `fixed` aqui seria mentir (regra 14). Fecha quando o fix
estiver na main e no ar. Virou card `394342a0` pro coder, com a variante **sem
backfill** (não renderizar mensagem de saldo quando o saldo ao vivo cobre o custo) e
instrução explícita de **não tocar em `claim.ts`/entitlements**, onde estão os PRs
#17/#18 — colisão anunciada.

## 3. `ef6e08a4` — Katia: a queixa é SEMELHANÇA, e o relógio explica

Ela escreveu 12:14 UTC: *"a voz está totalmente diferente do que eu gravei, parece um
robô... eu não sei como funciona para treinar esse clone?"*

**O que descartei, com número:**

| hipótese | veredito | prova |
|---|---|---|
| treino defeituoso | **não** | job `2a45eeac` completed, `steps=500` (o valor certo; 1000 é o que dá overfit), `useful_seconds=2911,2` (48,5 min de fala limpa contra mínimo de 10), elapsed 406s, LoRA 69,04 MB no R2 |
| áudio de treino pobre | **não** | `duration_seconds=2979`, arquivo único de 40,05 MB |
| arquivo não-áudio (classe `910ea757`) | **não** | único arquivo é `.m4a` — rodei a checagem de ARQUIVOS primeiro, como manda a armadilha |
| completude do texto | outra classe | já fechada em `ce6e157d`, `4396496b`, `fb8d29b7` |

**O achado que muda a resposta é de relógio:** a entrega que ela julgou saiu em
**19/08 21:07**. A referência dela só foi **curada em 20/08 02:57** — o R2 tem
`ref/auto.wav` ao lado de `ref/auto_backup_20260820.wav`, que é o backup do corte
antigo. **Tudo que a Katia ouviu até hoje saiu da referência ANTIGA.** Ela nunca ouviu
uma geração pós-cura. Reforço: o vídeo clone dela de 20/08 11:38 tem **32,93s**, que é
exatamente aquele áudio de 19/08 virando vídeo — ela montou às 11:38 e escreveu às
12:14. É esse material que ela chamou de robô.

**Ninguém respondeu:** busca em "Sent" não achou nada. Ressalva honesta: a gravação de
enviados só entrou em teste em 19/08, então a ausência não é prova — mas soma com o
incidente.

**Segue `investigating`** porque o que resolve depende do Johnny: regerar gasta GPU e
escrever pra ela precisa do "pode". Recomendação no item 6.

**Ressalva que não pode sumir do relatório:** *"parece um robô"* é perceptivo. **Nada
no banco mede semelhança de voz.** Mesmo com a referência curada pode não agradar —
não prometer a ela o que não dá pra garantir.

## 4. 🔴 O achado desta ronda: 3 pagantes ativos sem nenhuma voz pronta

Não veio da fila. Veio de desconfiar de um número meu: ao varrer a classe do item 2,
achei 42 vozes `failed` carregando mensagem de crédito velha. Mensagem velha em voz
`failed` **não trava nada** (o gate só aceita `awaiting_training`), então quase
descartei. Em vez disso cruzei com *"esse aluno tem ALGUMA voz `ready` hoje?"* — e aí
apareceu gente.

6 alunos sem nenhuma voz pronta; **3 com acesso VIVO**, e cada um por um motivo
diferente:

| aluno | saldo | acesso | parado | causa (do `training_jobs`, não deduzida) |
|---|---|---|---|---|
| marcelopersonalthe32 | 198.950 | até 05/09 | **246h** | `[Errno 28] No space left on device` — **infra nossa**, disco cheio no worker. Áudio dele intacto no R2 (43,11 MB, 47 min) |
| csitya100 | 200.655 | até 13/09 | **118h** | `ffmpeg ... does not contain any stream` — 20 arquivos: 1 mp3 + 6 jpeg + 6 mp4 + 7 pdf. **Classe do `910ea757`** |
| ivanildezuca | 200.000 | até 08/09 | **287h** | só ~6 min de fala aproveitável (mínimo 10) — **gate legítimo**, não é bug |

O caso do **csitya100 é o que mais dói**: a voz é de **15/08, antes do fix** (`6e07830`),
então **não é regressão** — é **vítima antiga que o resgate daquele incidente não
alcançou**. O `910ea757` destravou 3 vozes e foi fechado; esse aluno ficou pra trás,
com 200 mil créditos e acesso até setembro.

**O buraco estrutural por trás dos três:** voz em `failed` **não volta pra fila**. O
gate só aceita `awaiting_training`, então o aluno não consegue "tentar de novo" —
mesmo quando a mensagem na tela dele manda tentar de novo (caso 1, texto literal:
*"Por favor, tente treinar novamente"*). Ele teria que criar voz nova e reenviar tudo.
Quem falhou por culpa nossa fica dependendo de alguém varrer.

Abri o incidente **`5c3f1f8b`** (`open`) com os três, as causas separadas e a
recomendação. Fila agora: **3 abertos/investigating** — conferido por releitura.

**Dinheiro:** os três estão com crédito devolvido. **Não há dinheiro pendurado.**

### O detector que NÃO subiu (e por que estou dizendo isso)

Pra achar as vítimas usei um filtro por extensão de arquivo em `raw_audio_paths`. Ele
acusou **168 vozes**. **Esse número não presta e não deve ser citado:** vários arquivos
de onboarding vêm **sem extensão nenhuma** (ID do Drive puro) e o filtro os conta como
lixo — inclusive em vozes que treinaram e estão `ready`. Só uso como sólido o que tem
extensão inequívoca (`.jpeg`/`.mp4`/`.pdf`), que é o caso do csitya100. É a quarta
heurística barata a falhar nesta família de problema; registro como as outras três.

## 5. O que conferi e estava tudo certo

- **`d3d8d1b2` (timeout):** a ordem manda reabrir **se voltar**. Continua sem voltar —
  última ocorrência 18/08 20:46, agora ~44h atrás. **Não reabri.**
- **Fechados disparando:** os 15 com `last_seen_at` < 24h batem com classes já
  cobertas. Nada escondido atrás de incidente fechado.
- **Nada preso:** 0 itens em estado intermediário na varredura padrão.

## 6. Pendências pro Johnny (as 3 primeiras precisam do "pode" dele)

1. **Katia** — 1 regeração de cortesia com a referência **curada** (ela nunca ouviu
   uma) + resposta à pergunta direta dela sobre como treinar o clone. Gasta GPU e é
   e-mail pra aluno: **preciso do "pode"**.
2. **marcelopersonalthe32 e csitya100** — retreinar por conta da casa (o áudio dos dois
   já está no R2; no caso 2 o worker corrigido já pula arquivo sem faixa) + avisar.
   **Falha nossa nos dois casos.** Gasta GPU: **preciso do "pode"**.
3. **ivanildezuca** — só e-mail explicando por que falhou e como regravar.
4. **Estrutural** — dar caminho de retry pra voz `failed` por culpa nossa, em vez de
   depender de alguém varrer. Vira card quando você aprovar a direção.
5. Segue da ronda anterior, sem novidade: `feat/ref-corte-em-palavra` parada fora da
   main; 9 referências com transcript vazio; laudo da Katia (`r15_dur_ref`) apoiado em
   constante errada; n=30 pós-régua ainda não conclui.

## 7. O que NÃO fiz

- Não marquei nada como `fixed` — **nada foi resolvido de ponta a ponta nesta ronda**.
- Não gastei GPU, não retreinei, não regerei áudio, não toquei em crédito de ninguém.
- Não mandei e-mail pra aluno (sem o "pode").
- Não rodei migration, não mergeei branch nenhuma.
- Não li a caixa do suporte@ pra triagem. A única leitura foi `--enviados --para
  katiasalvador32@gmail.com`, que é read-only e é o que o próprio incidente pedia pra
  confirmar antes de escrever pra ela.
- Não escrevi código: o fix do item 2 virou card pro coder, com PR base main.

## 8. Ferramentas desta ronda

Em `_Bugs/` (fora do git, uso único): `2026-08-20_ronda_16h40_fila.cjs` (fila paginada
+ fechados recentes), `..._vozes.cjs` (estado dos 2 + varredura da classe),
`..._destrava.cjs` (o fix, com ensaio e `.select()`), `..._katia.cjs` e
`..._katia_treino.cjs`, `..._pagante_sem_voz.cjs`, `..._os_tres.cjs` (arquivos
primeiro), `..._vitimas_naoaudio.cjs` (**detector reprovado**, ver 4),
`..._confere_e_abre.cjs`.
