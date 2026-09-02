# Rotina das falhas — 02/09/2026, ~21:00Z

Ordens lidas antes de tocar em qualquer coisa: índice `ordens/README.md`, canal de 31/08 (tudo do
FastCloner vai no **grupo**), `2026-08-29_desligar_vigia_e_frank.md` (planilha desativada) e
`2026-08-20_dono_da_fila_e_fila_zerada.md`. Método serial (regra 8, 21/08).

## Placar

| | entrada | saída |
|---|---|---|
| abertos (`open`+`investigating`) | **7** | **6** |
| aguardando aluno | 10 | 10 |

**Fechei 1 incidente (`#223`) e escrevi para 1 aluna.** A fila subiu de 5 para 7 desde a ronda das
20h (dois chamados novos: `#236` às 18:56Z e `#237` às 20:38Z), então sai em 6.

## Ordem serial — por que a Alana e não o `#234`

Regra 8 manda pegar o mais antigo **com aluno afetado**. Reordenando por quem está com a bola:

- `#47` (Katia, 19/08) e `#229`/demais: bola **com o aluno**, trabalhados em rondas anteriores.
- `#234` (609 gerações): trabalhado na ronda das 20h, que concluiu que **não dá para fechar** (a
  sombra mede, não conserta) e que **não se deve virar a chave** com precisão de ~57%. Nada mudou
  em 1h que justifique reabrir a decisão.
- `#232`: defeito de processo interno, **sem aluno sofrendo**.
- **`#223`/`#235` (Alana): a bola estava COM A GENTE.** Ela mandou às 19:18Z os prints que a nossa
  equipe pediu às 18:51Z. É o mais antigo com aluno afetado onde o próximo passo era nosso.

Esperar aluno não é estar travado — mas **ela não estava esperando: ela já tinha respondido.**

---

## §1 — O que aconteceu com ela enquanto ninguém olhava

Sequência medida na caixa, com uid e horário:

| hora | uid | o quê |
|---|---|---|
| 17:41Z | 425 (dela) | "as novas gravações estão lá, mas não permitem o envio" |
| 18:51Z | 463 (nosso) | equipe técnica pede **o print da tela "Nova voz"**, explicando que ele separa 3 causas |
| **19:18Z** | **426 (dela)** | **manda 4 prints, 2,2MB.** "Prints anexados...só estou aqui pq agora quero ver isso acontecer." |
| 19:20Z | 464 (Fast, automático) | **111 segundos depois:** "anexo grande demais (2 MB), me reenvia só o texto" |
| 20:07Z | 427 (dela) | "De verdade! Agora cansei. Quero o cancelamento." |

Ela fez exatamente o que pedimos e a máquina recusou. Desistiu **47 minutos** depois. Quando
peguei o caso, o pedido de cancelamento estava **1h sem dono** e `subscription_cancellations` não
tinha (nem tem) linha dela — o pedido nunca virou registro em lugar nenhum.

Causa da recusa, já mapeada e **não é chamado novo**: `mail-imap.ts:140` (`MAX_BYTES=2_000_000`)
+ `mail-respond.ts:229-248`. A classe é o `531b6529` (#98), com PRs #41 e #42 abertos desde 23-24/08.

## §2 — Os prints: o que eles provam e o que **não** provam

Baixei com `ler_caixa.cjs --anexos 426` (leitura pura: flags e fila de não-lidos intactas,
conferido na saída). **Primeiros olhos neles.**

**Os 4 prints são a mesma tela do GRAVADOR** (`/app/voice-cloning/script`) rolada em posições
diferentes. **Não são a tela "Nova voz" que foi pedida.** Digo na cara porque isso significa que
eles **não desempatam** as 3 causas levantadas na ronda das 18hZ — quem ler esta nota não pode
concluir que a causa foi cravada. **Não pedi outro print:** ela já mandou o que conseguiu e
escreveu "cansei".

**O que está lido na imagem (não inferido):**

- 5 clipes: **4× 05:00 + 1× 00:01**. Barra **"Fala acumulada 20:01 / 20:00"**. Verde "Meta de 20
  min atingida" + CTA presente.
- **"TAKES DO CELULAR · 0 — nenhum take ainda"**.
- 99.475 créditos no topo, batendo com o banco. Chrome Android, 16:16 local.

**Duas causas caem, cada uma por duas medidas independentes:**

| causa | veredito | prova |
|---|---|---|
| `extraSeconds` / take de celular (causa 2, nota 17h25Z) | **ELIMINADA** | R2 media 0 objetos em `recorder-test/` **e** a tela dela mostra "takes do celular · 0" |
| teto `MAX_FILES=20` (causa ii, nota 18hZ) | **ELIMINADA** | são 5 clipes, não >20; e ela veria a frase `recorderImport.skipped`, que não aparece |

## §3 — Achado novo que só os prints dão: a margem de **1 segundo**

`voice-recorder.tsx:13` `MAX_SECONDS=300` explica os quatro clipes de exatamente 5:00 (é a trava
por clipe). O total dela é **20:01** contra `MIN_DURATION_SECONDS=1200` (`voice-creator.tsx:18`).

**Ela passa do mínimo por UM SEGUNDO, e quem fecha a barra é o clipe de 0:01.**

Consequência: basta **um** dos 5 clipes não ser importado ou medido em `/new` para o total cair
abaixo de 1200, `meetsMinimum` virar false e o botão Treinar apagar (`voice-creator.tsx:647`)
**sem explicar nada**.

**Declaro como HIPÓTESE, não como veredito.** Não vejo a tela `/new` dela e nada dela chega ao
backend, então não posso confirmar do servidor. Mas é fragilidade real para **qualquer** aluno que
feche a meta raspando, e vai junto para o conserto.

## §4 — Estado do conserto: continua fora de produção (2ª ronda)

Conferido por mim, **não pelo card**: PR **#154** segue **OPEN**. O branch
`feat/gravador-nao-perde-audio` agora tem **dois** commits — `16bd72e` e o novo **`993632f`**
("a marca sobrevive ao mount, o commit do IndexedDB rejeita"), que é o coder consertando os
defeitos **(a)** e **(b)** que levantei na ronda das 18hZ (card `2fd937d4`).

`git log main..origin/feat/gravador-nao-perde-audio` devolve **os dois**: fora da main, fora de
produção. Card "completed" não é produção.

**Não mergeei** — segue valendo o motivo das 18hZ: toca o gravador de **todos** os alunos, e o
repositório tem histórico de branch stale derrubando fix em produção (`onedrive-401`,
`fix-image-upload-retry`, os 2 da cura de referência). Subi a decisão pro grupo pela 2ª vez.

## §5 — O que escrevi para ela (uid 468, cópia confirmada na 1ª tentativa)

- **Assumi a falha da resposta automática** e disse que caiu na pior hora possível.
- **Provei que li os prints**, descrevendo o que eles mostram (5 gravações, 4×5min + 1×1s, barra
  20:01/20:00, QR zerado) — para ela ver que houve gente do outro lado.
- **Cancelamento resolvido:** assinatura R$ 0 trial já cancelada desde 01/09, acesso até 08/09,
  99.475 créditos intactos, nenhuma cobrança nossa.
- **Reembolso dos cursos roteado** pro time da Liz (WhatsApp + e-mail), pela ordem de 31/08.
- **Contei a margem de 1 segundo**, marcada como hipótese, não como causa fechada.
- **Não** pedi outro print, **não** prometi prazo, **não** insisti para reter, **não** neguei nada.

## §6 — O que eu NÃO fiz, de propósito

- **Não mergeei o #154** — muda o gravador de todo mundo; decisão humana.
- **Não pedi outro print.** Seria a 4ª vez que ela trabalha pra gente. Ela já disse "cansei".
- **Não tentei reter a aluna** nem discuti se o reembolso é justo.
- **Não abri chamado** para a recusa de anexo de 2MB — é o `531b6529` (#98), que já existe.
- **Não toquei** em crédito, GPU, migration nem status de compra.

## §7 — Limites da minha prova, ditos na cara

1. **Os prints não são a tela que foi pedida.** A causa raiz do `#235` **continua não cravada**.
   O que eu fiz foi eliminar 2 das causas e achar uma 3ª fragilidade — não fechar o diagnóstico.
2. **A margem de 1 segundo é hipótese.** Depende de os `c.seconds` serem ~300,0 cada; não medi os
   floats reais porque eles só existem no IndexedDB do aparelho dela.
3. **Errei uma chamada de ferramenta** e o guard-rail me pegou: chamei
   `anotar_incidente.cjs 235` usando o **número** do incidente, e a ferramenta **recusou** ("nenhum
   incidente começa com 235") em vez de dar UPDATE em 0 linhas em silêncio. O argumento é prefixo
   de **uuid** (`d48e6a45`). Registro porque foi exatamente a armadilha que a ferramenta existe
   para impedir — e ela funcionou.
4. **Também errei um nome de coluna** (`occurrence_count`, `access_status`) e uma tabela
   (`purchases`, que não existe). Fui no `information_schema` em vez de chutar. O número que vale
   veio do `aluno.cjs`, que é ferramenta vetada.
5. **Não confirmei o cancelamento na Hotmart.** Afirmei que a compra "consta canceled" com base no
   `aluno.cjs`; não abri a Hotmart para reconferir, e não é minha alçada mexer lá.

## §8 — Fila que fica, e o próximo da vez

`#237` (`92b1cc85`, aberto 20:38Z) é o **próximo**: *"enviei fotos e áudios e não aparece nada na
plataforma"*. Está `open`, **sem nota, sem `affected_emails` e sem `sample_error`** — ou seja,
**não dá para responder ninguém porque não se sabe quem é**. O 1º passo da próxima ronda é achar o
remetente na caixa (veio pelo `suporte@`) antes de qualquer diagnóstico. Cheira à mesma classe do
`#235` (material que o aluno mandou e não chegou), mas **não medi nada** e não vou classificar sem
olhar.

`#236` (animação com áudio) está com aluno respondido + estornado e o conserto no card `71ee70eb`.

## Registro de rotina

- `anotar_incidente`: `#235` (`d48e6a45`) notas **6 → 7**, status inalterado, **1 linha afetada**.
  `#223` (`506b7c3a`) **investigating → fixed**, notas **10 → 11**, `resolution_note` **28 → 1839
  chars** (concatenado, não sobrescrito), **1 linha afetada**. Ambos conferidos na releitura.
- E-mail: **1 individual** (uid 468), permitido pela regra 8 sem pedir "pode". Nenhum e-mail em massa.
- Nada da **planilha** foi lido, escrito, classificado, avisado ou reprocessado (ordem 29/08).
- Nenhuma GPU, nenhum crédito, nenhuma migration, nenhum merge.
- Grupo: postado com `notify-grupo.sh`. **Nada foi para o privado do Johnny** (ordem 31/08).
- `_frank/ferramentas/assinatura_em_dobro.cjs` segue **untracked** — não é meu e não é desta ronda.
  **5ª ronda seguida** registrando em vez de commitar trabalho de outro agente em silêncio.
