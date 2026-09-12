# Ronda das falhas — 12/09/2026, 23hZ

Dono da fila: Frank (regra 14-A). Método serial (regra 8, ordem de 21/08).
Canal: ordem de 31/08 — FastCloner sai **no grupo**, e só no grupo.

**Item serial desta ronda:** `#47` / `ce6e157d` (Katia) e a classe dele,
`f8587cef` (#234 — palavra decapitada). Escolhidos pela regra: o mais antigo
com aluno afetado. `#47` é de 19/08, tem aluna que voltou a reclamar em 09/09,
e é o **caso-índice** da classe que afeta mais gente.

**Não fechei nenhum dos dois, de propósito.** O que esta ronda entrega é
medição e duas retratações — uma delas da minha própria nota.

---

## 1. O que eu fui fazer, e o que achei no caminho

`f8587cef` estava **`investigating` com `resolution_note` NULA desde 02/09**.
Pela regra da ronda, investigating sem nota é o mesmo que não ter olhado — e
esse cartão carrega 609 ocorrências e 237 alunos. Era a maior dívida silenciosa
da fila.

## 2. O #234 está VIVO, e piorando

Telemetria do próprio worker (`tail_interno_entregue*`), filtrada por
`status='ready'` como o contrato em `registrar_tail_interno` manda. Janela
03/09→12/09 (desde que a sombra existe):

| medida | valor |
|---|---|
| fronteiras de chunk **entregues** com veredito | 3.111 |
| decapitadas | **407 = 13,1%** |
| gerações com ≥1 fronteira decepada | **195 de 464 = 42,0%** |
| alunos atingidos | **90 de 155 medidos = 58%** |
| pior dia da série | **12/09 (hoje): 94/394 = 23,9%** |

Em 03/09 era 9,5%. **Não há tendência de queda.**

## 3. O gate funciona, mas não cura — experimento natural, custo zero

Não baixei nada novo e não gastei GPU: reclassifiquei o
`_frank/prova/cauda_decepada.jsonl` (4.345 gerações já gravadas). A fronteira
**final** do arquivo sempre teve o gate de fim abrupto **ativo** (peso 100); as
**internas** nunca foram julgadas. Mesma régua, mesmos arquivos:

| fronteira | gate | ruins |
|---|---|---|
| final do arquivo | **ATIVO** | 374/4.345 = **8,6%** |
| internas | nenhum | 1.398/10.940 = **12,8%** |

O gate derruba **cerca de um terço** do defeito e **não o elimina**. A razão
está no próprio `run_chunk_qa`: esgotadas as tentativas ele entrega a **melhor**
tentativa, não uma boa — quando todas saem cortadas, sai cortado assim mesmo.

**Limite honesto:** as "internas" do JSONL são fins de **frase**, e nem toda
fronteira de frase é emenda de chunk. A comparação é **direcional**. O número
exato, medido no ponto certo pela régua certa, são os **13,1%** da seção 2.

## 4. A decisão que não é minha

`TTS_TAIL_QA_INTERNO_MODO=reprovando` **não precisa de deploy** — era esse o
plano escrito no código: medir em produção, depois virar a chave. A medição
está feita. **Não virei a chave**: ela multiplica regen (846 tentativas em
sombra em 9 dias ≈ **94 regens extras/dia**) e a regra da ronda é não gastar
GPU sem aval. Levado ao grupo.

## 5. Katia (#47): não é o #234 — e eu errei no meio do caminho

O áudio da queixa é `b6df1a7e` (09/09 18:26:54Z, **9 min antes** do e-mail dela).
Régua de envelope, com `--ensaio` aprovado nos 3 casos de referência **antes**
de eu acreditar em qualquer número: 7,5s, **uma** fronteira, e ela está
**limpa** (release 190ms, platô −51,5 dB). `tail_flagged=0`. Não há decapitação
neste arquivo.

**Meu erro.** Li `faltantes_amostra` = `["para","vinda","vinda"]` e escrevi na
nota que eram palavras **nunca geradas**. Fui conferir o Enviados antes de
mandar e-mail e achei a prova de que eu estava errado — de menos de uma hora
antes: **uid 2040 (22:53:31Z)** chegou à mesma conclusão que eu, e **uid 2041
(22:55:40Z)** a **retratou** com transcrição palavra a palavra: as palavras não
sumiram, foram **trocadas** — "Bem-**vinda**" saiu "Bem-**vindo**" nas duas
vezes. Retratei a minha nota no cartão.

**A lição vale mais que o caso:** `coverage`/`faltantes_*` **confundem omissão
com substituição** — a cobertura diffa transcrição contra texto escrito, e
palavra trocada aparece como palavra faltando. Dois agentes caíram nisso
independentemente no mesmo dia. Não é desatenção: é a métrica que não separa.

**O que sobrevive, e fica mais forte:** `rate_global_wps=4,48` com
`rate_global_fator=0,85` → 4,48 × 0,85 = **3,81 pal/s**, que bate com os 3,79
medidos no arquivo entregue. A fala natural dela é **2,97**. Mesmo **depois** do
esticamento o áudio saiu **~28% mais rápido** que ela: o `atempo` bateu no teto
(`max_stretch`) e não teve como chegar na régua. O gate de ritmo **desiste em
silêncio** e entrega assim mesmo. Isso é defeito de produto e explica a
"entonação estranha" que ela relata.

## 6. Não escrevi pra ela — e isso é decisão, não omissão

Ela recebeu **dois** e-mails hoje com 2 minutos de diferença, o segundo
corrigindo o primeiro. Um terceiro meu na mesma noite, repetindo o erro **já
retratado**, seria dano e não atendimento. Ela já tem os 400 créditos de volta
(saldo 176.820), já tem a verdade sobre o 15/09 e já tem convite aberto pra
pedir o refazimento por conta da casa. A bola está com ela.

## 7. O que eu NÃO fiz

- Não virei chave de produção, não gastei GPU, não toquei em crédito, acesso,
  voz, assinatura nem migration.
- Não marquei nada como `fixed`: nada foi resolvido nesta ronda (regra 14).
- Nada da planilha (ordem de 29/08).

## 8. Dívida nomeada que sai desta ronda

1. **#234 vivo**: 13,1% na entrega, 58% dos alunos medidos, subindo. Chave
   esperando aval.
2. Causa raiz do #234 **sem conserto**: o gate só reamostra; o modelo continua
   gerando a sílaba cortada.
3. **Teto do esticamento** entrega áudio fora da régua do aluno **sem sinalizar**.
4. **`faltantes_*`/`coverage` não separam troca de omissão** — arma diagnóstico
   errado, já comprovadamente duas vezes.

## 9. Segue em aberto (herdado)

`#313` (decisão comercial, **5ª cobrança**), `6c38c99d` (Luciano, 20 dias,
cobrança 19/09), `#312` (vence 15/09), `#335` (face-gate de pé). Fila:
78 `investigating`.

---

## Fechamento

Ronda sem cartão fechado. O que ela produziu: a maior dívida silenciosa da fila
(`f8587cef`, nota nula há 10 dias) virou número — o defeito está vivo, atinge
58% dos alunos medidos e hoje foi o pior dia da série. E o caso da Katia parou
de ser perseguido pela causa errada.

Duas retratações, uma delas minha, no mesmo cartão. Preferi gravar as duas a
deixar a nota bonita: foi conferir o Enviados **antes** de escrever pra aluna
que me impediu de mandar a ela, pela terceira vez hoje, uma conclusão errada.
