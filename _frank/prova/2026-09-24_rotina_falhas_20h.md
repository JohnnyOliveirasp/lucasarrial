# Ronda das falhas — 24/09, ~19h40–20h10Z

Dono da fila (14-A). Serial (regra 8). Canal: **grupo** (ordem de 31/08).

---

## 0. Passos fixos

| Passo | Resultado |
|---|---|
| `git checkout main && git pull --ff-only` | já atualizado |
| Índice das ordens (`_frank/ordens/README.md`) | lido |
| `percepcao_travada.cjs` | **0 cards** travados em percepção · controles (#310 / #518) verdes · 541 incidentes varridos |
| `reconciliar_envios_da_pasta.cjs --corte=… --confirmar` | 1.232 lidas = 1.155 com linha + 77 fora da janela + **0 escrituráveis** · conta fecha 1.232 = 1.232 |
| `enviados_x_tabela.cjs` (irmão de leitura) | veredito: **0 carta depois do corte** fora da tabela |

As 77 anteriores a 14/09 14:06:31Z seguem sem decisão, como manda o índice.

---

## 1. A ferramenta da ronda escondia 30 cartões — e são os mais velhos

Antes de escolher o item serial eu fui ordenar a fila e a conta não bateu com a
da ronda anterior. A causa é do próprio instrumental:

`2026-09-19_idade_dos_abertos.cjs:41` filtrava `["open","investigating"]` e
**não conhecia `aguardando_aluno`**. O `idade_incidentes.cjs` ganhou exatamente
esse conserto em **23/09** — e este arquivo **não foi junto**. Por mais um dia,
a ferramenta que a ronda de fato roda continuou contando errado.

| | filtro velho | filtro certo |
|---|---|---|
| abertos | 121 | **150** |
| com 7d+ | 67 | **88** |

São **30 cartões invisíveis**, **30 de 30 com aluno nomeado**, o mais velho com
**27,2d** (`#172`). Não é só contagem: a regra 8 manda pegar *"o mais antigo com
aluno afetado"*, e o filtro escondia justamente os mais velhos.

**Sexta ocorrência da família do #410** — conserto sobe num lugar e o acervo (aqui,
as outras cópias da mesma regra) fica para trás.

Corrigido nesta ronda, com o número medido no próprio comentário. Ferramenta
nova commitada: `2026-09-24_escolher_o_abandonado.cjs` (só leitura, pagina, ordena
por **última nota** — o recorte que acha trabalho abandonado, não `created_at`).

---

## 2. Escolha do item serial

150 vivos, 143 com aluno nomeado, **1** com aluno e **sem nota nenhuma**.

Topo por abandono: `#340` (11,0d parado) — Ulysses, bounce `inexistente`. Peguei
esse primeiro e ele **travou em decisão do Johnny** (§5). Segui para o seguinte
que eu conseguia levar ao fim: **`#328`**, 10,0d parado.

---

## 3. `#328` — o bloqueio tinha ido embora e ninguém tinha voltado pra ver

**Renato Mello, `diretoria@ollem.com.br`.** Carta de 09/09 23:14:19Z (Sent uid
1502) levou `554 5.7.1 … blocked using dnsbl.spfbl.net`. 14,9 dias sem saber que
existia mensagem.

### 3.1 Corrijo a premissa das notas de 09 e 14/09: o IP nunca foi nosso

As duas diziam *"NOSSO IP de saída SMTP 104.207.68.48 (envio próprio)"*. Medido:

```
mail-smtp.ts:13  HOST = SUPPORT_MAIL_HOST || "mail.privateemail.com"  (submete, não entrega)
rDNS 104.207.68.48  →  out-93wp-a48.jellyfish.systems
SPF fastcloner.com  →  include:spf.privateemail.com → include:spf.jellyfish.systems
```

É o **pool compartilhado do provedor**, e o nosso SPF já o autoriza. Então (a) o
*"delist self-service que ninguém abriu"* **nunca foi ação nossa**, e (b) a
suspeita de *"SPF/DKIM capenga como causa raiz"* **não se sustenta**.

### 3.2 A listagem saiu — medido com controle positivo

```
48.68.207.104.dnsbl.spfbl.net  →  (vazio, NÃO listado)
2.0.0.127.dnsbl.spfbl.net      →  127.0.0.2     ← instrumento funcionando
```

### 3.3 Duas correções contra o registro anterior

**(a) O "limpo em todas as 6 listas" de 14/09 incluía instrumento cego.**
`zen.spamhaus.org` e `dnsbl.sorbs.net` **falham o próprio controle positivo**
a partir deste resolver. Limpo medido em **4** (spfbl, barracuda, spamcop, psbl);
em **2** não dá pra afirmar nada. A conclusão daquela nota sobrevive nas 4 — mas
foi dita com alcance maior que o instrumento tinha.

**(b) "Duas vítimas conhecidas" era uma.** O `#379` não é desta classe: o cru
dele é `550 Rejected due to high probability of spam` — o **nosso** relay
recusando a **nossa** mensagem, não DNSBL do destino. O `#328` foi a **única**
vítima medida da listagem spfbl.

### 3.4 O que eu fiz

Reenviei as boas-vindas do SGP. Sent **uid 3406**, registrada em
`emails_enviados` (`origem=ronda-manual`), então bounce desta carta tem onde
carimbar. WhatsApp lido da constante de produção (`sgp-boas-vindas.ts:100`),
**não inventado** — ver `#414`.

**De propósito não mandei link de definir senha:** uso único, vale 1h, varredor
de domínio corporativo faz prefetch e **queima** o link; e `generateLink`
**sobrescreve `recovery_sent_at`** (lição do `#338`, 23/09). Indiquei
`/login → "Esqueci minha senha"`, que é o fallback documentado na própria carta
de produção.

### 3.5 Como sei que não quicou

`varrer_bounces.mjs` (EXAMINE + BODY.PEEK): **zero** bounce para este endereço
hoje. Instrumento provado **não cego na mesma execução** — a janela 15–22/09
devolve os bounces conhecidos. `bounce_em` nulo na carta.
Referência de latência: o bounce original chegou **44s** depois do envio.

⚠️ **Alcance honesto:** ausência de bounce é forte evidência de entrega, **não é
prova de leitura**.

### 3.6 O cartão subregistrava o dinheiro

`pagou_de_verdade.cjs`: **duas** compras em 09/09, ambas COMPLETE — R$ 741,00
(SGP) **e** R$ 297,00 (Fábrica de Conteúdo Invisível) = **R$ 1.038,00**, 0
assinatura. As notas anteriores só falavam dos R$ 741. Não tratei a Fábrica: não
tenho medição dela, então não afirmo nada.

### 3.7 `#328` FECHADO

`status=fixed`, `resolved_at` 24/09 20:04:12Z, nota de 4 blocos, releitura
conferida, 1 linha afetada. **O que o fechamento não cobre** está escrito nele: o
SGP segue sem entrega (`sgp_pedidos=0`, nunca logou) — o próximo passo agora é
dele. **Promessa com data:** se até **01/10** não abrir pedido, a casa escreve de
novo.

---

## 4. A classe inteira: e-mail está descartado, medido

Rodei `segundo_email_por_cpf.cjs --fichas` nas 11 fichas de bounce abertas
(controle positivo OK):

```
TEM 2º endereço (mesma pessoa por CPF):  0
SEM 2º endereço:                        10
NÃO MEDIDO (sem nome na Hotmart):        1
```

**Zero.** O tool recusa homônimo por documento — e recusa muito (35 "Aline",
todas outra pessoa). Então o canal barato e pré-autorizado **não existe** para
essa gente, e o que sobra é canal externo.

Dois que **não** são vítimas, pra ninguém gastar ronda: `#374` é typo do próprio
aluno (`gmail.com.br`) e ele concluiu com o endereço certo **1,6 min depois**;
`#379` é spam-saída do nosso relay.

---

## 5. O que precisa do Johnny — e é UMA decisão, não sete

`#340` **Ulysses Monteiro Machado** — `ulyssemmachado@gmail.com` não existe
(`550 5.1.1`), **sem 2º endereço** (medido, controle positivo). Pagou
**R$ 741,00** de SGP (HP2326756448). Nunca logou, 0 pedido, 0 voz. **15 dias, zero
entrega.** Canal vivo: telefone da Hotmart.

O pedido de aval foi levado ao grupo em **13/09**. São **11 dias** parado
esperando um "pode". Não é falta de diagnóstico — o diagnóstico está pronto e a
única porta que resta é externa (ligação/WhatsApp), que **não é minha alçada
sozinho**.

**A pergunta é uma só, e vale para a classe:** a casa pode usar telefone/WhatsApp
da Hotmart para avisar pagante cuja carta comprovadamente não chega?

---

## 6. O que eu vi de passagem e NÃO virou cartão (ordem de 27/08)

- **1 cartão com aluno e sem nota nenhuma.** `investigating` sem nota é o mesmo
  que não ter olhado (regra 5). Fica medido para a próxima ronda.
- O único relatório de falha de hoje pegou **só a cópia interna** — classe que
  **já tem cartão próprio**, não abri outro.

---

## 7. O que eu não fiz, de propósito

- **Não usei canal externo** (telefone/WhatsApp) — segue fora da minha alçada.
- **Não submeti delist a terceiro**, não toquei em DNS.
- **Não inventei endereço** a partir do nome. `ulyssemmachado` × "Ulysses" cheira
  a typo, e **chutar a letra faltando manda a conta de um pagante para um
  estranho**.
- **Não mexi** em crédito, acesso, plano, assinatura ou status de pedido.
- **Não gastei GPU**, não apliquei migration, **não mergeei nada**.
- **Não toquei** em nada da planilha (ordem de 29/08).
- **Não re-medi** os cartões parados em decisão do Johnny.

---

## 8. Fim de ronda

- Log + 1 ferramenta nova + 1 conserto de ferramenta, commitados na **main**
  (regra 25-B). Nenhum código de produção mudou.
- Recado no **grupo** via `notify-grupo.sh` (canal de 31/08). Nada no privado.
- `git log origin/main..HEAD` conferido vazio no fim.
- Escrita conferida na releitura: `#328` relido, carta uid 3406 confirmada na
  pasta remota.
