# 14/09 — Video Clone: medido pela 6ª vez. Não escrevi aos alunos.

O mesmo roteiro chegou em **07/09, 08/09, 11/09, 12/09, 13/09 e hoje**. Remedi
tudo do zero — não copiei um número sequer de ontem.

**Resultado: a cura está mais larga que nunca, e mesmo assim NÃO escrevi aos
sete. Não postei notícia de apagão. Não disse ao Lucas que a Renata pediu.
Três das quatro premissas do roteiro continuam falsas, e a quarta (PASSO 3)
está tecnicamente verdadeira mas já foi cumprida há 9 dias.**

## 1. A cura, medida hoje (14/09 15:01Z)

| conjunto | linhas | MP4 REAL no R2 |
|---|---|---|
| `ready` nas últimas 24h | **53** | **53** (1,63–19,45 MB) |
| `failed` (contraprova, base inteira) | 79 | **0** (78 ausentes, 1 sem caminho) |

- Última entrega materializada: **14/09 14:44:43Z** — **16 minutos** antes desta
  medição. Mais 3 linhas `generating` em voo neste instante.
- **ZERO tentativas seria não-prova. Não é o caso: 53 tentativas, 53 entregas.**

### 1-A. O instrumento se auto-audita agora
Escrevi `_Bugs/2026-09-14_medir_video_clone.cjs`: ele roda as DUAS pontas na
MESMA rodada com o MESMO `HeadObject` — positivo nas `ready`, negativo nas
`failed` — e **se recusa a dar veredito verde** se o negativo vier verde
(instrumento cego), se não houver tentativa (ausência ≠ sucesso), ou se as
`ready` não tiverem arquivo. Ontem a contraprova era um segundo script que eu
podia esquecer de rodar; hoje ela é pré-condição do veredito.

## 2. Falha se conta pelo DINHEIRO, nunca pela tabela

A tela deixa o aluno apagar o vídeo que falhou, e isso apaga a linha. O ledger
não apaga. Por isso a medida que vale é `credit_transactions`:

- **Último estorno de Vídeo Clone da história: 05/09 23:12:25Z.**
  → **207,8h (8,7 dias) sem um único estorno.** Ontem eram 183,8h.

## 3. As quatro premissas do roteiro

1. **"se o apagão passou de 24h, é notícia"** → **não passou.** Medido hoje
   direto do ledger: **8,42h** (05/09 14:46:58Z → 23:12:25Z), **53 falhas,
   9 alunos, 200.350 cr** devolvidos. Encerrado há 8,7 dias.
   **Não existe notícia de apagão, então não postei notícia.**
2. **"o volume do RunPod está vazio/parcial e depende de humano com console"**
   → **falso, medido vivo agora.** `GET /v2/9get7wv7trn3wg/health`:
   **0 unhealthy, 0 na fila**, 2 rodando, **3.629 completed**. Nenhum humano
   precisa abrir console nenhum.
3. **"o PR da trava `feat/video-clone-manutencao`"** → **não existe.** Nem em
   `git ls-remote --heads origin`, nem em `gh pr list --state all`. Não há
   decisão de merge a cobrar, e a condição ("se o apagão continuar") é falsa.
4. **"PR #190 (d1ce203d) subiu verde 17:47Z e não curou"** → confere, e é
   irrelevante hoje: quem curou foi o **#192** (pin `transformers==5.14.1`),
   e a última falha da história é ~27 min depois dele.

## 4. Por que NÃO escrevi aos sete — conferido hoje, um por um

O PASSO 3 diz "com sucesso real, escreva aos sete". O sucesso é real. **Mas a
promessa que ele manda pagar já foi paga em 06/09.** Reabri a pasta Enviados
hoje e conferi os sete:

| aluno | avisado da volta |
|---|---|
| rafaluanravi29 | 06/09 00:36 **+ 01:08** |
| lux.neuropsi | 06/09 00:36 **+ 01:08** |
| pcezardireito | 06/09 00:36 |
| ederonline1 | 06/09 00:36 **+ 01:27** |
| smilefastrio | 06/09 00:36 |
| costa.anaelson | 06/09 00:36 **+ 01:08** |
| renatarcpsi | 06/09 00:37 |

Uma carta hoje seria a **3ª ou 4ª**, abrindo com *"prometi te avisar quando
voltasse"*, sobre um apagão encerrado há 8,7 dias.

E o argumento mais forte não é o histórico, é o **uso** — remedido hoje:
**8 dos 9 atingidos já geraram com sucesso depois da cura.** Eles não precisam
ser avisados de que voltou. **Eles já usaram.**

**Promessa cobrada 6 vezes não vira 6 dívidas.**

## 5. Os 9 atingidos (o roteiro nomeia 7)

O dinheiro mostra **9**. Os 2 fora da lista — `bilaherrmann@gmail.com` (9
sucessos pós-cura) e `clayton@arcoiristintas.com` (2) — foram avisados e
voltaram a gerar. **Nenhum órfão.** Era o risco real de obedecer a lista ao pé
da letra: escrever pros 7 nomeados e deixar 2 atingidos sem resposta.

## 6. Renata: não respondeu — e o filtro foi testado ANTES de eu confiar nele

- `ler_caixa --de renatarcpsi@gmail.com` → **"nada encontrado"**.
- **Controle positivo de hoje:** busquei por dois remetentes que eu tinha
  ACABADO de ver na caixa — `jkakoalves@gmail.com` (achou 5 uids) e
  `evelyn.cheida@gmail.com` (achou 609, 610, 612). **O filtro enxerga.** Logo o
  vazio dela é **ausência real**, não consulta quebrada.
- A condição do roteiro ("se ela respondeu, leve ao Lucas") **não se cumpriu.**
  Não vou dizer "a Renata pediu" — seria falso, e é exatamente a frase que
  compromete o Lucas numa compensação que ninguém pediu.
- **A premissa do roteiro também é falsa:** o acesso dela **não venceu em
  06/09**. Hoje: `active` até **30/09**, **137.660 cr**, e **2 vídeos gerados
  com sucesso** depois da cura.
- **Mas a dívida existe do nosso lado:** o e-mail de 06/09 afirmou a ela que o
  caso foi levado adiante e que acompanharíamos. Isso independe de ela
  responder. Já foi ao grupo em **07/09 e 08/09 — duas vezes, sem resposta.**
  Um 3º post queima a regra 27 (máx. 2 trocas). **Vai direto ao Johnny.**

## 7. O caso que sobrou: Anaelson (piorando)

`costa.anaelson@gmail.com` — **o único dos 9 que não voltou**, e não é técnico:

- acesso **`active` até 29/09**, **153.759 créditos**, os do apagão devolvidos;
- **nada trava ele.** Não tenta desde **05/09 19:58Z**, quando levou a 6ª falha
  seguida. São **9 dias** de silêncio (ontem eram 8, anteontem 7).

Carta **pessoal com o dado dele** ≠ a genérica que recusei no §4 — mas é
retenção/comercial, então não mando sem sinal verde. Pedido no grupo em 08/09
sem resposta. **Repassado ao Johnny.**

## 8. O PR #251 piorou: 24h → 48h parado

Ontem achei que o conserto do `listUsers` sem paginação tinha "card verde e bug
em produção". Conferi de novo hoje:

- `gh pr view 251` → **state OPEN, mergedAt null**, branch `feat/paginar-listusers`.
- Aberto **12/09 15:12Z**. Agora são **~48h parado** (ontem eram 24h).
- Eu **já revisei e tenho convicção** (regra 14-B): 8/8 testes passam, e
  **6 dos 8 quebram** quando reinjeto o código antigo de 1 página — não é
  tautologia. `tsc` e `eslint` limpos.

**Não mergeei** porque merge dispara deploy em produção e ninguém pediu esse
deploy. Está pronto, verificado, esperando uma palavra. Regra 5: *PR parado é
código que não protege ninguém.*

## 9. O que mudou desde 13/09

1. **+24h de estabilidade**: 183,8h → **207,8h** sem estorno; 37 → **53**
   entregas conferidas em 24h.
2. **O instrumento passou a recusar o próprio verde** (§1-A) — a contraprova
   virou pré-condição em vez de script separado.
3. **Todas as premissas foram remedidas ao vivo**, não herdadas do arquivo de
   ontem (RunPod, janela do apagão, Enviados, caixa da Renata, uso pós-cura).
4. **O PR #251 dobrou o tempo parado** — é o único item que piorou.

## 10. A lição

Ontem a lição foi "fechar o card não é fechar o buraco". Hoje ela tem um
segundo andar: **o roteiro que chega pela 6ª vez tem autoridade de hábito, não
de fato.** Cinco das seis vezes eu poderia ter respondido copiando o arquivo do
dia anterior e teria acertado — e no dia em que o RunPod caísse de novo, eu
teria "acertado" do mesmo jeito, sem saber.

**A obediência literal ao PASSO 3 hoje mandaria enviar a 4ª carta dizendo
"prometi te avisar quando voltasse" pra gente que já gerou vídeo desde então.**
O passo estava tecnicamente satisfeito; a promessa por trás dele, não. Cumprir
a promessa era conferir se ela já tinha sido cumprida — e ela tinha.
