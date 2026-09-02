# Rotina das falhas — 02/09/2026, ~18:41Z

Ordens lidas antes de tocar em qualquer coisa: índice `ordens/README.md`, a ordem de canal de
31/08 (tudo do FastCloner vai no **grupo**), `2026-08-29_desligar_vigia_e_frank.md` (planilha
desativada) e `2026-08-20_dono_da_fila_e_fila_zerada.md`. Método serial (regra 8, 21/08).

## Placar

| | entrada | saída |
|---|---|---|
| abertos (`open`+`investigating`) | **5** | **4** |
| aguardando aluno | 10 | 10 |

**Fechei 1 incidente (`#220`), e ele estava resolvido de verdade.** O outro item da ronda
(`#235`) segue aberto de propósito, e a razão está no §2 — desta vez o conserto *existe* e eu
**mandei segurar**, com defeito nomeado.

## Ordem serial

O `#47` (Katia, o mais antigo) foi trabalhado às 17h45Z e a bola está **com ela** — regra 8:
esperar resposta de aluno não é estar travado. Segui para o **`#220`**, o mais antigo aberto
com aluno afetado.

---

## §1 — `b444afcb` / `#220` (Alana): FECHADO, com prova de produção

### O que era
`frontend/src/components/app/sidebar.tsx:32` → `<aside className="hidden ... lg:flex">`. A
sidebar era a **única** navegação do app e sumia inteira abaixo de 1024px, sem hamburger nem
drawer. O aluno de celular ficava sem Dashboard/Vozes/Vídeos/Imagens.

### O que foi feito
Commit **`eb55f4f`** — `mobile-drawer.tsx` + botão `Menu` na topbar + `useMobileNav`,
reusando a **mesma** árvore de navegação do desktop.

### Prova de que está no ar
Usei o método de 3 pontos de `2026-09-02_prova_de_deploy_grep_no_bundle_e_falso_negativo.md`,
**não** grep no bundle (que é falso negativo por minificação de identificador):

1. **Hash do fonte no servidor == main local**, byte a byte, nos 3 arquivos:
   ```
   93587c5b3c750421fb63193437089259  mobile-drawer.tsx
   6fb0a4c5ee6c3a990221da58195aca17  topbar.tsx
   90ce7eef22b1e145d8584e4181a6a3f5  sidebar.tsx
   ```
2. **`BUILD_ID`** `7TqyQ0plU2xjpdGvs8zv_`, mtime `2026-09-02 02:17:18Z` — **posterior** ao
   commit (`02/09 00:54:22Z`).
3. **pm2** `aiverse` e `aiverse-render` com uptime 16h → restart depois do build.

### Prova de uso, que vale mais que as três
E-mail **uid 424** (02/09 16:39Z), da própria aluna: *"gravamos agora novamente"*. Ou seja,
ela **alcançou Vozes → Gravador e gravou** — exatamente o que o menu sumido impedia.

Crédito conferido: **99.475 intactos**, nada cobrado. Avisada em 01/09 22:36Z (uid 445), com
confirmação dela.

### O que sobra não é deste chamado
O envio do treino continua travado — isso é o **`#235`**, defeito **diferente**. Isto responde
o **ponto 6 dos limites da ronda das 17h55Z**, que registrou não ter provado se `#220` e `#235`
eram o mesmo defeito: **não são.**

---

## §2 — `d48e6a45` / `#235` (Alana): NÃO fechei, e desta vez eu mandei SEGURAR o conserto

### O PR não andou sozinho
PR **#154** (`feat/gravador-nao-perde-audio`, `16bd72e`) continua **OPEN** às 18:41Z, **1h02**
depois de aberto: zero reviews, zero comments, `mergeable=UNKNOWN`, `statusCheckRollup` vazio.
`git log main..origin/feat/...` devolve o commit — **fora da main, fora de produção**. É a
**quarta** vez que a rotina registra "card `completed` não é produção".

### Mandei revisar antes de decidir (worktree em /tmp, main intocada)

**O que passa, medido e não chutado:**

| Check | Resultado |
|---|---|
| `npx tsc --noEmit` | exit 0, sem saída |
| `node --test entrega-gravador.test.ts` | **10/10** |
| suite completa | 247/248 — a única falha (`rajada-nasce-fechada.test.ts`, `ERR_MODULE_NOT_FOUND`) **reproduz igual na main**: preexistente, não é deste PR |
| i18n | as 13 chaves novas existem nos **3** idiomas, mesmos placeholders ICU |
| crédito / GPU / billing / contrato de API | **nada tocado** — `grep '^[+-].*fetch('` no diff = zero |

Nesse aspecto o merge é seguro. **O que segura são 3 defeitos concretos** (viraram o card
`2fd937d4` pro coder, no MESMO branch):

- **(a) CRÍTICO — o PR apaga a própria prova.** O `useEffect` novo do `voice-recorder` chama
  `marcarGravacao(clips.length, …)` com `clips = []` no mount, e `marcarGravacao(0, …)` faz
  `localStorage.removeItem`. **Só abrir o Gravador destrói a marca antes de `listClips()`
  resolver.** No cenário exato do incidente (leitura falha) a **vítima** é justamente quem
  perde o aviso informativo. O recurso principal do PR se auto-sabota.
- **(b) CRÍTICO — o caminho de erro novo pode nunca disparar no celular.** `clip-store.ts`
  **não foi tocado**. `saveClip` resolve em `req.onsuccess`, que é **antes do commit** da
  transação; `QuotaExceededError` no commit chega em `transaction.onabort`, e `tx()` só liga
  `req.onsuccess` / `req.onerror` / `t.oncomplete` — **não existe `t.onabort` nem
  `t.onerror`**. Abort de commit deixa a promise resolvida para sempre e o `.catch()` novo
  **nunca roda**. É o formato típico de falha por cota no iOS Safari e WebView Android antigo
  — ou seja, o mecanismo **mais provável** do "20 min gravados e sumiu", que é o caso dela.
- **(c) falso alarme numa tela que hoje funciona.** `removeFile()` apaga o clipe do IndexedDB
  mas `limparMarcaGravacao()` só roda no submit OK: quem importa os clipes e remove todos pra
  subir arquivo do disco recebe *"você gravou 8 áudios (22:14) e eu não achei essas
  gravações"* — falso e assustador.

Anotado **sem** virar bloqueio: o teto de 20 arquivos do backend conta clipes **+** takes do
celular juntos, mas `resumirEntregaDoGravador` isenta os segundos do celular e `startUpload`
não apara `files` — 20 clipes + 3 takes ainda libera a CTA e ainda toma **400** no treinar.

### Mudança de comportamento que eu aceito, mas registro
O PR troca `targetMet` de soma(**todos** os clipes) para soma(os **20 maiores**) + celular.
É **estritamente mais restritivo**. Com até 20 clipes o resultado é idêntico; quem tem mais de
20 **já está quebrado hoje** (ganha a CTA e cai num botão Treinar morto). **Não tranca
ninguém**: `/app/voice-cloning` e o `voice-status-panel` linkam `/new` por fora.

### O relato novo dela muda a hipótese — e eu NÃO fechei a causa
uid 425 (17:41Z): *"as novas gravações estão lá, mas não permitem o envio"*. Se os clipes
**aparecem** na lista, a escrita no IndexedDB pode ter funcionado e o bloqueio está no
**destino**. Na main existem **três** caminhos que produzem a **mesma** tela, com consertos
diferentes:

1. `voice-creator.tsx:147` `listClips().catch(() => {})` — leitura falha, `recorderImport`
   fica `null`, formulário **mudo**;
2. **teto de 20 arquivos** (`voice-creator.tsx:120-121` ordena por duração e corta em
   `MAX_FILES = 20`) — se os 20 maiores não somam `MIN_DURATION_SECONDS = 1200s`, o botão
   Treinar fica `disabled` (linha 647). ⚠️ mas nesse caso ela **veria** a frase
   `recorderImport.loaded`/`skipped`;
3. arquivo sem duração medida vale **0** no total.

**Não dá para distinguir do servidor**: nada dela chega no backend (zero linhas em `voices`).
Por isso pedi **um print** da tela "Nova voz" — ele separa os três em minutos.

---

## §3 — O que escrevi para a aluna (uid 463, cópia CONFIRMADA na 1ª tentativa)

A promessa do uid 462 (17:45Z) — *"alguém te acompanha passo a passo até a voz ficar
pronta"* — estava **1h sem dono**. Eu sou o time técnico; o contato prometido era meu.

- **"Não grave de novo agora."** O uid 460 mandou tentar outra vez e o uid 462 prometeu
  acompanhamento. Com o conserto fora de produção, seguir essa instrução a faria falhar pela
  **4ª vez**. Desmontei a instrução em vez de deixar a aluna agir em cima dela — é a mesma
  lição do `#47`: corrigir a **premissa falsa** que está por escrito na mão dela.
- **O print que eu preciso**, e o que cada resultado significa.
- **Os números da conta dela**, conferidos por mim: acesso até **08/09**, **99.475 créditos**,
  nada cobrado.
- **Reembolso dos cursos do Lucas**: com a equipe dele, não é minha alçada. Dito sem empurrar.
- **Nenhuma data prometida.** Disse que revisei o conserto hoje e mandei corrigir 3 problemas
  antes de subir.

### A chamada que foi minha, e que eu subo para o Johnny/Lucas
Ela perguntou **duas vezes** se falava com uma IA, e o uid 462 **desviou**. Confirmei que o
atendimento inicial é automatizado e que ela **acertou** ao apontar o erro da contagem de
dias. Ela mesma escreveu: *"se for isso não há problema algum, porém deveriam ser honestos"*.
Negar seria **mentir para a aluna**; calar pela terceira vez é o padrão que fez a Viviana
explodir. **Mas disclosure de atendimento é decisão de marca, não minha** — registrei no
grupo que a chamada foi minha e que, se a política for outra, eu paro.

---

## Limites da minha prova, ditos na cara

1. **Não reproduzi o defeito do gravador no navegador.** Toda a minha afirmação sobre o `#235`
   é **leitura de código** + o estado do banco (zero linhas em `voices`) + o relato dela. Não
   rodei a tela.
2. **Não sei qual dos 3 caminhos é o dela.** Listei os três e pedi o print justamente porque
   **não** vou cravar causa que não medi. A hipótese do card `c9d3e5d0` (`saveClip` engolido)
   ficou **mais fraca** com o relato de que os clipes aparecem.
3. **Os 2 defeitos críticos do PR #154 vieram de revisão de código, não de execução.** O
   `tsc`, os testes e o i18n foram **executados** (resultados acima); o `t.onabort` do
   `clip-store` e o wipe da marca no mount são **leitura**, verificáveis, mas não provados em
   runtime.
4. **Não existe CI que rode esses testes.** `.github/workflows/` só tem `deploy.yml` + 3
   workers, sem passo `node --test`. Os testes do PR são documentação, **não** portão de merge.
5. **`#220` fechado não significa a aluna destravada.** Ela segue presa no `#235`. Fechei o
   `#220` porque ele *está* resolvido e provado, não porque o caso dela acabou.
6. **A aluna não respondeu até o fim da ronda.** A bola está com ela (o print), e o item saiu
   do meu colo — mas o **card do coder** e o merge continuam sendo meus.
7. **`_frank/ferramentas/assinatura_em_dobro.cjs` segue untracked.** Não é meu e não é desta
   ronda. Registro em vez de commitar trabalho de outro agente em silêncio — 3ª ronda seguida.

## Registro de rotina

- `anotar_incidente`: `#220` `investigating → fixed`, notas **8 → 9**, `resolution_note`
  0 → 699 chars, `resolved_commit = eb55f4f`, **1 linha afetada**, conferido na releitura.
- `anotar_incidente`: `#235` nota **4 → 5**, status **inalterado**, **1 linha afetada**.
- Nada da **planilha** foi lido, escrito, classificado, avisado ou reprocessado (ordem 29/08).
- Grupo: postado com `notify-grupo.sh`. **Nada foi para o privado do Johnny** (ordem 31/08).
- Nenhuma GPU, nenhum crédito, nenhuma migration.
