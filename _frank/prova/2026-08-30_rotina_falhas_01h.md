# Rotina das Falhas — 30/08/2026, ~01h UTC (dono da fila)

Abertura: `git checkout main && git pull --ff-only origin main` → trouxe 3 arquivos
(o fix do #189/#193 já mergeado). Índice de ordens lido antes de tocar em qualquer
coisa. Ordens aplicadas: **`2026-08-29_desligar_vigia_e_frank.md`** (nada da planilha
é lido, escrito, classificado ou reprocessado — e nada com causa nela vira chamado),
`2026-08-20_dono_da_fila_e_fila_zerada.md` (14-A + armadilhas), regra 8 de 21/08
(serial + e-mail individual sem pedir permissão), `2026-08-27_vigia_so_erro_de_sistema.md`
(14-C) e regra 7 (só fato consumado).

Ronda anterior das falhas: **17h UTC (29/08)**. Vigia: **00h UTC (30/08)**.

---

## Placar

| | |
|---|---|
| Incidentes fora de `fixed`/`ignored` na abertura | **2** (`#99` aguardando aluno, `#192`) |
| Incidentes que **fechei** | **nenhum** — nenhum estava fechável honestamente |
| Incidentes cuja **entrega ao aluno eu completei** | **2** — `#189` (fechado sem o lado do aluno) e `#192` |
| **Alunos para quem escrevi** | **3** — Marcos Vidal, Adriane Teka, Robert (`70rrosusa`) |
| Incidentes que anotei | **2** — `#189` (resolution_note estava NULL) e `#192` |
| Incidentes que abri | **nenhum** |
| **Código em produção** | **nenhum meu** — verifiquei o de terceiros (§1) |
| Crédito que toquei | **nenhum** |
| GPU/retreino que disparei | **nenhum** |
| Migration | **nenhuma** |
| Decisões que subi pro Johnny | **3** (§4) |

---

## 1. `#189` — o fix estava certo. O que faltava era o aluno.

Fechado como `fixed` às **00h38Z**, ~3 minutos antes desta ronda abrir, com
`resolution_note` e `resolved_commit` **NULL** e **nenhum dos 7 afetados avisado**.
Pela regra 8, fim = fix em produção **+ aluno avisado**. Peguei como serial.

**Verifiquei o fix em vez de herdar.** Commit `fd1730a`, merge `e4e36a5`, deploy
`Deploy Frontend (production)` run **33283679713 = SUCCESS** (00:35:30Z). Li o diff:
`pronto.ts` deriva `semImagem = st.avatares_prontos === 0` e troca assunto/texto nos
**dois** ramos. A régua de `pronto` não mudou — correto, é decisão de 22/08. Conferi
o que a nota não afirmava: `avisoOkMasAssine` tem **um único chamador** (`pronto.ts:211`)
e ele passa `semImagem`, então não sobrou caller no default `false` que continuasse
mentindo; e `sgp/etapas.ts` **não manda e-mail final próprio** (só `avisoFotoPronta`/
`avisoVozPronta` por etapa; o final passa pelo mesmo `verificarOnboardingPronto`) —
logo o fix cobre o `/sgp` de fato, não só pela nota.

### O achado que faltava: o fix NÃO alcança os 7 já atingidos

`verificarOnboardingPronto` sai cedo em `if (!st.pronto || st.email_enviado) return`,
e os 7 têm `profiles.onboarding_ready_email_at` gravado. **Nenhum deles recebe o texto
novo, nunca, por nenhum caminho automático.** Código cura caso novo; o que já foi
entregue só cura na mão. Sem isso, o incidente estava "fixed" com 7 pessoas ainda
acreditando que as imagens delas estavam configuradas.

**Estado medido hoje dos 7** (mesma régua do código, `image_generations` com
`idea='onboarding_avatar'`): os 7 seguem com `av_total = 0`. **Nenhum se resolveu
sozinho** — passo 1 do manual não pagou aqui.

### Dinheiro: nada a estornar, e o porquê

O `-10.000` em `credits_extra` de 4 deles é o débito de onboarding **por decisão do
Johnny de 21/08** (`credits/service.ts:76-86`, `debitCreditsOnboarding`: *"a dívida cai
em credits_extra e é descontada sozinha quando os 100k entrarem"*). É desenho conhecido,
vale para todo onboarding, **não é dano deste incidente**. Não toquei em crédito.

### Armadilha nova, medida (para a próxima ronda não repetir)

**`fb_teixeira@hotmail.com` parecia assinante e NÃO É.** Tinha `access_until` 29/08 com
`access_source='hotmart'`. `pagou_de_verdade.cjs`: **"NUNCA PAGOU"**, único registro
**R$ 0 APPROVED**. Acesso ≠ pagamento. Quem olhar só o `access_until` vai concluir errado.
**Nenhum dos 7 é pagante.**

### Limite da prova, dito na cara

A caixa **Sent tem buraco de 20 a 23/08** (uid 2 = 19/08, uid 3 = 24/08). Para o **Marcos
(29/08)** eu tenho prova de caixa dos dois e-mails — uid 306 `02:51:24Z` *"Precisamos de
você: suas imagens"* e uid 308 `02:57:00Z` *"suas imagens e o seu áudio estão ok"*, **336s**.
Para os **6 do dia 22 eu não tenho cópia**: tenho o carimbo `onboarding_ready_email_at`
(que só persiste se o envio não lançou) e o código da data. É forte, **não é a mesma prova**.

---

## 2. Os alunos — 3 escritos, todos individuais (regra 8)

Todos por SMTP do `suporte@`, `--bcc suporte@lucasarrial.com`, ensaiados em `--dry-run`
e lidos inteiros antes de sair. Endereços vindos de `profiles`, sem homônimo.

**`marcosvidal2013`** — caso provado e **ativo** (`last_seen` 29/08 19:05, *depois* do
e-mail falso). Assumi o erro, dei os dois assuntos para ele conferir na caixa dele,
separei o que é verdade (voz `ready`, 31min) do que é falso (zero imagem), e disse que
**o convite para assinar veio em cima de premissa falsa**. E o que ninguém tinha ligado:
o primeiro e-mail mandava ele *"colar um link novo na planilha"* — **esse caminho morreu
hoje** (ordem de 29/08). Ele estava segurando uma instrução para um canal morto. O caminho
vivo agora é responder o e-mail com as fotos anexadas.

**`adrianeteka7`** — **ela mandou as fotos e ninguém usou.** INBOX uid 235 (áudio `.m4a`,
30.4MB) e uid 236 (**4 JPG anexados**), ambos 22/08 02:15–02:16, ou seja **~11h antes** do
e-mail falso das 13:12. A voz ficou `ready` (o áudio entrou); as 4 fotos ficaram paradas na
caixa e a conta está com zero imagem até hoje. Ela fez a parte dela e foi ignorada. Escrevi
assumindo a falha e pedindo **só que ela confirme se ainda quer** — **não prometi data nem
que alguém já está rodando** (armadilha da promessa órfã do Johnathan, registrada às 00h).

**`70rrosusa` (Robert, `#192`)** — **estava no silêncio.** Conferi as duas caixas: zero em
Sent para ele, zero no INBOX vindo dele. ~3h30 desde a queixa das 21:23Z, quatro agentes
trabalhando no caso, e **nenhuma palavra para ele** — e a própria descrição do chamado avisa
que ele espera **dentro do app**, onde não existe resposta humana. Foi esse padrão que fez a
Viviana explodir. Escrevi: o que está medido e íntegro (1 arquivo de ~60min, treino concluído,
nada cobrado indevidamente); o achado do recorte de referência com quase o dobro de pausa da
fala normal dele — **explicitamente como hipótese em conferência, não como causa** (14-C §4:
ouvido humano não é meu); e o que mais importa para ele: **não regravar**. Se a causa for o
recorte, a cura usa o áudio que ele **já mandou**.

⚠️ **Promessa que eu fiz, com dono declarado:** disse a ele *"te escrevo de volta com o
resultado, dando certo ou não"*. O dono é a fila, e está escrito na nota do `#192`: depois do
veredito humano, **a resposta ao aluno faz parte do fechamento**. Não feche sem ela.

---

## 3. `#192` — destravei o pedido do Vigia com uma linha

Ele pediu por escrito na nota das 00h13 o `user_id` para montar o `audio_key` de
`buildAutoReferenceKey` e não tinha banco para descobrir. Medido:

```
user_id  = 13a3d125-589c-4ff4-8805-1ac648079103
voice_id = 1d332ef0-1061-4d65-9bee-3f697e5853ef
reference_audio_path = 13a3d125-.../1d332ef0-.../ref/auto.wav   (bate com presigned.ts:141)
```

Segue `investigating`: o passo que falta é **ouvido humano**, e eu não dou veredito de
qualidade de voz.

---

## 4. O que subiu pro Johnny (decisão dele, não minha)

1. **Os outros 5 do `#189`** (`marlonwsmuniz`, `fb_teixeira`, `hiurysaraiva`,
   `priscila.tyngsboro`, `claudiasantos23504`) — é **lote**, e a regra 8 só me autoriza
   sozinho no individual. Nenhum procurou o suporte; **3 nunca logaram** (`last_seen` NULL)
   e os outros 2 só entraram **antes** do e-mail. Texto pronto, esperando o "pode".
2. **Adriane e Johnathan: material completo na caixa, sem dono.** Com o processo manual, as
   4 fotos dela e os 15 vídeos dele estão parados esperando **mão humana**. A do Johnathan
   já é promessa feita (00h). A da Adriane eu deixei condicionada de propósito.
3. **Achado de produto (não virou chamado, 14-C):** se o recorte de referência é sempre o
   **início** da gravação, o defeito não é do Robert — é de quem começa falando devagar.
   Vale medir a classe inteira (referência × fala média) antes de tratar caso a caso.

---

## 5. Processo — o grupo segue mudo nesta máquina (7ª ronda)

`avisar_grupo.cjs` continua sem `WAHA_API_URL/WAHA_API_KEY` aqui (a WAHA só escuta em
`127.0.0.1` no servidor). É **provisionamento**, não falta de tentativa. Os fatos
consumados foram por Telegram. **Não digo que avisei o grupo, porque não avisei.**

---

## 6. Fila no fim da ronda

**2 abertos**, os mesmos da abertura: `#99` (`aguardando_aluno`, Luciano — dentro da janela;
7d+ pede segunda tentativa) e `#192` (`investigating`, travado em ouvido humano — **mas o
aluno agora sabe onde está**).

Nenhum aluno pagante travado sem resposta ao fim da ronda. Nenhum aluno em silêncio ao fim
da ronda.

## O que eu NÃO fiz
Não fechei incidente que não estava resolvido, não reabri nada da planilha, não reprocessei
import, não gerei avatar, não disparei GPU, não toquei em crédito nem em acesso, e não dei
veredito sobre qualidade de voz.
