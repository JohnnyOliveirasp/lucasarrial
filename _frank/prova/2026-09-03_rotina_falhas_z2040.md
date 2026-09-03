# Ronda das falhas — 03/09/2026, 20:40Z (17:40 BRT)

> **Arrumei o nome do arquivo, que a ronda anterior deixou anotado como dívida.**
> Os rótulos de hoje (`10h`, `12h`, … `23h`) estavam ~3h adiantados em relação
> ao relógio e não eram horário nenhum — eram só contador para o `ls | tail`
> ordenar. A ronda das 19:40Z se chamou `23h`; esta, uma hora depois, não tinha
> rótulo possível (`24h` não existe) e ia quebrar na virada do dia.
>
> Convenção nova, a partir daqui: **`_zHHMM` = hora UTC de verdade**. O `z`
> minúsculo (0x7a) ordena depois de qualquer dígito, então `z2040` cai **depois**
> de `23h` no `ls`, os arquivos antigos continuam onde estão, e os novos ordenam
> entre si pelo horário real. O nome voltou a ser informação em vez de enfeite.

Serial: **#222** (`3ca22d47`, alunos pagantes presos fora da própria conta) —
segue sendo o aberto mais antigo com aluno afetado (01/09 15:54Z). Terceira
ronda no mesmo serial, mudando de item dentro dele.

## Fila conferida antes de escolher

`varredura_travados.cjs`: **5 abertos**, 9 em `aguardando_aluno`, 2 presos.
Os 5 abertos são #222, os dois de áudio (decapitado / QA reprovado), a Katia e
o "não conta nada na plataforma". Ordem por idade:

```
#222              01/09 15:54Z   ← serial
QA reprovado      01/09 17:52Z
Katia "VOCÊ"      02/09 15:40Z
palavra decapitada 02/09 16:15Z
não conta nada    02/09 20:38Z
```

## Dois casos que eu chequei antes de deixar passar

Nenhum dos dois furou o serial, mas os dois **pareciam** urgência e a checagem
custou uma consulta cada. Registro para a próxima ronda não repetir o susto.

**`marcelopersonalthe32`** — 🚨 na varredura: 198.950 créditos, 24 dias sem voz,
acesso vence **05/09, daqui a 2 dias**. Já tem **três cartas** enviadas (24/08,
27/08, 29/08), a última confirmando por escuta manual que o áudio tem duas
pessoas e avisando do prazo. Bola com ele. Não escrevi a quarta.

**`luanmarcal.com`** — import quebrou 29/08 (6 dias), Drive fechado. Li a caixa:
além dos automáticos da régua, tem a carta longa de **30/08** (uid 347) que já
explica o link fechado, que o retomar automático foi desligado em 29/08, os dois
caminhos para reenviar e o extrato conferido. Bola com ele há 4 dias. O gatilho
de segunda tentativa da varredura é **7 dias** — ainda não venceu. Não escrevi.

## O item levado até o fim: `rutifortuna8@gmail.com`

**Ruti Fortunato da Silva** · entitlement `e04a3806` · `external_id` WEVYYE64 ·
transação `HP0387096186` · assinatura ACTIVE · janela até **20/09 12:00Z** ·
documento e endereço não transcritos aqui (repo é público) — estão na nota do
incidente.

### A checagem que a ronda anterior mandou fazer primeiro

`ler_caixa.cjs --enviados --para rutifortuna8@gmail.com` → **1 resultado**:
uid 81, de **25/08**, a mala direta genérica. Nenhuma carta de órfã. Qualifica —
e eu sei por medição, não por herdar a fila.

### O que medi — cada zero com controle positivo

| medição | resultado | controle que prova que a consulta enxerga |
|---|---|---|
| `profiles` pelo e-mail da compra | **0** | 1.823 perfis, **todos** com `email` e `display_name` |
| `profiles` por nome (`ruti` / `fortunato`) | **0** | mesmo controle |
| `auth.users` pelo e-mail | **0** | 1.823 usuários |
| `onboarding_runs` | **0** (nunca tentou) | — |
| documento em `payment_events` (caminho `data->buyer`) | **1 e-mail, o dela** | **4.140** de **5.475** eventos têm documento |
| `ucode` da Hotmart em `payment_events` | **1 e-mail, o dela** | — |

**Não existe conta candidata sob nenhum outro endereço.** Diferente dos casos
#214/#218, aqui o "crie a conta com este e-mail" é a orientação correta, não o
genérico preguiçoso.

### Pagamento conferido na Hotmart viva

Pagou de verdade (`value > 0` **e** COMPLETE). Comprou a mesma cesta de sempre:
Fábrica de Conteúdo Invisível (19/08), Sistema de Geração Pronto (20/08) e a
assinatura do FastCloner (20/08).

**Linha do tempo dos eventos, que rendeu um fato para a carta:**

```
20/08 16:50:12  PURCHASE_CANCELED   HP0341311067  status CANCELED   assinatura INACTIVE
20/08 16:50:37  PURCHASE_APPROVED   HP0387096186  status APPROVED   assinatura ACTIVE
28/08 10:25:11  PURCHASE_COMPLETE   HP0387096186  status COMPLETED  assinatura ACTIVE
```

Primeira tentativa de checkout caiu; **25 segundos depois** a segunda passou. A
cancelada nunca virou APPROVED nem COMPLETE — **não houve cobrança dupla**.
Disse isso na carta antes que ela perguntasse.

### O dado da carta saiu do código, relido por mim

`claim.ts` — `if (e.access_until && e.access_until <= nowIso) continue;`
Passada a janela de 20/09, o ciclo **não** é concedido sozinho no login.
`credits/config.ts:7` — `PLAN_MONTHLY_CREDITS = 100_000`.

A carta pede que ela entre antes de 20/09 por isso, não por urgência inventada,
e promete que **eu acerto na mão** se passar — sem prometer prazo nem mecanismo
(**regra 13**).

### Entregue

- `--dry-run` conferido (destinatário, remetente, corpo inteiro na tela).
- Enviada pelo SMTP do `suporte@fastcloner.com` — **uid 498**, tentativa 1,
  **cópia CONFIRMADA** em Enviados.
- Nota no #222: **12 → 14**, duas notas, 1 linha afetada cada, conferidas na
  releitura. A nota 13 (20:44:42Z) é o tratamento da órfã; a **14** (20:48:32Z)
  é a armadilha de moeda da seção abaixo. *(Esta linha dizia "12 → 13" — foi
  escrita antes da segunda nota existir e o arquivo foi commitado 8s depois
  dela. Corrigida na conferência de fechamento; contagem no banco: 14.)*
- Fato consumado postado **no grupo** (`notify-grupo.sh`).

## ⚠️ Armadilha de instrumento — achada e CORRIGIDA nesta ronda

Ruti é do **Paraguai** e paga em **guaranis**. O `pagou_de_verdade.cjs` —
o instrumento que decide se um aluno pagou, usado toda ronda — imprimia `R$`
**fixo** em toda linha e somava moedas diferentes num total único:

```
antes:   PAGOU | avulsas pagas: 2 (R$ 918549.20)
         assinatura rec#1 R$118887 COMPLETE
```

A assinatura dela é **118.887 Gs (~R$88)**. Lida como reais, a linha faz a aluna
parecer cliente de **R$918 mil**. Se eu tivesse escrito "vi que você investiu
R$918.549 conosco" na carta, era vexame na frente da aluna.

**Não é caso isolado — medido:** 247 de 4.142 eventos com preço (**6%**) não são
BRL — 120 USD, 98 EUR, 7 PYG, 6 ARS, 5 JPY, 4 CHF, 3 GBP, 2 AUD, 2 CAD. Em
**JPY** o erro inverte e piora: ¥2.000 sairia como `R$2000`.

Corrigido e **em produção**: PR **#170**, merge **`4cd9775`** na main. Agora
nenhum valor aparece sem a moeda ao lado, totais são **por moeda**, e sai uma
linha de aviso quando a conta não é BRL. **Sem conversão de propósito** — não
temos câmbio da data, e chutar cotação para dizer número a aluno é pior que
mostrar duas moedas.

**O veredito `pagou` não mudou** (olha `value > 0` + status, que independe de
moeda): ninguém passa a contar como pago ou não-pago por causa deste PR.
Regressão conferida em conta BRL (`flaviamalavazi`): **2356.74 BRL**, o mesmo
número da ronda anterior, e sem a linha de aviso.

```
depois:  PAGOU | avulsas pagas: 2 (918549.20 PYG)
         ⚠️  moeda diferente de real nesta conta: PYG. (...)
         assinatura rec#1    118887 PYG COMPLETE
```

## Fila restante do #222

> **Conferência de fechamento — a conta desta seção não fechava e eu fui medir.**
> Como estava escrito, dava 11 + 2 + 3 = **16** para uma fila de **15** (e a
> ronda anterior tinha o mesmo furo: 10 + 2 + 4 = 16). Reproduzi o funil e
> conferi a caixa de Enviados **um a um**, nos 15. O furo era **`jkakorio`
> contado duas vezes**: ele está na lista das cartas (**uid 480**, 03/09
> 09:23Z) *e* na dupla "sai por cobrança em dobro". Só `caplastica` sai por
> esse motivo. O total de três restantes estava certo — pelo motivo errado.

Funil reproduzido agora: **1.082** entitlements → **92** órfãos → **46**
`active` → **26** com janela vigente → **15** com preço > 0. *(Preço pelo
caminho **direto** do `raw_event`: o caminho `data`, que é o certo em
`payment_events`, lê **0 de 26** aqui — a armadilha que a ronda das 20hZ
levantou, e na qual eu bati de novo hoje antes de corrigir.)*

**Onze dos quinze têm carta individual** — conferido no Enviados, não herdado:

| # | aluno | carta | # | aluno | carta |
|---|---|---|---|---|---|
| 1 | `sbtirp` | 483 | 9 | `flaviamalavazi` | 496 |
| 2 | `max@md2net` | 491 | 10 | `qooqi.criacoes` | — |
| 3 | `cris_evangelista22` | 488 | 11 | `caplastica` | — |
| 4 | `josephgois` | 492 | 12 | `scandovieri41` | 481 |
| 5 | `isaias.enf` | 493 | 13 | `fmgimael` | — |
| 6 | `rmf174` | 495 | 14 | `malmeida313` | — |
| 7 | `jkakorio` | **480** | 15 | `dropweb` | 494 |
| 8 | `rutifortuna8` | **498** | | | |

**11 com carta + 4 sem = 15.** Agora fecha.

Dos **quatro** sem carta, um sai da fila: **`caplastica`** — cobrança em dobro,
**tem acesso**; carta de órfão nele seria erro (a ronda das 21hZ já tinha
pegado isso). Restam **três** de fato:

`qooqi.criacoes` 21/09 · `fmgimael` 29/09 · `malmeida313` 30/09

**Achado lateral da conferência, não investigado:** `caplastica` e
`qooqi.criacoes` têm **zero** mensagens no Enviados — nem a régua automática
chegou neles, enquanto `fmgimael` (317, 452) e `malmeida313` (372) receberam.
Não sei se é falha de alcance da régua ou exclusão legítima. **Não medi**, fica
como pista para a próxima ronda.

**Próximo da ordem: `qooqi.criacoes` (21/09)**, e nele a pista da ronda das 21hZ
segue pronta: perguntar se `moyses.filipe@gmail.com` é dele. Aqui a checagem por
documento/ucode que eu fiz hoje é o caminho — se devolver um segundo e-mail, é
vínculo na mão, não carta.

## Limites honestos desta ronda

1. A causa estrutural do #222 continua **intacta**: `claim.ts:39 →
   reconcileUserEntitlements` casa só por e-mail exato. Carta a carta é
   remediação, não conserto. Por isso o incidente segue `investigating`.
2. Não vinculei entitlement na mão — sem conta criada, não há em que ligar.
3. **Não investiguei o recorte `(sem oferta)`** (27 órfãos / 48 ligados = 36%,
   5,5× a taxa normal) que eu mesmo levantei na ronda anterior. Segunda ronda
   devendo essa. É a única pista viva da classe.
4. Não reverifiquei **#226**, **#234**, **#47**, nem os dois incidentes de áudio
   (decapitado / QA reprovado) nem a Katia. Não afirmo nada sobre eles.
5. Os recados em `para_frank_*` e o `patch_92b1cc85` seguem **não tratados** —
   quinta ronda seguida em que sobram.
6. Não abri o app, não ouvi áudio, não vi imagem: banco, envelope, Hotmart e git.

## Falha de ferramenta minha, fora do FastCloner — e o meu erro de diagnóstico

No começo da ronda o `mission-cli.js` morreu com `DB_ENCRYPTION_KEY is missing
or too short` (`dist/db.js:17`) e eu **quase registrei aqui que a ferramenta
estava quebrada**. Fui conferir antes de afirmar: a chave **existe** no `.env`
do FrankClaw. O problema era **meu**, não dela — esses CLIs carregam o `.env`
do diretório atual, e eu estava rodando de fora da pasta do projeto. Rodando
com o `cwd` certo, funciona.

Fica a lição, que é a mesma de sempre nesta rotina: **erro de instrumento e
erro de operador saem idênticos na tela**, e o barato é medir antes de acusar.
Se eu tivesse escrito "mission-cli quebrado", alguém ia caçar um bug que não
existe.

## O que NÃO fiz, de propósito

- Não escrevi para o Marcelo (3 cartas já foram) nem para o Luan (4 dias, o
  gatilho é 7).
- Não escrevi para os 3 restantes de uma vez: é **massa**, precisa do "pode"
  (**regra 8**).
- Não mexi em crédito, acesso, GPU nem migration.
- Não mergeei nenhum dos branches stale marcados no índice de ordens
  (`feat/onedrive-401`, `feat/fix-image-upload-retry`, os dois da cura de
  referência).
- Não escrevi documento nem endereço por extenso neste arquivo (repo é público).

## Fim de ronda

Um item levado até o fim (aluna avisada, nota gravada, grupo avisado), uma
armadilha de instrumento achada **e corrigida em produção** (PR #170, merge
`4cd9775`), a dívida do nome dos arquivos de log quitada, e duas urgências
aparentes conferidas e descartadas com medição em vez de palpite.

**Adendo da conferência de fechamento (20:55Z).** Reli este arquivo contra o
banco e a caixa antes de dar a ronda por encerrada, e ele tinha **dois erros
meus** — nenhum deles no que foi entregue à aluna, os dois no registro:

1. **"Nota no #222: 12 → 13"** — são **14** notas no banco. Escrevi a linha
   antes da segunda nota existir e commitei 8 segundos depois dela.
2. **A conta da fila não fechava** (11 + 2 + 3 = 16 para uma fila de 15), e a
   ronda anterior já carregava o mesmo furo sem ninguém notar. `jkakorio`
   estava contado **duas vezes**. Conferi os 15 um a um no Enviados.

O número final de restantes (**três**) estava certo nas duas rondas — o que
estava errado era o caminho até ele. Um total certo por raciocínio errado é
pior que um total errado, porque não dá sinal nenhum de que precisa conferir.
Se a próxima ronda tivesse partido daquela lista, ia procurar um décimo-sexto
aluno que não existe, ou escrever de novo pro `jkakorio` — que já tem a carta.

Nada disso mudou o que a Ruti recebeu: uid 498 conferido em Enviados, com
`118.887 Gs` no corpo, moeda certa.
