# Ronda das falhas — 21/09 ~21h55Z (Frank, dono da fila)

**Passos fixos:** reconciliação de envios · percepção travada · medição da fila
(+ 2-B saída × assinatura). **Item serial herdado:** `#517`
`dd1764e9-88e4-40fa-9e1d-01058af4e678` — *"A CASA DIZ AO ALUNO QUE ESTORNOU E O
ESTORNO NAO ESTA NO LEDGER"*, aberto hoje 20:49:49Z, `investigating`.

**O que NÃO fiz:** não creditei ninguém (a nota do próprio `#517` manda não
creditar, e a medição abaixo confirma que não há a quem); não mandei e-mail a
aluno; não postei no grupo (só `--seco`, ver §5); não mexi em acesso, plano,
GPU nem migration; não fechei o `#517`.

---

## §0 — A armadilha que quase comeu esta ronda: worktree parado

Antes de medir qualquer coisa, conferi em que árvore eu estava. **As duas
cópias óbvias estavam podres:**

| checkout | branch | atrás de `origin/main` |
|---|---|---|
| `Projects/lucasarrial` | `feat/resumo-diario-grupo-suporte` | **779 commits** |
| `wt-main` | (detached) | **602 commits** |
| `.cache/worktrees/vigia-5f9c693f` | `main` | 99 commits |

Isto **já matou uma medição desta mesma série**: `aafd731a` ("o teto subiu em
15/09 e eu reportei 'intocado' lendo worktree parado"). Rodar `percepcao_travada.cjs`
dali seria pior que não rodar — o script levou **duas correções hoje** (21/09,
rondas 18hZ e a da nota), e a versão de 779 commits atrás é justamente a que
varre `agent_notes::text` inteiro e devolve os **41 falsos positivos**.

Resolvi criando `wt-ronda-517` destacado em `origin/main`, com
`frontend/node_modules` e `frontend/.env.local` **symlinkados** da instalação
canônica (os dois são gitignored, então não viajam com o checkout). Não
disputei a branch `main`, que está presa no worktree do Vigia.

⚠️ **Achado colateral, e é da classe do "quase-acidente" já registrado em
`04442c30`:** a 12ª medição da promessa do Vídeo Clone (`fddb5fbc`, de hoje)
está **só** em `origin/feat/resumo-diario-grupo-suporte`. `git branch -r --contains`
não devolve `origin/main`. O log de ronda de hoje **não está na main**.

---

## §1 — Passo fixo: reconciliação de envios

Rodei o **irmão de leitura**, que é instrumento independente
(`2026-09-18_enviados_x_tabela.cjs`):

```
caixa "Sent": 973 uid(s) na busca, 973 com cabeçalho lido
tabela:       896 linha(s) desde 2026-09-14 14:06:31Z
casadas por Message-ID: 896 · por destinatário+janela 10min: 4
registro local (#210, APPEND falhou): 0

🕳️  CARTAS NA PASTA SEM LINHA NA TABELA: 0
── AINDA ABERTO — DEPOIS do corte: 0
>>> VEREDITO: o buraco é PASSIVO.
```

**0 carta depois do corte** — que é exatamente o veredito que a ordem exige.
Não rodei o `--confirmar` do reconciliador porque **não havia linha a remontar**:
o controle compensatório está em dia nesta ronda.

As **73 cartas anteriores a 14/09 14:06:31Z** seguem sem decisão, como a ordem
já registra. Continua sendo decisão de produção (`cobreDesde` em
`contato-tentativas.ts`), não de ronda.

---

## §2 — Passo fixo: percepção travada

`percepcao_travada.cjs`, controle positivo OK (#310 reencontrado), **503
incidentes varridos**:

```
👁  SO PARAM POR FALTA DE VER/OUVIR/ASSISTIR: 6  (investigating 4 · aguardando_aluno 2)
>>> mais velho parado ha 6.4d
```

| card | status | parado | aluno | leitura |
|---|---|---|---|---|
| `#406` | `aguardando_aluno` | 6,4d | drrodrigoribeiro7 | ⚠️ **rótulo mente** — a bola é da CASA |
| `#455` | `aguardando_aluno` | 4,1d | consultornovoolhar14 | ⚠️ **rótulo mente** — a bola é da CASA |
| `#450` | `investigating` | 3,4d | jkakorio / jkakoalves | já triado: **não** é percepção (casou pelo texto) |
| `#216` | `investigating` | 0,1d | fabianabedin2016 | respondida 19hZ, nota fresca |
| `#214` | `investigating` | 0,1d | zicasantos37 | pedido de olho humano no grupo, nota fresca |
| `#517` | `investigating` | 0,0d | (5 endereços) | é o item serial desta ronda — §4 |

**Os dois de 6,4d e 4,1d são o passivo real** e são exatamente o defeito que a
ordem de 17/09 nomeia: `aguardando_aluno` mentindo sobre quem deve o próximo
passo. Ficam nomeados aqui; o despacho (`olho` para imagem/vídeo/áudio) é a
próxima ação da classe e **não** o inventei como feito.

---

## §3 — Passo fixo: medição da fila

`varredura_travados.cjs` (código de hoje, não o de 779 commits atrás):

```
📋 INCIDENTES ABERTOS: 101
⏳ AGUARDANDO ALUNO:    32   (não é fechado — a bola está com ele)
🧾 training_jobs obsoletos: 1  (voz já ready; escrituração pendente, ninguém esperando)
🚨 ACESSO VIVO, COM CRÉDITO E SEM NENHUMA VOZ PRONTA: 1
      hellengrasso@gmail.com · 95.375 cr · sem voz desde 06/09 (15 dias)
      voz 9bb9fccf [rejected_too_short] — recebeu 2 de 7 arquivos
```

**2-B — saída × assinatura** (`saida_x_assinatura.cjs`, obrigatório em toda ronda):

```
➡️  0 sangrando · 0 a revisar · 0 sem resposta da Hotmart · 41 já fora · 0 na coorte.
```

**Ninguém está sendo cobrado depois de ter pedido pra sair.** O bloco 🩸, que é
o único que exige ação automática pela 9-C, veio **vazio**.

---

## §4 — Item serial `#517`: a dívida herdada **não existe mais**

O título do cartão afirma *"2 casos PROVADOS (Katia #473, 400 cr; Lucas
Medeiros #224, 5.680 cr)"*. Fui conferir os dois **no ledger**, pelo único
padrão de prova que vale (ordem de 20/08): **`ref_type` casado COM o `ref_id`
do objeto cobrado** — nunca "o aluno tem estorno".

**Katia (`katiasalvador32@gmail.com`, `4899e0b3`) — PAGA em 19/09:**

| quando | kind | ref_type | ref_id | valor |
|---|---|---|---|---|
| 16/09 15:08:27Z | `generation` | `generation` | `019c58d1…` | **−400** |
| 19/09 11:29:20Z | `extra_purchase` | `generation_refund` | `019c58d1…` | **+400** |

Mesmo `ref_id`, **soma zero**. E não é caso isolado na conta dela: o par de
09/09 → 12/09 (`b6df1a7e…`, −400/+400) casa igual, e as quatro cobranças de
18/08 têm os quatro estornos de 19/08 casados um a um
(`5f88117a` −555/+555, `6a68c3ff`, `8b151335`, `c69905aa` −400/+400).
**Nenhum débito dela está sem o estorno correspondente.**

**Turbo / Lucas Medeiros — PAGO em 21/09 23hZ**, pela ronda anterior:
commit `d5b7db1d` *"a casa disse por escrito que tinha estornado 5.680 cr e nao
tinha — devolvido e aluno avisado"*.

> **Conclusão honesta: não há ninguém esperando dinheiro no `#517`.** As duas
> dívidas "provadas" do título estão liquidadas — uma antes do cartão nascer
> (19/09, dois dias antes das 20:49 de hoje), a outra pela ronda das 23hZ. O
> título ficou **defasado** e, lido de fora, cobra dívida que não existe.

Isso **bate** com a última nota do próprio cartão (21/09 21:26Z), que já dizia
`NAO CREDITAR NINGUEM` depois de reprovar os 3 abertos um a um: `#311` (ledger
vazio, dinheiro é da Hotmart), `#371` (estorno existe e casa, `image_refund_gate371`
+525 contra −525 no mesmo `ref_id`), `#446` (cartão **técnico** sobre
`refund.ts:33`, ninguém prometeu nada à Paula).

**O que sobra de verdade no `#517`** — e é só isto:
1. Os **18 pares** são piso de suspeita por heurística de palavra. Nos abertos
   deram **3 de 3 errado**. Os **fechados nunca foram auditados**.
2. O **detector** já está despachado ao `coder`, com os 3 falsos positivos como
   **controle negativo** e "estorno existe no aluno mas em OUTRO `ref_id`" como
   **controle positivo** — que foi exatamente como Katia e Turbo passaram
   despercebidos.

Não fechei o cartão: o levantamento sobre os **fechados** segue de pé, e quem
encerra isso é o detector com gabarito, não uma leitura minha.

---

## §5 — Grupo: **nada foi enviado**

A WAHA só escuta em `127.0.0.1` no servidor, então desta máquina **só sai
`--seco`** — e o playbook é explícito: *"mensagem no grupo não tem desfazer"*.

Além do meio, faltou **motivo**: a regra do recado é que ele carregue uma
**pergunta** e um número medido. Esta ronda não produziu pergunta para o grupo —
o `#517` não tem dívida a honrar, a fila não tem ninguém sangrando, e os dois
cards de percepção pedem despacho interno (`olho`), não olho de terceiro.
Recado sem pedido claro é a mensagem que todo mundo lê e ninguém responde.

**Portanto: 0 mensagem ao grupo nesta ronda, de propósito.**

---

## §6 — O que fica para a próxima ronda

1. **Despachar `#406` (6,4d) e `#455` (4,1d) ao `olho`** e tirar os dois de
   `aguardando_aluno` — o rótulo está mentindo sobre quem deve o passo.
2. **`hellengrasso@gmail.com`**: 15 dias, 95.375 cr, voz travada em
   `rejected_too_short` com 2 de 7 arquivos. É a classe do envio incompleto.
3. **Levar `fddb5fbc` para a `main`** — a 12ª medição do Vídeo Clone está
   presa numa branch `feat/`.
4. **`#517`**: aguardar o detector do `coder` e, com ele, auditar os
   **fechados**. Corrigir o título do cartão, que hoje cobra dívida liquidada.
