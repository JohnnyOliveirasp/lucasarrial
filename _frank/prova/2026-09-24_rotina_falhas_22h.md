# Ronda das falhas — 24/09, ~21:41–22:00Z

Item serial (regra 8): a cabeça da fila é o **`#52` / `37bacb68`** (36d, 22
alunos). **Não o trabalhei** — ele está travado em decisão do Johnny, e está
escrito por quê abaixo. O trabalho da ronda foi o que **destrava a leitura**
dessa fila: o instrumento que a conta estava cego desde ontem, e a ronda das
21hZ deixou isso explicitamente para esta.

---

## 1. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar` | 1245 lidas / 1168 já tinham linha / **0 escrituráveis**. Contagem fecha 1245 = 1245. |
| `2026-09-18_enviados_x_tabela.cjs` (irmão de leitura) | **0 carta depois do corte** fora da tabela. Veredito: buraco PASSIVO. |
| `percepcao_travada.cjs` | **0 cartões** travados em percepção · mais velho 0d. Controles positivo (#310) e negativo (#518) OK, 546 varridos. |

As 77 cartas anteriores a 14/09 14:06:31Z seguem **sem decisão** (é o que o
`--corte` exclui) — inalterado, continua decisão de produção, não de ronda.

---

## 2. Por que não trabalhei o `#52`, e por que isso não é desculpa

O `#52` é o mais velho com aluno afetado e o que tem mais gente atrás (22). A
nota dele de 23/09 já havia concluído, com número, que **o gargalo dele não é
medição — é decisão**: quatro remédios técnicos da família já foram refutados
(chunker, heurística por energia, lista longa, idioma), e a grandeza que um
portão precisaria (coverage por chunk) **já é calculada em 100% das linhas há
meses**. O que falta é a política: entregar / falhar sem cobrar / entregar
avisando. Essa é exatamente a decisão (a)/(b)/(c) parada no **`#226`
(`702cc916`) há 23 dias**, escalada por escrito desde 21/09 18:59Z.

Escrever uma 68ª nota de investigação nele hoje não entregaria áudio bom pra
ninguém. **O que destrava o `#52` é o Johnny responder o `#226`.** Então o
trabalho útil da ronda era fazer essa fila de decisão voltar a ser legível — e
ela estava cega.

⚠️ **Peso corrigido:** o `#226` mostra **1 aluno** em `affected_emails`. É
subdimensionado: a mesma decisão trava o `#52`, com 22. Somados e sem repetir
ninguém, **23 alunos atrás de uma pergunta só**. Corrigi o rótulo no próprio
instrumento pra ninguém mais ler "1 aluno" e despriorizar.

---

## 3. O conserto: a fila de decisão do Johnny voltou a ter número

**O que estava quebrado.** Em 24/09 17:48Z o retrofit da trava do humano
(#415) carimbou a **mesma nota em 21 cartões vivos**. Como `ultimaNota()` lê só
`agent_notes[-1]`, o carimbo virou a última nota de todos e **enterrou o estado
real**: 4 cartões parados no Johnny sumiram da varredura — **três deles dinheiro
de aluno** (#245, #263, #307) — e o controle positivo passou a **abortar**. Por
isso a ronda das 21hZ não pôde reportar número nenhum, e escreveu: *"fica medido
pra próxima ronda consertar a marca antes de contar"*.

**O que eu fiz.**

1. **Instrumento novo, só leitura:** `_frank/ferramentas/2026-09-24_nota_em_lote.cjs`.
   Acha escrita em lote **pelo dado** (mesmo prefixo de nota em N cartões
   distintos), sem lista de padrões escrita à mão que a próxima ronda esquece de
   atualizar. Mediu **4 textos em lote** nos cartões vivos e **24 cartões** com
   carimbo de lote como última nota — **reproduz exatamente** o número que o
   `#554` já tinha medido às 18h30Z, por caminho independente.

2. **Rejeitei "é lote ⇒ pode pular" como regra automática**, e foi o próprio
   instrumento que me fez rejeitar: dos 4 textos em lote, **só 2 são neutros**.
   Os outros 2 **mudam o estado** e pular seria ressuscitar estado velho:
   - `"CONSERTO EM PRODUCAO === PR #331 ... MERGEADO"` (3 cartões)
   - `"RONDA 13/09 ... CANAL ENCONTRADO"` (5 cartões)

   Essa é a doença de varrer a pilha inteira (41 falsos onde havia 1) que o
   critério 1 existe pra evitar. Então `NOTA_NEUTRA` é **conferida à mão**: o
   lote *surface* o candidato, humano decide. Está escrito no arquivo, com a
   pergunta que tem que ser respondida pra incluir um padrão.

3. **`esperando_johnny.cjs`:** `ultimaNota()` agora **anda pra trás enquanto a
   nota for neutra**, teto de 5 pulos (pilha maior que isso é achado, não coisa
   pra varrer calado — e estourar o teto devolve a nota crua, que é o lado
   seguro).

**Prova.** Controle positivo **5/5** (era 4/5, abortando). **6 cartões** voltam
a ser vistos. A fila voltou a ter número:

> **20 cartões parados em decisão do Johnny · 60 alunos distintos atrás ·
> mais velho parado há 23d** (teto 23 se os contestados contarem).

### 3.1 Erro meu no meio, pego pelo controle — e ele era do tipo mais feio

O aviso que eu **criei pra declarar** quantos cartões foram resgatados nasceu
**antes** do laço da classe e saiu **mentindo**: mostrava **1 de 4**, só os do
`CONTROLE`. Os três outros — justamente os de **dinheiro de aluno** — eram
resgatados de verdade e apareciam na lista final, mas **não constavam no aviso**.

Ou seja: **o aviso que eu escrevi pra matar o viés pra baixo tinha o viés pra
baixo.** Peguei relendo a saída contra o `nota_em_lote.cjs`, **não por teste**.
Movido pra depois do laço, e restrito a quem de fato virou fila (**6 de 22** com
carimbo) — contar os 22 inflaria o efeito do meu próprio conserto, que é a
versão espelhada do mesmo pecado. A correção está comentada no arquivo, no lugar
onde alguém seria tentado a mover o bloco de volta.

### 3.2 `#554` fechado

Fechado com `resolution_note` preenchida (o `#560` mostrou que fechar com motivo
vazio é possível hoje; não vou produzir mais um). **Condição de reabertura
escrita:** se o `nota_em_lote.cjs` mostrar um texto em lote **novo** cujos
cartões caiam na fila e o controle voltar a acusar. Residual nomeado, não
escondido: **um retrofit novo vai enterrar de novo** até alguém incluir o padrão
— o que mudou é que agora existe instrumento que **acha** o lote e um controle
que **aborta** em vez de imprimir número otimista.

---

## 4. Triagem: 6 cartões a mais na conta, lidos à mão

Com a fila legível, triei o que estava como "NÃO TRIADO". Só entrou o que eu li
**inteiro**; o que li pela metade **ficou fora de propósito** (4 seguem não
triados: `f8587cef`, `cfa488b5`, `cfde107d`, `5491c74e`).

| Cartão | Veredito | O que é |
|---|---|---|
| `f1ada07e` #254 · 17 alunos | **REAL** | ⏰ reembolso Carlos R$194 + Nassara, **e o "pode" do Leandro ANTES de 28/09** |
| `ce8ba48b` #488 · 2 alunos | **REAL** | 62.040 cr acima do teto — o **título do cartão já diz** "DECISÃO DO JOHNNY" |
| `719c9af6` #494 · 9 alunos | **REAL** | decisão de produto/preço/estorno (lido à mão em 23/09 17hZ) |
| `555a1cee` #521 · 1 aluno | **REAL** | pagou R$291 e não recebeu nada |
| `e693222b` #554 | FALSO | é o cartão **desta** ferramenta; dono sou eu |
| `37c2b55c` #553 | FALSO | "triado, sem acionamento"; contorno já em produção |
| `37bacb68` #52 · 22 alunos | **CONTESTADO** | travado na **mesma** decisão do `#226` — 1 pergunta, não 2 |

O `ce8ba48b` merece nota: o **Vigia registrou em 23/09** que aquele cartão *"não
está sendo contado em lugar nenhum, e ele é de decisão do Johnny"*. Ele estava
certo, e agora a varredura o vê. Objeção do sensor valendo como insumo, exatamente
como a regra 14-A manda.

### ⏰ O único com relógio: `#254`

**Leandro tem cobrança dupla FUTURA** — duas assinaturas ativas, R$97 cada,
vencendo **28/09 e 30/09** (4 e 6 dias). Ele foi escrito nos dois endereços em
20/09 pedindo a frase do 9-C e **não respondeu**. Falta **a frase dele OU o
"pode" do Johnny** — nenhuma das duas é minha. É a única janela da fila em que
**prevenir ainda sai mais barato que estornar**; passou de 28/09, vira reembolso.
Por isso foi ao grupo marcado como urgente.

---

## 5. Dinheiro, GPU, aluno

- **Não mexi** em crédito, acesso, plano, assinatura ou status de pedido.
- **Não gastei GPU**, não pedi retreino, não regenerei áudio de ninguém.
- **Não escrevi pra aluno nenhum** nesta ronda (nenhum caso meu exigia carta).
- **Não apliquei migration** (a 96 do `#561` segue com o Johnny), **não mergeei
  nada** — nenhum dos 6 branches STALE do índice foi tocado.
- **Não toquei** em nada da planilha (ordem de 29/08).
- **Não li** a caixa do suporte@ pra triagem (a Fast marca como lido).

---

## 6. Deixado para o dono (2ª ronda seguida) — e o que eu mudei sobre isso

A ronda das 21hZ registrou artefatos **não rastreados** de uma ronda anterior
sobre o `75c33ee1` e não os commitou, com o argumento certo: *"commitar prova
alheia como se fosse desta ronda é pior que deixar à vista"*.

**Reavaliei e commitei uma parte, com rótulo honesto.** Motivo: o
`_frank/prova/2026-09-24_backup_75c33ee1_perfis_antes.json` é um **retrato do
saldo de 183 perfis ANTES** de um estorno agregado — e o `75c33ee1` está **na
fila de decisão do Johnny agora** (9-B, 10x o teto, 1.010.200 cr). Se o Johnny
disser "pode", **esse arquivo é o material de desfazer**. Código se reescreve;
um retrato de saldo num instante não. Arquivo não rastreado some no próximo
checkout, que é a mesma família do fix que ficou 9h preso em branch em 19/08.

Commitei **o par que torna a prova utilizável** (o backup, a simulação
antes/depois e a ferramenta que os produziu), **declarando no commit que não são
trabalho desta ronda**. Os 7 rascunhos de diagnóstico **não** foram commitados —
esses sim são descartáveis.

---

## 7. Fim de ronda

- Log commitado na **main**. Nenhum código de **produção** mudou nesta ronda —
  só instrumento de ronda (`_frank/ferramentas/`), que não deploya.
- **Não criei branch**, então não havia fix meu pra ficar preso.
- `git log --oneline origin/main..HEAD` conferido **vazio** no fim.
- Recado no **grupo** via `notify-grupo.sh` (canal de 31/08). Nada no privado.
- Escrita conferida na releitura: `#554` relido (status `fixed`, 3 notas,
  `resolution_note` 764 chars, **1 linha afetada**).

### Sobre o passo fixo do `git rev-list` (repito o de 21hZ, porque continua valendo)

Ele acusa ~193 branches e boa parte é falso positivo (squash-merge deixa o
conteúdo na main com sha diferente); `git cherry` distingue, `rev-list` não.
Segue **proposto e não aplicado** — corrigir ordem não é alçada de ronda. Esta
ronda não criou branch, então o passo não tinha o que pegar de qualquer forma.
