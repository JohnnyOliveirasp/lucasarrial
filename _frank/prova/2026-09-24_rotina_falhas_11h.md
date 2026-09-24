# Ronda das falhas — 24/09 ~11hZ (Frank, dono da fila)

**Desfecho: ZERO incidente fechado. O que esta ronda entregou foi (a) a auditoria
do único fechado novo que voltou a disparar — auto-fechamento CONFIRMADO certo,
com o dinheiro conferido no banco e uma hipótese minha de bug REFUTADA pelo
dado; (b) o fechamento de uma pergunta que estava aberta há 7 dias no `#249`: a
rota de e-mail está provadamente esgotada para os 10 pagantes, medida um a um
por CPF; e (c) 1 defeito de código despachado ao `coder`.**

Gasto: **zero GPU, zero crédito de aluno movido, zero migration, zero merge,
zero código de produção tocado, zero e-mail enviado.** Escritas: 2 notas de
incidente, 1 card no Mission Board, este log.

Fila não baixou. É resposta legítima e está explicada item por item.

---

## 1. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta --corte=2026-09-14T14:06:31Z --confirmar` | **0** carta escriturável. **1176 = 1176**, nenhuma sumiu (1099 já com linha + 77 fora da janela). Subiu de 1161/1084: **15 cartas novas, todas já com linha**. |
| `enviados_x_tabela` (irmão de leitura, independente) | **VEREDITO: 0 carta depois do corte.** Buraco segue **passivo**. |
| `percepcao_travada.cjs` | **0** travados · mais velho **0d**. Controle positivo (#310) e negativo (#518) OK, 530 varridos. |
| `pagante_trancado.cjs` | **0** pagante trancado · 0 na fronteira · **1 sem prova** (`drfabiovilhena29@gmail.com`, sem subscriber code no payload) — o mesmo de ontem, sem fato novo |
| Censo da fila | **116** abertos (+1) · **68 com 7d+** · mais velho **55d** |
| `fechados_que_disparam` | 17 fechados com sinal de vida, **2 vivos nas 48h** — o `#523` já apurado e descartado, e **um novo, `#544`**, auditado neste item 2 |

---

## 2. `#544` / `8da87d52` — auditado e **mantido fechado**, com o dinheiro conferido

Auto-fechado às 03:30:44 em **0.000s depois do disparo**, `resolved_by: null` —
ninguém olhou. A armadilha catalogada manda conferir fechado que segue
disparando, então fui conferir. O auto-fechamento (chamado #183) estava **certo**
nos dois pontos que importam, e os dois foram medidos no banco, não lidos na nota.

### 2.1 Dinheiro: OK, 3 de 3

Três `react_job` de **-3975** (03:20:39, 03:21:07, 03:30:40), cada um com o seu
`react_refund` de **+3975** (03:20:41, 03:21:09, 03:30:43), casados por `ref_id`.

Conferido por **`ref_type='react_refund'`**. O `kind` desses estornos é
`extra_purchase` — é exatamente a armadilha que quase pagou em dobro para 13
alunos em 20/08. Quem filtrasse por `kind` leria "não estornado" nos três.

### 2.2 Causa: erro de input — e a hipótese contrária era **minha**

Levantei a hipótese de que o ramo `!audioKey` fundia dois casos e rotulava falha
NOSSA como culpa do aluno: `userInputError: true` silencia o suporte
(`alertSupport: false`), então uma falha de `trazerParaR2` sairia disfarçada de
"aluno pulou o passo da voz". **Refutada por duas medições independentes:**

1. `react_jobs.audio_url` está **NULO nos três** jobs — e `audio_url` é gravado
   no INSERT **antes** de qualquer download.
2. `trazerParaR2` (`lib/react/gerar.ts:93-106`) devolve a key ou **lança**;
   nunca devolve falso. Com o ternário curto-circuitando em `audioUrl` nulo, o
   ramo só é alcançável **sem áudio na requisição**. Falha de rede iria para o
   `catch`, não para ali.

Não houve falha nossa no caminho do arquivo. A classificação estava correta.

### 2.3 O aluno **não** está travado — a condição escrita na nota não se cumpriu

A própria nota de fechamento deixou a condicional: *"se ficar SEM NENHUMA VOZ
PRONTA, a próxima rajada nasce ABERTA"*. Fui conferir em vez de assumir.

Linha do tempo reconstruída: 03:13 gerou áudio (538 chars, débito `2608fb6d`)
que **hoje não existe mais** em `generations` — **débito órfão**, o padrão já
catalogado do DELETE do histórico, **não é bug**; 03:20–03:30 disparou React 3×
sem áudio selecionado; 03:32 gerou áudio novo (52,31s, `ready`); 04:19 outro
(53,04s, `ready`); **04:23 concluiu um Vídeo Clone Padrão 2.0 de 54s**. Ele
seguiu produzindo depois da rajada.

### 2.4 Não é classe

`react_jobs` tem **6 jobs na vida inteira** (3 `pronto`, 3 `erro`). Os 3 erros
são todos deste aluno, na mesma janela de 10 min. **1 aluno afetado.** A feature
mal começou a ser usada — o que também diz que o defeito abaixo é barato de
corrigir agora, antes de escalar.

### 2.5 Fica um defeito nosso, sem dano financeiro — despachado ao `coder`

`api/v1/react/gerar/route.ts` lê `audio_url` na linha **de cima** do `foto_url`
(~l.70), mas só o `foto_url` ganha guarda no bloco de validação (~l.91-94:
`"Falta a foto preparada."`). Sem áudio, o pedido percorre **insert → débito →
estorno → failure-alert → este chamado**, quando um `badRequest` de uma linha no
mesmo bloco resolveria **antes de cobrar**. Sintoma colateral: sem áudio o preço
ainda é estimado por palavras (`duracaoDeUrl` só roda se `audioUrl` existe) — ou
seja, cobra-se um valor estimado por um job que a rota já sabe que vai morrer.

Card **`aeffed0a`** no Mission Board, dono `coder`, com a instrução de **não
apagar** o ramo do estorno (ele é a rede) e entregar por branch + PR com base
main. **Não é incidente novo**: sem dano financeiro, 1 aluno, e a fila já está em
116 — inflar o censo com isso seria ruído.

---

## 3. Serial: `#249` / `132f7808` — a rota de e-mail está **esgotada**, agora medida

### 3.1 Por que este cartão

As cabeças da fila (`c726c5ae` 55d, `d3d8d1b2`, `b706b32e`, `702cc916`,
`8b8fc4c8`, `7ed72ad0`) seguem **em decisão do Johnny**; o `37bacb68` tem o
gargalo no `702cc916`; o `#234` foi o serial das 02hZ e o próprio passo (b') dele
manda esperar ~3 dias para o `n` crescer — repetir agora não decide nada.

Desci para o mais velho **acionável**, e havia nele uma pergunta ainda aberta.

### 3.2 O que foi medido

`2026-09-19_segundo_email_por_cpf.cjs --fichas` (só leitura — não manda carta,
não escreve no banco):

```
controle positivo OK — glaubermed@ig.com.br: nome resolvido, 15 transações
11 endereços de fichas de bounce abertas varridos
TEM 2º endereço (mesma pessoa por CPF): 0
SEM 2º endereço: 10
NÃO MEDIDO (sem nome na Hotmart): 1
```

A ferramenta **aborta** se o controle positivo falhar. Ela não abortou, então o
zero é **zero medido**, e não zero de busca quebrada — que é a mentira mais cara
que ela poderia contar.

### 3.3 Por que isto não é re-medição

Até hoje o *"e-mail não é rota"* valia **só para o Glauber** (apurado em 17/09
por um script de ocasião que morreu com o worktree). Para os outros nove era
**suposição**. Agora é medição, um a um, decidida por **documento**.

E os homônimos existem, aos montes: a Aline sozinha tem **35** endereços sob o
mesmo nome, o Renato **13**, o Glauber **5**. **Nenhum passou no CPF.** Isso é o
oposto de um resultado vazio — é a prova de que mandar a carta para o "endereço
parecido" teria entregado a conta de um pagante a um estranho em **qualquer um
dos 10** casos, e não só no `glauber.neurologia` já pego em 17/09.

### 3.4 Consequência para a decisão que está com o Johnny

O canal **pré-autorizado** (e-mail individual, regra 8) está **esgotado** para
esta classe. Não é que eu não tenha tentado: **não existe endereço para onde
mandar que seja provadamente da pessoa.** Sobra exatamente um canal —
WhatsApp/telefone — que é ação externa e precisa do "pode" do Johnny, pendente
desde 17/09 e escalado ao grupo em 20/09.

O bloqueio deste cartão deixou de ser "falta apurar". É **autorização**, e agora
com a alternativa eliminada por medição. São **10 pagantes**, o mais antigo há
**44 dias**.

**Não re-escalei** o pedido ao grupo: ele já foi, e a doutrina de 17/09 manda
**lote, não repetição**. O número novo entra no relatório desta ronda.

### 3.5 Limite declarado

1 dos 11 endereços ficou **NÃO MEDIDO** por não ter nome na Hotmart. Não afirmo
nada sobre ele: não é *"não tem segundo e-mail"*, é *"não consegui perguntar"*.
Se a autorização sair, é o único que ainda precisa de identificação antes de
qualquer contato.

E segue valendo o item 2 da nota de 20/09: a caixa do `horta.pericias@gmail.com`
está viva, mas **caixa viva não prova identidade**. Não mandei nada para lá.

---

## 4. O que precisa do Johnny

1. **Autorização de WhatsApp/telefone** para os 10 pagantes do `#249`
   (R$ 8.250,27, o mais antigo há 44 dias). Pendente desde 17/09. **Novidade
   desta ronda:** a alternativa por e-mail foi **eliminada por medição** (§3.2),
   então não há mais caminho que eu possa tomar sozinho.
2. **Crédito do Gemini** (`olho`, `pesquisa`, `social`) — já no lote. Segue
   pendente; é o operário que ouve/vê.
3. Segue de pé a retirada de 21/09 registrada na ronda das 02hZ: a decisão (c)
   do `#234` (`TTS_TAIL_QA_INTERNO_MODO=reprovando`) está na mesa **sem**
   recomendação minha.

---

## 5. Fim de ronda

- Log commitado na **main** (regra 25-B).
- **Nenhum código de produção tocado.** Nenhuma ferramenta nova criada nesta
  ronda — usei as que já existiam commitadas.
- Escritas conferidas na releitura: `#544` **1 linha afetada, 0 → 1 notas**,
  `resolution_note` **preservada** (415 chars, não sobrescrita) e status mantido
  `ignored`; `#249` **1 linha afetada, 11 → 12 notas**, status mantido
  `investigating`. Em nenhuma das duas passei `--status`, que dispararia a
  limpeza de reabertura.
- Notas passadas por `"$(cat arquivo)"` e relidas depois de gravar.
