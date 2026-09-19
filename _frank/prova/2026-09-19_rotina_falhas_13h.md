# RONDA DAS FALHAS — 19/09, ~13hZ

Dono da fila (14-A). Ronda anterior: `2026-09-19_rotina_falhas_12h.md`. Método
serial da regra 8: **não peguei incidente novo** — o #329 já era o meu, estava em
voo, e o que chegou nele nesta ronda mexe em dinheiro que está na mesa do Johnny.
Fechar a premissa errada antes de pegar outro é a própria regra 8.

---

## 0. Passo fixo — reconciliação dos envios (#101)

```
703 lidas da pasta "Sent" = 626 já tinham linha + 77 fora da janela + 0 escrituráveis
🕳️ cartas que saíram e não têm linha, DENTRO da janela: 0
```

Conferido com o irmão de leitura (`2026-09-18_enviados_x_tabela.cjs`), instrumento
independente: **0 carta depois do corte**, veredito "buraco é PASSIVO". As **77
anteriores a 14/09 14:06:31Z seguem sem decisão** — continua decisão de produção,
não de ronda, e eu não a tomei.

## 1. Estado da fila

| status | n |
|---|---|
| fixed | 278 |
| investigating | 92 |
| ignored | 59 |
| aguardando_aluno | 34 |
| open | 1 |

**Classe de percepção (ordem de 17/09): 11 cartões**, o mais velho de **01/09 —
18 dias**. Vale a ressalva medida na ronda anterior: a consulta casa por PALAVRA
e **superestima**; abrir antes de despachar.

---

## 2. O fato desta ronda: a premissa que eu mesmo pus na mesa do Johnny estava errada

A ronda das 12hZ levou ao grupo a recomendação de devolver **41.600 cr** sustentada
em *"a casa nunca avisou da deriva >40s no Turbo"*. **Medi hoje e é falso para aluno
em pt-BR.** Quem levantou a lebre foi o `coder` no cartão `cc2617f6`, que em vez de
executar o cartão de olhos fechados foi conferir a premissa e devolveu refutação
parcial. **Eu não aceitei a refutação dele de graça — refiz cada perna:**

| o que | como medi | resultado |
|---|---|---|
| a frase existe e é tier-neutra | `pt-BR.json` no estado de **07/09** (último commit antes das gerações dele) | **"…nos dois modos: prefira vídeos curtos"** — presente |
| entrou quando | `git log` + `merge-base --is-ancestor` | `6e2f1821`, **24/08**, ancestral de `origin/main`, sem revert no intervalo |
| aparece com Turbo selecionado | `clone-studio.tsx:531` | renderiza **fora do laço** dos tiers (depois do `</ul>`) → tier-neutro |
| ele via em português | `i18n/routing.ts` | `defaultLocale: pt-BR`, `localeDetection:false`, raiz "/" sempre pt-BR; só sai clicando `/en` ou `/es` |
| estava no ar | API de runs, janela 24/08→09/09 | **75 deploys** `Deploy Frontend (production)` com `conclusion=success` |

**Ressalva honesta:** não tenho registro do locale da **sessão** dele. Medi o default
e o custo de sair dele. É inferência forte, **não** medição direta da sessão — e está
escrito assim na nota do cartão.

### O contrapeso, que também é fato

Não virei advogado da casa. As duas coisas que seguram o outro lado:

1. O **blurb do Turbo**, no cartão em que ele clicou, dizia *"mesma qualidade"* e
   nada de deriva. **A casa se contradizia na mesma tela.**
2. `CLONE_MAX_AUDIO_SECONDS = 90` aceita o **dobro** do limite seguro que a casa
   documenta (~40s), **sem gate e sem aviso na hora de gerar**.

### Uma armadilha que eu quase comi sozinho

Medindo os deploys, a primeira consulta (`gh run list --limit 100`) devolveu
**1 deploy** na janela, o que teria me feito escrever "não estava em produção" —
conclusão oposta à verdadeira. O 100 **batia exatamente** no fundo da lista
(`mais antigo == 2026-09-09T23:53:20Z`): era **truncamento**, não escassez.
Paginando pela API: **75**. É a armadilha do "Supabase corta em 1000 linhas" com
outra roupa — **o limite do instrumento imitando um achado**. Conferir o fundo da
janela antes de acreditar em número baixo.

## 3. O dinheiro, reconferido do zero (não herdado)

| regime | jobs | cr |
|---|---|---|
| **>40s, todos Turbo** | 8 | **41.600** |
| ≤40s | 5 | 7.425 |
| total Vídeo Clone | 13 | 49.025 |

Bate com a ronda anterior. Achei um **14º** lançamento `kind='video'` de **7.900 cr**
(`ref_type='image_video'`, "Animar imagem — Prata", `ref_id 4304d732…`) que **não é
Vídeo Clone** e corretamente fica fora da disputa — a ronda anterior estava certa em
não contá-lo. Registro porque minha própria consulta o classificou errado: a duração
não casa no regex, `NULL > 40` é `NULL`, e ele caiu no `else` como se fosse curto.

## 4. O veredito do `olho` (`c677967f`) — chegou, e é veredito de AGENTE

O cartão que a passagem anterior deu como não-entregue **completou às 08:08** (depois
que aquela ronda fechou). Notas: **4,5/10** (25s), **4,0/10** (49s), **7,0/10**
(refazimento da casa); julga que o aluno tem razão em pedir estorno dos dois pagos.

**O que eu confirmei sozinho** (`ffprobe`): 480×832 nos três, durações 25,64s /
49,08s / 72,68s, fotos de entrada 941×1672 e 940×1672.
**O que eu NÃO reproduzi:** a graduação de deriva quadro a quadro. Olhei o
`face_grid` e a foto de entrada: confirmo que a pessoa é reconhecivelmente a mesma,
mas **nessa escala não sustento nota de semelhança**. Entra no cartão marcado como
veredito de agente, **não** como medição da casa.

### A frente nova que isso abre — e que eu deliberadamente não fechei

O job de **25s é Padrão 2.0 e ≤40s** — está no balde que a casa chamou de **cobrança
legítima** — e mesmo assim levou **4,5/10**. Se a insatisfação dele não for só deriva
de áudio longo, **o recorte "41.600 porque passou de 40s" não cobre o caso**. Isso
**não está medido** e não virou conclusão. Fica anotado como o próximo fio.

## 5. Fatos consumados desta ronda

1. **Reconciliação dos envios** — 703 = 703, 0 escrituráveis, conferida por
   instrumento independente.
2. **Refutei a premissa dos 41.600** por 5 medições próprias, com a ressalva do
   locale declarada.
3. **Reconferi o dinheiro** do zero: 41.600 confirmado; entendido e descartado o 14º
   lançamento de 7.900.
4. **Gravei a nota no `85ca1863`** (6 → **7 notas**, conferido na releitura, 1 linha
   afetada).
5. **Postei a correção no grupo**, marcada como correção de algo que eu mesmo
   mandei errado 25 min antes.
6. **`cc2617f6` entregue:** PR **#351** aberto (aviso nos dois tiers + na hora de
   gerar, + buraco do `en.json` que nem eu nem o cartão tínhamos visto). **Não
   mergeado.**

## 6. O que eu NÃO fiz

- **Não fechei incidente nenhum.** O #329 não está resolvido: falta a decisão de
  dinheiro do dono. 92 `investigating` é o número honesto.
- **Não devolvi crédito, não prometi devolução, não escrevi pro aluno.** Ele foi
  respondido em 13/09 e o que ele espera é exatamente a decisão do Johnny.
- **Não mergeei nada.** PR #351 segue aberto.
- **Não li a caixa do suporte@ pra triagem.**
- **Não gastei GPU**, não toquei em crédito, acesso, voz nem migration.
- **Não despachei os outros 10 cartões de percepção.**

## 7. Para quem pegar a próxima ronda

1. **Os 41.600 continuam na mesa do Johnny — agora com a premissa certa.** Se voltar
   "pode devolver", o estorno é de vídeo: grave por `ref_type` de estorno (**nunca**
   por `kind`) e **confira a linha na releitura**, porque update por id inexistente
   afeta 0 linhas em silêncio.
2. **Puxe o fio do 25s.** É o único fato que não fecha com a tese da casa: job curto,
   no tier caro, dentro do balde "legítimo", e ainda assim ruim na perícia. Se ele se
   confirmar, o caso não é "passou de 40s", é qualidade — e o recorte muda de tamanho.
3. **Premissa de cartão é para ser conferida, não obedecida.** Foi o `coder` duvidando
   do meu cartão que impediu uma devolução de 41.600 cr sustentada em algo falso.
   Cartão bem escrito e errado continua errado.
4. **Número baixo pode ser o instrumento, não o mundo.** `--limit 100` fabricou
   "1 deploy" onde havia 75. Antes de concluir a partir de um número pequeno, confira
   se ele não é exatamente o fundo da janela do instrumento.
5. **Passagem é relato, banco é fato** (lição herdada da ronda anterior, que se
   confirmou de novo aqui: o cartão do `olho` dado como não-entregue estava
   `completed`).
