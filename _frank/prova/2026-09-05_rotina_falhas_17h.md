# Ronda das falhas — 05/09/2026 ~17:41–18:00Z (Frank, dono da fila)

Fila no início: **24 abertos + 13 aguardando aluno**. Segui no mesmo incidente
serial das duas rondas anteriores: **Vídeo Clone fora do ar** (exceção da regra
8, produção fora do ar).

**Resultado: a imagem corrigida subiu para produção às 17h47:54Z. Ainda não
posso dizer que voltou — ninguém gerou nada desde então. E a ronda passada
errou no diagnóstico do bloqueio.**

---

## 1. `gh pr list` primeiro — e ele já respondeu a pergunta da ronda

Instrução da ronda das 16h, mantida. O **PR #190 não estava mais na lista**:
mergeado **17h25:52Z**, commit **`d1ce203`**.

## 2. A ronda das 16h errou, e o erro tem nome

Eu escrevi às 16h55:

> *"Bloqueado em **revisão do PR #190 + rebuild da imagem**. Não é falta de
> conserto, é falta de quem mergeie **e reconstrua**."*

A segunda metade está errada. **O rebuild e o deploy são automáticos.**
`.github/workflows/comfyui-worker.yml` dispara em qualquer push que toque
`comfyui-worker/**`, e o job `deploy-runpod` (só na `main`) aponta o template
`810lqswobo` para a tag do commit e recicla os workers do endpoint
`9get7wv7trn3wg` sozinho. **O único passo humano era o merge.**

Medido nesta ronda, o encadeamento inteiro sem ninguém tocar no RunPod:

| evento | hora |
|---|---|
| merge do PR #190 (`d1ce203`) | 17h25:52Z |
| build `33980938405` começa | 17h25:55Z |
| imagem empurrada pro GHCR + smoke test | 17h47:15Z |
| `deploy-runpod` aponta o template e recicla (0 → 6 workers) | 17h47:19 → **17h47:54Z** |

Conferido do outro lado também, não só pelo log do CI: o template
`810lqswobo` responde `imageName: ghcr.io/johnnyoliveirasp/lucasarrial-comfyui:d1ce203`.

**Por que isso importa mais do que parece:** eu escalei ao grupo pedindo "quem
mergeia e reconstrói", e metade desse pedido era trabalho que ninguém precisava
fazer. Pedir socorro para uma coisa que já é automática gasta o crédito de
atenção do Johnny e atrasa o pedido que era real. **Antes de escalar "falta
alguém fazer X", ler o workflow e checar se X já é automático** — custou 2
minutos hoje, depois de ter custado uma escalada errada.

## 3. Não voltou (e a última falha é mais recente do que eu tinha)

Falha nova às **17h29:29Z**, estorno **17h29:33Z** — 4 segundos, a assinatura do
apagão. É o `ederonline1`, o 4º aluno, e é **depois do merge e antes do deploy**,
exatamente onde deveria estar. `elapsed_seconds = 1.005`.

Última falha conhecida passa de 16h31:02 para **17h29:33Z**.

**Desde o deploy (17h47:54Z) ninguém tentou gerar.** Zero linha nova em
`video_clones`, zero débito novo no extrato. Então não existe geração real para
provar nada, e eu não vou chamar de resolvido um deploy verde — foi exatamente
contra isso que a ronda das 15h se avisou ("health verde cego", "deploy
anunciado").

## 4. Dinheiro: a conta certa é 21, não 20

Ontem eu já tinha corrigido 10 → 20. Hoje o número fechado do dia é **21
falhas**, 4 alunos.

23 débitos `ref_type='video_clone'` × 21 estornos `ref_type='video_clone_refund'`,
casados 1-a-1 por `ref_id`. Os **2 débitos sem estorno são os 2 sucessos**,
conferidos linha a linha em `video_clones`:

| débito | aluno | valor | hora | status |
|---|---|---|---|---|
| `00cc27e5` | lomba@elitesom.com.br | 5.680 | 10h19:45 | **ready** |
| `d15a199b` | vitor.dutra… | 5.880 | 11h26:50 | **ready** |

**Ninguém perdeu crédito.** Conferido por `ref_type`, nunca por `kind` — o
estorno grava `kind='extra_purchase'` (armadilha de 20/08 que quase pagou em
dobro a 13 alunos).

Nota para a próxima ronda: o `00cc27e5` é de **10h19**, fora da janela do apagão,
e por isso não aparecia na conferência da ronda das 16h, que olhou só de 14h46
em diante. Janela curta demais esconde débito legítimo tanto quanto janela larga
demais infla o número. Aqui a janela certa é o **dia**, não o surto.

## 5. O achado principal: o runbook do próprio PR foi executado ao contrário

O PR #190, seção *"Risco de subir a imagem"*, é explícito:

> **Ordem obrigatória:** 1. **Primeiro popular o volume**, depois mergear.

O que aconteceu foi o inverso: **mergeou primeiro**, e **o CI não roda o
`download_models.sh`** — ele só constrói e publica a imagem. Popular o volume é
passo manual, num pod com o volume montado.

Por que isso é perigoso e não só "subótimo":

- A imagem nova troca `/comfyui/models/transformers` por um **symlink para
  `/runpod-volume/models/transformers`** — ou seja, para o disco **persistente**.
- Se o volume não tiver o wav2vec, o node cai no `snapshot_download` **em
  runtime** e grava **através do symlink**, no volume. São ~380MB do wav2vec
  mais ~334MB do Demucs (que passou a ser lido do volume por causa do
  `TORCH_HOME` novo). ~715MB na primeira geração.
- O node testa **existência do diretório**, não do arquivo
  (`fantasytalking/nodes.py:53`). Se essa primeira geração for interrompida no
  meio, sobra **diretório pela metade no volume** — e aí o node **pula o
  download para sempre**, em todo worker e em toda reciclagem.

**Ou seja: hoje o apagão se cura sozinho na primeira geração (cara e lenta); uma
primeira geração interrompida transforma isso num apagão permanente.** É a mesma
classe que o PR descreve como *"envenena de forma permanente"*, só que promovida
do container efêmero para o disco que sobrevive a tudo.

O endpoint está com `workersMin=0`, então **não há worker quente**: a próxima
geração é necessariamente um cold start com a imagem nova.

**Não consigo conferir o conteúdo do volume daqui.** A API REST do RunPod dá
metadados do volume (`ff442v3132`, `infinitetalk-models`, 80GB, EU-NL-1) mas não
lista arquivos; para ver o conteúdo é preciso um pod com o volume montado, e eu
não crio pod — custa dinheiro e não é meu mandato.

### Falso alarme que eu quase dei

O template traz `volumeMountPath: /workspace`, e o symlink aponta para
`/runpod-volume`. Parece divergência grave. **Não é:** esse campo vale para Pod;
em Serverless o volume monta em `/runpod-volume`, e a prova está em produção —
o `extra_model_paths.yaml` usa `base_path: /runpod-volume` e todos os outros
modelos carregaram assim nas 41 gerações `ready` de hoje antes das 11h55.
Conferi antes de escrever no grupo, em vez de escalar susto.

## 6. O que eu propus e não fiz

A primeira geração depois do deploy é a arriscada. **Prefiro que ela seja um
teste por conta da casa do que a tentativa de um aluno pagante** — se for
interromper e envenenar o volume, que seja no nosso teste. Mas isso gasta GPU, e
GPU sem o aluno pedir exige "pode" do Johnny (regra). **Pedi no grupo às 17h58Z
e estou esperando.** Não gastei.

## 7. Dívida com aluno segue em 4

`pcezardireito`, `rafaluanravi29`, `lux.neuropsi` (avisados 15h28Z) e
`ederonline1` (avisado 16h47Z). Todos com **promessa escrita** de e-mail quando
voltar. `#264`, `#266`, `#267`, `#268`, `#269` e `#271` **não vão para `fixed`**
sem: geração real `ready` no banco + os **4** e-mails + nota de resolução.

Nenhum e-mail nesta ronda: não há fato novo para contar ao aluno. Deploy verde
sem geração que preste não é notícia boa, é notícia pela metade — e o `#260`
(a Fast afirmando o que soa tranquilizador sem ter o dado) é exatamente a classe
que eu não vou repetir no mesmo dia.

## 8. O que eu NÃO fiz

Não fechei incidente, não marquei `fixed`, não mexi em crédito, não estornei,
**não gastei GPU**, não apliquei migration, não mergeei PR, não escrevi código,
não toquei em nada da planilha (ordem de 29/08) e não li a caixa do `suporte@`
para triagem. No RunPod, **só leitura** (endpoint, template, volume) — nenhum
`PATCH`.

## 9. O que continua aberto

- **Vídeo Clone**: imagem corrigida em produção desde 17h47:54Z, **volta não
  comprovada**. Bloqueado agora em: (a) confirmar se o volume foi populado, e
  (b) uma geração real `ready`.
- **4 alunos** com e-mail prometido para quando voltar.
- Herdado e **não tocado hoje**: `#265` (57 alunos com janela de garantia
  errada), migration 82 travando o `#15`, 20 PRs parados, Luciano (cobrança
  19/09), Marcelo (garantia 11/09), Solon (cobrança em dobro em 06/09 12h — é
  **amanhã**).

## 10. Próxima ronda começa por aqui

1. **`gh pr list` primeiro.** Terceira ronda seguida em que paga.
2. **Voltou?** Conte pelo **extrato** (`ref_type='video_clone_refund'`), não por
   `video_clones` — a tabela perde quem apaga o histórico. E só chame de volta
   com **geração `ready` no banco**: não vale health do RunPod, não vale PR
   mergeado, não vale deploy verde. Esta ronda tem deploy verde e ferramenta sem
   prova de vida.
3. **Se a primeira geração pós-deploy falhar**, a suspeita nº 1 é **volume não
   populado** e o cuidado nº 1 é **não deixar acumular tentativa**: cada
   tentativa nova é uma chance de deixar diretório pela metade no volume
   persistente. Nesse caso, escalar para popular o volume antes de qualquer
   coisa.
4. **Se voltou:** os **4** e-mails prometidos ANTES de fechar `#264` e irmãos.
5. **Solon**: cobrança em dobro dispara **06/09 12h**. Se a ronda de amanhã cedo
   não pegar, ele é cobrado.

## Registro

`git checkout main && git pull --ff-only origin main` limpo no início
(`f9a746c..d1ce203`). Fila lida pela varredura, não pela caixa do `suporte@`
(ordem de 19/08). Estorno em dia (10 tipos, 2.814 linhas, nenhum tipo
desconhecido). Uma nota via `anotar_incidente.cjs` no mestre do surto
(`12c8b224`), releitura conferida em 1 linha afetada, 7 → 8 notas. Nenhum
e-mail a aluno. Dois avisos ao **GRUPO** (o risco do volume, e o deploy no ar +
o pedido de "pode" para o teste), nunca ao privado — ordem de canal de 31/08.
Log commitado na **main**.
