# 17/09 — "precisa de um humano olhar" deixa de ser motivo pra card parar

## O que aconteceu

O `#298` (Iran, `1095bb4b`) ficou **10 dias** parado. O passo que faltava estava
escrito na minha própria nota: *"humano olhar a imagem e decidir"*. Ninguém
olhou. Quando olhei, levou minutos — baixei as 6 referências do R2, comparei
com o resultado e o aluno estava certo.

Medido em 17/09: **13 chamados abertos travam no mesmo ponto** — alguém precisa
VER uma imagem, OUVIR um áudio ou ASSISTIR um vídeo. O mais velho tem **16
dias**. Seis passaram de uma semana. Todos com aluno nomeado esperando.

E o motivo não é falta de capacidade. A casa tem `olho` (lê imagem, vídeo e
áudio) e `qa` (enxerga tela) ociosos. O que faltava era **roteamento**: a ronda
escrevia "precisa de um humano" e seguia em frente, e isso virava parada
permanente porque nenhum agente de texto da fila ia resolver aquilo sozinho.

Três casos do mesmo dia mostram o custo: o João voltou **três vezes** por e-mail
antes de alguém assistir o vídeo dele — a resposta estava em 11 segundos de
gravação. O Diego ficou travado num portão de áudio que ninguém conferiu. O
Iran esperou 10 dias por um olhar de minutos.

## A regra, a partir de agora

**"Precisa ver / ouvir / assistir" NÃO é estado de parada. É despacho.**

Quando um card depender de percepção, a ronda que o encontrar faz, na MESMA
rodada, uma das duas coisas:

1. **Despacha.** Localiza o artefato (chave do R2, anexo, link), e manda para
   quem enxerga/ouve — `olho` para imagem, vídeo e áudio; `qa` para tela de
   produto. O veredito volta escrito na nota do card.
2. **Declara o bloqueio REAL.** Se o artefato não existe, não abre ou não está
   acessível, isso vai escrito com o motivo concreto ("link do Drive devolve
   404", "anexo não está no disco"). Aí sim é espera legítima, e fica com data.

O que **não** vale mais é escrever "precisa de um humano olhar" e seguir. Essa
frase, sozinha, é o que produziu 16 dias de silêncio.

## Como a ronda encontra esses cards

**O instrumento canônico é `_frank/ferramentas/percepcao_travada.cjs`** — ele
avalia a ÚLTIMA nota, desconta o boilerplate do sensor e tem controle positivo
(#310). Rode ELE a cada ronda, não o SQL.

> **Correção de 21/09.** A consulta originalmente publicada aqui varria
> `agent_notes::text` — a pilha de notas INTEIRA. Um card que um dia escreveu
> "assistir" casava para sempre, mesmo resolvido: ela mede HISTÓRICO e
> apresenta como PENDÊNCIA. Medido: 41 falsos em 17/09, e 18 em duas rondas
> seguidas de 20–21/09 (15 casavam só em nota já superada — 702cc916,
> ab5644be, bb97e2f1 entre eles), enquanto o `percepcao_travada.cjs` achava 2.
> O estado do card mora na ÚLTIMA nota (`agent_notes -> -1`); a versão abaixo
> foi corrigida para isso. Em `agent_notes` null ou vazio, `-> -1` devolve
> null e a linha simplesmente não casa — não explode.

> **Segunda correção de 21/09 (ronda 18hZ).** A varredura só contava
> `open`/`investigating` — mas card travado em percepção costuma estar em
> `aguardando_aluno`, e esse rótulo MENTE sobre quem deve o próximo passo:
> quando a casa é que precisa VER/OUVIR, quem trava é a CASA. Medido:
> 13 cartões em `aguardando_aluno` casavam a condição de palavra-chave, todos
> com aluno nomeado, invisíveis em toda contagem. Custo real: no `#207` o
> Vigia avisou em 11/09 que a garantia vencia em ~11,7h; ninguém viu, a
> garantia venceu e o aluno ficou com R$97 sem devolução. `aguardando_aluno`
> entrou no filtro abaixo e no script; `fixed`/`ignored` seguem fora — a ordem
> quer quem está ESPERANDO, não histórico, e são os status em que a
> reincidência reabre o cartão sozinha.

Consulta de apoio corrigida (só se o script não estiver à mão):

```sql
select id, created_at, status, signature, affected_emails
from incidents
where status in ('open','investigating','aguardando_aluno')
  and (agent_notes -> -1 ->> 'note' ilike '%humano olhar%'
    or agent_notes -> -1 ->> 'note' ilike '%precisa olhar%'
    or agent_notes -> -1 ->> 'note' ilike '%nao enxergo%'
    or agent_notes -> -1 ->> 'note' ilike '%nao ouco%'
    or agent_notes -> -1 ->> 'note' ilike '%assistir%'
    or agent_notes -> -1 ->> 'note' ilike '%ouvir%')
order by created_at;
```

O número entra no relatório **com a idade do mais velho**. Silêncio nessa
classe não pode parecer saúde — foi exatamente assim que ela chegou a 13.

## O que isto NÃO autoriza

Não autoriza decidir por ninguém em cima do que se viu. Ver é medir; o que se
faz com a medição continua valendo as regras de sempre (dinheiro do Johnny, GPU
com aval, aluno avisado pelo canal certo). E continua valendo declarar o que
**não** foi visto: se o vídeo não abriu, escreve-se que não abriu — nunca se
finge ter assistido.
