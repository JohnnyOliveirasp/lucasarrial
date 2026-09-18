# Ronda das falhas — 18/09, 16h45–17h00Z

Dono da fila (14-A). Método serial da ordem de 21/08.

## Passo fixo: reconciliar os envios (ordem de 18/09)

Rodado antes de tocar na fila, com os dois instrumentos:

```
2026-09-18_reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar
  646 lidas da pasta "Sent" = 569 já tinham linha + 77 fora da janela + 0 recusadas
  DENTRO DA JANELA, escrituráveis: 0  → nada a fazer
  ✔ 646 = 646, nenhuma carta sumiu na classificação

2026-09-18_enviados_x_tabela.cjs  (irmão de leitura, independente)
  VEREDITO: 0 carta depois do corte ficou fora da tabela
```

Os dois fecham em **0**. As 77 anteriores a 14/09 14:06:31Z seguem **sem decisão**
— é o que o `--corte` exclui de propósito, e continua sendo decisão de produção
(`contato-tentativas.ts` declara `cobreDesde` obrigatório), não de ronda.

## A classe de percepção (ordem de 17/09)

Consulta de apoio rodada junto com a contagem de abertos, como manda a ordem:

| momento | cards na classe | mais velho |
|---|---|---|
| medido em 17/09 (ordem) | 13 | 16 dias |
| **início desta ronda** | **17** | 17,0 dias |
| **fim desta ronda** | **13** | 17,0 dias (#226) |

A classe **cresceu de 13 para 17** entre a ordem e esta ronda. Fechei 4 e ela
voltou a 13 — mas o mais velho **não se moveu**: continua o `#226`
(`702cc916`, fotoatleta, 17,0 dias).

**Ressalva honesta sobre esse número:** a consulta é um `ILIKE` solto em
`agent_notes` por "assistir"/"ouvir"/"precisa olhar". Conferi card a card e
**ela é barulhenta** — pega nota que só *menciona* a palavra (ex.: `#460`
caixa-cheia, `#438` chave gasta, `#450` convite órfão não dependem de
percepção nenhuma). Dos 17, só **3 tinham artefato de verdade**
(`attachment_path` preenchido). Tratar os 13 como "13 casos cegos esperando
olho" superestima o problema; o número serve de rede, não de contagem.

## O que fechei — 4 cards, todos medidos no banco antes de fechar

### João Soares — `#449` + `#453` + `#454` (3 cards, mesmo aluno)

Era exatamente o padrão que a ordem de 17/09 nomeou: **o aluno voltou três
vezes** e virou três cards. O Vigia mediu em 18/09 10hZ e deixou "PRONTO PRA
FECHAR (não fecho: 14-A)". **Não herdei a nota — remedi:**

```
voices: 2d528ed2 "Voz principal Caco Mentor" · status READY
        criada 18/09 00:37:38Z · pronta 00:43:37Z (5m59s)
credit_transactions: -10.000 kind=training ref_type=voice em 00:38:38Z
uso posterior: -674 (generation) · -671 (generation) · -525 (image)
```

O débito de 10k é **cobrança legítima**: comprou um treino que **entregou**.
Nada a estornar. Ele não só destravou — está produzindo.

**O que era:** ele nunca chegou a submeter o formulário. Os zeros que quatro
rondas mediram (0 voices, 0 training_jobs, 0 débito) eram **reais e coerentes**,
não falha de despacho nossa. Ele desistia no passo 01 de
`/app/voice-cloning/new`, que reapresenta "mínimo 20 minutos" com formulário em
branco e **não renderiza confirmação quando os clipes vêm do servidor**
(`voice-creator.tsx:786` dependia de `recorderImport`, setado só pelo caminho do
IndexedDB). A cura veio da boca dele: *"aguardei alguns segundos, demorou mas
carregou os áudios"*.

### Welrisson — `#330` (9 dias aberto)

Diagnóstico original ("bloqueado no /sgp pedindo informação") estava **errado**,
e o próprio Vigia já tinha derrubado em 10/09 abrindo o print: a imagem era a
tela de **sucesso**, não de erro. O que sobrava de real era o saldo −10.525.

```
profiles: 173.175 (subscription) + 11.340 (extra) = SALDO 184.515
11/09 17:30:30Z  +100.000  subscription_grant  HP2477312573
11/09 17:30:30Z  + 10.525  adjustment 'perdao_negativo_onboarding'
18/09 14:15:00Z  +100.000  subscription_grant  HP2931721805
```

Usando normalmente (vídeo, imagem, geração). Os dois `video_clone` que falharam
em 14/09 **foram estornados** — conferido por `ref_type='video_clone_refund'`,
**não por `kind`**, como manda a armadilha medida em 20/08.

**Ressalva que não é deste card:** as duas avulsas de 29/08 (R$597 SGP + R$297,
ambas COMPLETE, R$894) seguem **sem concessão de crédito própria** — o que
entrou foram grants de *assinatura*. Ele não está prejudicado hoje (184.515),
mas a classe "pagou avulsa e o nosso lado não registrou" segue aberta no
**`#312`** (`c726c5ae`), que é onde ela deve ser acompanhada. Não abri card novo
(SS3.1: ocorrência de classe já aberta).

## O que NÃO fechou, e é o que importa daqui pra frente

**A causa do caso do João não está em produção.** O `PR #330`
(`feat/gravacoes-achadas-passo-01`) conserta os dois defeitos da tela, está
**OPEN desde 17/09 18:58:02Z** e **não foi mergeado** — conferido com `gh` nesta
ronda, `mergedAt: null`.

Fechei os 3 cards do aluno de propósito (o caso *dele* acabou) e **carimbei o
aviso na nota dos três** pra exposição não sumir junto: teto medido de **188
alunos** com acesso vivo, crédito e zero voz.

O PR declara o próprio limite: *"Não houve verificação em navegador."* Numa tela
com 188 alunos de exposição, isso é gap, não rodapé. Apliquei a ordem de 17/09
(percepção é **despacho**, não estado de parada) e mandei pro `qa`, que enxerga
tela — card **`37db55b3`**, rodando ao fim desta ronda. O veredito volta escrito.
**Não mergeei e não recomendo mergear antes do veredito.**

## O veredito do QA voltou dentro desta ronda — e achou mais do que eu pedi

O card `37db55b3` fechou antes do fim da ronda. O que **passou**, medido em
worktree isolada (sem merge, sem push, checkout principal intacto):

| checagem | resultado |
|---|---|
| `node --test src/lib/audio/gravacoes-achadas.test.ts` | **10 pass / 0 fail** |
| `npx tsc --noEmit` | **exit 0** |
| `npm run build` | **exit 0** |
| diff real contra `git merge-base` (`2472847`) | **6 arquivos, +392/−19**, exatamente o declarado |

E o que **não** passou — com o motivo concreto, que é o que a ordem de 17/09
manda escrever quando o artefato não abre:

> `npx next dev` devolve **HTTP 500 em qualquer rota**, inclusive a raiz, antes
> de chegar no middleware de auth:
> `EvalError: Code generation from strings disallowed for this context`

**O QA não fingiu ter visto a tela.** E provou que o bloqueio não é do PR:
reproduziu **idêntico em `origin/main` puro**, segunda worktree, mesmo
`.env.local`, mesmo `node_modules`.

### O achado que vale mais que o card

Isto é o **motivo estrutural** de os PRs de frontend desta casa chegarem com
"não houve verificação em navegador". Não é desleixo de quem escreve o PR: a
casa **não consegue abrir tela nenhuma localmente**, autenticada ou não.
Enquanto durar, toda tela vai pra produção coberta só por teste puro + guarda
estrutural — e o `PR #330`, com 188 alunos de exposição, é o caso da vez.

Abri o chamado **`#471`** (`14fc0e22`) pra isso, com a prova do QA e os dois
caminhos possíveis (achar a incompatibilidade Sentry/OTel × Next 15.5.18, ou
montar verificação visual fora do `next dev` desta máquina). Sem um dos dois,
**"verificado em navegador" não existe neste repo**. Não há aluno afetado: o
defeito é da nossa capacidade de verificar, não da produção.

O veredito completo ficou comentado no próprio `PR #330`
(`issuecomment-5733300510`), que é onde a decisão de merge vai ser tomada.

**Eu não mergeei o #330 e não recomendo mergear às cegas.** A régua pura está
provada; a ligação régua↔tela, não.

## Fila

| status | antes | depois |
|---|---|---|
| open | 6 | **3** + 1 novo (`#471`) = **4** |
| investigating | 91 | **90** |
| fixed | 270 | **274** |

Não zerei nada por decreto: 4 fechados, todos com medição no banco e nota
dizendo o que era e o que fiz. O único card novo é o `#471`, e ele nasceu de
prova, não de suspeita.
