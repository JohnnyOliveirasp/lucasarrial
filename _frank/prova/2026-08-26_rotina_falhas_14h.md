# Rotina das Falhas — 26/08/2026, ronda das 14h UTC

Dono da fila: Claude. Método serial (regra 8, ordem de 21/08).

---

## 0. Antes de tudo: dois commits estavam presos nesta máquina

`git status` na entrada: **main 2 commits à frente de origin/main**, de hoje de manhã.

| commit | o que era |
|---|---|
| `82ebad2` | a ferramenta `entregar_material_pela_planilha.cjs` |
| `d187214` | log dos cancelamentos de 25/08 + `backlog_trial.cjs` |

Ambos 100% dentro de `_frank/` (documento e ferramenta, zero código de
produção), então empurrei pra main direto, como a regra do registro manda.
`116dd2c..d187214` — conferido depois, `origin/main..HEAD` vazio.

É exatamente a falha de 19/08 (fix preso 9h em branch) só que na main local.
**A ferramenta que destravou a Luziélia hoje estava invisível pro resto do
mundo.** Vale como lembrete do passo fixo de fim de ronda: ele pega isto.

---

## 1. Incidente que peguei e FECHEI: 140 — Luziélia

Peguei pela regra 8. Os dois mais antigos com aluno afetado (97 e 99, ambos de
23/08) estão ambos travados na mesma coisa, que **não é técnica** — está no §4.

**Já estava resolvido quando cheguei, e a checagem (1) da rotina foi o que
mostrou isso.** O onboarding dela rodou `ok=true` às **12:59:51**, ~45min antes
da minha ronda, pela ferramenta `entregar_material_pela_planilha.cjs`.

O que o banco confirma, lido depois de gravar:

- `onboarding_runs` 26/08 12:59:51 **ok=true**, `etapa_falha` null. O run
  anterior (00:56:30) era `ok=false`, motivo `"imagens: download respondeu 401 (onedrive)"`.
- voz "Minha Voz" **[ready], 32min**; 3 avatares [ready].
- débito normal do fluxo: −10.000 (treino) + 3× −525 (avatar). **Nada cobrado a mais.**
- **ela já usou**: gerou áudio às **13:31** (−400 cr). A entrega não é teórica.

Foi avisada pelo próprio fluxo de produção (Enviados uid 144/145/146). Mandei
**um e-mail pessoal** fechando o loop, porque havia uma promessa nominal da
equipe em aberto ("a equipe resolve e te avisa") e os avisos automáticos são
genéricos — foi esse tipo de promessa sem retorno que produziu o churn do 123.

Fechado `fixed`, resolution_note com o que o banco confirma, commit `82ebad2`.
Postado no grupo (message_id 456).

⚠️ **Registrado pra não tratarem errado:** ela está em **trial R$0 aberto hoje**,
não é pagante. `pagou_de_verdade`: NUNCA PAGOU, rec#1 R$0 APPROVED 26/08. O
+100.000 no extrato é "recarga do ciclo", **não é pagamento**.

---

## 2. Incidente 144 (OneDrive) — CAUSA PROVADA hoje

O Vigia deixou o probe pronto às 12h20 e **o sandbox dele bloqueou a execução**,
duas vezes. Rodei. A hipótese dele estava certa, e de quebra derrubei uma
dúvida que estava aberta na descrição.

**Confirmado:** a cadeia de redirect do 1drv.ms emite `Set-Cookie FedAuth`. O
nosso fetch vai direto na API legada (`api.onedrive.com/v1.0/shares`), nunca
percorre a cadeia, nunca ganha o cookie → **401**.

**Com o cookie, funciona** — e eu conferi byte, não só o 200:

| caso | endpoint | resultado |
|---|---|---|
| pasta `/f/` (Luziélia) | `_api/v2.0/drives/<cid>/items/<resid>/children` | 200 JSON, 4 filhos com `@content.downloadUrl` |
| → baixei um | | **JPEG real, 175.603 bytes = size anunciado**, magic `ffd8ffe0`, 1189×1600 |
| arquivo `/u/` (lazevedo) | `_api/v2.0/.../items/<resid>` | 200 JSON, `Gravando (11).m4a`, 46.127.898 |
| → baixei | | **audio/mp4, 46.127.898 bytes = size exato**, ISO Media MP4 v2 |

**Item (d) da descrição — "pasta vs arquivo" — REFUTADO com medição.** O link de
ARQUIVO também funciona. O mesmo caminho serve pros dois. E o `/children`
resolve de brinde o buraco antigo de "link de pasta precisa de uma listagem que
não existe".

**O discriminador real, que é o achado que muda o atendimento:** o que separa
quem funciona de quem não funciona é **se a cadeia emite FedAuth**.

```
luzielia /f/  -> FedAuth PRESENTE -> baixa
lazevedo /u/  -> FedAuth PRESENTE -> baixa
lazevedo /v/  -> FedAuth AUSENTE (página com marcador de sign-in)
marlon   /u/  -> nenhum cookie    -> 401
```

Quando **não** vem FedAuth, aí sim o share realmente não concede acesso anônimo
e é honesto pedir link novo. Isso dá critério de verdade ao aviso, no lugar de
acusar todo mundo de "link vencido".

Caminhos que **não** servem (medidos, não repetir): `my.microsoftpersonalcontent.com`
→ 401; `_api/web/GetFolderByServerRelativeUrl(...)/Files` → 200 mas `{"d":{"results":[]}}`.

**Continua `investigating`** — a causa está provada mas **não está corrigido em
produção**. Não marco `fixed` sem fix no ar. Abri o card **`70576a62`** pro
coder com a receita inteira; não escrevi o código eu mesmo (é trabalho de coder,
vai por branch feat/ + PR).

**Ninguém está travado nisto agora** — conferi um a um: Luziélia entregue;
marlon já tinha dado certo em 22/08 (voz ready 60min, débito estornado no mesmo
minuto); lazevedo teve o áudio baixado e o treino RODOU, falhou por qualidade e
foi estornado. O dano vivo é pra **aluno futuro**.

---

## 3. Fechado que voltou a disparar: `acf8acd6` — a classe esconde bug nosso

O detector apontou 12 ocorrências depois do fechamento. Fui olhar (a ordem manda)
e **esconde, em parte**. A causa gravada é `user_dataset` (culpa do aluno). Medi
os arquivos de toda voz failed/rejected desde 09/08 e achei **três** casos em que
a maioria dos arquivos **não era áudio** e o aluno mesmo assim ouviu *"arquivo
corrompido ou incompleto — o envio pode ter sido interrompido"*:

| voz | aluno | arquivos | **não-áudio** |
|---|---|---|---|
| `b5ea6b9b` | nelsonlopes | 9 | **9** (zero áudio enviado) |
| `594ef998` | kessulyl | 16 | **15** |
| `8aca0126` | csitya100 | 20 | **13** |

Mesmo modo de falha do Cláudio na ordem de 21/08: o onboarding varre a pasta do
Drive, manda jpeg/pdf como áudio, e a mensagem culpa quem não escolheu o arquivo.

**Não reabri, e digo por quê:** a classe não está viva (última ocorrência 22/08,
nada em 48h) e **os três se recuperaram sozinhos e foram estornados** —
conferido um a um. Reabrir chamado sem ninguém sofrendo agora é inflar fila.
Fica medido na nota. A correção útil (filtrar não-áudio + parar de acusar o
aluno) já é escopo do card `39028572` da ordem de 21/08.

---

## 4. O que travou, em que passo, e com quem está

**Os dois incidentes mais antigos da fila não travam em código. Travam numa
decisão que não é minha.**

- **97 — Video Clone, drift do rosto** (3 alunos). Os três já foram
  **estornados e respondidos**. Não há correção técnica: é limitação do
  InfiniteTalk, medida nos 2 tiers. Falta **decisão de produto do Johnny**,
  formulada em 24/08 e repetida em 25/08 e 26/08: ou limita/segmenta a geração
  longa (re-ancorar na foto por trecho, ou teto de duração), ou segue só
  avisando na UI. **~72h sem resposta.**

- **99 — Luciano**. Não é bug: o produto funciona pra ele (voz ready 31min, 5
  áudios, 5 clones). É a distância entre o que o reel vendeu ("grava 45min de
  vídeo, o sistema analisa rosto, voz, expressões") e o que existe (foto +
  áudio). Ele pediu **posicionamento nominal do Lucas e do Johnny** 3 vezes.
  Ele **deixou o prazo de 7 dias vencer confiando numa resposta que não veio**.
  Confirmado hoje: NUNCA PAGOU, trial R$0, acesso venceu 12:00Z — **não houve
  cobrança**. Pergunta única: **ele fica ou sai?**

- **65 — Marcelo** (pagante, 198.950 cr, acesso até 05/09, 16 dias sem voz).
  Está corretamente em `aguardando_aluno`: foi avisado em **24/08 21:52** com as
  duas réguas certas, e o retreino com o arquivo dele está **provado impossível**
  (2 locutores no mesmo clipe — F0 mediana 197,5Hz, IQR 152Hz contra máximo de
  82Hz nas 60 vozes limpas da base). A bola é dele. **Se não responder até
  31/08 (7 dias), pede segunda tentativa, não silêncio.**

Anotação de precisão pro próximo: o **65 ainda lista 3 e-mails** em
`affected_emails`, mas **2 já estão resolvidos** (csitya100 tem voz ready desde
22/08 — era o pagante travado da ordem de 21/08; ivanildezuca tem "IVA voz"
ready). Só o Marcelo espera. O quadro mostra "3 alunos" e infla. Não mexi por
SQL cru pra não cair no update silencioso; fica registrado.

---

## 5. Perguntas pro Johnny (as duas travam fila há dias)

1. **Video Clone (97):** limita/segmenta a geração longa, ou segue só avisando
   na UI? São 3 alunos e 24.045 cr devolvidos por um defeito que a gente sabe
   reproduzir, e o teto de áudio hoje vende exatamente a faixa que mede pior.
2. **Luciano (99):** fica ou sai? Se fica, o que a gente promete por escrito. Se
   sai, ele é reembolsado apesar do prazo vencido — porque foi a nossa demora
   que consumiu o prazo dele.

---

## 6. Placar da ronda

- **1 incidente fechado** (140), com aluno entregue, avisado e já usando.
- **1 causa raiz provada** (144) + card `70576a62` pro coder, com receita medida.
- **1 hipótese derrubada** com medição (pasta vs arquivo, item (d) do 144).
- **1 classe fechada auditada** (acf8acd6): 3 casos de culpa nossa mal
  classificados, 0 aluno sofrendo hoje.
- **2 commits destravados** e empurrados pra main.
- **1 e-mail** pra aluno (Luziélia).
- **0 crédito gasto, 0 GPU, 0 migration.**

Nada foi marcado `fixed` sem estar resolvido.
