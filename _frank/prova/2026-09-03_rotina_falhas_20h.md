# Ronda das falhas — 03/09/2026 ~20h (dono da fila)

Serial: **#222** (`3ca22d47`, pagante órfão preso fora da própria conta). Tudo
abaixo foi medido nesta ronda. Onde não medi, está escrito que não medi.

## O que fiz por gente

Escrevi para **josephgois@hotmail.com** (Joseph De gois oliveira) — Enviados
**uid 492**, cópia confirmada na tentativa 1.

Era o próximo da ordem: janela **17/09**, R$97, recorrência **#2** desde
**17/07** — ou seja, paga há quase dois meses e já renovou uma vez sem nunca
ter conseguido entrar.

Conferido ANTES de escrever, um a um:

- `tem_profile` = **0**, e com **controle**: a mesma consulta em `profiles`
  devolve linha, então o zero é do dado, não de instrumento cego;
- **nenhum** profile parecido com `joseph` (0) — não há conta pra ligar errado
  e não é caso de "você está pagando duas vezes";
- `ler_caixa --enviados --para` voltou **"nada encontrado"**, com **controle
  positivo** em `cris_evangelista22` (uid 488): o instrumento enxerga.

O e-mail **pergunta** com qual endereço ele entra. Não adivinha conta e não
promete transferência.

⚠️ **Ressalva honesta:** o `buyer.document` dele vem **vazio** no `raw_event`.
Descartei duplicata por e-mail e nome semelhante, **não** por documento — que
foi justamente o que resolveu o caso do Max às 18hZ. É uma verificação a menos.

## O número herdado estava errado: são 9, não 11

A ronda das 18hZ deixou "**11 pagantes restantes**". Medi em vez de herdar, e
não bate: dos 15, **seis** já receberam a carta do órfão — uids **480**
(jkakorio, 09:23Z), **481** (scandovieri41, 10:46Z), **483** (sbtirp, 12:46Z),
**488** (cris, 16:55Z), **491** (max, 17:44Z) e **492** (joseph, agora).
**Restam nove.** As 18hZ contaram 4 porque as cartas das 09h/10h não entraram
na conta.

Funil reproduzido, idêntico ao das 17hZ/18hZ: **92** órfãos → **46** `active` →
**26** janela vigente → **15** com `price>0` pelo caminho
`raw_event->'purchase'->'price'->>'value'`. **Controle do caminho errado**
(`raw_event->'data'->...`) devolveu **0**, como tinha que devolver.

## O achado da ronda: "já foi contatado" estava medindo a coisa errada

A ronda das 18hZ registrou como limite honesto que 7 órfãos seguiam **sem
reverificação de contato**. Fui verificar os 11 um a um — e o critério em uso
("tem qualquer coisa nos Enviados") **não serve**.

**Seis dos nove restantes já têm e-mail nosso na caixa, e nenhum deles fala do
problema:**

| quem | janela | o que recebeu |
|---|---|---|
| `rmf174` | 19/09 | "Lembrete: seus créditos seguem te esperando" (24/08) |
| `rutifortuna8` | 20/09 | mesmo lembrete (25/08) |
| `flaviamalavazi` | 20/09 | mesmo lembrete (24/08) |
| `fmgimael` | 29/09 | "créditos prontos" (29/08) + lembrete (02/09) |
| `malmeida313` | 30/09 | "créditos prontos" (31/08) |
| `atendimento@dropweb` | 02/10 | "créditos prontos" (03/09 14:00Z) |

É **mala direta de crédito**. Não conta que existe uma compra ativa que não está
ligada a conta nenhuma — quem lê aquilo não descobre o problema, e pela **regra
11** mandar genérico pra quem já tentou o óbvio é exatamente o que faz aluno
explodir. Para efeito do #222, essas seis pessoas **não foram contatadas**.

**Três nunca receberam absolutamente nada:** `isaias.enf` (18/09),
`qooqi.criacoes` (21/09), `caplastica` (22/09).

Isso muda a fila: quem só levou mala direta não pode ser tratado como resolvido,
e o gargalo real é **9**, não 6.

**Próximo da ordem:** `isaias.enf@gmail.com`, janela **18/09**, nunca contatado.

## Falso alarme que eu derrubei

O recado `para_frank_orfa_5O6U1GCW` diz **"Compra paga SEM conta na plataforma:
rodrigoaugusto@hotmail.com"**. Está errado nos dois termos:

- **tem conta.** `user_id` preenchido e `profile` existe. O alerta disparou
  **15:31:27.547**; o entitlement nasceu **15:31:27.233** — ele dispara no
  webhook, **antes** de a ligação com a conta terminar, e se auto-resolve no
  mesmo segundo;
- **não é paga.** `price.value` = **0**, é trial.

Não é caso do #222 e **não entra na conta dos 15**. Quem for mexer no alerta:
reconferir o `user_id` antes de disparar, e não chamar R$0 de "compra paga".
Não abri chamado — o defeito é do alerta, e fica anotado no incidente.

## #47 e #234

Seguem **travados em autorização, não em medição** — o mesmo estado que as 17hZ
e 18hZ já mediram e levaram ao grupo. Alcance (~10% das fronteiras) e custo
(~+16 a 19% de regen) estão medidos desde as 17hZ; virar
`TTS_TAIL_QA_INTERNO_MODO=reprovando` muda produção e gasta GPU, e é decisão do
Johnny. **Não repeti o pedido**: já foi ao grupo às 17hZ e uma linha às 18hZ, e
uma terceira cópia é ruído (regra 27). Não reverifiquei o #226.

## Limites honestos desta ronda

1. Não conferi duplicata do Joseph **por documento** (o campo vem vazio).
2. Não reverifiquei #226, #234 nem #47 por medição própria — herdei o estado das
   rondas anteriores, e isso está dito, não escondido.
3. Os 7 recados em `para_frank_*` e o `patch_92b1cc85` continuam **na fila, não
   tratados** nesta ronda: só derrubei o `orfa_5O6U1GCW` como falso alarme, e
   **não apaguei nenhuma chave**.
4. Não abri o app, não ouvi áudio, não vi imagem: tudo aqui é banco, envelope e
   git.

## O que NÃO fiz, de propósito

- Não virei a `TTS_TAIL_QA_INTERNO_MODO`.
- Não mandei o texto pros 9 restantes de uma vez: é **massa** (>10 com os já
  feitos no dia) e o "pode" ainda não veio. Segui a regra de 1 por ronda.
- Não vinculei nenhuma órfã na mão — sem resposta do titular, ligar compra é
  chute.
- Não fechei, não reabri e não mudei status de nada (o #222 segue
  `investigating`).
- Não mergeei PR, não apliquei migration, não mexi em crédito nem acesso.

## Fim de ronda

Nota gravada no #222 (7 → 8 notas, conferida na releitura). `main` limpa; log
commitado direto na `main`. Nenhum código tocado nesta ronda.
