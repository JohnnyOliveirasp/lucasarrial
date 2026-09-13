# 13/09 — Video Clone: medido pela 5ª vez. Não escrevi aos alunos.

Mesmo roteiro chegou em **07/09, 08/09, 11/09, 12/09 e hoje**. Remedi do zero —
não copiei número nenhum de ontem.

**Resultado: cura confirmada e mais larga. Não escrevi aos sete. Não postei
notícia de apagão. Não disse ao Lucas que a Renata pediu. As QUATRO condições
do roteiro continuam falsas. Uma coisa nova apareceu: um PR parado há 24h.**

## 1. A cura, medida hoje (13/09 15:01Z)

| conjunto | linhas | MP4 REAL no R2 |
|---|---|---|
| `ready` nas últimas 24h | 37 | **37** (0,96–21,13 MB) |
| `failed` (contraprova, base inteira) | 79 | **0** (78 ausentes, 1 sem caminho) |

- Última entrega materializada: **13/09 13:51:17Z** (~70 min antes desta medição).
- Últimos 9 dias: **433 `ready`**, e **as únicas 24 `failed` são todas de 05/09**.
- **ZERO tentativas seria não-prova. Não é o caso.**

### 1-A. O instrumento foi auditado ANTES de eu acreditar nele
37/37 ✅ é exatamente o que um instrumento cego devolveria. Escrevi
`_Bugs/2026-09-13_contraprova_instrumento_r2.cjs`: o **mesmo** `HeadObject`
apontado pras linhas `failed`, que eu SEI que não entregaram. Voltou **0 de 79
com arquivo**. O instrumento **distingue** — logo o 37/37 é medição, não eco.

## 2. Falha se conta pelo DINHEIRO, nunca pela tabela

A tela deixa o aluno apagar o vídeo que falhou, e isso **apaga a linha**. O
ledger não apaga:

| instrumento | falhas | alunos |
|---|---|---|
| `video_clones.status='failed'` | 24 | 6 |
| `credit_transactions.ref_type='video_clone_refund'` | **53** | **9** |

O PASSO 1 do roteiro ("consulte `video_clones`") mede bem o SUCESSO e é **cego
pro lado da falha** — perde 3 dos 9 atingidos.

- **Último estorno de Vídeo Clone da história: 05/09 23:12:25Z.**
  → **183,8h (7,7 dias) sem um único estorno.** Ontem eram ~160h.

## 3. As quatro premissas do roteiro — todas continuam falsas

1. **"se o apagão passou de 24h, é notícia"** → **não passou: 8h25m27s**
   (05/09 14:46:58Z → 23:12:25Z), 53 falhas, 9 alunos, 200.350 cr devolvidos.
   Encerrado há 183,8h. **Não existe notícia, então não postei notícia.**
2. **"o volume do RunPod está vazio/parcial e depende de humano com console"**
   → **falso agora.** `GET /v2/9get7wv7trn3wg/health`: **0 unhealthy, 0 na
   fila, 3.571 completed**. E 37 entregas com arquivo conferido em 24h. Nenhum
   humano precisa abrir console nenhum.
3. **"o PR da trava `feat/video-clone-manutencao`"** → **não existe.** Não está
   em `gh pr list --state all` nem em `git ls-remote --heads origin`. Não há
   decisão de merge a cobrar, e a condição ("se o apagão continuar") é falsa.
4. **"PR #190 (d1ce203d) subiu verde 17:47Z e não curou"** → confere. #190
   mergeado 05/09 17:25Z, não curou. Quem curou foi o **#192** (pin
   `transformers==5.14.1`), mergeado **22:45:35Z** — e a última falha da
   história é **23:12Z**, ~27 min depois. O encaixe é o esperado.

## 4. Por que NÃO escrevi aos sete

Conferi a pasta **Enviados**, um por um. Os sete **já receberam o "voltou" em
06/09**, e vários receberam **duas vezes**:

| aluno | avisado do apagão | avisado da volta |
|---|---|---|
| rafaluanravi29 | 05/09 15:28 | 06/09 00:36 **+ 01:08** |
| lux.neuropsi | 05/09 15:28 | 06/09 00:36 **+ 01:08** |
| pcezardireito | 05/09 15:28 | 06/09 00:36 |
| ederonline1 | 05/09 16:45 | 06/09 00:36 **+ 01:27** |
| smilefastrio | 05/09 19:27 | 06/09 00:36 |
| costa.anaelson | 05/09 20:28 | 06/09 00:36 **+ 01:08** |
| renatarcpsi | 05/09 20:28 | 06/09 00:37 |

Uma carta hoje seria a **3ª ou 4ª**, abrindo com *"prometi te avisar quando
voltasse"*, sobre um apagão encerrado há quase 8 dias.

O argumento mais forte não é o histórico, é o **uso**: dos 9 atingidos, **8 já
geraram com sucesso depois da cura**, com arquivo conferido no R2. Eles não
precisam ser avisados de que voltou — **eles já usaram**.

A promessa foi paga em 06/09. **Promessa cobrada 5 vezes não vira 5 dívidas.**

## 5. Os 9 atingidos (o roteiro nomeia 7)

O dinheiro mostra 9. Os 2 fora da lista do roteiro — `bilaherrmann@gmail.com`
(6 estornos) e `clayton@arcoiristintas.com` (4) — foram avisados e voltaram a
gerar. Remedido hoje: **nenhum órfão.** Era o risco real de obedecer a lista
ao pé da letra — escrever pros 7 nomeados e deixar 2 atingidos sem resposta.

## 6. Renata: não respondeu — e o filtro foi testado antes

- `ler_caixa --de renatarcpsi@gmail.com` → **"nada encontrado"**.
- **Controle positivo (hoje):** busquei `--de` por dois remetentes que eu tinha
  ACABADO de ver na caixa — `alicearnaldo@gmail.com` (achou uid 603) e
  `katiasalvador32@gmail.com` (achou 421, 422, 423, 431, 432). **O filtro
  funciona.** Logo o vazio dela é **ausência real**, não consulta quebrada.
- A condição do roteiro ("se ela respondeu, leve ao Lucas") **não se cumpriu**.
  Não vou dizer "a Renata pediu" — seria falso, e é exatamente a frase que
  compromete o Lucas numa compensação que ninguém pediu.
- **A premissa do roteiro também caiu:** o acesso dela não venceu em 06/09 —
  ela **renovou** (`subscription_grant` +100.000 cr em 06/09 14:13). Hoje:
  `active` até **30/09**, **137.660 cr**, e **2 vídeos gerados com sucesso**
  após a cura (06/09 00:41 e 13:48).
- **Mas o e-mail de 06/09 afirmou a ela que o caso foi levado adiante e que
  acompanharíamos até ter retorno.** Isso é dívida nossa, independente de ela
  responder. Já foi ao grupo em **07/09 e 08/09 — duas vezes, sem resposta**.
  Um 3º post queima a regra 27 (máx. 2 trocas). **Vai direto ao Johnny.**

## 7. O caso que sobrou: Anaelson

`costa.anaelson@gmail.com` — **o único dos 9 que não voltou**, e não é técnico:

- acesso **`active` até 29/09**, **153.759 créditos**, os do apagão devolvidos;
- **nada trava ele.** Não tenta desde **05/09 19:58Z**, quando levou a **6ª
  falha seguida**. São **8 dias** de silêncio (ontem eram 7). Último sucesso:
  03/09, antes do apagão.

Carta **pessoal com o dado dele** ≠ a genérica que recusei no §4 — mas é
retenção/comercial, então não mando sem sinal verde. Pedido no grupo em 08/09
sem resposta. **Repassado ao Johnny.**

## 8. O achado novo de hoje: o conserto de ontem NUNCA chegou em produção

Ontem (§6 da medição de 12/09) achei `listUsers({ perPage: 1000 })` sem paginar
em `frontend/src/app/api/v1/generations/route.ts:74` e abri card pro `coder`.

- O card `abb1152f` está **`completed`**. O `coder` fez o trabalho certo e abriu
  o **PR #251**.
- **Mas o bug ainda está em produção.** Fui ler o arquivo: o
  `perPage: 1000, "pra MVP basta 1 pagina"` continua lá. O PR está **OPEN desde
  12/09 15:12Z — 24h parado**.
- **Card "completed" com PR sem merge é `done` falso.** O trabalho existe, mas
  ninguém está protegido por ele. Regra 5: *PR parado é código que não protege
  ninguém.*
- A base cresceu pra **2.585 contas** → a tela de admin enxerga **38,7%** dos
  e-mails e chama o resto de vazio, sem avisar.

### Revisei o #251 eu mesmo (regra 14-B: `tsc` verde não é revisão)
Não aceitei a palavra do `coder`. Busquei o PR num worktree e rodei:

| verificação | resultado |
|---|---|
| `node --test auth-users.test.ts` | **8/8 pass** |
| **não-tautologia** (reinjetei o código antigo de 1 página) | **6 dos 8 QUEBRAM** |
| `tsc --noEmit` | só o erro **pré-existente** `resgate-audio.test.ts: vitest` (arquivo fora do PR) |
| `eslint` nos 3 arquivos | **exit 0** |

O teste que sobrevive ao código antigo é o da base que cabe numa página — que é
o comportamento correto. **Tenho convicção do patch.** O comportamento também
melhora no erro: antes entregava meio mapa em silêncio; agora entrega o mapa
inteiro ou nenhum, com log.

**Não mergeei.** O Johnny está no teclado hoje (foi ele que mandou o roteiro
agora), merge dispara deploy em produção, e ninguém pediu esse deploy hoje.
Está pronto, verificado, esperando uma palavra.

## 9. O que mudou desde 12/09

1. **+24h de estabilidade** (160h → 183,8h sem estorno), +37 entregas conferidas.
2. **O instrumento passou a ter contraprova própria** (§1-A) — ontem o 51/51 foi
   aceito sem auditar o medidor no mesmo dia.
3. **O RunPod foi medido vivo** (§3.2), em vez de herdar a afirmação do roteiro.
4. **Descobri que o conserto de ontem não saiu do papel** (§8). É o único item
   que exigia trabalho novo hoje.

## 10. A lição

**Fechar o card não é fechar o buraco.** Ontem eu achei um bug, abri card, o
`coder` fez tudo certo, o card ficou verde — e o bug seguiu em produção 24h
porque ninguém mergeou. Se hoje eu tivesse copiado a medição de ontem em vez de
reabrir o arquivo, o verde do board teria me convencido de que estava resolvido.

**O roteiro descreve o passado; o banco descreve o agora; e o board descreve o
que alguém disse que fez.** Os três precisam ser medidos, e só um deles é prova.
