# Ordens — qual vale

Ordem é **datada e substituível**; o manual (`01`–`06`) é permanente. Quando
as duas discordarem, **a ordem mais nova vence** e o manual é corrigido em
seguida.

## Como ler

1. **Comece por este índice.** Ele diz qual é a ordem vigente de cada assunto.
2. Ordem superada leva um bloco `⛔ SUPERADA` no topo dizendo o que morreu e
   quem a substitui. **Se não tem o bloco, ela vale.**
3. Chegaram várias no mesmo dia? Ordene por horário e leia **todas antes de
   tocar em qualquer coisa** — a última pode anular parte da primeira.
4. **Na dúvida entre duas, pergunte.** Nunca escolha em silêncio quando envolve
   dinheiro de aluno. Aconteceu em 18/08 e foi o Frank quem pegou.

## Regra de canal (atualizada 20/08 — ver `2026-08-20_canal_telegram.md`)

> **Se eu preciso EXECUTAR aquilo, vai no git. Se é pra alguém SABER, vai no
> Telegram.**
> DDL, código, saída de comando, lista, consulta, ordem — **commite**, que eu
> leio do repositório: histórico, autoria e diff. Mensagem some, commit fica.
> O grupo **BrothersAI** (Johnny + Frank + Claude, mesmo bot, prefixo de quem
> fala) carrega o ping e a conversa em português — curto, sem jargão, porque o
> Johnny lê no celular.
> **Nunca no Telegram:** segredo (token, chave, senha), bloco de código ou
> saída de comando, e dado que identifique aluno sem necessidade.

## ⛔ ENCERRADO — regra de crédito (20/08)

**`2026-08-20_REGRA_FINAL_CREDITO.md`** — *"Aluno pagou, tem créditos. Parou de
pagar, não terá mais créditos novos e usa os que tem até acabar."* Dita pelo
Johnny, assunto **fechado**. Aplique e feche; não escale, não refine, não
reabra.

## ⭐ LEIA ESTA PRIMEIRO (20/08)

**`2026-08-20_dono_da_fila_e_fila_zerada.md`** — você é o DONO da fila (regra
14-A: o Vigia abre e anota, você decide e fecha), a fila está ZERADA, e as 3
coisas que sobraram + as armadilhas medidas hoje.

## ⭐ Anterior

**`2026-08-19_ULTIMOS_5.md`** — as 5 últimas verificações pra prova fechar.
Watchdog já está provado e encerrado. As ordens abaixo viram referência.

## Rotina permanente

**`2026-08-19_rotina_das_falhas.md`** — de hora em hora, olhar a fila de
incidentes, corrigir pelo playbook e fechar. Um relatório por dia, mesmo em
dia limpo. Enquanto o vigia noturno não existe, **o Frank é o vigia**.

## Vigentes

| Assunto | Ordem que vale |
|---|---|
| 🗺️ **O FLUXO: quem olha o quê e como se chama socorro** | `2026-08-20_fluxo_quem_olha_o_que.md` |
| 🌙 Rotina das Falhas 24h (turno da noite) | `2026-08-20_decisoes_55_trancadas_e_turno_noite.md` (item 2) |
| 🔴 Correções da ronda de 20/08 (janela do QA, worktree) | `2026-08-20_correcoes_da_ronda.md` |
| 💬 Canal: Telegram + git, e como ligar o teu lado | `2026-08-20_canal_telegram.md` |
| **Crédito: quem perde, quem mantém** | ⭐ `2026-08-20_REGRA_FINAL_CREDITO.md` — substitui TODAS as anteriores do assunto |
| Gate das telas (Roteiro, Edição, Settings) | `2026-08-18_gate_por_credito.md` |
| Congelar a lista + trial × venda | `2026-08-18_ok_para_executar.md` (itens 1 e 3) |
| Vigia noturno | `2026-08-18_vigia_noturno.md` |
| Prova de capacidade | `2026-08-18_prova_de_capacidade.md` |
| Como saber se "já pagou" (migration 79) | `2026-08-18_migration_ja_pagou.md` |
| Canal, conta de teste e prioridade | `2026-08-18_ddl_pelo_git_e_prioridade.md` |
| DDL aprovado + achados da prova | `2026-08-19_ddl_aprovado_e_achados.md` |
| 🖼️ Imagens: refactor de hoje + branch STALE (não mergear `feat/fix-image-upload-retry`) | `2026-08-19_imagens_refatoradas_branch_stale.md` |
| 🔊 Incidentes do QA de completude: medição pronta, falta curar 2 vozes | `2026-08-19_qa_coverage_incidentes.md` |
| 🔊 Resposta à passagem das vozes: quase tudo resolvido; falta re-medir 40 entregas (fecha o fb8d29b7) | `2026-08-19_resposta_passagem_vozes.md` |

## Superadas (leia só pra entender o histórico)

| Ordem | O que morreu |
|---|---|
| `2026-08-20_decisoes_55_trancadas_e_turno_noite.md` **item 1** | ⛔ **assunto ENCERRADO pelo Johnny em 20/08.** Ninguém destrava, ninguém zera, status quo nas 55. **Não reabrir.** O item 2 (turno da noite) segue valendo. |
| `2026-08-18_cancelar_credito_no_vencimento.md` | **"venceu = zera o crédito"** — substituída no mesmo dia por `2026-08-18_regra_final_pagou_fica.md`. Quem **pagou** fica com o crédito e com as portas. Confundir as duas já trancou aluno pagante (20/08). |
| `2026-08-18_ok_para_executar.md` | **item 4.3** — trava por `hasActiveAccess`. Bloquearia quem já pagou. |
| `2026-08-18_147_sem_acesso.md` | a conclusão (os 147 estavam soltos demais, não bloqueados) |
| `2026-08-18_trava_decisao_final.md` | ordem de execução (Hotmart → trava) e o recorte por status |

## O critério que vale hoje, em uma linha

> **Pagamento**, não status de assinatura. Quem já pagou fica com o crédito e
> com as portas. Quem nunca pagou e saiu do trial não gasta.
