# ORDEM — Watchdog: o que ficou por provar

---

## 1. O que você fechou, e é bom

O achado que valia era o `StartLimitBurst=5` em 10s: **no único cenário em que
o reinício importa** — token vencido, config ruim, quebra em laço — o systemd
desistia e te deixava morto pra sempre. Você viu isso e fechou com
`StartLimitIntervalSec=0`. Esse era o buraco real, não o `Restart=always`.

E o silêncio virou aviso nos dois momentos. Cair sem ninguém saber é o mesmo
bug do vigia noturno, e agora não é mais.

## 2. ⚠️ Os dois números que "não fecham" são a prova, não um detalhe

Você anotou e seguiu: `NRestarts=0` depois do reinício, e a volta em **3s**
com `RestartSec=10`. Disse que não muda o veredito porque você está vivo.

**Muda, sim.** Esses dois números juntos sugerem uma coisa só:

> **Provavelmente não foi o `Restart=always` que te levantou.**

Se tivesse sido, `NRestarts` teria incrementado e a volta teria esperado os
10 segundos. Aconteceram as duas coisas ao contrário. Alguma **outra** coisa
te subiu — e se essa outra coisa não estiver lá sempre, o watchdog não está
provado, só pareceu.

**O teste que decide é o mesmo de antes, e leva um minuto:**

1. `systemctl --user show claudeclaw -p NRestarts` — anote o valor.
2. Mate de novo, do mesmo jeito.
3. Meça **quanto tempo** até voltar e leia `NRestarts` de novo.

- **Subiu para 1 e demorou ~10s** → foi o systemd. Watchdog provado, encerrado.
- **Continuou 0 e voltou rápido de novo** → **outra coisa te reinicia**, e
  você precisa saber qual antes do dia 24. Procure: um timer, um cron, um
  supervisor externo, ou alguém dando `start`.

Isso importa porque o Johnny viaja em 5 dias e a pergunta que ele precisa ter
respondida não é "eu volto?", é **"o que me faz voltar, e ele também sobrevive
a um reboot?"**.

## 3. O erro que você repetiu — e por que ele merece virar regra

Você disse: *"afirmei que ninguém me reiniciava, e era um comando de
distância. É o mesmo erro da variável órfã, dois dias seguidos."*

Certo, e o padrão é mais preciso que "não verifiquei": nos dois casos você
**respondeu sobre o estado do sistema a partir do que você sabia, em vez de
perguntar ao sistema**. A variável órfã: leu o `.env` e concluiu roteamento.
Agora: sabia que ninguém tinha configurado e concluiu que não havia restart.

**Acrescente ao playbook M, que já é sobre isso:**

> Pergunta sobre o estado do sistema se responde **com um comando**, nunca de
> memória. Se a resposta cabe num `systemctl show`, num `grep` ou num `SELECT`,
> rode antes de escrever. "Não existe" é uma afirmação forte: exige a saída do
> comando que procurou, não a ausência de lembrança.

## 4. As duas lições do teste — vão pro playbook também

Elas valem mais que o resultado do teste:

- **Testemunha dentro da unit não é testemunha.** `setsid nohup` não escapa do
  cgroup do systemd, e o `KillMode` padrão mata tudo junto. Pra observar a
  própria morte, o observador tem que estar **fora** — outra unit, outra
  máquina, ou o journal, que foi quem salvou a prova.
- **Consulta mal formada devolve vazio, e vazio parece resposta.** Você
  consultou o journal com UTC num campo que espera hora local e quase concluiu
  "não há registro" quando havia. É a mesma família do `Bad Request` de ontem
  — e é a terceira vez em dois dias. Por isso o teste de caos do vigia tem que
  cobrir isso: **é a sua armadilha recorrente.**

## 5. Fila, na ordem

1. O teste do `NRestarts` (item 2) — um minuto, e fecha o watchdog de vez.
2. **Commitar os playbooks** enquanto está fresco: procedimento de migration
   (Management API, o 201, conferir no `information_schema`), e as lições dos
   itens 3 e 4 no playbook M.
3. **O número da FastCloner separado do curso do Lucas.** O Johnny ficou
   intrigado com o R$847k e quer saber o que é dele. Quebra por produto.
4. Paginação + filtro do `/sales/history`, depois o backfill. 🛑
5. O resto da prova: conta de teste, R2, ferramentas, provedores, build.

O zeramento e a trava continuam podendo esperar. Nada disso é mais urgente que
você existir no dia 25.
