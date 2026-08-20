# Resposta à passagem das vozes — quase tudo já resolvido; resta 1 medição

Data: 20/08/2026 ~00h30 UTC · De: sessão desktop (o "James" da passagem)
Referência: `2026-08-19_passagem_vozes_para_james.md`

## Estado item a item da tua passagem

| Item da passagem | Estado |
|---|---|
| "Os dois estão travados" | ✅ RESOLVIDO — paulo se serviu sozinho (gerações ready 18:24+, depois apagou do histórico — cuidado: consulta órfã ledger×generations engana); tiago regerado por cortesia (`regerar_apos_fix.cjs`) |
| "Por que o modelo corta ESSES textos" | ✅ ACHADO — eram 2 causas: (a) falso negativo dígito×extenso ("E trinta e seis" × "E36") no comparador — corrigido em `d9a14c0`, números viram palavras pt/en/es dos 2 lados; (b) markdown/emoji passando pro VoxCPM (`**` e 👉 no texto do paulo) — `sanitizeForTTS` determinístico no normalize.ts |
| Kátia (palavra dada) | ✅ ENTREGUE 19/08 ~22h40 — áudio refeito, 2 intrusões da cauda da ref cortadas cirurgicamente, verificado 99/99 por transcrição, e-mail enviado (autorizado pelo Johnny), incidente `4396496b` fechado |
| "0.85 sem medição" | ⚠️ FICA 0.85 — com a expansão de dígitos o erro sistemático do verificador caiu; o caso borderline real foi 0.80 (1 job). NÃO baixar sem medição nova |
| Timeout `d3d8d1b2` | segue TEU — todos os 13 estornados (conferi por ref_type, não kind!); padrão é job PENDURADO 30min+ em texto pequeno = hang de worker, não régua curta. Falta instrumentar fase a fase |

## O que subiu DEPOIS da tua passagem (commit `6af76ae`)

**QA de INTRUSÃO** (`_chunk_intrusions`) — o inverso do teu coverage: palavra
A MAIS ou TROCADA. Mecanismo dominante medido: VoxCPM vaza a CAUDA da
referência entre frases (ref da Katia termina em "por menos" → "Menos."
brotava nas junções). Alinha esperado×transcrito; conta inserida/substituída
sem parentesco (ratio<0.7, sem prefixo/sufixo, ≥3 letras) — imune a sotaque,
grafia de Whisper e composto separado. **GATE MACIO**: regenera e escolhe a
tentativa limpa, NUNCA falha o job (23/40 com defeito → gate duro seria
tempestade de estorno). Env: `TTS_INTRUSION_QA` (default 1). 26 testes verdes,
validado contra as 2 tomadas reais da Katia. Limitação v1: palavra <3 letras
("já") não conta.

## O que falta (teu/Vigia — é a validação que fecha o fb8d29b7)

1. **Re-medir as 40 entregas** (mesma régua que achou 23/40) DEPOIS do build
   novo rodar 1-2 dias — esperado: intrusão despencar. Com o número, fechar
   `fb8d29b7` (a sessão desktop fecha se você postar a medição no incidente).
2. A tua boa ideia da retro-medição (551 áudios de 13-17/08 cortados sem
   ninguém ver) vale como auditoria — MAS com o comparador NOVO (dígito→
   palavra), senão vai contar falso negativo aos montes.
3. `d3d8d1b2`: instrumentar o handler pra logar em qual fase o chunk trava.
