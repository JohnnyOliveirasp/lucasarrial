# Ronda das falhas — 08/09/2026, ~17h50–18h10Z (Frank, dono da fila)

Repo sincronizado (`main`, `pull --ff-only`) e `_frank/ordens/README.md` lido
antes de tocar em qualquer coisa. Nada da planilha foi lido, classificado,
aberto ou reaberto (ordem de 29/08). Canal: **grupo** (ordem de 31/08), com os
dois fatos consumados postados lá e nada no privado.

**Card levado adiante:** `#47` (`ce6e157d`, Katia) — e, junto com ele, o `#234`
(`f8587cef`), que é o defeito de sistema por trás dele.
**Estado no fim:** `#47` segue `aguardando_aluno` (é o estado certo: a bola está
com ela), `#234` segue `investigating`. **Aluna escrita** (cópia confirmada em
Enviados, uid 1336). Notas 29 (`#234`) e 55 (`#47`) gravadas e conferidas na
releitura. Zero GPU, zero crédito, zero migration. Custo: ~R$0,06 de whisper.

---

## 0. A ronda em uma linha

**A conclusão-manchete da ronda das 17h está errada: ela declarou a régua
"refutada contra verdade de campo" ancorando num áudio que a aluna nunca ouviu,
porque o arquivo foi criado 10 minutos DEPOIS da reclamação dela. No arquivo
certo, a régua acerta.**

---

## 1. Por que o `#47`, e não outro

A ordem manda aluno esperando antes de limpeza de fila, e a ronda das 17h
deixou uma dívida escrita com dono e prazo (item 9, nota 54): ler a thread
inteira da Katia e então escrever, porque ela espera há 20 dias. Era o único
passo livre e com gente sofrendo. Peguei esse.

Li a thread inteira antes de qualquer coisa (`ler_caixa.cjs --enviados --para`
e `--de`), como a nota 54 mandava, justamente para não repetir o `#259`.

---

## 2. A refutação da ronda das 17h caiu — ela ancorou na geração errada

A ronda das 17h concluiu (seção 5) que a régua `release_ms <= 35 && plato_db >
-40` "não mede decapitação", porque marcava **zero** fronteiras na geração
`1498fbe5`, tomada como o caso confirmado pela Katia. E daí tirou a instrução
mais forte do log: *"qualquer achado novo em cima dela nasce inválido"*.

**Prova documental de que `1498fbe5` não é o caso dela** (linha do tempo em UTC,
tudo conferido na caixa e no banco):

| quando | o quê |
|---|---|
| 02/09 **15:34:12Z** | Katia, uid 422: *"o primeiro áudio é o de 40 segundos ... está faltando o resto da palavra você"* |
| 02/09 **15:38:24Z** | Katia, uid 423: *"é no segundo 34 do primeiro vídeo. A palavra VOCÊ ... está cortada"* |
| 02/09 **15:48:30Z** | **a geração `1498fbe5` passa a existir** |

Ela reclamou **10 minutos antes de o arquivo existir**. Não podia estar falando
dele. A âncora da ronda das 17h é impossível, e isso não depende de nenhum
instrumento acústico — é data de criação contra data de e-mail.

**O arquivo que bate com a descrição é `81d4f3f4`** (39,823s = "o de 40
segundos", existe desde 25/08). Fronteira em **t = 34,494s** ("segundo 34"):
`release_ms = 10`, `plato_db = -27,9`. A régua exige `release <= 35` **e**
`plato > -40`: passa nas **duas**, com folga.

| geração | fronteira ~34s | release | plato | régua |
|---|---|---|---|---|
| `1498fbe5` (a que a ronda das 17h usou) | 33,781 | 120 ms | −48,6 dB | limpa |
| **`81d4f3f4` (a que a aluna ouviu)** | **34,494** | **10 ms** | **−27,9 dB** | **DECEPADA** |

**Corroboração independente, escrita antes desta análise:** o e-mail da casa de
04/09 12:49 mediu esse mesmo arquivo, pelo nome, e descreveu *"o som some de uma
vez, em um centésimo de segundo, com a sua voz ainda alta"*. Um centésimo de
segundo = 10 ms; voz ainda alta = platô alto. A descrição humana e os números da
régua batem no mesmo ponto, por caminhos diferentes.

**A régua não é cega ao único caso confirmado por gente. Ela acerta nele.** A
frase "qualquer achado novo em cima dela nasce inválido" está revogada e não
deve orientar a próxima ronda. O teste-âncora correto é `81d4f3f4` em t=34,494.

---

## 3. O que da ronda das 17h CONTINUA DE PÉ (não jogar fora junto)

As medições de **precisão** não dependem da âncora e seguem válidas:

- o limiar cai na **subida** da distribuição (release ≤15 → 3,4%; ≤35 → 13,1%;
  ≤45 → 20,8%), com quantização de 5 ms;
- toda a sensibilidade mora no `release_ms` (o de volume está saturado);
- as **335 fronteiras com `release_ms` NULL** seguem sendo mina (`null <= 35` é
  `true` em JS), hoje neutralizadas só pela segunda condição.

Ou seja: o número-manchete **"609 gerações / 14,3%" continua não servindo** para
dimensionar dano nem para priorizar aluno — mas por estar num ponto ruim da
curva, **não** por instrumento refutado. São coisas diferentes, e a distinção é
o que separa "calibrar o limiar" de "jogar a régua fora e começar do zero".

**O que eu NÃO provei:** não revalidei a régua globalmente. Escrevi um medidor
de envelope próprio (`_Bugs/2026-09-08_envelope_fronteira.cjs`) e ele mede
grandeza **diferente** da do `cauda_decepada.jsonl` — não confirma nem refuta o
dataset, e por isso **não foi usado como prova** aqui nem na nota. A prova é
documental (linha do tempo) mais o próprio dataset que a ronda das 17h usou.

---

## 4. O erro nosso que justificou escrever para a aluna

Não escrevi porque ela está esperando. Escrevi porque **nós a contradissemos**:

- **04/09 12:49** — recomendou `9d7908f6` ("VOCE fora da emenda") e avisou
  explicitamente para **não** usar `752b46ee` ("pausa natural"), porque deixa
  ela falando mais rápido que o normal dela.
- **05/09 11:32** — recomendou `752b46ee` ("pausa natural"), só pela nota do QA,
  contradizendo o aviso anterior **sem reconhecê-lo**.

Ela está em silêncio desde então. É bem possível que o silêncio seja isso: ela
não sabe em qual acreditar. Medi as três hoje, base `81d4f3f4` = **2,941 pal/s**
(o ritmo natural dela):

| arquivo | articulação | vs. ela | QA | fronteiras |
|---|---|---|---|---|
| `752b46ee` "pausa natural" | 3,261 pal/s | **+10,9%** | limpo (1,00) | limpas (rel 120–285 ms) |
| `9d7908f6` "VOCE fora da emenda" | 3,029 pal/s | **+3,0%** | limpo (0,986) | limpas (rel 85–170 ms) |

As duas estão limpas **nas emendas e no QA**, então o desempate é ritmo — e ele
aponta `9d7908f6`, que ainda por cima mantém as quebras de parágrafo dela.
**Recomendamos o pior dos dois em 05/09.** O aviso de 04/09 estava certo.

**Escrito para ela** (individual, sobre caso que estou tratando = decisão minha,
regra 8 de 21/08): corrigi a contradição, indiquei `9d7908f6` como a única
válida, confirmei que ela acertou o ponto do corte de ouvido, disse que o
defeito do sistema segue aberto e que **não tenho data**, e **não pedi que ela
refizesse nada nem condicionei nada**. Cópia confirmada em Enviados, uid 1336.

Não cobrei resposta: 3 dias não aciona a regra dos 7 dias, e cobrar de novo
repetiria exatamente o dano do `#259`.

---

## 5. Aluna pagante com o relógio correndo — decisão do Johnny

Conferido no `pagou_de_verdade.cjs`: **pagou de verdade**, 315,90 GBP no total
(Fábrica 45,90 + Comunidade 270) mais a assinatura FastCloner (0 GBP em 15/08 e
18 GBP em 22/08, ambas COMPLETE). 178.665 créditos, **acesso até 15/09** — 7
dias. Praticamente um mês sem conseguir produzir, por defeito nosso que segue
aberto.

Postado no grupo **como urgente**, na hora, conforme a ordem. **Não prometi nada
a ela** sobre prazo, acesso ou compensação: não é decisão minha. Só disse que o
caso foi levado a quem decide e que não vai depender dela cobrar.

---

## 6. Achado de higiene: o log da ronda das 15h nunca foi commitado

`_frank/prova/2026-09-08_rotina_falhas_15h.md` estava **untracked** — 210 linhas,
documentando merges reais (PR #176 / `c1db335` e PR #213 / `2adb080`), invisível
para todo mundo, inclusive para as rondas seguintes. É a mesma classe de falha
que a ordem descreve para registro preso em branch `feat/`, só que pior: nunca
entrou no índice. **Recuperado neste commit.**

---

## 7. Falha de canal registrada (não reproduzida)

A **primeira** chamada do `notify-grupo.sh` falhou com resposta **vazia** do
Telegram. Não reproduzi: a mesma mensagem, partida em duas e reenviada, passou;
mensagem curta com `%` também passou; conectividade com a API estava boa
(HTTP 302, 0,49s). Fica registrado porque o canal é obrigatório.

O importante é que **o script se comportou certo**: gritou e saiu != 0 em vez de
deixar o silêncio parecer sucesso. Não abri incidente por ser transitório e não
reproduzível, mas se voltar, o caminho é `-d` do curl (que não faz
URL-encode) contra `--data-urlencode`.

---

## 8. O que NÃO está feito

1. **O `#234` continua aberto.** Esta ronda não achou a causa: ela devolveu ao
   time um instrumento que a ronda anterior tinha descartado por engano. Isso é
   destravar a busca, não concluí-la.
2. **A régua não foi recalibrada.** O limiar segue no pior lugar da curva e as
   335 NULLs seguem sem guarda de tipo.
3. **`#15`, `#222`, `#226` e `#290`** seguem travados pelos motivos já
   registrados nas rondas anteriores; não os toquei.
4. **A Katia não respondeu ainda** — e agora a bola está com ela, com a
   indicação correta na mão pela primeira vez.

---

## 9. Higiene de fim de ronda

- Nenhum código de produção mudou. Nada a mandar por PR.
- Este log e o log recuperado das 15h vão **direto na `main`**, como manda a
  ordem.
- Nada de crédito, GPU, whisper além da medição (~R$0,06), migration,
  assinatura cancelada ou e-mail em massa.
- Scripts de uso único ficaram fora do git, em `_Bugs/`:
  `2026-09-08_kt_gens.cjs`, `2026-09-08_kt_qa.cjs`,
  `2026-09-08_kt_fronteiras.cjs`, `2026-09-08_kt_ancora_certa.cjs`,
  `2026-09-08_envelope_fronteira.cjs`, `2026-09-08_ids.cjs`.
