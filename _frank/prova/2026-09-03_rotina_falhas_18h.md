# Ronda das falhas — 03/09/2026 ~17h48Z (dono da fila)

Serial: **#222** (`3ca22d47`, pagante órfão preso fora da própria conta). Tudo
abaixo foi medido nesta ronda. Onde não medi, está escrito que não medi.

## Por que #222 e não o #47

O #47 (Katia) continua sendo o mais antigo com aluno esperando (19/08, 15 dias),
e **não andou nesta ronda**. Antes de aceitar isso eu conferi o bloqueio em vez
de herdá-lo — a própria ronda das 17hZ mostrou que uma premissa repetida por
cinco rondas pode ser falsa. O bloqueio é real: o que conserta o caso dela é o
#234, e o #234 parou em **autorização, não em medição** — virar
`TTS_TAIL_QA_INTERNO_MODO=reprovando` força regen e gasta GPU, decisão do Johnny.
Alcance (~10% das fronteiras) e custo (~+16 a 19% de regen) já foram os dois
medidos às 17hZ e o pedido já está no grupo. Uma segunda cópia do pedido seria
ruído (regra 27), então repeti só uma linha no grupo e segui (regra 8.4).

## O erro de instrumento que eu cometi, e como ele foi pego

Minha primeira consulta de pagantes órfãos devolveu **zero**. Zero seria notícia
boa e era mentira minha: usei o caminho
`raw_event->'data'->'purchase'->'price'->>'value'`, e em `entitlements` o
`raw_event` guarda o objeto `data` **direto**, sem o wrapper. O caminho certo é
`raw_event->'purchase'->'price'->>'value'`.

Não acreditei no zero porque a ordem manda decompor antes de acreditar em zero.
Decomposto: 92 órfãs totais → 46 ativas → **26 vigentes** → `tem_price_path` = **0
de 26**, que é a assinatura de caminho errado, não de ausência de pagante.
Corrigido, o número real bate com a ronda das 17hZ: **15 pagantes com janela
viva**. Fica registrado no incidente porque a mesma armadilha derruba qualquer
ronda futura que copie a consulta errada.

## O que fiz por gente

Escrevi para **max@md2net.com.br** (Max Madsen) — Enviados **uid 491**, cópia
confirmada na tentativa 1.

Era o próximo da ordem deixada pela ronda das 17hZ (janela 13/09), depois que a
`cris_evangelista22` (mesma data) foi escrita naquela ronda.

Conferido ANTES de escrever, um a um:

- nenhum `profile` com `max@md2net.com.br` (`tem_profile` = 0);
- `ler_caixa --enviados --para` ele voltou **vazio**;
- **controle contra instrumento cego**: o mesmo comando em `cris_evangelista22`
  devolveu o uid 488 das 16:55Z. O instrumento enxerga, o zero é real;
- **não é caso de pagar em dobro**: existe outro "Max" na base
  (`maximilianogayoso1985@gmail.com`), mas é **outra pessoa** — documento
  `13262912972` (CPF) contra `03676092000112` (CNPJ, Max Madsen), e aquele não é
  órfão. A letra de "você está pagando duas vezes" seria errada aqui.

O e-mail **pergunta** com qual endereço ele entra. Não adivinha conta e não
promete transferência.

## O achado da ronda: dois fixes prontos apodrecendo FORA do git

Na saída do `git status` da preparação encontrei **7 arquivos modificados e 3 não
rastreados, sem commit, soltos na working tree da `main`**. Não é código meu e não
sei de que sessão sobrou. Estava a um `git checkout` de ser destruído — e é uma
forma **pior** do defeito que a ordem já registra ("em 19/08 um fix de aluno ficou
9h preso em branch"): preso em branch pelo menos existe no git; isto não existia
em lugar nenhum.

Eram **duas features distintas e coerentes**, com comentário de causa e teste:

1. **Os 4 avisos** (`processar.ts`) — a régua do Johnny de 29/08 é *processando
   foto → foto concluída → processando áudio → áudio concluído*, e o `/sgp` só
   mandava **três**. Os dois avisos "processando" existiam em
   `lib/onboarding/avisos.ts` mas o único chamador era a rota da **planilha**,
   desligada em 29/08: morreram junto com ela e ninguém percebeu, porque o `/sgp`
   que a substituiu em produção nunca os chamou.
2. **A prévia do clone** (`previa.ts`, `previa-pure.ts` + teste, tela de
   acompanhamento, `status/route.ts`, mensagens) — o aluno passa a ver a própria
   foto e ouvir a própria voz na tela, sem esperar o tick de 8s do polling.

**O que verifiquei antes de empacotar:** `tsc --noEmit` **0 erros**; o teste que
veio junto passa **16/16** (`node --test src/lib/sgp/previa-pure.test.ts` — o
projeto não tem runner no `package.json`, a convenção é `node --test` com
type-stripping nativo; `npx jest` falha por parse e **não** é falha de teste).

**O que NÃO verifiquei:** não revisei linha a linha e **não subi o Next**, então o
comportamento de tela está verificado só por tsc, teste unitário e leitura.

Empacotei em **dois branches separados**, um por feature, e abri PR com base
`main` — nada foi para produção e nada foi para a `main` além deste log:

| PR | branch | o que é |
|---|---|---|
| **#167** | `feat/sgp-4-avisos` | commit `d744956` |
| **#168** | `feat/sgp-previa` | commit `ff6c0df` |

Escrevi a procedência nos dois PRs, em bloco próprio: quem aprovar está revisando
de verdade, não referendando trabalho meu.

## Passo em que emperrou

**#222 não fecha por autorização, não por medição.** A classe só vira `fixed`
quando o casamento parar de ser só-por-e-mail; o caminho (b) já foi medido como
inviável (0 de 26) e sobra o (c), tela de "reivindicar compra", que é decisão do
Johnny.

E o gargalo de gente: no ritmo de **1 e-mail por ronda**, os **11 pagantes
restantes** seguem sendo cobrados por acesso que não alcançam. Mandar o mesmo
texto pros 11 é comunicação em **massa** e precisa do "pode" (regra 8, 21/08).
Levei o pedido ao grupo **com o custo escrito**, em vez de seguir drenando um por
ronda em silêncio.

## Achado lateral, não tratado

`rutifortuna8@gmail.com` aparece com `price.value` = **118887**, contra 97 de
todos os outros 14. Não investiguei e **não afirmo o que é** — fica anotado no
incidente pra quem pegar.

## Limites honestos desta ronda

1. Não revisei o código que empacotei linha a linha, e disse isso nos PRs.
2. Não rodei a aplicação: nenhuma afirmação minha sobre tela renderizada.
3. Os 7 pagantes órfãos que a ronda das 13hZ não reverificou continuam sem
   reverificação minha — **não afirmo** que estão sem contato.
4. Não reverifiquei #226 nem #234 nesta ronda; seguem como as rondas anteriores
   deixaram.

## O que NÃO fiz, de propósito

- Não virei a `TTS_TAIL_QA_INTERNO_MODO` — muda produção e gasta GPU.
- Não vinculei nenhuma órfã na mão: a guarda `donoDoEntitlement` tira o risco do
  vínculo apodrecer, mas **não** autoriza chutar de quem é a compra.
- Não mandei o texto pros 11 restantes (massa, precisa do "pode").
- Não fechei, não reabri e não mudei status de nada.
- Não mergeei PR nenhum, não apliquei migration, não mexi em crédito nem acesso.
- Não gastei GPU nem whisper, e **não ouvi áudio nenhum** — tudo aqui é banco,
  envelope e git.

## Fim de ronda

`main` limpa (working tree vazia depois de empacotar), log commitado direto na
`main`, código só em branch com PR.
