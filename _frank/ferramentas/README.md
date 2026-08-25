# Ferramentas do Frank

Scripts prontos, todos testados em 18/08/2026. Rodam **de qualquer pasta** do
projeto (o caminho do `.env.local` é resolvido a partir do próprio script) —
mas precisam das dependências instaladas em `frontend/node_modules`.

Nenhum deles cobra crédito do aluno. Os que alteram dados só agem com
`--confirmar`; sem a flag, **simulam** e mostram o que fariam.

| Script | O que faz | Altera algo? |
|---|---|---|
| `varredura_travados.cjs` | A varredura diária: tudo parado em estado intermediário + incidentes abertos. Comece o dia por ele. | não |
| `cancelamentos_ontem.cjs [--dia YYYY-MM-DD] [--json]` | Quem cancelou no dia, **por pessoa**: classifica trial × assinante × estorno na **Hotmart viva** (pagou = valor > 0 **E** status COMPLETE/APPROVED — `OVERDUE` não é pagamento) e confere se o crédito de cada um seguiu a regra 9. Acusa quem tem outra assinatura viva. Base do relatório diário de cancelamentos. | não |
| `aluno.cjs <email>` | Raio-x completo de um aluno: conta, compra, créditos, vozes, produção e erros. **Rode isto antes de responder qualquer reclamação.** Se não achar a conta, procura contas/compras parecidas (caso "duas contas"). | não |
| `resgatar_voz.cjs <voiceId> --confirmar` | Voz parada em "uploading" com áudio no R2: restaura e dispara o treino **por conta da casa** (não cobra). | sim |
| `consertar_referencia.cjs --confirmar` | Acha `profiles.image_ref_key` apontando pra arquivo inexistente e troca por uma foto real. | sim |
| `limpar_fantasmas.cjs --confirmar` | Apaga voz "uploading" com **zero** áudio no R2 e 45min+. Reconfere o R2 antes de cada exclusão. | sim |
| `enviar_email.cjs <dest> "<assunto>" <corpo.html> [--bcc x@y]` | **O jeito preferido de falar com aluno.** Node puro, roda da sua máquina, sem SSH — fala SMTP direto (587+STARTTLS) com a senha do `.env.local`. | envia e-mail |
| `ler_caixa.cjs --de <email> \| --ultimos N \| --enviados --para <email> \| --fila \| --caixas \| --anexos <uid> [--salvar-em <dir>]` | Lê a caixa do suporte@ **sem atropelar a Fast**: `EXAMINE` (read-only no protocolo) + `BODY.PEEK`, busca só `SEEN` — da fila de não-lidos (que é dela) sai apenas a contagem. Na listagem, anexo é só nome/tamanho; `--anexos <uid>` baixa os anexos DAQUELE uid pra `_Bugs/anexos/<uid>/` (parte específica via BODYSTRUCTURE + `BODY.PEEK[n]`, teto de 10MB/anexo em `_anexos.cjs`, e imprime a prova de que flags e fila não mudaram). Ordem: `_frank/ordens/2026-08-19_ler_caixa.md`. | não (grava só em disco local) |
| `refazer_audio_conta_da_casa.cjs <generationId> [--confirmar]` | Refaz uma geração de áudio **por conta da casa** (não cobra): réplica exata do `POST /api/v1/voices/[id]/generate`, reusando o `text_normalized` já gravado. Nasceu do caso Katia (promessa de refazer sem cobrar que ficou 24h sem dono). ⚠️ Só quando o aluno **pediu** ou é compensação por erro nosso. Se o job falhar, o estorno automático credita mesmo sem ter havido débito — aceito de propósito nesses casos, **registre no relatório**. | sim (dispara GPU) |
| `normalizar_jfif_projeto.cjs --projeto <uuid> \| --restaurar-de <snap.json> [--confirmar]` | Troca `.jfif/.jfi/.jif/.jpe` por `.jpg` nas chaves de imagem de um Vídeo História, **copiando o objeto no R2 antes** de reescrever o caminho. O Kie recusa pela EXTENSÃO, não pelo conteúdo (incidente `edc50dc6`) — o commit `32d12fd` curou o upload NOVO, este script cura projeto já gravado. ⚠️ **Nunca derruba foto da lista**: se uma entrada não puder ser convertida, ABORTA o projeto inteiro e não grava nada (o 1º reparo deste incidente converteu só o que conseguiu e encolheu a referência da aluna de 6 fotos para 2). Confere magic `FFD8FF` antes de copiar, `HEAD` depois, e o nº de linhas do `.select()`. Sem `--confirmar`, ensaia. | sim |
| `reconciliar_imagem_kie.cjs <generationId> \| --todas [--confirmar]` | Fecha `image_generations` presa em `pending`/`generating` perguntando ao Kie (`recordInfo`, leitura — não gasta GPU nem cria task nova) qual foi o desfecho REAL: `success` → baixa, grava no R2 em `<user>/images/<id>/result.<ext>` (mesma chave do `buildImageResultKey`) e marca `ready`, conferindo com `HeadObject` **depois** de gravar; `fail` → marca `failed` com o `kie_raw_error` cru. Existe porque `syncImageTask` só roda com a **tela do aluno aberta** ou pelo webhook do Kie — sem nenhum dos dois a row fica presa pra sempre (incidente `69f0aec5`: 3 rows, a mais velha de **28 dias**, e uma delas o Kie já tinha **entregue em 74s**). ⚠️ **NÃO mexe em crédito, de propósito** — nem estorna nem cobra: estorno pode conflitar com decisão de crédito já tomada (ex.: trial zerado em 18/08), então quem decide é gente, em transação explícita e registrada. Sem `--confirmar`, ensaia. | sim |
| `enviar_email.sh <dest> <assunto> <corpo.html>` | Mesma coisa em bash+curl, pra rodar **no servidor**. | envia e-mail |
| `anotar_incidente.cjs <id\|prefixo> --nota "..." [--por frank\|vigia] [--status ...] [--resolucao "..."] [--commit sha] [--confirmar]` | **A única maneira segura de anotar/fechar incidente — use esta, não um script solto.** Nota **CONCATENA**, nunca sobrescreve: `agent_notes` ganha item novo no array (e se o campo já estiver corrompido em string, preserva como nota legada) e `resolution_note` vira `histórico + separador + nova`. Resolve prefixo → uuid e **recusa** id inexistente/ambíguo, em vez de dar UPDATE que afeta 0 linhas em silêncio; confere o nº de linhas do `.select()` depois de gravar. Sem `--confirmar`, ensaia. Nasceu de dado destruído 2× em 24h: a ronda das 03h apagou 4 `resolution_note` e o Vigia stringificou o jsonb de 3 incidentes (21 notas perdidas). | sim |
| `curar_mp3_xing.cjs --aluno <email> \| --geracao <id> \| --todos [--limite N] [--confirmar] [--restaurar] [--tolerancia 0.05]` | Conserta o MP3 **já entregue** que anuncia duração menor do que tem, fazendo o player cortar o final do áudio do aluno. Causa (incidente `a2b528a4`): `ffmpegWavToMp3` escrevia em `pipe:1`, que não é seekável, e o libmp3lame só grava o header Xing (obrigatório em VBR) se puder voltar ao início — sem header o player estima pelo 1º frame assumindo CBR e erra pra **menos**. O arquivo no R2 está inteiro; quem mente é a duração anunciada, e quanto mais longo o texto mais o aluno perde (pior caso medido: 17,1s de 112,7s). O código foi corrigido em `9633444` (PR #38) e vale só pra geração NOVA — este script é a remediação do que já foi entregue. Conserta por **remux** (`-c copy`): copia os frames bit a bit, **não reencoda**, sem GPU, sem crédito e sem perda. ⚠️ `--todos` **pagina** (o PostgREST corta em 1000 em silêncio e havia 2.634 alvos — consulta ingênua fecharia o incidente deixando 1.634 alunos cortados). Backup `<chave>.pre-xing-backup.mp3` **antes** de tocar no original e só segue se o backup existir de fato no R2; confere o arquivo **depois** de gravar rebaixando do R2 e **restaura o backup** se não bater; pula quem já está bom (idempotente); não toca no banco nem em crédito. Sem `--confirmar`, ensaia. Restauração em massa não existe de propósito. | sim (só o objeto no R2) |
| `curar_msg_envio_incompleto.cjs [--voz <id8\|id>] [--confirmar]` | Reescreve, na conta do aluno, a recusa por envio incompleto que ficou gravada com a **promessa falsa**. `mensagemEnvioIncompleto()` terminava sempre com *"a MESMA gravação serve. Envie de novo"* — verdade quando o envio inteiro fecha a porta de 20min, **mentira quando não fecha**: o aluno reenvia a mesma coisa e é recusado de novo achando que a culpa é dele (incidente `2c5bab42`/#72; caso `jrfengenhariadf`, 4 de 7 arquivos = 617s, projeta ~17min). A causa foi corrigida na main em `9e97569` (PR #52), mas o fix só vale pra recusa **nova**: a voz está em `rejected_too_short` e o sweep de resgate só olha `uploading`, então a mensagem já gravada não é reescrita por ninguém. Mesmo desenho do `curar_mp3_xing.cjs` — o código cura o caso novo, o script cura o que já foi entregue. ⚠️ **O critério é DIVERGÊNCIA da produção de hoje**, não "tem a frase da mentira": regenera pela `mensagemEnvioIncompleto` com as mesmas entradas e grava só se o texto mudou. Isso engloba a mentira (quando a frase otimista está certa, a produção regenera o MESMO texto e o alvo cai fora sozinho) **e** pega o NÚMERO VELHO, que a versão anterior deixava passar: quem foi curado antes do PR #53 carregava "Acrescente ~Nmin" da projeção **crua**, que é otimista e pede menos gravação do que a regra de hoje exige. Medido em 25/08 nas 18 vozes com a mensagem: 3 divergentes, **todas pedindo 1min a menos**; a pior era a do `jrfengenhariadf` (voz `1858c53b`), que mandava "acrescente ~3min" quando a conta conservadora pede 4 — obedecer a tela o levaria à **terceira** recusa. Não inventa texto — a frase nova sai da MESMA função de produção, então o aluno lê o que leria se a recusa acontecesse hoje. Não muda `status`, `raw_audio_paths`, `duration_seconds` nem crédito: só `error_message`. Confere o nº de linhas do `.select()` **e** o texto que o banco devolveu, e trava por `status` pra não reescrever voz que mudou de estado no meio. Idempotente. Sem `--confirmar`, ensaia. | sim (só `error_message`) |
| `_comum.cjs` | Base compartilhada (credenciais, Supabase, R2). Não roda sozinho. | — |

## Exemplos

```bash
# começo do dia
node _frank/ferramentas/varredura_travados.cjs

# alguém reclamou
node _frank/ferramentas/aluno.cjs maria@exemplo.com

# a voz dela tem áudio no R2 e está travada
node _frank/ferramentas/resgatar_voz.cjs <voiceId>            # simula
node _frank/ferramentas/resgatar_voz.cjs <voiceId> --confirmar # executa

# avisar a aluna (da sua própria máquina)
node _frank/ferramentas/enviar_email.cjs maria@exemplo.com "Sua voz ja esta pronta" corpo.html --bcc suporte@lucasarrial.com
```

⚠️ Antes de mandar pro aluno, mande **pra você mesmo** e leia. E-mail não tem
desfazer. Em lote, não use `--bcc` (enche a caixa do Johnny): mande um resumo
único no fim.

## Ao criar ferramenta nova

- Investigação e uso único → `_Bugs/` (fora do git).
- Vai servir de novo → aqui, com `--confirmar` obrigatório pra qualquer
  alteração, e uma linha nesta tabela.
- Nunca imprima segredo. Nunca cobre crédito sem o aluno pedir.
