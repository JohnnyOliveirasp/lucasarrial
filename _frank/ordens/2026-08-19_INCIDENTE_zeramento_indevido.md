# INCIDENTE — A varredura zerou 14 clientes pagantes

---

## 1. O que você fez certo depois do erro

Detectou em minutos porque **foi conferir quem tinha sido pego** — ninguém
mandou. Desligou antes da próxima rodada, devolveu os 1.356.554, conferiu
conta por conta depois de gravar, marcou o lançamento como estorno de engano
e desfez a marcação indevida. E contou sem maquiagem.

Isso é resposta a incidente bem feita, e é por isso que o estrago parou em
dez minutos em vez de um dia.

## 2. O que você fez errado, e não foi "faltou dry-run"

Foi mais específico que isso: **a barreira existia e você passou por ela.**

Está escrito em `2026-08-19_FECHAMENTO.md` e repetido em
`2026-08-19_watchdog_primeiro.md`:

> 🛑 **Conferir 5 pagantes conhecidos**: os 5 têm que vir `true`. Se **um** só
> vier `false`, o cruzamento está errado e **a trava não sobe**.
>
> O backfill fica parado — e está certo assim. **Não force.**

Esse portão existia exatamente pra este caso. Você tinha, inclusive,
**descoberto a causa provável ontem** e parado por causa dela.

**Você não errou por falta de aviso. Errou por não aplicar o que já sabia.**

## 3. A causa provável, e você já a conhece

> A API da Hotmart devolve **só os últimos 30 dias** por padrão.

Foi você que achou isso, e foi por isso que você parou o backfill. Quem pagou
antes de 18/07 e cancelou **não aparece** — e vira "nunca pagou".

Os 14 batem com esse perfil: `ddfleury` pagou e o acesso venceu em **07/08**,
`lineucastilho22` tem 5 cobranças. O `marked_paid: 231` funcionar pra maioria
é coerente: a maioria pagou **dentro** da janela.

**Confirme antes de qualquer conserto:** dos 14, quantos têm a última cobrança
paga **anterior a 18/07**? Se for a maioria, a causa está fechada e o conserto
é a paginação mês a mês que já estava na fila.

## 4. ⚠️ A incerteza que você declarou é verificável — não deixe como incerteza

Você disse que não sabe se alguém tentou gerar na janela de 10 minutos. **Dá
pra saber.** Procure, para os 14 `user_id`, no intervalo entre o débito e a
devolução:

- geração/treino/clone recusado por saldo insuficiente;
- resposta 402 nas rotas;
- qualquer linha criada e revertida.

**Se ninguém tentou:** ninguém foi afetado, e não há o que comunicar. Fim.
**Se alguém tentou:** essa pessoa recebe e-mail hoje, com a verdade — houve um
erro nosso, o crédito voltou, e o que ela tentou fazer pode refazer sem custo.
Não espere ela reclamar.

Incerteza que se resolve com uma consulta não é incerteza, é consulta não
feita. Isso é o mesmo padrão que já te pegou quatro vezes.

## 5. O card 1f5a4a03: acrescente três coisas

Seu critério de aceite está certo (os 14 casos reais como teste). Faltam:

1. **Dry-run contra produção é obrigatório e permanente**, não só desta vez.
   Toda rodada nova, mesmo depois de aprovada, roda seca e mostra a lista
   antes de encostar em saldo.
2. **Teto por rodada.** Uma varredura que resolve zerar 111 pessoas de uma vez
   devia ter parado sozinha e pedido confirmação. Ponha um limite: acima de
   N, ela **para e reporta** em vez de executar.
3. **O caso do backfill não-casado.** Quem a Hotmart não confirma **não é
   "não pagou"** — é **desconhecido**, e desconhecido **nunca** é debitado.
   Essa é a assimetria que já está registrada: falso negativo apaga dinheiro,
   falso positivo só deixa passar.

## 6. Regra nova, e vai pro manual

> **Nada que mexe em saldo de aluno roda em produção sem dry-run seco antes,
> com a lista de afetados na tela — nem que os testes tenham passado.**
>
> Teste em banco limpo prova que a lógica funciona. Ele **não** prova que o
> dado real cabe na lógica. As duas coisas são diferentes, e é sempre a
> segunda que quebra.

## 7. Sobre voltar a rodar

Concordo com você: a varredura **não volta** até os 14 passarem no teste. E
está certo o raciocínio — trial que sair amanhã ficando com 100 mil é muito
melhor que pagante zerado. **Erre sempre pra esse lado.**

## 8. O que eu quero de volta

1. Os 14: quantos com última cobrança anterior a 18/07 (item 3).
2. A consulta da janela de 10 minutos (item 4) — e o e-mail, se alguém tentou.
3. Confirmação de que a função continua desligada.

Nada além disso agora. O resto da fila espera.
