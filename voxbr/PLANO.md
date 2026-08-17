# 🇧🇷 VoxBR — base brasileira pro motor de voz (VoxCPM2-BR)

> Início 08/08/2026. Objetivo (Johnny): **as 3 coisas** — (1) qualidade geral
> do pt-BR (pronúncia/prosódia), (2) clone bom com menos áudio do aluno,
> (3) matar alucinações/ecos de vez.

## Por quê
O VoxCPM2 (nossa base, Apache 2.0) é líder mundial em similaridade de clone,
mas pt é "segunda prateleira" — quem carrega o pt-BR hoje é o LoRA de ~20min
de cada aluno. Sintomas em prod: ecos de ref, palavras alucinadas ("moment"),
primeira palavra engolida, fillers. Uma base que fala pt-BR nativamente ataca
a causa, não o sintoma.

## Fases

### F0 — Pesquisa técnica ← EM ANDAMENTO (achados 08/08 abaixo)
✅ CONFIRMADO na doc oficial (voxcpm.readthedocs.io/finetuning):
- **Treino é OFICIALMENTE suportado**: `train_voxcpm_finetune.py`, full SFT
  e LoRA. O NOSSO caso está literalmente na tabela deles: **"Add a new
  language (500+ hours)" → FULL fine-tuning**, com mix de 10-20% de dado
  zh/en pra não esquecer o que a base sabe (mitiga o risco nº 1).
- **VoxCPM2 = 2B params. Full FT ≈ 40GB VRAM** (batch 16) → cabe em UMA
  H100/A100-80GB. Não é um LongCat — é treino barato.
- Formato do dado: manifest JSONL {audio, text, ref_audio opcional, duration};
  clipes de **3-30s**; 30-50% das amostras com ref_audio (preserva os dois
  modos de clone). LR full = 1e-5, 1-2 épocas.
- LoRA por falante: rank 32 ≈ 98% da similaridade do full com metade da VRAM
  (é o que já fazemos por aluno).
❓ AINDA ABERTO:
- LoRAs dos alunos (base atual) funcionam na base BR? Doc não responde —
  TESTAR na F3 (custo ~zero: carregar LoRA existente no checkpoint BR).
- Ler issue OpenBMB/VoxCPM#202 ("LoRA finetuning garbage output") — armadilha
  conhecida da comunidade antes de rodar.
- Custo estimado: 500h × 1-2 épocas em 1×H100 — calcular em F2 com o
  throughput real (chute inicial: dezenas de horas de GPU, não centenas).

### F1 — Dataset pt-BR licenciado (paralela à F0)
Meta: **500+ horas** de pt-BR (número da doc oficial pra idioma novo).
- **CML-TTS**: ✅ licença **CC-BY 4.0** confirmada; 3.233h TOTAIS em 7
  idiomas (LibriVox, 24kHz) — LEVANTAR quantas horas são do português.
- Common Voice pt (CC-0) · Multilingual LibriSpeech pt (~160h) ·
  candidatos BR a investigar: CORAA, TTS-Portuguese Corpus.
- + 10-20% de dado zh/en no mix (anti-esquecimento, receita oficial).
- 🚫 REGRA: NADA de áudio de aluno sem consentimento explícito (LGPD).
- Pipeline de preparo: filtro de qualidade + transcrição Whisper + loudnorm
  (tooling que já temos do gravador/QA).

### 📐 DIRETRIZ MESTRA DO DADO (pesquisa 08/08) — DIVERSIDADE > HORAS
Achados que mudam a meta:
- Retorno é LOGARÍTMICO (CosyVoice): 10h→MOS 2,9 · 50h→3,1 · 100h→3,2.
  10× mais dado = +0,3. Não adianta empilhar hora.
- Dado acusticamente HOMOGÊNEO (audiolivro) dá ganho limitado ou PIORA a
  percepção; variação real de energia/estilo é o que rende.
- TRADE-OFF documentado: especializar aproxima do timbre da ref e AFASTA do
  texto (= mais alucinação). É o nosso bug de eco. Medir pronúncia E
  similaridade juntas e parar no ponto certo — não treinar até o fim cego.
- Teto de referência (Align2Speak): pt com baseline QUEBRADO (CER 33%) caiu
  pra 3,94% com 30min. Nosso baseline NÃO está quebrado → expectativa real:
  20-50% de redução relativa de erro, +0,2-0,4 de naturalidade, similaridade
  de clone NEUTRA (com risco de cair).
➡️ META NOVA: ~200-500h com o MÁXIMO de falantes/situações distintas
(mil vozes diferentes valem mais que mil horas do mesmo tipo).

### 📋 FONTES APROVADAS (lista fechada 08/08)
1. Corpus licenciado: CML-TTS pt (CC-BY, 68h) · Common Voice pt (CC-0) ·
   MLS pt (~160h) · TTS-Portuguese · CORAA (avaliar).
2. YouTube com FILTRO Creative Commons (podcast/vlog/entrevista/aula BR).
3. Conteúdo público: EBC/Agência Brasil · TV Senado · TV Câmara · TV Justiça.
4. Nossa equipe (voz do Johnny/Lucas/time — dado que nos pertence).
5. Catálogo de vozes prontas (já de origem livre: LibriVox/Common Voice).
6. 🔜 Alunos SÓ COM OPT-IN EXPLÍCITO (ver bloco de consentimento abaixo).
7. 🔜 Futuro: licenciar acervo de podcasters (permuta/contrato).
🚫 VETADO: novela da Globo (ruim tecnicamente — trilha/efeitos/atuação ≠ fala
natural — e proibido dos 2 lados: obra + voz dos atores) · podcast de
terceiros sem licença aberta.

### ⚖️ CONSENTIMENTO — áudio de aluno NÃO pode entrar hoje (verificado 08/08)
Política de privacidade em vigor (lib/legal/privacy.ts §5) diz literalmente:
"Sua voz é usada para criar um modelo (LoRA/adaptação) que permite gerar novos
áudios... mediante seu consentimento". Ou seja: consentimento é para o modelo
DELE, para a finalidade DELE. Treinar uma BASE COMPARTILHADA com a voz do
aluno é finalidade NOVA e não está coberta (LGPD trata voz como dado
sensível/biométrico; §63 permite exclusão a qualquer momento — o que é
incompatível com peso já treinado).
CAMINHO CERTO (~1 dia de trabalho, e vira marketing):
- Novo consentimento OPT-IN, separado e desmarcado por padrão: "aceito que
  meus áudios ajudem a treinar o motor de voz brasileiro da FastCloner".
- Campanha e-mail/app: "ajude a construir a primeira voz IA brasileira" —
  aluno vira coautor da base. Adesão alta é esperada.
- Registrar consentimento por pessoa (tabela user_consents) + honrar
  revogação (não reentra nos próximos treinos).
Até isso existir: base treina só com as fontes 1-5.

### F1b — GARIMPEIRO (ideia Johnny 08/08) — agente que estoca áudio conversacional
Programa 24/7 à parte (dentro de voxbr/) que enche o estoque da fábrica:
1. Busca YouTube SÓ com filtro de licença Creative Commons + canais públicos
   allowlistados (EBC, TV Senado, TV Câmara, TV Justiça).
2. Baixa amostra de 3-5min (yt-dlp) → juízes automáticos: idioma pt?
   música/efeitos? vozes sobrepostas (diarização)? SNR? confiança do Whisper?
3. Aprovou → baixa inteiro + registra em catálogo COM PROVA DA LICENÇA.
🚫 Regra mantida: nada de podcast/novela sem permissão (copyright + direito
de personalidade da voz; devido diligence é a auditoria). Parceria com
podcasters = caminho futuro pra acervo premium.
Ordem: construir DEPOIS do smoke passar.

### F2 — POC de treino (subset 100-300h)
- Pod multi-GPU temporário (sabemos operar desde o LongCat: volume + venv +
  NCCL_NVLS_ENABLE=0 em H100 container).
- Checkpoint "BR-alpha".

### F3 — Avaliação às cegas (gate de continuar)
- Mesmas refs nas 2 bases: vozes do catálogo + Lucas + casos difíceis
  (DEIZI hesitante, Joana es, Carlos).
- Métricas: WER pt (Whisper, já temos) · similaridade · TAXA DE RETRY do QA
  anti-eco (nosso QA vira harness: base melhor = menos regeneração).
- Teste do objetivo 2: treinar a MESMA voz com 5/10/20min nas duas bases.
- Ganhou → F4. Empatou/perdeu → mais dado/steps ou repensar.

### F4 — Escala + rollout
- Treino completo (mais horas/steps conforme F3).
- Rollout A/B POR VOZ (roteamento por voz já existe): vozes novas na base BR;
  antigas migram conforme resposta da ❓ de F0 (compatível → migra direto;
  incompatível → mass-retrain automatizado, temos experiência do mass-heal).

## Riscos mapeados
1. **Esquecimento catastrófico** (base piora en/es) — mitigar com mix de dado.
2. **LoRAs antigos incompatíveis** → decide F0/F4.
3. **Custo GPU** — estimar em F0; POC barata primeiro (padrão LongCat: só
   escalar depois do gate de qualidade).
4. Licença de dado — só corpus livre; nada de aluno sem opt-in.
