# Ronda das falhas — 22/09/2026 ~23h40–23h55Z (Frank, dono da fila)

Canal: ordem de 31/08 — FastCloner **só no grupo** (`notify-grupo.sh`).
Ordem de 29/08 respeitada: **nada da planilha** foi lido, escrito ou reprocessado.
Turno: 20h54 BRT, dentro da janela 08h–23h BRT (ordem de 27/08).

Serial pela regra 8. Não mexi em crédito/acesso/entitlement, **não estornei**,
não cancelei assinatura, **não mergeei nada**, não gastei GPU, não toquei em
migration, **não mandei carta nenhuma**.

**Uma linha:** peguei a Walsicleia (#525, aluna pagante, 7 e-mails, 18 dias sem
entrar) e descobri que **a carta certa já tinha saído 105 segundos antes de eu
começar** — então em vez de repetir o trabalho fui conferir se as promessas dela
se sustentam (sustentam, as duas) e medir a classe: **18 de 128 alunos com o
clone do SGP pronto nunca entraram uma vez sequer**, número que ninguém tinha
porque o cartão da classe mediu *"foi avisado?"* e nunca *"entrou?"*.

| fato | número |
|---|---|
| Cartões fechados | **0** (digo abaixo por quê) |
| Alunos escritos | **0** |
| Fix em produção | **0** |
| PR aberto | **0** |
| Notas de incidente gravadas | **3** (#525, #505, #496 — as 3 conferidas na releitura, 1 linha cada) |
| Recado do Vigia encerrado | **1** (`para_frank_0982e073`, DELETE conferido: 1 → 0) |
| Ferramentas novas (só leitura) | **1** |
| Dinheiro devolvido por mim | **0** |
| GPU gasta | **0** |

---

## 0. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar` | 1079 lidas = 1002 já com linha + 77 fora da janela + **0 escrituráveis**. Contagem fecha (1079 = 1079). |
| `enviados_x_tabela.cjs` (irmão de leitura) | **0 carta depois do corte** fora da tabela. Buraco **PASSIVO**. |
| `percepcao_travada.cjs` | **0** card travado em percepção · controle positivo #310 reencontrado, 511 varridos. |
| `garantia_na_fila.cjs` | 6 perderam a janela · **1 vence em 48h** · 0 na perna da renovação. |
| `idade_incidentes.cjs` | **108 abertos** (era 106 na ronda anterior, **+2**). 30d+: 4 · 15–30d: 17 · 7–15d: 37 · 3–7d: 29 · <3d: 21. |
| `esperando_johnny.cjs` | **18** parados em decisão do Johnny · mais velho **54d** · **59 alunos** distintos · 2 não triados · 4 contestados. |

---

## 1. Por que este cartão

O `#525` (`f8a71e43`) é reabertura do `#430` e chegou como recado urgente às
23:25:48Z: **aluna pagante (R$936,15), 18 dias de conta, 7 e-mails dela, clone
pronto do lado de dentro desde 11/09.** Pela regra de prioridade ("aluno
esperando vem ANTES da limpeza da fila") ele passa na frente dos mais velhos,
cujos próximos passos são do Johnny.

## 2. O primeiro achado: a carta certa já tinha saído

O recado pedia, em caixa alta, *"não mande a 5ª carta igual"*. Fui ver se já
havia saído alguma — e havia: **23:27:33Z, 105 segundos depois do recado**
(`emails_enviados` 257f9801, uid 3247 na pasta Sent, `bounce=não`).

**Abri o corpo antes de julgar.** A carta é boa e não é "a 5ª igual":

- **não tem link de acesso nenhum** (única URL é `fastcloner.com/login`), então
  não repete o link que venceu 4 vezes;
- explica que os links valiam **1 hora** e por isso morriam antes de ela ler;
- manda **ela mesma** disparar o "Esqueci minha senha" — o relógio passa pra
  mão dela;
- promete que, se falhar de novo, a casa **liga**.

Se eu tivesse seguido o recado ao pé da letra sem conferir, teria mandado a 6ª
carta pra quem já tinha recebido a 5ª treze minutos antes.

## 3. O que eu fiz de útil: conferir as promessas, que é onde se perde o cliente

Carta com frase não verificada é como a casa produz o 8º e-mail do aluno. As
duas promessas se sustentam:

**(a) "sua voz e seu clone de foto estão prontos desde 11/09"** — verdadeiro:
`voices f6670280` "Minha Voz" ready 11/09 20:15:13Z (1317s), `image_generations
336a0629` "Foto social" ready 20:15:34Z, `generations 09bbdc47` "Amostra
automática" ready 20:20:37Z.

**(b) "ver não custa nada e não precisa de plano"** — verdadeiro, e conferido no
**fonte**, não no diff: `app/[locale]/app/voice-cloning/page.tsx` e
`app/[locale]/app/images/page.tsx` **não redirecionam por crédito** — só calculam
`canTrain`/`canGenerate = false` e renderizam o workspace; `history` não tem
gate. Com `credits = 0` e `plan = free` ela **entra e vê**.

**Estado de autenticação** (`auth.admin`, agora): `last_sign_in_at` **NUNCA**,
e-mail confirmado 04/09, `recovery_sent_at` 18/09 22:48:22Z. Confirma a leitura
de 18–19/09: link sai, ninguém consome.

## 4. O vínculo das 2 compras continua sendo do Johnny — agora com controle

`pagou_de_verdade`: **PAGOU**, avulsa, HP3752211878 (FCI R$297 COMPLETE) +
HP0764236596 (SGP R$639,15 COMPLETE), 21/08.

O recado hesitava entre mim e o Johnny. **Medi e a hesitação se resolve contra
mim:** `entitlements` tem 1390 linhas, das quais o produto do SGP (7283229) tem
**4** e o do FCI (7283335) tem **12**, e **todas as 16 são de 09/06** — nenhuma
na janela da compra dela, nenhuma desde o lançamento. Ela **não é uma linha que
faltou**: comprador de avulsa sistematicamente não recebe entitlement, que é a
regra comercial do Lucas de 31/08 já conferida em três camadas do código no
`#505`. Conceder a ela seria **decisão comercial nova** (`#173`), do Johnny.
**Não concedi, não dei crédito, não toquei em `access_until`.**

## 5. O achado da ronda: ninguém mediu "entrou?"

O `#505` ("ENTREGAMOS O CLONE E TRANCAMOS A PORTA") foi investigado a fundo e
fechado **certo** — eu reconferi. Mas ele mediu **"foi avisado?"**. A pergunta
que o aluno sente é **"entrou?"**, e ela nunca foi feita.

Ferramenta nova (só leitura, controle positivo embutido):
`_frank/ferramentas/2026-09-22_entregue_mas_nunca_entrou.cjs`.

```
128 entregues · 110 já entraram · 18 NUNCA entraram (14,1%)
mais velho pronto há 15,9d (iran@ogr.com.br, avisado 07/09 01:11Z)
sem carimbo de aviso: 0   <- confirma a correção da nota [1] do #505
```

**A Walsicleia é 1 desses 18.** Ela não é um caso isolado: é o caso barulhento
de uma classe silenciosa. Os outros 17 não escreveram 7 vezes.

Cortando pelo fix do `#435` (commit `7871f590`, 16/09 21:50:18Z, que põe o
`PARAGRAFO_SENHA` nas três saídas do onboarding): **9 avisados antes, 9 depois**.
A não-entrada continua dos dois lados do conserto.

## 6. O que eu NÃO afirmo (e uma hipótese minha que derrubei na mesma ronda)

**Não digo que o `#435` falhou.** A coorte pós-fix é mais NOVA (0,5d–5,3d) que a
pré-fix (6,2d–15,9d); parte dos 9 de depois pode simplesmente ainda não ter
voltado. Comparação justa exige janela de idade casada e eu não a fiz.

**Não digo que os 18 estão "trancados".** Comprar o SGP não dá a plataforma, e
eles foram avisados por escrito disso — parte pode ter lido e escolhido não
voltar. O número mede **ausência**, não impedimento.

**Hipótese minha, levantada e derrubada nesta ronda:** no meio da investigação
tratei "3 alunos sem link nenhum de recovery na conta" (`luisrocha` 5,3d,
`almaraujo` 5,0d, `lucianadox1` 2,0d) como defeito — *"a casa nem tentou"*.
**Está errado.** Os três são todos **pós-fix**, e depois do `7871f590` a carta
leva link de **auto-atendimento** em vez de a casa disparar `resetPasswordForEmail`.
"Sem `recovery_sent_at`" ali é o comportamento **esperado** do conserto. Não abri
cartão por isso, e a armadilha está escrita no docstring da ferramenta pra não
voltar.

**Não li a caixa do suporte@** (proibido pra triagem). Por isso, embora a
Walsicleia tenha recebido **8 respostas** com o mesmo assunto do `fast-resposta`,
**não afirmo que sejam duplicata** — podem ser resposta legítima a 8 mensagens
dela. Medi a classe (12 pares repetidos, 11 alunos, 23 cartas a mais) e **não
abri cartão**, porque sem a tabela de entrada o número não separa bug de
comportamento correto. Fica declarado, não carimbado.

## 7. Dois cartões que já estavam resolvidos antes de eu chegar

- **`#496`** (`anotar_incidente.cjs` grava no cartão errado): o recado
  `para_frank_0982e073` (2,5d) pedia duas coisas, e **as duas já estavam
  feitas**. O `resolverId` furado foi trocado pelo resolvedor testado de
  `_incidente_nota.cjs` no commit `931f472b` (20/09 **12:27:09Z**) — **16
  minutos** depois de o Vigia cair no bug às 12:11Z. Provado por
  **comportamento**: a ferramenta imprimiu `alvo resolvido por PREFIXO` ao vivo
  nesta ronda. E a limpeza de dado o próprio Vigia fez: retratação no `#138` às
  12:15:46Z, regravação no `#427` às 12:16:19Z, **33 segundos** depois, sem
  apagar histórico. Chave apagada com `DELETE` (releitura: 1 → 0).
- **`#427`** (bounce da Luciana): a objeção viva da nota [3] aponta 7 cartas
  mandadas depois do bounce. Medi: **7 cartas, 1 aluna só**, e a leitura
  anterior já tinha concluído que o bounce dela é **falso positivo**
  (`email_verificado_at` 18s depois de um código sair pro mesmo endereço).
  **Não reabri, não abri cartão novo.**

## 8. Por que NÃO fechei o #525

Regra 14. Medi e conferi, **não resolvi**: ela continua sem entrar. O que o
cartão espera agora:

1. **ela disparar o reset** — a carta de 23:27Z pôs o passo na mão dela e a data
   está anotada; pela regra 8, esperar resposta de aluno **não** é estar travado,
   então o item saiu do meu colo;
2. **o escopo das 2 compras**, que é do Johnny e vai no lote do grupo.

## 9. Fila do Johnny: 18 parados, 59 alunos atrás

O `esperando_johnny` diz que o desfecho **não** é re-escalar um caso por ronda, e
sim juntar num **lote**. O mais velho está parado há **54 dias**. O conflito que
tranca o SGP (regra do Lucas 31/08 × weekly do Johnny 14/09, migration 115 não
aplicada) já foi ao grupo em 21/09 e **é o que decide o destino dos 18 desta
ronda**.

## 10. Fim de ronda

- `git log --oneline origin/main..HEAD` conferido **vazio** após o push.
- Produção tocada por mim: **três notas de incidente** (as três conferidas na
  releitura, 1 linha afetada cada), **um recado apagado** (releitura 1 → 0), **uma
  ferramenta de leitura** e este log. Nenhum merge, nenhum crédito, nenhuma GPU,
  **nenhuma carta a aluno**.
