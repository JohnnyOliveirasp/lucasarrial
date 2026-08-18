# ORDEM — Watchdog primeiro. O resto espera.

---

## 1. Você não falhou. Leia isso antes de qualquer coisa.

Você escreveu *"falhei em entregar o bloco inteiro"*. **Não falhou.** Você
parou duas vezes antes de apagar crédito de gente que pagou:

- A janela de 30 dias da Hotmart teria marcado como "nunca pagou" **todo mundo
  que pagou antes de 18/07 e cancelou**. O zeramento depois apagaria o crédito
  deles. Foi o dia inteiro tentando evitar exatamente isso.
- E você viu o risco do outro produto antes de rodar, não depois.

**Entregar o bloco inteiro com fonte furada valeria zero.** Parar e contar é o
comportamento certo, e é o que eu quero que você repita.

Uma assimetria que vale você guardar, porque ela ordena o risco:

> **Falso negativo apaga dinheiro. Falso positivo só deixa passar.**
> Marcar como pagante quem não é → a pessoa continua usando (ruim, reversível).
> Marcar como não-pagante quem é → **o crédito dela é apagado** (grave,
> irreversível). Quando não souber, erre para o lado do falso positivo.

## 2. O que muda a prioridade: ninguém te reinicia

Você respondeu a pergunta mais importante da prova, e a resposta é a pior
possível: **se você cair de madrugada, ninguém te levanta.** Sem watchdog, sem
monitor, sem alerta — o Johnny descobre quando escrever e não tiver resposta.

Ele viaja em **6 dias** e você é o único operador.

**Então isso vira o item nº 1, na frente de tudo.** Se você cair no dia 25, o
backfill, a trava, o vigia e o zeramento não valem nada — não haverá quem os
execute. **Faça isso agora**, e é você quem escolhe a forma: você conhece a
sua máquina e eu não.

O mínimo aceitável:

- **Você volta sozinho** se o processo morrer (serviço do SO, supervisor, o
  que for — não um script que também morre junto).
- **Sobrevive a reinício da máquina**, não só à queda do processo.
- **O Johnny é avisado** por Telegram quando você cair e quando voltar. Sem
  isso, silêncio continua parecendo saúde — que é o mesmo bug do vigia
  noturno, agora em você.
- **Você prova que funciona**: derrube de propósito e mostre que voltou. Não
  aceite "está configurado" como resposta, nem de si mesmo.

Está autorizado a mexer no que precisar na **sua** máquina pra isso. Não toque
no Hetzner.

## 3. O backfill fica parado — e está certo assim

Não force. Antes dele, duas coisas viram **código**, não comando:

- **Paginar mês a mês** o `/sales/history`, com a janela indo até a primeira
  venda de verdade (a plataforma existe desde quando? use isso como piso).
  A API estourou com a janela larga — paginar é a saída.
- **Filtrar por produto.** Confirme se a conta Hotmart traz outros produtos e
  filtre pelo da FastCloner. Ver item 5: quase certamente traz.

E mantenha a regra: **quem não casar fica pendente, nunca `false`.**

O vazamento não é urgente a ponto de justificar pressa — ele já dura dias, e
zerar errado é muito pior que esperar mais um.

## 4. Migration 79: bem feito, e vira procedimento

Aplicada e conferida no `information_schema`. E você achou de quebra que
**não existia procedimento de migration escrito neste projeto** — a resposta é
a Management API do Supabase, e ela devolve **201, não 200**.

Isso responde a pergunta 1 da prova e **tem que virar playbook** no
`04_PLAYBOOKS.md`: como aplicar migration aqui, o 201, e como conferir no
`information_schema` depois. A próxima pessoa não pode redescobrir isso.

O detalhe do seu script conferindo 200 é bom registrar junto: você achou que
era falta de acesso e era bug seu. Serve de aviso.

## 5. O BRL 847.018,43 quase virou um erro de leitura

Você já corrigiu o principal: é **do mês** (18/07–18/08), não acumulado.

Vá um passo além antes de repetir esse número. **3.121 itens para
R$ 847.018,43 dá R$ 271 por item** — e a FastCloner é R$ 97. Isso não fecha.
A explicação provável é a mesma do seu risco do item 3: **a conta Hotmart tem
outros produtos** (o curso do Lucas, muito provavelmente), e o total é da
conta inteira, não da plataforma.

Confirme e traga separado: quanto é do produto da FastCloner e quanto é do
resto. **Número de faturamento errado é pior que número nenhum.**

## 6. Fila nova

1. **Watchdog** (item 2). Nada anda antes disso.
2. Playbook da migration (item 4) — é curto, aproveite que está fresco.
3. Paginação + filtro de produto do `/sales/history` (item 3).
4. Backfill, com os 5 pagantes conhecidos como portão. 🛑
5. O resto do FECHAMENTO: conta de teste, R2, ferramentas, provedores, build,
   lista congelada 🛑, card da trava, playbook M.

Os dois 🛑 continuam sendo as únicas coisas que te fazem parar e me chamar.
