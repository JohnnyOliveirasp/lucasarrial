# Ronda das falhas — 06/09, ~17h50Z (14h50 BRT)

Frank, **dono da fila** (regra 14-A). Método serial da ordem de 21/08: peguei
**um** incidente e levei até onde ele vai.

Repo sincronizado (`main`, `pull --ff-only`) e índice de ordens lido antes de
tocar em qualquer coisa. Nada da planilha foi lido, classificado, aberto ou
reaberto (ordem de 29/08). Canal: ordem de 31/08 — o aviso saiu no **GRUPO**,
nada foi pro privado.

---

## 0. A ronda em uma linha

**Peguei o #251 porque ele estava há 2 dias sem dono com metade do plano
executada. Descobri que o aluno já estava bem desde 04/09 e ninguém tinha
registrado isso — e que o defeito que sobrou é de uma classe pior que
"spinner feio": o servidor apaga a exceção num `catch` mudo e o cliente apaga
a resposta num `.catch(() => {})`, então este incidente é INSOLÚVEL POR
DESENHO. Não dá pra saber a causa dele nem de mais ninguém. Delegado o
instrumento antes do palpite.**

---

## 1. Por que peguei este

Fila no início: **23 incidentes abertos**, 13 `aguardando_aluno`, 3 presos.

A faixa mais antiga (#15, #222, #226, #234) segue parada em **decisão, não em
investigação**, e foi reconferida na ronda das 16h50Z — 50 minutos atrás. Não
refiz a medição delas: não havia dado novo e repetir seria queimar a ronda em
trabalho já feito.

O **#251** (04/09 17:55Z) era o mais antigo com **trabalho de investigação de
verdade por fazer**: 2 notas, a última de **04/09 18:24Z**. Dois dias parado.

O plano escrito nessa nota tinha dois passos. Fui conferir os dois em vez de
herdar, e eles tiveram destinos opostos:

| passo | estado real |
|---|---|
| (1) responder o aluno | ✅ **feito** em 04/09 18:27Z — e ninguém registrou |
| (2) o patch (log + estado de erro) | ❌ **nunca delegado**, 2 dias órfão |

## 2. O aluno está bem — e isso é achado, não formalidade

Conferido na fonte, não herdado:

- E-mail em **04/09 18:27:36Z** (Enviados **uid 1021**) dizendo que a
  transcrição é só prévia e que ele podia gerar.
- **Funcionou**: `aroldogg@gmail.com` gerou Vídeo Clone em **04/09 19:14**,
  `ready`, −8.085 créditos (Padrão 2.0, 77s). Acesso ativo até 09/09, 75.136
  créditos.

O lado humano do #251 estava fechado desde 04/09 e o card não sabia. Registrei.
É o inverso do erro da ronda passada (lá o aluno estava esquecido; aqui o
atendimento funcionou e o registro é que ficou para trás) — mas a causa é a
mesma: **ninguém fecha o laço no card depois de agir.**

## 3. O defeito que sobrou (conferido linha a linha na main de hoje)

- `clone-studio.tsx:174-192` — `.then(r => r.ok ? r.json() : null)` +
  `if (!j) return;` + `.catch(() => {})`. Toda falha vira `text = null` para
  sempre.
- `clone-pickers.tsx:253-263` — `selected.text ? <transcrição> : <Loader2 spin>`.
  **O spinner é a AUSÊNCIA de texto**, então falhar = girar para sempre. Não
  existe estado de erro nem timeout.
- `transcribe/route.ts` — termina em `catch { return serverError(...) }` **sem
  `console.error`**. O erro do Whisper/R2 é destruído no servidor.

### 3.1 Por que a causa segue desconhecida — e por que isso é o achado

Não afirmo Whisper, não afirmo R2, não afirmo chave. **Não há rastro nenhum**:
o servidor apaga a exceção e o cliente apaga a resposta. Enquanto o instrumento
não existir, este incidente não é investigável — por ninguém, nem hoje nem na
próxima ronda. Por isso o card pede **log antes de qualquer palpite de causa**.

### 3.2 Alcance: NÃO medido, e a impossibilidade é a própria denúncia

Quando trava aqui o job **nem nasce** (zero linhas em `video_clones` — conferido
no caso dele), e não há log no servidor. Então **não sei** quantos alunos
passaram por isso, e ninguém sabe. Não invento número. Depois do log entrar em
produção, isso vira contável.

## 4. Duas hipóteses minhas que eu mesmo derrubei

Registro porque as duas são armadilhas de instrumento e as duas quase viraram
"achado" no relatório.

**(a) "Áudio acima do teto cai no spinner eterno."** A rota devolve um 400
**útil** ("o áudio tem Xs — o máximo é 90s") e o cliente joga esse 400 fora.
Parecia crava­do. **Medi e me corrijo:** `clone-studio.tsx:153-159` já barra no
cliente antes de subir. Não é o caminho comum. O que sobra é mais estreito,
porém real e **antecipado pelo próprio código** (comentário da linha 173: *"a
duração do Whisper também é mais confiável que a do browser"*): quando browser
e servidor **discordam** da duração, o arquivo passa na guarda do cliente e toma
400 do servidor — e o aluno vê spinner em vez da frase que a rota escreveu pra
ele. Somam-se `durationSeconds <= 0` e o 500 real. **Os três desfechos têm o
mesmo sintoma na tela.**

**(b) "Os 9 pagantes do #283 não têm identidade de login."** Fui conferir se os
9 restituídos hoje (100.000 créditos cada, 06/09 13:45Z) conseguiam entrar.
`auth.admin.listUsers` devolveu `identities: []` para os 9 — leitura óbvia:
"não conseguem logar". **Rodei o controle antes de escrever isso em lugar
nenhum:** `providers=[]` para **2.275 de 2.275** usuários, incluindo alunos que
usam a plataforma todo dia (Aroldo, Kátia, Tânia). O campo não vem populado
nesta API — **carrega zero informação**. Descartei a linha inteira.

Antes disso a mesma armadilha já tinha me pegado com
`profiles.onboarding_ready_email_at` ("NUNCA" para os 9 → parecia abandono;
são 107 de 2.275 perfis no total, ou seja o campo não é o instrumento). A
caixa de Enviados mostrou que os 9 **foram** escritos, 2 a 4 vezes cada.

**Duas vezes na mesma ronda um campo nulo quase virou denúncia.** É a armadilha
do zero que o `medir_pausas_da_entrega.cjs` já tinha documentado, agora em
outra roupa: **antes de acusar por um campo vazio, rode o controle num caso que
você SABE que é sadio.** Se o campo também está vazio nele, o instrumento é
cego, não o sistema.

*Fica registrado como pendência de outra ronda, sem número:* 7 dos 9 do #283
constam sem login. Isso **não** está explicado — só não é explicado pelo que eu
achei que era. Não é abandono de atendimento (foram escritos) e não é bloqueio
de identidade (instrumento cego). Não afirmo mais nada.

## 5. O que eu fiz

- **#251 (`1dd204f5`)** — nota gravada (2 → 3 notas, 1 linha conferida na
  releitura) com: aluno OK desde 04/09, defeito vivo linha a linha, causa
  registrada como **não sabida**, alcance registrado como **não medível hoje**,
  e a hipótese (a) derrubada por mim mesmo. Segue `investigating` **de
  propósito** — deploy não é entrega, e aqui nem deploy existe ainda.
- **Card `b6bf62a1` delegado ao `coder`**: (1) `console.error` com o erro cru na
  rota — *o item mais importante*; (2) estado de erro no cliente lendo a
  mensagem que a rota já manda; (3) três estados na tela (transcrevendo /
  pronta / **falhou** + "tentar de novo").
  ⚠️ Passei explícito: **a transcrição é só prévia — o aluno TEM que continuar
  podendo gerar com ela falhada**, nenhuma trava nova no botão; e **não mexer**
  no teto de 90s nem na guarda do cliente. i18n nos 3 locales.
- **Confirmado que nenhum PR cobre isto**: 26 PRs abertos, o único que toca
  video-clone é o **#55** (`feat/trava-foto-frontal-clone`), sobre rosto/foto.

## 6. O que eu NÃO fiz

Não virei chave de produção, não mergeei PR, não apliquei migration, não gastei
GPU, não toquei em crédito/acesso/plano, não reabri incidente, não fechei nada
como `fixed` sem conserto em produção, não escrevi pra aluno (o do #251 já
tinha sido respondido e resolvido) e não toquei em nada da planilha.

## 7. Precisa de DECISÃO do Johnny

Nada novo meu. Os vermelhos seguem os das rondas das 16h/16h50Z: **#226**
destrava o #234; **migration 82** destrava o #15; **#222** reenquadrar ou
fechar; **PR #196** (vítima viva, Tânia) e **PR #176** (desde 04/09) esperando
revisão. Os relógios continuam: **acalbamonte** vence 09/09, **Marcelo** 11/09,
**Diego** renova 08/09 12hZ.

## 8. Lição que fica

**Instrumento cego mente na direção mais convincente: ele acusa.** Campo nulo
não é prova de ausência — `onboarding_ready_email_at` vazio parecia "aluno
abandonado" e `identities: []` parecia "aluno sem login", e os dois eram só
campos que ninguém preenche. As duas leituras erradas apontavam para um
escândalo, nunca para "está tudo bem", porque é assim que a ausência de dado se
parece. **O controle num caso sadio é barato e desarma as duas em um minuto** —
e sem ele eu teria escrito no relatório do Johnny duas denúncias falsas hoje.

E a de fila: **agir e não fechar o laço no card produz o mesmo estrago que não
agir.** O #251 tinha metade do plano cumprida com sucesso desde 04/09; como
ninguém anotou, ele apareceu em duas rondas como "parado há 2 dias" e o passo
que realmente faltava — o patch — ficou órfão justamente porque o card parecia
inteiro de tão parado.
