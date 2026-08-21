# Rotina das Falhas — 21/08/2026, 13h UTC

Fila: **6 abertos**, os mesmos 6 da abertura da ronda. Nenhum fechado, e explico
cada um. Prioridade seguida: aluno esperando antes de limpeza de fila.

## O que MUDOU de verdade nesta ronda

### PR #27 na produção às 13:02Z — a primeira proteção real do 8379549c
Squash `765da14` na main, deploy run 32484630346 **success** (2m10s).
Autor: `coder` (card 11cd0992). **Revisor: eu**, e revisei como manda a 14-B.

Aviso persistente acima do botão Gerar quando a pessoa subiu foto pro banco na
sessão e ela não está no quadro. O fluxo de upload fica intacto (a decisão de
produto de 19/08 não foi revertida).

O que a revisão pegou e o `tsc` não pegaria:
- **`extrasCount` não mente**: suspeitei que estivesse contando o banco inteiro
  (o que faria o aviso mentir na frase criada pra parar uma mentira). `refs` é a
  lista de extras do QUADRO — mesmo array de `readyKeys` que vai em
  `input_image_keys` na geração. Número correto.
- **O aviso não nasce morto**: o código lê `adopted.key` da resposta do POST
  `/api/v1/images/refs`. Se a rota devolvesse envelope, seria `undefined`,
  `bankKeys` ficaria sempre vazio e o aviso **nunca apareceria** — falha
  silenciosa invisível ao compilador (campo lido como `unknown`). Conferido:
  `jsonOk` é `NextResponse.json(data)` cru; a rota devolve `{key, url}`.
- **Minhas verificações do zero**, em worktree limpa: `tsc --noEmit` exit 0 real
  (0 linhas, tsc 5.9.3 — conferi a versão porque o próprio coder relatou ter
  caído num stub de `npx` com `omit=dev`, e o primeiro verde dele era FALSO);
  `eslint` exit 0.
- ⚠️ **Limite que o autor não anotou e eu achei**: o aviso é de SESSÃO
  (`bankKeys` é estado do React). Quem sobe a foto, dá F5 e só depois gera
  continua sem aviso. Próximo degrau: derivar o aviso do BANCO, não da sessão.

Não fecha o incidente: isso **avisa**, não conserta. Fechar seria `fixed` sem ter
resolvido (regra 14).

### PR #16 — li o código e achei um buraco. Não mergeei, e agora com motivo
A passagem anterior desta ronda dizia "não mergeei porque mexe no runpod-worker
e escalei ao Johnny". Isso era **cautela sem conteúdo** — eu não tinha lido o
código. Li.

Está bom no essencial: o fallback é real e está ligado nos três caminhos
(whisper explode / sem words / corte da janela falha); a conversão de relógio
(`rel_start = offset - win_start`) está certa — era o erro óbvio pra cometer e
ele não cometeu; `-ss` antes do `-i` é exato em WAV PCM; assinatura de
`select_reference_clip` intacta; 19 testes passam (rodei); sem conflito com a
main; nenhuma voz em `training` agora (as 29 intermediárias estão todas em
`awaiting_training`, esperando o aluno clicar).

**O buraco**: se TODAS as candidatas derem `_SNAP_DISCARD`, `scored` termina
vazio e a função devolve `[]` — onde o código de hoje devolveria as candidatas
cortadas por tempo. Nesse caminho a melhoria **não** cai no fallback: ela zera o
resultado e o treino quebra. O PR promete "a melhoria nunca quebra o treino";
ali ela quebra. Nenhum teste cobre isso.

→ card **75b0fda6** pro `coder`, na própria branch. Volta, eu releio e mergeio.
**Efeito colateral bom**: isso deixou de ser pergunta pro Johnny.

## O que NÃO andou, e é o mesmo motivo nos dois casos

**Katia (`ce6e157d`)** e **Valtermir (`72e054ee`)** estão parados esperando **uma
palavra do Johnny**, não trabalho técnico. A ordem da ronda diz "e-mail pra aluno
só com o 'pode' do Johnny" — conferi o texto da ordem antes de escrever isto,
porque estava prestes a tratar a regra como inventada. **Ela existe mesmo.**

- **Katia**: e-mail dela (uid 204, 05:53Z) sem resposta há **~7h**, 4ª ronda
  pedindo o "pode". Acesso vence **22/08 12:00Z (~23h)**. E agora a resposta tem
  conteúdo real pela primeira vez: a cura de pausa foi medida e funciona
  parcialmente (3 pausas de ~0,24s contra 0 antes, batendo com os 220ms
  configurados), e eu sei explicar por que só parcialmente.
- **Valtermir**: escreveu 07:41 -03 (uid 205), 2ª cobrança, e a frase que importa
  é *"não gostaria de gastar meus créditos em tentativas e erros"*. A causa dele
  subiu pra produção hoje e ele não sabe.

Os dois são pagantes, os dois já cobraram mais de uma vez, e o gargalo não é
técnico. Registro como fato da fila.

## Conferências de higiene
- `agent_state`: 22 chaves, **zero `patch_*` pendente** — o caminho da 14-B não
  foi usado nesta rodada. O commit perdido do Vigia (`c788b40`) segue
  inexistente e não faz mais falta: o PR #27 cobre o mesmo terreno.
- Fim de ronda: `git log origin/main..HEAD` **vazio**, nada preso em branch.
- Nada gasto: nenhuma geração, nenhum crédito, nenhum débito, nenhuma migration.

## Fila, estado ao fim
| id | estado | por quê continua aberto |
|---|---|---|
| `ce6e157d` Katia | investigating | resposta ao aluno travada no "pode"; pausa só ~60% curada (chunking) |
| `72e054ee` Valtermir | investigating | causa em produção; **falta responder o homem** |
| `8379549c` 6 alunos / 4.110 cr | investigating | avisa, não conserta; aviso é de sessão |
| `2c5bab42` upload silencioso | investigating | PR #28 aberto 12:55Z (card 70141486), ainda não revisado |
| `5c3f1f8b` 5 pagantes sem voz | investigating | os 5 precisam de e-mail — mesmo bloqueio |
| `c82c77e4` 1,5 GB duplicado | investigating | custo nosso, nenhum aluno afetado; limpeza é decisão do Johnny |
