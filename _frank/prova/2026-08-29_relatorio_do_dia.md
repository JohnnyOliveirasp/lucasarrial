# Relatório do dia — 29/08/2026 (fecho, ~01h15 UTC de 30/08)

Formato: `_frank/06_RELATORIO_E_LIMITES.md`. Mandado mesmo não sendo dia limpo —
e mandado de qualquer jeito, por regra: silêncio não pode ser lido como saúde.

Janela medida: **29/08 00:00Z → 30/08 01:15Z**. Tudo abaixo foi medido nesta
ronda, não herdado das rondas do dia. Comandos e saídas em §Prova.

---

## ✅ Resolvido

- **17 chamados fechados** (11 `fixed`, 6 `ignored`), **15 abertos**. Saldo do dia: **−2**.
- **#189** (`e1403e5f`) — o e-mail final afirmava *"suas imagens estão ok"* para quem
  tinha **zero** imagem, e 6 min depois convidava o mesmo aluno a assinar. Corrigido
  (`fd1730a`) e no ar. 7 alunos atingidos; **3 escritos na mão** (Marcos Vidal,
  Adriane Teka, Robert).
- **#193** (`10d50178`) — `conferir_transcript_referencia.cjs --curar` gravava cauda
  alucinada do whisper. Fechado **antes** de rodar em lote.
- **#185** (`6839d5b9`) — a lista canônica de estorno não conhecia `studio_audio_refund`:
  7 estornos de 3.850 cr da Priscilla liam como "não estornados" — o falso negativo que
  paga em dobro. Corrigido, e o guarda `conferirListaCompleta()` (que existia com zero
  chamadas) passou a ser chamado.
- **#183** (`d73f827c`) — erro de INPUT do aluno parou de abrir chamado técnico.
- **#187** (`62bd1eb5`) — a varredura diária passou a enxergar quem quebrou no import
  **antes de existir a voz**. Antes, zero voz era lido como "nunca tentou".
- **/sgp fechou o ciclo completo em produção** hoje: pedido 20:17 → clone de foto 20:18 →
  voz treinada 20:24 → "plataforma pronta", com os 4 e-mails da régua conferidos na caixa
  de Enviados do `suporte@`.
- **Planilha desligada, com prova** (`_frank/prova/2026-08-29_desligamento_planilha_prova.md`):
  `crontab -l` do Hetzner antes/depois — as entradas do Vigia **não existiam lá**
  (auditei todos os usuários, `/etc/cron.d/` e `systemctl list-timers`); o cron de 5 min
  dos e-mails da Fast **continua vivo** (288/288 rodadas no dia); Vigia e Rotina das Falhas
  recriados com a trava da ordem no topo do prompt, sha256 conferido byte a byte.

---

## ⚠️ Precisa de você — 3 perguntas, todas sim/não

1. **Os outros 5 do #189** (`marlonwsmuniz`, `fb_teixeira`, `hiurysaraiva`,
   `priscila.tyngsboro`, `claudiasantos23504`). Texto pronto. É **lote**, e a regra 8 só
   me autoriza sozinho no individual. Nenhum procurou o suporte; 3 nunca logaram.
   **Mando?**
2. **Johnathan.** No e-mail de 29/08 13:50Z prometemos, com estas palavras, que *"nós
   mesmos rodamos o processamento da sua voz"*. A correção que sustentava a promessa
   (`#184`) foi fechada 10h depois porque o caminho morreu junto com a planilha. Ele tem
   **15 vídeos** parados, foi avisado de que não precisa fazer mais nada, e **do outro lado
   não sobrou ninguém encarregado**. **Alguém roda na mão, ou escrevo contando que mudou?**
3. **Adriane.** Mandou **4 fotos** em 22/08 02:16 — **11h antes** do e-mail que dizia que
   as imagens dela estavam ok. Ninguém usou; a conta segue com zero imagem. Já escrevi
   assumindo o erro e **sem prometer data**. **Processo as fotos dela na mão?**

Nada além disso está esperando você.

---

## 🔧 Subi pra produção

- **25 merges de código** · **28 deploys verdes, 0 vermelho** (workflow `Deploy Frontend (production)`).
- **No ar agora:** `e4e36a5` (merge que carrega `fd1730a`, o fix do #189) — run `33283679713`,
  SUCCESS em **30/08 00:35:30Z**.
- **BUILD_ID servido em `https://fastcloner.com`: `QzNANlfyS_Al7_GAuKFOr`** — lido duas
  vezes, estável. (Marcador de build do Next no topo do HTML; mesmo formato de 21 chars do
  `BUILD_ID` local.)
- `f27643d` está na `main` e **não está no ar** — é commit de prova/documento, não gera build.
  Diferença main↔produção hoje: **1 commit, zero código**.
- O grosso do dia foi o **/sgp**: conta só nasce na tela 4, acompanhamento sem login, botão de
  ajuda com a Fast nas 5 telas, e-mail por etapa via webhook (não mais por polling da tela),
  exigir 1 foto de frente + 1 de lado, barrar foto repetida, juiz de foto só barra IA,
  teto de 60 min do áudio valendo **no upload** e não só no Continuar.
- Fora do /sgp: histórico do aluno esconde geração falhada, contingência de LoRA morto
  (não cobrar + reenviar falha transitória), ajuste de ritmo virou **escolha do aluno**
  (padrão desligado).

---

## 📈 Estado

| | agora |
|---|---|
| Chamados abertos | **1** — `#192` (`ae0061d5`), **3,7h** |
| Aguardando aluno | **1** — `#99` (`6c38c99d`), **152,4h = 6,4 dias**, 8 ocorrências |
| Pagante trancado (pagou e está sem acesso) | **0** |
| Presos na varredura | **3** + 1 linha de escrituração |
| Pagante com crédito e **sem entrega** | **2** |

- **`#192`** — Robert (`70rrosusa`) gravou 1h de áudio e não gostou da voz. Travado no único
  passo que não é meu: **ouvido humano**. Ele estava em silêncio há 3h30 com quatro agentes
  no caso; **foi escrito**, sabe onde está o caso e sabe que **não precisa regravar**.
- **`#99`** — dentro da janela, mas 7d+ pede **segunda tentativa, não silêncio**. Vira
  cobrança na ronda de amanhã.
- **Pagante trancado = 0** é medido, não presumido: 107 suspeitos do nosso banco conferidos
  **um a um na Hotmart viva** (`pagante_trancado.cjs`). Dos 107: 9 cancelaram, 93
  inadimplentes, 5 trial que nunca virou pagamento — trancar está certo nos três casos.
- **Presos (3):** os 2 de "acesso vivo, com crédito e sem voz" + 1 de "import quebrou antes de
  existir a voz". Mais o job `ebf5cc56`, preso em queued/running com a voz `f4b9b0f2` já
  `ready` — escrituração, **ninguém esperando**.
- **Os 2 com crédito e sem entrega, cruzados com a Hotmart** (`acesso vivo ≠ pagou`):
  - **Marcelo** (`marcelopersonalthe32`) — **PAGOU R$97 COMPLETE em 12/08**. 198.950 cr,
    **20 dias** sem voz. O áudio tem 2 pessoas falando (F0 provou 2 locutores); entregar
    seria dar a voz da entrevistadora. Estorno confirmado por `ref_type`. Avisado em 24/08.
    **Espera ele regravar — não há passo pendente do nosso lado.**
  - **Luan** (`luanmarcal.com`) — **PAGOU R$17 APROVADO em 29/08**. 98.425 cr, import quebrou
    em 29/08 05:42 (**19,4h**), zero voz. A causa era da planilha, que morreu hoje: **precisa
    de mão humana**, e é a mesma classe do Johnathan.
  - **Kelin** (`kelinnavelar`) aparece na mesma lista da varredura e **nunca pagou**
    (2 assinaturas R$0 de 27/08). 17 dias, avisada 3×, a última em 28/08 23:52Z.

### O que mudou de ontem pra hoje

| | 28/08 | 29/08 |
|---|---|---|
| Chamados abertos no dia | 14 | 15 |
| Chamados fechados no dia | 28 | 17 |
| Commits em `main` | 44 | 39 |
| Fila fora de `fixed`/`ignored` no fecho | 2 | **2** (1 aberto + 1 aguardando aluno) |
| "Acesso vivo, crédito, zero voz" | 3 | **2** |

- A fila teve pico de **3 abertos** às 00h UTC (`#189`, `#192`, `#193`) e fechou em **1**.
- **A lista de 3 → 2 não é vitória.** O que saiu foi o **Leandro** (`leandro.fitoway`, 29d):
  o `access_until` dele **venceu hoje às 12:00Z**. Ele sumiu da lista por perder o acesso,
  não por ter sido resolvido — e ele nunca pagou (trial R$0, o R$97 está `OVERDUE`).
- **Entrou o Luan**, e ele **pagou ontem**. Trocamos um trial vencido por um pagante parado.
- Marcelo passou de 19 → **20 dias**. Kelin de 16 → **17**.

---

## Erros e buracos do dia (ditos na cara)

1. **`#189` foi fechado como `fixed` às 00h38Z sem o lado do aluno** — `resolution_note` e
   `resolved_commit` **NULL** e **nenhum dos 7 avisados**. Quem fechou foi o agente `claude`.
   Foi retomado na ronda seguinte: nota e commit gravados, 3 alunos escritos, os outros 5
   viraram a pergunta 1 acima. Pela regra 8, fix em produção **não é** fim.
2. **`#193` está fechado com `resolution_note` NULL e sem commit** (`resolved_by = claude`).
   O fix existe e está no ar; o registro é que ficou pela metade. **Anoto amanhã** — não
   reabro, porque o defeito está curado.
3. **O fix do `#189` não alcança os 7 já atingidos.** `verificarOnboardingPronto` sai cedo em
   `if (!st.pronto || st.email_enviado) return`, e os 7 têm `onboarding_ready_email_at`
   gravado. Código cura caso novo; o que já foi entregue **só cura na mão**. Medido hoje:
   os 7 seguem com `av_total = 0` — nenhum se resolveu sozinho.
4. **O grupo do WhatsApp segue mudo nesta máquina** (7ª ronda seguida): `avisar_grupo.cjs`
   sem `WAHA_API_URL/WAHA_API_KEY` aqui (a WAHA só escuta em `127.0.0.1` no servidor). É
   provisionamento, não falta de tentativa. **Não digo que avisei o grupo, porque não avisei.**
5. **Prova que eu não tenho:** a caixa de Enviados tem buraco de 20 a 23/08. Para o Marcos eu
   tenho os dois e-mails por uid; **para os 6 do dia 22 eu tenho só o carimbo no banco e o
   código da data**. É forte, não é a mesma prova, e não vou chamar de igual.
6. **Achado à parte, não é da planilha:** o cron `7274f10d` (VARREDURA DIÁRIA, 08:00) ainda
   manda rodar `_Bugs/prova_raio.cjs` para os "147 pagantes sem acesso" — script de **falso
   positivo conhecido** (`_frank/prova/2026-08-19_os_147_nao_eram_pagantes.md`). O certo é
   `pagante_trancado.cjs`, que confere na Hotmart. Não troquei porque não era o pedido de
   hoje. **Precisa ser trocado.**

---

## Achado de produto (não virou chamado, 14-C)

Se o recorte de referência de voz é sempre o **início** da gravação, o defeito do `#192`
não é do Robert — é de **quem começa falando devagar**. Vale medir a classe inteira
(pausa da referência × pausa da fala média) antes de tratar caso a caso.

---

## Prova

```bash
node _frank/ferramentas/varredura_travados.cjs
node _frank/ferramentas/pagante_trancado.cjs
node _frank/ferramentas/pagou_de_verdade.cjs marcelopersonalthe32@gmail.com
node _frank/ferramentas/pagou_de_verdade.cjs kelinnavelar@icloud.com
node _frank/ferramentas/pagou_de_verdade.cjs luanmarcal.com@gmail.com
node _frank/ferramentas/sql.cjs "select ... from incidents where created_at >= '2026-08-29 00:00Z' or resolved_at >= '2026-08-29 00:00Z'"
node _frank/ferramentas/sql.cjs "select ... from incidents where status not in ('fixed','ignored')"
gh run list --workflow="Deploy Frontend (production)" --limit 60
curl -sS https://fastcloner.com | head -c 60     # 2x, buildId estável
```

⚠️ Uma consulta minha **falhou alto** no meio disto (`column p.credits does not exist`) — é
a armadilha do manual funcionando: erro que aparece, em vez de zero silencioso. Refiz e só
então usei o número.

## O que eu NÃO fiz

Não fechei incidente que não estava resolvido, não reabri nada da planilha, não mandei
e-mail em lote, não toquei em crédito nem em acesso, não disparei GPU, não rodei migration,
e não dei veredito sobre qualidade de voz.
