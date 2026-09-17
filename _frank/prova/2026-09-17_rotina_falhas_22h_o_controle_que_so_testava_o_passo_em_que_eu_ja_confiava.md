# Ronda das falhas — 17/09 ~22hZ

**Item serial: `#254` (`f1ada07e`), cobrança em dobro. NÃO FECHADO — mas a
medição que estava pendente por escrito foi feita, e o número caiu de 8 para 0.**

Em uma linha: **os 8 "candidatos" a vítima escondida não são 8 vítimas, são
zero — e eu quase desclassifiquei duas vítimas reais no caminho de descobrir
isso.**

---

## 0. Por que peguei este

Os três cartões mais velhos da fila seguem sem passo meu, conferido hoje antes
de escolher:

| cartão | idade | dono do próximo passo |
|---|---|---|
| `#15` `d3d8d1b2` | 49,3 d | **Johnny** — troca qualidade × entrega |
| `#226` `702cc916` | 16,1 d | **Johnny** — (a) falhar tudo × (b) só o grave |
| `#234` `f8587cef` | 15,1 d | **Johnny** — ligar o QA em modo reprovando (gasta GPU) |

Os dois seguintes (`#249` Glauber, `#250` Anderson) estão os dois travados na
**mesma** palavra: aval pra falar por WhatsApp com pagantes que nunca receberam
nada. Reli os dois por inteiro. O `#250` tem regra própria escrita em 14/09 —
retentar UMA vez com folga de ~7 dias, e a última tentativa foi 14/09, então
nem o retry está vencido. Não há passo meu em nenhum dos dois, e a ronda das
12hZ já reescalou hoje com fato novo; repetir seria ruído.

O `#254` era o próximo, e ao contrário dos outros ele tinha um passo meu
**escrito na própria nota das 13hZ de hoje**:

> *"8 é piso, não teto, e ninguém deve escrever 'são 8' em lugar nenhum antes
> de medir par a par na Hotmart viva."*

Ninguém tinha medido. Medi.

---

## 1. A medição: 50 pares na Hotmart viva, zero falha de leitura

Ferramenta nova, só leitura:
`_frank/ferramentas/2026-09-17_cobrado_em_dobro_historico.cjs`.

Ela existe porque o detector do cartão (`assinatura_em_dobro.cjs:76`) filtra
`.eq("status","active")` e portanto só sabe responder *"quem AINDA está sendo
cobrado em dobro"*. A pergunta que o dinheiro exige é outra: *"quem FOI cobrado
em dobro"*.

| | detector do cartão | ferramenta nova |
|---|---|---|
| assinaturas lidas | 860 (só `active`) | **1.305** (todas) |
| chave de pessoa | CPF ∪ telefone ∪ nome | + **caixa de e-mail normalizada** (Gmail ignora ponto e `+tag`) |
| pergunta | ainda cobra? | **foi cobrado?** |

50 grupos com mais de uma assinatura. Cada perna medida cobrança por cobrança
na Hotmart (`value > 0` **E** COMPLETE/APPROVED). **Zero falha de leitura nos
50** — falha seria reportada como falha, nunca como "não pagou".

**Os 8 candidatos da nota das 13hZ, todos medidos, nenhum é vítima:**

| candidato | veredito medido |
|---|---|
| nilma.advogada | uma paga só |
| grupoperes | uma paga só |
| pcezardireito | uma paga só |
| chaplainfabio | uma paga só |
| walidsafadi | nenhuma paga (trials) |
| luciane.garcia | nenhuma paga (trials) |
| math.sg97 / matt97tricolor | nenhuma paga (trials) |
| carlosrobertocoach / betobass27 | nenhuma paga (trials) |

Metade tem uma só perna paga; a outra metade é trial dos dois lados — e tratar
trial como dinheiro cobrado é exatamente o erro que o `#222` já cometeu.

**A classe escondida tem tamanho 1**, e é a Herineth, que já era conhecida e já
foi avisada (cartas de 07/09, uid 1196 e 1203). **Não existe vítima nova sem
aviso.** O "8" morre aqui, medido.

## 2. E então eu errei — e o cartão foi quem me desmentiu

A **primeira** versão da ferramenta comparou, por perna, a janela
`[primeira cobrança paga, última cobrança paga]`. Ela cuspiu:

```
COBRADO EM DOBRO: 3
Assinou de novo depois (churn, NAO e dobro): 2
   → Nassara Borges Mesquita
   → Leandro Lopardi
```

Os dois "churn" estão **nomeados no título deste cartão como vítimas desde
04/09**.

A causa é conceitual, não de código: aquela janela trata pagamento como
**instante**. Pagamento de assinatura não é instante — é **um mês de serviço
comprado**. Perna com uma única cobrança vira janela de largura **zero** e não
cruza com nada, nunca.

- **Nássara** — `ZKJBP56C` pagou 30/07, `4C8EVSH4` pagou 31/07. **Um dia** de
  diferença, o mesmo mês comprado duas vezes.
- **Leandro** — 28/08 numa perna, 05/09 na outra. Mesma coisa.

Se este cartão não tivesse os nomes deles no título, eu teria publicado
*"Nássara e Leandro não eram dobro, eram churn"* — desclassificando duas
vítimas reais **com cara de rigor**, porque vinha com instrumento, tabela e
50 pares medidos.

A regra certa, agora no código: cada cobrança paga cobre `[data, data + ciclo)`,
com o ciclo tirado da cadência da própria assinatura (mediana dos intervalos;
31 dias quando só há uma). Sobrepõe se **qualquer** cobertura de uma perna
cruzar **qualquer** cobertura da outra. Não uso `access_until`: ele vem do nosso
banco, que é a fonte que o próprio docstring do detector manda não usar pra
concluir.

## 3. A lição, e ela não é sobre datas

**Eu tinha controle positivo. Ele passou. E não adiantou nada.**

O controle era a Herineth — o caso que só a chave de Gmail consegue agrupar.
Ele passou na versão certa **e passou igualmente na versão errada**, porque ele
testava o **agrupamento**, e o erro estava no **veredito**.

São dois passos independentes — juntar as pernas da mesma pessoa, e decidir se
aquilo foi cobrança em dobro — e eu só tinha rede embaixo do primeiro. O
segundo, que era o novo, o que eu tinha acabado de inventar, e portanto o mais
provável de estar errado, estava no ar.

> **Controle que testa só o passo em que eu já confiava não é controle: é
> cerimônia.** Ele produz a sensação de rigor exatamente onde o rigor não está.

As 3 vítimas já medidas do cartão (Nássara, Leandro, Carlos) agora são
**controle positivo de veredito** dentro da ferramenta, que **aborta com saída
2** se a regra de sobreposição não reencontrar as três. O instrumento não
publica número nenhum enquanto não reproduzir o que a casa já sabia.

## 4. Placar medido hoje (cobertura sobreposta, Hotmart viva)

| aluno | pago | duplicado | mês em duplicidade |
|---|---|---|---|
| Nássara Borges Mesquita | R$ 291 | ~R$ 97 | 31/07 → 24/08 |
| Leandro Lopardi | R$ 194 | ~R$ 97 | 05/09 → 28/09 |
| Carlos Augusto Ferreira | R$ 291 | ~R$ 97 | **28/08 cobrado 2× no mesmo dia** |
| Herineth Maria Lima | US$ 88 | ~US$ 44 | **30/08 cobrado 2× no mesmo dia** — *invisível ao detector* |

(Johnny Oliveira, conta de teste de R$1, excluída pelo método do próprio cartão.)

**4 alunos, nenhum novo.**

## 5. O que saiu daqui para um aluno

Fato novo medido hoje na Hotmart viva: **`ZKJBP56C` (Nássara) está `DELAYED`,
não cancelada, com `date_next_charge` em 30/09.** A duplicidade dela não é só
passado — a Hotmart vai **tentar cobrar de novo**. E a carta de 01/09 (uid 431)
terminou prometendo *"retorno assim que tiver a definição"*: 16 dias sem
retorno. Foi o silêncio que fez a Viviana explodir.

**Escrevi pra ela** (regra 8, individual, decisão minha). Cópia **confirmada em
Enviados, uid 2684**, chave `nassara-dobro-retorno-30set`. A carta:

1. **corrige a minha própria carta de 01/09**, que dizia *"vem sendo cobrado
   R$ 97 a mais"* como se fosse todo mês — medido, foi **um mês só**;
2. avisa da tentativa de **30/09**;
3. pede a frase escrita pra cancelar (não cancelo assinatura de titular sem o
   pedido dele);
4. garante que cancelar não derruba o acesso (vive na `4C8EVSH4`, até 24/09)
   nem os **95.590 créditos**, conferidos hoje;
5. diz a verdade sobre o reembolso: **não tenho definição, não prometo valor
   nem data**, e dá a transação `HP1724745592` pra ela pedir direto na Hotmart
   se não quiser esperar por mim.

Não a acusei de não ter respondido: a caixa do `suporte@` não é lida por nós e
ausência de registro não é prova de silêncio (aviso do próprio `aluno.cjs`).

## 6. Discrepância registrada, sem conclusão

A nota das 13hZ diz que a `PPEVZBRG` (Herineth) foi *"canceled por NÓS em 07/09
07:07Z"*. A Hotmart viva devolve `CANCELLED_BY_CUSTOMER`. Pode ser só como a
Hotmart rotula cancelamento via API. **Não concluo nada** — fica anotado pra não
virar "descoberta nova" daqui a duas rondas.

## 7. O que continua travado, e não é comigo

Reembolso do duplicado (Nássara R$ 97, Leandro R$ 97, Carlos R$ 97 + R$ 194 da
órfã, Herineth US$ 44) é alçada do Johnny pela 9-C. Cancelamento exige a frase
escrita do titular — pedida à Nássara hoje, já pedida 2× ao Carlos (a nota de
16/09 mediu que não há fato novo pra ele: um 3º e-mail seria a mesma carta pela
3ª vez) e 2× ao Leandro.

**Relógio mais próximo: Carlos renova 22/09 (5 dias). Nássara tem a retentativa
de 30/09.**

## 8. Estado e dinheiro

Não cancelei assinatura, não estornei, não mexi em crédito, acesso, entitlement
ou plano de ninguém. Não gastei GPU, não apliquei migration, não abri PR, não
li/escrevi/classifiquei nada da planilha (ordem de 29/08). Hotmart por GET puro.
Um e-mail individual enviado, com cópia conferida no IMAP.

`#254` segue `investigating`. Nenhum incidente fechado nesta ronda — e isso é
resposta legítima: o dinheiro duplicado não voltou pra ninguém, e fechar aqui
seria fechar mais rápido do que resolvo.
