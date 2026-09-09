# Rotina das falhas — ronda de 09/09, ~01h40–02h40Z

Método serial (regra 8, ordem de 21/08): peguei **um** item e levei até o fim.
Todo número abaixo foi medido nesta ronda, com o instrumento nomeado na linha.

---

## 1. Qual item eu peguei, e por quê

O mais antigo com aluno afetado é o **#15** (30/07, timeout de áudio) — e ele
está **travado esperando o Johnny**: depende da migration 82, parada há 40 dias.
Passo em que emperra: sem a coluna nova, o handler não consegue registrar em que
fase o chunk pendura. Não é falta de trabalho, é falta de decisão. Segui.

O próximo é o **#222** (01/09), *"5 alunos com acesso ativo presos fora da
própria conta"* — 5 alunos, 6ª volta de uma classe que nunca virou conserto.
Foi o que trabalhei.

## 2. O que eu achei, e é o oposto do que o card dizia

O card afirmava 5 presos. **Nenhum dos 5 está preso.** Isso já vinha sendo dito
por 3 rondas, sempre no varejo, conta por conta. O problema é que "conferi os 5"
nunca respondeu à pergunta que importa: *e os que ninguém nomeou?*

Por 8 rondas o card foi remedido em cima dos mesmos 5 nomes enquanto a causa
seguia intocada. Título refutado não é memória, é ruído.

## 3. O que mudou hoje: a classe ganhou instrumento

As 7 ocorrências (`#20`, `#27`, `#36`, `#195`, `#218`, `#222` e o Fernando de
08/09) foram **todas achadas por acidente**, por uma ronda que olhava outra
coisa. Construí o detector e ele virou ferramenta permanente:

`_frank/ferramentas/detector_preso_fora_da_conta.cjs` (só leitura; não vincula,
não credita).

Cruza pagante órfão de janela viva contra `profiles` por duas chaves:
**CPF** (atravessando o entitlement do mesmo CPF que já tem dono, porque
`profiles` **não tem** coluna de cpf) e **NOME**.

### 3.1 A chave de nome foi calibrada contra controle, não escolhida por gosto

Igualdade exata de string achava **3 de 6** casos reais de e-mail divergente já
vinculados — a pessoa **encurta o nome** ao criar a conta:

| nome na compra | nome na conta | exato | regra nova |
|---|---|---|---|
| Jesus Peres | Jesus Peres | ✅ | ✅ |
| Tiago André Marques Jacinto Violante | Tiago Violante | ❌ | ✅ |
| Nassara Borges Mesquita Oliveira | Nássara Mesquita | ❌ | ✅ |
| Marcio Fernandes | Marcio Fernandes | ✅ | ✅ |
| Fernanda Franzolin | Fernanda Franzolin | ✅ | ✅ |
| Moyses Filipe B. Martins | Equipe Qooqi | ❌ | ❌ (correto) |

Regra final: **primeiro nome igual E ≥1 outro token em comum** → 5 de 6, e o 6º
que ela recusa é legitimamente outra pessoa (conta de empresa).

**O controle positivo está DENTRO do script e ele ABORTA se zerar.** Um "ninguém
preso" vindo de instrumento cego foi exatamente o que produziu o *"pagante sem
acesso: zero"* de 07/09. O detector é obrigado a provar que sabe dizer SIM antes
de ter permissão de dizer NÃO.

### 3.2 O resultado

86 órfãos → 34 `active` → 26 janela viva → **18 pagantes** → **1 candidato**, e
ele **não está preso**: Carlos (`MY5O3KWB`), marcado `AMBIGUO` por casar com dois
perfis; a conta que ele usa está `pro`, 200.000 cr, acesso até 22/09 — mesma
janela do entitlement. O caso dele é cobrança em dobro e tem dono: **#254**.

**Zero alunos presos fora da própria conta hoje.**

Os outros 17 não são deste card: **14** são os produtos de CURSO (7283335/7283229),
que são a decisão comercial parada do **#313**, e **3** são pagantes de FastCloner
sem conta nenhuma — caminho do convite de compra órfã.

### 3.3 O limite do detector, medido e registrado

Entitlement sem `raw_event.purchase` cai fora **no filtro de valor**, antes de
qualquer chave de nome. São **83 linhas, todas `canceled` hoje** — nenhuma
esconde aluno com janela viva. Mas foi essa a forma do 7º caso (Fernando,
`KG6OG420`, `raw_event` sem `buyer` e sem `purchase`): **o detector não teria
achado o Fernando.** Quem for mexer, comece por aqui.

## 4. O aluno da ronda — e ele apareceu porque eu conferi em vez de acreditar

O cabeçalho do `orphan-ciclo.ts` afirma que *"os quatro primeiros foram escritos
À MÃO em 08/09"*. Fui à pasta de Enviados conferir um por um. **A afirmação é
3/4 verdadeira.**

- `josephgois` — uid 1310, 08/09 12:48Z, carta corrigida ✅
- `scandovieri41` — uid 1311, 08/09 12:48Z, carta corrigida ✅
- **`isaias.enf@gmail.com` — não recebeu.** A única carta dele é a de 03/09
  (uid 493): justamente a que manda **esperar** resposta do suporte.

Ele esperou 6 dias por uma resposta de que não precisava. E **nenhum painel
acusaria**: o registro dele no `orphan_invites` está idêntico ao dos outros dois
(`first` 04/08, `reminder` 07/08, `cicloEm` 18/08), ou seja o estado diz
"atendido" e o aluno estava mudo.

**O tamanho do caso** (`pagou_de_verdade`, Hotmart viva): **R$ 1.442,96** —
assinatura FastCloner R$97 em 18/07 e 18/08, mais 4 avulsas de 18/07 (Fábrica de
Conteúdo Invisível 297; Sistema de Geração Pronto 497 e 532,08; Gerador de
Ganchos 116,88). `aluno.cjs`: **nenhuma conta**. Próxima cobrança **18/09**.

**O que fiz:** mandei a mesma carta corrigida que Joseph e Eduardo receberam, com
as datas dele, dizendo que não precisa esperar por mim e que "esqueci minha
senha" não funciona porque a conta ainda não existe. Acrescentei um parágrafo
sobre as avulsas **sem prometer prazo** (pedi que ele diga qual não chegou).
Enviado, cópia **conferida** em Enviados: **uid 1367**.

## 5. Decisão de dono: #222 fechado, causa preservada no #317

- **#222 → `fixed`**, com nota de resolução dizendo o que era, o que foi medido
  e o que não foi resolvido.
- **#317 (`68a66227`) aberto** para a **causa**, com título verdadeiro: o
  `reconcileUserEntitlements` (`entitlements.ts:133-137`) casa órfão só por
  `ilike(buyer_email)`.

O #317 carrega o que já custou 3 rondas para ser medido, pra ninguém
redescobrir: **e-mail exato 0/42, e-mail normalizado 0/42, CPF 2/42 com 9
ambíguos**. E carrega a refutação da objeção antiga: vincular na mão **deixou de
ser frágil** — a guarda `donoDoEntitlement` (`vinculo.ts:36-46`, commit
`ba6a235`) só ADICIONA dono, nunca REMOVE.

**A fila não encolheu artificialmente: fecha um, abre um (46 → 46).** A diferença
é que agora o card aberto descreve o que existe.

## 6. O que eu NÃO fiz

Não mexi em crédito, acesso, plano, migration, PR nem GPU. Não vinculei
entitlement nenhum. O único efeito externo da ronda foi **um e-mail para um
aluno** (§4), que é decisão minha por a regra 8 de 21/08 (individual, caso que
eu estou tratando).

## 7. Nota de canal

O detector foi para a `main` junto com este log, e não para branch `feat/`. Ele
é ferramenta de leitura sob `_frank/`, sem efeito em produção, e as notas dos
incidentes **#222** e **#317** já apontam para o caminho dele — em branch, a
referência nasceria morta, que é exatamente a falha de 19/08 (fix preso 9h) e a
de 08/09 (log em `feat/`). Código de produção continua por branch + PR.

## 8. A lição da ronda

> **"Já conferi os 5" não responde à pergunta que importa, que é: e os que
> ninguém nomeou?**

Oito rondas conferiram os mesmos 5 nomes e nenhuma varreu a população. E a
frase que destravou o único aluno de verdade desta noite não foi uma medição
nova: foi **desconfiar de uma afirmação escrita no nosso próprio código** — o
"os quatro foram escritos à mão" que era 3/4. Documentação nossa é insumo, não
prova. O Isaías estava dentro do 1/4.
