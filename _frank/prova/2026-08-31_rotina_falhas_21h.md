# Ronda das falhas — 31/08/2026, 20h30–21h00 UTC (Frank)

Método serial (regra 8, ordem de 21/08). Ordem de 29/08 respeitada: **nada da
planilha foi lido, escrito, classificado ou reprocessado**; nenhum incidente de
causa-planilha aberto, reaberto ou comentado. Canal: tudo no **grupo**
(`notify-grupo.sh`), conforme a ordem de 31/08. **Nenhuma mensagem no privado.**

## Placar

- Fila no início: **9 investigating + 2 aguardando_aluno** (11 abertos).
- Fila no fim: **9 investigating + 2 aguardando_aluno** (11 abertos).
- Fechados: **1** (#208, como **duplicata** — não como resolvido).
- Reaberto por ocorrência nova durante a ronda: **1** (#213, 20h45Z).
- Alunos respondidos: **0** — e o porquê de cada um está escrito abaixo.
- Fix subido: **0**. Nenhum código novo — nada preso em branch.

O saldo da fila não mudou porque **fechei um e um outro reabriu no meio da
ronda**. O número parado esconde duas mexidas reais; por isso as duas estão
datadas aqui.

---

## O caso serial: a fila estava contando a mesma aluna duas vezes

**#205 e #208 são a MESMA pessoa** — Cristina (`comercial@roteironamao.com`) —
com o **mesmo pedido**: liberar os 100.000 créditos para testar o Vídeo Clone
antes de assumir a mensalidade. O #205 nasceu do chat do app às 12h58Z; o #208
do e-mail às 14h20Z. Dois registros, um problema, uma pessoa.

Isso não é só cosmética de fila: quem respondesse um deixaria o outro aberto
parecendo aluna ignorada, e o placar de "quantos alunos esperam" estava inflado
em um.

**Fechei o #208 como `ignored`/duplicata, nunca `fixed`** — nada foi consertado,
e a regra 14 continua inteira. O #205, mais antigo, fica dono único. **Antes de
fechar**, levei para o #205 o único fato que só o #208 tinha, para não se perder.

### O fato que eu confirmei (e que dá razão a ela)

A reclamação dela é que só soube da assinatura **depois** de já ter mandado foto
e áudio. Fui aos Enviados conferir o relógio, em vez de repetir a nota:

| uid | horário (28/08) | assunto |
|---|---|---|
| 245 | 14:51:20Z | Começamos a preparar a sua plataforma |
| 246 | 14:51:27Z | Processando as suas imagens |
| 247 | 14:51:50Z | Processando o seu áudio |
| 248 | **14:57:39Z** | Seus arquivos estão prontos — **falta só o acesso** |

O uid 248 é o **primeiro** que menciona assinatura. `14:57:39Z = 11h57 BRT`,
batendo exatamente com o horário que ela relatou. Ela mandou o material e foi
informada da mensalidade **6 minutos depois** de ele já estar processado. **Não
é impressão dela.**

### O dano que segue de pé

Com o instrumento **já corrigido** (PR #138), ela **PAGOU R$ 185,61** em 27/08:
R$ 56,46 (HP2564485969) + R$ 129,15 (HP1928880786), os dois produtos do curso.
Nenhuma assinatura FastCloner.

Mesmo assim, no chat do app às **12h58:21Z**, a Fast escreveu a ela *"Você fez o
período de teste (R$0, primeiros 7 dias)"* — tratando como quem não pagou alguém
que tinha pago R$ 185,61 quatro dias antes. O **Vinicius (#202) recebeu correção
escrita às 17h47Z** (Enviados uid 388). **Ela não recebeu nenhuma.**

**Não escrevi a 4ª mensagem hoje, de propósito.** Ela já recebeu três e-mails
(14h20, 14h30, 14h35), todos dizendo "a equipe responde". Uma quarta sem
definição nova é ruído em cima de quem já está irritada — mesmo critério que a
ronda das 20h aplicou ao Márcio. **A dívida com ela não é mais uma mensagem, é a
decisão.**

## O achado da ronda: #213 reabriu, e não é recaída

Fechado `fixed` às 19h38Z (como apagar fotos — respondido). Às **20h45:15Z**
entrou ocorrência **nova** do mesmo aluno, pelo mesmo canal, e o agrupador jogou
**dentro do mesmo incidente**: `occurrences` 1→2, `resolved_at` voltou a NULL,
status voltou a `investigating`.

**O estrago é de leitura.** O **título** continua dizendo *"aluno quer saber como
apagar fotos"* — já resolvido — enquanto a **descrição foi sobrescrita** pela
queixa nova: *"insatisfeito com o realismo dos dentes no Vídeo Clone, foto já bem
enquadrada"*. Título e descrição se contradizem no mesmo registro. Quem pegar
pelo título trabalha no problema errado e ignora a reclamação que está esperando.

É o mesmo vício que o Vigia anotou às 20h no #206: **título de chamado não é
fato.** Aqui ele apareceu por um caminho novo — não pelo rótulo errado na
abertura, mas por **reabertura que reaproveita a assinatura antiga**.

A queixa real é **qualidade do Vídeo Clone**, com a foto **já bem enquadrada** —
ou seja, o caminho fácil ("melhore o enquadramento") **não se aplica**. Isso põe
o caso na mesma classe do #99, #192 e #207: teto do motor, não defeito.

**Não respondi, e digo por quê:** entrou 5 minutos antes do fim da ronda, e essa
classe exige olhar a geração específica dele. Não fecho no automático nem mando
meia resposta às pressas para um assinante ativo. **Fica no topo da próxima
ronda**, com o alvo já identificado — o próximo começa pela geração, não pelo
título.

## O que eu verifiquei em vez de herdar

- **#99 (Luciano) — ele NÃO respondeu.** Última mensagem dele segue sendo a uid
  372, de 28/08 20:53 BRT: **três dias de silêncio**, e nada depois da correção
  de prazo das 11h43Z (uid 365). **O prazo fecha 01/09 — amanhã.** O plano já
  está registrado: se pediu, reembolso; se não pediu, `ignored` com
  reclassificação, **nunca `fixed`**. Até o fim desta ronda, **não pediu**.
- **`marcelopersonalthe32@gmail.com` — a ronda das 20h o indicou como próximo
  caso serial. Investiguei e NÃO há passo nosso.** Já recebeu **três** e-mails
  (24/08, 27/08 e 29/08 — este último com análise **feita de ouvido** em 8 pontos
  do arquivo, confirmando duas pessoas), o crédito foi **devolvido em 10/08**
  (+10.000) e ele **nunca respondeu**. Apliquei a armadilha documentada e **listei
  os arquivos primeiro**: 1 mp3 real de 47min05s, passa o portão de 20min com
  folga — **não** é o caso da foto do Drive em `raw_audio_paths`. Pagante de
  verdade (R$ 368,64 + R$ 97). **Fica registrado para ninguém reinvestigar isto
  na próxima ronda** — a varredura vai continuar sinalizando ele, e não há o que
  fazer além de ele responder.
- **PR #138 está no ar e o instrumento enxerga.** Mergeado 19h39:52Z; conferi na
  **main** que o `sales/history` está em `pagou_de_verdade.cjs:101`, e a minha
  própria consulta do Marcelo voltou "avulsas pagas R$ 368,64". O item 4 do
  "precisa de gente" das 20h está **resolvido**.
- **#192 segue travado em ouvido humano** (áudios no grupo desde 29/08).

## Por que não fechei mais nada

Não por falta de tentativa: **os que sobraram não são meus.** #173, #192, #196,
#202 e #205 são **cinco alunos que pagaram, nenhum pela assinatura**, todos
parados na **mesma** pergunta comercial — o que a compra do curso dá direito
dentro do FastCloner. **Uma resposta fecha os cinco.** #207 e #212 são o Márcio,
com reembolso já escalado como urgente.

Backlog que não baixa porque o que sobrou depende de decisão humana é resposta
legítima (regra 14). O que eu não faço é marcar `fixed` para o número cair.

## Fim de ronda

`git fetch origin` + `git log --oneline origin/main..HEAD` **vazio** após o
commit deste log; `git status --short` limpo, `git branch --show-current` = main.
Nenhum código novo, logo **nada preso em branch**.

## Precisa de gente (nesta ordem)

1. **#99 Luciano — o prazo é AMANHÃ (01/09) e ele não pediu nada.** Depois disso
   a decisão fica tomada pelo silêncio.
2. **#212 + #207 Márcio — reembolso pedido**, com promessa escrita de retorno.
3. **UMA decisão, não cinco:** o que a compra do curso dá direito dentro do
   FastCloner. Fecha #173, #192, #196, #202, #205. **A Cristina (#205) é a mais
   exposta**: pagou, tem razão na crítica, e foi tratada por escrito como quem
   não pagou — sem correção até agora, enquanto o Vinicius recebeu a dele.
4. **#192 — alguém precisa OUVIR os três áudios** que estão no grupo desde 29/08.
