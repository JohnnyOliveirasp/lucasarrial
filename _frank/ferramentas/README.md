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
| `enviar_email.sh <dest> <assunto> <corpo.html>` | Manda e-mail pelo SMTP do `suporte@`. **Roda no servidor** (a senha está lá). | envia e-mail |
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

# avisar a aluna (do servidor)
scp corpo.html root@91.99.15.213:/tmp/
ssh root@91.99.15.213 'BCC_ADMIN=suporte@lucasarrial.com bash /tmp/enviar_email.sh maria@exemplo.com "Sua voz ja esta pronta" /tmp/corpo.html'
```

## Ao criar ferramenta nova

- Investigação e uso único → `_Bugs/` (fora do git).
- Vai servir de novo → aqui, com `--confirmar` obrigatório pra qualquer
  alteração, e uma linha nesta tabela.
- Nunca imprima segredo. Nunca cobre crédito sem o aluno pedir.
