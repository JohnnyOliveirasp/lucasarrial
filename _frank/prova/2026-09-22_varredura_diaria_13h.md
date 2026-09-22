# Varredura diária — 22/09/2026, ~11h50–12h10Z

Canal: ordem de 31/08 — FastCloner **só no grupo**. Relatório postado com
`notify-grupo.sh`. Ordem de 29/08 respeitada: **nada da planilha** foi lido.

**Uma linha:** a casa está tecnicamente limpa (0 pagante trancado, 0 fila com
gente esperando, produção viva), e o único item com DATA — o `#506` — **não
tinha sido tocado pela ronda das 12hZ de hoje**. Vim por ele e cobrei o prazo
uma vez, como o handoff de ontem mandava.

**Cartões fechados: 0. Alunos escritos: 0. Fix em produção: 0. Dinheiro
devolvido: 0. Escritas em banco: 1 (nota do `#506`).**

---

## 0. Passos fixos

| passo | resultado |
|---|---|
| `git pull --ff-only` na main | já atualizado, sem divergência |
| `varredura_travados.cjs` | 1 linha obsoleta (escrituração) · **0 aluno preso** · 103 abertos · 35 aguardando aluno |
| `pagante_trancado.cjs` (298 suspeitos, 1 a 1 na Hotmart) | **0 pagante trancado** · 28 fronteira · 1 sem prova |
| `saida_x_assinatura.cjs` | **0 sangrando** · 0 a revisar · 42 já fora |
| `2026-09-19_idade_dos_abertos.cjs` | 103 abertos · **48 com 7d+** · mais velho **21d** |
| `2026-09-21_garantia_dos_90_vazios.cjs` | re-medido, **idêntico a ontem** |

### O campo `error` foi conferido, como a ordem manda

A varredura **não** trouxe nenhum `⚠️ <tabela>: <mensagem>` nem
`consulta de INCIDENTES FALHOU`. O único `⚠️` da saída é a linha fixa de texto
sobre 7d+. Logo os zeros são **medidos**, não cegos. O script já protege os dois
buracos de 18/08 e 23/08 (erro impresso na cara, contagem exata separada da
lista, lista NEGRA de status).

Contagem: **103 abertos EXCLUI os 35 `aguardando_aluno`** (o `.not(... in
(fixed,ignored,aguardando_aluno))` é explícito). Vida total = **138**.

---

## 1. O número do relatório: 0 pagante trancado

`pagante_trancado.cjs` conferiu **cada um dos 298** suspeitos na Hotmart:

| | |
|---|---|
| 🔴 **PAGANTE TRANCADO DE VERDADE** | **0** |
| 🟡 fronteira das 12:00 (recheque em horas) | 28 |
| ⚪ cancelaram | 16 |
| ⚪ inadimplentes | 244 |
| ⚪ trial que nunca virou pagamento | 9 |
| ⚠️ **NÃO consegui provar** | **1** — `drfabiovilhena29@gmail.com`, sem subscriber code no payload |

Não usei `_Bugs/prova_raio.cjs` (falso positivo conhecido desde 19/08: 147 em
18/08 e 265 em 19/09, ambos **0** na conferência um a um).

---

## 2. Onde eu quase errei: a Hellen

O 🚨 da varredura apontou `hellengrasso@gmail.com` — acesso vivo, 95.375 cr,
**16 dias sem voz pronta**, voz recusada por falha NOSSA (2 de 7 arquivos
chegaram). Cruzei com `pagou_de_verdade.cjs`: **pagou mesmo** (R$ 597 + 47,94
GBP em 05/09). Parecia o caso serial óbvio do dia.

**Fui medir antes de escrever pra ela, e não era.** A ronda de 21/09 23h40Z já
tinha encerrado o caso: 4 cartas enviadas (05, 06, 11 e 12/09, conferidas na
pasta Enviados remota), conserto de classe em produção (PR #256), créditos
intactos, R2 listado (a perda é real e a mensagem ao aluno está correta), e a
porta do `/sgp` **aberta** pra ela no código. Bola legitimamente dela.

⚠️ **E o instrumento quase me enganou de novo.** `emails_enviados` devolveu
**0 cartas** pra ela — e isso **não é prova de silêncio**: a tabela só existe
desde **14/09 14:06Z** (migration 108) e as cartas dela são de 11 e 12/09. Zero
vindo de instrumento cego não é zero medido (armadilha 1 do manual). Quem ler
só aquela tabela vai concluir "nunca escreveram pra ela" e mandar a 5ª carta.

**Não escrevi pra ela.** Seria a 5ª em 16 dias sobre o mesmo assunto, sem fato
novo. O que sobra dela está dentro da decisão dos 90 (`#506`), e a garantia dela
**já venceu em 12/09**.

> Para a próxima ronda: **a Hellen segue ENCERRADA como item serial.** É a
> terceira ronda seguida em que ela aparece como candidata natural. Ela não é.

---

## 3. O que de fato faltava: `#506` não tinha sido tocado hoje

O handoff de 21/09 23h40Z deixou 6 itens. O item **1** era: *"`#506`/os 90 — o
mais urgente da casa hoje. Se amanhecer 22/09 sem resposta, vale cobrar uma vez
citando o prazo."*

A ronda das 12hZ de hoje fez um trabalho sério em `#214`/`#446` (colapsou as
duas escaladas numa só) e `#245` — **mas não encostou no `#506`**, que é o único
com relógio correndo. Esse era o buraco.

### Re-medi antes de cobrar

Rodei `2026-09-21_garantia_dos_90_vazios.cjs` hoje. **Números idênticos aos de
ontem:** 90 pedidos vazios / 90 e-mails distintos / 24 com compra aprovada
naquele endereço / **7 JÁ FORA** / **5 AINDA DENTRO**.

Dos 5, **TRÊS vencem em 2026-09-23** — `jununes42@hotmail.com`,
`joaov.cestaro@hotmail.com`, `fastcloner@americanshowerglass.com`. Os outros 2
em 28/09. Com a margem declarada de ±1 dia, **23/09 é limite máximo e a ação
tinha que sair hoje**.

Os **78** sem compra naquele endereço seguem **não contados como não-pagantes**.

### Ação

`ask_humans` ao grupo, **uma** vez, consolidado, com a recomendação SIM e a
saída parcial ("um SIM só para os 3 de amanhã já resolve o urgente").
`HTTP 200`, `ok:true`, `sent_to 120363428193217427@g.us`. Nomes **fora** do
Telegram (regra de canal), gravados na nota do card.

⚠️ **Registro pra ninguém reenviar achando que falhou:** a nota automática do
`ask_humans` carimba *"SEM LINK — ninguém vai conseguir abrir"*. Isso é o
`has_link:false` da rota e **só importa quando o pedido leva `--audio-key`**.
Este é pedido de **decisão**, texto puro, sem anexo. **O pedido não nasceu
cego.**

---

## 4. Achado da fila: os recados crescem sozinhos

- **144 recados `para_frank_*`** sem tratar. Mais velho: **03/09** (19 dias).
  Ontem eram **141**. A rotina manda tratar e apagar **com `DELETE`** (§1-C).
- **2 patches do Vigia** esperando revisão: `patch_b6b777eb` (21/09, Fast diz
  "pode continuar usando normalmente" pra conta sem acesso) e `patch_b5073c91`
  (19/09, Gerador de Imagem gira "Gerando..." pra sempre, `#477`).

Não tratei nenhum nesta varredura — teria que abrir frente nova com o `#506`
ainda sem resposta, e a regra 8 é serial de propósito. **Fica reportado, não
escondido:** é dívida que cresce, e é a mesma família do acidente de 30/08 (28
recados empilhados até ~70h porque a instrução de limpeza estava errada).

---

## 5. Produção está viva

O endpoint `sweep-clones` **não rodou**: o guard da máquina do Frank derruba a
forma `grep <segredo> + curl` (mesmo bloqueio que motivou o `ask_humans.cjs`).
**Não tenho a medida direta e digo isso em vez de omitir.**

Medida indireta, conferida às 12h05Z: `video_clones` 12:04:35Z, `generations`
11:48Z, `voices` 11:26Z, `emails_enviados` 12:03:42Z, `incidents` 11:55Z. A casa
está gerando, escrevendo e registrando **agora**. Não é o health do sweep, mas
descarta "produção muda" (o acidente de 08/08).

> Pendência de ferramenta: o `sweep-clones` precisa de um invólucro como o
> `ask_humans.cjs` ganhou, senão ele fica permanentemente fora da varredura.

---

## 6. O que eu NÃO fiz, e por quê

- **Não devolvi dinheiro a ninguém** — 9-A, é do Johnny, e é justamente o que
  está sendo perguntado.
- **Não escrevi a nenhum aluno** (nem à Hellen, nem aos 90).
- **Não fechei nem reabri cartão nenhum.** Nada podia fechar sem mentir.
- **Não li a planilha** (ordem de 29/08).
- **Não tratei os 144 recados nem os 2 patches** — reportados no §4.
- Não mexi em plano, acesso, assinatura, migration, nginx, RunPod ou GPU.
  Nenhum merge, nenhum PR.

---

## 7. Para a próxima ronda

1. **`#506` é o item com relógio.** Se o Johnny respondeu, **execute hoje** pelos
   3 que vencem em 23/09. Se passou de 23/09 sem resposta, **não finja que ainda
   dá**: registre que a janela fechou e que viraram caso de exceção — é a família
   do `#207` (aviso ficou na nota, garantia venceu, aluno ficou sem R$ 97).
2. **`#214`/`#446`**: a pendência real é a **migration `scripts/111` nunca
   aplicada**, não falta de regra. Escalado hoje às 12hZ. Só o Johnny aplica DDL.
3. **Recados e patches (§4)** — 144 e 2. Escolha um e trate, ou a dívida só cresce.
4. **NÃO devolva a Hellen ao handoff como item serial.** Terceira ronda seguida
   em que ela aparece e está encerrada. Ver §2.
5. **`emails_enviados` só cobre a partir de 14/09 14:06Z.** Nunca conclua "nunca
   escreveram pra este aluno" só com ela — confira a pasta Enviados (remota).
6. **`sweep-clones` está fora da varredura** por bloqueio do guard (§5). Precisa
   de invólucro.
