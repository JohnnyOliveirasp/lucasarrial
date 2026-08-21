# Rotina das Falhas — ronda das 05h UTC de 21/08 (Frank, dono da fila)

Ordens lidas: `_frank/ordens/README.md` (índice) → `2026-08-20_dono_da_fila_e_fila_zerada.md`
(⭐ vigente) + `2026-08-20_fluxo_quem_olha_o_que.md` + `2026-08-20_correcoes_da_ronda.md`.

**Fila no início:** 6 abertos (todos `investigating`). **No fim:** 6.
**Fechados: nenhum** — e explico cada um embaixo.
**Entregue:** a causa do incidente mais antigo da fila **refutada e trocada pela certa**,
o fix escrito, testado, publicado (`045e8e1`, PR #22), e **1 aluna pagante que nenhum
detector nosso enxerga**.

---

## 1. O incidente mais antigo da fila (`2c5bab42`): a causa estava errada

Peguei o mais antigo (`first_seen` 19/07, 26 ocorrências), aberto pelo Vigia às 04:17 com
a causa apontada em `uploads-complete/route.ts` — "não compara slots emitidos × chaves
devolvidas". A nota do executor das 04:24 confirmou lendo os dois arquivos.

**Está errada.** Não por descuido de leitura: o código citado realmente não compara nada.
O que faltou foi perguntar se aquele caminho **consegue produzir o dado observado**.

```js
// voice-creator.tsx:349
const uploadedKeys = slots.map((s) => s.key);   // TODAS as chaves, nunca um subconjunto
// …e antes disso:
const failed = results.filter((r) => r.status === "rejected").length;
if (failed > 0) { setError(…); return; }        // aborta, nem chama o uploads-complete
```

O cliente **nunca** manda subconjunto, e se algum PUT falha ele **nem chama** o endpoint.
`git log -L` nessa linha: ela é assim desde o commit **inicial** (`727d461`). Logo esse
caminho não produz buraco — nem hoje, nem no passado.

### Quem produz é o RESGATE

`lib/voices/rescue-stuck-uploads.ts`. A aba fecha no meio do envio → a voz fica em
`uploading` → o sweep de 5min lista o bucket e grava **o que achou lá**:

```ts
const chaves = await audiosNoR2(voz.user_id, voz.id);   // só o que chegou
…
raw_audio_paths: chaves,
erro = `Áudio total ${…}min < mínimo de 20min`;          // e a culpa cai no aluno
```

Bate com tudo: com a medição do Vigia de que **o bucket tem exatamente o que o banco
lista** (consistente com o resgate, não com perda posterior), e com o próprio cabeçalho do
arquivo, escrito para o caso *"todos os arquivos chegaram e o browser morreu depois"* —
o caso *"só alguns chegaram"* nunca foi tratado.

**Lição de método, que é a mesma da ordem de 20/08 sobre o treino:** achar um código que
*poderia* causar o sintoma não é achar a causa. Prova é o caminho que **consegue** gerar o
dado que está no banco. Dois agentes cravaram o mesmo endereço errado antes de alguém
perguntar isso.

---

## 2. A medição, refeita por mim — e uma classe que ninguém reportou

Paginado na base inteira (848 vozes, `count: exact`, sem o teto de 1000):

| status | vozes | com buraco na numeração |
|---|---|---|
| `rejected_too_short` | 24 | **17 (70,8%)** |
| `awaiting_training` | 28 | **5 (17,9%)** ← não reportado antes |
| `failed` | 51 | 2 (3,9%) |
| `ready` | 722 | **2 (0,3%)** |

Confirma o Vigia (17/24 × 2/722) e acrescenta: são **26 vozes**, não 17. As **5 em
`awaiting_training` passaram na porta e vão treinar com áudio pela metade** — recorte que
nenhum detector olhava.

**Pergunta 1 da rotina ("já resolveu sozinho?") nos 9 alunos da classe:** 6 já resolveram
(`natali.marcio`, `erwintst`, `fabiobragaclone`, `catarinacouras`, `sidbae`,
`dirceu.moura.cruz78` — todos com voz `ready`). Sobram os **mesmos 2** da lista das 04h,
achados por um caminho independente. Duas medições diferentes, os mesmos dois nomes.

---

## 3. O fix — `045e8e1`, empilhado no PR #22

**Não precisa de migration**, ao contrário do que a abertura supôs: o índice do slot já
está **dentro da chave** (`buildRawAudioKey` → `.../raw/NNN_arquivo`), então maior índice
`006` = 7 slots emitidos. Nada a persistir.

- `contarSlotsDoEnvio()` — compara emitidos × chegados e separa *"nunca chegou"* de
  *"chegou truncado e caiu no filtro de 10KB"* (o resgate agora lista as duas coisas).
  Sem numeração legível devolve zeros, **nunca "não faltou nada"**.
- `mensagemEnvioIncompleto()` — assume a culpa e pede **reenvio**, em vez de mandar gravar
  mais, que era mandar o aluno repetir o que já fez.
- buraco vira `console.warn` **mesmo quando o aluno passa na porta assim mesmo** — sem log,
  essa classe ficou um mês invisível.

**Prova rodada contra o `raw_audio_paths` real dos dois, não contra exemplo inventado:**

> **antes:** `Áudio total 10min < mínimo de 20min`
> **depois:** `Recebemos apenas 4 dos 7 arquivos que você enviou — 3 não chegaram até nós
> (…) Não é que você gravou pouco — a MESMA gravação serve.`

`node --test` **18/18** · `tsc` limpo · `eslint` limpo nos 3 arquivos. Colisão conferida
**antes** de editar: só o PR #22 toca esses arquivos — por isso empilhei nele em vez de
abrir PR novo. Trabalhei em **worktree isolado** (`/tmp/wt-envio-incompleto`).

**Uma correção que eu mesmo peguei antes de subir:** a primeira versão da frase dizia
*"reenvie os arquivos que faltaram e o envio segue de onde parou"*. **O produto não tem
resume** — o aluno recria a voz do zero. Era promessa que a gente não cumpre, na mensagem
que existe justamente pra parar de mentir pro aluno. Trocada, e tem teste travando
(`assert.ok(!/de onde parou|retoma/i.test(msg))`).

**O que o fix NÃO faz:** ele não **impede** a perda do arquivo. Só para de culpar o aluno
e torna a perda visível. Impedir exige mexer no envio do browser (retry/retomada), que é
outro escopo.

---

## 4. 🔴 Uma aluna pagante que nenhum detector nosso enxerga

`casatumca@gmail.com` — **Kharen de Omulu**. Achei porque ela apareceu na classe do buraco,
não porque algum detector a listou.

| | |
|---|---|
| vozes | **9, zero `ready`** |
| créditos | **140.000** |
| compra | 2026-07-21 `active` |
| acesso | **SEM ACESSO** |
| contato | **nunca** |

**Ela é invisível porque todo detector de "pagante travado" filtra por acesso vivo** — e o
dela venceu. Não aparece na varredura, nem no `5c3f1f8b`, nem no `b9c5a0d1`. **Quem perdeu
o acesso é justamente quem esperou mais.**

E que ela pagou já está confirmado **por nós**, no próprio extrato:

> `2026-08-18 18:46 · +100000 · estorno_de_engano` — *"a varredura de trial zerou este
> saldo por engano. **A pessoa PAGOU (conferido na Hotmart).** Valor devolvido
> integralmente"*

Ou seja: em 18/08 devolvemos o **crédito** dela e não devolvemos o **acesso**.

O histórico é o pior da fila: **9 tentativas em 2 dias** (21–22/07). Das 5 recusas por
"áudio curto", 4 têm buraco — **2 arquivos chegaram de 8 slots, cinco vezes seguidas, em
90 segundos**. Isso **derruba a explicação "a aba fechou"**: ela tentou 5× e perdeu 6 de 8
em todas. As outras 4 vozes morreram em erro técnico nosso. Ela desistiu há um mês.

**Não agi e não reabro assunto fechado.** Destravar acesso é dinheiro/acesso de cliente
(só o Johnny), e as trancadas estão **ENCERRADAS** por ordem de 20/08 (status quo, não
reabrir). Registro como **fato**, não como pedido de destrave. O que é achado novo aqui é
o **furo do detector**, não o caso dela.

---

## 5. Os 6 incidentes — por que nenhum fechou

| id | o que mudou nesta ronda | por que não fechei |
|---|---|---|
| `2c5bab42` | causa **refutada e trocada**; medição 17→26 vozes; fix `045e8e1` | PR não mergeado = **não está em produção** |
| `b9c5a0d1` | 2 confirmados por caminho independente; **+1 aluna invisível** | os 2 seguem sem voz e sem contato |
| `5c3f1f8b` | conferido ao vivo: os 3 seguem `failed`, 0 `ready`, 0 gerações | esperando resposta / "pode" do Johnny |
| `ce6e157d` | **relógio: acesso da Katia vence em 31,2h** | veredito custa 1 geração = GPU = Johnny |
| `100e7ace` | sem material novo (Katia não gerou nada) | é do Claude; PR #16 ataca a classe |
| `07745f61` | irmão do `2c5bab42`, mesmo PR | mesmo motivo: PR não mergeado |

**Regra 14 respeitada: nada marcado `fixed` sem estar resolvido.** Código escrito e testado
não é código em produção.

---

## 6. Zumbi (fechado que continua disparando)

`1 de 66` — `acf8acd6`, 6 ocorrências depois do fechamento, **última há 76h**, nenhuma nas
últimas 48h. É o mesmo que a ronda das 04h já triou: a causa do james (`9c376c8`) está
curada e o defeito residual é rastreado no `07745f61`. **Segue `fixed`, sem ação.**
Nenhum zumbi vivo.

---

## 7. Saúde da produção

Últimas 6h: **16 gerações, 16 `ready`. 4 treinos, 4 `completed`. Zero falhas.**

---

## 8. O que está travado no Johnny

Sem mensagem nova por incidente (a ordem manda acumular). **Uma linha no grupo**, porque
um pedido que já está com ele **mudou de conteúdo**:

1. 🔴 **O texto do e-mail dos 2 pagantes está errado.** O aprovado-pendente diz "regrave
   até somar 25min". Medido agora: eles **não gravaram pouco** — 4 de 7 e 6 de 14 arquivos
   não chegaram. Se sair como está, mandamos 2 pagantes repetirem o que já fizeram.
2. **1 geração de GPU** pro veredito do piloto da Katia, antes de **22/08 12:00 UTC (31h)**.
3. **Merge do PR #22** (3 commits agora) — sem ele nenhuma das mensagens honestas chega
   em produção.
4. *(novo, sem pedido)* `casatumca` — pagante confirmada, sem acesso, 9 vozes mortas.
   Fato registrado; decisão é dele.

**Nesta ronda: nenhum e-mail enviado, nenhuma GPU gasta, nenhum crédito mexido, nenhum
acesso alterado, nenhuma migration.**

---

## 9. Passo fixo de fim de ronda

`git fetch` + `origin/main..HEAD` vazio + conferência de fix preso em branch: registrados
no commit desta prova.
