# Fila de incidentes — medição em 20/08/2026 ~14:38 UTC

Pergunta do Johnny: "tem chamado em aberto nas falhas, quem vai ver isto?"
Resposta com número, leitura pura (zero escrita no banco). Consulta paginada
(range de 1000 em 1000) direto na tabela `incidents` com service role.

## 1. Quantos estão abertos AGORA

**1 (um) incidente** com status `open` ou `investigating`. Só ele:

| id | status | abriu | aberto há | alunos | resumo |
|---|---|---|---|---|---|
| aabfa1e5-78e9-4e56-8ed9-405020330de6 | investigating | 2026-08-20 12:16 UTC | **2,4h** | ms.sobadjian@gmail.com, celsopinto@gmail.com | 2 pagantes ativos (100.000 créditos, acesso até 27/08) com a voz parada; o crédito JÁ ENTROU (~02h de hoje) mas a tela ainda mostra o erro antigo e ninguém avisou os dois |

**O aabfa1e5 ainda está aberto? SIM.** Status cru do banco:
`status = "investigating"`, `resolved_at = null`, `resolved_by = null`.

## 2. Classificação

### (a) Precisa de decisão do Johnny

**Nenhum incidente aberto depende de decisão do Johnny.**

O aabfa1e5 não envolve dinheiro novo, estorno, migration nem regra de negócio:
o crédito já está na conta dos dois, basta avisá-los por e-mail — e responder
aluno por e-mail está na lista "decida sozinho" do `06_RELATORIO_E_LIMITES.md`.

### (b) Dá pra fechar sozinho

| id | playbook | ação |
|---|---|---|
| aabfa1e5 | **J** (mandar e-mail pro aluno) do `04_PLAYBOOKS.md` | Avisar ms.sobadjian e celsopinto que o crédito já caiu e é só abrir a voz e clicar Treinar. Depois confirmar o treino disparado e fechar como fixed. |

A nota do executor (12:26 UTC) já confirmou que NÃO é bug de código: o gate de
`start-training` lê o saldo ao vivo, então os dois conseguem treinar agora. O
item estrutural da nota (backfill/reaviso após subscription_grant) é melhoria,
não bloqueio — se virar trabalho, é card próprio, não este incidente.

## 3. `investigating` sem nota nenhuma

**0 (zero).** O único investigating da fila tem 1 nota de agente (12:26 UTC,
diagnóstico completo + plano). Não há incidente "parecendo que alguém olha e
não olha".

## 4. Mais antigo da fila

O próprio aabfa1e5: **2,4 horas** (aberto 12:16 UTC de hoje). A fila não tem
nada envelhecido — tudo que abriu antes de hoje 12h foi fechado.

## Checagem extra (regra da vigia): fechados que continuam disparando

16 incidentes `fixed/ignored/fixing` tiveram `last_seen_at` nas últimas 24h,
mas em **todos** o `last_seen_at` é ANTERIOR ao `resolved_at` — ou seja,
nenhuma classe fechada voltou a disparar depois de fechada. Nada escondido.

## Resposta à reclamação do Johnny

Hoje a fila está saudável: 1 aberto, com 2,4h, já diagnosticado, fechável sem
você. "Quem vê isto" é a ronda horária (8h–22h) + o vigia — e este caso é
exatamente ela funcionando: o vigia abriu às 12:16 e o executor anotou o
diagnóstico às 12:26, 10 minutos depois.

---

## Saída crua das consultas

```
=== FILA open/investigating: 1 incidente(s) (consulta paginada, 2026-08-20T14:38:29.816Z) ===

--- aabfa1e5-78e9-4e56-8ed9-405020330de6
status=investigating kind=training cause=encalhe-silencioso
aberto_em=2026-08-20T12:16:01.45904+00:00 (2.4h atras) last_seen=2026-08-20T12:16:01.246+00:00 occ=2
alunos=ms.sobadjian@gmail.com, celsopinto@gmail.com
titulo: 2 pagantes ativos (100.000 creditos, acesso ate 27/08) com a voz parada ha ~58h e a tela dizendo que tem 0 credito - o credito entrou ha 10h e ninguem avisou
notas_do_agente=1
ultima_nota: {"at":"2026-08-20T12:26:12.327Z","by":"agent","note":"EXECUTOR (ronda horaria 20/08 12:2x UTC): confirmado, NAO e bug de codigo - e falta de aviso. [...] PLANO RECOMENDADO: 1) avisar os 2 alunos; 2) OPCIONAL disparar treino com sessao do aluno; 3) ESTRUTURAL backfill pos-subscription_grant (dono: Vigia)."}

=== INCIDENTE aabfa1e5 (status cru do banco, consulta por id completo) ===
{
  "id": "aabfa1e5-78e9-4e56-8ed9-405020330de6",
  "status": "investigating",
  "created_at": "2026-08-20T12:16:01.45904+00:00",
  "last_seen_at": "2026-08-20T12:16:01.246+00:00",
  "resolved_at": null,
  "resolved_by": null,
  "resolution_note": null,
  "affected_emails": ["ms.sobadjian@gmail.com", "celsopinto@gmail.com"]
}

=== investigating SEM NOTA nenhuma: 0 ===

=== MAIS ANTIGO: aabfa1e5-78e9-4e56-8ed9-405020330de6 aberto ha 2.4h, desde 2026-08-20T12:16:01.45904+00:00 ===

=== FECHADOS/fixing com last_seen nas ultimas 24h: 16 ===
(nenhum com last_seen POSTERIOR ao resolved_at — nenhuma classe fechada segue disparando)
[fixed]   85b4e5d7 last_seen=10:26 resolved=10:30  Paulo sem voz retreinada
[fixed]   c31012f9 last_seen=10:25 resolved=10:38  Nelson awaiting_training
[fixed]   37bacb68 last_seen=10:09 resolved=10:32  qa_coverage (11x)
[fixed]   c4b892e9 last_seen=10:04 resolved=10:30  qa_coverage RunPod FAILED (2x)
[ignored] 88eef8aa last_seen=00:09 resolved=02:45  debitos sem linha em generations (50x)
[ignored] 43f37482 last_seen=19/08 23:30 resolved=03:33  Luciano creditos
[fixed]   4396496b last_seen=19/08 20:30 resolved=00:23  Katia refazer audio
[ignored] 902a1c85 last_seen=19/08 20:18 resolved=20:58  cobranca sem generations (7x)
[fixed]   fb8d29b7 last_seen=19/08 19:28 resolved=03:29  QA nao mede insercao/substituicao
[fixed]   8d370ef5 last_seen=19/08 19:19 resolved=03:29  arquivo corrompido (14x)
[fixed]   910ea757 last_seen=19/08 19:19 resolved=03:29  moov atom no fim
[fixed]   2949257c last_seen=19/08 18:22 resolved=19:27  rajada TTS paulogmarinho
[fixed]   5bb774b8 last_seen=19/08 17:27 resolved=18:14  VP upload de fotos
[fixed]   ce6e157d last_seen=19/08 17:27 resolved=18:14  letras soltas "Minha voz"
[fixed]   73a1ecb8 last_seen=19/08 15:40 resolved=17:11  Luis Kolle link PIX
[ignored] a620a782 last_seen=19/08 15:40 resolved=17:12  escalada sem aviso (itamar)
```

Notas de método:
- Paginação explícita em blocos de 1000 (o Supabase corta em 1000).
- aabfa1e5 consultado por id COMPLETO com `.eq()` — `ilike` em coluna uuid dá
  erro 42883 (operator does not exist: uuid ~~*), fica registrado como pegadinha.
- Contas admin/sócio (johnny.oliveirasp, lucas.m.arrial) filtradas da lista de
  alunos afetados (nenhuma apareceu).
- Zero escrita: os scripts só usam `.select()`.
