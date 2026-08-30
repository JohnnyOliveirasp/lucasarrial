# Rotina das Falhas — 30/08/2026, ~02h UTC (= 29/08 ~23h BRT) — dono da fila

Abertura: `git checkout main && git pull --ff-only origin main` → já estava em dia.
Índice de ordens lido antes de tocar em qualquer coisa.

Ordens aplicadas: **`2026-08-29_desligar_vigia_e_frank.md`** (nada da planilha é lido,
escrito, classificado ou reprocessado; nada com causa nela vira ou reabre chamado),
`2026-08-20_dono_da_fila_e_fila_zerada.md` (14-A + armadilhas), regra 8 de 21/08
(serial + e-mail individual sem pedir permissão), `2026-08-27_vigia_so_erro_de_sistema.md`
e regra 7 (só fato consumado no grupo).

Ronda anterior das falhas: **01h UTC (30/08)**. Janela: 22h41 BRT, dentro do 08h–23h.

---

## Placar

| | |
|---|---|
| Incidentes fora de `fixed`/`ignored` na abertura | **2** (`#99` aguardando aluno, `#192` investigating) |
| Incidentes que **fechei** | **nenhum** — nenhum estava fechável honestamente |
| **Alunos para quem escrevi** | **1** — Luan Marçal |
| Incidentes que abri | **nenhum** (e digo por quê no §3) |
| Incidentes que anotei | **nenhum** — a ordem de 29/08 proíbe anotar nos fechados pela planilha |
| **Código em produção** | **nenhum** |
| Crédito que toquei | **nenhum** |
| GPU/retreino que disparei | **nenhum** |
| Migration | **nenhuma** |
| Decisões que subi pro Johnny | **1** (`#99`, prazo de garantia) |

Fila no fim da ronda: **os mesmos 2**, e nenhum aluno em silêncio.

---

## 1. Os 3 "presos" da varredura: 2 eram alarme falso da própria varredura

A varredura acusou 3 alunos com acesso vivo, crédito e nenhuma voz pronta. **Dois já
estavam integralmente atendidos** — a varredura não enxerga a caixa de Enviados, então
ela não sabe distinguir "abandonado" de "respondido, bola com o aluno".

**`marcelopersonalthe32`** (20 dias, o mais antigo). Recusa **legítima**: o áudio é
gravação de entrevista, duas pessoas. Crédito **já estornado** (+10.000
`voice_train_refund` às 10:43, 4 min depois do débito de 10:39 — conferido por
`ref_type`, não por `kind`). Três e-mails na caixa, o último **29/08 23:50Z**, com
análise manual do áudio em 8 pontos confirmando as duas vozes. É pagante de verdade
(R$97 COMPLETE 12/08). **Nada devido, nada a fazer.** Bola com ele.

**`kelinnavelar`** (17 dias). Recusa por 26 segundos abaixo do mínimo. Nada cobrado.
Três e-mails, o último **29/08 23:54Z**, com o número exato, a correção pública de um
número errado que nós mesmos tínhamos mandado, e os dois mínimos explicados. **Nada
devido.** Bola com ela.

Conferi as duas caixas para os três: **nenhum respondeu**. Não há material de aluno
parado sem dono nesta ronda (era o defeito do caso Adriane, ronda passada).

> **Observação, não ação:** a Kelin aparece como *"NUNCA PAGOU"* no `pagou_de_verdade`
> (2 assinaturas **R$ 0 APPROVED** em 27/08) e recebeu **2× 100.000** de
> `subscription_grant` **no mesmo minuto** (27/08 12:58). Registro porque é medição, mas
> **não toquei e não escalei**: a regra de crédito foi **encerrada** pelo Johnny em 20/08
> ("aplique e feche; não escale, não refine, não reabra").

---

## 2. `luanmarcal.com@gmail.com` — o caso serial desta ronda

Pagante (R$17 APPROVED 29/08), acesso até 29/09, 98.425 créditos, **zero voz**, parado
há ~20h. Onboarding de 29/08 05:42Z: **as imagens entraram**, o áudio falhou com
*"Arquivo 1uIe… não está público no Drive (veio página HTML, não o arquivo)"*.

### O que eu medi, e que ninguém tinha conseguido medir

O Vigia anotou às 22:17Z, com razão, que **não dava para saber** se o arquivo do Luan
era privado de verdade ou se tinha batido no *"Quota exceeded"* do Google — porque o
defeito do `#184` colapsa os dois casos na mesma mensagem. Essa indistinguibilidade era
o risco real: mandar um aluno consertar um compartilhamento que já está certo.

Reproduzi o **caminho exato de produção** (`drive.ts:141-152`: URL com `&confirm=t` **e**
header `Range: bytes=0-` — a armadilha registrada às 21:44Z, porque sem o `confirm=t` a
resposta é outra e parece desbloqueio):

```
HTTP/2 302
location: https://accounts.google.com/ServiceLogin?...
content-length: 0
```

**302 para `accounts.google.com/ServiceLogin` = caso (a) da taxonomia do `#184`:
privado de verdade.** Não é cota (cota seria 200 `text/html`, ficando em
`drive.usercontent`, com `<title>Google Drive - Quota exceeded</title>`).

**Conclusão que importa: o diagnóstico que o Luan recebeu estava CERTO.** O `#184` não
o prejudicou. Fica registrado para ninguém re-litigar isso na próxima ronda.

### O que estava errado era a INSTRUÇÃO, não o diagnóstico

O e-mail automático das 05:42:38Z termina mandando ele ajustar o link e responder
*"que a gente retoma de onde parou"*. **Esse retomar automático foi desligado às 20h de
29/08.** Ele estava segurando uma ordem para um canal morto — **exatamente o padrão do
Marcos Vidal**, achado na ronda anterior. Se ele tivesse liberado o compartilhamento e
esperado, esperaria para sempre.

### O que fiz

E-mail individual (regra 8, decido sozinho), SMTP do `suporte@`, `--bcc suporte@`,
endereço batido contra `profiles` (conta única, sem homônimo), ensaiado em `--dry-run`
e **lido inteiro** antes de sair. Assinado *"Suporte FastCloner"* — não assinei como Johnny.

Conteúdo: as imagens dele entraram; o link está mesmo fechado **e eu medi**; o processo
virou **manual** e a instrução antiga morreu; dois caminhos (anexar o áudio na resposta,
ou liberar o compartilhamento — com o teste da janela anônima); os **dois mínimos**
(20 min somados para aceitar o envio, 10 min de fala limpa para treinar) para ele não
ser recusado por pouco; e a conta intacta.

> **Erro meu, pego no ensaio e corrigido antes de enviar:** eu tinha escrito "ontem" em
> três pontos. O import dele foi **29/08 02:42 BRT** (hoje de madrugada) e o desligamento
> foi **hoje às 20h**. Troquei tudo por datas explícitas. Registro porque foi o `--dry-run`
> lido inteiro que pegou — se eu tivesse enviado direto, teria mandado data errada para
> um aluno que já foi mal informado uma vez.

**Dinheiro:** 100.000 − 3×525 (avatares de onboarding, negativo autorizado pelo Johnny em
21/08) = **98.425**, que é exatamente o saldo dele. **Zero débito de treino, nada a
estornar.** Não toquei em crédito.

### O que eu NÃO fiz, de propósito

Não reprocessei o import e não reabri o `#184`. O caminho dele (`drive.ts`) serve
**exclusivamente** ao import da planilha, que a ordem de 29/08 desligou. Reprocessar
seria desobedecer a ordem; e `#184` está `ignored` corretamente.

---

## 3. Por que este caso NÃO virou chamado

A ordem de 29/08 é explícita: nada com causa na planilha vira incidente, e os fechados
por ela não recebem reabertura **nem anotação**. A causa do Luan é o import da planilha.
Então o registro dele é **este log na main** — que é durável e visível — e não uma nota
num chamado que a ordem mandou deixar quieto.

**Consequência que sobra para o Johnny decidir (não é chamado, é processo):** com a
automação desligada, o onboarding do Luan precisa de **mão humana** para ser concluído
quando ele responder. É a mesma classe do que a ronda anterior escalou sobre a Adriane e
o Johnathan: material de aluno esperando dono humano.

---

## 4. `#99` (Luciano) — nada técnico meu; falta a palavra do Johnny, e o relógio corre

`aguardando_aluno`, aberto há 6d. Estado conferido, não herdado: os 8 clones estão
`ready` sem erro; a foto do último teste **estava certa** (conferida no R2); o último
teste **já foi estornado**; o que ele reclama é o teto do motor de clone, que o Johnny
já lhe disse em 27/08. Foi respondido **duas vezes hoje** (10:47Z e 17:51Z) e não escreve
desde 28/08 à noite — **a bola está com ele**, e por regra isso não é estar travado.

O que falta é **decisão comercial**: R$97 APPROVED em 26/08, garantia até **02/09**.
Escalado às 10h44Z (msg 601) e **~15h sem resposta**. Re-escalei agora (Telegram msg 642)
por um motivo objetivo: depois de 02/09 a opção de devolver deixa de existir e a decisão
passa a ser tomada pelo silêncio. Não prometi reembolso a ele em nenhum momento.

---

## 5. `#192` (Robert) — segue `investigating`, e está certo assim

Aberto 29/08 21:23Z, ~4h. O passo que falta é **ouvido humano** sobre qualidade de voz, e
eu não dou esse veredito. O aluno **já foi tirado do silêncio** pela ronda anterior. Não
mexi. A promessa registrada lá continua valendo: depois do veredito, a resposta ao aluno
faz parte do fechamento.

---

## 6. Fechados que ainda disparam — conferidos, e sem bug escondido

`#194` (22:53Z) e `#184` (12:52Z) estão `ignored` **por decisão do Johnny de 29/08**, os
dois no caminho da planilha (`import.ts` / `drive.ts`). Não são falso alarme: os defeitos
são **reais e continuam no código**, apenas deixaram de ter caminho vivo. Ficam como estão.

⚠️ Registro para quem pegar depois: existe `fix/194-resgate-nao-queima-vaga` com 1 commit
fora da main. Ele conserta um caminho **morto** — não há por que mergear, e mergear sem
ler esta linha seria trabalho em cima de código sem uso.

---

## 7. Processo

- **Grupo (WAHA) continua sem `WAHA_API_URL/WAHA_API_KEY` nesta máquina — 8ª ronda.** É
  provisionamento, não falta de tentativa (a WAHA só escuta em `127.0.0.1` no servidor).
  Os fatos consumados foram por **Telegram** (msg 641 e 642). **Não digo que avisei o
  grupo, porque não avisei.**
- `git log origin/main..HEAD` **vazio** na abertura e no fecho. Nenhum fix meu preso em
  branch — não escrevi código nesta ronda.

## 8. Limites da minha prova, ditos na cara

1. **`ler_caixa` só varre os LIDOS.** A fila de não-lidos é da Fast. Se algum dos quatro
   alunos respondeu e a mensagem ainda está não-lida, eu **não a veria**. Quando eu digo
   "nenhum respondeu", isso vale para os lidos.
2. **Não baixei o áudio do Luan** — é justamente o que está inacessível. Então **não
   afirmo nada** sobre a duração do material dele; por isso o e-mail dá os dois mínimos
   em vez de dizer se o que ele tem já basta.

## O que eu NÃO fiz
Não fechei incidente que não estava resolvido, não abri chamado com causa na planilha,
não reabri nem anotei nos fechados por ela, não reprocessei import, não disparei GPU,
não toquei em crédito nem em acesso, e não dei veredito sobre qualidade de voz.
