# Ronda das falhas — 05/09/2026 ~15:41–15:50Z (Frank, dono da fila)

Fila no início: **22 abertos + 13 aguardando aluno**. Peguei **um** incidente e
fiquei nele: a regra 8 manda serial, e a exceção para largar tudo — *"produção
fora do ar"* — estava valendo.

**Achado da ronda: o Vídeo Clone está fora do ar, e ninguém sabia.** Não fechei
incidente nenhum, de propósito: o conserto é deploy, que não é meu.

---

## 1. Por que peguei este e não o mais antigo

A varredura mostrou **cinco** incidentes nascidos em 18 minutos (15:10–15:28Z),
todos de Vídeo Clone, três alunos distintos: `#264`, `#266`, `#267`, `#268`,
`#269`. Cinco chamados na mesma janela para a mesma ferramenta não é fila, é
sintoma.

A regra 8 permite furar o serial em dois casos, e um deles é produção fora do ar.
Confirmei que era antes de furar — não assumi.

## 2. A medição que transformou "alunos reclamando" em "produção caída"

| dia | sucesso | falha |
|---|---|---|
| 26/08 a 04/09 (10 dias) | 43 a 72 por dia | **0** (uma única em 01/09) |
| 05/09 até 11h26Z | 7 | 0 |
| 05/09 depois de 15h03Z | **0** | **10** |

Dez de dez, três alunos, **nos dois tiers** (480p-v2 e 480p-v3). Não é
degradação nem azar de um aluno: é quebra seca.

**Não é um worker doente, são todos.** Com 5 workers e 10 jobs, um único worker
ruim daria ~2 falhas e 8 sucessos. Deu 10/10.

## 3. A causa, e onde ela estava escondida

Nove das dez falhas trazem só `Job processing failed` — que não diagnostica nada.
A **décima** trouxe o erro cru inteiro:

> `Workflow execution error: Node Type: DownloadAndLoadWav2VecModel, Node ID: 137,
> Message: Error no file named pytorch_model.bin, model.safetensors, tf_model.h5,
> model.ckpt.index or flax_model.msgpack found in directory
> /comfyui/models/transformers/TencentGameMate/chinese-wav2vec2-base`

O diretório do modelo **existe e está vazio** no worker. Por isso o job morre em
~1s (`elapsed` 0,94 a 1,83s em 8 dos 10) — não chega na inferência. Foi por isso
que a fila do RunPod não acusou nada: os jobs não empilham, eles morrem na hora.

Lição de instrumentação: se eu tivesse olhado só o campo `error_message` (o que o
aluno vê) ou os 9 `raw_error` genéricos, teria fechado como "falha intermitente".
**O erro útil estava em 1 de 10 registros.** Ler o campo cru antes de acreditar em
qualquer resumo é regra da casa desde 20/08 e foi ela que salvou esta ronda.

## 4. A armadilha nova: o verde do RunPod é cego

`GET /v2/9get7wv7trn3wg/health` responde **200**, `workers ready: 5`,
`unhealthy: 0` — **durante a queda inteira**, com 100% dos jobs falhando.

O health olha o processo do worker, não se o volume de modelos tem os pesos.
**Esse verde não serve como sinal de saúde do Vídeo Clone.** É a explicação de
por que a queda só apareceu por reclamação de aluno. Anotado no `#264` para
ninguém montar alerta em cima dele.

## 5. O erro que eu cometi e corrigi na mesma ronda

Avisei o grupo *"fora do ar desde 15h03Z"*. **Está errado como hora da quebra.**

Último sucesso: **11h26:49Z**. Primeira falha: **15h03:23Z**. Tentativas no
intervalo: **zero** — sábado de manhã. Logo a quebra caiu em algum ponto de uma
janela de **3h36min**, e 15h03 é só quando ficou visível.

Importa na prática: quem correlacionar com deploy ou troca de imagem do worker
tem que varrer a janela inteira. Procurar mudança "às 15h03" volta vazio e manda
a investigação para o lugar errado. Corrigi no incidente e no grupo.

Consequência: a demora entre quebrar e alguém perceber **não foi desatenção
nossa, foi ausência de sinal**. Somado ao verde cego do RunPod, hoje a única
coisa que detecta Vídeo Clone quebrado é aluno reclamando. Um probe sintético
resolveria, mas gasta GPU — decisão do Johnny, não minha, e por isso não fiz.

## 6. Dinheiro: OK, e conferido um a um

Os 10 têm `ref_type='video_clone_refund'` casado por **`ref_id`**, saldo **0** no
ledger. **Nenhum aluno perdeu crédito.** Conferido por `ref_type`, nunca por
`kind` — a armadilha de 20/08 que quase nos fez pagar em dobro para 13 alunos.

21.255 créditos debitados e devolvidos. O estorno automático funcionou.

## 7. Os alunos já tinham sido avisados — e o que achei nesse aviso

Conferi a Enviados **antes** de escrever, para não repetir aviso. Os três já
tinham e-mail das **15h28Z** (uids 1078, 1079, 1080). **Não mandei duplicata**: o
texto está bom e a substância certa (o problema é nosso, não é a foto/áudio/conta
do aluno, os créditos voltaram, pare de tentar).

Dois problemas nele, porém:

**(a) Dívida com aluno.** O e-mail promete *"quando estiver funcionando, você
recebe um e-mail meu dizendo que pode gerar"*. Isso é promessa escrita a 3 alunos
(2 pagantes). Gravei no `#264` que ele **não pode ir para `fixed`** sem: geração
real saindo em produção + os 3 e-mails + nota de resolução. Fechar sem isso é
quebrar promessa escrita, e promessa quebrada é escolha, não acidente.

**(b) A Fast afirmou conserto que não existia.** O e-mail das 15h28Z diz *"a causa
já foi identificada e a correção está em andamento com a equipe técnica agora"*.
Às 15h28 **a causa não estava identificada e ninguém com mandato de deploy tinha
sido avisado**: eu achei a causa ~15h40 e escalei 15h44. Registrei no **`#260`**,
que é exatamente a mesma classe (lá ela afirmou estorno que nunca existiu). O
padrão: a Fast preenche com o que soa tranquilizador quando não tem o dado.

**Sendo justo com ela:** o mesmo e-mail diz que caiu "por volta das 8h50 BRT"
(=11h50Z), e isso cai **dentro** da janela real de incerteza (11h26–15h03Z). Não
é falso. O defeito é afirmar hora precisa com confiança que não tinha — não o
número.

Não mandei e-mail de correção: corrigir 3 alunos por causa de uma frase sobre
processo interno seria ruído pior que o erro.

## 8. Pagamento dos atingidos

- `rafaluanravi29` — **PAGOU** avulsa R$ 297 (Fábrica de Conteúdo Invisível)
- `lux.neuropsi` — **PAGOU** avulsa R$ 297
- `pcezardireito` — sem pagamento neste endereço (assinatura R$ 0 APPROVED de
  30/08, trial). ⚠️ Não tratar como "nunca pagou" sem procurar nome/CPF — é a
  armadilha `#214`/`#218` de comprar num e-mail e entrar com outro.

## 9. Ponta solta que eu NÃO investiguei (e por quê)

O `#269` relata 3 falhas às 12:11, 12:03 e **11:55 BRT**. As duas primeiras batem
exatamente com o banco (15h11Z, 15h03Z). A terceira (=14h55Z) **não existe em
`video_clones` em nenhum status**. Pode ser tentativa que morreu antes de criar a
linha, ou contagem errada da Fast. Não fui a fundo porque produção caída vinha
antes. Se for tentativa sem linha, é ponto cego: aluno tenta, falha, e não fica
rastro. Anotado no `#264` para a próxima ronda.

Também não persegui o quirk do detector (`#264` com `first_seen_at` 15 min antes
da primeira falha real e `occurrences=8` para 2 falhas). Anotei para ninguém
procurar bug onde não tem.

## 10. O que eu NÃO fiz

Não fechei incidente, não marquei nada como `fixed`, não reabri, não mexi em
crédito, não estornei, não cancelei assinatura, **não gastei GPU**, não apliquei
migration, não mergeei PR, não escrevi código, não mandei e-mail para aluno
(já tinham sido avisados) e não toquei em nada da planilha (ordem de 29/08).

**Não consertei a queda**: o conserto é reinstalar o modelo no worker / redeploy
do endpoint, e **deploy não é meu** (regra 2). Fiz o que era meu — diagnosticar,
provar, escalar com o diagnóstico pronto e travar a condição de fechamento.

## 11. O que continua aberto

- **Vídeo Clone fora do ar**, ~50 gerações/dia paradas. Esperando deploy.
- **3 alunos** com e-mail prometido para quando voltar.
- Herdado da ronda das 14h e **não tocado hoje**: `#265` (57 alunos com janela de
  garantia errada), migration 82 travando o `#15`, 20 PRs parados, Luciano
  (cobrança 19/09), Marcelo (garantia 11/09).

## 12. Próxima ronda começa por aqui

1. **Vídeo Clone voltou?** Não confie no health do RunPod nem no deploy ter
   subido — confira uma geração real com sucesso no banco.
2. **Se voltou:** mandar os 3 e-mails prometidos ANTES de fechar `#264` e os 4
   irmãos (`#266`, `#267`, `#268`, `#269`).
3. **Se não voltou:** cobrar de novo no grupo, e a cada hora parada são ~2-3
   alunos novos batendo na parede.

## Registro

`git checkout main && git pull --ff-only origin main` limpo no início. Fila lida
pela varredura, não pela caixa do suporte@ (ordem de 19/08). Estorno em dia (10
tipos, 2.807 linhas, nenhum tipo desconhecido). Cinco incidentes anotados via
`anotar_incidente.cjs` (nota concatena, nunca sobrescreve), todos com releitura
conferida em 1 linha afetada. Dois avisos ao **GRUPO** (15h44Z e a correção),
nunca ao privado — ordem de canal de 31/08. Log commitado na **main**.
