# Ronda das falhas — 21/09 ~13h40–14h10Z

Ronda dentro da janela do turno (08h–23h BRT). Alvo serial: **#438 `0c9eee9f`**,
a porta de entrada — 536 contas, 16 alunos hoje do lado de fora, o mais velho
há 14,5 dias.

**Dois fixes em produção, um aluno pagante escrito, zero GPU, zero crédito
tocado, zero migration.** O cartão **não** fechou, e a seção 6 diz por quê.

Ordem de 29/08 respeitada: nada da planilha foi lido, escrito ou reprocessado.
Canal (ordem de 31/08): **postei no grupo**, 3 linhas, só fato consumado — dois
fixes em produção e uma carta a aluno, que é exatamente o que a regra 7 manda ir
pra lá.

---

## 1. Passos fixos

**Reconciliação dos envios** (passo fixo desde 18/09):

| | |
|---|---|
| lidas da pasta `Sent` | 913 |
| já tinham linha | 836 |
| fora da janela (`--corte`) | 77 |
| **RECUSADAS (defeito)** | **0** |
| **escrituráveis dentro da janela** | **0** |

Fecha 913 = 913. Irmão de leitura independente
(`2026-09-18_enviados_x_tabela.cjs`): **0 carta depois do corte** fora da tabela,
veredito "o buraco é PASSIVO". As 77 anteriores a 14/09 14:06:31Z seguem sem
decisão (inalterado desde 18/09).

Nota de saúde: a pasta foi de 905 → 913 desde a ronda das 13h, e as 8 novas
**já tinham linha**. O ledger está sendo escrito na hora; a reconciliação não
precisou escriturar nada.

**Fila:** 93 abertos, 40 com 7d+ (igual às 13h — eu também não fechei cartão).

---

## 2. O bloqueio do alvo era FALSO, e esse é o achado da ronda

A nota de 19/09 00:48Z deste cartão encerra com:

> "não mergeei o #346 (**janela de merge segue sendo pergunta aberta ao
> Johnny**)"

Fui ler a regra antes de repetir a frase. A **9-B** diz, na tabela de plantão
autônomo:

> | Corrigir bug de código | **você** revisa e mergeia (ver 14-B) |

e a **14-B** diz:

> ⚠️ O Johnny **não vai revisar merge** (estrada, a partir de 24/08).

Só **migration** precisa do aval dele (regra 21), e nenhum dos dois PRs tem DDL.

**O conserto passou 3 dias esperando uma autorização que as regras da casa dizem
que não existe.** E não era um caso isolado: o Vigia das 14h de 20/09 já tinha
escrito que a porta de entrada tinha **4 PRs parados** (#371, #346, #343, #324)
"enquanto esperam aval", e tratou isso como processo, não como defeito.

É a mesma doença que a ordem de 17/09 matou para percepção — *"precisa de um
humano olhar" não é estado de parada, é despacho* — reaparecendo na forma de
merge. Registro como lição minha, não como desculpa: a frase "esperando aval"
tem que vir com o nome da regra que exige o aval, senão ela é só uma parada
inventada com cara de zelo.

---

## 3. Antes de mergear, a prova que faltava: contra o domínio de PRODUÇÃO

Os dois PRs declaravam a própria ressalva com honestidade — as pernas [2] e [3]
tinham batido num `next-server` **local**. Fechei a lacuna antes de mergear,
porque `tsc` verde não é revisão (14-B) e medição em localhost não prova
produção.

Conta da **casa** (`suporte@fastcloner.com`), nenhum aluno tocado, **token
FRESCO em cada caminho** — a armadilha está escrita no cabeçalho do próprio
módulo: reusar o mesmo token faz o conserto certo parecer quebrado.

**`type=recovery`, em `https://fastcloner.com`:**

| | resultado |
|---|---|
| [A] `action_link` | 303 → `/auth/callback?next=%2Freset-password#<FRAGMENTO>` · token na QUERY? **NÃO** |
| | callback 307 → `/login?error=missing_code_or_token` · Set-Cookie **NÃO** |
| [B] `token_hash` na QUERY | 307 → `/reset-password` · Set-Cookie de sessão **SIM** |

**`type=magiclink`** (o tipo do botão do suporte, que a cicatriz da casa nunca
tinha testado), mesmo domínio:

| | resultado |
|---|---|
| [A] `action_link` | 303 → fragmento → `missing_code_or_token` · cookie **NÃO** |
| [B] `token_hash` | 307 → `/app` · cookie **SIM** |

O defeito estava **vivo em produção hoje**, no domínio real, nos **dois** tipos.
Não era artefato de ambiente local.

---

## 4. O que subiu

| PR | merge | o que conserta |
|---|---|---|
| **#346** | `9a999f4f` | O link que vai **pro aluno**: módulo novo `lib/auth/link-de-acesso.ts`, o caminho que carimba o recovery na criação da conta (`sgp-boas-vindas-canal.ts`), o endpoint de admin e as 2 ferramentas CommonJS |
| **#371** | `6a478bc5` | O botão **"Entrar na conta do aluno"** do suporte |

O **#371 era mais urgente do que o cartão dele dizia**, e isso ninguém tinha
escrito: o **#370** pôs esse botão em produção, e até hoje **cada clique do
suporte queimava a chave de uso único do aluno** e jogava o atendente em
`missing_code_or_token`. A casa estava trancando aluno com a própria mão de
atendimento.

**Conferências antes de cada merge:** merge da `main` **dentro** do branch,
limpo; testes 9/9, 49/49 e 10/10; `tsc --noEmit` exit 0 sobre o resultado
**integrado**, não sobre o branch solto.

**Confundidor que fui checar de propósito**, porque é a cicatriz que mais voltou
nesta casa (`feat/onedrive-401`, `feat/fix-image-upload-retry`, as 2 da cura de
referência, `fix/trava-foto-nova-8379549c`): **nenhum dos dois estava STALE.**
A `main` andou **116** commits desde a base do #346 e **46** desde a do #371, e
**ZERO** desses commits toca **qualquer um** dos 6 arquivos. Não havia conserto
concorrente pra derrubar. Escrevi o número porque "não está stale" sem medida é
palpite.

---

## 5. Prova de que está em PRODUÇÃO (não "deploy verde")

`Deploy Frontend (production)`: `9a999f4f` SUCCESS, `6a478bc5` SUCCESS. Mas
verde não é prova — conferi o **fonte no Hetzner** (`/mnt/volume/aiverse/frontend`)
contra `origin/main`, **4 de 4 md5 idênticos**:

```
8e3796d2b44cbd09c9c1f5dda9dc61c0  src/lib/auth/link-de-acesso.ts
65db66a61d8e29fd95401bc7831509a9  src/lib/sgp/link-entrada-pure.ts
04b94d05ef8bd4148691ac823001d1a9  src/lib/payments/sgp-boas-vindas-canal.ts
9576a2ff71d67c85c5a466814613392f  src/app/api/v1/admin/sgp/entrar/route.ts
```

---

## 6. Por que o cartão NÃO foi pra `fixed` (regra 14 inteira)

O título do #438 é *"A casa gasta a única chave do aluno no instante em que cria
a conta"*. São **duas pernas**, e só uma caiu:

- **(A) FORMATO** — o link nascia morto. **Corrigido e no ar hoje.**
- **(B) DESENHO** — o recovery segue sendo **carimbado na criação da conta**,
  com **1 hora** de validade, pra quem **não pediu**. Nenhum dos dois PRs tocou
  nisso.

Depois do (A), a perna (B) fica **nua**. Antes, "o aluno não entrou" tinha duas
explicações possíveis e **nenhuma medição separava as duas** — porque o
`action_link` não consumia o token nem quando o aluno clicava. Agora o link do
PUSH nasce válido, então o instrumento que a nota de 19/09 deixou escrito
finalmente **vale**:

| leitura | significado |
|---|---|
| token **CONSUMIDO** e sem login | ele abriu e quebrou depois → defeito que sobrou |
| token **INTACTO** e sem login | ele não abriu a tempo → **a janela de 1h é a causa** |

⚠️ Meça isso **só na coorte carimbada depois de 21/09 14hZ**. Misturar com a
coorte velha contamina o resultado. E **filtre `recovery_token not like
'pkce_%'`**: o `pkce_` não é limpo no uso e colhe zero falso — foi o 5º zero
falso da casa na semana.

Se vier majoritariamente **INTACTO**, o conserto certo é link sob demanda /
validade maior, e **mais formato não resolve nada**.

---

## 7. Um aluno levado até o fim (regra 8)

`iran@ogr.com.br`, **Iran Ferreira de Moura** — o mais velho dos 16 fora,
**14,5 dias**, pedido do SGP `pronto` desde 07/09, `last_sign_in_at` NULL.

⚠️ **O achado que muda o caso, e o erro que eu quase cometi.**
`pagou_de_verdade` neste endereço devolve **SEM PAGAMENTO**. Parar aí teria sido
o erro clássico que a própria ferramenta avisa. Procurei **por NOME**, como ela
manda:

| produto | data | valor | e-mail da compra |
|---|---|---|---|
| **Sistema de Geração Pronto** | 16/08 | **R$ 597** | `iranfmoura@gmail.com` |
| Fábrica de Conteúdo Invisível | 16/08 | R$ 297 | `iranfmoura@gmail.com` |
| Fábrica de Conteúdo Invisível | 31/03 | R$ 297 | `iranfmoura@gmail.com` |

É **pagante, R$ 1.191 no total**, trancado do lado de fora do que comprou. É a
classe #214/#218 (compra num e-mail, conta em outro).

**Não vinculei as duas contas** — vincular compra a conta é ato humano, e está
escrito assim na própria ferramenta. Perguntei a ele qual endereço quer manter.

Conferi `recovery_sent_at` **antes** de gerar (18/09 23:43Z, morto há 2 dias):
não apaguei link vivo de ninguém. Link novo no formato `token_hash`, conferido
por regex antes de entrar na carta (sem fragmento).

Carta enviada **13:55Z**, três pernas conferidas: **uid 3082** na pasta de
enviados + linha em `emails_enviados` (origem `ronda-manual`) + chave de dedupe
`porta-sgp-conserto-438`.

**O desenho da carta, de propósito:** o link **não é o herói**. O caminho
principal é **PULL** — *"responda com a palavra LINK e eu mando outro, a
qualquer hora"* — porque é a única mitigação que não depende de o aluno acertar
a janela de 1h, e a janela é justamente a perna (B), que continua aberta. A
carta diz que o saldo **−10.525** (classe #341) **não é dívida dele e não sai do
bolso dele**, **sem data**, porque eu não tenho data.

---

## 8. O que eu NÃO afirmo

- **Não afirmo que os 16 que estão fora vão entrar agora.** O conserto do
  formato só vale pra link **gerado de agora em diante**. Os links velhos deles
  continuam mortos — e os de Iran e Walsicleia **já tinham sido mandados no
  formato certo, na mão, em 18/09**, e mesmo assim não foram consumidos. Pros
  que já estão trancados, o (A) **não é a cura**; a cura é carta nova. Foi por
  isso que escrevi uma.
- **Não afirmo que o domínio carrega o código novo em RUNTIME.** O md5 prova o
  **fonte entregue**, e o pm2 recarregou no deploy. Não grepei bundle (falso
  negativo conhecido, prova de 02/09) nem forcei uma compra de SGP real pra ver
  a carta nascer certa. **A primeira compra de SGP depois das 14hZ é a prova de
  runtime** — quem pegar a próxima ronda pode conferir a carta dela.
- **Não afirmo nada sobre `last_sign_in_at`.** O `listUsers` não devolveu o
  campo na forma que eu esperava; o veredito das minhas sondas é o
  **Set-Cookie**, não ele.

---

## 9. Objeção que eu registro contra o meu próprio merge

O #346 e o #371 criaram **dois módulos que fazem a mesma montagem com contratos
diferentes**: `lib/auth/link-de-acesso.ts` **estoura**, `lib/sgp/link-entrada-pure.ts`
devolve `{ok, erro}`. Dois lugares pra consertar quando o formato mudar de novo
é exatamente como esta cicatriz se espalhou pra 4 arquivos.

Mergeei assim mesmo porque unificar antes atrasaria um conserto que estava
sangrando chave de aluno **hoje**, e duplicata correta é melhor que única
errada. Mas fica **nomeado para consolidação**, e prefiro isso escrito aqui a
ser descoberto por quem tropeçar nele.

---

## 10. O que fica nomeado pra próxima ronda

1. **A coorte pós-14hZ** (seção 6) — é a medição que decide se a perna (B) é
   real, e ela só existe a partir de hoje.
2. **Os outros 2 PRs da porta**: **#343** ("esqueci a senha" pelo SMTP da casa)
   e **#324** (reabrir o passo de ÁUDIO do SGP). Estavam na mesma lista de
   "esperando aval" do Vigia de 20/09 — e, pela seção 2, esse aval provavelmente
   também não existe. **Não mergeei porque não revisei**, e mergear sem revisar
   é o que a 14-B proíbe. Quem pegar: revisa e mergeia, ou anota a objeção.
3. **Os outros 15 fora da porta** — carta em massa precisa do "pode" do Johnny
   (regra 8). Individual, não.
4. **Consolidar os dois módulos de link** (seção 9).

---

## 11. O que eu NÃO fiz

Não mexi em crédito, carteira, acesso, entitlement nem plano de ninguém. Não
vinculei conta. Não gastei GPU. Não apliquei migration. Não mandei carta em
massa. Não liguei nem mandei WhatsApp (ação externa, precisa do "pode"). Não
fechei, não reabri e não marquei `fixed` cartão nenhum. Nada da planilha (ordem
de 29/08).

Status do #438: `open` → **`investigating`**, com a nota inteira gravada
(13 notas no array, concatenada pelo `anotar_incidente.cjs`, nunca sobrescrita).

---

## 12. Passo fixo de fim de ronda

Registro vai **direto na `main`**. Código de produção desta ronda: os dois
merges acima, ambos por PR com base `main`, ambos conferidos em produção por
md5. Nenhum fix ficou preso em branch — as duas branches foram apagadas no
merge (`--delete-branch`).

`git log --oneline origin/main..HEAD` conferido vazio após o push.
