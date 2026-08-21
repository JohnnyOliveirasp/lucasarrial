# Prova do teste de aceite — dedupe por QUEIXA (caso Katia), 20/08/2026

Card: bug estrutural da assinatura `fast-email:{tec|atend}:{email}` (chave = só remetente).
Rodado AO VIVO contra produção (só leitura), da branch fix/fast-email-dedupe-por-queixa:

```
=== incidente real (produção) ===
id: ce6e157d-9fdf-4c70-ad24-8ab74d5da998
signature ATUAL (legada): fast-email:tec:katiasalvador32@gmail.com
status: open | occurrences: 2
title (ocorrência 1, eco/corte): Fast (e-mail): áudios gerados com a voz "Minha voz" saindo com letras soltas/cortadas ou começando em lug
description (ocorrência 2, pacing — SOBRESCREVEU a 1): aluna relata que o áudio "Portal da Morgana" (refeito pela equipe em 19/08, 18:07) está saindo robótico, frases sem pontuação/grudadas. Pedir pra equipe revisar o texto usado e regerar com pontuação adequada se necessário.

=== lógica NOVA aplicada aos textos reais ===
ocorrência 1 (eco)    → classe: corte  → assinatura: fast-email:tec:corte:katiasalvador32@gmail.com
ocorrência 2 (pacing) → classe: pacing → assinatura: fast-email:tec:pacing:katiasalvador32@gmail.com

separou as duas queixas? SIM
replay 20/08 17:05: busca por "fast-email:tec:pacing:katiasalvador32@gmail.com" não acharia nada → decideDedupe(null) = "new" (incidente NOVO, visível)
e se o card de pacing já existisse fechado (fixed): decideDedupe("fixed") = "reopen" (reabre com nota, nunca soma calado)
EXIT: 0
```

## Testes (node --test, 11/11)

```
ok 1 - ACEITE Katia: eco/corte e pacing classificam em classes DIFERENTES
ok 2 - ACEITE Katia: as assinaturas separam as duas queixas (e nenhuma cai na chave legada)
ok 3 - ACEITE Katia: replay 20/08 17:05 — busca pela assinatura de pacing não acha nada, nasce incidente NOVO
ok 4 - 'robótico' no meio da queixa de pacing NÃO desvia pra classe semelhança (ordem dos matchers)
ok 5 - TRAVA b: mesma classe 3x → mesma assinatura, incidente aberto INCREMENTA (nunca 3 cards)
ok 6 - TRAVA b: queixa SEM classe repetida também dedupa (chave legada + card aberto)
ok 7 - card FECHADO + mesma classe → REABRE (reincidência é sinal, não ruído)
ok 8 - card FECHADO + queixa sem classe → incidente NOVO (fechado nunca absorve queixa que não se prova igual)
ok 9 - classes vizinhas não se misturam
ok 10 - acentuação não muda a classe (normalização)
ok 11 - canal atendimento (technical=false) mantém o prefixo atend na chave
# tests 11
# pass 11
# fail 0
```
