# 12/09 — Video Clone: medido pela 4ª vez. Não escrevi aos alunos.

Mesmo roteiro chegou em **07/09, 08/09, 11/09 e hoje**. Remedi do zero — não
copiei nada de ontem. Fiz bem em remedir: **achei um defeito de instrumento que
a medição de ontem não pegou** (§6).

**Resultado: cura confirmada e ampliada. Não escrevi aos sete. Não postei
notícia de apagão. Não disse ao Lucas que a Renata pediu. Duas decisões de
gente vão ao Johnny.**

## 1. A cura, medida hoje (12/09 ~15:00Z)

Instrumento: `_Bugs/2026-09-11_provar_clones_r2.cjs` — `HeadObject` no R2. **Não**
`video_path is not null`: esse campo é gravado na criação e existe também nas
linhas `failed`.

| conjunto | linhas | MP4 REAL no R2 |
|---|---|---|
| `ready` nas últimas 24h | 51 | **51** (0,72–25,21 MB) |
| últimos `ready` dos alunos do roteiro | 13 | **13** |
| **contraprova**: linhas `failed` | 30 | **0** (29 ausentes, 1 sem caminho) |

A contraprova é o que autoriza concluir: o instrumento **distingue**. Sem ela,
"51/51 OK" poderia ser instrumento cego dizendo sim.

- **Últimos 7 dias:** 383 `ready`, 24 `failed` (**todas de 05/09**), 1
  `generating` **agora** (12/09 14:59:07Z). Não é "ausência de falha": é
  produção medida.
- Última entrega materializada: **12/09 14:37:15Z**.
- **ZERO tentativas seria não-prova. Não é o caso: 383 sucessos em 7 dias.**

## 2. Falha se conta pelo DINHEIRO, nunca pela tabela

Reconfirmado (achado de 06/09, revalidado 08/09 e 11/09). A tela do aluno deixa
apagar o vídeo que falhou, e isso **apaga a linha**:

| instrumento | falhas | alunos |
|---|---|---|
| `video_clones.status='failed'` | 24 | 6 |
| ledger `credit_transactions.ref_type='video_clone_refund'` | **53** | **9** |

O PASSO 1 do roteiro ("consulte video_clones") mede bem o SUCESSO e é **cego pro
lado da falha** — perde 3 dos 9 atingidos.

- **Último estorno de Vídeo Clone da história: 05/09 23:12:25Z.**
  → **~160h (6,7 dias) sem um único estorno.** Ontem eram 142h.

## 3. As premissas do roteiro — as mesmas 4 continuam caindo

1. **"se o apagão passou de 24h é notícia"** → **não passou**: **8h25m27s**
   (05/09 14:46:58Z → 23:12:25Z), 53 falhas, 9 alunos, 200.350 cr devolvidos.
   Medido hoje pelos dois instrumentos, não copiado. Encerrado há **~160h**.
   Não existe notícia, então não postei notícia.
2. **"o acesso da Renata vencia 06/09 e ela perdeu dias"** → ela **renovou**:
   `active` até **30/09**, 137.660 cr. E gerou 2 vídeos com sucesso após a cura.
3. **"o PR da trava `feat/video-clone-manutencao`"** → **não existe**. Não está
   em `gh pr list --state all` nem em `git ls-remote --heads origin`. Não há
   decisão de merge a cobrar, e a condição ("se o apagão continuar") é falsa.
4. **"PR #190 (d1ce203d) subiu verde 17:47Z e não curou"** → confere que não
   curou. Quem curou foi o **#192** (pin `transformers==5.14.1`).

## 4. Por que NÃO escrevi aos sete

Conferi **Enviados**, um por um, com meus olhos. Os sete já receberam o "voltou"
em **06/09**, e vários receberam **duas vezes** (assuntos distintos: *"Voltou:
voce ja pode gerar o seu Video Clone"* e *"Vídeo Clone voltou a funcionar"*).
Uma carta hoje seria a **3ª ou 4ª**, abrindo com "prometi te avisar quando
voltasse", sobre um apagão encerrado há quase 7 dias.

O argumento mais forte não é o histórico, é o **uso**: dos 9 atingidos, **8 já
geraram com sucesso depois da cura**, com arquivo conferido no R2. Eles não
precisam ser avisados de que voltou — **eles já usaram**.

A promessa foi paga em 06/09. **Promessa cobrada 4 vezes não vira 4 dívidas.**

## 5. Os 2 atingidos que o roteiro NÃO nomeia (novo hoje)

O roteiro lista 7. O dinheiro mostra **9**. Fui atrás dos que faltavam:

| aluno | estornos | avisado? | voltou? |
|---|---|---|---|
| `bilaherrmann@gmail.com` | 6 (16.375 cr) | ✅ fora do ar + voltou | ✅ 06/09 23:14 |
| `clayton@arcoiristintas.com` | 4 (19.425 cr) | ✅ 3 e-mails | ✅ 07/09 21:54 |

**Nenhum ficou órfão.** Era o risco real de obedecer a lista do roteiro ao pé da
letra: escrever pros 7 nomeados e deixar 2 atingidos sem resposta. Checado e
fechado.

## 6. ⚠️ O instrumento mentiu hoje — e ontem ninguém viu

Rodando a prova por aluno, dois voltaram **"conta não encontrada"**:
`ederonline1@gmail.com` e `smilefastrio@gmail.com`. **É FALSO.** Os dois existem
(conferido em `auth.users`, ids `68bb3d3f` e `dad39108`).

**Causa:** `listUsers({ perPage: 1000 })` sem paginar, contra **2.542 usuários**.
O script enxerga 39% da base e chama o resto de inexistente — silenciosamente.

Se eu tivesse aceitado, teria concluído que 2 dos 7 alunos do roteiro "não têm
conta" e os deixado de fora. **É a armadilha do "consulta que erra volta vazia",
e ela pegou o instrumento de ontem também** (a medição de 11/09 reporta "13 + 3"
sem registrar que 2 nomes sumiram).

O mesmo defeito está em **produção**: `frontend/src/app/api/v1/generations/route.ts:74`
(`page: 1, perPage: 1000`, comentário "pra MVP basta 1 pagina") — na visão de
admin, ~60% das gerações aparecem sem o e-mail de quem fez. Não trava aluno e
não mexe em dinheiro, mas é justamente o tipo de cegueira que faz alguém decidir
errado. Card aberto pro `coder`.

## 7. Renata: não respondeu — e desta vez está PROVADO

- `ler_caixa --de renatarcpsi@gmail.com` → **vazio**.
- **A contraprova de ontem era fraca.** Ela contava 573 mensagens no INBOX, o
  que prova que a caixa tem mensagens — **não** que o filtro `FROM` funciona.
  Contar mensagem não testa o filtro.
- **Controle positivo de verdade (hoje):** busquei `--de` por dois remetentes que
  eu tinha ACABADO de ver na caixa — `victor.inscriptio@gmail.com` (achou uids
  492, 493) e `nelson.cesar@militarcoach.pt` (achou 573, 574). **O filtro
  funciona.** Logo o vazio da Renata é **ausência real**.
- A condição do roteiro ("se ela respondeu, leve ao Lucas") **não se cumpriu**.
  Não vou dizer "a Renata pediu" — seria falso, e é exatamente o tipo de frase
  que compromete o Lucas numa compensação que ninguém pediu.
- **Mas o e-mail de 06/09 afirmou a ela que o caso foi levado adiante e que
  acompanharíamos até ter retorno.** Isso é dívida nossa, independente de ela
  responder. Já foi ao grupo em **07/09 e 08/09 — duas vezes, sem resposta**. Um
  3º post queima a regra 27 (máx. 2 trocas). Vai direto ao Johnny.

## 8. O caso que sobrou: Anaelson

`costa.anaelson@gmail.com` — **o único dos 9 que não voltou**, e não é técnico:

- acesso **`active` até 29/09**, **153.759 créditos**, os 23.310 do apagão
  devolvidos;
- **nada trava ele.** Não tenta desde **05/09 19:58Z**, quando levou a **6ª
  falha seguida**. São 7 dias de silêncio. Último sucesso: 03/09, antes do apagão.

Provavelmente desistiu. Carta **pessoal com o dado dele** ≠ a genérica que
recusei no §4 — mas é retenção/comercial, então não mando sem sinal verde.
Pedido no grupo em 08/09 sem resposta. Repassado ao Johnny.

## 9. O que mudou desde 11/09

1. **+18h de estabilidade** (142h → ~160h sem estorno), +51 entregas conferidas.
2. **Os 2 atingidos sem nome foram identificados e fechados** (§5).
3. **Um defeito de instrumento foi achado e virou card** (§6) — o único item que
   realmente exigia trabalho novo hoje.
4. **A contraprova da Renata deixou de ser fraca** (§7). A conclusão de ontem
   estava certa, mas estava certa por sorte: a prova não sustentava.

## 10. A lição

**Remedir é barato; reenviar é irreversível — e remedir também audita o
instrumento.** O roteiro chegou pela 4ª vez com premissas de 05/09 congeladas.
Nenhuma era verdade hoje. Se eu tivesse obedecido o PASSO 3 sem medir, sete
alunos pagantes receberiam a 4ª carta anunciando o fim de um apagão que eles
mesmos já esqueceram — e dois deles teriam ficado de fora por um bug de
paginação que eu só vi porque medi de novo em vez de copiar.

**O roteiro descreve o passado; o banco descreve o agora. E o instrumento também
precisa ser medido.**
