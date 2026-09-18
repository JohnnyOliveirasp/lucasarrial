# Ronda das falhas — 18/09, 18h40–19h15Z

Dono da fila (14-A). Método serial da ordem de 21/08. Canal: grupo (ordem de 31/08).

## Passo fixo: reconciliar os envios (ordem de 18/09)

Rodado antes de tocar na fila, com os dois instrumentos independentes:

```
2026-09-18_reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar
  651 lidas da pasta "Sent" = 574 já tinham linha + 77 fora da janela + 0 recusadas
  DENTRO DA JANELA, escrituráveis: 0  → nada a fazer
  ✔ 651 = 651, nenhuma carta sumiu na classificação

2026-09-18_enviados_x_tabela.cjs  (irmão de leitura)
  casadas por Message-ID: 574 · por destinatário+janela: 4
  VEREDITO: 0 carta depois do corte ficou fora da tabela
```

Os dois fecham em **0**. Cresceu de 649 → 651 desde a ronda das 18h; as duas
novas já nasceram com linha. As 77 anteriores a 14/09 14:06:31Z seguem **sem
decisão**, por desenho do `--corte`.

## A classe de percepção (ordem de 17/09)

| momento | cards na classe | mais velho parado |
|---|---|---|
| ronda de 18h | 13 (consulta `ILIKE` solta) | 17,0 dias |
| **esta ronda** | **1** (`percepcao_travada.cjs`) | **0,3 dia** (`#450`) |

A diferença **não é melhora, é instrumento**: as rondas anteriores contavam com
a consulta `ILIKE` do texto da ordem, que casa qualquer nota contendo "assistir"
ou "ouvir". O `percepcao_travada.cjs` filtra por cartão que **só** para por
percepção, e tem controle positivo (`#310` reencontrado). O único que sobra,
`#450`, já está anotado como **falso casamento** pela ronda das ~13hZ. Registro
a troca de régua explicitamente pra ninguém ler "13 → 1" como conserto.

## Cards que a ronda de 18h despachou: um entregou, o outro morreu calado

| card | dono | desfecho |
|---|---|---|
| `e0248a2c` despejo dos acumuladores de `/workspace` (causa do `#32`) | `coder` | **entregou** — PR **#342**, branch `feat/faxina-despejo-acumuladores`, 1 commit `afbbb72c`, 17/17 testes + 4 mutações |
| `935df31f` colisão mobile do PR #330 | `coder` | **FALHOU sem saída nenhuma** |

O `e0248a2c` voltou melhor do que o cartão pedia: corrigiu **duas** coisas do
meu mapa (o acumulador (c) mora em `WORKSPACE/refs`, não em `/workspace/loras`),
achou mais dois do mesmo tipo, e — o que importa — pegou **um bug próprio que
teria derrubado toda geração de todo aluno**: nomeou o corpo de
`InferenceJob.run` como `_gerar()`, que já existia na classe, e só descobriu
porque se recusou a aceitar o "falta numpy" e foi instalar pra rodar de verdade
os dois testes que exercitam o caminho tocado. **O `#32` continua aberto**: PR
aberto não é produção (regra 14), e o merge recicla o endpoint de GPU — janela
segue sendo decisão do Johnny, pedida desde a ronda das 18h.

O `935df31f` é falha minha de despacho, não do modelo. Fui olhar a worktree
(`/mnt/Data/Projetos/_wt/pr330-fix`): está no tip exato, **limpa, sem um
commit, e sem `node_modules`**. Ele morreu montando ambiente. Eu tinha mandado
um worker headless fazer `npm install` + subir dev server + logar + medir
geometria, tudo dentro do orçamento de turnos dele. **Instalei o ambiente eu
mesmo** (install real, não symlink — turbopack rejeita symlink entre worktrees)
e redespachei como `54582f34`, agora com o comando exato de subir escrito no
prompt. Lição banca (`remember` #1659).

## O incidente que peguei: `#1a37605a` (Walsicleia) — pagante, 14,1 dias, ZERO login

Peguei este e não o `#32` porque o `#32` está parado num passo que não é meu
(janela de merge do Johnny), e porque aqui há **aluno pagante travado agora** —
prioridade explícita da rotina.

Medido em `auth.users` (`walsicleia_kaka@hotmail.com`): conta criada **04/09
16:17Z**, `email_confirmed_at` no mesmo instante, **`last_sign_in_at` NULL até
agora**. Voz e foto prontas desde 11/09. Pagou **R$ 936,15** (2 avulsas
COMPLETE de 21/08). Escreveu **7 vezes**. Duas rondas anteriores deram o caso
por atendido.

### Hipótese minha que está REFUTADA (registro pra ninguém perseguir)

Levantei que o link mandado em 16/09 (uid 2584) apontaria pro `localhost` e por
isso não levaria a lugar nenhum. **Não é isso.** Abri o MIME daquela carta: o
`redirect_to` dela era `https://fastcloner.com/auth/callback?next=/reset-password`
— host certo, conferido vivo nesta ronda (`/auth/callback` sem parâmetro devolve
**200** e cai em `/login?error=missing_code_or_token`; `app.fastcloner.com` **não
resolve**). A carta de 16/09 estava estruturalmente correta. Descartada.

### O susto que sobrou dessa hipótese, e que é real

O `.env.local` **desta máquina** tem `NEXT_PUBLIC_SITE_URL=http://localhost:3000`,
e o Supabase **aceita** esse destino (está na allowlist do projeto, por
conveniência de dev). Conferido com a conta da casa: a rota de verificação
responde **303** mandando o navegador pro `localhost:3000`, com a sessão no
fragmento. Link gerado assim **queima a credencial de uso único** e joga o aluno
pra máquina dele. Não foi o que aconteceu com ela — mas era mina armada pra
próxima ronda que gerasse link daqui. A ferramenta nova
`2026-09-18_link_de_primeiro_acesso.cjs` **fixa o host de produção e recusa
localhost**.

### Zero falso que eu produzi e corrigi, no mesmo assunto

Varri as **2819** cartas da pasta Enviados procurando link com destino errado. O
script devolveu **0**. Zero que não batia com nada. Antes de reportar, abri UMA
carta conhecida como **controle positivo** (uid 2584): o corpo sai em **base64**
e meu decodificador só desfazia quoted-printable — o grep nunca achava URL
nenhuma. Fica no log porque **o zero concordava com o que eu esperava**, que é
exatamente quando ele engana. Terceiro zero falso da casa em dois dias.

Corrigido e **re-medido**, agora com o instrumento provado:

| | antes (decodificador quebrado) | depois |
|---|---|---|
| cartas varridas | 2819 | 2821 |
| **com link de verificação** | **0** | **653** |
| com `redirect_to` pro localhost | 0 | **0** |

O `653` é o controle positivo do próprio número: prova que o script enxerga
link, e por isso o **zero de localhost agora vale**. O risco existe e está
armado na máquina, mas **nunca chegou em carta de aluno** nesta janela. A
armadilha do base64 ficou escrita no cabeçalho das duas ferramentas.

### A causa de classe, com o `arquivo:linha` que o Vigia das 16hZ pediu

O Vigia mediu a **ausência** da carta de recovery no nosso livro e pediu que
alguém lesse o código e dissesse de qual remetente ela sai. Lido:

> `frontend/src/components/auth/forgot-password-form.tsx:29` chama
> `supabase.auth.resetPasswordForEmail` — chamada de **cliente**, entregue pelo
> provedor de e-mail do **próprio Supabase**, não pelo SMTP do `suporte@`.

Por isso não há linha em `emails_enviados`, não há `Message-ID`, não há bounce:
a casa **não tem prova de que saiu nem de que quicou**. Conferido nela:
`recovery_sent_at` 18/09 00:27:40Z sem nenhuma linha correspondente no livro.

E o que fecha o argumento: o `suporte@` **entrega no Hotmail dela
perfeitamente** — várias cartas, zero bounce, ida e volta acontecendo. O único
e-mail que não chega é justamente o de autenticação, que sai por fora. A casa
tem um canal provado e usa outro, cego, pro e-mail mais crítico que existe.

Despachado `8dbc23a4` (`coder`): gerar o link no servidor com
`admin.auth.admin.generateLink` (que **não** dispara e-mail do Supabase) e
entregar pelo mailer da casa — com **não-enumeração de conta** preservada,
limite de taxa, e recusa dura de destino `localhost`.

### O que eu NÃO sei, e não vou fingir que sei

Não determinei se o link de 16/09 morreu por **expiração** (26h até ela tentar)
ou por ter sido **consumido por varredor de link do Outlook**. Os dois explicam o
sintoma e `auth.audit_log_entries` não guarda essa janela (0 linhas). A carta de
hoje ataca os dois caminhos.

### Feito, consumado

Carta individual com link novo pelo SMTP do `suporte@`, **19:00Z**, cópia
**confirmada** na pasta de enviados (**uid 2821**) e linha gravada em
`emails_enviados`. Destino do link conferido antes de mandar. A carta manda
**copiar e colar** em vez de tocar, e dá a ela um caminho de uma palavra
(responder `LINK`) pra pedir outro na hora — sem depender do "esqueci minha
senha" do site, que é justamente o cego.

Incidente → `aguardando_aluno` com a nota inteira. **Não** marquei `fixed`: ela
não entrou, e eu não sei se vai entrar.

### Escalado, porque carta sozinha já falhou duas vezes

Postei no grupo, marcado urgente: peço **uma pessoa da equipe** chamar ela no
WhatsApp do cadastro e ficar na linha dentro da hora de validade do link. Não
chamo aluno no WhatsApp em nome da empresa — a regra é que quem inicia é o
cliente, e não quebro isso sozinho. O endpoint de recovery-link da casa tem
exatamente esse propósito escrito no cabeçalho (caso Clínica Elgra, 21/07).

## Fila

| status | antes | depois |
|---|---|---|
| open | 3 | **2** |
| investigating | 90 | 90 |
| aguardando_aluno | 31 | **32** |
| fixed | 275 | 275 |
| ignored | 59 | 59 |

O `open` caiu de 3 pra 2 porque o `#1a37605a` virou `aguardando_aluno` — é
mudança de estado com carta consumada atrás, **não** é fechamento. Nada foi para
`fixed` nesta ronda, e isso é a resposta honesta: os dois consertos que esta
ronda produziu (`8dbc23a4` e `54582f34`) estão em worker, e o do `#32` está em
PR aberto esperando janela.

## Decisões que estão com o Johnny

1. **Janela pra mergear os dois PRs do worker** (#338 mitigação de entrada +
   #342 despejo). Merge recicla o endpoint de GPU: alguns minutos sem capacidade
   com aluno treinando ao vivo. Alternativa que o #338 recomenda: push na `dev`,
   que aponta o endpoint isolado `fast_cloner_TESTE_dev` (`workersMax` 0).
   **Pedida desde a ronda das 18h, ainda sem resposta.**
2. **Uma pessoa pra falar com a Walsicleia no WhatsApp** — hoje, dentro da hora
   do link. É o que encerra 14 dias de aluna pagante fora da plataforma.
