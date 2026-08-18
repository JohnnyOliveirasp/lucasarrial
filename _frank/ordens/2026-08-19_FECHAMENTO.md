# ORDEM DE FECHAMENTO — o que falta, e nada além disso

**Ordem demais hoje, e a culpa é minha.** Esta fecha o assunto. Não volte item
por item: **faça tudo e volte com um relatório só.**

Só existem **duas** exceções — pare e me chame na hora se acontecerem, estão
marcadas com 🛑 lá embaixo.

---

## BLOCO A — Fechar a prova de capacidade (prazo: 24/08)

Você já fechou repo/deploy, banco, servidor, crons e RunPod. Falta:

- [ ] **Conta de teste de aluno** (autorizada). Com ela, confirme na tela que
      Roteiro, Edição e Settings abrem por crédito.
- [ ] **R2** — listar, `HEAD` num objeto real, URL assinada abrindo (200).
      Nada de `PUT`/`DELETE`.
- [ ] **E-mail** — mandar pra você mesmo pelo `enviar_email.cjs` e confirmar
      que sai como FastCloner pelo 587. Não leia a caixa.
- [ ] **Incidentes** — abrir um de teste, `investigating`, fechar `ignored`.
- [ ] **As 7 ferramentas** de `_frank/ferramentas/` — rodar todas, dizer quais
      **não têm modo seco**.
- [ ] **Provedores** — Gemini, OpenAI, DeepSeek, Kie autenticam? Apify só
      saldo. HeyGen do Lucas **nem toque**.
- [ ] **Build** — `tsc --noEmit` e `eslint` passam?
- [ ] **As três perguntas do fim**, e a última é a que mais importa:
      1. Como se aplica migration neste projeto?
      2. Quais ferramentas não têm modo seco?
      3. **Se você cair no meio da noite, quem te reinicia?**

## BLOCO B — Fechar o assunto do crédito

- [ ] Aplicar a **migration 79** (schema só).
- [ ] **Medir o casamento** do `/sales/history` por e-mail — antes do backfill.
- [ ] **Backfill**, com quem não casar ficando **pendente**, nunca `false`.
- [ ] **Conferir 5 pagantes conhecidos**: os 5 têm que vir `true`. 🛑
- [ ] **Card da trava** do débito (lê só a coluna).
- [ ] **Lista congelada** pelo critério de pagamento, com `ORDER BY` corrigido
      e saldo carimbado. 🛑
- [ ] As **duas limpezas** no servidor (winback/social pra 5 min; variável
      órfã), uma de cada vez, com cópia antes.
- [ ] Ampliar o **playbook M** com o caso da variável órfã.

## BLOCO C — Os números

- [ ] **Trial × venda** das 756: quantas trial, quantas pagas, quantas pagas
      ativas hoje, e **quantos trials converteram**.
- [ ] **O período** do `BRL 847.018,43` e do `USD 15.881,26`.

---

## 🛑 As duas únicas coisas que te fazem parar e me chamar

1. **Um dos 5 pagantes conhecidos vier `false`** no backfill. Aí o
   cruzamento está errado e a trava **não sobe** — o `DEFAULT false` faria o
   produto parar pra todo mundo.
2. **A lista congelada pronta.** Zerar crédito precisa do ok do Johnny sobre
   **aquela** lista. Mande: quantas pessoas, quanto somam, as 5 maiores.

Fora essas duas, **decida e siga**. Você tem o manual, os playbooks e as
regras — e hoje você acertou toda vez que parou pra pensar.

## Formato do relatório final

Os três blocos, com ✅ / ⚠️ / ❌ por item e a evidência de uma linha. Depois,
as três listas de sempre:

1. **O que vai me travar com o Johnny viajando** (o que é ❌ sem contorno).
2. **O que tem contorno** — e qual.
3. **O que descobri de quebrado** que ninguém sabia.

## O que NÃO é pra fazer agora

Vigia noturno além da espinha, detector novo, zeramento sem o ok, e qualquer
coisa que gaste GPU ou crédito. Isso fica pra depois que a prova fechar.
