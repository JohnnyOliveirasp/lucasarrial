# Ronda das falhas — 03/09/2026 ~13hZ (dono da fila)

Serial: **#222** (compra órfã que não casa com a conta). Tudo abaixo foi medido
nesta ronda. Onde não medi, está escrito que não medi.

## Por que #222 e não o #47

O #47 (Katia) é o mais antigo com aluno esperando, e continua sendo. Ele está
travado em **tempo de coleta** (24–48h da régua de entrega), não em decisão nem
em gente — a ronda das 12h30Z deixou isso escrito e nada mudou desde então.
Regra 8: travou, diga em que passo e siga pro próximo. Segui.

Dentro do que sobrou, #222 é o mais antigo com aluno afetado (01/09 15:54) e o
que tem mais gente sofrendo: **15 pagantes** presos, **8 deles já cobrados de
novo** sem nunca ter entrado.

## O achado da ronda: o caminho (b) está morto, e isso é medição

O chamado carregava desde 01/09 três caminhos de conserto de fundo. O (b) era
"casar também por CPF/telefone do `raw_event.buyer` no reconcile". Ninguém tinha
medido o **outro lado** do casamento. Medi:

| lado da compra (órfãs vigentes) | lado da nossa base |
|---|---|
| `document` (CPF) em **26/26** | **não existe coluna de CPF/documento** em `public` nem em `auth` (varri `information_schema`) |
| `checkout_phone` em **22/26** | `profiles.whatsapp` = **2 de 1798** (0,1%); `auth.users.phone` = **0**; `agent_chats.wa_phone` = 29 distintos |

Cruzamento final, unindo `profiles.whatsapp` + `agent_chats.wa_phone` (só os com
`profile_id`) e casando pelos **últimos 8 dígitos** — match frouxo de propósito,
pra não subestimar:

**casariam 0 de 26.**

Implementar (b) seria engenharia jogada fora. Coletar documento/telefone daqui
pra frente ajuda o futuro, mas **não resgata nenhuma das 26 de hoje**. Sobra o
caminho (c), a tela de "reivindicar compra" — não decidi nem implementei, é
decisão do Johnny.

## A pré-condição que travava tudo já tinha caído

A nota de 01/09 dizia que vínculo manual seguia proibido "enquanto `grantAccess()`
puder sobrescrever `user_id` não-nulo com NULL". Isso **já foi consertado**:
commit `ba6a235` (PR #148), guarda `donoDoEntitlement()` em `payments/vinculo.ts`
com teste `vinculo.test.ts`.

Conferi que está na **main**, não presa em branch:
`git merge-base --is-ancestor ba6a235 main` → SIM.

Não usei isso pra vincular nada. A guarda tira o risco de o vínculo apodrecer;
ela **não** autoriza chutar de quem é a compra. O par `cdmarciofernandes`
hotmail × gmail segue sendo o exemplo de palpite plausível e ainda assim chute.

## O que fiz por gente

Escrevi para **sbtirp@hotmail.com** (SIMONE BEATRIZ TIRP) — Enviados **uid 483**.

Escolhi ela por critério, não por acaso: é a pagante órfã cuja janela vence
**primeiro (05/09, daqui a 2 dias)**; assinou 05/08, já foi cobrada 2× (R$97,
`recurrence_number` = 2) e **nunca foi contatada por ninguém**.

Conferido ANTES de escrever:
- nenhum `profile` com `sbtirp@hotmail.com` → o caminho é criar conta, não recuperar senha;
- nenhum `profile` com `display_name` parecido com "tirp"/"simone beatriz" (busquei pra ter contexto, **não** pra vincular);
- `ler_caixa --enviados --para sbtirp@` voltou **vazio**;
- **controle contra instrumento cego**: o mesmo comando em `scandovieri41` devolveu o e-mail de ontem. O instrumento enxerga, o zero é real.

O e-mail **pergunta** com qual endereço ela entra. Não adivinha conta, não promete
transferência de assinatura e não promete data de conserto.

## Nada se moveu sozinho

- 46 órfãs ativas / **26 vigentes** — os mesmos números da ronda das 10hZ.
- Os **três** avisados em 01/09 (uid 433/434/435) **não criaram conta**: nenhum dos
  3 e-mails de compra tem `profile` hoje, 2 dias depois. A 2ª tentativa por
  WhatsApp marcada pra 05/09 continua de pé (janela do Marcio vence 10/09, a da
  Fernanda 11/09).

## Discrepância de instrumento, resolvida sem virar chamado

A `varredura_travados.cjs` imprimiu **6 abertos** e o SQL devolveu **5**. O 6º era
o **#202**, que aparecia como `[open]`. Não é bug: o #202 foi fechado por **humano**
(`resolved_by` = suporte@, nota "respondido via whatss") às **12:41:39Z**, segundos
antes da minha varredura. Corrida benigna entre a varredura e o atendimento
humano. **Não reabri e não toquei** — não é meu card.

## Passo em que emperrou

**Autorização, não técnica.** Sobram **12 pagantes** sem contato conhecido, vários
em 2ª e 3ª cobrança. O texto está pronto e testado (Eduardo, uid 481). Mandar pra
12 é comunicação em **massa** e precisa do "pode" do Johnny (regra 8, 21/08).
Pedido feito no grupo nesta ronda, marcado como urgente.

Dos 12: a ronda das 10hZ verificou caixa de **5** e achou zero e-mail
(josephgois, isaias.enf, qooqi.criacoes, caplastica, cris_evangelista22). Os
outros **7 eu não reverifiquei** — **não afirmo** que estão sem contato.

## Limites honestos desta ronda

1. O match por telefone usou os **últimos 8 dígitos**. É frouxo de propósito
   (superestima o casamento). Deu 0 mesmo assim, então a conclusão aguenta —
   um match estrito só daria 0 também.
2. **Não reverifiquei** a caixa de 7 dos 12 pagantes (custo de IMAP). O número
   "12 sem contato" é **piso do que sei**, não fato conferido hoje.
3. Não medi se o #47 destravou — assumi o diagnóstico da ronda das 12h30Z
   (falta amostra) sem refazer a medição dele.
4. Não ouvi áudio nenhum, não gastei GPU, não mexi em crédito, acesso nem
   migration, e não mergeei PR.

## O que NÃO fiz, de propósito

- Não vinculei nenhuma órfã na mão, mesmo com a guarda do `grantAccess` já no ar.
- Não implementei (b) — acabei de medir que resolve zero.
- Não implementei (c) sem decisão do Johnny.
- Não marquei #222 como `fixed`: a classe continua viva. Só fecha quando o
  casamento parar de ser só-por-e-mail.
