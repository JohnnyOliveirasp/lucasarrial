# Rotina das Falhas — 28/08/2026, 01h UTC (Frank, dono da fila)

Serial (regra 8): peguei **UM** incidente e fui até onde dava. Incidente **#108**
(`73b9f772`, referência de voz cortada / cauda fantasma).

## Por que o #108, e não o mais velho

A ronda anterior (23:53Z, 40 min antes) escreveu *"dos 6 investigating"* e listou
6: #11, #120, #151, #164, #153, #165. **São 7.** O #108 ficou de fora da própria
triagem que o havia reaberto minutos antes. Não herdei veredito de ninguém: re-medi.

Critério: é o `investigating` mais antigo (23/08) com aluno afetado que ainda tinha
um passo técnico **no meu colo** — os outros estão com a bola fora (aval de
migration, decisão do Johnny, PR aberto, ouvido humano).

## O que estava pendente e ficou resolvido

A ronda anterior deixou escrito, honestamente, uma hipótese **não confirmada**:
*"a alucinação de cauda nasce na transcrição do clipe no próprio treino. Não abri
`voice_pipeline/reference.py` linha a linha — não vou cravar arquivo:linha que não
medi."*

Abri. **A hipótese estava certa, mas o arquivo era outro.**

Não é a seleção (`reference.py`): o snap por palavra está correto e ligado
(`train_reference.py:100`). É a **cura**, em `runpod-worker/jobs/train_reference.py:149`:

    texto = real or previsto

`real` = 2ª passada de whisper no clipe final. `previsto` = transcript do snap por
timestamp de palavra — por construção, exatamente o que está dentro do áudio cortado.
O código aceita `real` **sem nenhuma conferência** sempre que ele volta não-vazio.
Whisper alucina em silêncio de cauda. Logo: a cura escrita em 24/08 para **apagar**
cauda fantasma (caso Negrini #124) passou a ser capaz de **escrevê-la**. Nesta
classe, o remédio é a fonte.

## Prova direta, com o áudio (não por inferência)

Voz `a12d737d` ("Allan 1"), `inst.reinbio@gmail.com`, plan **pro**, treinada
27/08 19:51 — depois de todos os fixes. `conferir_transcript_referencia.cjs --curar`
em **simulação** (whisper-1 sobre o próprio `ref/auto.wav`, sem gravar, sem GPU):

```
ANTES (banco) : ...isso pode influenciar diretamente a evolução dos sintomas Obrigado por assistir.
ÁUDIO (real)  : ...ole metabólico e tudo isso pode influenciar diretamente a evolução dos sintomas.
veredito      : cauda_diverge
```

"Obrigado por assistir" **não existe no áudio**. É a alucinação canônica do whisper
em silêncio. A costura está visível no texto gravado: **não há ponto** entre
"sintomas" e "Obrigado". Ele já gerou 2 áudios com essa referência (último 20:37Z).

## Correção da ronda anterior: 1 dos 3 "alucinados" não é alucinação

A nota das 23:53Z lista como *"alucinação clássica, implausível como fala do aluno"*:
`a12d737d`, `098cceb2` (espanhol) e `f5c13d55` (inglês).

| voz | veredito medido |
|---|---|
| `a12d737d` | **CONFIRMADO** com o áudio (acima) |
| `098cceb2` | **NÃO PROCEDE** — `voices.language = 'es'`. A voz **é** em espanhol; cauda em espanhol é o esperado. Chamado de alucinação por se olhar o idioma do texto sem conferir a coluna do lado — mesma família do erro do #152. |
| `f5c13d55` | **NÃO MEDIDO.** `language='pt'`, cauda em inglês. Plausível como alucinação **e** plausível como fala real de quem ensina inglês. Só o áudio decide, e eu não transcrevi este. Fica declarado como não medido, não como achado. |

Placar honesto: **1 confirmada, 1 derrubada, 1 em aberto** — não "3 clássicas".

## O que subiu (e o que NÃO subiu)

**PR #78** — `fix/inc108-cura-transcript-gate`, base main, **ABERTO, não mergeado.**
Portão de plausibilidade em `transcricao_fiel`, só quando `real` **e** `previsto`
existem: (a) cobertura de palavras < 0,5 → mantém o previsto, ramo
`rejeitado_incoerente`; (b) poda de cauda de alucinação **conhecida** (lista fechada),
ramo `curado_cauda_podada` — só poda se o previsto não terminar na mesma cauda.
Divergência de **borda** (1–2 palavras) continua passando: é para isso que a cura existe.
Testes: **176 passando** (eram 164 na main; 12 novos), baseline medida na main antes
de editar, zero regressão.

**Limite que fica escrito, porque muda como isto deve ser lido:** a métrica de
cobertura **não pega** o caso `a12d737d`. Alucinação por **apêndice** contém o
previsto inteiro → cobertura 1,0; nenhum limiar de sobreposição pega isso. Quem pega
é só o filtro (b), que é **lista fechada** — apêndice com frase fora da lista continua
passando. Há teste no repo (`test_cobertura_NAO_pega_append_isto_esta_documentado`)
cravando a limitação em vez de deixá-la implícita. **O PR #78 reduz a classe, não a
fecha.** Risco de falso positivo que eu não escondo: "música" é palavra portuguesa
comum; se a borda divergir, o filtro pode cortar uma palavra legítima.

## Em que passo travou

**Decisão do Johnny**, em três itens, todos mandados no Telegram (msg 519):

1. **Migrations 96 e 97 não aplicadas.** Conferido no banco **agora**, não no commit:
   `information_schema` não tem `reference_cura_ramo/_texto_antes/_erro` (96) nem
   `trainer_returncode/_stderr/_stdout` (97), nem em `training_jobs` nem em `voices`
   — **zero linhas**. `finalize-training.ts` grava dentro de try/catch e cai em
   `voice.train.transcript_cura_nao_persistida`. Não existe tabela de log no banco
   (só `payment_events` e `runpod_spend_log`). Consequência medida: **não existe hoje
   forma de perguntar "esta voz teve o transcript curado ou a cura caiu calada?" de
   voz nenhuma** — tive que descobrir transcrevendo áudio à mão, R$0,02 por vez, que
   é exatamente o que a 96 existe para evitar. O #11 está parado no mesmo muro há
   37 dias. É a **mesma decisão**.
2. **Merge do PR #78.**
3. **O veto de 25/08** (*"só vou mexer nisto se as pessoas reclamarem"*) × 4 pagantes
   com defeito medido e **nenhum** reclamando.

## O que eu NÃO fiz, e por quê

- **Não curei em massa nem curei o `a12d737d`.** O veto do Johnny é explícito e
  recente **neste** chamado. O `inst.reinbio` não reclamou. Curar seria mexer no som
  de um pagante sem ele pedir, contra ordem escrita — e o precedente do Kessuly
  (93 vozes, *"muito pior"*) é exatamente esse erro. Escalado com recomendação
  objetiva em vez de decidido por mim.
- **Não mergeei** o PR #78 (aval, como os outros 22). **Não apliquei migration.**
  **Não mexi em crédito. Não gastei GPU.**
- **Não escrevi para aluno:** nenhum dos 4 pagantes desta medição abriu chamado, e
  escrever "achamos um defeito que você não notou" antes de o Johnny decidir a
  compensação cria expectativa que eu não posso cumprir.
- **Não postei no grupo:** regra 7 pede fato consumado (incidente fechado, fix em
  produção, aluno respondido). Não tive nenhum dos três. PR aberto é progresso
  parcial — não vai pro grupo.

## Estado da fila

15 incidentes não fechados: 7 `investigating`, 8 `aguardando_aluno`. Conferi os
`aguardando_aluno` um a um: **todos têm e-mail substantivo enviado e datado** —
Katia (25/08 22:55Z), Leonardo (24/08 21:35Z), Giovanna, Luciano (27/08 22:43Z),
Telma (27/08 22:49Z), Vinicius (27/08 23:50Z). **Ninguém no silêncio.** Bola com o
aluno, item fora do meu colo (regra 8).

## Recado de processo (não vira chamado — ordem de 27/08)

**23 PRs abertos** esperando aval, o mais velho de **18/08**. Vários são conserto de
defeito já diagnosticado. O gargalo desta operação hoje **não é achar o defeito**.
