# Ronda das falhas — 13/09/2026, ~11hZ (08h BRT)

Executor (14-A): eu investigo, decido, conserto e fecho. Repo em `main`,
`pull --ff-only` limpo. `_frank/ordens/README.md` lido, mais a ordem de **27/08**
(só erro de sistema vira chamado), a de **29/08** (planilha desligada) e a de
**31/08** (canal = grupo). **Nada da planilha foi lido, escrito ou reprocessado.**
`now()` no banco = **2026-09-13 10:53:26Z**.

**Fechei 0 incidentes.** Digo isso na primeira linha porque é o número que
importa e ele não melhorou. O que eu fiz foi outra coisa: derrubei uma premissa
errada que estava fazendo a casa pedir a coisa errada pra uma aluna.

---

## 1. 🔴 O gate de rosto é uma LOTERIA — e isso retifica a ronda das 10hZ

O Vigia registrou às 10hZ: *"Medi 5 de 6 imagens bloqueadas com **veredito
estável**"*. **Não é estável.** Medi eu mesmo, e o método é a diferença.

`_Bugs/2026-09-13_gate_alice.cjs` — carrega o `checkFrontalFace` **de produção**
por jiti (não copia a régua, aborta se o export sumir), roda nas **7** imagens da
`alicearnaldo@gmail.com`, **3× cada = 21 chamadas**. Leitura pura, não cobrou a
aluna, custo = vision Haiku.

| imagem | passa |
|---|---|
| `128b3050` upload 23:54 | 0/3 |
| `b5c6dea7` upload 23:52 | 0/3 |
| `4100fc07` **GERADA** 20:35 | **2/3 — FLIPA** |
| `5f610dda` upload 20:26 | **1/3 — FLIPA** |
| `8cd4c73c` upload 20:22 | 0/3 |
| `0e6a538a` upload 18:07 | 0/3 |
| `2b274f51` upload 17:56 | 0/3 |

**A mesma imagem, na mesma chamada, dá respostas diferentes.** Com 1 chamada por
imagem o sorteio é invisível — não é erro do Vigia, é limite do n=1. Fica o
método: **veredito de LLM só vira "estável" depois de n>1 na MESMA entrada.**

Isso também corrige o segundo ponto dele (*"a única imagem GERADA é a única que
passa"*): o upload `5f610dda` também passa, 1 vez em 3.

### Duas causas prováveis, ambas no `face-gate.ts`

1. **Temperatura 1.0.** O body da chamada Anthropic **não manda `temperature`**,
   e o default da API é 1.0. Um classificador binário que decide se o aluno pode
   usar um produto pago está sorteando.
2. **Ancoragem.** As **17** recusas das 21 chamadas dizem **todas** "olhando para
   baixo" — que é o **único exemplo de `reason`** escrito no SYSTEM (*"a pessoa
   está olhando pra baixo, pra tábua na mesa"*). O modelo repete o exemplo que
   recebeu. E o SYSTEM se contradiz sozinho: diz que *"até ~30° de yaw/pitch está
   ok"* e na mesma frase manda reprovar *"looking down at something"*.

### O que isso custou à aluna, medido

Ela tentou **6 vezes** e não tinha como aprender nada com a tela, porque a tela
não dava regra: dava sorteio. A imagem `4100fc07` ela **gerou pagando 525
créditos**, com o prompt *"Olhar fixo para a câmera, boca visível rosto ereto sem
estar inclinado"* — fez exatamente o que mandaram, pagou por isso, **e mesmo
assim leva barra 1 vez em 3**. Tem **0 linhas em `video_clones`**: nunca
atravessou.

A resposta dela de 00:53Z (*"vocês mesmo disseram que a foto estava correta, eu
já fiz a produção correta"*) **estava certa**. A casa é que estava errada, e a
orientação de 00:27Z (levantar o queixo) mandou ela corrigir o que não era o
problema.

**Escrevi pra ela** às ~10:5xZ, assunto *"A checagem estava sorteando, e você
estava certa"*. Cópia em Enviados **confirmada, uid 2074**. Disse a verdade
medida, que não precisa de foto nova, que as tentativas bloqueadas não custaram
nada (conferido no extrato) e que os 525 foram levados ao dono. Não dei prazo que
eu não controlo.

---

## 2. 🟠 Salvei 2 blocos de código órfão que um `git checkout .` apagaria

O Vigia achou o primeiro e, corretamente, **não tocou**. Eu preservei os dois em
branch no origin — **preservação, não endosso**: não revisei o conteúdo e **não
abri PR**.

| branch | o que é |
|---|---|
| `feat/373-cancelar-clone-orfao` (`042f621`) | cancelamento de Vídeo Clone, ~300 linhas, do card `25a82beb` que foi marcado *"não entregou / NÃO foi feito"* **e tinha feito** (mtime 21:35→21:41 dentro da janela do card) |
| `feat/sgp-destino-retomada-orfao` | `lib/sgp/destino.ts` + `retomada.ts` (+testes), 320 linhas, mtime 12/09 15:49 — **não estava na lista do Vigia** |

O segundo bloco é o achado novo: **`codigo.ts:29` já está na `main`** (merge do
#365) e documenta *"`lib/sgp/retomada.ts` faz o OPOSTO — devolve `null` sem
config, **e lá está**"*. Código mergeado apontando pra um módulo que nunca foi
commitado. Nada importa os dois em runtime (só o comentário), então a `main` não
está quebrada — mas a referência ficou pendurada.

⚠️ O teto de 1h do cancelamento automático **continua reprovado** pelas duas
medições (n=20 da nota do #373 e n=762 do próprio `cancelar-politica.ts`: 12 de
762 passam de 1h **e as 12 entregaram**). Preservar não é aprovar.

---

## 3. Os dois alunos esperando

**Alice (`#371`) — atendida nesta ronda** (§1). Falta o conserto no ar.

**Mastroianni (`#369`) — NÃO atendido. Ele continua esperando, agora ~11h.**
Escrevo aqui o que eu **não** fiz pra não maquiar: ele não recebeu nada meu nesta
ronda. Decidi não mandar mais um status porque a casa prometeu a ele, por escrito,
*"eu não vou te dar mais um 'em breve'"* — mas **silêncio também não era a
promessa**, e essa é a parte fraca desta ronda.

O áudio prometido **já saiu** (12/09 22:35Z, 70,6s, conta da casa, ele aprovou:
*"a primeira voz é a melhor, pode usar neste vídeo de teste"*). **Falta só o
VÍDEO.** Material todo levantado e anotado no incidente (user, chave do áudio,
chave da imagem, ~1800 frames, saldo 874 contra custo ~7.500 — ele **não
consegue** rodar sozinho).

⚠️ **Ele pediu link do Google Drive e esta máquina não tem Drive** (sem `rclone`,
sem CLI). O áudio foi entregue por link assinado do R2 e funcionou. Ou entrega
assim dizendo que é link direto, ou alguém sobe na mão. **Não prometer Drive sem
ter como.**

---

## 4. O que está em voo (e o aviso pra próxima ronda)

| card | dono | o que é | estado às 10:53Z |
|---|---|---|---|
| `411efb5f` | coder | `video_clone_conta_da_casa.cjs` — o vídeo do `#369` | **running** |
| `b25285d1` | coder | gate determinístico: `temperature: 0` + tirar a ancoragem + **controle negativo obrigatório** | **running** |

O `b25285d1` leva explícito o que matou as **duas** tentativas anteriores neste
mesmo gate: sem provar que perfil/nuca/boca tapada **continuam barrados**, não
abre PR. Gate que aprova tudo não é conserto, é gate desligado. E o escopo é só
frontalidade — **tamanho de rosto no quadro não entra**, que foi a confusão que
reprovou as tentativas anteriores.

🔴 **Não confie no board.** O Vigia mediu: **29 de 126 cards morreram**, e o
veredito *"worker não entregou saída = NÃO foi feito"* **já se provou FALSO** (o
`25a82beb` do §2 tinha feito o trabalho inteiro). Quem pegar a próxima ronda:
**confira o card antes de assumir que anda, e não feche incidente por causa de
card `completed`.** Anotei isso dentro do `#369`.

---

## 5. Dinheiro — levado ao Johnny no grupo, nenhuma decisão tomada por mim

Não fiz nenhuma conta de estorno, não casei `ref_id` com nada e não afirmo que
alguém foi ou deixou de ser estornado.

1. **Mastroianni (`#369`): 48.025 créditos** gastos em Vídeo Clone em 09 e 10/09,
   sem estorno, saldo hoje **874**. A casa já disse a ele por escrito que a
   decisão é do dono. **Ele espera isso também, além do vídeo.**
2. **Alice (`#371`): 525 créditos** que ela gastou gerando foto pra agradar uma
   checagem quebrada.

**Garantia na fila** (`garantia_na_fila.cjs`, 10:52Z, controle positivo OK 2/2):
**8 perderam a janela**, 4 vencem em 48h, 0 na renovação. Sem mudança no total
contra as 10hZ, mas com um agravamento: **o Rodrigo (`#306`/`#363`,
R$ 1.194,90) virou há 10,9h** — a janela dele fechou **13/09 00:00Z**, durante o
turno da noite, que não roda. Ele esperou **106,1h de prazo dentro da nossa
fila** e continua sem resposta.

---

## 6. Placar honesto

- **Incidentes fechados nesta ronda: 0.** O backlog não baixou.
- Alunos escritos: **1** (Alice, uid 2074 confirmado).
- Incidentes anotados: **3** (`#371`, `#369`, `#372`).
- Código preservado: **2 branches**, ~620 linhas que estavam a um `git checkout .`
  de sumir. **0 PRs abertos por mim, 0 merges.**
- Cards criados: **2**, os dois `running` no fim da ronda.
- Commits meus na `main`: **1** (este log).
- **Premissa derrubada: 1** — "o gate tem veredito estável".

O passo que emperrou: **o `#369` depende de uma ferramenta que ainda não existe**
(vídeo por conta da casa), e enquanto ela não sai o aluno espera. Era isso ou
disparar ~7.500 créditos de GPU na mão, sem trava, num caminho que hoje só existe
como teste de fumaça.
