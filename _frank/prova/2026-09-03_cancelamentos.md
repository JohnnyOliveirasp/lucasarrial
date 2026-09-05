# Cancelamentos de 03/09/2026 — apuração

Somente leitura. **Nenhum saldo foi tocado por esta apuração** — quem age é a
varredura `expire_trial_credits`. Aqui só se confere se a regra 9 está sendo
cumprida.

Ferramenta: `node _frank/ferramentas/cancelamentos_ontem.cjs --dia 2026-09-03`
Janela UTC `2026-09-03T00:00:00Z → 2026-09-04T00:00:00Z`.
Rodada no Hetzner (`/mnt/volume/aiverse`) porque o `frontend/.env.local` **não
existe no clone local** — o script foi copiado pra lá, não as credenciais pra cá.

**8 eventos → 8 pessoas: 6 trial, 2 assinantes.**

---

## 1. Fora da regra AGORA — 1 caso, 90.475 cr parados

**casaestudioholanda@gmail.com** (Victor Holanda Fernandes) — assinatura `2U4GA8ZU`

| | |
|---|---|
| adesão | 2026-08-04 (trial) |
| cancelou | 2026-09-03 — 30 dias na casa |
| dia 10 do trial | **2026-08-14 — passou há 21 dias** |
| saldo hoje | **90.475 cr de mensalidade** (extra 0) |
| marcador em `trial_credit_expirations` | **nenhum** |

O crédito devia ter expirado em 14/08. Não expirou, e não há sequer marcador de
que a varredura tenha olhado pra ele.

### ⚠️ Este caso seria classificado ERRADO pela regra escrita na ordem

A ordem diz *"cobrança com `price.value > 0` = pagou"*. As cobranças dele:

```
rec#1 R$   0  COMPLETE   2026-08-04
rec#2 R$  97  OVERDUE     <-- existe, mas NUNCA foi paga
rec#2 R$  97  OVERDUE
rec#2 R$  97  OVERDUE
```

Por `price.value > 0` puro ele vira **ASSINANTE**, e o relatório diria "mantém o
crédito, tudo certo" — e o vazamento de 90.475 cr passaria batido. A Hotmart
**emite** a mensalidade e deixa `OVERDUE` pra quem nunca pagou.

Critério correto, o que a ferramenta usa (mesmo do `pagou_de_verdade.cjs`):
**pagou = `value > 0` E `status ∈ {COMPLETE, APPROVED}`**.

Não é novidade: é a ARMADILHA 1 documentada no cabeçalho da ferramenta (custou
1.356.554 cr em 18/08) e o mesmo caso do `cleutonvalentim82` em 28/08 (e24ab03).
**Terceira vez que aparece. A ordem escrita continua com o critério fraco.**

---

## 2. Vão vazar também — a máquina que cumpre o prazo está parada

5 trials de ontem ainda **dentro** do prazo. Pela regra, expiram sozinhos no dia
10. Só que a varredura não expira nada desde 18/08 — então **não vão expirar**.

| e-mail | saldo | dia 10 cai em |
|---|---|---|
| rodrigoaugusto@hotmail.com | 100.000 cr | 2026-09-13 |
| assinaturas@datacrazy.io | 84.640 cr | 2026-09-07 |
| pedro@franquiada.com.br | 80.724 cr | 2026-09-12 |
| paulajordaobonato@gmail.com | 63.785 cr | 2026-09-12 |
| leandragomes.terapeuta@gmail.com | 61.175 cr | 2026-09-10 |

**390.324 cr** aqui + 90.475 do Victor = **480.799 cr só da leva de ontem.**

### A prova de que a varredura está parada

O script não conseguiu ler o corpo da função (`SUPABASE_ACCESS_TOKEN` não está no
`.env.local` do servidor) e reportou `DESCONHECIDO`. Como *"não saber conferir não
é ter conferido"*, fui pelo rastro que ela deixa em `credit_transactions`
(45 dias, **paginado até o fim** — sem limite escondido):

```
trial_cancelado | DEBITO   n=119  soma= -9.935.199  ultimo=2026-08-18
trial_expirado  | DEBITO   n= 14  soma= -1.356.554  ultimo=2026-08-18
```

E `trial_credit_expirations`: as 15 linhas mais recentes são todas de **18/08**,
todas `outcome=paid`, `debited=0`.

**Nenhum débito de expiração de trial desde 18/08 — 17 dias.** Os 14 ×
-1.356.554 de 18/08 são exatamente a devolução indevida daquele dia; depois dela
a varredura não mexeu em mais nada.

> Erro meu, corrigido no caminho: a primeira consulta pegou "os 200 débitos mais
> recentes dos últimos 45 dias" e voltou 0 de trial — eu quase reportei "zero em
> 45 dias". Os 200 cobriam só **18 horas** (03/09 18:31 → 04/09 13:03). O número
> acima é da consulta paginada, que cobre a janela inteira.

**Ordem de grandeza do problema (não é o vazamento, é onde ele mora):** 695
perfis com `credits_subscription > 0` e conta anterior ao dia 10. Inclui pagante
legítimo — só serve pra dizer que o backlog não é pequeno. Não classifiquei os
695: fora do escopo do relatório de ontem.

---

## 3. Dentro da regra — os 2 assinantes

Pagaram de verdade (R$97 `APPROVED` em 02/09), cancelaram a recorrência e
**mantiveram o crédito**. Regra 9 cumprida: zero lançamento de zeramento nos dois.

| e-mail | assinatura | na casa | saldo mantido | acesso até |
|---|---|---|---|---|
| barrozo.t@gmail.com | `PCKL0S6G` | 8 dias | 173.955 cr | 2026-09-26 |
| novaeraperformance@gmail.com | `T7ROUKCL` | 8 dias | 151.780 cr | 2026-09-26 |

## 4. Armadilha 2 (pessoa × assinatura)

Conferida: as 8 pessoas foram agrupadas por **e-mail**, e todas as assinaturas de
cada uma foram lidas na Hotmart. **Nenhuma** das 8 tem outra assinatura viva
(`ACTIVE/STARTED/DELAYED`). Ninguém aqui é falso positivo por esse caminho.

---

## O que precisa de decisão humana

1. **Religar a `expire_trial_credits`** — parada há 17 dias. Enquanto isso, todo
   trial que sai acumula crédito que devia ter expirado. Não religo por conta
   própria: foi desligada em 18/08 justamente depois de zerar 1.356.554 cr de
   quem tinha pagado.
2. **Victor Holanda** — 90.475 cr, 21 dias vencidos. Não zerei (regra: quem age é
   a varredura, não o relatório).
3. **Corrigir o critério na ordem do relatório** — trocar `price.value > 0` por
   `value > 0 E status ∈ {COMPLETE, APPROVED}`. Terceira aparição da mesma
   armadilha.
4. **`SUPABASE_ACCESS_TOKEN` não está no `.env.local` do Hetzner** — sem ele o
   relatório não consegue afirmar se a varredura está viva, e cai no rastro
   indireto. Vale copiar pra lá.
