# Ronda das falhas — 21/09, ~00h30–01h15Z (Frank, dono da fila)

## Resumo em uma linha

Nenhum incidente fechado. A ronda **derrubou dois números herdados** — a fila de
percepção (18 → 2) e a refutação da Herineth — e pôs de volta na lista de
reembolso uma vítima real que a ronda de ontem tinha tirado por medir com o
instrumento errado.

---

## 1. Passos fixos da ronda

### Reconciliação dos envios (passo fixo desde 18/09) — LIMPO

```
node _frank/ferramentas/2026-09-18_reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar
```

- 891 lidas da pasta `Sent` · 814 já tinham linha · **0 dentro da janela sem linha**
- Contagem fecha: 891 = 891, nenhuma carta sumiu na classificação.
- Irmão de leitura independente (`2026-09-18_enviados_x_tabela.cjs`):
  **veredito = 0 carta depois do corte**. O buraco segue PASSIVO.
- As **77 anteriores a 14/09 14:06:31Z** seguem sem decisão (é o que o `--corte`
  exclui). Não decidi: exige o `cobreDesde` na mão, é decisão de produção.

### Estado da fila

- **93** abertos/investigating · **88** com aluno afetado · **39** com 7d+.
- Idade: mais velho **52d** · mediana **5d**.
- 1 patch do Vigia esperando · **129** recados `tell_frank` na caixa.

### Percepção (ordem de 17/09) — o número herdado estava inflado 9×

A consulta SQL que a própria ordem de 17/09 publica devolve **18**. O
instrumento oficial da casa (`percepcao_travada.cjs`, controle positivo #310 OK,
488 incidentes varridos) devolve **2**:

| fonte | número | o que conta |
|---|---|---|
| regex da ordem de 17/09 | 18 | qualquer nota que *mencione* ver/ouvir/assistir |
| `percepcao_travada.cjs` | **2** | cartão que **só para** por falta de percepção |

E os 2 que sobram já estão resolvidos: **#450** casa pela própria frase que o
refuta ("NAO e caso de percepcao") e **#234** já tem laudo pronto. **Fila real de
percepção = 0**; nota mais velha parada há 2,5d.

> **Número pro relatório: 2.** Eu ia reportar 18 porque a ordem manda rodar
> aquele SQL. Rodar os dois e comparar é o que evitou publicar um número inflado
> pela quinta ronda seguida. A ordem de 17/09 merece uma correção de texto
> apontando pro instrumento, não pro regex — fica registrado, não executado.

---

## 2. O item serial: **#254 `f1ada07e`** — cobrança em dobro

**Por que este.** Regra 8 manda o mais antigo com aluno. Havia **empate triplo em
16d** (`132f7808`, `8c29740f`, `f1ada07e`); o desempate da própria regra é "mais
gente sofrendo" → **15 endereços**. Some-se a exceção explícita de **dinheiro
sendo cobrado errado agora**. Os três mais velhos que ele (52d, 19d, 18d) seguem
parados na mesma decisão de produto (rigor do QA), no grupo desde 17/09.

### 2.1 Carlos e Leandro não responderam — e desta vez é CONCLUSIVO

Ontem saíram cartas aos dois (Carlos uid 2953/2954, Leandro uid 3047/3048)
pedindo a frase do 9-C. Conferido com `ler_caixa.cjs --de` (não marca nada como
lido) nos quatro endereços: nada.

O `--de` só varre mensagem **já lida** — sozinho ele não excluiria uma resposta
ainda por ler. Por isso rodei `--fila`: **não-lidos no INBOX = 0**. Com a fila
vazia não há onde uma resposta estar escondida. Cobertura declarada em vez de
dúvida de pé.

### 2.2 O relógio, remedido vivo (não herdado)

`2026-09-17_cobrado_em_dobro_historico.cjs` — controle positivo OK e controle de
veredito OK (as 3 vítimas conhecidas reencontradas):

| aluno | pernas | relógio |
|---|---|---|
| **Carlos** | MY5O3KWB (dono=ÓRFÃO) + UMJP7PDY, as duas `active` | **22/09 — ~35h**, no mesmo dia |
| Leandro | 4XVSU9U7 + J9HMYL9P, as duas `active` | 28/09 e 30/09 |
| Nassara | 4C8EVSH4 | 24/09 |

Nenhuma vítima nova. Lista estável desde 15/09.

### 2.3 A ronda de ontem tirou da lista uma vítima real — corrigido

A nota de 20/09 20hZ deste cartão diz que a Herineth *"tem UMA assinatura, não
duas, então a acusação de US$44 em dobro NÃO satisfaz o critério deste cartão"*,
e por isso ela saiu da lista de reembolso e não foi escrita.

Medido hoje pelo `historico_cobrado_em_dobro` — cujo **controle positivo é,
literalmente, "as duas pernas da Herineth caem no mesmo grupo"**:

```
FKJBI6C2 <herysilva27@gmail.com>   active    USD 22 em 28/07  e  USD 22 em 30/08
PPEVZBRG <herysilva.27@gmail.com>  canceled  USD 22 em 18/08  e  USD 22 em 30/08
```

Sobreposição real **18/08 → 30/08**, e **duas cobranças no mesmo dia 30/08**.

**Por que as duas medições discordam, e nenhuma mentiu:** ontem contei assinatura
**ativa hoje** e achei 1 — porque a `PPEVZBRG` já está cancelada. Mas o critério
do cartão é *"duas ao mesmo tempo"*, que se mede na **janela da cobrança**, não no
dia de hoje. Instrumento errado para a pergunta feita.

Repare nos dois endereços: `herysilva27@` e `herysilva.27@` (com ponto). Contas
distintas — foi isso que a deixou marcada `[INVISÍVEL ao detector do card]`.

**Consequência:** volta à lista de reembolso por **US$ 22** (não os 44 do título
antigo). É a única das cinco **sem pendência do lado dela**: duplicata já
cancelada, sem 9-C a pedir, sem cobrança futura em dobro. O único bloqueio dela é
o "pode" do Johnny.

**Não escrevi pra ela, e digo por quê em vez de omitir:** a única frase que eu
teria hoje é *"a casa te cobrou duas vezes e te deve, sem data"* — sem pedido,
sem prazo, sem autorização. Entra na lista que vai ao Johnny primeiro. **Se o
"pode" não sair nesta ronda, ela deve ser escrita assim mesmo na próxima, pela
regra das 24h.**

### 2.4 O que trava, há 17 dias

1. O **"pode" do Johnny pro reembolso**, pedido no grupo em 04/09 ~20hZ. Hoje é
   21/09: **dezessete dias**.
2. A **frase escrita do titular** pra cancelar a duplicata (9-C). Carlos já levou
   5 cartas sem responder; Leandro levou a 1ª ontem e o prazo dele corre.

O relógio do Carlos (~35h) vence **antes de qualquer próxima ronda útil**. Sem
(1) ou (2), a casa cobra R$194 dele em vez de R$97 pela 2ª vez.

Gravado no cartão: `agent_notes` 37 → 38 e `resolution_note` 1719 → 2965 chars,
**conferido na releitura, 1 linha afetada** (não "o script disse que gravou").
Alvo resolvido por prefixo → `#254 f1ada07e`, conferido na saída — a ferramenta
foi consertada ontem (`931f472b`) justamente por gravar no cartão errado.

---

## 3. Canal

Uma mensagem ao **grupo** (`notify-grupo.sh`, ordem de 31/08 — nada no privado),
marcada **urgente**, pela regra do aluno pagante travado sem solução: o relógio
de ~35h do Carlos, as duas coisas que faltam, a lista do reembolso e a correção
da Herineth, dita como erro meu.

Não postei ronda vazia nem progresso parcial (regra 7). O que foi ao grupo é a
classe urgente, que é exceção declarada.

---

## 4. Dinheiro e segurança

- **Não escrevi para nenhum aluno** nesta ronda.
- Não cancelei assinatura, não estornei, não mexi em crédito, acesso,
  entitlement nem plano de ninguém.
- Não liguei para ninguém. Não gastei GPU. Não apliquei migration. Não abri PR.
  Nenhum código subiu.
- Hotmart só por `GET`. Leitura da caixa sem marcar nada como lido.
- **Nada da planilha** (ordem de 29/08).

---

## 5. Lição da ronda, pra não repetir

Duas vezes nesta ronda um número herdado estava errado, e **as duas vezes a
causa foi a mesma**: instrumento que responde uma pergunta parecida, mas não *a*
pergunta.

- "quantos cartões travados em percepção" → regex de nota (18) vs. "só param
  por isso" (2);
- "a Herineth foi cobrada em dobro" → assinaturas **ativas hoje** (1) vs. duas
  **ao mesmo tempo na janela da cobrança** (sim).

O hábito que pegou os dois foi **rodar o segundo instrumento mesmo já tendo um
número**. Quando a casa tem ferramenta dedicada com controle positivo, o número
dela vence o da consulta improvisada — inclusive quando a consulta improvisada
está publicada dentro de uma ordem.

---

## 6. O que a próxima ronda pega

1. **#254** só destrava com o Johnny. Se o "pode" saiu, executar o reembolso dos
   4 (Carlos R$97, Nassara R$97, Leandro R$97, Herineth US$22). Se não saiu até
   lá, **escrever para a Herineth mesmo assim** (regra das 24h).
2. Depois do #254, o próximo acionável do empate de 16d: **`8c29740f`**
   (andy.silvestre@icloud.com, bounce temporário de caixa cheia, sem novo bounce
   há 6d — candidato real a fechar).
3. Propor correção de texto da ordem de 17/09: apontar para o
   `percepcao_travada.cjs`, não para o regex que infla 9×.
