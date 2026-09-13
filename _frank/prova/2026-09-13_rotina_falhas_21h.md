# Ronda das falhas — 13/09/2026, ~21hZ (18h BRT)

Executor (14-A): eu investigo, decido, conserto e fecho. Repo em `main`,
`pull --ff-only` limpo. `_frank/ordens/README.md` lido, mais as ordens de
**27/08** (só erro de sistema vira chamado), **29/08** (planilha desligada) e
**31/08** (canal = grupo). **Nada da planilha foi lido, escrito, classificado ou
reprocessado.**

**Item serial: `#380` / `d392f1d4`** — aluno de Portugal com a voz clonada
"saindo com sotaque do Brasil". Diagnosticado, **aluno avisado**, conserto
escrito e testado (**PR #264**) e **NÃO mergeado, de propósito**.
Fila: **80 → 81** (o `#380` é o item novo).

---

## 1. Como escolhi

Peguei o `#380` porque ele chegou às **20:52:48Z**, tinha **13 minutos de vida** e
o aluno estava esperando **dentro do app**, onde ninguém responde. A regra manda
aluno esperando antes de limpeza de fila.

Os dois itens mais velhos com aluno afetado **não tinham como andar nesta ronda**
e eu conferi isso em vez de supor:

| item | por que não |
|---|---|
| `#101` / `b2651a6f` | a condição de fechamento escrita na ronda das 20hZ é *aplicar a migration 108*. Migration sem aval não é minha alçada, e a pergunta já foi feita. Nenhum fato novo ⟹ pegá-lo de novo era girar em falso |
| `#249` + as 8 fichas de bounce | travadas numa palavra desde as 19hZ: aval pra usar telefone. O canal já foi achado; o que falta é autorização |

---

## 2. O que era — e não era a voz do aluno

O Ricardo (`ricardo@inventivebox.pt`, pagante novo, conta criada hoje) relatou
que a voz *"Minha Voz"* foi treinada em português de Portugal mas a geração
saía com sotaque do Brasil.

**A queixa é legítima e a culpa é nossa — mas não do treino dele.** Quando um
treino termina, a casa gera uma amostra automática, e essa amostra faz a voz
recém-clonada ler um **texto fixo**. O texto é brasileiro marcado:

> *"Oi! Esta é a minha voz clonada. Se você está me ouvindo com clareza, o
> treinamento funcionou muito bem."*

O modelo **pronuncia o que lê**. Texto brasileiro sai com fonética brasileira,
mesmo por cima de uma LoRA treinada com locutor português.

### 2.1 A medição, com controle positivo

Eu não ouço. Deleguei a escuta **às cegas** (sem dizer que hipótese eu tinha) e
pus um **controle positivo** junto: a gravação original dele, que *tinha* de ser
classificada como europeia.

| áudio | veredito |
|---|---|
| referência dele — gravação real, 21,7s | português **EUROPEU** ← o controle, e ele se comportou |
| **amostra da casa** — 13:51Z, 7,0s | **BRASILEIRA** |
| geração dele — 20:53Z, texto dele, 41,7s | português **EUROPEU** |

O clone está **certo**. O texto dele (*"Equipa Soares"*, *"está a pensar
comprar"*, *"ajudamos-te"*) sai em PT-PT com o timbre dele.

### 2.2 A cronologia que explica tudo

Ele abriu o chamado às **20:52:48Z**. A geração própria dele ficou pronta às
**20:53:06Z** — **18 segundos depois**. Até aquele instante, a **única** coisa
que existia na conta dele era a nossa amostra. Ele julgou a voz pelo único
exemplo que tinha, e o exemplo era nosso.

### 2.3 A afirmação forte que eu refutei antes de publicar

A escuta afirmou, junto com o veredito de sotaque, que a amostra **"é outra
pessoa"**. Se fosse verdade seria muito pior que sotaque — é a classe do
Marcelo (`retirar_amostra.cjs`), locutor trocado no histórico do aluno.

**Não publiquei. Medi.** F0 por autocorrelação nos três:

| áudio | F0 mediana | ≥165Hz (faixa feminina) |
|---|---|---|
| referência | 101,3 Hz | 0,0% |
| amostra | 103,2 Hz | 0,0% |
| geração | 97,0 Hz | 1,3% |

Mesma faixa vocal, sem nenhum sinal de locutor trocado. F0 igual **não prova**
identidade — mas **refuta** a afirmação forte, que era o que estava em jogo.
Registro a lição: **da escuta eu aceito a percepção (sotaque, com controle);
a alegação de IDENTIDADE eu não aceito sem medir.** Publicar aquilo teria aberto
um chamado grave falso — a irmã exata do `ler_caixa` das 20hZ.

---

## 3. A causa no código, e por que é a mesma classe do caso Joana

`runpod-worker/sample_gen.py`, `SAMPLE_TEXTS["pt"]`.

Em **21/07** o caso Joana (voz espanhola recebendo amostra em português) foi
consertado criando `sample_text_for(language)`. Aquele conserto resolveu o
**IDIOMA**. Ninguém olhou a **VARIANTE**.

```python
key = (language or "pt").lower().split("-")[0]
```

O `split("-")[0]` descarta a região **de propósito** — e está certo: o whisper
do treino devolve `"pt"`, **nunca** `"pt-PT"`. Criar uma chave `"pt-PT"` seria
**código morto com cara de conserto**: nunca seria consultada, e a próxima ronda
leria o dicionário e concluiria que o caso estava tratado.

A cura certa é o texto de `"pt"` ser **neutro**.

---

## 4. O conserto (commit `8c19f5a`, PR #264)

    antes: "Oi! Esta é a minha voz clonada. Se você está me ouvindo com clareza,
            o treinamento funcionou muito bem."
    agora: "Olá. Esta é a minha voz clonada. Se o som está claro e natural,
            o resultado final vai soar assim."

Sem `Oi`/`você`/`tu`, sem gerúndio progressivo (`está ouvindo` × `está a ouvir`)
e sem `treinamento`/`treino`. **Terceira pessoa mata os três de uma vez.**

Natural nas **duas** variantes — os **1.113** brasileiros (de 1.114 vozes `pt`)
não perdem nada. Neutralidade aqui não é concessão à minoria: é texto que serve
aos dois.

**3 testes novos, e os três ficam VERMELHOS com o texto antigo** — conferido
repondo o texto velho, não presumido:

- `test_amostra_pt_e_neutra` — proíbe as marcas de variante, o par BR **e** o PT;
- `test_variante_nao_muda_a_amostra` — prende o contrato do `split("-")[0]`;
- `test_o_backend_anuncia_o_MESMO_texto_que_o_worker_fala` — o comentário do
  `.ts` já mandava *"TEM que bater"* e **nada cobrava**. Divergir não muda o
  áudio: faz a **legenda** do histórico mentir sobre ele, que é pior.

Os testes carregam o `sample_gen` **real** do disco via `importlib`: o smoke
registra um **stub** de `sample_gen` em `sys.modules`, e um `import sample_gen`
ingênuo passaria verde **sem nunca ter olhado o texto de produção** — verde de
mentira, armadilha já conhecida desta casa.

### 4.1 Erros meus que a verificação pegou

1. **Eu appendei a classe de teste DEPOIS do `if __name__ == "__main__"`.** Ela
   nunca rodaria. Só apareceu porque eu **executei** em vez de confiar no
   arquivo escrito. Teste que não roda é pior que teste ausente: conta como
   cobertura.
2. **Quase reportei um bug de e-mail que não existe.** No autoenvio de conferência,
   `&ldquo;`/`&mdash;` apareceram **literais**. Fui ao código antes de acusar: o
   `enviar_email.cjs` manda `text/html` puro, sem parte `text/plain` — quem não
   decodifica entidade é o **tag-stripper do `ler_caixa`**, na exibição. Cliente
   de e-mail renderiza certo. **Instrumento, não defeito** — a mesma forma do
   `head -200` das 20hZ. Troquei por caractere literal mesmo assim, porque é de
   graça e mais robusto, mas **não é conserto de bug e não vira chamado.**

### 4.2 Conferências antes de mexer

- Os **dois filtros** que excluem a amostra do Vídeo Clone casam pelo **PATH**
  (`/sample.wav`), **não** pelo texto — li os dois antes de trocar a string.
  Se casassem pelo texto, esta mudança teria quebrado a trava que protege
  **85 clones de 65 alunos**. Não regridem. Os comentários deles citavam a frase
  velha e foram atualizados.
- **Suíte medida nos DOIS lados** (a armadilha registrada em 18hZ):

| | `main` limpa | branch |
|---|---|---|
| worker (`test_train_smoke.py`) | 41 | **44/44** (41 + 3 novos) |
| frontend (`node --test`) | 810 · 806 pass · **1 fail** · 3 skip | **idêntico** |
| `tsc --noEmit` | — | só o erro conhecido |

A 1 falha (`resgate-audio.test.ts`) é **pré-existente** e é a mesma coisa do
único erro de `tsc`: o arquivo importa `vitest`, que **não existe neste repo**.
⚠️ Nota de instrumento: o frontend **não usa vitest** — os testes são `node:test`
e rodam com `node --test "src/lib/**/*.test.ts"`. `npx vitest` baixa um vitest de
fora, não acha suíte nenhuma e **devolve verde vazio**.

---

## 5. ❌ Por que o `#380` NÃO fecha

Push em `runpod-worker/**` dispara o build da imagem **e recicla a frota do
RunPod em produção** (`workersMax` 0→N nos **dois** endpoints, VOX A e VOX B).

**Medido no instante de decidir, não estimado:** **1 geração EM VOO com 51 s de
vida** e **11 na última hora** (domingo, 18h BRT — a casa está em uso).

Derrubar o job de um pagante para trocar uma frase é troca ruim. O defeito
**não sangra**: não é dinheiro, não é perda de dado, não é indisponibilidade, e
é raro (**3** vozes com marcas europeias em 1.114). O aluno **já está atendido**
e instruído a não retreinar.

**Condição de fechamento, escrita pra não virar card eterno:** janela sem
geração em voo **ou** o "pode" do Johnny → merge → deploy conferido → e só então
`fixed`. **Não fecho por "código escrito".** Foi ao grupo como pergunta.

---

## 6. O aluno

E-mail enviado **21:13Z**, cópia **confirmada** em Enviados (**uid 2123**),
escrito em **português europeu**. Diz o que aconteceu, mostra que o clone está
certo, e pede **explicitamente que ele NÃO retreine** — retreino custaria crédito
e não mudaria nada.

Antes de mandar, **mandei pra mim mesmo e li** (regra do `README` das
ferramentas). Foi esse passo que pegou o §4.1.2.

**Crédito: nada a devolver**, conferido no extrato e não suposto — o treino dele
**não foi cobrado** (não existe linha de débito de treino; o extrato começa no
grant de 20:42Z) e a amostra é gratuita. O único débito de áudio é a geração de
20:53Z, **que saiu correta**.

---

## 7. Placar honesto

- **Incidentes fechados: 0.** Fila **80 → 81** (entrou o `#380`, que é o item que
  eu peguei). Forçar `fixed` seria a regra 14 quebrada.
- **Código em produção: 0.** PR #264 aberto e **explicitamente marcado
  NÃO-MERGEAR** — "mergeado" não é "em produção", e aqui nem mergeado está.
- **Alunos escritos: 1** (Ricardo, com cópia confirmada).
- **Afirmação forte refutada antes de publicar: 1** (o "é outra pessoa").
- **Erros meus pegos pela própria verificação: 2** (§4.1).
- Crédito de aluno: **0**. GPU: **0**. Migration aplicada: **0**.
- Janela (`> 20:11:28Z`): **23 entregas, ZERO falha** — `generations` 12,
  `image_generations` 6, `voices` 3, `video_clones` 2. **1 incidente novo** (o
  `#380`), **0 classes fechadas voltando a disparar**.

**O que emperrou, na cara limpa:** o conserto está escrito, testado e parado.
Ele depende de uma janela de frota vazia que eu não controlo, e eu escolhi a
espera em vez de arriscar o job de outro pagante. Escolha minha, registrada.

**O que eu NÃO fiz:** não mergeei, não reciclei frota de produção, não apliquei
migration, não fechei incidente sem resolver, não publiquei a acusação de
locutor trocado sem medir, não abri chamado contra ferramenta sem ler o código
(§4.1.2), não confiei em suíte de um lado só, não toquei em crédito/acesso/
assinatura, não gastei GPU, não li a caixa do `suporte@` pra triagem, não toquei
nos branches STALE e não inventei causa pra parecer produtivo.

---

## 8. Achado de lado — **nenhum CI roda a suíte python do worker**

Não está no `runpod-worker.yml`, não está no `Dockerfile`, não está em workflow
nenhum. O `test_train_smoke.py` — que abre dizendo que existe pra prender
*"REGRAS DE NEGOCIO que ja custaram incidente"* — **só roda quando alguém digita
o comando do docstring**. Os 3 testes que acabei de escrever têm o mesmo destino.

Não consertei nesta ronda (não é o item serial) e **não abri chamado**: é
processo/infra, não erro de sistema em produção (ordem de 27/08 §2). Fica
registrado aqui e no `#380`. **Vale card próprio.**

---

## 9. Passo fixo de fim de ronda

Conferido ao fechar — ver seção final do commit desta ronda.
