# 21/09 — 90 pedidos do SGP migrados da planilha antiga chegaram VAZIOS e estão parados há 11 dias

## O que foi medido

Na ronda de 21/09, o bloco "ACESSO VIVO, COM CRÉDITO E SEM NENHUMA VOZ PRONTA"
da varredura apontou 1 aluna (hellengrasso@gmail.com). Investigando o caso
inteiro (regra §3 da rotina: "provavelmente há mais gente na mesma situação"),
o caso dela não é individual — é a ponta de um lote de 90.

## O lote

```sql
select status, origem, count(*),
       count(*) filter (where jsonb_array_length(fotos)=0 and jsonb_array_length(audios)=0) as sem_nada
from sgp_pedidos
where concluido_em is null and erro_manual_em is null
group by status, origem;
```

| status | origem | qtd | sem foto E sem áudio | sem voz | dias mais velho |
|---|---|---|---|---|---|
| dados | **planilha_antiga** | **90** | **90** | **90** | **11** |
| foto | portal | 95 | 83 | 95 | 21 |
| pronto | portal | 117 | 1 | 1 | 23 |
| audio | portal | 27 | 1 | 27 | 17 |
| dados | portal | 18 | 18 | 18 | 17 |
| revisao | portal | 2 | 0 | 2 | 5 |

Os 90 de `planilha_antiga` foram todos criados em **10/09** e **nenhum** andou
desde então.

## O ponto que dói

Nos 90, o `origem_dados` gravado na migração diz **`tem_foto: true` E
`tem_audio: true`** — ou seja, a planilha antiga TINHA o material dessas
pessoas. O pedido migrado chegou com `fotos: []` e `audios: []`.

Quebra por situação declarada na planilha (todos os 8 grupos têm
tem_foto=true e tem_audio=true):

| situação | status na planilha | qtd |
|---|---|---|
| TEM CONTA, SEM PEDIDO | Erro | 40 |
| SEM CONTA | Verificação | 22 |
| TEM CONTA, SEM PEDIDO | Em Andamento | 16 |
| SEM CONTA | Erro | 4 |
| SEM CONTA | Em Andamento | 3 |
| TEM CONTA, SEM PEDIDO | Verificação | 2 |
| TEM CONTA, SEM PEDIDO | Recebido | 2 |
| SEM CONTA | (null) | 1 |

## Eles pagaram? — amostra conferida na Hotmart, um a um

**NÃO afirmo que são 90 pagantes.** Lição do falso positivo de 18-19/08 (os
"147 pagantes trancados" que eram ZERO): número do nosso banco não é prova.
Conferi 10 dos 90 com `pagou_de_verdade.cjs`:

| e-mail | resultado na Hotmart |
|---|---|
| consultor.adrianomarques@gmail.com | **PAGOU** 497 BRL *Sistema de Geração Pronto* (25/06) |
| amandasantossl@outlook.com | **PAGOU** 497 + 541,12 BRL *Sistema de Geração Pronto* (31/05) |
| frotasantoos@gmail.com | **PAGOU** 497 BRL *Sistema de Geração Pronto* (24/06) |
| dornelascarsales@gmail.com | **PAGOU** 102 USD *Sistema de Geração Pronto* (09/07) |
| hellengrasso@gmail.com | **PAGOU** 597 BRL *Sistema de Geração Pronto* (05/09) |
| luisa13ra@icloud.com | sem pagamento NESTE endereço |
| marcel.sabrina@gmail.com | sem pagamento NESTE endereço |
| douglasvinicius.jur@gmail.com | sem pagamento NESTE endereço |
| luctec@gmail.com | sem pagamento NESTE endereço |
| comex@estradatransportesltda.com.br | sem pagamento NESTE endereço |
| lazevedo@adv.oabsp.org.br | sem pagamento NESTE endereço |

**5 de 10 conferidos pagaram pelo PRÓPRIO produto cujo pedido está vazio** (o
Sistema de Geração Pronto), entre 497 BRL e 597 BRL cada.

Os outros 5 dizem apenas "sem pagamento NESTE ENDEREÇO" — que **não é prova de
que não pagaram**: comprar num e-mail e entrar com outro é a armadilha nº 1 da
casa (#214, #218). Ficam como NÃO PROVADO, não como "não pagou".

## O caso que puxou o fio — hellengrasso@gmail.com

Está travada por DOIS caminhos ao mesmo tempo:

1. **Voz self-service (06/09):** `rejected_too_short` — *"Recebemos apenas 2 dos
   7 arquivos que você enviou — 5 não chegaram até nós"*. O envio foi
   interrompido no meio. 15 dias parada.
2. **Pedido do SGP (10/09):** `status='dados'`, `fotos: []`, `audios: []`,
   `user_id: NULL`, `voice_id: NULL`. 11 dias parado. A planilha dizia
   `tem_foto: true, tem_audio: true`.

Pagou 597 BRL (SGP) + 47,94 GBP (Fábrica de Conteúdo Invisível), acesso ATIVO
até 05/10, 95.375 créditos no bolso, **e nenhuma voz**. `aluno.cjs` não acha
registro de resposta humana a ela (com a ressalva de sempre: ausência de
registro não é prova de silêncio — a caixa suporte@ não é lida por nós).

## O defeito do upload parcial, medido à parte

```sql
select status, count(*), count(distinct user_id)
from voices where error_message like '%não chegaram até nós%' group by status;
```

19 vozes / **11 alunos**, de 19/07 a 06/09, todas `rejected_too_short`.
Desses 11, **4 nunca chegaram a ter voz pronta**:

| e-mail | dias parado | acesso | pagamento |
|---|---|---|---|
| casatumca@gmail.com | 61 | vencido | pagou avulsa 297 BRL; assinatura FastCloner é trial R$0 → OVERDUE |
| jrfengenhariadf@gmail.com | 58 | vencido | sem pagamento neste endereço |
| leandro.fitoway@gmail.com | 53 | vencido | pagou avulsa 313,32 BRL; assinatura trial R$0 → OVERDUE |
| **hellengrasso@gmail.com** | **15** | **ATIVO até 05/10** | **pagou 597 BRL pelo SGP** |

Os 3 primeiros têm acesso vencido e a assinatura FastCloner deles era trial R$0
que virou OVERDUE — pela ordem do Johnny de 13/08 trancar está certo, e o que a
compra avulsa dá direito no FastCloner é **decisão comercial, não de script**
(#173). Não toquei.

## O que NÃO fiz e por quê

- **Não repus foto/áudio de ninguém.** O material está (ou estava) na planilha
  antiga; não vou fabricar entrega no escuro nem adivinhar arquivo de aluno.
- **Não escrevi para os 90.** É e-mail em massa com conteúdo novo (>10 pessoas)
  — precisa de aval do Johnny (06_RELATORIO_E_LIMITES).
- **Não conferi os 80 restantes na Hotmart.** A amostra é 10. O número honesto
  é "5 de 10 conferidos pagaram", não "90 pagantes".

## O que falta decidir

1. A planilha antiga ainda tem foto/áudio dessas 90 pessoas? Se tem, a migração
   precisa de um re-import — e aí é conserto de verdade, não aviso.
2. Se não tem, essas pessoas precisam ser chamadas para reenviar — e isso é
   e-mail em massa, precisa de aval.
