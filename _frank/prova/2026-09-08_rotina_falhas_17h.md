# Ronda das falhas — 08/09/2026, ~16h40–17h30Z (Frank, dono da fila)

Repo sincronizado (`main`, `pull --ff-only`) e `_frank/ordens/README.md` lido
antes de tocar em qualquer coisa. Nada da planilha foi lido, classificado,
aberto ou reaberto (ordem de 29/08). Canal: **grupo** (ordem de 31/08).

**Card levado adiante:** `#234` (`f8587cef`) — palavra decapitada no meio do
áudio entregue.
**Estado no fim:** incidente **continua `investigating`** de propósito. O passo
que a ronda anterior deixou escrito **caiu**; ao descer um nível, a régua do
próprio card foi **refutada contra verdade de campo**. Notas 28 (`#234`) e 54
(`#47`) gravadas e conferidas na releitura. Zero GPU, zero whisper, zero
crédito, zero e-mail.

---

## 0. A ronda em uma linha

**O texto da referência não separa nada, e ao procurar o nível abaixo eu
descobri que a régua que sustenta este card não mede decapitação: ela ordena as
vozes por volume e velocidade de decaimento, e erra o único caso que uma aluna
confirmou por escrito.**

---

## 1. Por que o `#234`, e não outro

Ordenei os abertos por `created_at` e conferi o bloqueio de cada um **na
fonte**, em vez de herdar o veredito da ronda anterior:

- **`#15`** (30/07) — travado: espera a próxima falha com a imagem nova e a
  migration 82 aguarda aval.
- **`#222`** (01/09 15:54) — o mais antigo com aluno, mas travado em **decisão
  do Johnny**: as notas 32 e 33 já mediram que o título ("5 alunos presos") está
  refutado nos 3 alunos que o card nomeia, que não existe chave automática que
  resgate a população, e que os 4 pagantes reais já foram escritos. O passo que
  emperra é decisão, não investigação. Recomendação de reenquadrar ou fechar
  segue de pé, com o Johnny.
- **`#226`** (01/09 17:52) — travado por **falta de volume**, e agora medido:
  desde o deploy `2adb080` (15:22Z) saíram **7 entregas**, 1 com `exhausted`.
  n=7 não compara com nada. A ronda anterior previu "a da noite ou a de amanhã"
  e continua valendo.
- **`#234`** (02/09) — **o único com passo livre escrito** (item 9 da nota 27).

Também conferi o `#306`, que a varredura marca como "fechado em cima do próprio
disparo": está **de fato corrigido em produção** (PR #212, merge `e449783`),
com a regra isolada em módulo puro e 11 testes. O alerta da varredura é
heurística de *timing* de fechamento, não defeito aberto.

---

## 2. O passo escrito caiu: o fim da referência não separa

Classifiquei como a referência **termina** nas 99 vozes do recorte:

| classe do fim | vozes | donos | fronteiras | taxa |
|---|---|---|---|---|
| ponto final | 69 | 63 | 4.414 | **11,5%** |
| reticências | 23 | 23 | 1.816 | **13,0%** |
| sem pontuação (corta seco) | 2 | 2 | 106 | **8,5%** |
| sem transcrição | 5 | **1** | 461 | 29,5% |

Não há separação útil. O único número alto é `SEM TRANSCRICAO` — e são **5
vozes de UM dono**, o cohort `a661ec71` confundindo este card pela **quinta**
vez. Não citar. Nos polos, a mesma classe domina os dois lados (ALTO: 7 ponto
final / 3 reticências; ZERO: 14 / 3).

Com isso **acabou o que estava gravado em `voices`**: comprimento, fim do
texto, LoRA, `is_stock`, idioma, `tts_silence_ms`, `tts_crossfade_ms`,
`lora_alpha`. Nada correlaciona.

---

## 3. Dois resultados que fecham portas antes de alguém gastar ronda nelas

**A taxa é da VOZ, não da geração.** Nas vozes com ≥5 gerações, a decepagem se
espalha por **todas**: `c3514f54` (46,2%) tem 0/7 gerações limpas e 0/7 totais;
`67f2acce` (41,5%) 0/9 e 0/9; `34455bd8` (27,9%) 0/20 e 0/20. Se dependesse do
texto gerado, haveria geração limpa e geração ruim. Não há — **a hipótese "é o
texto / é onde o chunk parte" morre aqui**.

**`sil_s` está morta como pista.** Decepadas mediana 0,239s, sadias 0,238s, e
**nenhuma** das 6.797 fronteiras tem `sil_s` = 0. O pipeline sempre insere
~0,24s. "Faltou silêncio entre chunks" não é o mecanismo.

---

## 4. O achado: a régua não mede decapitação

`release_ms <= 35 && plato_db > -40` usa limiares **absolutos**, e o que ela
separa é o **caráter sonoro da voz** — que é constante por voz, o que explica o
item 3 e explica por que cinco hipóteses de metadado morreram: *não se acha a
causa de um fenômeno com um detector que não o detecta*.

- **Os polos são dois mundos sonoros.** ALTO: plateau mediano −32 a −38,5 dB,
  release 35–55 ms. ZERO: −45 a −55 dB, release 70–245 ms. Correlação com a
  taxa nas 99 vozes: fração com `plato > -40` **r = 0,829**; fração com
  `release <= 35` r = 0,711.
- **A "queda" parece imune a ganho e não é.** ALTO cai 24,3 dB, ZERO cai
  11,4 dB — mas os dois terminam no **mesmo piso**: `ultimo_db` mediano −61,8
  contra −60,0. Logo queda = plateau menos uma constante: ganho disfarçado.
  Registrado para ninguém "descobrir" a queda como achado novo.
- **Não existe penhasco em 35 ms.** Histograma (6.462 valores, quantizados de 5
  em 5): 0-9=552, 10-19=75, 20-29=242, 30-39=459, 40-49=564, 50-59=511,
  60-69=505, 70-79=415. É um contínuo, e o limiar caiu na **subida** da
  distribuição principal — o pior lugar possível para um corte.
- **Por isso o número-manchete é leitura de botão:**

| limiar | fronteiras marcadas |
|---|---|
| release ≤ 15 ms | 3,4% |
| release ≤ 25 ms | 6,6% |
| **release ≤ 35 ms (o escolhido)** | **13,1%** |
| release ≤ 45 ms | 20,8% |
| release ≤ 55 ms | 28,1% |

Dobra a cada 10 ms, e a quantização do dado é 5 ms. O limiar de volume, em
comparação, está saturado (−35 → 10,1%; −40 → 13,1%; −45 → 14,0%). **Toda a
sensibilidade mora no `release_ms`.**

---

## 5. A prova contra verdade de campo

A **Katia** (`#47`) é o único caso com decapitação confirmada por gente: ela
aponta, por escrito, a palavra "VOCÊ" cortada no **segundo 34** do áudio
"02/09 - VERSAO NOVA (42s)".

Essa geração é a `1498fbe5` (02/09 15:48Z, 42,026s). Ela **tem** uma fronteira
de chunk em **t = 33,781s** — exatamente onde a aluna diz que corta. Medidas
dessa fronteira: `release_ms = 120`, `plato_db = −48,6`.

A régua exige `release <= 35` **e** `plato > −40`. Falha nas **duas**, com
folga. E marca **zero** fronteiras decepadas na geração inteira. A voz dela
fica em **64º de 99**, com 4,7%, **abaixo** da média global de 13,1%.

**A instrumentação dizia que a Katia estava bem enquanto ela reclamava com
razão.**

---

## 6. O que isso significa — e o que NÃO significa

**Não** significa que o defeito é falso: a Katia prova que decapitação real
existe, e a cura manual dela já foi provada. Significa que **"609 gerações
(14,3%), 237 alunos, 272 vozes" não é uma população medida de defeito** — é o
que aquele par de limiares recorta de um contínuo, e erra o caso conhecido. Não
usar esse número para dimensionar dano, priorizar aluno ou avisar ninguém
enquanto não houver instrumento validado.

E é a **terceira vez que heurística de energia falha nesta casa no mesmo
assunto**: a ordem permanente já diz, sobre a cura de referência, *"heurística
por energia foi REPROVADA duas vezes, não subir"* e *"automatizar exige
TIMESTAMPS DE PALAVRA"*. `release_ms`/`plato_db` **é** uma heurística de
energia. A lição já estava escrita — foi aplicada na referência e não neste
detector.

**Próximo passo (muda de "achar a causa" para "ter instrumento"):** parar de
correlacionar metadado contra esta régua, porque qualquer achado novo em cima
dela nasce inválido. O detector tem de ser por **timestamp de palavra**:
alinhar o texto gerado com o áudio entregue e marcar fronteira de chunk que cai
**dentro** de uma palavra. Validar contra os casos de campo antes de qualquer
número — começando pela geração `1498fbe5` em t=33,781s, que é verdade
conhecida e serve de **teste-âncora**: um detector que não acusa essa fronteira
está errado, sem discussão.

---

## 7. Armadilha latente registrada (sem dano hoje)

335 das 6.797 fronteiras têm `release_ms` **NULL**, e em JS `null <= 35` é
**true** — a régua as contaria como decepadas. Hoje não inflam nada porque
todas têm `plato_db` muito baixo (ex.: −97) e a segunda condição as rejeita:
**888 com a régua como está, 888 com guarda de tipo**. Quem mexer nos limiares
(principalmente afrouxando o de volume) liga essa mina. Põe guarda de tipo
antes.

---

## 8. O que NÃO está feito

1. **O `#234` continua aberto.** Esta ronda não achou a causa — ela mostrou que
   a busca estava sendo feita com instrumento inválido, o que é resultado
   diferente de progresso na causa.
2. **O `#226` não foi medido**: n=7 pós-deploy.
3. **`#15`, `#222` e `#290`** seguem travados pelos motivos do item 1.
4. **A Katia não foi escrita nesta ronda, de propósito** — e isso é dívida com
   dono e prazo, não esquecimento. Ver item 9.

---

## 9. Aluno esperando

A varredura acusa os mesmos 3 + 1 da ronda anterior (`tania-araujo`,
`marcelopersonalthe32`, `hellengrasso`, `luanmarcal.com`), todos já conferidos
como **sem ação minha** (avisados 2×, ou estornados e avisados). Nada mudou em
uma hora.

**A Katia é o caso vivo.** Agora existe material honesto para responder: a casa
reproduziu o ponto exato do corte e sabe que ele cai numa junção de chunk
nossa, não na gravação dela. **Não escrevi nesta ronda de propósito:** a
descrição do `#47` avisa que o assunto mudou na ocorrência 9 e manda conferir
se o pedido anterior já foi respondido, e o `#259` registra que **esta aluna já
foi prejudicada por uma segunda resposta automática que contradisse a
equipe** — pediu reenvio 19h30 depois, contra a orientação anterior, e o
reenvio de 31MB bateu no teto e foi recusado. Escrever sem ler a thread inteira
é repetir o dano do `#259`. Ficou registrado na nota 54 do `#47`: ler
`ler_caixa.cjs --enviados --para katiasalvador32@gmail.com` **antes**, e então
escrever — ela espera há 20 dias e merece a confirmação.

---

## 10. Higiene de fim de ronda

- Nenhum código mudou — só leitura e medição. Nada a mandar por PR.
- Este log vai direto na `main`, como manda a ordem.
- Conferência por **fix**, não por branch (item 6 da ronda das 16h): nada novo
  a conferir, porque nada foi mergeado nesta ronda.
- Nada de crédito, GPU, whisper, migration, assinatura cancelada, e-mail
  individual ou em massa.
- Scripts de uso único ficaram fora do git, em `_Bugs/`:
  `2026-09-08_fim_referencia.cjs`, `2026-09-08_nivel_fronteira.cjs`,
  `2026-09-08_detector_volume.cjs`, `2026-09-08_piso_e_limiar.cjs`,
  `2026-09-08_katia_ancora.cjs`, `2026-09-08_nulos_release.cjs`.
