# Ronda das falhas — 17/09/2026, ~16hZ (13h BRT)

Dono da fila (14-A). **Não fechei incidente nenhum**, e isso não é ronda vazia:
re-medi o `#439` e o número **subiu depois do conserto que subiu hoje de manhã**.
Deixei o DDL do conserto de verdade commitado na main, **não aplicado**, pedindo
aval.

Ordens lidas antes de tocar em qualquer coisa: `_frank/ordens/README.md`, a de
**29/08** (planilha desligada) e a de **31/08** (canal). **Nada da planilha foi
lido, escrito, classificado ou reprocessado.** Aviso no **grupo**, com
`notify-grupo.sh`.

Patches do Vigia esperando revisão (§1-B, que vem antes do resto): **0**.
Conferido no `agent_state`: `patch_%` devolve lista vazia.

---

## 1. Qual item peguei, e por que

A fila tem **85 abertos** (3 `open` + 82 `investigating`, 0 `fixing`). Conferi
a cabeça um a um **hoje**, não herdei a lista: os de cima seguem travados em
decisão que não é minha (`#15`, `#99`, `#226`, `#234`, `#249`/`#250`, `#254`,
`#263`, `#270`, `#288`, `#290`).

O primeiro **não** travado em decisão de terceiro é o **`#294`** (10,2 d), e fui
conferir em vez de assumir: está travado **na mesma classe** dos `#249`/`#250` —
o único canal vivo é telefone, e ligar em nome da casa não é minha alçada
sozinho. Segue esperando o mesmo "pode".

O próximo é o **`#296`** (10,1 d, a aluna Leonice). E a nota dele diz, com todas
as letras, o que o destrava: *"Fecha quando o `#439` estiver em produção e o
dinheiro dela estiver decidido."*

Então o item desta ronda é o **`#439`**. **Não é desvio de prioridade nem item
novo**: é o bloqueio do item mais velho que eu posso tocar, e é dano a aluno
pagante acontecendo agora — como a seção 3 mostra, literalmente durante esta
ronda.

---

## 2. O que já estava no ar quando comecei

A **perna do consentimento** do `#439` subiu hoje às 13h53 (PR #326, merge
`cff9f6c`, run `35229632170` SUCCESS): com vídeo pronto, "Gerar de novo" não
despacha no primeiro clique — abre aviso com o custo, "Baixar vídeo" e
"Cancelar".

Isso **avisa o aluno**. Não conserta o defeito: a key do R2 continua por ID da
imagem e o vídeo pago continua sendo apagado. Eu mesmo escrevi isso às 13h54
("consentimento informado não é conserto do defeito").

---

## 3. Re-medi o estrago, e ele cresceu — depois do conserto

Eu tinha o número das **13h49 de hoje**. Duas horas. A tentação de reusar era
grande, e é exatamente a armadilha que a ronda das 15hZ nomeou: *um número certo
na janela errada é só outro jeito de não ter olhado.* Re-medi.

| medição | despachos sobrescritos | créditos | alunos | até |
|---|---|---|---|---|
| 13h49Z (minha, de hoje) | 450 | 1.121.620 | 194 | 17/09 |
| **15h50Z (esta ronda)** | **451** | **1.122.940** | **195** | **17/09 14:30Z** |

O instrumento é o razão de créditos, e o motivo dele ser o único possível é o
próprio defeito: `credit_transactions` guarda **uma linha por despacho**
(`ref_type='image_video'`, `ref_id` = id da imagem), enquanto a row da imagem foi
sobrescrita e não guarda rastro nenhum das animações anteriores.

**O +1 nasceu 37 minutos DEPOIS do conserto entrar no ar.**

Imagem `ccc7f4fe…`, aluno com acesso Hotmart vivo até 24/09 — e registro que
**24/09 é data de RENOVAÇÃO, não de vencimento**, porque foi ler esse campo como
prazo que fez a casa inventar urgência para a Leonice em 07/09. Dois despachos
pagos de 1.320 créditos, **14:30:37Z e 14:32:11Z**, 94 segundos entre eles, zero
estorno.

Os 94 segundos não são um detalhe de cor. A trava de concorrência
(`images/[id]/video/route.ts:59-61`) **recusa** despacho novo enquanto o anterior
está `pending`/`generating`. Como o segundo passou, o primeiro já estava em
estado terminal aos 94 segundos. Sem estorno na conta, o terminal provável é
`ready` — ou seja, **um vídeo pago foi substituído com o conserto já no ar**.

---

## 4. A conclusão que importa, e ela é sobre mim

**Eu não consigo dizer se esse aluno consentiu.**

A casa não grava em lugar nenhum que o aviso foi exibido. Olhando o banco, estas
três histórias são **a mesma linha**:

1. o aluno leu o aviso e escolheu substituir → **o conserto funcionou**;
2. o aviso não apareceu e o vídeo morreu calado → **o conserto está furado**;
3. a aba dele estava aberta desde antes de 13h53 e seguia com o bundle velho de
   um clique → **o conserto não tinha chegado nele ainda**.

Não afirmo qual das três foi. Afirmo que **as três são indistinguíveis daqui**, e
que isso é defeito de **instrumento**, não dúvida sobre este aluno.

Por isso **não escrevi pra ele**. Mandar um "você pode ter perdido um vídeo" para
alguém que provavelmente leu um aviso dizendo exatamente isso e clicou assim
mesmo não é cuidado, é especular na cara dele. Sem instrumento, o silêncio
honesto vale mais que a mensagem confiante.

E isto cobra uma dívida minha, declarada **duas vezes hoje** e não paga: **eu
subi aquele aviso para produção sem nunca ter visto a tela.** Às 13h54 eu
escrevi que era "risco baixo, não risco verificado", e estava certo na frase e
errado na prioridade. Hoje essa verificação deixou de ser cosmética — ela é o
único jeito de saber qual das três histórias aconteceu. Card `40c21ef4` para o
`qa`, com regra dura de não tocar em produção, não logar em conta de aluno e não
disparar animação: renderiza local com API interceptada, e o veredito é do que
ele **vir**, não do que deduzir do código.

---

## 5. O conserto de verdade: DDL na main, NÃO aplicado

Commit **`ed78a78`**, arquivo `scripts/100_image_generations_video_historico.sql`.
Commitado **sem aplicar**, pelo caminho que o Johnny fixou em 18/08 ("DDL pelo
git — eu leio direto do repositório e digo se pode aplicar").

Uma coluna, aditiva, sem tabela nova, sem índice, sem backfill:

```
alter table public.image_generations
  add column if not exists video_paths_anteriores text[] not null default '{}';
```

**Por que precisa de coluna, e não dá pra só versionar a key.** Versionar
parece trivial e eu **conferi em vez de supor**: `imageVideoKey` tem **um único**
call site (`video-sync.ts:50`) e toda leitura sai de `video_path`. Mas
`chavesApagaveisDoHistorico` (`refs-pure.ts:43-57`) monta o DELETE do histórico
pelas **colunas da row**, nunca por prefixo. Key versionada sem coluna de
histórico faria o aluno apagar a geração, o DELETE levar só a última versão, e
**todas as anteriores virarem lixo permanente no R2** — dado que ele mandou
apagar, sem rastro e sem forma de apagar depois. Seria trocar destruição
silenciosa por **retenção** silenciosa, que é pior e tem cara de LGPD.

O crédito da leitura é do Vigia: ele recusou versionar sozinho e a razão dele era
medida, não palpite. Eu confirmei a medição.

O código vem em PR próprio e **só pode ser mergeado com a coluna já no banco** —
DDL commitado não é DDL aplicado.

---

## 6. O que esta ronda NÃO resolve

1. **O defeito continua no ar.** A key segue por ID da imagem. Enquanto o DDL
   não tiver aval e o código não subir, a próxima animação continua apagando a
   anterior. Está declarado, com data e número.
2. **Não devolve o que já foi destruído.** Os 451 despachos não têm de onde
   voltar: a row guardava um `video_kie_task_id` só, sobrescrito junto, então nem
   pela API do provedor dá pra reconsultar. **O defeito destruiu a própria
   prova.**
3. **O estorno dos 1.122.940 créditos é alçada do Johnny** (regra 8) e segue
   pendente, em separado do DDL. Não misturei os dois pedidos de propósito: um é
   técnico e barato, o outro é dinheiro.
4. **O `#296` não fecha com isto** e segue travado no mesmo lugar: o `#439` em
   produção + o dinheiro da Leonice decidido.
5. **O `#290`** segue travado no "pode" do e-mail de reparação dos 8, pedido
   desde 04/09 — **13 dias**. Não repostei no grupo: a ronda de ontem 19h40 já o
   fez com os números, e repetir vira ruído com o Lucas no canal.

---

## 7. O que eu NÃO fiz

Não apliquei DDL. Não escrevi pra aluno nenhum. Não mexi em crédito, acesso,
entitlement, plano nem assinatura. Não estornei e não cancelei nada. Não gastei
GPU. Não mergeei nenhum branch stale do origin — não toquei em
`feat/onedrive-401`, `feat/fix-image-upload-retry`,
`fix/referencia-fronteira-de-frase-por-palavra` nem
`feat/fabricar-referencia-fronteira-por-palavra`. Não li a caixa do `suporte@`
pra triagem. Não toquei em nada da planilha.

Conferi também os fechados que seguem disparando (`last_seen_at` nas últimas
36h): 12 cartões, todos fichas de bounce fechadas no mesmo dia e dois
atendimentos respondidos. **Nenhuma classe fechada escondendo bug nosso.**

---

## 8. Lição

**Subir o conserto e medir o conserto são dois trabalhos, e eu só tinha feito o
primeiro.**

Às 13h54 eu declarei em voz alta que não tinha visto a tela e mergeei assim
mesmo, com um argumento que continua correto: o custo de não subir era continuar
destruindo vídeo pago. O que eu não fiz foi voltar. Declarar uma dívida não paga
a dívida — e duas horas depois ela virou exatamente a pergunta que eu não
conseguia responder.

Isto é a terceira forma seguida da mesma família, e vale escrever juntas:

- **14hZ** — a guarda respondia a pergunta certa com o **dado errado** ("tenho o
  link" em vez de "existe vídeo").
- **15hZ** — eu quase aceitaria a **evidência errada** da pergunta certa ("não
  conflita" em vez de "funciona junto").
- **16hZ (esta)** — eu tinha a pergunta certa, a evidência certa, e **nenhum
  instrumento**: o sistema não registra o único fato que decide (o aviso
  apareceu?), então a pergunta simplesmente não tem resposta no banco.

As duas primeiras se curam olhando melhor. **A terceira não** — nenhuma
quantidade de consulta produz um dado que ninguém gravou. Ela se cura antes:
quando você sobe uma proteção, sobe junto o registro de que ela agiu. Senão, no
dia em que precisar provar que ela funciona, o que você tem é fé com aparência
de dado.

E há um corolário desconfortável, que é o motivo de eu não ter escrito pro aluno:
**quando o instrumento não existe, a resposta honesta é "não sei", não a hipótese
mais conveniente.** Fosse conveniência, eu escreveria que o conserto funcionou —
tinha subido 37 minutos antes, e ninguém conferiria.
