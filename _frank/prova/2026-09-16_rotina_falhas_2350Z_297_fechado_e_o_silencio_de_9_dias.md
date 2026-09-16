# Rotina das falhas — 16/09, 23h50Z

**Dono da fila:** Frank (regra 14-A). **Método:** serial (regra 8).
**Item serial:** **#297** (`f561728e`) — **FECHADO** (`fixed`, `resolved_at`
23:55:30,729Z). Fila: **86 → 85 abertos** (régua do `idade_incidentes.cjs`).

> **Régua de hora:** este log está em **Z**, seguindo o carimbo da ronda das
> 22h50Z. 23h50Z = 20h50 BRT = 01h50 de 17/09 em Roma.

---

## 1. Por que o #297, e não um dos mais velhos

Os sete da frente foram conferidos e **todos** estão presos em decisão que não
é minha, e **todos** foram encostados hoje mesmo pelas rondas das 17h–22h50Z:

| cartão | idade | onde está travado |
|---|---|---|
| `#15` `d3d8d1b2` | 48,5 d | fecha por 30 dias limpos ou ocorrência sob a régua nova |
| `#99` `6c38c99d` | 24,3 d | decisão comercial Johnny/Lucas |
| `#226` `702cc916` | 15,2 d | decisão de produto do Johnny |
| `#234` `f8587cef` | 14,3 d | aval de GPU |
| `#249` `132f7808` | 12,3 d | aval de WhatsApp (único canal vivo do Glauber) |
| `#250` `8c29740f` | 12,3 d | não sobrou canal (Hotmart não tem 2º e-mail) |
| `#254` `f1ada07e` | 12,2 d | falta a frase escrita do titular + reembolso pela 9-C |
| `#263` `5c68eb33` | 11,4 d | falta só a definição do Johnny sobre devolver R$ 97 |
| **`#297`** `f561728e` | 9,3 d | ← **peguei este** |

O #297 era o incidente aberto **mais antigo cujo desfecho inteiro cabia na
minha alçada**: e-mail individual sobre um caso que eu estava tratando (regra
8). Estava parado desde **07/09 16:25Z** — 9,3 dias, **zero** notas de qualquer
agente depois da triagem, e **nenhuma carta enviada a ele em momento algum**
(`ler_caixa --enviados --para thiagokarateca@gmail.com` → *"nada encontrado"*).

**Ressalva que eu respeitei na carta:** a caixa `suporte@lucasarrial.com` não é
lida por nós, então eu **não** afirmei ao aluno que ninguém respondeu. Pedi
desculpa pela demora, que é fato do nosso lado e não depende dessa dúvida.

## 2. A premissa foi REMEDIDA hoje, não herdada

A nota do Executor de 07/09 dizia *"grep no repo por face swap: ZERO
ocorrência"*. Isso tinha 9 dias, e a lição da ronda das 22h50Z (#241) é
exatamente esta: **diagnóstico velho copiado como se fosse de hoje escreve
mentira educada pro aluno.**

Regrepei agora (`frontend/src` + `worker`, `*.ts/tsx/py/md`, padrão
`face.?swap|faceswap|troca de rosto|trocar rosto|swap de rosto`): **zero**.
Com **controle positivo no mesmo comando** — `grep video_clone` devolveu 5
arquivos — porque zero de instrumento cego já enganou esta casa várias vezes
nesta fila.

## 3. O "não" tem causa estrutural, e ela é mais forte que o grep

`frontend/src/app/api/v1/video-clone/route.ts`: o `POST` recebe
`{ image_key, audio_key, tier }` e dispara o **InfiniteTalk** no RunPod. A
entrada é **uma foto parada + um áudio**. O motor **nunca** recebe vídeo como
material de entrada — então não existe "vídeo pronto" onde encaixar um rosto.
Não é feature faltando numa tela, é o desenho do produto. Foi isso que escrevi
pra ele, e não um "não existe" seco.

## 4. A alternativa que eu ofereci é MEDIDA na conta dele, não prometida

`images/generate` aceita fotos de referência (`input_image_paths`, com
validação de existência e de peso até 150 MB). Na conta do Thiago:

- **9** `image_generations`, todas com **5 a 11 fotos dele** de referência,
  ideias *"eu de kimono de karatê branco, faixa preta"* e *"eu dentro do
  laboratório de fisiologia na universidade federal do Pará"*;
- **7** `video_clones`, **todos** partindo de `image_path` do bucket de
  imagens/histórico — **nenhum** de `/video-clone/uploads/`.

Ou seja: a cadeia **Gerador de Imagens → Vídeo Clone** é exatamente o que ele
já faz. O que faltava era alguém dizer isso pra ele.

### 🔴 A correção que o ensaio pegou antes de chegar no aluno

Minha primeira versão da carta dizia que ele *"achou o caminho entre 11 e
12/09"*. **Errado.** A 1ª `image_generation` dele é de **07/09 14:52Z** e os
dois primeiros vídeos são de **16:19Z** e **16:33Z** — ele já estava no caminho
**40 minutos antes de mandar a pergunta** (15:32Z). Corrigi para *"você já
estava usando no próprio dia 7, antes mesmo de mandar a pergunta"*.

> **Data errada numa carta destrói a confiança no resto dela.** O `--dry-run`
> pagou o seu preço pela segunda ronda seguida.

## 5. Dinheiro e crédito: conferido, não presumido

`pagou_de_verdade.cjs` (Hotmart viva): **PAGOU** — avulsa `HP0735493678`
R$ 313,32 COMPLETE 07/09 (Fábrica de Conteúdo Invisível) + assinatura rec#1
R$ 0 07/09 (trial) + rec#2 R$ 97 APPROVED 14/09. Acesso **ativo até 07/10**,
recarga de ciclo +100.000 em 14/09, saldo **133.785**.

Contagem por status: **7** `video_clones` ready, **9** `image_generations`
ready, **1** `generation` ready — **zero falhas**, nada a estornar. Não
debitei, não estornei, não toquei em crédito, acesso ou plano.

## 6. Feito

E-mail enviado pelo SMTP do `suporte@` — **cópia confirmada** na pasta de
enviados, **uid 2596**, tentativa 1, chave de dedupe
`297-face-swap-nao-existe`, bcc `suporte@lucasarrial.com`. Conteúdo: o "não"
com a causa estrutural, a cadeia que existe (com a prova de que ele já usa), o
estado da conta, uma linha dizendo que a casa clona o rosto **dele** com
autorização dele e não cola rosto sobre vídeo de terceiro, e um convite pra
descrever a cena se alguma não estiver saindo.

**Por que `fixed` e não `ignored`:** não foi erro do aluno (a pergunta era
legítima e o cartão pedia *"confirmar se há recurso ou solução alternativa"* —
confirmado) e não foi bug de sistema. O cartão desta classe existe até alguém
responder o aluno (decisão do Johnny 29/08, #153). Não há passo residual, meu
nem de ninguém.

## 7. Achado de instrumento: a lista de recados não serve como lista de trabalho

O `idade_incidentes.cjs` anuncia **104 recados `para_frank_*` esperando**.
Medido agora, dos **97** que são de incidente:

- **24 apontam para incidente JÁ FECHADO** (`fixed`/`ignored`) — 25% da lista;
- **1** não casa com incidente nenhum.

Quem usar esse número como fila de trabalho trabalha um quarto do tempo em
coisa morta. **Não mexi**, e o motivo é medido: `para_frank_orfa_*` **não é
recado, é chave de dedupe** — `frontend/src/lib/payments/aviso-orfao-canal.ts`
escreve e lê essa chave pra não avisar duas vezes. Varrer a lista inteira
re-dispararia avisos de compra órfã, que é a mesma família do #305. Fica
**cravado como candidato a cartão próprio**, com a ressalva de que a varredura
tem que separar `para_frank_<id8>` (recado de mão única, escrito por
`api/v1/agent/actions/route.ts:266`) de `para_frank_orfa_*` (estado de
produção). Não abri agora porque a regra 8 manda levar **um** item ao fim.

## 8. Reconciliação do placar (não é cartão novo)

Meu `count` disse **86 abertos** depois de fechar um, o que parecia ser cartão
novo entrando na ronda. Não era: eu incluí `fixing` (1 linha) e o
`idade_incidentes.cjs` conta só `open` + `investigating`. Régua diferente, não
fato diferente — **84 investigating + 1 open = 85**. Os dois cartões recentes
(#437 21:25Z, #438 21:57Z) já estavam no 86 de antes.

## 9. O que eu NÃO fiz

Não subi código, não abri PR, não apliquei migration, não gastei GPU, não mexi
em crédito/acesso/assinatura/entitlement, não mandei WhatsApp, não liguei, não
li nem reprocessei nada da planilha (ordem de 29/08) e não toquei em e-mail não
lido.
