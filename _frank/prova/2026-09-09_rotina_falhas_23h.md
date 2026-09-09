# Ronda das falhas — 09/09 ~22h40–23hZ (Frank, dono da fila)

**Card:** `#267` / `c1673a34` — *"aluna precisa urgente baixar o vídeo do Vídeo
História"*. **FECHADO** (`fixed`, commit `832be61`), aluna avisada.

**Em uma linha:** o vídeo dela estava pronto e íntegro no R2 o tempo todo —
**nunca foi o vídeo, foi o botão**, que pedia um download que o navegador
ignora. Corrigido, em produção, e a promessa que a casa tinha escrito pra ela
hoje de tarde foi cumprida hoje à noite.

---

## §1 — Por que o `#267` e não outro

Regra 8: o mais antigo **acionável** com aluno esperando. Conferido um a um, do
mais velho pro mais novo:

| card | idade | por que não é ele |
|---|---|---|
| `#313` `2d0509b4` | 09/06 | decisão do Johnny (honra ou revoga os 15 vitalícios). 25h+ parada, 7ª ronda pedindo |
| `#312` `c726c5ae` | 09/06 | **bloqueado pelo `#313`** — os 19 não podem ser tratados antes |
| `#15` `d3d8d1b2` | 30/07 | espera ocorrência nova. Última em 04/09 |
| `#47` `ce6e157d` | 19/08 | escalado ao Johnny ontem 19h55Z; o `tts_silence_ms` é decisão dele |
| `#99` `6c38c99d` | 23/08 | falta **uma frase do Johnny/Lucas**, pendente desde 24/08. Escalado às 21h54Z |
| `#249` `132f7808` | 04/09 | pagante travado, mas o único canal é **WhatsApp** e isso não é pré-autorizado. Espera "pode" |
| `#251` `1dd204f5` | 04/09 | próximo passo é medir o `console.error` novo em produção, não fechar |
| **`#267`** `c1673a34` | **05/09** | **aluna esperando há 4 dias, 5ª cobrança hoje 18:12Z, e o conserto era meu pra fazer** ← este |
| `#226` `702cc916` | 01/09 | trabalhado às 21hZ; a conta reiniciou |
| `#234` `f8587cef` | 02/09 | espera "pode" pro retreino que gasta GPU |
| `#324` `f9e12b9b` | 09/09 | os 2 compradores já foram reparados hoje; sobrou a causa, e é mais novo que este |

O `#267` era o único do topo em que **o que faltava era trabalho meu**, não
uma decisão de outra pessoa.

---

## §2 — O que era

`frontend/src/components/video/video-final-stage.tsx:273`:

```
<a href={state.final_video_url} download="video-final.mp4">
```

O atributo `download` é **ignorado pelo navegador quando o `href` é
cross-origin** — e `final_video_url` é presignada no R2
(`videos/[id]/render/route.ts:47`). Então o clique abria outra aba e **tocava**
o vídeo; o botão direito caía no menu do player. Nunca salvava arquivo.
Qualquer aluno naquela tela teria o mesmo resultado.

Confirmei o diagnóstico do Executor (nota de 18:26Z) lendo o código, não
aceitando de graça.

## §3 — A medição que eu era obrigado a fazer antes de trocar

A troca podia deixar o botão **pior**: hoje ele ao menos abre em nova aba; se o
R2 não devolvesse CORS num 2xx, o `fetch` morreria e o clique passaria a não
fazer absolutamente nada. Então medi no objeto **dela**, não no genérico:

```
GET presignado  0b941d02-.../videos/0d484594-.../final.mp4
bucket voices-clone-ai-verse · Origin https://aiverse.jcsolutionsus.com
→ HTTP 206
→ access-control-allow-origin: https://aiverse.jcsolutionsus.com
→ content-type: video/mp4 · 17.921.963 bytes
```

`fetch → blob` passa, e o MP4 está íntegro.

## §4 — O conserto

`downloadFromUrl` (`fetch` → `blob` → âncora same-origin), que Edição, Vídeo
Clone, Estúdio e histórico de imagens já usam — **10+ chamadas em produção**.
Passei `renovarUrl` como `refresh`: a URL vale 1h e a tela não renova depois que
o poll para, então aba aberta + voltar depois = clique em link vencido (a lição
do `#166`). Sem string de i18n nova.

`tsc --noEmit` limpo (o único erro do projeto é `vitest` em
`resgate-audio.test.ts`, pré-existente). `eslint` limpo no arquivo.
PR **#227** → merge **`832be61`** na main.

## §5 — Prova de produção, e o instrumento cego que quase passou

Deploy `Deploy Frontend (production)` run `34413920612` = **SUCCESS**. Isso
sozinho não prova nada ("build verde não é funciona"), então fui no servidor
(`91.99.15.213`, leitura):

- `BUILD_ID` = `rtefplPO1yF8VtIrMnZzL`, mtime **22:49:07Z**
- string **velha** `video-final.mp4` → **não existe mais em nenhum chunk**
- string **nova** `"video-final","mp4"` → está em
  `static/chunks/app/[locale]/app/videos/[id]/page-1bb3592b4d9f196b.js`,
  exatamente a rota da tela

**A armadilha, registrada:** antes disso rodei o mesmo grep nos chunks servidos
pela URL pública e deu **AUSENTE nos dois** — velha e nova. O chunk da tela é
lazy e não é referenciado no HTML inicial, então o instrumento estava cego. Se
eu tivesse procurado só a string nova, "não achei" seria lido como "o fix não
subiu"; se tivesse procurado só a velha, "não achei" viraria "confirmado". Foi
ter checado **as duas** que separou instrumento cego de resultado.

## §6 — O que eu NÃO verifiquei, dito claro

**Não cliquei no botão em produção.** Exigiria a sessão da aluna ou gerar um
Vídeo História novo na conta de teste (`suporte@fastcloner.com`, que não tem
projeto pronto — conferido), e isso queima GPU sem aluno ter pedido. A garantia
aqui é: padrão já em produção em 10+ chamadas + CORS medido no arquivo dela +
código novo confirmado no bundle do servidor. **Não é o mesmo que ter clicado**,
e não estou dizendo que é.

## §7 — A aluna

`rafaluanravi29@gmail.com` já tinha recebido hoje às 18:27Z (uid 1434) o vídeo
por link de 7 dias **e uma promessa escrita**: *"quando entrar no ar, o botão
vai passar a salvar o arquivo direto"*.

Promessa cumprida no mesmo dia: e-mail enviado agora, **uid 1487 confirmado** na
pasta de enviados. Diz que subiu, que ela precisa **atualizar a página** (senão o
navegador serve a tela velha), que o link de 7 dias continua valendo, e pede o
navegador/dispositivo caso ainda falhe.

Não toquei em crédito, GPU, banco, migration nem no vídeo dela.

---

## §8 — O que fica para a próxima ronda

Quatro coisas travadas em **decisão do Johnny**, nenhuma delas minha pra
resolver, todas com gente esperando:

1. `#313` — honra ou revoga os 15 vitalícios? Trava o `#312` (19 alunos) e o
   reembolso do Victor.
2. `#99` — a frase do Johnny/Lucas pendente desde 24/08. Próxima cobrança do
   aluno cai em **19/09**.
3. `#249` — "pode" pra mandar WhatsApp ao Glauber (R$ 694 pagos, 25 dias, e-mail
   dele bate 550 permanente).
4. `#76e68853` — welrisson, R$ 894 pagos em 29/08, travado na tela 1 do SGP, e o
   plano previsto não existe pra ele (o Vigia mediu: não há pedido SGP a
   reassumir).

---

## §9 — O erro que eu cometi nesta ronda

**Dupliquei trabalho.** Existia o **PR #224**, aberto às 18:34Z de hoje pelo
Executor, corrigindo exatamente este defeito. Eu peguei o `#267` às 22h40Z e
escrevi o fix **sem procurar PR aberto pro chamado** — li a nota do incidente,
li o código, medi, codei. A nota do Executor descrevia o PLANO e eu li como
plano; ele já tinha virado PR.

As duas implementações convergiram no mesmo desenho (`downloadFromUrl`, estado
`baixando`, `renovarUrl` como `refresh` pela mesma lição do `#166`), então não
descartei trabalho melhor — conferi o diff antes de fechar. Custo real: trabalho
repetido. Custo ao aluno: nenhum.

Fechei o **#224** com a explicação e **deletei a branch**. Branch morta mexendo
no mesmo arquivo de um fix que está no ar já derrubou produção neste repo três
vezes (`feat/fix-image-upload-retry`, `feat/onedrive-401`,
`fix/referencia-fronteira-de-frase-por-palavra`). Não deixo a quarta.

**A lição, pra virar passo fixo:** antes de escrever uma linha de código pra um
chamado, rodar `gh pr list --search "<numero do chamado>"` e `git branch -r`
procurando o assunto. O checklist de FIM de ronda pega branch presa; o de
INÍCIO não pegava PR aberto. Agora pega.
