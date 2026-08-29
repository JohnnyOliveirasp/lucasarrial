# Rotina das Falhas — 29/08/2026, ~01h UTC (dono da fila)

Abertura: `git checkout main && git pull --ff-only origin main` → já atualizado,
árvore limpa. Índice de ordens lido antes de tocar em qualquer coisa. Ordens
aplicadas: `2026-08-20_dono_da_fila_e_fila_zerada.md` (14-A + armadilhas
medidas), `2026-08-27_vigia_so_erro_de_sistema.md` (14-C), regra 8 de 21/08
(serial + e-mail individual sem pedir permissão) e regra 7 (só fato consumado
no grupo).

Ronda anterior das falhas: 23h UTC (28/08). Vigia: 00h UTC (29/08).

---

## Placar

| | |
|---|---|
| Incidentes fora de `fixed`/`ignored` na abertura | 2 |
| Aluno para quem escrevi | **1** — Johnathan (`#173`), Enviados **uid 304**, 00:50:20Z |
| Incidentes que abri | **1** — **`#180`** (defeito técnico, 14-C) |
| Incidentes que anotei | **2** — `#173` (com resolução de verdade) e `#153` |
| Incidentes que fechei | **0** |
| **Código em produção** | **nenhum** — e digo por quê no §4 |
| Crédito que toquei | **nenhum** |
| GPU/retreino que disparei | **nenhum** |
| Migration | **nenhuma** |

---

## 1. A escolha do serial, declarada

Régua da regra 8: *o mais antigo com aluno afetado; empate, mais gente
sofrendo*. Antes de escolher, apliquei o **passo 1 do manual** ("já resolveu
sozinho?") nos 3 alunos que a varredura acusou em `ACESSO VIVO, COM CRÉDITO E
SEM VOZ PRONTA` — e os três caíram fora, cada um por um motivo diferente:

| aluno | idade | por que saiu do meu colo |
|---|---|---|
| **Marcelo** (`f6f82819`) | 19 d | **Único pagante de verdade dos três** (R$97 COMPLETE 12/08). Já medido em 25/08: o treino de 10/08 morreu em `[Errno 28] No space left on device`, o retreino de 25/08 **completou** mas o F0 provou 2 locutores (IQR 152 Hz, clone saiu 91,6 % em faixa feminina) — entregar seria dar a voz da entrevistadora. Estorno **confirmado por `ref_type=voice_train_refund`** (+10.000, 10/08 10:43), saldo 198.950 intacto. Avisado em 24/08 21:52. **Espera ele gravar.** |
| **Leandro** (`a6bc8184`) | 29 d | Mais antigo, mas **nunca pagou** (trial R$0; o R$97 está `OVERDUE`). Avisado em 25/08 00:47 (uid 67) com a medição completa: 8 dos 14 arquivos nunca chegaram, os 6 que chegaram somam 9min35s. **Espera ele reenviar.** |
| **Kelin** (`a046ede6`) | 16 d | Nunca pagou (2 assinaturas R$0 de 27/08). Avisada **três vezes**, a última **ontem 23:52Z**, com o número certo (19min34s, faltam 26s) e a correção do número errado que mandamos em 27/08. **Espera ela gravar.** |

Conferi cada um pelo `pagou_de_verdade.cjs` (Hotmart viva) antes de ordenar por
prioridade — `acesso vivo ≠ pagou`. Nenhum dos três tem passo pendente **do
nosso lado**, e nenhum ficou sem e-mail. Não reescrevi pra ninguém: seria ruído.

**Peguei então o `#153`** — não pela classe (o comportamento de re-fechar é
decisão do Johnny, já escalada 3×; pela regra 27 não escalo a quarta), mas pelo
**caso vivo dentro dele**: o **Johnathan (`#173`)**, que o Vigia apontou às
00h15Z com 8h30 de promessa sem retorno, **0 vozes** e conta zerada.

## 2. O que a leitura corrente do caso dizia — e onde ela estava errada

A leitura de todo mundo (Vigia 00h, e a minha ao pegar) era:

> *ele liberou o link às 15:58Z, **ninguém rodou a importação de novo**.*

Metade certo. A outra metade é a que importa: **reprocessar o mesmo link daria
exatamente o mesmo erro.** Não era falta de alguém apertar o botão.

Fui abrir o link dele antes de rodar qualquer coisa:

1. **O link funciona.** A pasta `Gravações para Youtube - OCG` abre normalmente.
   **O compartilhamento nunca foi o problema** — ou seja, o que ele consertou às
   15:58Z não era o defeito, porque a **nossa** mensagem mandou ele consertar a
   coisa errada.
2. **A pasta tem ZERO arquivos.** Ela contém **7 subpastas** (ABRIL 2026 - OCG,
   AGOSTO 2026 - MAESTRIA, EDITADOS - OCG, JULHO 2026 - OCG, JUNHO 2026 - OCG,
   MAIO 2026 - OCG, MARÇO 2026 - OCG) e nenhum arquivo solto. Várias são
   *shared folder* de **outros donos** (`ocontadorglobal`, `joosaturno@gmail.com`).
3. **Os arquivos dele existem, três níveis abaixo:**
   `Gravações para Youtube - OCG` → `AGOSTO 2026 - MAESTRIA` → `Vídeos Avulsos`
   → 3 `.mp4` (ACADEMY AD 65,1 MB · LAB AD 62,3 MB · SOLUTIONS AD 44,7 MB).

### A causa raiz, com `arquivo:linha`

`frontend/_Bugs/onboarding_planilha/_Code_final.gs:397`

```js
var files = DriveApp.getFolderById(folderMatch[1]).getFiles();
...
if (ids.length === 0) throw new Error("pasta vazia");   // :403
```

`DriveApp.Folder.getFiles()` devolve **só os arquivos filhos diretos** e **não
desce em subpasta**. Pasta organizada em subpastas ⇒ zero ids ⇒ `"pasta vazia"`.

**O sistema disse a verdade sobre o que viu.** O defeito é o que a mensagem
resultante manda o aluno fazer: abrir o compartilhamento. Ele conserta o
compartilhamento, reenvia o mesmo link, recebe o mesmo erro, e a culpa parece
dele. É o mesmo formato do `2c5bab42` e do caso da Kelin: **mensagem que culpa o
aluno por um limite nosso.**

## 3. O que eu fiz pelo aluno

**E-mail individual (regra 8, decido sozinho), Enviados uid 304, 29/08
00:50:20Z, bcc `suporte@`.** Endereço batido contra `profiles` **e**
`affected_emails` antes de mandar (armadilha do Cláudio Sityá). Ensaiado em
`--dry-run` e lido inteiro antes de sair.

Conteúdo: que o link dele funciona e o compartilhamento nunca foi o problema;
que a pasta enviada tem 7 subpastas e nenhum arquivo, e que o importador não
entra em subpasta; **onde estão os arquivos dele**; que mande o link da pasta
que tem os arquivos dentro; as **duas réguas certas** — 20 min somados de porta
de entrada e 10 min de fala limpa (**nunca repeti "10 min" como porta de
entrada**, a armadilha da Ivanilde); e que **não houve cobrança**.

**Aviso que incluí de propósito:** os 3 arquivos são peças de divulgação (AD).
Se tiverem trilha ou locução de outra pessoa, cai na armadilha **já medida no
Marcelo** — treino completa e o clone sai com a voz do outro. Preferi avisar
antes a deixar ele descobrir depois de esperar. Ofereci conferir o link **antes**
de ele gravar qualquer coisa.

**Dinheiro: nada a devolver.** Ledger conferido **por `ref_type`, nunca por
`kind`**: só 3× `-525 image (image_generation) avatar do onboarding`, que é o
negativo de onboarding autorizado pelo Johnny em 21/08. Saldo −1.575, **nenhum
débito de treino** (treino nunca rodou).

## 4. Por que NÃO subi fix nesta ronda — o código não está no git

A correção óbvia (descer nas subpastas, ou trocar a mensagem) **não pode sair
daqui**: o enumerador que roda é o **Apps Script da planilha, hospedado no
Google**. A cópia em `frontend/_Bugs/onboarding_planilha/` **não é versionada**
(`git ls-files` não devolve nada pra esse caminho) e **não deploya**. Mexer no
Apps Script de produção é ação externa e precisa do "pode" do Johnny.

Registrei as duas correções possíveis no `#180` sem escolher — não é decisão
minha sozinho:
1. **descer nas subpastas** (`getFolders()` recursivo, com teto de profundidade
   e quantidade) — resolve de vez;
2. **manter sem recursão e trocar a mensagem** ("abrimos a sua pasta e ela tem N
   subpastas e nenhum arquivo solto — mande o link da pasta que tem os
   arquivos") — barata, e mata o loop, que é o estrago maior.

**Não escrevi fix que não pode ir pra produção.** Card "completed" não é
produção, e patch em arquivo não versionado é pior: parece entregue e não é.

## 5. `#180` aberto — e as 3 checagens da 14-C §3, escritas

1. **Já existe?** Procurei nos **171** chamados (aberto **e** fechado) por
   pasta/drive/subpasta/vazia/import. O mais próximo é o `#173` (o caso do
   aluno, atendimento, já fechado) e o `#144` (OneDrive 401, outra causa,
   fechado pelo PR #60). **A classe técnica não existia.**
2. **Já foi corrigido?** Não há PR pro enumerador da planilha — o arquivo nem é
   versionado.
3. **Dinheiro?** Não envolve. Conferido por `ref_type` no ledger do aluno.

**Limite da minha medição, declarado:** abri a pasta pelo navegador **com sessão
Google**; o nosso importador é **anônimo**, então **não afirmo** que os arquivos
das subpastas seriam baixáveis por ele. O que está provado é que o **primeiro
nível tem zero arquivos** — e isso sozinho explica o `"pasta vazia"` e independe
de sessão. **Não medi quantos outros alunos caem nisto; n=1 confirmado.** Antes
de dimensionar o conserto, vale contar quantas linhas da planilha morreram com
`"pasta vazia"`.

## 6. O que isto acrescenta ao `#153` (anotado lá)

O chamado já catalogava três modos: (a) aluno sem resposta; (b) promessa de
retorno humano sem dono (Vigia 16h); (c) aluno respondido com resposta **errada**
e ninguém revisa (`#167`, ronda das 23h).

O Johnathan é um **quarto modo, e o mais silencioso**: a promessa ficou sem dono
**e o passo prometido não ia funcionar**. O auto-fechamento não remove só o dono
da resposta e o dono da conferência da resposta — **remove o dono de descobrir
que o próximo passo está quebrado**. O caso constava "resolvido" no `/admin`
desde 16:00:26Z, ninguém reabriu o link, e um defeito de enumeração ficou 2 dias
invisível com um aluno zerado em cima dele.

Não fecho o `#153` (regra 14): `entregar.ts:73-118` fecha e
`help/route.ts:151-158` não fecha e reabre. Segue com o Johnny.

## 7. Processo: o grupo continua mudo nesta máquina

`avisar_grupo.cjs` depende de `WAHA_API_URL`/`WAHA_API_KEY`, que não existem
aqui (WAHA roda em `127.0.0.1` no servidor). É a **quinta** ocorrência
registrada (Vigia 18h, rondas 19h40, 21h e 23h, esta). Os fatos consumados desta
ronda **não chegaram ao grupo por lá**; foram por Telegram. **Não digo que
avisei no grupo, porque não avisei.** Pela 14-C isto é processo: 1 linha aqui +
Telegram, sem chamado.

---

## Pro Johnny — o que é decisão dele

1. **`#180`: liberar o conserto no Apps Script da planilha.** É o único jeito de
   isto sair do papel — o código roda no Google, não no nosso repo. A opção
   barata (trocar a mensagem) mata o loop sozinha.
2. **Vale medir o tamanho da classe.** n=1 confirmado, mas ninguém sabe quantas
   linhas da planilha morreram com `"pasta vazia"` desde sempre. Se ele quiser,
   na próxima ronda eu conto.
3. **`#153`** segue sem resposta desde 24/08. A evidência acumulada agora tem:
   1 chargeback (`#154`), 1 pagante com duas respostas erradas (`#167`) e agora
   1 aluno zerado cujo próximo passo estava quebrado (`#173`).

## O que eu NÃO fiz

- Não rodei o import do Johnathan: **daria "pasta vazia" de novo**, e eu sabia
  disso antes de rodar.
- Não gastei GPU, não disparei treino, não cobrei nem devolvi crédito de
  ninguém, não toquei em acesso nem em assinatura.
- Não apliquei migration.
- Não reescrevi pros 3 alunos que já tinham e-mail correto e recente.
- Não li a caixa do `suporte@` pra triagem; só `--de` e `--enviados --para` nos
  endereços dos casos que eu estava tratando.
- Não fechei, não reabri e não reclassifiquei nenhum incidente.

---

## Fim de ronda — conferência fixa

```
git fetch origin
git log --oneline origin/main..HEAD   → VAZIO
git rev-parse --abbrev-ref HEAD       → main
git status --short                    → limpo
git branch / git rev-list main..<br>  → nenhum fix preso em branch
```

Não houve código nesta ronda (§4), então não há PR nem branch a conferir — e
**isso está dito no placar como "nenhum", não maquiado de entrega**. Este log vai
**direto na `main`**.
