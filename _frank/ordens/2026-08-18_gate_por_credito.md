# ORDEM — Roteiro e Edição passam a olhar CRÉDITO (18/08)

Decisão do Johnny, fechando a pergunta que ficou aberta na ordem
`2026-08-18_regra_final_pagou_fica.md`: **as telas olham crédito, não
assinatura.** Quem pagou e cancelou mantém o crédito **e** as portas.

---

## 1. Por que isso não é novidade — é volta ao padrão

Isto já era a regra. Está escrito no próprio código, em
`app/[locale]/app/settings/page.tsx:10`:

> *"Liberada por CRÉDITO, não por assinatura vigente (ordem do Johnny, 10/08:
> 'não posso travar ele porque ele não tem assinatura'). Quem tem saldo pode
> usar o que comprou, **aqui e em qualquer outra tela**."*

A trava por assinatura em Roteiro e Edição (13/08) foi a **exceção** que
destoou. Agora ela sai e tudo volta a falar a mesma língua.

## 2. Card do coder — o que mudar

Trocar o gate de `subscribed` (assinatura) por **crédito**:

| Arquivo | Hoje | Vira |
|---|---|---|
| `app/[locale]/app/roteiro/page.tsx:47` | `if (!team && !subscribed) redirect(...)` | gate por crédito |
| `app/[locale]/app/videos/edicao/page.tsx:35` | `if (!bypassesBilling(email) && !subscribed) redirect(...)` | gate por crédito |
| `components/app/sidebar.tsx:170` | `locked: !unlimited && !subscribed` (Edição) | por crédito |
| `components/app/sidebar.tsx:230` | idem (Roteiro) | por crédito |
| `components/app/sidebar.tsx:338` | idem (Settings) | **por crédito — ver 2.1** |

### 2.1 Settings é bug puro, e é o mais fácil

A **página** de Settings já libera por crédito (`unlocked = bypassesBilling ||
creditsTotal > 0`). Só a **sidebar** ainda põe cadeado por assinatura. Menu
diz "trancado", tela abre. Corrija a sidebar pra bater com a página — é
alinhar, não decidir.

### 2.2 Qual é o "mínimo" de cada tela

Siga o padrão que já existe no projeto, **não invente um terceiro**:

- `videos/clone/page.tsx` usa `creditsTotal >= CLONE_MIN_CREDITS` — o custo
  mínimo daquela tela.
- `settings/page.tsx` usa `creditsTotal > 0`.

Para **Roteiro**, o custo de entrada é conhecido (100 cr pra gerar, 10 cr por
mensagem de chat) — use o mesmo desenho do clone, com a constante vindo da
config do roteiro, não com número solto no meio da página.

Para **Edição**, se não houver custo mínimo claro definido, use
`creditsTotal > 0` e **diga isso no relatório** — não invente um valor.

### 2.3 O texto tem que mudar junto

Hoje quem cai no bloqueio vê *"Você ainda não tem plano"* com botão
**Assinar**. Com o gate novo, o motivo passa a ser saldo: a mensagem tem que
falar de **crédito** e mandar pra `/app/credits`, não pra `/planos`. A
variável `subscribed` continua existindo pra escolher esse texto em outras
telas — **não a apague**, só pare de usá-la como tranca.

## 3. O que NÃO muda

- **`bypassesBilling`** (Johnny, Lucas, Edu) e admins continuam passando.
- **A trava do débito** da ordem `regra_final_pagou_fica` continua valendo:
  quem **nunca pagou** e saiu do trial não gasta. Isto aqui é sobre **abrir a
  porta pra quem tem crédito**; aquilo é sobre **não deixar gastar quem nunca
  pagou**. São coisas diferentes e as duas valem ao mesmo tempo.
- Os gates que **não** são de assinatura ficam como estão: voz que exige voz
  pronta, treino que exige o custo do treino, Publicador atrás do App Review
  da Meta.

## 4. Prioridade

Isto é **card pequeno e independente** — não depende da lista congelada, nem
do zeramento, nem do vigia. Pode ir junto com a trava do débito ou antes dela.
É fix pequeno: vai direto na `main` (regra 5).

Depois de subir, confirme na prática com **uma** conta de aluno que tenha
crédito e assinatura vencida: o menu tem que abrir Roteiro, Edição e Settings.
Não confie no diff — abra a tela. E lembre do playbook M: siga a variável até
onde ela decide, e cite `arquivo:linha` no relatório.
