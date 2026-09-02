-- 103 — SGP: anexar foto/áudio é ATÔMICO NO BANCO (incidente #238).
--
-- O QUE QUEBRAVA (lost update clássico, medido em produção):
-- `api/v1/sgp/foto/route.ts` lia `pedido.fotos` (o snapshot), AGUARDAVA a
-- impressão digital + a chamada de visão (segundos) e só então gravava
-- `atualizarSessao(..., { fotos: atuais.concat(foto) })`. O `atualizarSessao`
-- é um `.update()` cego: sem merge, sem lock, sem versão. E o cliente sobe em
-- PARALELO (`for (const f of cortada) void enviarUma(f)`), então N fotos
-- escolhidas juntas viravam N requests que liam o MESMO array vazio e cada uma
-- gravava o SEU array de 1 item. Sobrava 1. As outras sumiam sem erro nenhum
-- na tela — o aluno via ✅ e o banco ficava com uma foto só.
--
-- PROVA: sessão 3e2a184d-5b8e-402d-8bb4-eea5db982981 tem 16 objetos em
-- `sgp/<sessao>/fotos/` no R2 e 1 no banco (rajadas de 6 objetos em 350ms).
-- Controle: sessão 9aa88367-0365-4bc4-b644-9868d7c6368d subiu 6 fotos UMA A UMA
-- (5–30s de intervalo) e gravou 4 + recusou 2 repetidas, certinho. Mesmo código,
-- resultado oposto: só muda a concorrência.
--
-- O CONSERTO: o append deixa de existir em JS. Aqui a linha é travada
-- (`select ... for update`) e a leitura, a decisão e a escrita acontecem na
-- MESMA transação. Duas requisições concorrentes viram fila, não corrida.
--
-- POR QUE AS REGRAS VIERAM JUNTO PRA CÁ: teto e "repetida" decididos em JS
-- sobre o snapshot velho voltariam a furar sob concorrência (dois requests
-- leem 5 fotos e os dois passam no teto de 6 → grava 7). Então o teto e o
-- dedup são avaliados DENTRO da trava, sobre o array de verdade. O JS mantém
-- as mesmas checagens ANTES da visão, mas só como atalho pra não gastar uma
-- chamada paga à toa — quem decide é aqui.
--
-- SEMÂNTICA PRESERVADA: mesma `key` continua SUBSTITUINDO a entrada anterior
-- (era o `filter(f => f.key !== key)` do route). No caminho atômico isso é
-- remover-a-key-e-concatenar dentro da MESMA instrução, nunca em duas etapas.
--
-- REVERSÍVEL: `drop function` das quatro abaixo e voltar os routes ao
-- `atualizarSessao`. Não altera nenhuma coluna, nenhum dado existente.

-- Distância de Hamming entre dois dHash em hex — o espelho exato de
-- `distancia()` em lib/sgp/impressao-foto.ts (64 bits = 16 chars).
-- Hex inválido ou tamanhos diferentes devolvem 64 ("nada a ver"), igual ao TS:
-- a impressão nunca pode DERRUBAR um upload, só barrar repetição óbvia.
create or replace function public.sgp_dhash_distancia(a text, b text)
returns int
language plpgsql
immutable
as $$
declare
  n int := 0;
  i int;
  ha int;
  hb int;
  x int;
begin
  if a is null or b is null or length(a) <> length(b) then
    return 64;
  end if;
  for i in 1..length(a) loop
    ha := position(lower(substr(a, i, 1)) in '0123456789abcdef') - 1;
    hb := position(lower(substr(b, i, 1)) in '0123456789abcdef') - 1;
    if ha < 0 or hb < 0 then
      return 64;  -- não é hex: trata como diferente, nunca como repetida
    end if;
    x := ha # hb;
    while x > 0 loop
      n := n + (x & 1);
      x := x >> 1;
    end loop;
  end loop;
  return n;
end $$;

comment on function public.sgp_dhash_distancia is
  'Hamming entre dois dHash hex do SGP. Espelho de distancia() em lib/sgp/impressao-foto.ts. Entrada inválida = 64 (diferente).';

-- Anexa UMA foto ao pedido, com a linha travada.
--   ok=false + reason: 'sem_pedido' | 'sem_key' | 'repetida' | 'max'
-- Nenhum caminho descarta a foto em silêncio: ou entra, ou volta com motivo.
create or replace function public.sgp_anexar_foto(
  p_sessao        uuid,
  p_foto          jsonb,
  p_max           int,
  p_dhash_limite  int
) returns jsonb
language plpgsql
as $$
declare
  v_atuais    jsonb;
  v_restantes jsonb;
  v_key       text := p_foto->>'key';
  v_sha       text := p_foto->>'sha256';
  v_dhash     text := p_foto->>'dhash';
  v_n         int;
begin
  if v_key is null or v_key = '' then
    return jsonb_build_object('ok', false, 'reason', 'sem_key');
  end if;

  -- A TRAVA. Daqui até o commit, mais ninguém mexe nesta linha.
  select fotos into v_atuais
    from public.sgp_pedidos
   where sessao = p_sessao
     for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'sem_pedido');
  end if;
  v_atuais := coalesce(v_atuais, '[]'::jsonb);

  -- Mesma key = reenvio da MESMA foto: a nova substitui a antiga.
  select coalesce(jsonb_agg(e), '[]'::jsonb) into v_restantes
    from jsonb_array_elements(v_atuais) e
   where e->>'key' is distinct from v_key;

  -- Repetida (sha256 idêntico ou dHash perto): mesma regra do ehRepetida(),
  -- só que sobre o array de VERDADE, não sobre o snapshot de segundos atrás.
  if exists (
    select 1
      from jsonb_array_elements(v_restantes) e
     where (v_sha is not null and e->>'sha256' = v_sha)
        or (v_dhash is not null
            and e->>'dhash' is not null
            and public.sgp_dhash_distancia(e->>'dhash', v_dhash) <= p_dhash_limite)
  ) then
    return jsonb_build_object('ok', false, 'reason', 'repetida');
  end if;

  -- Teto dentro da trava: sem isso duas requisições leem "5" e gravam 7.
  v_n := jsonb_array_length(v_restantes);
  if v_n >= p_max then
    return jsonb_build_object('ok', false, 'reason', 'max', 'total', v_n);
  end if;

  update public.sgp_pedidos
     set fotos = v_restantes || jsonb_build_array(p_foto)
   where sessao = p_sessao;

  return jsonb_build_object('ok', true, 'total', v_n + 1);
end $$;

comment on function public.sgp_anexar_foto is
  'Anexa uma foto ao pedido do SGP com a linha travada (incidente #238: append em JS perdia fotos em upload paralelo). Teto e dedup avaliados DENTRO da trava.';

-- Anexa UM áudio. Mesma trava, mesma substituição por key. Sem dedup: áudio
-- não tem impressão digital (o aluno pode legitimamente mandar dois trechos
-- parecidos do mesmo ambiente), então aqui só existe o teto de arquivos.
create or replace function public.sgp_anexar_audio(
  p_sessao uuid,
  p_audio  jsonb,
  p_max    int
) returns jsonb
language plpgsql
as $$
declare
  v_atuais    jsonb;
  v_restantes jsonb;
  v_key       text := p_audio->>'key';
  v_n         int;
begin
  if v_key is null or v_key = '' then
    return jsonb_build_object('ok', false, 'reason', 'sem_key');
  end if;

  select audios into v_atuais
    from public.sgp_pedidos
   where sessao = p_sessao
     for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'sem_pedido');
  end if;
  v_atuais := coalesce(v_atuais, '[]'::jsonb);

  select coalesce(jsonb_agg(e), '[]'::jsonb) into v_restantes
    from jsonb_array_elements(v_atuais) e
   where e->>'key' is distinct from v_key;

  v_n := jsonb_array_length(v_restantes);
  if v_n >= p_max then
    return jsonb_build_object('ok', false, 'reason', 'max', 'total', v_n);
  end if;

  update public.sgp_pedidos
     set audios = v_restantes || jsonb_build_array(p_audio)
   where sessao = p_sessao;

  return jsonb_build_object('ok', true, 'total', v_n + 1);
end $$;

comment on function public.sgp_anexar_audio is
  'Anexa um áudio ao pedido do SGP com a linha travada (incidente #238). Janela de corrida ainda maior que a da foto: o route tem maxDuration=300 por causa do ffmpeg.';

-- REMOÇÃO também precisa ser uma instrução só: um DELETE que lê em JS e grava
-- o array filtrado apaga, sem querer, a foto que um POST concorrente acabou de
-- anexar. Aqui a leitura e a escrita são a MESMA instrução.
create or replace function public.sgp_remover_foto(p_sessao uuid, p_key text)
returns jsonb
language sql
as $$
  update public.sgp_pedidos p
     set fotos = coalesce(
           (select jsonb_agg(e)
              from jsonb_array_elements(p.fotos) e
             where e->>'key' is distinct from p_key),
           '[]'::jsonb)
   where p.sessao = p_sessao
  returning jsonb_build_object('ok', true, 'total', jsonb_array_length(p.fotos));
$$;

comment on function public.sgp_remover_foto is
  'Tira uma foto do pedido do SGP numa instrução só (incidente #238: DELETE com filtro em JS apagava o append concorrente).';

create or replace function public.sgp_remover_audio(p_sessao uuid, p_key text)
returns jsonb
language sql
as $$
  update public.sgp_pedidos p
     set audios = coalesce(
           (select jsonb_agg(e)
              from jsonb_array_elements(p.audios) e
             where e->>'key' is distinct from p_key),
           '[]'::jsonb)
   where p.sessao = p_sessao
  returning jsonb_build_object('ok', true, 'total', jsonb_array_length(p.audios));
$$;

comment on function public.sgp_remover_audio is
  'Tira um áudio do pedido do SGP numa instrução só (incidente #238).';
