# ORDEM — Desligar o VIGIA e o FRANK (29/08/2026, 20h)

Ordem do Johnny, palavras dele: *"pode desligar o Frank, desligar qualquer cron
que tenha na planilha"*, *"não usaremos mais a planilha, a partir deste momento"*,
*"tudo que precisa ser feito vai ser manual, não atuaremos mais nela"* e, ao ser
perguntado sobre o alcance: *"desligar o atendimento da fast pela planilha,
apenas o vigia e o frank"*.

---

## 1. O que SAI

- **VIGIA / Sentinela** — a rotina 21h/9h BRT e o **Executor horário** (`:23`,
  janela 08h–23h BRT). Desligar as entradas no `crontab` do Hetzner. Não apagar
  os scripts: comentar a linha do cron basta, para religar ser uma linha.
- **FRANK** — as rotinas automáticas dele: varredura de fila da planilha, aviso
  de linha parada, reprocessamento de erro, e o ciclo de 24h que fecha chamado.

## 1-B. A regra, na frase dele

> *"Tudo que está relacionado à planilha não vai ter mais automação, nem de
> você, nem do Vigia, da Fast e do Frank."*

Vale para **todos os agentes, inclusive eu**. Se alguma rotina sua lê, escreve,
classifica, avisa ou reprocessa qualquer coisa da planilha, ela sai. Sem
exceção e sem "só esta que é barata".

## 2. O que FICA (não confundir)

- **A Fast atendendo ALUNO continua**: WhatsApp, e-mails do `suporte@` (cron de
  5 min), chat do app e a ponte para chamados. O Johnny foi explícito: sai o
  pedaço que atua **pela planilha**, não o atendimento.
- **Chamados, plantão e fila de incidentes** seguem existindo — o que muda é que
  ninguém os abre/fecha automaticamente pela planilha.

## 3. O que JÁ foi feito (não refazer)

O Apps Script da planilha já está travado por mim (29/08, 20h):
`var DESLIGADO = true` no topo do `FastCloner.gs`, com `if (DESLIGADO) return;`
em `processarPendentes`, `varrerProcessando` e `aoEditar`.

⚠️ **Nada foi apagado** — ordem do Johnny (*"não precisa apagar por enquanto"*).
Os dois gatilhos de tempo continuam existindo e rodando: eles batem na trava e
voltam sem fazer nada. É de propósito que a trava está no SCRIPT e não no nosso
endpoint: o Apps Script trata qualquer resposta diferente de `200 + ok:true`
como falha e **marca a linha como "Erro"**, o que dispararia aviso ao grupo a
cada 5 minutos — alarme falso puro. O botão manual
(`processarLinhaSelecionada`) segue funcionando de propósito.

## 4. Prova que eu preciso de volta

1. `crontab -l` do Hetzner **antes e depois**, com as linhas do Vigia comentadas.
2. Confirmação de que o cron de 5 min dos e-mails da Fast **continua ativo**
   (é o que não pode cair junto).
3. Uma linha dizendo o que mais lia a planilha e foi desligado.

## 4-B. Chamados da planilha: FECHAR

Johnny, 29/08: *"todo o chamado que está aberto por causa da planilha pode
fechar; analisa todos os incidentes abertos e fecha."* Eu estou varrendo a fila
e fechando os que nasceram da planilha (import, linha travada, fila 1 a 1,
Drive/WeTransfer do onboarding antigo). **Não reabra nenhum deles** — a causa
não existe mais, o processo virou manual.

## 5. Por quê

O **SGP dentro do FastCloner** (`/sgp`) substituiu a planilha. Ele fechou o
ciclo completo em produção hoje, 29/08: pedido enviado 20:17 → clone de foto
20:18 → voz treinada 20:24 → "plataforma pronta", com os 4 e-mails da régua
confirmados na caixa de Enviados do `suporte@`. A planilha virou passo manual.
