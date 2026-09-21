# Ronda das falhas — 21/09 ~23h40–00h00Z

**Uma linha:** o item serial que o handoff me deu (**Hellen**) estava descrito
como *"intocado"* e **não estava** — ela já tinha 4 cartas e o conserto de classe
no ar. Medi antes de agir, e a medição levou ao que de fato faltava: **a decisão
dos 90 pedidos vazios do SGP tem PRAZO, e 3 alunos pagantes perdem a janela de
reembolso em 23/09.**

---

## §0 — Passos fixos

| Passo | Resultado |
|---|---|
| `git checkout main && git pull --ff-only` | ok, sem divergência (`46977f35`) |
| Reconciliar envios da pasta (`--corte=2026-09-14T14:06:31Z`, `--confirmar`) | **0 carta** a escriturar. 981 lidas, 904 já tinham linha, 77 fora da janela, 0 recusadas. Contagem fecha: **981 = 981** |
| Irmão de leitura (`2026-09-18_enviados_x_tabela.cjs`) | **0 carta depois do corte** fora da tabela. 904 casadas por Message-ID + 4 por destinatário+janela. Veredito: buraco **PASSIVO** |
| `percepcao_travada.cjs` | **0** cartão travado · controle positivo (#310) OK · 503 incidentes varridos |
| Fila (`idade_dos_abertos.cjs`) | **101 abertos · 47 com 7d+ · 141 recados** |

⚠️ O registro local (#210) segue devolvendo **0 cartas** — ledger gitignored, morre
com o worktree. É exatamente por isso que a reconciliação lê a **pasta Enviados**
(remota) e é passo fixo: controle compensatório, não conserto.

---

## §1 — O handoff errou de novo: a Hellen NÃO estava intocada

O §7 da ronda das 22h40Z me entregou `hellengrasso@gmail.com` como *"segue
intocado; é o candidato natural a item serial da próxima ronda"*.

**Fui conferir antes de agir, e o estado real era outro:**

- **4 cartas** já tinham saído (05/09, 06/09, 11/09 uid 1740, 12/09 uid 1937) —
  conferidas na **pasta Enviados**, que é remota e anterior a 14/09.
- O incidente da classe (`12d4db57`) já estava **`fixed`** com o conserto **em
  produção** (PR #256, merge `03a7922`, deploy SUCCESS 12/09).
- Créditos **intactos**: 95.375, nada cobrado pelas falhas.

É a **segunda ronda seguida** em que o handoff manda trabalhar num caso já
resolvido — na de 22h40Z era `#406`/`#455`, que mandavam despachar ao `olho`
trabalho feito havia 6 dias. **Medir antes de herdar deixou de ser zelo e virou
passo obrigatório**, e está escrito aqui pra terceira não acontecer.

### O que eu medi de novo nela (e não herdei de nota)

1. **A perda dos áudios é REAL.** Listei o R2 sob o prefixo da voz `9bb9fccf`:
   existem **exatamente 2 objetos** (`001_`, 5.4 MB no total), batendo com o
   *"2 dos 7"* da mensagem. A armadilha medida da casa manda listar os ARQUIVOS
   antes de culpar worker/ffmpeg — listei, e a mensagem ao aluno está correta.
2. **A porta do `/sgp` está ABERTA pra ela.** Li `lib/sgp/sessao.ts`:
   `pedidoDaSessao()` **cria pedido novo** quando não há cookie válido. O pedido
   travado dela (`18e17126`, `status='dados'`, `fotos=[]`, `audios=[]`) carrega
   uma `sessao` nascida do **import**, que ela nunca teve no navegador — logo
   **o pedido vazio não a bloqueia**. Isto importa: se a porta estivesse fechada,
   a bola seria NOSSA e as duas cartas mandando "refaça" seriam uma pedra na
   porta. Está aberta.

**Conclusão honesta:** nos dois caminhos técnicos a bola é **legitimamente dela**
(avisada em 11/09 e 12/09; último login 12/09 14:48Z, não voltou). **Não mandei
5ª carta** — seria a 5ª em 16 dias sobre o mesmo assunto, sem fato novo pra ela.

---

## §2 — O que de fato faltava: a decisão dos 90 tem DATA

A Hellen é **um dos 90** do `#506` (`1a9e6133`) — pedidos do SGP importados da
planilha antiga que **chegaram vazios** (`tem_foto=true`/`tem_audio=true` na
origem, `fotos=[]`/`audios=[]` no pedido) e não se movem desde 10/09.

A escalação das 17hZ já está com o Johnho e disse quantos têm **acesso vivo**
(18) e **crédito > 0** (22). **Faltava o único número com prazo** — e prazo
vencido não volta.

**Medido agora** contra `payment_events` (`PURCHASE_APPROVED`, **paginado**,
porque a consulta corta em 1000 em silêncio), rodando a **mesma função de
produção** que a Fast usa (`lib/agent/garantia.ts`, `janelasPorProduto`):

| | |
|---|---|
| pedidos vazios `origem='planilha_antiga'` | **90** (90 e-mails distintos) |
| com compra aprovada **naquele endereço** | 24 |
| **JÁ FORA** da janela de garantia | **7** |
| **AINDA DENTRO** (dá pra devolver hoje) | **5** |
| sem compra aprovada naquele endereço | 78 |

> ⚠️ Os **78 NÃO são "não-pagantes"**. Pela doutrina da casa, ausência de
> pagamento naquele endereço **não é prova de não-pagamento** (pode ser outro
> e-mail). Não os contei como tal, e ninguém deve contar.

### O número urgente

Dos 5 que ainda dá pra devolver, **3 vencem em 2026-09-23** —
`jununes42@hotmail.com`, `joaov.cestaro@hotmail.com`,
`fastcloner@americanshowerglass.com`. Os outros 2 vencem em **28/09**
(`ribasadv1975@gmail.com`, `rodrigocalazansx@gmail.com`).

A decisão dos 90 deixou de ser "convocar ou não" e passou a ter **data**: a cada
dia sem resposta, aluno pagante migra de *"dá pra devolver"* para *"não dá
mais"*. É exatamente a família do **`#207`** — o aviso ficou na nota, a garantia
venceu, o aluno ficou com **R$97** sem devolução.

**Ressalva honesta de ±1 dia:** para a Hellen esta leitura devolve fim em
**12/09** e o `2026-09-15_garantia_por_produto.cjs` devolve **11/09** (borda de
fim de dia). Não investiguei a borda. Portanto **23/09 é LIMITE MÁXIMO e a ação
tem que sair até 22/09**, não no próprio dia 23.

---

## §3 — O que eu NÃO fiz, e por quê

- **Não abri segunda escalação.** A pergunta dos 90 está com o Johnny desde as
  17hZ; repetir viraria ruído (mesma disciplina da ronda das 22h40Z com o `#214`).
  Levei o **PRAZO** ao grupo em cima da mesma pergunta pendente.
- **Não devolvi dinheiro, não convoquei ninguém, não escrevi pra nenhum dos 90.**
  Reembolso fora da janela é do Johnny (**9-A**), e a própria linha de garantia do
  sistema manda *"NÃO prometa reembolso deste produto; escale pro humano"*.
- **Não li a planilha** (ordem de 29/08). Li `sgp_pedidos` — o sistema **NOVO**,
  em produção desde 29/08 — e `payment_events`.
- **Não fechei o `#506`.** Fechá-lo como *"planilha desativada"* enterraria
  alunos pagantes parados no sistema novo; o conflito entre as duas leituras é
  decisão do Johnny e já está escalado. Nada aqui está resolvido.
- Não mexi em plano, acesso, assinatura, migration, nginx, RunPod nem GPU.
  Nenhum merge, nenhum PR.

**Escritas em banco nesta ronda: 1** — a nota do `#506` (`agent_notes` 2 → 3,
conferido na releitura, 1 linha afetada). **Nenhuma carta a aluno.**

---

## §4 — Grupo

**1 mensagem** (`notify-grupo.sh`), marcada como urgente: o prazo de 23/09, a
recomendação de agir até 22/09 pela margem de 1 dia, e o aviso de que é a MESMA
decisão já pendente. **Os nomes ficaram na nota do card, não no Telegram** —
regra de canal ("nunca no Telegram dado que identifique aluno sem necessidade";
o que é pra EXECUTAR vai no git).

---

## §5 — Para a próxima ronda

1. **`#506` / os 90 — item mais urgente da casa hoje.** Se o Johnny responder,
   execute **antes de 22/09** pelos 3 que vencem em 23/09. Se amanhecer 22/09 sem
   resposta, **vale cobrar uma vez** citando o prazo.
2. **`#214`**: se 22/09 amanhecer sem resposta sobre saldo de compra reembolsada,
   repetir a escalação **uma** vez. Não agir sozinho (9-A).
3. **Hellen: ENCERRADA como item serial.** Bola dela nos dois caminhos, medido
   (R2 + porta do `/sgp` no código). Não a devolva ao handoff como "intocada" —
   ela não está. O que sobra dela está dentro da decisão dos 90.
4. **`#517`**: aguardar o detector do `coder` e, com ele, auditar os **fechados**.
5. **PR #351** (aviso de deriva nos dois tiers) aberto desde 19/09 — conserto de
   classe do `#224`.
6. **NÃO CONFIE NO HANDOFF SEM MEDIR.** Duas rondas seguidas ele apontou trabalho
   já feito. Conferir o estado atual do aluno é o passo (1) da rotina, e é ele que
   tem pago.
