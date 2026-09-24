# Ronda das falhas — 24/09 ~02hZ (Frank, dono da fila)

**Desfecho: ZERO incidente fechado. O que esta ronda entregou foi a prova de que
o dado do PR #408 CHEGOU em produção (virada limpa, medida no dado e não no
relógio do build), a primeira medição do `#234` feita NO PONTO QUE A RÉGUA
MARCA — e a RETIRADA de uma recomendação minha que estava na mesa do Johnny
desde 21/09 apoiada em menos evidência do que eu tinha escrito.**

Gasto: **zero GPU, zero crédito de aluno movido, zero migration, zero merge,
zero código de produção tocado, zero e-mail enviado.** Custo real: 13 downloads
do R2 + ~13 transcrições whisper-1 (centavos). Escritas: 1 nota de incidente,
2 ferramentas novas (só leitura), este log.

Fila não baixou. É resposta legítima e está explicada item por item.

---

## 1. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta --corte=2026-09-14T14:06:31Z --confirmar` | **0** carta escriturável. **1161 = 1161**, nenhuma sumiu (1084 já com linha + 77 fora da janela). Subiu de 1145/1068: **16 cartas novas, todas já com linha**. |
| `enviados_x_tabela` (irmão de leitura, independente) | **VEREDITO: 0 carta depois do corte.** Buraco segue **passivo**. |
| `percepcao_travada.cjs` | **0** travados · mais velho **0d**. Controle positivo (#310) e negativo (#518) OK, 529 varridos. |
| `pagante_trancado.cjs` | **0** pagante trancado · 0 na fronteira · **1 sem prova** (`drfabiovilhena29@gmail.com`, sem subscriber code no payload) |
| Censo da fila | **115** abertos · **68 com 7d+** · mais velho **55d** pelo `idade_dos_abertos` (106d pelo `first_seen_at` cru do `c726c5ae`) |
| `esperando_johnny` | **17** parados em decisão do Johnny · mais velho **55d** · **54 alunos** atrás da fila |
| `fechados_que_disparam` | 16 fechados com sinal de vida, **1 vivo nas 48h** — o mesmo `#523`/`88550a1f` já apurado e descartado na ronda das 01hZ, sem fato novo |

**Não re-escalei o lote de decisões.** Foi ao grupo em 23/09 20hZ e a doutrina de
17/09 manda **lote, não repetição**. O que esta ronda produz para o próximo lote
está no item 3.

---

## 2. Serial: `#234` / `f8587cef` — "palavra decapitada no meio do áudio entregue"

### 2.1 Por que este cartão

Regra 8: o mais antigo com aluno afetado **e com passo concreto ao meu alcance**.
Conferi a cabeça da fila um a um antes de escolher: `c726c5ae`, `d3d8d1b2`,
`b706b32e`, `702cc916`, `8b8fc4c8` e `7ed72ad0` seguem em **decisão do Johnny**;
`37bacb68` (35d) teve **4 remédios refutados** e a nota das 17hZ de ontem
concluiu, com medição, que o gargalo dele é a decisão do `702cc916` e não falta
de investigação. Este aqui (21d, 609 ocorrências, **237 alunos**) tinha a lista
de próximos passos escrita e o passo (a) recém-cumprido.

### 2.2 Merge não é produção — fui conferir, e desta vez chegou

A ronda de ontem 13h45Z mergeou o **PR #408** (posição da fronteira) e declarou o
passo (b) tecnicamente destravado. **Ninguém conferiu se o dado nasceu.** Entre o
merge e a geração nova existem um build e a **troca da imagem no endpoint do
RunPod** — e "DDL commitado não é DDL aplicado" vale igual para imagem de worker.

Instrumento novo, só leitura:
`_frank/ferramentas/2026-09-24_posicao_da_fronteira_chegou.cjs`

- **Virada medida NO DADO:** última geração sem o campo `43e2e6d1` em **23/09
  13:47:39Z**; primeira com o campo `65f26a72` em **23/09 14:12:09Z**.
- **Monotonia** (o controle que de fato prova troca de imagem): das **36**
  gerações `ready` com bloco `qa` depois da virada, **36** carregam
  `tail_interno_entregue_t_s` / `_pos_s` / `tail_interno_pos_crossfade_ms`.
  **Zero desertor** — não há imagem velha ainda servindo, então o dado novo
  **não é amostra enviesada por rollout parcial**.
- **Controle positivo:** `tail_interno_entregue_n` (campo de 02/09) presente em
  30 das 36. A sombra roda, logo o zero de antes da virada é zero **medido**.

**Erro meu no caminho, pego pelo próprio controle.** A 1ª versão fixou o corte em
**14:20Z** (13:44:45Z do merge + os 31m26s que o Action contou) e o **controle
negativo reprovou**: uma geração de 14:12Z já tinha o campo. Não era a sonda, era
o corte **chutado** — o endpoint trocou a imagem antes de o Action terminar de
contar o próprio tempo. A ferramenta agora **descobre** a virada no dado.

> **Régua que fica:** corte de janela que sai de um relógio **externo ao dado** é
> hipótese, não corte. Se o controle negativo reprovar, suspeite do corte antes
> de suspeitar da sonda.

### 2.3 O passo (b) foi executado — e não precisava do ouvido

O passo (b) estava escrito como *"apontar o **ouvido** no segundo exato"*. O
`olho` (Gemini) foi **reconferido nesta ronda** e segue devolvendo **VAZIO em 4s
com 0 token de saída** — 5ª ronda seguida. O `qa` (Claude) **voltou** e respondeu
no mesmo minuto: o que falta é **audição**, não frota.

Mas a pergunta do cartão — *a palavra se perde na fronteira marcada?* — também se
responde por **transcrição**, porque palavra perdida aparece no texto. `whisper-1`
com timestamp por **palavra** é o mesmo instrumento que o `fabricar_referencia.cjs`
usa em produção e foi o que funcionou na ronda das 11hZ de ontem quando o `olho`
falhou. **Declarado: isto não é escuta humana, é transcrição por máquina.**

Instrumento novo, só leitura:
`_frank/ferramentas/2026-09-24_fronteira_marcada_perde_palavra.cjs`

**Desenho — o controle mora DENTRO do mesmo áudio**, para não comparar vozes,
textos e tamanhos diferentes:

- **CASO** — os segundos que a régua marcou (`tail_interno_entregue_pos_s`)
- **CONTROLE** — segundos do **mesmo** áudio, mesma voz, mesma transcrição, a
  ≥5s de qualquer marca e longe das bordas, **mesmo número de pontos**
- **POSITIVO** — existe evento de defeito (palavra pedida que sumiu, ou palavra
  que o modelo inventou) a ±2s do ponto

**Controle positivo do detector, rodado ANTES da medição** (régua já cobrada 4×
nesta casa): alvo `1c761a52`, o áudio do Diego Vargas cujo defeito a nota das
11hZ de ontem nomeou palavra por palavra. O detector devolveu **28 eventos** e
reencontrou **sozinho** exatamente o que aquela nota listou — sumiram *talvez,
estratégia, operação, inteligência, artificial, planejamento, crescimento,
transformação, preservando, meu, ritmo, minha, maneira, de, me, comunicar*; e
inventou *gerenciamento* (a nota tinha ouvido "ginesamento"). **O detector não é
cego.**

**Ruído retirado dos dois lados, e foi o próprio controle que o revelou:** a 1ª
passada deu **73** eventos e a maioria era **dígito × extenso** (`text_normalized`
escreve "cinquenta", o whisper devolve "50") — a **mesma família** que a
`resolution_note` do `37bacb68` catalogou em 20/08 como falso negativo **nosso**.
Numeral agora fica fora do caso **e** do controle.

### 2.4 O resultado, e ele contraria a minha própria leitura de 21/09

```
CASO     (segundo que a régua marcou)  : 7/19 = 36,8%
CONTROLE (mesmo áudio, longe da marca) : 1/19 =  5,3%
```

13 gerações, 19 marcas, 19 pontos de controle. Janela: desde a virada de 23/09
14:12:09Z, que é onde o dado de posição passa a existir.

O que aparece **em cima da marca**: `desconfortável → desconfortante`
(`11584cdb` @2,5s); `sebrami → sebrame` (`362c8566` @76,2s); *"o adversário
político"* **sumiu** (`ccab7649` @46,9s); *"transparência"* **sumiu** em
`5812ba37` @4,0s **e** em `2a0c07e1` @4,5s — mesmo texto gerado duas vezes,
mesmo defeito no mesmo lugar, o que é **reprodutibilidade**, não coincidência.

**Erro meu nº 2, e este andou CONTRA a minha intuição.** A 1ª versão escolhia o
ponto de controle com `x*(len-1)/(k-1)`, que para k=1 devolve **sempre o primeiro
candidato** — o controle caía no **começo** do áudio em 8 das 13 gerações. Eu
escrevi no próprio código, **antes de rodar**, que isso inflava o contraste a meu
favor *"porque o início é onde o modelo erra menos"*. O dado desmentiu: com o
controle preso no início ele dava **3/19**; espalhado por quantis, caiu para
**1/19**. O começo era o pedaço com **mais** evento, e o viés estava
**escondendo** o contraste (2,3× virou 7×). Corrigido no código, e o comentário
errado foi **reescrito com a medição**, não apagado.

### 2.5 Quanto disso é significância, dito sem inflar

Contei de quatro jeitos, do mais generoso ao mais conservador:

| contagem | números | p (2 caudas) |
|---|---|---|
| ponto a ponto | 7/19 × 1/19 | **0,042** |
| colapsando o par de texto repetido | 6/18 × 1/18 | 0,088 |
| 1 voto por geração | 6/13 × 1/13 | 0,073 |
| pareado por geração (McNemar exato, discordantes 5 a 0) | — | 0,063 |

**A direção é a mesma nos quatro. A significância não passa de 0,05 quando se
respeita o agrupamento por áudio.** O honesto é: **direcional e consistente, não
conclusivo**. Quem citar "p<0,05" estará escolhendo a contagem que não trata
pseudo-réplica — e essa contagem é minha, então o aviso é contra mim mesmo.

### 2.6 ⚠️ Retiro uma recomendação minha que está na mesa do Johnny

A nota de **21/09** recomendou **por escrito** não ligar
`TTS_TAIL_QA_INTERNO_MODO=reprovando`, com o argumento de que a régua marcava o
que o ouvido não ouvia (4 de 5 reprovadas sem corte audível, n=10).

Este resultado **argumenta no sentido oposto**. As duas medições não se
contradizem necessariamente — uma mediu **audibilidade** (n=10, ouvido), a outra
mede **fidelidade ao texto** (n=19, transcrição), e são coisas diferentes. Mas a
frase de 21/09 não pode mais ser citada como se estivesse firme.

> **Recomendação revista: não tenho base para recomendar nem ligar nem não
> ligar.** O que estava escrito como conclusão passa a estar escrito como
> dúvida. Isso importa porque a decisão (c) está parada com o Johnny desde 12/09
> **apoiada na minha frase**.

### 2.7 Limites que não estico

1. O offset é **aproximação por construção** (crossfade encurta, pausa de
   parágrafo alonga, e o desvio **acumula**) — por isso a janela é de 2s e por
   isso isto **nunca** serve para corte automático por timestamp.
2. **Falso negativo estrutural:** decapitação de **uma sílaba** pode não virar
   evento, porque o whisper tende a normalizar para a palavra inteira. Este
   teste mede a parte do defeito que **chega ao texto**, que é um subconjunto.
   Empate aqui **não** provaria que a régua infla.
3. n = 13 gerações. Os casos só existem desde 23/09 14:12Z e o histórico de 609
   **não ganha posição retroativa**.
4. **Não re-ouvi nada.** Sem `olho`, sem escuta. A palavra "ouvido" não aparece
   em nenhuma afirmação de conclusão.

### 2.8 Passo exato em que emperrou

Não consertei a causa; **237 alunos seguem com o defeito**. O cartão segue
`investigating` (regra 14). O que ele espera agora:

- **(b')** o n cresce sozinho e sem custo — 19 marcas em ~12h de produção.
  Repetir a mesma medição em ~3 dias com n ~4× maior decide entre 0,04 e 0,07.
- **(b'')** quando houver ouvido (crédito do Gemini, pergunta **já no lote** do
  Johnny), apontar a escuta nos **7 casos positivos** — agora existe o segundo
  exato para apontar.
- **(c)** a decisão `TTS_TAIL_QA_INTERNO_MODO=reprovando`, do Johnny desde
  12/09, **agora sem a minha recomendação contrária de 21/09**.

---

## 3. O que precisa do Johnny (para o próximo lote, não re-escalado agora)

1. **Crédito do Gemini** (`olho`, `pesquisa`, `social`) — já estava no lote de
   ontem. Esta ronda **mediu de novo**: `olho` devolve vazio em 4s com 0 token,
   **5ª ronda seguida**. É o único operário que ouve; sem ele o passo (b'') do
   `#234` e os cartões que pedem assistir render (Valdemir, Alexandre, Igor)
   ficam parados. Os de Claude (`qa` conferido agora) **voltaram**.
2. **Correção de redação, para o lote:** onde o lote de 23/09 leva a minha
   recomendação de *"não ligar o gate"* do `#234`, ela **caiu** (§2.6). A
   decisão (c) volta para a mesa **sem** posição minha.

---

## 4. Fim de ronda

- Log commitado na **main** (regra 25-B).
- **Nenhum código de produção tocado** — as 2 ferramentas novas são só leitura,
  fora do caminho do app. Não há fix preso em branch de feature.
- Escrita conferida na releitura: `#234` **1 linha afetada, 42 → 43 notas**,
  `resolved_commit` **preservado** (não passei `--status`, que dispararia a
  limpeza de reabertura e apagaria o vínculo com `7dc53d7a`).
- Nota passada por `"$(cat arquivo)"` e **relida depois de gravar** — a armadilha
  de crase de 23/09 13:03Z não se repetiu: 8.787 chars, sem buraco.
