# Ronda das falhas — 23/09, ~22hZ (Frank, dono da fila)

**Desfecho: 1 incidente FECHADO (`#376`), 1 defeito de aluno CURADO em produção
com carta enviada (`#383`), 2 cartões de sistema ABERTOS (`#537`, `#538`) e 1
instrumento novo escrito.**

Gasto: **zero GPU, zero crédito movido, zero migration, zero merge, zero código
de produção tocado**. As escritas foram: 2 notas de incidente, 1 fechamento,
1 referência de voz curada, 2 incidentes criados, 1 carta a aluna.

---

## 1. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta --corte=2026-09-14T14:06:31Z --confirmar` | **0** carta escriturável. **1130 = 1130**, nenhuma sumiu (1053 já com linha + 77 fora da janela). |
| `enviados_x_tabela` (irmão de leitura, independente) | **0** carta depois do corte fora da tabela. Buraco segue **passivo**. |
| `percepcao_travada.cjs` | **0** travados · mais velho 0d. Controle positivo (#310) e negativo (#518) OK, 521 varridos. |
| Censo da fila | **141** abertos (investigating 102 · aguardando_aluno 31 · open 8) · mais velho **55,3d** |
| `fechados_que_disparam` | 16 fechados com sinal de vida, 1 nas últimas 48h. Conferidos **um a um por SQL**: nos 8 com `last_seen_at` em 48h o `resolved_at` é **posterior ou igual** ao disparo. Nenhuma classe fechada seguindo disparar. |
| `esperando_johnny` | **17** parados em decisão do Johnny · mais velho 55d · 54 alunos atrás da fila. **Não re-escalei**: o lote foi ao grupo às 20hZ de hoje e a doutrina de 17/09 manda lote, não repetição. ⚠️ e ver §4 — o número está **incompleto**. |

As 77 cartas anteriores ao corte seguem sem decisão, como a ordem prevê.

---

## 2. Primeiro serial: `#376` / `4f879676` — Gabriel Reis — **FECHADO**

**Escolha.** Era o cartão com aluno nomeado **há mais tempo sem ninguém
encostar** (última nota 13/09 15:28Z, 10,3 dias). Os mais velhos em idade bruta
foram relidos nota a nota e seguem travados em decisão alheia: `d3d8d1b2` (55d,
Johnny), `37bacb68`/`f8587cef`/`f1ada07e` (trabalhados hoje em rondas
anteriores), `af06731f`/`99a20692` (bola do aluno desde 22/09), `8b8fc4c8`
(mão humana na Hotmart), `702cc916`/`52b22304`/`5c68eb33` (dinheiro, mesa do
Johnny), `132f7808`/`94d3015d` (WhatsApp sem aval desde 13/09).

**O caso, e o que faltava.** Ele reclamou em 13/09 de barra do gravador com 20+
min e nenhum áudio tocando, ao criar uma **segunda** voz. A ronda daquele dia
mediu certo (nenhuma linha de voz no servidor, nenhuma cobrança), respondeu por
e-mail com o caminho do **upload direto** (uid 2101) e pôs em `aguardando_aluno`.
Ele nunca respondeu. **Ninguém nunca voltou a olhar.**

**Medido hoje, não herdado.** Ele resolveu **no dia seguinte**: criou as vozes
`Espanhol` (14/09 15:08Z, 4 arquivos, 1200s) e `voz espanhol` (14/09 17:21Z, 9
arquivos, 2700s), as duas `ready`, e **gerou com as duas** (2 e 4 gerações, todas
`ready`, de 14/09 a 16/09). Seguiu produzindo áudio, Vídeo Clone e imagem até
16/09. Conta hoje: `pro`, acesso até **11/10**, 51.595+2.400 cr.

**Dinheiro: nada a devolver, e medi antes de opinar.** Há dois débitos
`training` de −10.000 no mesmo dia. **Não é retreino de voz quebrada**: ele
gerou áudio com a primeira voz *antes* de treinar a segunda, e os conjuntos de
arquivo diferem (4 arq/20min contra 9 arq/45min). Escolha de aluno com produto
funcionando.

**`fixed` e não `ignored`**, porque o desbloqueio veio de ação nossa (a carta com
o caminho que ele usou), não de erro dele corrigido sozinho. `resolved_commit`
ficou **vazio de propósito** — não houve commit, e carimbar sha emprestado é
mentira de registro. Gravação **conferida na releitura, 1 linha afetada**.

**O defeito de processo que este caso denuncia:** enquanto a ficha dele ficava
aberta, ele **foi atendido em outro cartão** — `#184448e5`, aberto e fechado em
15/09 (commit `324aaf6`, carta uid 2466). Ninguém ligou uma coisa na outra.

---

## 3. Segundo serial: `#383` / `fcd379d2` — Aline Andrade — **CURADO E RESPONDIDO**

### 3.1 A cura de 13/09 não pegou, e o relógio mostra por quê

| Hora (13/09) | Fato |
|---|---|
| 22:30:49Z | a casa curou a referência da voz `20269220` |
| 22:32:51Z | nota escrita, carta uid 2147 enviada |
| **22:39:12Z** | **ela criou uma QUINTA voz**, `AliPersonal 4` (`46ab5f25`) |
| 22:39:53Z | **−10.000 créditos** |
| 22:46:04Z | ficou `ready` — **com a mesma cauda de despedida** |

Os 223 chars de `reference_transcript` de `46ab5f25` são **idênticos** aos de
`42fe4302`, `b265951f` e `d43ba768`: *"Fuiu bem, fiz leitura... Eu acho que eu
vou finalizar, que já está dando até um pouquinho de enjoo... Então eu fecho
aqui, agradeço."* O VoxCPM clona o **estilo** da referência, e o modelo da voz
dela era **ela querendo parar de gravar**.

**Curar uma voz não curou o seletor. A voz seguinte nasceu com o defeito
intacto, 9 minutos depois.**

### 3.2 Ela nunca ouviu um clone bom da própria voz

A única geração da voz curada (`20269220`) é de **09/09**, *anterior* à cura. A
voz nova só tem a amostra automática do fim do treino, feita com a referência
ruim. Nada depois de 13/09 22:46, `last_seen_at` 14/09 01:46Z. A carta pedia que
ela gerasse e comparasse; ela estava dentro do app treinando quando a carta saiu.
**Total cobrado dela por este defeito: 50.000 cr em cinco treinos do mesmo
arquivo de 58min46s.**

### 3.3 Feito hoje

1. **Curei `46ab5f25`** com `_heal_ref_boundary` (cura manual provada, sem GPU,
   sem retreino, sem custo pra ela). Nova ref: 21,6s em pausa natural, do meio
   da gravação, ela explicando o próprio projeto com energia — score **4,4**
   contra 12,5. **Conferido no banco:** `updated_at` 23/09 **21:49:26Z**, 222
   chars, texto novo.
2. **Não curei as outras três** — vozes velhas que ela talvez nem use, e agora
   servem de **controle positivo** do instrumento novo.
3. **Escrevi pra ela** — Enviados **uid 3299**, cópia CONFIRMADA na 1ª
   tentativa, registrada em `emails_enviados`. O aviso que mais vale dinheiro:
   **não treinar uma sexta vez**. Sobre os 40.000: levado ao dono, decisão dele,
   **sem prometer valor nem data**, e eu conto o desfecho mesmo se for não.

**Volta para `investigating`**, de propósito: a bola do teste é dela, mas a
decisão de dinheiro é **nossa** e está pendente há 10 dias. `aguardando_aluno`
aqui esconderia decisão nossa atrás de "bola com o aluno".

### 3.4 Um número da nota de 13/09 que eu não consigo reproduzir

Ela afirma *"score da heurística do worker: 42,8 ANTES"*. Medindo hoje o **mesmo
texto** com a **mesma heurística portada**, dá **12,5**. O "4,4 DEPOIS" reproduz
exatamente. Registro a discrepância em vez de repetir o número: a conclusão
qualitativa não depende dele, mas medição que não reproduz não pode circular.

---

## 4. Dois cartões de sistema abertos hoje

### `#537` (`cfa488b5`) — a classe: referência de despedida

**O achado que importa não é a cauda, é o medidor.** A referência da Aline
pontua **12,5** na heurística do próprio worker — **abaixo** de qualquer
patamar de suspeita. O pior caso real que a casa tem em mãos **passa pelo nosso
medidor como referência boa**, porque ele mede *forma* (pontuação, bordão,
repetição) e o defeito é de *energia*.

Instrumento novo, com controle positivo e negativo:
`_frank/ferramentas/2026-09-23_referencia_de_despedida.cjs`. Varridas **1392**
vozes `ready`: **9** casam vocabulário de encerramento, **120 (8,6%)** têm score
≥ 25. **Ressalva na frente do número:** das 9, só as **3 da Aline** estão
confirmadas, e pelo menos 2 são **falso positivo da minha própria marca** (aluno
lendo um texto que contém "cansada"/"finalizando"). Candidata não é veredito —
**não ouvi as 120**.

Não estou pedindo automatizar a cura por heurística de energia: isso foi
**reprovado duas vezes** e segue reprovado.

### `#538` (`c015a57c`) — a fila de decisão só enxerga quem escreve "Johnny"

A escalação de 40.000 cr feita no `#383` em **13/09** não aparece em lugar
nenhum da saída do `esperando_johnny.cjs`. A causa, lida no código
(`2026-09-22_esperando_johnny.cjs:100-120`): o filtro de status está **certo**,
mas as **6 marcas exigem a palavra literal "johnny"**. Quem escalou dizendo
*"escalei pro grupo"*, *"passa do meu teto"* ou *"não é minha alçada"* some.

Medido: dos 141 abertos, **25** têm marca de escalação na última nota; **9** não
escrevem "johnny"; **8 não aparecem** na saída do instrumento — `#294`, `#301`,
`#340`, `#383`, `#429`, `#479`, `#491`, `#512`. **Ressalva que vale mais que o
número:** meu filtro é proxy. O único **confirmado na mão** é o `#383`; os
outros 7 são fila de leitura, não soma.

**Por que isto é pior que um ajuste de regex:** o script não devolve "não sei".
Ele imprime *">>> NÚMERO PRO RELATÓRIO: 17"* com a autoridade de contagem
completa, e o que fica de fora não vira dúvida — vira silêncio. Mesma doença que
a ordem de 21/09 pegou no `aguardando_aluno` e que o `#2126f366` pegou hoje no
controle positivo **deste mesmo script**.

---

## 5. Fim de ronda

- Log e instrumento novo commitados na **main** (regra 25-B).
- **Nenhum código de produção tocado** — não há fix preso em branch de feature.
  Conferido com `git log origin/main..HEAD` e `git branch`.
- Escritas conferidas na releitura: `#376` fechado (1 linha), `#383` anotado
  (1 linha), `#537` e `#538` criados (id + número devolvidos), referência de
  `46ab5f25` relida no banco.
- Grupo: fatos consumados postados com `notify-grupo.sh`. Nada de log de
  terminal, nada de progresso parcial.
