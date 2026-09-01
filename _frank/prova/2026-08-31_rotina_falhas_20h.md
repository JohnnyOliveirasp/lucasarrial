# Ronda das falhas — 31/08/2026, 19h30–20h00 UTC (Frank)

Método serial (regra 8, ordem de 21/08). Ordem de 29/08 respeitada: **nada da
planilha foi lido, escrito, classificado ou reprocessado**; nenhum incidente de
causa-planilha aberto, reaberto ou comentado. Canal: tudo no **grupo**
(`notify-grupo.sh`), conforme a ordem de 31/08. **Nenhuma mensagem no privado.**

## Placar

- Fila no início: **15 investigating + 2 aguardando_aluno** (17 abertos).
- Fila no fim: **14 investigating + 2 aguardando_aluno** (16 abertos).
- Fechados como `fixed`: **1** (#213).
- Alunos respondidos: **1** (`assinaturas@datacrazy.io`, cópia confirmada em
  Enviados uid 399, na 1ª tentativa).
- Fix subido: **0**. Nenhum código novo — nada preso em branch.
- Escalado como urgente ao grupo: **1** (#212, reembolso).
- Novos desde a ronda das 19h: **#212** (18h55) e **#213** (19h38).

---

## O caso serial: #213 — a pergunta parecia trivial e a resposta óbvia estava errada

**Aluno:** `assinaturas@datacrazy.io`, pelo chat do app. *"Como apagar fotos
dentro da plataforma"*, com o pedido do Vigia de *"confirmar se existe botão de
exclusão no histórico de imagens e onde fica"*.

Peguei este porque era o único aberto com **passo meu**: pergunta de fato,
respondível por mim sozinho, com aluno esperando. Os mais velhos seguem travados
em decisão que não é minha (lista no fim).

### Por que quase respondi a coisa errada

A leitura fácil era: *existe o botão no Histórico de Imagens → responder "está
ali" → fechar.* O botão existe mesmo (`image-history.tsx:1000`, label `Apagar`),
e essa resposta estaria **tecnicamente correta e praticamente inútil**.

O que me fez olhar de novo foi **onde ele estava quando perguntou**: a própria
descrição do chamado registra `/app/videos/clone`. Fui atrás e a exclusão do
histórico **não toca em `{user}/refs/`** — o acervo de referência é outro
caminho. Ou seja, "apagar fotos" tinha duas leituras possíveis e eu não sabia
qual era a dele.

**É a lição da ronda das 19h de novo, num caso barato:** lá o instrumento estava
certo e apontado pro alvo errado. Aqui eu ia responder certo sobre um lugar e
deixar o outro de fora. Mapeei os dois antes de escrever.

### O que eu confirmei, com arquivo

| o que | onde | prova |
|---|---|---|
| Apagar imagem gerada | Imagens → "Histórico de imagens criadas", ícone lixeira | `image-history.tsx:1000`; `DELETE /api/v1/images` |
| Apagar foto do acervo | Imagens → "Referências salvas", "Apagar esta referência" | `referencias-salvas.tsx:138-150`; `DELETE /api/v1/images/refs` |
| O que a exclusão remove | row + objeto no R2. **Não há soft-delete** | `chavesApagaveisDoHistorico()` + `deleteKeys()` |
| Tela do Vídeo Clone | **lista** o histórico em "Minhas fotos" e **não** oferece remoção | `clone-pickers.tsx:65-68` |
| Referência trocada | **acumula**, não sobrescreve (cópia com UUID novo) | `refs.ts:100-121` |

**A causa de ele não achar o botão:** estava na única tela que mostra a foto e
não deixa apagar. Não é bug — é a resposta que ele precisava.

### Cheque que eu não pulei

- **Está em produção?** A funcionalidade entrou em `fdeba1e` (**17/06**), não é
  código de branch. Li na `main` e datei antes de afirmar. *"Card completed não
  é produção"* vale também pra "eu li o arquivo".
- **Já foi respondido?** `ler_caixa.cjs --enviados --para` — nada, nem no
  `enviados_local.jsonl` (armadilha do #210: "nada encontrado" podia ser e-mail
  que saiu sem cópia). Só havia aviso da Carol no WhatsApp, que não chega nele.
- **Conta:** assinante ativo até 04/09, 88.000 créditos, 1 voz `ready`, e **duas
  imagens geradas às 19:39** — no mesmo minuto da pergunta. Nada travado, nenhum
  crédito envolvido, nada a estornar.

### O que eu escrevi pra ele

Os dois caminhos passo a passo, mais três avisos que ele não pediu e vai
precisar: a exclusão é **definitiva** e tira o arquivo do armazenamento (com a
dica de baixar antes); apagar do histórico uma foto usada num Vídeo Clone deixa
aquele clone sem origem; e trocar referência **não** apaga a anterior — elas
acumulam, e é em "Referências salvas" que se limpa.

Fechado `fixed` com a nota inteira e a resolução.

## O que eu NÃO fiz, de propósito

- **Não abri chamado pela lacuna de UX** do Vídeo Clone (mostra a foto, não
  deixa apagar). É atendimento, não erro de sistema — ordem de 27/08. Fica
  medido aqui pra quem for mexer na tela.
- Não apaguei nada de aluno, não disparei geração, não toquei em crédito.

## #212 — dinheiro, e não é meu

Márcio (`contato@fotoatleta.com`, o mesmo do **#207**) **pediu reembolso** e diz
que a propaganda não entrega. **Não decido reembolso.** Escalei ao grupo às ~20h
marcado como urgente, com o motivo escrito: pagante pedindo dinheiro de volta e
anunciando saída.

**Não escrevi pra ele de novo**, e isto é decisão, não esquecimento: a ronda das
19h já lhe mandou promessa escrita de retorno sobre os 9.765 créditos. Segunda
mensagem em poucas horas sem definição nova é ruído, e ruído em quem já está
irritado piora. A bola do retorno tem dono: a fila.

**Ponto 2 dele** (link de WhatsApp do curso cai em grupo só-admin): confirmei o
grep do Executor — **não existe** URL `chat.whatsapp`/`wa.me` em lugar nenhum do
repositório. O link mora no material do curso/Hotmart, **fora do FastCloner**.
Não há o que corrigir no nosso código; só o time consegue trocar.

## Por que não peguei os outros

- **#99 Luciano** — o prazo é **hoje/amanhã (01/09)**. 11 escalações sem
  resposta, nada novo do meu lado. A ronda das 19h já bateu essa tecla no grupo;
  repetir de hora em hora vira ruído e mata o canal.
- **#173, #196, #202, #205, #208, #209** — a MESMA decisão de política (o que a
  compra do curso dá direito dentro do FastCloner). **Uma resposta fecha seis.**
- **#200, #201, #203, #210** — travados em merge (#132, #133, #134, #137).
- **#192** — precisa de ouvido humano. **#207** — decisão comercial pendente.
- **#197, #206** — `aguardando_aluno` legítimo, nenhum com 7d+ de silêncio.
- **`luanmarcal.com@gmail.com`** — segue **não tocado**: import de onboarding
  por Drive, dentro do perímetro desligado pela ordem de 29/08.
- **`marcelopersonalthe32@gmail.com`** — voz `failed` por multi-locutor, 21 dias
  sem voz, acesso até 05/09. **Não peguei** por falta de turno nesta ronda.
  Segue sinalizado, e é candidato natural ao próximo caso serial.

## Fim de ronda

`git fetch origin` + `git log --oneline origin/main..HEAD` vazio após o commit
deste log, e `git status --short` conferido **depois**. Nenhum código novo, logo
nada preso em branch. Rascunho do e-mail em `/tmp` (fora do git).

## Precisa de gente (nesta ordem)

1. **#99 Luciano — o prazo é agora.** Depois disto a decisão fica tomada pelo
   silêncio, contra um pagante que anunciou saída.
2. **#212 + #207 Márcio — reembolso pedido.** Pagante, com promessa escrita
   nossa de retorno pendente. Cada hora aqui é dinheiro e reputação.
3. **UMA decisão, não seis:** o que a compra do curso dá direito dentro do
   FastCloner. Fecha #173, #196, #202, #205, #208, #209.
4. **PR #138** — enquanto não subir, a ronda seguinte mede com o instrumento
   cego e pode negar crédito a pagante de novo.
5. **#132/#133/#134/#137** — sozinhos destravam 4 incidentes.
