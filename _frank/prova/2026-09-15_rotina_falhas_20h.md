# Rotina das falhas — 15/09/2026, 20hZ (17h BRT)

Dono da fila (14-A). Li `_frank/ordens/README.md`, a ordem de **20/08** (dono da
fila), a de **21/08** (serial + regra 8), a de **27/08** (só erro de sistema vira
chamado) e a de **29/08** (planilha desligada). **Nada da planilha foi lido,
escrito, classificado ou reprocessado.** Canal: por ordem de **31/08**, o aviso
desta ronda saiu **no grupo**, e só no grupo.

Ronda anterior das falhas: **17hZ**. Abertura **19:40Z**.

**Esta ronda fechou o `#392`, com o conserto em produção e o aluno respondido.**
Mas o que ela tem de diferente começou antes do incidente: **o `git checkout` da
abertura falhou**, e o motivo era um conserto pronto que não estava em lugar
nenhum.

---

## 1. A abertura não foi limpa, e isso era o achado

`git checkout main` abortou: `frontend/src/lib/agent/manual.ts` tinha alteração
não commitada. O repo estava na branch `fix/392-manual-gerador-de-imagem-edita-foto`,
**1 commit à frente da main** (`4fdbc13`), com edição por cima dele **não
commitada**, e **sem PR aberto**.

Ou seja: a ronda anterior montou o conserto do `#392`, testou, e **parou no
meio** — provavelmente estourou o limite de turnos. O resultado é a armadilha de
**19/08** de novo, na forma mais cara dela: conserto pronto, invisível, e
protegendo ninguém. A diferença é que desta vez metade dele nem commitada estava
— um `git checkout` distraído (e eu dei um, ver §6) apaga sem perguntar.

**Não parti pra triagem da fila.** A regra 8 manda levar UM item até o fim, e
havia um item a um merge de distância do fim, com pagante esperando. Re-triar
teria sido trocar trabalho acabado por trabalho novo.

## 2. 🔴 Li a edição pendente antes de mergear, e ela estava errada

Apliquei a pergunta que a ronda das 17hZ provou valer mais que "está pronto?":
**"por que NÃO mergear?"**. A edição pendente tinha três defeitos, e **dois eram
do mesmo tipo que o `#392`**:

| # | defeito | o que a realidade diz |
|---|---|---|
| 1 | **inventava tela** — mandava a Fast pedir ao aluno que lesse "o contador X/15 ao lado das extras" | esse contador **não existe**. O único texto que a UI escreve sobre o que entra é `refs.usingNow` (`pt-BR.json:468`), renderizado em `image-studio.tsx:1185` |
| 2 | apagava fato **verdadeiro**: "quadro vazio → 1ª foto vira principal e entra" | verdade conferida em `image-studio.tsx:531` — `if (!fixedRef && primeira) persistFixedRef(primeira)` |
| 3 | apagava o guard "Não empurre atribuição pra quem não pediu" | protege 98% (2.583 de 2.626 gerações, 792 alunos) |

**O defeito 1 é o que importa, e ele é quase engraçado de tão exato:** o `#392`
existe porque a Fast afirmou coisa sobre uma tela que ela não vê. O conserto do
`#392` ia mandar a Fast afirmar coisa sobre uma tela que ela não vê. A edição
inventava um elemento de UI **dentro do patch que conserta inventar elementos de
UI**.

**A rede pegou 2 dos 3.** Com a edição aplicada: **13/15**, caindo exatamente em
"o manual não repete o falso negativo do `#392`" e "o manual NÃO afirma o que
existe dentro das fotos extras". Os testes que o `4fdbc13` tinha acabado de
escrever funcionaram.

**O que ela não pegava era o defeito 1**, e o motivo é estrutural: nenhum teste
ancorava o manual na **UI**. Os testes ancoravam na ROTA (`MAX_REFERENCE_IMAGES`)
e nos **rótulos de botão** do `pt-BR.json` — mas nada impedia o manual de citar
um elemento de tela que simplesmente não existe.

## 3. O que eu aproveitei dela — porque o núcleo estava certo

Descartar inteiro teria sido tão preguiçoso quanto mergear inteiro. A edição
tinha uma ideia **boa e nova**: a Fast não pode **DEDUZIR**, pela conversa, se a
foto do aluno entrou na geração — porque os dois caminhos do item anterior dão
resultados **opostos** e a diferença está em qual controle ele usou.

Virou bullet novo (`a6452b7`), **sem apagar nada**, e com duas correções:

- ancorado no texto que a UI **de fato** escreve (`refs.usingNow`);
- com a ressalva de que **nem esse aviso está sempre na tela** — ele só aparece
  com quadro preenchido (`fixedRef`) **e** foto salva fora dele
  (`bankPendingCount > 0`). Então a ordem é **perguntar o que ele está vendo**,
  nunca prometer o que está lá.

Essa segunda correção foi minha, contra mim: a 1ª versão que escrevi dizia "o
aviso aparece quando ele tem foto salva fora do quadro", o que dá a entender
suficiência quando a condição é composta. Num incidente que é literalmente sobre
inventar tela, "quase certo" é o defeito.

## 4. Teste novo, ancorado na UI, provado por mutação

O teste novo lê `usingNow` do `pt-BR.json` e exige que a frase citada no manual
seja a frase real. Não acreditei nele até tentar quebrá-lo:

```
reescrever refs.usingNow no pt-BR.json ............. 15/16, cai
tirar "VOCÊ NÃO VÊ A TELA DELE" do manual .......... 15/16, cai
```

Somado ao que o `4fdbc13` já provava (`MAX_REFERENCE_IMAGES` 15→8, rename de
`refs.extrasPick`, inserir "as extras SEMPRE carregam um cenário"): **5 mutações,
5 quedas**. **16 testes, `tsc --noEmit` limpo.**

⚠️ **O que este teste NÃO cobre, dito de propósito:** ele pega o manual
**deixar de citar** a frase real. Não pega o manual **acrescentar** um segundo
elemento inventado ao lado da frase certa. Cobrir isso exigiria enumerar a UI
inteira, e prefiro registrar o vão a vendê-lo como fechado.

## 5. Em produção, pelas três pontas da 5-B

PR **#299**, merge **`89c5a52`** às **19:46:10Z**. Action **success**.

1. **hash**: `md5sum` de `manual.ts` no Hetzner = `74bd267579ec4f90aba831b6ebf12370`,
   **idêntico** ao da minha `main` (`manual.test.ts` também bate);
2. **BUILD_ID** `Z0AirrWrT0erqquKuFPLJ`, mtime **19:47:58Z** — depois do merge;
3. **pm2** `aiverse` **online desde 19:48:53Z** — depois do build.

Nenhum `grep` no `.next/server` foi usado pra concluir nada.

## 6. 🔴 Erro meu no meio da ronda, e ele quase custou o trabalho

Pra provar que a edição descartada continuaria barrada, tentei reaplicar o patch
salvo e rodei `git checkout -- frontend/src/lib/agent/manual.ts` na sequência.
O patch **não aplicou** (eu já tinha mudado o arquivo) — e o `checkout` **apagou
a minha própria edição não commitada**, que era o conserto da ronda.

Peguei porque conferi (`grep -c` do guard = **0**) em vez de assumir que o
comando tinha feito o que eu queria. Refiz, e só. Mas o registro fica, porque é
a **mesma classe** do achado da §1: trabalho valioso morando fora do git é
trabalho a um comando de distância de não existir. **A lição prática: commitar
antes de experimentar, não depois.** Se eu tivesse commitado o conserto antes de
tentar a prova, o `checkout` teria sido inofensivo.

## 7. O aluno: respondido, e a informação errada corrigida

**Vanderley** (`vendas.agenciaaguia@gmail.com`), `#392`. A pergunta dele é de
**14/09 14:29:19Z** e ficou **29 horas** sem resposta. O caso é pior que o
silêncio:

- **14:27Z** — ele pergunta onde subir as imagens. A Fast responde que "no
  Gerador de Imagem você **não sobe** imagens prontas" e que "a foto é **só pra
  inspirar** — não edita a sua foto original". **As duas coisas são falsas.**
- **14:29Z** — ele reformula, mais específico: as fotos salvas em Imagens de
  Referência são usadas pra gerar a principal, ou precisam ir pra um lugar
  específico? A Fast promete que "a equipe confirma".
- **14:55Z** — ele pede o **e-mail do suporte**. Alguém tentando resolver por
  fora porque o canal de dentro não respondeu.

Ele é **PAGANTE** (R$ 806,86 em duas avulsas de 28/04) e entrou no FastCloner
**em 14/09, o mesmo dia** — aluno novo, primeiro contato com a ferramenta,
recebeu informação errada.

Escrevi às **19:53Z** (regra 8: e-mail individual sobre caso que estou tratando,
decido sozinho). Respondi a pergunta dele de verdade — os **dois** botões, o teto
de 15 fotos / 150 MB, o comportamento do quadro vazio, a dica de atribuição no
prompt — e **corrigi explicitamente** o que a Fast disse errado, assumindo a
culpa em vez de deixar no vago. Cópia **confirmada** na pasta de enviados,
**uid 2464**.

**Não afirmei a ele que ninguém o respondeu**, porque não posso saber: o
`ja_falaram.cjs` avisa que a caixa do `suporte@lucasarrial.com` não é lida por
nós e ausência de registro não é prova de silêncio.

**Crédito:** nada a estornar. Ele fez **1 geração** e não voltou; não houve
cobrança indevida.

## 8. O que esta ronda diz

As rondas de hoje vinham catalogando formas de prova que não prova: instrumento
que mente (15hZ), nota que envelhece (15hZ), aviso que quase não foi lido (16hZ),
conserto que apaga a lição do conserto anterior (17hZ). Esta acrescenta a quinta,
e é a mais específica de todas: **o conserto que comete o próprio defeito que
conserta.**

Não é ironia, é mecânica. Quem escreve o conserto passou a última hora dentro da
cabeça do defeito — e a forma mais natural de preencher uma lacuna é exatamente
a que causou o incidente. Eu ia mandar a Fast inventar um elemento de tela no
patch que a proíbe de inventar elementos de tela, e ia fazer isso **de boa fé**,
achando que estava sendo mais útil.

O que pegou não foi cuidado genérico. Foram duas coisas baratas e específicas:
**a pergunta invertida** ("por que NÃO mergear?") e **ir conferir o `pt-BR.json`
em vez de confiar na minha memória da tela**. Trinta segundos de `grep` contra
uma afirmação que eu teria escrito com confiança total.

E o fecho honesto: **dois terços dos defeitos foram pegos pelos testes da ronda
anterior**, não por mim. A rede de ontem pegou o erro de hoje. É o argumento mais
forte que eu tenho pra escrever teste que ancora em realidade externa, mesmo
quando dá mais trabalho que casar string contra o próprio arquivo.

---

**O que eu NÃO fiz:** não fechei nenhum outro incidente, não reabri incidente,
não mudei status de cartão nenhum, não subi migration, não mexi em crédito,
acesso, plano nem entitlement, não estornei, não prometi reembolso a ninguém, não
mandei e-mail em massa, não li a caixa de entrada para triagem, não editei nada
no servidor por SSH (só leitura, pra prova de deploy), não toquei nos branches
STALE (`feat/fix-image-upload-retry`, `feat/onedrive-401`,
`fix/referencia-fronteira-de-frase-por-palavra`,
`feat/fabricar-referencia-fronteira-por-palavra`), não mexi no `diaBR` nem na
política de renovação (decisões do Johnny, pendentes das rondas anteriores), não
gastei GPU nem crédito de aluno, e **não li nem reprocessei nada da planilha**
(ordem de 29/08).
