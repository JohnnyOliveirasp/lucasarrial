# Ronda das falhas — 26/09/2026, ~11hZ (rodou 10:40–11:0xZ)

> Conferi a primeira linha dos arquivos vizinhos antes de escolher o nome
> (aviso da ronda das 22h30: os nomes desta pasta não são índice confiável).
> `00h` e `10h` são do Vigia, `01h` é a ronda anterior; este é o `11h`.

**Método: serial (regra 8).** Um caso levado até o fim do que eu posso fazer
sozinho. O que sobrou está nomeado com o passo exato e com o dono.

**Esta ronda não fechou incidente.** Ela respondeu **uma aluna pagante** com
relógio de 1h19 correndo, e **corrigiu dois fatos que a casa tinha publicado
errados hoje de manhã** sobre essa mesma aluna — os dois de um jeito que
levavam à resposta errada.

**Produção tocada:** nenhuma. Zero GPU, zero migration, zero DDL, zero crédito
movido, zero assinatura reativada, zero código alterado. A única escrita foi:
1 carta, 1 nota em cartão existente.

**Ordem de 29/08 respeitada:** nada vindo da planilha foi lido, escrito,
classificado ou reprocessado. **Canal (ordem de 31/08):** os dois avisos saíram
**no grupo**, nada no privado do Johnny.

---

## Passo fixo 1 — reconciliar os envios (ordem de 18/09)

```
1321  lidas da pasta "Sent"      (01hZ: 1314 — +7 no intervalo)
1244    já tinham linha
   0    repetidas · 77 fora da janela (--corte) · 0 recusadas
   0    DENTRO DA JANELA — escrituráveis
✔ 1321 = 1321 · 🕳️ cartas sem linha dentro da janela: 0
```

Irmão de leitura independente (`2026-09-18_enviados_x_tabela.cjs`): **0 carta
depois do corte**. Veredito: buraco **PASSIVO**. Os dois instrumentos batem.

> A carta que eu mandei nesta ronda (§ caso serial) saiu **depois** desta
> medição: uid **3490**, linha gravada em `emails_enviados`
> (origem `ronda-manual`), cópia confirmada na pasta de enviados na 1ª
> tentativa. O controle compensatório do `#101` pegou a carta desta ronda.

⚠️ As 77 anteriores a 14/09 14:06:31Z seguem sem decisão — é o `--corte`, não
recusa. Escriturá-las é decisão de produção (`cobreDesde`), não de ronda.

## Passo fixo 2 — percepção travada (ordem de 17/09)

```
controle positivo OK (#310) · controle negativo OK (#518 descontado)
579 incidentes varridos
👁 SO PARAM POR FALTA DE VER/OUVIR/ASSISTIR: 0 · mais velho 0d
```

**Nada a despachar pro `olho`/`qa`.**

⚠️ Limite mantido do `#585` (Vigia, 22hZ de 25/09): este detector lê
`agent_notes[-1]` cru e é **cego em 13% da frota**. O `0` está certo **pelo
conteúdo que ele enxerga**, não pelo alcance. **Não leia como saúde.** Cartão é
de dono, não mexi.

## Passo fixo 3 — estado da fila

```
176 vivos = 156 abertos (20 open + 119 investigating) + 37 aguardando_aluno
403 fechados = 336 fixed + 67 ignored
579 total
```

Contra a ronda das 01hZ (571 total): **+8 cartões** no intervalo de ~10h, e
`fixed` foi de **337 → 336**. A queda de 1 em `fixed` é consistente com
reincidência reabrindo cartão fechado sozinha (é o comportamento esperado
desses status, e a razão pela qual `fixed`/`ignored` ficam fora do filtro de
percepção). **Não investiguei qual cartão foi** — fica anotado como ponta solta
desta ronda, não como fato explicado.

**Início e fim iguais:** não abri e não fechei cartão. Anotei 1 (`#551`).

---

## O caso serial: Graziela, e os dois fatos que a casa publicou errados

Peguei o `#551` pela prioridade da ordem ("aluno esperando vem ANTES da limpeza
da fila") somada à exceção da regra 8: **aluna pagante, acesso morrendo em
1h19, seis e-mails sem resposta desde 01:14Z**. Não era limpeza de fila.

### O que a casa vinha dizendo, e o que eu medi

A nota do Vigia das 10hZ afirma duas coisas. **As duas estão erradas**, e a
primeira levava a casa a dizer à aluna algo falso sobre o dinheiro dela.

**Correção 1 — "o produto que ela pediu pra cancelar não é nosso" está errado.**
O Vigia procurou em `payment_events` por `%presen%`, `%lucrat%`, `%comunidade%`
e concluiu *"0 linhas na base inteira → não passa pela nossa Hotmart, é do
curso do Lucas"*. Mas `payment_events` é a tabela de **webhook**, e ela só
recebe FastCloner e SGP. Consultei a **Hotmart viva** (`/sales/history`, nosso
`client_id`) e a compra está lá:

```
Comunidade Presença Lucrativa · R$ 1.803,60 · COMPLETE · 15/09 23:59Z
HP2619812517 · 12x CREDIT_CARD · is_subscription = false
```

**O método que falhou:** ausência em `payment_events` **não prova** ausência na
Hotmart — são fontes com coberturas diferentes. É a família do `#226`
(instrumento cego lido como zero), e é o mesmo erro que o rodapé do
`pagou_de_verdade.cjs` já manda evitar.

**Correção 2 — ela não é pagante de R$ 633,81. São R$ 2.913,24.** Hotmart viva,
`gtfinger@gmail.com`, tudo `COMPLETE`, tudo 12x no cartão, tudo de 15/09:

| produto | valor | transação |
|---|---|---|
| Comunidade Presença Lucrativa | **R$ 1.803,60** | HP2619812517 |
| Sistema de Geração Pronto | R$ 741,00 | HP3921850412 |
| Fábrica de Conteúdo Invisível | R$ 368,64 | HP3795268024 |

O `R$ 633,81` do Vigia é o campo `value` do **payload do webhook** do SGP; a
Hotmart viva devolve **741** pro mesmo produto. **Não repetir 633,81 como total
da aluna** — subestima em R$ 2.279,43.

### O achado que muda a resposta a ela

**R$ 1.803,60 ÷ 12 = R$ 150,30/mês.** É exatamente o *"acompanhamento mensal de
grupo por R$ 150"* que ela pede pra cancelar. **A história dela fecha.**

Mas `is_subscription = false`: **não é mensalidade, é parcela de compra única já
fechada.** Conferido nos dois lados — `/subscriptions` do `gmail.com` devolve
**vazio**, e o do `proton.me` só tem o FastCloner. **Não existe assinatura de
R$ 150 em nenhum dos dois e-mails.**

Consequência prática: **cancelar assinatura nenhuma faz aquela cobrança parar.**
Só reembolso mexe nisso. E ela escreveu *"sei que não vou conseguir fazer e vai
ser dinheiro posto fora"* — estava decidindo em cima de premissa errada,
inclusive achando que perder o FastCloner fazia parte de parar o R$ 150.

### Estado medido (banco + Hotmart, 10h45Z)

```
assinatura 0YL3T7E9 · Plano Founder · FastCloner
  status CANCELLED_BY_SELLER · next_charge 2026-09-26T12:00:00Z
profile gtfinger@proton.me  plan=pro  access_until 2026-09-26 12:00Z
  credits_subscription 97581 · last_seen 2026-09-26 04:25Z  (usou hoje)
profile gtfinger@gmail.com  plan=free  access_until NULL
  0 crédito · last_seen NULL  (nunca entrou — o dinheiro está aqui)
```

**`CANCELLED_BY_SELLER` = partiu do vendedor.** A aluna não cancelou. Está
cravado na Hotmart, não é interpretação minha.

⚠️ **Como ler o `access_until` dela, porque aqui a armadilha inverte.** Pra
assinante **ativo**, `12:00Z` é só a fronteira da cobrança — é a armadilha dos
147/68 que a ronda das 01hZ documentou. **Pra ela não é:** a assinatura está
**cancelada**, logo não vem cobrança nova, logo não vem renovação. Pra ela
`12:00Z` é **penhasco de verdade**. Confundir os dois casos aqui faria a casa
relaxar justamente no único em que o relógio é real.

Garantia do SGP: compra 15/09, fim **21/09** — **fora** da janela.

### O que eu fiz, e o que deixei de propósito

1. **Avisei o grupo às 10h4xZ**, marcado urgente, com a pergunta binária
   (reativar antes das 12:00Z ou deixar vencer) e a recomendação de reativar.
2. **Escrevi pra ela** (uid 3490): o erro foi nosso, a voz/vídeos/créditos
   estão intactos, a reativação está **sinalizada** como urgente — e disse com
   todas as letras que **não está feita**, porque não está. Expliquei o R$ 150.
   Sobre reembolso disse que **não é decisão minha** e que trago a resposta.
3. **Anotei o `#551`** com as duas correções e o método que falhou.

**Mantive `investigating` de propósito.** Quem deve o próximo passo é a **casa**
(reativação), não a aluna — `aguardando_aluno` mentiria sobre isso, que é
exatamente o defeito que a 2ª correção de 21/09 documentou. E cartão aberto
**mantém a Fast travada**, que é o que impede resposta automática por cima da
minha carta (`#415`).

**Não reativei, não mexi em crédito, não mexi em `access_until`, não decidi
reembolso.** Reativação é ação externa em plataforma de pagamento: é do dono.

---

## Pendências nomeadas (com dono e passo exato)

| # | o que falta | dono | relógio |
|---|---|---|---|
| `#551` | decidir reativar o FastCloner dela | **Johnny** | **12:00Z de hoje** |
| `#551` | decidir reembolso da Comunidade (R$ 1.803,60) — **prometi resposta a ela** | **Johnny / Lucas** | — |
| `#594` | vídeo não gerando — prometi olhar em separado | Frank (próxima ronda) | — |
| `#590` | teto do PM2: subir ou não (prova apagada às 06:15Z, defeito volta com o movimento) | **Johnny** | volta hoje |
| — | qual cartão saiu de `fixed` (337→336) | Frank (próxima ronda) | — |

**Não estou travado nelas:** as três primeiras têm dono nomeado e a pergunta
está feita. Sigo a regra 8 — o item saiu do meu colo.

## Limite desta ronda, dito na cara

Eu **não sei** se a aluna vai manter o acesso ao meio-dia. Eu fiz o que estava
na minha alçada (medir, escrever pra ela, escalar com relógio) e **parei onde
começa a alçada do dono**. Se ninguém responder até 12:00Z, ela perde o acesso
por um cancelamento que a casa fez errado — e isso estará registrado aqui como
decisão não tomada, não como acidente.
