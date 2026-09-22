# Ronda das falhas — 22/09/2026, ~13h25–14h10Z

Canal: ordem de 31/08 — FastCloner **só no grupo** (`notify-grupo.sh`).
Ordem de 29/08 respeitada: **nada da planilha** foi lido, escrito ou
reprocessado.

**Uma linha:** item serial foi o **#206** (22d, o mais antigo com aluno no meu
colo) e ele **virou do avesso**: a aluna que o cartão mandava tratar como
"ainda não assinou" **já tinha pago R$ 683,20** pelo produto exato que estava
tentando usar — a compra estava no `@gmail`, a conta e todo o nosso contato no
`@icloud`.

**Cartões fechados: 0. Alunos escritos: 1. Fix em produção: 0. Dinheiro
devolvido: 0. Escritas em banco: 1 (nota do #206).**

---

## 0. Passos fixos

| passo | resultado |
|---|---|
| `git pull --ff-only` na main | atualizado, sem divergência |
| **Reconciliar envios da pasta** (#101) | 1011 lidas · 934 já tinham linha · **0 dentro da janela sem linha** · 77 fora do corte (decisão pendente, não é defeito) · contagem fecha 1011 = 1011 |
| `2026-09-18_enviados_x_tabela.cjs` (instrumento independente) | veredito **0 carta depois do corte** fora da tabela — buraco PASSIVO |
| `percepcao_travada.cjs` (ordem 17/09) | controle positivo OK (#310) · 507 varridos · **0 cards travados em percepção** |
| `varredura_travados.cjs` | 1 preso (escrituração) · **104 abertos** · 35 aguardando aluno · 0 fechado sem retorno · lista de estorno em dia |
| `2026-09-19_idade_dos_abertos.cjs` | 104 abertos · **50 com 7d+** · 2 patches · 144 recados |

Nenhum `⚠️ <tabela>:` e nenhum "consulta FALHOU" na saída — os zeros são
**medidos**, não cegos. (No meio da apuração do #206 um script meu morreu em
`column voices.error does not exist`: é o comportamento certo, ele recusou
imprimir zero de instrumento cego.)

---

## 1. O item com relógio: `#506` — sem resposta, e eu NÃO repinguei

Os 3 que vencem **23/09** (jununes42, joaov.cestaro,
fastcloner@americanshowerglass) continuam sem o "pode" do Johnny. Varri
`agent_state` desde 11hZ: **4 chaves novas, nenhuma é resposta dele**.

A cobrança única de hoje saiu **12:05Z**; eu abri esta ronda **13h42Z**.
Repingar 1h37 depois é exatamente o que a ronda anterior identificou que queima
o canal, e não acelera decisão de gente que está na estrada. **Não repinguei.**

⚠️ **Para a próxima ronda:** hoje era o último dia útil da janela (a nota do
próprio cartão manda tratar 23/09 como LIMITE MÁXIMO e agir até 22/09). Se
amanhã amanhecer sem resposta, **não finja que ainda dá**: registre que a
janela fechou e vire caso de exceção, como o `#207`. Não invente um prazo novo.

---

## 2. Item serial: `#206` (Wallana, 22d) — o cartão estava errado no que importa

**Por que este:** regra 8. O `#172` (24d) saiu do meu colo na ronda das 13h
(2ª tentativa enviada, data nova) — esperar aluno não é estar travado. O
seguinte mais antigo com aluno é este.

**Passo (1) da rotina, "já resolveu sozinho?": não.** Pedido `0fd2845a` parado
em `status=foto` com 1 foto e 0 áudios desde 31/08.

### O achado que inverte o cartão

A instrução de atendimento que estava aqui desde 01/09 dizia, em letras
próprias: *"Ela aparece sem plano e sem créditos — isso está certo, ela ainda
não assinou"* e *"se ela perguntar de preço: R$ 97 por mês"*. Aplicada ao pé
da letra, **venderia uma assinatura de R$ 97 a quem já tinha pago R$ 683,20
pelo produto que estava tentando usar.**

Medido hoje na Hotmart viva (`2026-09-20_achar_compra_por_nome.cjs`, balde
`buyer_name="Wallana"`, 2 de 2 compras lidas, nome inteiro batendo):

| | |
|---|---|
| **PAGO 07/08** | **R$ 683,20** · Sistema de Geração Pronto (7283229) · HP1969848133 |
| PAGO 07/08 | R$ 317,97 · Fábrica de Conteúdo Invisível (7283335) · HP1469289814 |
| e-mail da COMPRA | wallanadaphiny@**gmail**.com |
| e-mail da CONTA e de todo o contato | wallanadaphiny@**icloud**.com |

Família **#214** (zicasantos37/zicasantos08) e **#218**
(luciane.garcia19/luciane.garcia@icloud). `pagou_de_verdade.cjs` no icloud
devolve "SEM PAGAMENTO ENCONTRADO" — e foi esse zero que virou "ela não
assinou" no cartão. **O próprio script avisa em letra grossa que isso não é
prova de não-pagamento.** A nota de 01/09 leu como se fosse.

Os dois perfis existem e os dois estão vazios: `6ed87d18` (icloud, 10/08,
last_seen 10/09) e `b7d51cf2` (gmail, 04/09, **nunca entrou**). **0
entitlements e 0 payment_events** nos dois endereços — a compra de 07/08 nunca
chegou ao nosso banco por lado nenhum.

### O que NÃO é defeito (pra ninguém "consertar" o que está certo)

Saldo 0 e `plan=free` estão **corretos**. `lib/credits/onboarding-cobranca.ts`:
*"comprar o SGP (produto 7283229) NÃO concede crédito nenhum — é regra
comercial da casa"*, e o #312 já tinha cravado *"SGP não dá a plataforma"*. Ela
não tem direito a crédito de plataforma e **eu não concedi nenhum**. O que ela
comprou é a **entrega**: o mesmo arquivo diz *"o comprador já pagou o produto;
o clone é entrega nossa. NÃO COBRA"*.

### Por que ela parou (medido, não suposto)

Entrou 31/08 **14:02:39Z**, verificou e-mail **14:03:42Z**, última atualização
**14:07:05Z**. **Quatro minutos** e nunca mais voltou. Causa no fonte:
`SGP_FOTOS_MIN=4` (`types.ts:23`), `foto/concluir/route.ts:28` recusa com
"Faltam N foto(s) aprovada(s)", e `passo-foto-pure.ts` ainda exige os 5 itens
de `CIENCIA_FOTO`. **Ela mandou 1 de 4 e bateu num botão travado** — e a nossa
carta de 01/09 mandou ela "subir os dois áudios" sem nunca mencionar que o
passo anterior pede 4 a 6 fotos. Ela não sumiu por desinteresse: bateu numa
parede que a nossa própria carta não avisou que existia.

`cobrado_em` 14/09 19:34Z por `lucas.m.arrial@` (o time cobrou no WhatsApp; a
rota `admin/sgp/[id]/cobranca` só **marca**, não envia). `avisado_em` null.
8 dias desde a cobrança, sem movimento — coerente com quem foi cobrada a fazer
o que já tinha tentado e não conseguiu.

### Ela não está no #312 e nunca estaria

Aquele varredor procura "pagou e **nunca criou conta**" (`orphan-outreach`).
Ela criou **duas**. Quem compra num e-mail e cria conta em outro é cego pro
#312 **e** pro painel do SGP. **Esta classe não tem varredor nenhum olhando
pra ela** — registrado aqui e no cartão porque é achado, não conserto.

### O que eu fiz

Carta enviada, **Enviados uid 3180**, cópia **CONFIRMADA**, registrada em
`emails_enviados` (chave `sgp-206-wallana-compra-em-outro-email`). Diz: (a) ela
**já pagou**, não falta pagamento, não precisa assinar nada, que ignore
qualquer R$ 97 — com a desculpa assumida por o erro ser nosso; (b) montar o
material é entrega nossa e não sai do bolso dela; (c) onde o pedido parou de
verdade — 1 foto de 4 a 6 mais os 5 checkboxes — **com a ressalva honesta** de
que o rascunho mora num cookie de 30 dias (`sessao.ts:16`) e pode abrir zerado,
e que se abrir é só remandar; (d) depois o áudio, 20 a 60 min, até 20 arquivos;
(e) os áudios do Drive não entraram e o que travou foi o vídeo de ~10GB junto;
(f) a **pergunta**: gmail e icloud são os dois dela, qual prefere usar.

Status: `aguardando_aluno` com **data nova**. Não fechei (regra 14: ela ainda
não recebeu o produto).

---

## 3. O que eu NÃO fiz, e por quê

- **Não vinculei a compra a conta nenhuma.** É ato humano — e o #312 mostrou
  que criar/vincular conta desses produtos pode disparar o bug do entitlement
  vitalício via `reconcileUserEntitlements` casando por `buyer_email`. No caso
  dela há 0 entitlement, então não há o que casar, **mas a decisão segue não
  sendo minha.**
- Não concedi crédito (a regra comercial nega, e negar está certo).
- Não devolvi dinheiro (9-A) — e ela **não** pediu reembolso.
- Não repinguei o #506 (cobrança única de hoje já saiu 12:05Z).
- Não li a planilha (ordem de 29/08).
- Não mexi em crédito, acesso, plano, assinatura, voz, migration, nginx, RunPod
  ou GPU. Nenhum merge, nenhum PR, nenhum retreino disparado.
- Não tratei os 144 recados nem os 2 patches: a regra 8 é serial de propósito e
  o #206 levou a ronda.

---

## 4. Para a próxima ronda

1. **`#506` vence HOJE (23/09).** Se o Johnny respondeu, execute no dia. Se
   passou sem resposta, **registre que a janela fechou** — não finja que ainda
   dá (família do `#207`).
2. **`#206`**: se ela responder confirmando o e-mail, **vincular a compra é ato
   humano** — leve ao Johnny/Lucas, não faça sozinho. Se ela mandar o material,
   o onboarding sai por origem `sgp` (não cobra dela). Se passar 7d em
   silêncio, ela tem WhatsApp no pedido e o time já usou esse canal em 14/09 —
   vale um toque por lá em vez de uma terceira carta.
3. **Antes de dizer a QUALQUER aluno que ele não pagou, rode
   `2026-09-20_achar_compra_por_nome.cjs`.** "`pagou_de_verdade.cjs` devolveu
   SEM PAGAMENTO" **não** autoriza escrever "ela não assinou" numa instrução de
   atendimento. A busca por nome achou R$ 1.001,17 em 30 segundos.
4. **Não remonte o detector de "pagante trancado" por `access_until`** (ronda
   das 13h; está no manual com os arquivo:linha). Quatro vezes bastou.
5. **Recados (144) e patches (2)** seguem sem dono. Escolha um e trate.
6. `emails_enviados` só cobre a partir de **14/09 14:06Z** — nunca conclua
   "nunca escreveram pra este aluno" só com ela; use a pasta Enviados.
7. `sweep-clones` continua fora da varredura por bloqueio do guard.
