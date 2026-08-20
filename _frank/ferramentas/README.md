# Ferramentas do Frank

Scripts prontos, todos testados em 18/08/2026. Rodam **de qualquer pasta** do
projeto (o caminho do `.env.local` é resolvido a partir do próprio script) —
mas precisam das dependências instaladas em `frontend/node_modules`.

Nenhum deles cobra crédito do aluno. Os que alteram dados só agem com
`--confirmar`; sem a flag, **simulam** e mostram o que fariam.

| Script | O que faz | Altera algo? |
|---|---|---|
| `varredura_travados.cjs` | A varredura diária: tudo parado em estado intermediário + incidentes abertos. Comece o dia por ele. | não |
| `aluno.cjs <email>` | Raio-x completo de um aluno: conta, compra, créditos, vozes, produção e erros. **Rode isto antes de responder qualquer reclamação.** Se não achar a conta, procura contas/compras parecidas (caso "duas contas"). | não |
| `resgatar_voz.cjs <voiceId> --confirmar` | Voz parada em "uploading" com áudio no R2: restaura e dispara o treino **por conta da casa** (não cobra). | sim |
| `consertar_referencia.cjs --confirmar` | Acha `profiles.image_ref_key` apontando pra arquivo inexistente e troca por uma foto real. | sim |
| `limpar_fantasmas.cjs --confirmar` | Apaga voz "uploading" com **zero** áudio no R2 e 45min+. Reconfere o R2 antes de cada exclusão. | sim |
| `enviar_email.cjs <dest> "<assunto>" <corpo.html> [--bcc x@y]` | **O jeito preferido de falar com aluno.** Node puro, roda da sua máquina, sem SSH — fala SMTP direto (587+STARTTLS) com a senha do `.env.local`. | envia e-mail |
| `ler_caixa.cjs --de <email> \| --ultimos N \| --enviados --para <email> \| --fila \| --caixas \| --anexos <uid> [--salvar-em <dir>]` | Lê a caixa do suporte@ **sem atropelar a Fast**: `EXAMINE` (read-only no protocolo) + `BODY.PEEK`, busca só `SEEN` — da fila de não-lidos (que é dela) sai apenas a contagem. Na listagem, anexo é só nome/tamanho; `--anexos <uid>` baixa os anexos DAQUELE uid pra `_Bugs/anexos/<uid>/` (parte específica via BODYSTRUCTURE + `BODY.PEEK[n]`, teto de 10MB/anexo em `_anexos.cjs`, e imprime a prova de que flags e fila não mudaram). Ordem: `_frank/ordens/2026-08-19_ler_caixa.md`. | não (grava só em disco local) |
| `enviar_email.sh <dest> <assunto> <corpo.html>` | Mesma coisa em bash+curl, pra rodar **no servidor**. | envia e-mail |
| `_comum.cjs` | Base compartilhada (credenciais, Supabase, R2). Não roda sozinho. | — |

## Exemplos

```bash
# começo do dia
node _frank/ferramentas/varredura_travados.cjs

# alguém reclamou
node _frank/ferramentas/aluno.cjs maria@exemplo.com

# a voz dela tem áudio no R2 e está travada
node _frank/ferramentas/resgatar_voz.cjs <voiceId>            # simula
node _frank/ferramentas/resgatar_voz.cjs <voiceId> --confirmar # executa

# avisar a aluna (da sua própria máquina)
node _frank/ferramentas/enviar_email.cjs maria@exemplo.com "Sua voz ja esta pronta" corpo.html --bcc suporte@lucasarrial.com
```

⚠️ Antes de mandar pro aluno, mande **pra você mesmo** e leia. E-mail não tem
desfazer. Em lote, não use `--bcc` (enche a caixa do Johnny): mande um resumo
único no fim.

## Ao criar ferramenta nova

- Investigação e uso único → `_Bugs/` (fora do git).
- Vai servir de novo → aqui, com `--confirmar` obrigatório pra qualquer
  alteração, e uma linha nesta tabela.
- Nunca imprima segredo. Nunca cobre crédito sem o aluno pedir.
