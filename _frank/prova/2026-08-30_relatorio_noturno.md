📊 FastCloner — 30/08

✅ O QUE EU RESOLVI

• A Fast parou de prometer garantia de 7 dias por conta própria. Ela disse ao Natanael "você está dentro dos 7 primeiros dias" numa compra de 18/08 — era o dia 12. Corrigido e no ar.
• Quem assina não entra mais devendo o material do onboarding. O saldo negativo do treino + avatar (10.525 créditos) continuava de pé depois da assinatura. Corrigido e no ar.
• Foto pesada demais agora é recusada ANTES de cobrar. Um aluno mandou 14 fotos de câmera (340 MB), o gerador quebrou 3 vezes e cobrou/estornou 525 créditos em cada uma. Agora o limite é por peso (150 MB) e a mensagem diz o que fazer. Corrigido e no ar.
• Dois alunos que estavam sem resposta receberam a resposta. Descobri que o NOSSO provedor de e-mail recusou as mensagens como spam às 18:48, e o aviso dessa recusa morreu numa caixa que ninguém lê — a fila achava que tinha respondido. Reenviei um por um e chegou.
• Fechei 9 chamados hoje.
• A máquina que roda tudo isso vinha caindo sozinha várias vezes ao dia. Achei a causa (disco temporário estourado por sobra das próprias rondas) e está normal desde as 23h.

⚠️ O QUE PRECISA DE VOCÊ — 4 perguntas, sim ou não

1. Luciano (R$97, pago em 26/08): devolvo o dinheiro? A garantia vence 02/09. Já perguntei 10 vezes sem resposta. Minha recomendação: devolver.
2. Túlio: devolvo os 10.000 créditos? Ele não recebeu nossa resposta (foi uma das recusadas como spam) e às 22:20 treinou uma segunda voz que não ia resolver o problema dele.
3. Vinicius e Natanael dizem que pagaram e o sistema diz que não. Só busca na Hotmart por nome/CPF resolve. Você procura?
4. Robert Ros reclamou da voz há 28 horas. Eu não escuto áudio. Você ouve e me diz se está aceitável?

🔧 O QUE SUBIU PRA PRODUÇÃO

• a8bd5de — garantia de 7 dias (#198)
• 693559c — assinatura não entra devendo
• 48401bf — foto pesada barrada antes de cobrar (#199)

Confirmei no servidor, não no GitHub: build 617YM43lufCnKNW_2v-fO, gerado 16:39, e encontrei o código novo dentro do arquivo publicado. O site está rodando esse build há 5 horas.

NÃO subiu (prontos e testados, parados):
• PR #132 — o controle "Ritmo" da tela não faz nada se a caixa "ajustar ao meu ritmo" estiver desmarcada, e ela nasce desmarcada. 5 gerações de 3 alunos foram descartadas em silêncio hoje.
• PR #133 — e-mail que volta deixa de morrer calado. Falta corrigir um texto de orientação que está errado antes de subir; está explicado em _frank/prova/2026-08-30_rotina_falhas_23h.md.

📈 ESTADO GERAL

• 8 chamados abertos: Luciano (7 dias), Robert Ros (28h), Liliane (18h, bola com ela), Natanael (17h, bola com ele), Ritmo (7h), e-mail recusado (3h), Vinicius (1h), Jussara (1h).
• Abriram 9 hoje, contra 15 ontem e 14 anteontem.
• Varredura: 3 itens presos, os 3 já avisados, nenhum abandonado — 2 alunos cujo próprio áudio foi recusado (um com duas pessoas falando, outro com 19 min do mínimo de 20) e 1 com pasta do Drive não pública.
• Pagante travado por culpa nossa: zero.
• Dinheiro: 3 falhas nas últimas 24h, todas com estorno casado. 2.576 lançamentos varridos, nenhum tipo desconhecido.
• E-mail: 12 saíram hoje, 10 chegaram, 2 recusadas pelo nosso provedor e reenviadas com sucesso. Tem 21 recusas antigas empilhadas na caixa, de 7 alunos, que ninguém nunca leu — é o que o PR #133 conserta.
• Fila do Vigia: 4 correções dele esperando minha revisão (a mais velha há 61h) e 6 recados.
• 28 PRs abertos no repositório.

O detalhe técnico de tudo isso está commitado em _frank/prova/ (arquivos 2026-08-30_*).
