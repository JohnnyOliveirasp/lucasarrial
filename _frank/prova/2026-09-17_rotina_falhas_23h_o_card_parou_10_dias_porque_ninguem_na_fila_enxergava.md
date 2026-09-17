# Ronda das falhas — 17/09, 20h50Z (rótulo "23h" só pra manter a ordem)

> Nota de relógio, pra chronologia futura não mentir: os rótulos de hora dos
> logs desta série estão adiantados em relação ao UTC real — o log rotulado
> "21h" foi escrito 14:48Z e o "22h" às 19:53Z. Este foi escrito **20h50Z** de
> verdade. Mantive o rótulo sequencial pra não quebrar a ordenação da pasta,
> mas o carimbo que vale é o de cima.

**Item serial: `#298` (`1095bb4b`), Iran Ferreira de Moura. NÃO FECHADO — mas
o passo que travava o card há 10 dias era "alguém olhar a imagem", e ele
finalmente foi dado.**

Em uma linha: **o card não estava parado por ser difícil; estava parado porque
o único passo que faltava era enxergar, e nenhum agente da fila enxergava.**

---

## 0. Por que peguei este

Mesmo critério da ronda de 14/09: não a idade bruta, e sim **a nota mais
velha**. Os três cartões mais antigos por nascimento seguem sem passo meu,
conferido hoje:

| cartão | idade | dono do próximo passo |
|---|---|---|
| `#15` `d3d8d1b2` | 49,3 d | Johnny — troca qualidade × entrega |
| `#226` `702cc916` | 16,1 d | Johnny — falhar tudo × só o grave |
| `#234` `f8587cef` | 15,2 d | Johnny — ligar o QA reprovando (gasta GPU) |

`#249`/`#250` seguem travados no aval de WhatsApp; `#254` (cobrança em dobro)
travado na decisão de dinheiro pela 9-C, com a medição de ontem já publicada.

Ordenando a fila pela **última anotação**, o primeiro da lista era o `#298`:
última nota **07/09 16:25Z**, **10,2 dias** sem ninguém encostar, com aluno
envolvido. E ele tinha passo meu, escrito por outro agente e nunca executado:

> *EXECUTOR, 07/09: "Eu não ouço nem enxergo: não julgo se o avatar ficou
> parecido. Plano recomendado: humano olhar a imagem e decidir."*

O card ficou parado **exatamente** ali. Não faltou investigação, não faltou
dado, não faltou decisão do Johnny: faltou um par de olhos, e a fila inteira
era cega. **Eu enxergo.** Era um passo de cinco minutos esperando dez dias.

## 1. Eu olhei

Baixei do R2 (`voices-clone-ai-verse`) as **6 referências** que ele enviou
(`9ca9e0e1…/refs/`) e o resultado
(`…/images/367afed3-5764-4a7e-ae18-46995012c5e5/result.png`, 1086×1448), e
comparei lado a lado.

**O aluno está certo.** A imagem preserva cabelo, barba, blazer e tipo geral —
mas **refez o rosto**: mandíbula afinada e quadrada, volume submentoniano
removido, olhos mais abertos, linha do cabelo mais baixa, pele alisada, ~10
anos a menos de idade aparente. É um retrato idealizado de alguém *parecido*
com ele. Foi literalmente o que ele escreveu: *"ficou uma pessoal que nao tem
nada haver comigo"*.

Não fechei isso na minha impressão sozinha. Pedi um **segundo par de olhos**
(modelo de visão diferente, prompt cego, com ordem explícita de dizer "não
consegui ver" em vez de inventar). Veredito independente: *"parcial — perdeu a
biometria estrutural original"*, embelezamento **8,5/10**, reclamação
**"totalmente razoável"**, com a lista de traços batendo com a minha.

**Conferi também as 6 referências uma a uma**, porque os nomes misturam dois
padrões (`iran__1_` e `iran10__2_`) e **troca de fotos entre alunos** seria uma
causa muito mais grave que embelezamento. Não houve troca: os seis são o mesmo
homem, mesma roupa, mesma sessão. Hipótese descartada com medição.

## 2. A causa que eu ia escrever, e que estava errada

Lendo a row do banco, `image_generations.prompt` é *"Eu em uma foto social
profissional…"* — e **não pede semelhança nenhuma**. Eu já tinha a frase
pronta: *"o prompt do onboarding não pede likeness"*. Ia para o log, para o
grupo e para a carta do aluno.

**É falso.** O que vai pro Kie é `prompt_en`, não `prompt`.
`frontend/src/lib/onboarding/avatares.ts:79-85` manda:

> *"The exact same person as in the reference photos — **identical face**,
> photorealistic…"*

A instrução de identidade **existe e é explícita**. O modelo
(`gpt-image-2-image-to-image`, 1K, 3:4) recebeu e embelezou assim mesmo. A row
guarda o prompt PT porque é o que o aluno lê na tela.

> **A coluna com o nome mais óbvio não era a que o sistema usa.** Quem
> diagnostica pela `prompt` conclui o *oposto* da verdade — e conclui com
> aparência de evidência, porque veio do banco.

Só não publiquei porque abri o arquivo antes de escrever a frase. O hábito que
salvou aqui é o mesmo do `/subscriptions/…/purchases` de 14/09: **o instrumento
respondeu, e a resposta dele não era o fato.**

## 3. Tamanho da classe — medido, com o limite dito

O template `AVATAR_SOCIAL` rodou **87 gerações para 87 alunos distintos**,
de 29/08 23:17Z (entrada do SGP em produção) até hoje 19:10Z — **ainda
rodando**. 97 das 99 gerações `idea='onboarding_avatar'` saíram no
`gpt-image-2-image-to-image`.

Reclamação registrada sobre semelhança do avatar do onboarding: **1**, esta.

⚠️ **1 em 87 não quer dizer que os outros 86 ficaram bons.** Quer dizer que os
outros 86 **não escreveram** — e a maioria é lead que nunca chegou a entrar na
conta, então não teve como ver. Escrever "caso isolado" aqui seria transformar
ausência de reclamação em prova de qualidade, que é o mesmo erro do "SEM
REGISTRO não é prova de silêncio".

**Não abri chamado de sistema.** Pela ordem de 27/08, fidelidade de modelo é
qualidade, não erro de sistema com evidência; e mexer em prompt ou modelo gasta
GPU. Vai pro grupo como decisão do Johnny.

## 4. O título do card estava errado, e custou trabalho à toa

O card diz *"insatisfeito com o resultado da **voz clonada** 'Minha Voz' **e**
da imagem"*. Li os dois e-mails dele (INBOX uid 473 e 474, 07/09 12:36, PEEK,
nada marcado): **os dois têm o mesmo texto e falam só das fotos.** Ele **nunca**
reclamou da voz. O que houve foi ele responder *também* o e-mail "Sua voz
clonada ficou pronta" com o texto sobre a foto, e a Fast resumir como duas
queixas.

Consequência real, não teórica: em 07/09 a Fast prometeu a ele **"retreinar a
voz sem custo adicional"** (enviados uid 1250) — uma reparação para uma
reclamação que não existe. Não toquei na voz.

## 5. O que é de verdade contra nós

Em **07/09 15:40Z** a Fast prometeu por escrito, em **dois** e-mails (uid 1249
e 1250), que *"a equipe técnica vai dar uma olhada e entrar em contato em
breve"* e que *"a imagem também dá pra refazer"*.

**Dez dias sem ninguém cumprir.** O dano vivo deste card não é a foto feia: é
uma promessa nossa, escrita, não cumprida. (Ele recebeu e-mail nosso em 16/09,
uid 2586 — mas sobre senha/acesso. A queixa dele continuou muda.)

## 6. Ele não consegue refazer sozinho — conferido, não suposto

Saldo **-10.525** (por design do onboarding), sem compra na Hotmart nem no
Stripe (medido pelo vigia nos dois endereços em 07/09).
`api/v1/images/generate/route.ts:166-181` recusa com **402
insufficient_credits** quando `bal.total < creditCost`. E `gerarAvatares()` é
idempotente por `idea='onboarding_avatar'` (`avatares.ts:102-111`): o caminho do
onboarding não regenera nem se for chamado.

Ou seja: dizer a ele *"tenta de novo"* seria mentira. Por isso a oferta é eu
fazer do meu lado.

## 7. O que saiu daqui para o aluno

**E-mail enviado agora** — Enviados **uid 2700**, cópia confirmada na 1ª
tentativa, chave `iran-foto-embelezada-retorno`. Nele:

1. assumo os 10 dias, sem desculpa;
2. digo que olhei e que ele está certo, **listando o que o modelo mudou no
   rosto dele** — específico de propósito: genérico não prova que alguém olhou;
3. tiro a culpa das fotos dele (estão boas) e digo que a instrução de manter o
   rosto idêntico existe e o modelo ignorou;
4. **corrijo pra ele** o erro do nosso próprio registro sobre a voz;
5. ofereço refazer **por conta da casa**, com a instrução corrigida pra
   preservar a estrutura real do rosto — dizendo com todas as letras que é o
   **mesmo gerador**, portanto **tentativa e não garantia**, e que *se sair
   igual eu digo que saiu igual*;
6. explico que o botão de gerar vai recusar pro saldo dele, e que é por isso
   que a oferta é eu fazer.

**Não vendi assinatura nesta carta.** Ele reclamou de qualidade; upsell agora
seria surdez.

## 8. Por que não gastei GPU ainda

A regra é *nada que gaste GPU ou crédito sem o aluno pedir*. Ele **reclamou**,
não pediu regeneração — quem ofereceu refazer fomos nós. E refazer com o mesmo
modelo e o mesmo prompt tende a **repetir** o embelezamento: entregar um
segundo retrato embelezado confirmaria pra ele que o produto não funciona.

Então a regeneração sai quando ele autorizar, com prompt corrigido, **e eu
olho o resultado antes de mandar**. Com prazo: **se ele não responder até
24/09, a ronda daquele dia refaz por conta da casa assim mesmo** — a promessa
de 07/09 é nossa, não dele.

## 9. A lição

A ronda de ontem aprendeu que *controle que testa só o passo em que eu já
confiava é cerimônia*. Hoje a lição é vizinha e mais simples:

> **Um card pode ficar parado dez dias não por dificuldade, mas porque o passo
> que falta é de uma capacidade que ninguém na fila tem.** "Precisa de olho
> humano" virou um rótulo de arquivamento — o Vigia anota, o Executor anota, e
> ninguém percebe que o passo custa cinco minutos para quem enxerga.

Vale varrer a fila por essa marca (`ouvido/olho humano`) em vez de esperar que
esses cards subam por idade: `#329` (mastroianni) já pede exatamente isso desde
09/09 — *"precisa de ouvido/olho humano"*.

## 10. Estado e dinheiro

Não mexi em crédito, acesso, assinatura, plano nem entitlement. **Não gastei
GPU e não gerei imagem nenhuma.** Não subi código, não abri PR, não apliquei
migration. Não li, escrevi, classifiquei nem reprocessei nada da planilha
(ordem de 29/08). Não toquei em e-mail não lido: INBOX aberta com `EXAMINE` +
`BODY.PEEK`. Um e-mail individual enviado, cópia conferida no IMAP.

`#298` segue `investigating`, com o passo que falta escrito na nota. **Nenhum
incidente fechado nesta ronda** — e isso é resposta legítima: a foto dele ainda
não ficou parecida, e fechar aqui seria fechar mais rápido do que resolvo.
