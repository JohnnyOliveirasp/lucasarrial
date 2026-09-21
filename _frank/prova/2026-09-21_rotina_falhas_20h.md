# Ronda serial 21/09 ~20hZ — FastCloner

Serial (regra 8). Cartão do Mission Board: `a78011cd`.

**Resumo em uma linha:** o item serial (`#226`, 20,1 dias, ~160 alunos) não
precisava de decisão nenhuma para andar — o conserto que ele esperava **já
estava escrito desde 18/09 e apodrecendo num PR aberto há 3 dias**. Revisado,
mutado e mergeado (`94c2a825`). E o achado que muda o cartão: **o número que
sustenta a decisão de produto parada com o Johnny há 20 dias estava inflado
por defeito do nosso próprio comparador** — ele contava GRAFIA como palavra
sumida. A decisão foi devolvida ao grupo com o pedido de **não decidir esta
semana**, e sim re-medir depois do deploy.

---

## 1. Passos fixos

### 1.1 Reconciliação de envios — fecha, dois instrumentos concordando

`2026-09-18_reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar`:

| | |
|---|---|
| lidas da pasta "Sent" | 953 |
| já tinham linha | 876 |
| fora da janela (`--corte`) | 77 |
| recusadas | 0 |
| **dentro da janela sem linha** | **0** |

Contagem fecha (953 = 953). O irmão de leitura independente
(`2026-09-18_enviados_x_tabela.cjs`) dá o mesmo veredito: **0 carta depois do
corte** fora da tabela, e casa 876 por Message-ID + 4 por destinatário+janela.
As 77 pré-tabela seguem sem decisão.

*(952 → 953 desde a ronda das 19h; a nova já nasceu com linha.)*

### 1.2 Percepção — o mesmo 5, e a classe real continua ZERO

`percepcao_travada.cjs` (já com `aguardando_aluno` na varredura, PRs #390/#392
mergeados na ronda das 19h): controle positivo OK (#310 reencontrado), 502
incidentes varridos, **5 cartões**.

São **os mesmos 5 da ronda das 19h**, e os 5 já foram qualificados um a um
naquela ronda como **falso positivo** — `#450` ("NAO e caso de percepcao"),
`#406` ("OLHEI AS IMAGENS... NAO HA DEFEITO"), `#455` ("Audio LIBERADO"),
`#438` (perna que saiu do papel) e `#216` (percepção cumprida). Nenhum nasceu
novo nesta janela.

**Número honesto pro relatório: 0 cartão travado em percepção.** O 5 é ruído
do instrumento, e o defeito residual (o detector casa a NARRATIVA de percepção
cumprida, não o pedido pendente) segue como card de código `1f33c59e` no
`coder`, ainda `running` — não cobrei, porque foi aberto há ~2h.

### 1.3 Fila

**96 abertos**, **43 com 7+ dias** (era 95 / 42 às 19hZ: +1 nos dois).
`agent_state`: 2 patches do vigia e 140 recados `para_frank_*` pendurados.

---

## 2. O item serial: `#226` — 20,1 dias, ~160 alunos

`702cc916-882f-456f-9ff6-91fcc9bae1c4` · "ENTREGAMOS AUDIO QUE O NOSSO PROPRIO
QA REPROVOU: tts_qa/loop.py:341-344". Peguei por ser o mais antigo com aluno
afetado ainda acionável — o `#216` (mesma idade) foi fechado na ronda das 19h,
e no empate de idade a regra 8 manda pegar quem tem mais gente sofrendo.

### 2.1 O conserto não estava faltando. Estava parado.

A nota [53] deste cartão, escrita por mim em 18/09, termina com "DESPACHADO o
conserto da régua pro coder". **O conserto foi escrito**: virou o **PR #345**
(`feat/qa-canon-grafia`) em 18/09 20:19Z — e ficou `OPEN`, sem um único
update, até hoje. **Três dias.** Ninguém voltou pra buscar.

Regra 5: *PR parado é código que não protege ninguém.* Isto é o segundo achado
da mesma família em dois dias (ontem foi o PR #92 em draft há 23 dias). Não é
coincidência: **a casa despacha bem e recolhe mal.**

### 2.2 STALE — conferido ANTES de encostar

O branch estava **153 commits atrás da main** e mexia em
`runpod-worker/jobs/inference.py`, que a main **também** mexeu depois da base
(`4d814c7a`). Esta é a família que já derrubou fix em produção 5 vezes aqui.

Merge textual limpo **não bastava**, porque o PR muda `run_chunk_qa` de **5
para 6 valores de retorno**: se a main tivesse acrescentado um call site novo,
o auto-merge o deixaria desempacotando 5 e quebraria **em runtime, na GPU**,
sem teste nenhum pegando.

**Contei os call sites nos três lados** — base **3**, `origin/main` **3**,
árvore mergeada **3**, todos convertidos para 6. Não havia call site novo. Só
depois disso segui.

### 2.3 Revisão — em worktree próprio, não aceita do coder no escuro

| o que rodei | resultado |
|---|---|
| suíte na árvore **mergeada** | **357** testes · 3 falhas + 4 erros |
| **mesma** suíte na `origin/main` **limpa** | **315** testes · 3 falhas + 4 erros |

As falhas são **as mesmas dos dois lados** — ambiente sem ffmpeg (`atempo`),
não regressão. **Zero regressão do PR.** 315 → 357 = **+42**, exatamente o
`test_canon_qa`. Li o rodapé, não o exit code (lição das 8 de 8 SKIP do #259).

**Mutei o código dele, porque teste que passa nos dois lados não prova nada:**

| mutação | resultado |
|---|---|
| `expandir_falado` vira no-op | **33 de 42 morrem** |
| bloco `delete` deixa de gerar faltante (a propriedade de segurança) | **17 falhas** |
| a fraqueza que o **próprio autor declarou** no PR (`delete` olhando 3 palavras anteriores) | **passa OK** |

As 17 batem **exatamente** com o número que ele declarou no corpo do PR, e a
fraqueza que ele confessou **é real**. Ele falou a verdade sobre o próprio
furo — e o furo é de uma variação hipotética, não do código que subiu
(`range(j1, j2)` está correto).

**A propriedade de segurança se sustenta por construção, não por teste:**
grafia só nasce de opcode `replace` (o Whisper *ouviu* algo ali). Chunk mudo /
áudio que começa no meio — o defeito que este QA existe pra pegar, caso Katia
19/08 — vira opcode `delete`, onde `j1 == j2`, `livres` nasce **vazia** e toda
palavra continua faltante. **Não há afrouxamento do lado perigoso.**

### 2.4 Mergeado — e por que isso ainda NÃO está em produção

**`94c2a825`** (21/09 18:56Z). Build da imagem disparado (run `35641626569`).

⚠️ `runpod-worker/` sobe por **imagem própria**: merge na `main` **não prova
produção** — foi o achado do vigia em 02/09 10hZ e não vou repetir o erro.
Build anterior levou 41 min. **Enquanto não fechar verde, o conserto não está
no ar**, e o cartão segue `investigating` (regra 14).

---

## 3. 🔴 O que isso faz com a decisão parada há 20 dias

A decisão de produto (falhar sem cobrar / entregar avisando / manter) vem
sendo pedida ao Johnny **desde 01/09**, sempre em cima do número
*"44-50% das entregas saem com o QA esgotado, ~160 alunos"*.

**Esse número é produzido pelo comparador que acabou de ser consertado.**

Pela classificação do próprio PR sobre **1.037** faltantes reais em 572
gerações:

```
[A] some por construção (canon reescreve o token) ...   82    7,9%
[B] casa SE o whisper grafou o símbolo ..............  114   11,0%
[C1] forma plena: casa SE grafou a reduzida .........   31    3,0%
[C] não decidível pela telemetria ...................  810   78,1%
```

**Só o [A] é prova.** O ganho real é **maior que 18,9% e ninguém sabe quanto**
— a tabela `generations` não guarda a transcrição do Whisper, então **não
existe replay**. E o caso Katia, o único cujo áudio foi de fato **ouvido**,
cai no [C1]: as 3 "faltantes" eram 2× `ta`/`esta` e 1× `pra`/`para`, e o áudio
estava **inteiro**.

**Escalado ao grupo** (`ask_humans`, entregue) com um pedido incomum: **não
decidir esta semana.** Decidir (b) ou (c) agora é decidir sobre um número
inflado por fantasma de grafia, e derrubar entrega de aluno por isso sai caro
por pouco. O plano que fica registrado: quando o build fechar, re-medir
`exhausted>0` sobre gerações criadas **depois** do deploy contra a mesma
janela de antes. Se o patamar cair, a decisão dolorosa pode nem ser
necessária; se **não** cair, ela volta pra mesa com número limpo.

O que continua sendo do Johnny e eu não toquei: escolher entre falhar sem
cobrar e entregar avisando, e **estorno em massa desta classe, que passa do
meu teto de 20.000 cr** (regra 9-B).

---

## 4. O que eu NÃO fiz, de propósito

- **Não mudei o status do `#226`** — o worker segue entregando chunk reprovado;
  o comportamento não mudou, só a régua que o mede. Regra 14 é regra 14.
- **Não toquei em crédito, não estornei, não avisei aluno**, não gastei GPU e
  **não ouvi áudio nenhum** nesta ronda.
- **Não re-medi o efeito do conserto** — o build não fechou. Fica nomeado como
  o primeiro passo da próxima ronda.
- **Não cobrei o card `1f33c59e`** (detector de percepção) — aberto há ~2h.
- Não consultei a caixa do `suporte@` para triagem: a fila de `incidents`
  é a fonte.

---

## 5. Para a próxima ronda, na ordem

1. **Conferir o build `35641626569`.** Se verde, re-medir `exhausted>0` em
   gerações pós-deploy e comparar com a janela anterior — é o número que
   destrava (ou dissolve) a decisão do `#226`.
2. Se o build **falhou**, isso é urgente: o `94c2a825` está na main sem imagem
   correspondente.
3. **Varrer PR aberto por idade.** Dois achados em dois dias (#92 em draft há
   23 dias, #345 parado há 3) dizem que a casa despacha e não recolhe. Vale
   uma ferramenta, não mais uma nota.
4. `#f8587cef` (palavra decapitada, 609×, 237 alunos): a nota [53] deixou
   escrito que **quanto daquele 609 está inflado pela mesma régua** é pergunta
   aberta. Agora a régua está consertada — quem pegar re-mede antes de
   acreditar no 609.
