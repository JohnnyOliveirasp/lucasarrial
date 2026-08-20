# ORDEM: você é o dono da fila (Vigia vira sensor) + fila ZERADA hoje

Data: 20/08/2026 ~04h UTC · De: sessão desktop · Decisão: Johnny, no chat

## 1. Divisão de papéis (regra 14-A nova no `01_REGRAS_DURAS.md`)

- **Vigia**: varre, ABRE e ANOTA. **Nunca reabre o que foi fechado**, **nunca
  escreve resposta pra aluno**. Discordou de uma decisão? Anota a objeção no
  incidente.
- **Você (Frank)**: investiga, decide, conserta, FECHA. Um incidente = um dono.

Motivo: 20/08 o Vigia reabriu o incidente do lucvila e escreveu um rascunho
esperando o "pode" do Johnny — o e-mail já tinha sido enviado horas antes.
Trabalho perdido e fila mentindo. Johnny decidiu **manter os dois** com essa
divisão: o Vigia pega o que você não vê (trouxe os 2 da madrugada) e te pega
quando você erra (a varredura que contava só `fast-email:%` e reportou "0
abertos" com 4 abertos).

## 2. A fila está ZERADA — o que foi feito nesta rodada

| incidente | desfecho |
|---|---|
| `910ea757` treino reprovando áudio válido | **fixed** (`6e07830`) — causa real: **FOTO** da pasta do Drive entrava em `raw_audio_paths` (projetosorriso 12/13, nelsonlopes 9/9). Não era moov nem download truncado. Fix: import só aceita áudio + worker pula arquivo sem faixa. 3 vozes destravadas + e-mail; nelson orientado a mandar áudio |
| `8d370ef5` "arquivo corrompido" | **fixed** — mesmo defeito; o balde estava `ignored` desde 17/08 e escondeu 14 ocorrências de bug NOSSO |
| `37bacb68` qa_coverage | **fixed** (`d9a14c0`) — dígito×extenso + markdown/emoji |
| `fb8d29b7` QA não media inserção | **fixed** (`6af76ae`) — QA de intrusão (gate macio) + voz da Katia curada |
| `88eef8aa` 50 débitos órfãos | **ignored** — falso alarme (deleção de histórico); prova em 4 camadas |
| `43f37482` lucvila | **ignored** — respondido em 2 e-mails |
| `d3d8d1b2` timeout | **ignored por decisão do Johnny** — ⚠️ **NÃO está corrigido**. Aceite de risco: ~2/semana, todos estornados. **Reabrir se voltar** |

## 3. O que sobra de verdade pra você

1. **`d3d8d1b2` quando voltar**: instrumentar o handler pra logar em QUAL fase
   o chunk pendura (download da ref? whisper do QA? geração?). Texto de 462
   chars estourou **30 minutos** quando o normal é ~2min — é hang, não régua.
2. **Referências cortadas no meio da palavra**: 3-4 de 14 vozes têm o mesmo
   defeito da Katia (janela de 30,000s corta mid-frase e o modelo ecoa o
   farelo). A cura manual está provada (recortar em palavra completa →
   0 intrusões). ⚠️ Automatizar exige **timestamps de palavra** na seleção da
   referência — heurística por energia foi testada e **REPROVADA** duas vezes,
   não subir.
3. **Re-medir as entregas** com a régua CORRIGIDA (expandindo dígitos): o
   "23 de 40" era inflado; com a régua certa deu 50%, e boa parte é
   transcrição embolada do Whisper, não defeito nosso.

## 4. Armadilhas medidas hoje (não repetir)

- **Estorno se confere por `ref_type`, NUNCA por `kind`** (o estorno grava
  `kind='extra_purchase'` + `ref_type='generation_refund'`). Filtrando por
  `kind` parece que 13 alunos não foram estornados — quase pagamos em dobro.
- **Débito órfão no extrato é NORMAL**: o DELETE do histórico apaga row + R2 e
  deixa o ref pendurado. Não é detector de bug enquanto não houver soft-delete.
- **Treino que falha: liste os ARQUIVOS da voz primeiro**
  (`jsonb_array_elements_text(raw_audio_paths)`), antes de olhar worker/ffmpeg.
  Foi o passo que faltou pra você e pra mim — os dois cravamos causa errada.
