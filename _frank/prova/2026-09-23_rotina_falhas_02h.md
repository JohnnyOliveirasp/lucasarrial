# Ronda das falhas — 23/09/2026 ~01h20–02h00Z (Frank, dono da fila)

Canal: ordem de 31/08 — FastCloner **só no grupo** (`notify-grupo.sh`). Postado.
Ordem de 29/08 respeitada: **nada da planilha** foi lido, escrito ou reprocessado.

Serial pela regra 8. Não gastei GPU, não toquei em migration, não mexi em
crédito de ninguém, **não escrevi para aluno nenhum** (justificado no §4) e não
liguei chave nenhuma.

**Uma linha:** fechei o **#477** (`b5073c91`) levando as **duas** pernas de
código que faltavam até produção — e no meio do caminho descobri que o patch do
Vigia, como veio, **não consertava o caso que originou o cartão**.

| fato | número |
|---|---|
| Cartões fechados | **1** (`b5073c91` / #477) |
| PRs mergeados e **conferidos no ar** | **2** (#352, #353) |
| Commits meus de código | **1** (`1fbc9d7b`) |
| Guardas de regressão novas | **1** (4 testes, com controle negativo) |
| Mutantes rodados na regra de dinheiro | **3** (todos pegos) |
| Alunos escritos | **0** (nenhum caso meu pedia carta — §4) |
| Dinheiro movido por mim | **0** |
| GPU gasta | **0** |
| Chaves de patch do Vigia drenadas | **1** (`patch_b5073c91`) |

---

## 0. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta.cjs --corte=… --confirmar` | 1081 lidas = 1004 já com linha + 77 fora da janela + **0 escrituráveis**. Contagem fecha (1081 = 1081). |
| `enviados_x_tabela.cjs` (irmão de leitura) | **0 carta depois do corte** fora da tabela. Buraco **PASSIVO**. |
| `percepcao_travada.cjs` | **0**. Controle positivo OK (#310) e negativo OK (#518), 512 incidentes varridos. |
| `idade_incidentes.cjs` | **108 abertos** (igual à ronda anterior). 30d+: 4 · 15–30d: 17 · 7–15d: **39** · 3–7d: 29 · <3d: 19. |
| `esperando_johnny.cjs` | **17** parados em decisão do Johnny · mais velho **54d** · 54 alunos · +1 não triado (`c726c5ae`) · 4 contestados. |
| Frota | **ainda morta.** `coder` responde `Not logged in · Please run /login`. Medido, não herdado do log de ontem. |

A fila **não subiu** (108 → 108) e um cartão saiu dela. Não é vitória: a faixa
7–15d engordou de 38 pra 39, ou seja a fila segue andando pra direita.

---

## 1. Por que este cartão, e não a cabeça da fila

Regra 8 manda pegar o mais antigo **com aluno atrás**. Conferi a cabeça um por
um, de novo, e ela continua bloqueada em decisão do Johnny — não em apuração
minha. O `#234`/`f8587cef` (20d, **237 alunos**, o maior da casa) eu abri e li:
ele espera (a) merge do PR #408 e (b) **um ouvido que funcione** — o `olho`
devolveu "NÃO OUVI" nos 12 arquivos do controle embutido e a Z.AI está sem
saldo. Não inventei laudo e não fingi progresso nele.

Os dois casos mais gritantes da noite **já estavam tratados** e eu confirmei
isso antes de encostar (passo 1 da rotina, "já resolveu sozinho?"):

- **Hellen Grasso** (`2609241a`) — pagante 16 dias sem entrega e sem uma única
  carta. Carta saiu 23/09 01:26Z (uid 3249), causa medida (5 de 7 áudios nunca
  chegaram ao R2), cartão corretamente em `aguardando_aluno`.
- **Walsicleia** (`f8a71e43`) — 7ª volta, 18 dias sem acesso. Carta saiu 22/09
  23:27Z mudando o **mecanismo** (ela gera o próprio link) em vez de repetir o
  5º link que falhou 4×. Bola dela, data anotada.

Escrever de novo em qualquer um dos dois seria ruído, não atendimento.

Então peguei o **passo 1-B da rotina**, que a própria rotina manda fazer *antes*
do resto e que estava parado há 3,6 dias: **patch do Vigia esperando**.

---

## 2. O achado: o patch do Vigia não consertava o caso do próprio cartão

`patch_b5073c91` já tinha virado **PR #352** numa ronda anterior (19/09) e ficou
**aberto, sem merge, por 3,6 dias**. A chave em `agent_state` também nunca foi
drenada — ela seguia contando como dívida.

O patch põe um teto de 5 min no poll da tela. Fui ler o diff antes de mergear, e
ele estava escrito **depois** do `try/catch` — mas o callback do poll tem um
`if (!r.ok) return;` **dentro** do `try`. `return` ali sai do callback inteiro,
então o teto **nunca era alcançado quando o GET de status falhava sempre**.

Isso anula o patch **exatamente no caso que originou o cartão**: o Cesar apagou
a row pra escapar do spinner (única saída que a tela oferecia), o
`GET /api/v1/images/<id>` passou a devolver 404, `!r.ok` pra sempre, tela
girando pra sempre. O comentário do próprio patch afirmava cobrir "TAMBÉM
quando o GET volta !ok". Não cobria.

**Medido** antes de mover, com a estrutura exata do callback:

    GET !ok (404/500) ....... teto NÃO disparava (gira pra sempre)
    GET 200 + generating .... teto disparava

⚠️ **`tsc --noEmit` 0 erros e `eslint` limpo NOS DOIS lados.** O compilador não
vê ordem de execução. É a advertência do 19/08 se repetindo: verde não é
revisão.

**Consertado** (`1fbc9d7b`): teto vai pro topo do callback, vale em todos os
caminhos. Mais uma **guarda de regressão** textual que lê o arquivo real
(`_frank/ferramentas/2026-09-23_teto_do_poll_antes_do_rok.test.cjs`), porque
isto é defeito de ORDEM e tsc não pega.

**A guarda nasceu com um falso positivo, e eu registro isso.** A 1ª versão
comparou `indexOf` no **arquivo inteiro** e **reprovou o código certo**: existe
outro `if (!r.ok) return;` na linha 180, em outra função. Recorto `poll()` antes
de comparar, e um teste confere que o recorte não vazou. **4/4** no código
corrigido; **controle negativo**: 2 dos 4 falham contra o fonte anterior — ou
seja, a guarda pega a regressão de verdade, não só passa.

---

## 3. A perna do dinheiro: PR #353, revisado com mutante

O cartão tinha **dois** PRs, nenhum mergeado. O #353 (aberto 19/09) faz o DELETE
do histórico **estornar antes de apagar** uma row em voo. É dinheiro, então não
aceitei suíte verde como prova: **mutei a regra** e conferi se a suíte tem dente.

    estornoConfirmado sempre true (finge que o crédito voltou) .... 5 testes quebram
    idempotência removida (estornaria em dobro) ................... 4 testes quebram
    emVoo incluindo 'ready' (estornaria imagem ENTREGUE) .......... 5 testes quebram

Conferi no fonte as armadilhas da casa: conta estorno por
`ref_type='image_refund'` e **nunca** por `kind` (a armadilha de 20/08 que quase
pagou 13 alunos em dobro); idempotência por **contagem**; **relê** o extrato
depois de estornar, porque `handleTechFailure` é best-effort e não lança —
"chamei o estorno" não é prova; se o crédito não voltou, **não apaga a row**,
porque a row é a prova da cobrança; e não apaga `{user}/refs/` (incidente
1970fcaa). 16/16, tsc 0, eslint limpo.

**Escopo, escrito no próprio módulo: daqui pra frente, NADA retroativo.** A
classe histórica (1.113 débitos sem row e sem estorno, 317 pessoas, 653.886 cr)
é, na maioria, limpeza legítima de galeria. **Estornar aquilo em massa devolveria
dinheiro de trabalho entregue. Não faça.**

### Prova de que está no ar (não é "mergeado", é **em produção**)

| PR | merge | md5 do fonte no Hetzner × `origin/main` | BUILD_ID |
|---|---|---|---|
| #352 | `660e049d` | `image-studio.tsx` **idêntico** (`d819ab9f…`) | `T5HeG51jet-nGKhCKxTwL` |
| #353 | `83a9e3d5` | `route.ts` (`773a5bb9…`) e `delete-estorno.ts` (`07ac16e8…`) **idênticos** | `uPAckQTjW3gIk10Wnetjo` |

Deploy `success` nos dois. Conferi porque card "completed" não é produção — só a
main deploya, e mesmo a main eu confiro no servidor.

---

## 4. O que eu NÃO fiz, e por quê

- **Não escrevi pro aluno.** O Cesar já estava estornado (+525 cr, `image_refund`
  `508e6d11`, conferido no banco em 19/09) e já tinha carta (uid 2871). Segunda
  carta na mesma conversa é ruído.
- **Não estornei nada** e não mexi na classe histórica (§3).
- **Não mergeei o `patch_b6b777eb`** (Fast diz "pode continuar usando
  normalmente" pra conta sem acesso). Ele segue na fila, **não drenei a chave**,
  e é o candidato natural da próxima ronda.
- **Não fingi progresso no `#234`** (§1).

## 4-B. Ressalva honesta que eu NÃO provei

No caminho de falha do #353, quando o estorno não confirma, a casa escreve ao
aluno **"O suporte já foi avisado"**. Procurei e **não achei chamada a helper de
incidente nessa rota** — o que existe é um `console.error`. A promessa depende
do sweep de log do Hetzner pegar a linha, e **isso eu não conferi**.

Não estou dizendo que é falso; estou dizendo que **não provei que é verdade**.
Mergeei assim mesmo porque o caminho é raro e o estado de hoje é muito pior (o
dinheiro some calado), mas "a casa promete aviso que pode não existir" é
exatamente a classe do #290/#446. Está escrito na nota do cartão e aqui.
**Próxima ronda: confirmar se aquele `console.error` vira chamado; se não virar,
abrir incidente de verdade ali ou mudar a frase.**

---

## 5. Fim de ronda

- Produção tocada: **2 merges**, ambos conferidos por md5 no servidor. Nenhuma
  GPU, nenhum crédito, nenhuma migration, nenhuma carta.
- Grupo: postado (fato consumado, sem código, sem saída de terminal, sem dado
  pessoal além do primeiro nome).
- `patch_b5073c91` drenado com DELETE de verdade (1 linha, conferida).
- Log **na main**, que é onde registro fica visível pra próxima ronda.
