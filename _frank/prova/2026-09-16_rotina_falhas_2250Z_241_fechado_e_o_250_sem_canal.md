# Rotina das falhas — 16/09, 22h50Z

**Dono da fila:** Frank (regra 14-A). **Método:** serial (regra 8).
**Item serial:** **#241** (`07a423ff`) — **FECHADO** (`fixed`, `resolved_at`
22:49:19,417Z). **Segundo item:** **#250** (`8c29740f`) — trabalhado, **não
fechado**, travado em aval e com o passo nomeado. Fila: **87 → 86 abertos**.

> **Sobre a hora no nome do arquivo.** Os logs desta série vêm sendo rotulados
> pelo relógio de **Roma** (a ronda "23h" de hoje fechou às 21h56Z; 21h56Z +2 =
> 23h56 em Roma), enquanto os do Vigia usam **Z**. Duas réguas no mesmo
> diretório fazem quem reconstrói a linha do tempo errar por 2h. Carimbei este
> em **Z** e digo as três: **22h50Z = 00h50 de 17/09 em Roma = 19h50 BRT**.
> Quem vier depois: use Z, ou diga qual régua está usando.

---

## 1. Por que o #241, e não o mais velho

Os quatro da frente continuam sem próximo passo na minha mão, e nenhum deles
mudou hoje:

| cartão | idade | por que não era ele |
|---|---|---|
| `#15` `d3d8d1b2` | 48,4 d | fecha por 30 dias limpos ou ocorrência sob a régua nova |
| `#99` `6c38c99d` | 24,3 d | decisão comercial Johnny/Lucas, pedida em 24/08 |
| `#226` `702cc916` | 15,2 d | espera decisão de produto do Johnny (o que fazer quando o QA esgota) |
| `#234` `f8587cef` | 14,3 d | espera aval de GPU pra virar a chave do gate interno |
| **`#241`** `07a423ff` | 13,3 d | ← **peguei este** |

O #241 tinha as duas coisas que a regra manda: aluno esperando **agora**
(ocorrência 3 chegou hoje às 18h54Z) e o desfecho **inteiro** dentro da minha
alçada — e-mail individual sobre um caso que eu estava tratando.

## 2. O #241 não era bug. A API existe e faz o que ele pediu

Clayton (`claytonpc10@gmail.com`) perguntou no chat do app se tinha *"um
endpoit para usar minha voz clonda"*.

**Conferido na produção, não presumido** (`curl` agora): `/api/docs` **200**,
`/api/openapi` **200**, `/app/settings` **200**. O openapi cru declara três
rotas, **todas de voz**:

```
GET  /api/v1/voices                        lista suas vozes
POST /api/v1/voices/{voiceId}/generate     gera áudio
GET  /api/v1/generations/{id}              status (polling)
```

Auth por header `x-api-key` (`components.securitySchemes.ApiKeyAuth`). Geração
**assíncrona**: devolve `generation_id`.

**A conta dele passa no gate, medido.** `settings/page.tsx:41` libera com
`bypassesBilling(email) || creditsTotal > 0`. Clayton: 76.201 de assinatura +
7.875 extra = **84.076**, `plan='pro'`, acesso até 03/10 → `unlocked = true`.
As 3 vozes dele estão `[ready]` com `lora_path` preenchido, então servem.

**`api_keys` dele: lista vazia.** Ele nunca criou uma. Não era permissão nem
defeito — era não achar a tela.

Custo informado com a fonte: `generationCreditCost()` = `Math.max(400,
text.length)` (`credits/config.ts:13,24-26`). Mesmo saldo do site. Nenhum
crédito debitado ou estornado neste chamado.

**E-mail:** SMTP do suporte@, cópia **confirmada** nos enviados — **uid 2594**.

## 3. 🔴 O erro que o ensaio pegou antes de chegar no aluno

A primeira versão da carta dizia que a API *"não aparece na tela de conta"*.
Copiei isso do cartão irmão `#280` (06/09), onde **era verdade**.

**Já não é.** `account/page.tsx:193-202` ganhou, depois daquele cartão, o
ponteiro *"Procurando a API? Sua chave e a documentação ficam em
Configurações"*. Eu ia mandar pro aluno um diagnóstico com 10 dias de idade
como se fosse o de hoje.

O `--dry-run` me deu a chance de abrir a fonte antes de enviar. Corrigi a frase
para o que o código diz **hoje** e registrei o motivo dentro do cartão.

> **Copiar diagnóstico de cartão irmão sem reconferir o código de hoje escreve
> mentira educada pro aluno.** A ficha vizinha diz onde olhar, não o que é
> verdade agora.

## 4. O vão de produto que sobra (e que não vira chamado)

O item do menu lateral se chama **"Configurações"**, nunca **"API"**, em
nenhum dos 3 idiomas (`sidebar-tree.tsx:353-360` — e o próprio comentário do
`account/page.tsx` já registrava isso). Quem procura "API" no menu não acha a
palavra.

**Dois alunos tropeçaram no mesmo ponto:** alfredo.sabocinski (`#280`, 06/09) e
Clayton (`#241`, hoje). A diferença entre eles é só o saldo: o alfredo tinha 0
crédito e cairia no *"Assine para liberar a API"*; o Clayton abre.

Registrado na nota e levado ao grupo. **Não virou chamado** — é produto, não
erro de sistema (ordem de 27/08).

## 5. Segundo item: #250 — o canal acabou, e agora está medido

Peguei o `#250` (12,2 d) depois de fechar o #241. **Não fechei, e não retentei
e-mail — de propósito.**

**O fato novo:** rodei o `contato_hotmart.cjs` (controle positivo passou,
glaubermed reencontrado). A Hotmart viva devolve, para o
`andy.silvestre@icloud.com`: nome Anderson Silvestre, telefone
(11) 97397-4029, R$ 733,60 em 2 compras COMPLETE — e **NENHUM outro endereço de
e-mail**.

Isso muda a ficha de qualitativo para medido: até hoje ela dizia *"o canal que
sobra é o telefone"* por eliminação implícita. Agora está provado que **o
conjunto de caminhos da minha alçada está vazio**. Não é que eu não queira
insistir; não há mais onde.

**Por que não mandei a 5ª carta.** Seria com 2 dias de espaçamento, contra a
regra que eu mesmo escrevi neste cartão em 14/09: retentar **uma** vez com
folga (~7 d); se quicar, acabou o canal e o caso vira **escalada**, não mais
tentativa. Placar: **4 tentativas, 4 bounces** `552 over quota` (uids 995,
1095, 1176, 2331), caixa cheia sem interrupção de 04/09 a 14/09. Retentar
agora seria espera infinita com cara de diligência — o defeito que esta ficha
me ensinou.

**Em que passo está travado:** no **aval de canal externo**, e só nisso.
WhatsApp/ligação em nome da casa não é alçada minha sozinho. Pedido feito em
13/09, reforçado em 14/09, **reforçado hoje pela 3ª vez, marcado urgente**.

O placar que a decisão precisa, sem arqueologia: pagou **R$ 733,60 há 41
dias**; recebeu da casa **nada**; `last_sign_in_at` **NULL**; `sgp_pedidos`
**0 linhas**. E ele não vai reclamar, porque não sabe que existe algo pra
receber.

Segue `investigating` — **não** `aguardando_aluno`: a bola nunca esteve com
ele.

## 6. O que eu NÃO afirmo

- **NÃO afirmo que o Clayton já criou a chave.** Afirmo que a carta saiu com o
  caminho e está confirmada nos enviados (uid 2594), e que a conta dele passa
  no gate. Conferir o desfecho é olhar `api_keys` dele: hoje, lista vazia.
- **NÃO testei criar chave na conta dele.** Não mexo em conta de aluno pra
  provar uma tese minha.
- **NÃO afirmo que a API cobre vídeo ou imagem.** O openapi declara três rotas,
  todas de voz — e foi isso que eu disse a ele, pra não plantar expectativa.

## 7. Fim de ronda

`git fetch origin && git log --oneline origin/main..HEAD` → conferir vazio.
Nenhum branch aberto nesta ronda: os dois itens foram atendimento e medição,
sem código. Nada preso.
