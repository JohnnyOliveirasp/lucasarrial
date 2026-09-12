# Ronda das falhas — 12/09/2026, 00h40–01hZ (21h40 BRT)

Frank, dono da fila. Método serial (regra 8). Esta ronda **não fechou
incidente**. Entregou: **um aluno pagante que pagou R$97 e nunca teve conta
foi finalmente contactado, dentro da janela de garantia**, com a decisão de
dinheiro escalada ao Johnny com prazo na mão; e **duas armadilhas de medição
novas**, uma delas que quase me fez classificar um pagante como trial.

Repo em `main`, `pull --ff-only`. `_frank/ordens/README.md`, a ordem de **27/08**
e a de **29/08** lidas antes de tocar em qualquer coisa. Nada da planilha foi
lido, escrito ou reprocessado. Canal de **31/08**: os avisos foram pro **grupo**.

`now()` no início = **2026-09-12T00:41:29Z**. Janela do Executor (08h–23h BRT):
21h40 BRT, dentro.

---

## 1. Por que não peguei o mais antigo

Pela regra 8 o mais antigo com aluno afetado é o `#313` (09/06, 12 pessoas).
Ele **não é meu**: o que sobrou dele é o item (a), decisão comercial do
Johnny/Lucas sobre honrar ou revogar os 15 vitalícios. A ronda das 20hZ já
escalou e registrou isso. Não é "travei" — é que o passo seguinte é de outra
pessoa, e a regra manda dizer em que passo parou e seguir.

Peguei então pela **exceção explícita da regra 8: dinheiro agora**. O
`garantia_na_fila.cjs` (controle positivo OK, 2/2) mostrou um único caso com
relógio correndo e ação possível: `#306`/`#305`, **restavam 23,3h**.

## 2. O caso: Rodrigo Lima (`#305`, `#306`)

Pagou **R$ 97,00 em 06/09**, cartão, 1x, transação `HP2955203673`,
`PURCHASE_APPROVED` rec#2, status APPROVED, processado sem erro.
**Nunca criou conta.** Cancelou em **07/09**. O convite "crie sua conta" da
casa só saiu em **08/09 14:00Z** — **um dia depois de ele desistir**.

Ele pagou R$97 por um ciclo que não usou porque ninguém explicou como entrar a
tempo.

## 3. A armadilha que quase me fez errar o diagnóstico — registro porque é reutilizável

Li os eventos dele pelo **tail** e vi `price.value = 0`, "Plano Founder",
`actual_recurrence_value: 0`. Conclusão óbvia e **errada**: *"trial de R$0,
nada a reembolsar"* — que é exatamente o rótulo que o `#333` denuncia e que
quase custou R$ 2.809 à Teresa no sentido inverso na ronda das 20hZ.

São **3 eventos**, e só a lista completa mostra a verdade:

| quando | evento | rec# | valor |
|---|---|---|---|
| 30/08 | PURCHASE_APPROVED | 1 | **0** (entrada grátis) |
| **06/09** | **PURCHASE_APPROVED** | **2** | **97** ← o pagamento |
| 07/09 | PURCHASE_COMPLETE | 1 | 0 |

**Em assinatura, nunca classificar pagamento por um evento isolado.** O
primeiro e o último são R$0 e o do meio é o que importa. Corrigi antes de agir;
se tivesse parado no tail, teria arquivado um pagante como trial.

## 4. A segunda armadilha: onde mora o `warranty_date`

Consultando na mão, `payload.data.purchase.warranty_date` volta **undefined**
nos três eventos. Quem ler por aí conclui "sem garantia" e fecha o caso.

O campo real é **`payload.data.product.warranty_date`** = `2026-09-13T00:00:00Z`.
O `garantia_na_fila.cjs` usa o caminho certo (linha 108) — o erro é meu, da
consulta manual. Registro porque a consulta manual é o que a gente faz sob
pressa, e ela mente nesse ponto específico.

## 5. A conferência que eu me recusei a pular

O `detector_preso_fora_da_conta.cjs` **não acusa** o Rodrigo. Isso **não é
prova de nada** no caso dele: o entitlement está `canceled` e o `raw_event`
**não tem chave `purchase`** — que é o ponto cego medido e documentado no
próprio README (o caso do Fernando). Aceitar o silêncio do instrumento aqui
seria repetir o "pagante sem acesso: zero" de 07/09.

Conferi na mão, por **três chaves independentes**: e-mail exato, `email ILIKE`
(`%limas%`, `%rodrigo.lima%`) e `display_name ILIKE` (`%rodrigo%lima%`,
`%jorge%rodrigo%`, `%lima%miranda%`). **Zero em todas.** Ele realmente nunca
criou conta em lugar nenhum.

## 6. O que eu fiz

**Escrevi para ele** (regra 8 de 21/08: e-mail individual sobre caso que estou
tratando é decisão minha). Mandei **antes pra mim mesmo** e reli renderizado —
e-mail não tem desfazer. Corrigi uma frase que se contradizia antes do envio
real. Enviados **uid 1935, cópia CONFIRMADA**.

O e-mail conta a verdade — que a falha foi nossa, que ele não fez nada errado —
e oferece as duas saídas, **deixando a escolha com ele**: reembolso dos R$97 ou
acesso liberado na mão. Não prometi o que não é meu decidir.

**Escalei no grupo às 00:45Z** com o prazo na mão. Reembolso é dinheiro:
decisão do Johnny, vence **13/09 00:00Z = 12/09 21h BRT**.

**Anotei o `#305`** (notas 4 → 5, gravação conferida na releitura, 1 linha
afetada) com tudo acima.

**Não** mexi em crédito, **não** estornei, **não** cancelei nada, **não**
gastei GPU, **não** subi código.

## 7. Por que o `#305` continua `investigating` (regra 14)

Tratei a **pessoa**, não a **causa**. O defeito do `#305` — o `avisarCompraOrfa`
do webhook não disparou em 06/09 e não deixou rastro — **segue sem explicação**.
Marcar `fixed` agora seria exatamente o que a regra 14 proíbe.

## 8. Leandro (`#254`): a janela fechou, e o que ainda dá pra salvar

A janela dele virou **00:00Z**, 0,7h antes desta ronda. Ele esperou **172,2h de
prazo dentro da nossa fila**. Estorno: zero. O Vigia já mediu isso às 00:12Z e
**não re-medi** — não ia melhorar o número.

O tratamento estava **procedimentalmente certo**: foi avisado **2×** nos dois
endereços em 06/09, nunca respondeu em 5 dias, e pela **9-C** ninguém cancela
assinatura de titular sem pedido escrito.

**O que eu acrescento, que ainda é acionável:** a dobra **continua `active` nos
dois endereços**. A garantia deste ciclo acabou, mas o **próximo** ciclo não
depende de garantia nenhuma. `date_next_charge` **não existe** nesses payloads
(não invento a data), mas o `access_until` está pago até **28/09** e **30/09** —
é por aí que cai a próxima cobrança duplicada. Ou seja: **~2,5 semanas pra
decidir, não horas.** Isso deixa de ser emergência e vira decisão com prazo.

## 9. Números da ronda

- **75 incidentes abertos → 75. Nenhum fechado.** (73 → 75 desde a ronda das
  20hZ: 2 novos.)
- **1 e-mail para aluno** (Rodrigo, uid 1935 confirmado) · **1 incidente
  anotado** (`#305`, 4→5) · **1 escalação urgente ao grupo**.
- **0 PR, 0 commit de código, 0 GPU, 0 crédito mexido, 0 estorno, 0
  cancelamento, 0 migration.**
- **Garantia × fila:** 6 perderam a janela (era 5 — entrou o Leandro), 2 vencem
  em 48h. O `#306`/Rodrigo sai da lista de "vence em 48h" **com a pessoa
  avisada** pela primeira vez.
- 🧹 Higiene, **inalterada**: seguem **8 arquivos** modificados não commitados em
  `frontend/**/sgp*` e `frontend/messages/*`, mais não rastreados em
  `_frank/rascunhos/` e `frontend/src/lib/sgp/`. **Décima nona ronda seguida.**
  Não são meus, **não toquei**. Meus arquivos de trabalho ficaram em `/tmp`,
  fora do git.

## O que a próxima ronda pega

1. **A resposta do Rodrigo**, se vier — e a decisão do Johnny sobre o reembolso.
   O prazo morre **12/09 21h BRT**. Se ele responder "quero usar", liberar o
   acesso na mão e confirmar com ele.
2. **Os 2 patches parados** — `patch_3dbd2bf0` (dedup de foto do SGP) e
   `patch_81438b60` (face-gate do Vídeo Clone). Dívida de duas rondas; aplicam
   limpo. Patch parado é conserto que não existe.
3. **Os antigos que não andam**: `#15` (30/07, 18 afetados), `#47`, `#99`.
   **Cinco rondas.**
4. **O `#356`** (Teresa, R$ 2.809,32) — anotado em 20hZ, ainda não tratado.
   Rodar o `detector_preso_fora_da_conta.cjs` nela antes de qualquer resposta.
