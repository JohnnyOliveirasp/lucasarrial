# Rotina das falhas — 02/09/2026, ~17:45Z

Ordens lidas antes de tocar em qualquer coisa: índice `ordens/README.md`, a ordem de canal de
31/08 (tudo do FastCloner vai no **grupo**), `2026-08-29_desligar_vigia_e_frank.md` (planilha
desativada) e `2026-08-20_dono_da_fila_e_fila_zerada.md`. Método serial (regra 8, 21/08).

## Placar, sem maquiagem

| | entrada | saída |
|---|---|---|
| abertos (`open`+`investigating`) | **5** | **5** |
| aguardando aluno | 10 | 10 |

**Fechei ZERO incidentes nesta ronda, e o número não se mexeu.** O que eu fiz foi apagar um
incêndio que não aparece no placar: **a última palavra que uma aluna tinha da gente era uma
afirmação falsa, por escrito.** Prioridade da ordem: aluno esperando vem antes da limpeza da
fila.

## O caso que peguei: `ce6e157d` / `#47` (Katia) — o mais antigo aberto com aluno afetado

341,5h. Voltou para `investigating` às 16:27 (fechado errado às 16:03).

### O que eu encontrei

A Katia tinha recebido **dois e-mails nossos hoje, com 8min49s de diferença, dizendo o
oposto um do outro**:

| hora | uid | o que diz |
|---|---|---|
| 15:53:33 | 457 | *"você estava certa… a palavra você do s34 está cortada mesmo"* — **com medição** |
| 16:02:22 | 458 | *"resposta final… **não encontramos corte em nenhum deles**… limite do que a tecnologia entrega hoje"* |

**Ninguém escreveu a ela entre 16:02 e a minha ronda.** Confirmado em `ler_caixa --enviados
--para`: o uid 458 era a última palavra nossa. E ela já tinha falado em cancelar e migrar de
plataforma (uid 418, 01/09). Ou seja: uma aluna estava decidindo se ficava **em cima de uma
afirmação nossa que era falsa**.

### Medi eu mesmo antes de escrever

Não repeti a medição do Vigia nem a da nota anterior — quem vai afirmar para a aluna sou eu.
`cauda_decepada.cjs --ensaio`, **régua aprovada nos 3 casos de controle**:

```
81d4f3f4  (o arquivo de 40s que ela tem, 25/08)   6 fronteiras
   t=11.907  release 305ms  plato -50.9dB
   t=22.286  release 130ms  plato -47.0dB
   t=31.680  release 140ms  plato -49.9dB
   t=34.494  release  10ms  plato -27.9dB   <<< DECAPITADA
   t=36.756  release 115ms  plato -49.6dB
   t=39.823  release 130ms  plato -45.6dB

1498fbe5  (o refeito de hoje 15:48, 42,0s)        6 fronteiras, TODAS limpas
   release 55–290ms · plato -37,1 a -54,9dB
```

**A queixa dela é verdadeira. O uid 457 está certo, o uid 458 está errado.** Bate no segundo
que ela apontou de ouvido.

⚠️ **Ressalva que eu registro para não ser lida como folga:** a fronteira `t=39,377s` do
arquivo novo é a mais marginal do arquivo (release 55ms, platô −37,1dB). **Passa** a régua
(que exige release ≤35ms **e** platô > −40dB), mas é a mais próxima do limiar. Não é
"limpo com margem", é "limpo".

### O que escrevi a ela — uid 461, cópia em Enviados **confirmada** na 1ª tentativa

- Desconsidere o uid 458 **inteiro**; ela estava certa e eu **remedi**.
- **Por que erramos**, dito na cara: a nossa conferência é por transcrição, e a transcrição é
  **cega a este defeito** — o whisper reconstrói a palavra decapitada por *prior* de
  linguagem, então o áudio passa aprovado com o defeito dentro. O instrumento dizia que
  estava tudo bem porque não era capaz de ver o problema, e nós repetimos o instrumento em vez
  de acreditar no ouvido dela.
- **Não é a voz nem a gravação dela, e não é só com ela** — defeito de produto, centenas de
  vozes, desde julho. Dito em **ordem de grandeza**, sem citar 609/237/14,3% como precisão de
  laboratório (o limiar está calibrado em UM positivo conhecido — ressalva do Vigia, §1).
- O arquivo novo está na conta dela sem custo, e eu conferi as 6 fronteiras.
- A conta dela para decidir com informação correta: acesso até **15/09**, **178.665 créditos**,
  nenhuma cobrança indevida (conferido em `aluno.cjs`).

**O que eu NÃO prometi, de propósito:** nenhuma **data** (o conserto entra em modo sombra
primeiro), nenhum **reembolso**, nenhum **novo ajuste individual** da voz dela. Disse que as
outras 2 marcações dela (pronúncia de *"reconstrução"*, pausa do s5) **seguem sem conserto**.

### A decisão do Lucas não foi contrariada

O fechamento das 16:03 se apoiava numa **decisão comercial do Lucas** (não seguir ajustando
para o caso de uma aluna só). **Eu não mexi nisso.** O que caiu foi a **premissa** do e-mail
— *"não há corte"* — que era falsa e estava por escrito na mão da aluna. Corrigi o **fato**,
não a decisão. Sinalizei isso ao Lucas no grupo, na mesma mensagem, em vez de deixar ele
descobrir depois.

### Por que NÃO fechei

O defeito técnico está **vivo**: `#234` / `f8587cef` é o guarda-chuva e o card do conserto
(`f5a1b81c`) está em **modo sombra, só medindo**. As 2 marcações dela seguem abertas. Fechar
agora seria marcar `fixed` sem ter resolvido — regra 14, que a ordem de 21/08 **não**
afrouxou. Fica `investigating`, com nota 38.

## Registro de rotina

- `anotar_incidente` gravou nota **37 → 38**, **1 linha afetada**, conferido na releitura.
  Nenhuma nota sobrescrita, `resolution_note` preservada (2.644 chars).
- Status **não** foi alterado por mim.
- Nada da **planilha** foi lido, escrito, classificado, avisado ou reprocessado (ordem 29/08).
- Grupo: postado com `notify-grupo.sh`. **Nada foi para o privado do Johnny** (ordem 31/08).

## Segundo caso: `d48e6a45` / `#235` + `b444afcb` / `#220` (Alana) — peguei e devolvi sem escrever

O item da Katia saiu do meu colo (bola com ela), então segui para o próximo, como manda a
regra 8. Aqui **não escrevi para a aluna, de propósito**, e a razão importa.

### O que eu medi

- **ZERO linhas em `voices`** para o user `70fca289`. Não é voz travada nem voz falhada: os
  ~20min que ela e o marido gravaram em 01/09 **nunca criaram registro**.
- Conta: criada 01/09, acesso ativo até **08/09**, **99.475 créditos**, compra 01/09
  `canceled`. Único consumo: −525 de uma imagem em 02/09. **Crédito intacto**, nada cobrado
  indevidamente.
- `pagou_de_verdade`: **sob este e-mail** não há pagamento em Hotmart nem Stripe; a assinatura
  do FastCloner é **R$ 0 trial**. Com a ressalva do próprio script (pode ter comprado com
  outro e-mail). Pelos e-mails dela, o dinheiro foi em **dois cursos do Lucas**, e é deles que
  ela pediu reembolso. **O risco comercial está do lado do Lucas, não numa cobrança nossa.**

### A causa já estava achada — e o conserto não está no ar

Card `c9d3e5d0` (coder, hoje 13:27→13:41) achou o que sangra:
`saveClip(clip).catch(() => {})` em `voice-recorder.tsx`. O `setClips` roda de qualquer jeito,
então **o clipe aparece na lista, a barra sobe, o CTA libera — e o áudio nunca foi salvo.**
Explica os dois relatos dela: o de 01/09 ("gravamos 20min e sumiu") e o de hoje ("aparecem mas
não deixam enviar").

⚠️ **Conferido por mim, não pelo card:** o **PR #154** (`feat/gravador-nao-perde-audio`,
commit `16bd72e`, 8 arquivos, +630/−58) foi aberto hoje **17:39:56Z** e está **OPEN**.
`git log main..origin/feat/gravador-nao-perde-audio` devolve o commit — ou seja, **não está na
main e não deployou**. *Card `completed` não é produção*, e esta é a terceira vez que a
rotina registra isso.

### Por que NÃO escrevi para ela

Outra mão está na thread **agora**: uid 460 (17:28) e uid 462 (17:45) saíram minutos antes
desta ronda. Escrever agora repetiria **exatamente** a falha que eu passei a primeira metade
desta ronda consertando no `#47`. Um incidente, um dono.

### A promessa que não dá para cumprir hoje

O uid 462 prometeu a ela, às 17:45: *"alguém te acompanha passo a passo **até a voz ficar
pronta**"*. **Com o PR #154 fora de produção, acompanhar ela agora a faz falhar de novo** — o
clipe vai continuar aparecendo na lista sem ter sido salvo. Seria o **quarto dia**. A ordem
correta é mergear e deployar primeiro, confirmar em produção, e **só então** acompanhá-la.

### Por que não mergeei

Não é recusa de decidir. O PR toca o caminho do gravador de **todos** os alunos, foi aberto há
15 minutos, e este repositório já tem histórico de branch stale derrubando fix em produção
(`onedrive-401`, `fix-image-upload-retry`, os 2 da cura de referência). Merge que muda
produção para todo mundo eu **subo para decisão humana** — subi no grupo, com o link, marcado
urgente. Nota 3 gravada no `d48e6a45`.

## Limites da minha prova, ditos na cara

1. **Não ouvi o áudio.** Toda a minha afirmação é de **envelope** (forma do decaimento), não
   de escuta. O veredito final de qualidade continua precisando de ouvido humano.
2. **O limiar da régua está calibrado em UM positivo conhecido.** Ele separa os 3 casos de
   controle, e é isso que eu posso afirmar. A ordem de grandeza do alcance aguenta; o número
   exato não é precisão de laboratório.
3. **Não medi** se o arquivo novo resolve as outras queixas dela (entonação, pronúncia,
   pausa do s5). Disse a ela que **não** resolve, o que é o lado seguro da afirmação.
4. **Não sei se ela vai ficar.** Ela não respondeu até o fim desta ronda (último e-mail dela
   é o uid 423, 16:38). A bola está com ela, e o item saiu do meu colo.
5. **No caso da Alana, não reproduzi o defeito do gravador.** Aceitei a causa do card
   `c9d3e5d0` porque ela explica os dois relatos dela e o `saveClip(...).catch(() => {})` é
   verificável por leitura. O que eu **medi** foi o efeito (zero linhas em `voices`) e o
   estado do PR. **Não rodei o gravador no navegador.**
6. **Não conferi se o `#220` e o `#235` são o mesmo defeito** ou dois. Tratei como a mesma
   família porque a causa achada explica os dois, mas não provei que o menu sumido de 01/09
   e o envio travado de 02/09 têm a mesma raiz.
7. **Deixei `_frank/ferramentas/assinatura_em_dobro.cjs` untracked.** Não é meu e não é desta
   ronda. Registro em vez de commitar trabalho de outro agente em silêncio — mesma posição
   que o Vigia tomou em 16h.
