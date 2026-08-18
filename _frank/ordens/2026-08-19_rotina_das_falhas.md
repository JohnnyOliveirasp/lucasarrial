# ORDEM — A rotina das falhas (o que o Johnny pediu)

Pedido dele, direto: *"de tempos em tempos ir ver as falhas de sistema e
corrigir se houver, e depois que corrigir — ou se já estiverem resolvidas —
fechar o assunto."*

Você já fez isso duas vezes hoje. Agora vira **rotina**, não iniciativa.

---

## 1. Como a fila chega até você (já funciona, não mexa)

A Fast responde os e-mails do suporte@ a cada 5 min. **Quando ela não
resolve**, ela abre um incidente sozinha na aba Falhas
(`reported_by: 'fast'`), com o aluno, o relato dela e os prints. Reclamação
repetida do mesmo aluno **soma ocorrência** no mesmo incidente em vez de
abrir outro.

⚠️ **Ninguém te avisa.** Não existe e-mail nem gatilho pra você — e isso é
bom: e-mail atrasa, cai em spam, ou trava num anexo grande (foi o que deixou
a Fast 2 dias muda em 08/08). **Você vai buscar**, não espera chegar.

⚠️ E **não leia a caixa do suporte@**. A Fast pega os não-lidos e marca como
lidos; vocês dois lendo se atropelam. A fila de incidentes é a sua fonte.

## 2. A rotina

**De hora em hora, durante o dia** (das 8h às 22h BRT). É barato: quase toda
rodada não vai ter nada.

Para cada incidente aberto, do **mais antigo pro mais novo**:

1. **Já está resolvido?** Muita coisa se resolve sozinha (o sweep pegou, o
   aluno refez, o estorno saiu). Confira o estado real antes de investigar —
   é o caso mais comum e o mais rápido.
2. **Tem playbook?** `04_PLAYBOOKS.md` cobre voz travada, áudio insuficiente,
   imagem falhando, vídeo preso, pagamento, onboarding, cobrança dupla.
   Aplique a receita.
3. **Corrigiu?** → `fixed` na hora, com `resolution_note` dizendo **o que era
   e o que você fez**, e o commit se houve. **Avise o aluno.**
4. **Erro do próprio usuário?** → `ignored`, com a nota explicando.
5. **Não sabe?** → deixe `investigating` **com uma nota do que já descartou**,
   e escale. `investigating` sem nota é o mesmo que não ter olhado.

**Nunca marque `fixed` sem ter resolvido** (regra 14) e nunca deixe
`investigating` o que já acabou.

## 3. O aluno vem antes do incidente

Se tem alguém esperando, ele é a prioridade — não a limpeza da fila. **Aluno
pagante travado sem solução: me avise na hora**, não espere o relatório.

E se passar de **24h** sem causa encontrada, escreva pro aluno mesmo assim,
dizendo a verdade: o que você já descartou, que está investigando, e que ele
não perdeu crédito. Foi o silêncio que fez a Viviana explodir.

## 4. Um relatório por dia, à noite

Não me mande uma mensagem por incidente. **Um relatório**, no formato do
`06_RELATORIO_E_LIMITES.md`: o que você resolveu primeiro, o que precisa de
mim (curto e binário), o que subiu pra produção, e o estado geral.

**Mande mesmo em dia limpo.** "Varri X, nada preso, nenhum incidente aberto"
é informação — silêncio não pode parecer saúde.

## 5. Junte com a varredura que você já agendou

Você já tem a rotina das 8h com o `varredura_travados.cjs`. Ela cobre o que
**trava sem ninguém reclamar**; esta cobre o que **alguém reclamou**. As duas
juntas são a rede inteira, e é isso que o vigia noturno vai automatizar
depois.

Enquanto o vigia não existe, **você é o vigia.**

## 6. O que não fazer sozinho

Continua valendo o `06_RELATORIO_E_LIMITES.md`: nada que gaste GPU ou crédito
sem o aluno pedir, nada de e-mail em massa novo, nada de migration sem aval,
nada de mexer em produção fora do fluxo. Na dúvida, faça o que é **seguro e
reversível** e mande a pergunta binária.
