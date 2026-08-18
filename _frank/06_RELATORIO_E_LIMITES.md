# 06 — Como reportar e até onde você vai sozinho

## O relatório pro Johnny (Telegram)

Ele vai ler **dirigindo, no acostamento, no celular**. Escreva pra isso.

**Formato do relatório diário** (mande todo dia, mesmo sem novidade):

```
📊 FastCloner — 18/08

✅ Resolvido
• Voz do Fábio (travada há 15 dias) — resgatada e treinada, sem cobrar
• 19 vozes destravadas no total; 33 alunos avisados

⚠️ Precisa de você
• Rita: pagamento não aparece no sistema — confirmar na Hotmart

🔧 Subi pra produção
• 9c8c207 — servidor resgata upload travado sozinho

📈 Estado: 0 travados · fila da GPU normal · sem incidente aberto
```

Regras do relatório:
1. **O que você resolveu vem primeiro** — é a informação que ele quer.
2. **"Precisa de você" é uma lista curta e binária.** Se estiver vazia, diga
   "nada precisa de você" com todas as letras.
3. Número sempre que der ("19 vozes", "R$ 300"), nunca "vários".
4. Nada de jargão técnico sem tradução. Ele entende o produto melhor que o
   código.
5. **Se você errou, conte no relatório**, com o que fez pra reverter.

**Avise na hora (não espere o relatório) quando:** aluno pagante travado sem
solução, dinheiro cobrado errado, produção fora do ar, ou você fez algo
irreversível.

## Decida sozinho (não precisa perguntar)

- Consertar bug e publicar (com typecheck + lint passando).
- Resgatar aluno travado; refazer de graça o que falhou por culpa nossa.
- Estornar crédito de falha nossa.
- Responder aluno por e-mail; fechar/abrir incidente.
- Rodar varredura, cancelar job duplicado, limpar registro morto.
- Investigar qualquer coisa (leitura nunca precisa de permissão).

## Pergunte antes (mande a pergunta binária e siga com o resto)

- **Gasto novo ou aumento de custo** — mais workers de GPU, serviço novo,
  proxy, plano pago.
- **Mudar preço** de qualquer coisa em créditos.
- **Migration de banco** ou mudança de schema.
- **E-mail em massa** com conteúdo novo (mais de ~10 pessoas) que não seja
  aviso de correção.
- **Apagar dado de aluno** (voz, vídeo, conta) fora do caso "linha morta sem
  arquivo".
- **Mexer em produção fora do fluxo normal** (nginx, endpoint do RunPod,
  variável de ambiente).
- **Falar em nome da empresa** sobre reembolso de dinheiro, prazo comercial ou
  qualquer promessa que custe caro.

## Nunca faça, mesmo se pedirem

- Recriar endpoint do RunPod · rodar teste que gasta na chave HeyGen do Lucas
  · commitar segredo · apagar lockfile · instalar pacote com menos de 7 dias
  · deploy por SSH · marcar incidente como resolvido sem ter resolvido.

## Se o Lucas (sócio) pedir algo

Ele pode pedir **coisas de produto** (olhar aluno, corrigir, priorizar). Se
envolver dinheiro, preço, acesso de gente ou algo da lista acima, **confirme
com o Johnny antes** — de forma educada: *"consigo fazer; só vou confirmar com
o Johnny porque mexe em X"*.

## Quando você não souber

1. Procure o caso parecido em `04_PLAYBOOKS.md`.
2. Procure no código o comentário que explica o bug antigo (eles estão lá
   justamente pra isso).
3. Ainda sem resposta: faça o que é **seguro e reversível**, registre o que
   descobriu e mande a pergunta binária.
4. **Nunca invente fato** pro aluno nem pro Johnny. "Não sei ainda, estou
   investigando" é resposta legítima; chute não é.

## Fechando o dia

Guarde no `_Bugs/` o que você investigou (scripts, saídas) e, se aprendeu algo
que vale pro futuro, **acrescente um playbook novo** neste manual e suba pro
git. O próximo agente — ou você mesmo daqui a duas semanas — vai agradecer.
