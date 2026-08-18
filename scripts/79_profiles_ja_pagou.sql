-- 79_profiles_ja_pagou.sql
--
-- POR QUE ISTO EXISTE (Frank, 18/08):
-- Precisamos saber se um usuario JA PAGOU alguma vez, porque a trava do debito
-- passa a ser "nunca pagou e o trial acabou -> nao gasta" (ordem
-- _frank/ordens/2026-08-18_regra_final_pagou_fica.md).
--
-- Nao da pra derivar isso das transacoes: `subscription_grant | payment_event`
-- NAO prova pagamento. O trial gratuito da Hotmart gera o MESMO carimbo de
-- +100.000 que uma venda. Verificado nos 4 trials que a API viva marcava
-- trial:true / price 0.00 - todos tinham payment_event de 100.000.
-- Ver playbook N em _frank/04_PLAYBOOKS.md.
--
-- Tambem nao da pra ler do entitlements.raw_event: ele guarda UM evento so,
-- nao o historico. O ddfleury@gmail.com tem o evento do trial gravado
-- (value=0, rec#=1) e mesmo assim recebeu recarga depois.
--
-- A trava le SO estas colunas. Nunca chamar a Hotmart no caminho do debito:
-- seria lento e, se a Hotmart cair, ninguem gera nada.
--
-- SEGURANCA: puramente ADITIVO. Nao altera nem remove coluna existente, nao
-- toca em dado. Reversao completa = DROP das 3 colunas e do indice.
-- O BACKFILL vai em commit SEPARADO, com fonte no GET /sales/history da
-- Hotmart (testado 18/08, HTTP 200) cruzado com extra_purchase|stripe_session.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ja_pagou        boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ja_pagou_em     timestamptz NULL,
  ADD COLUMN IF NOT EXISTS ja_pagou_origem text        NULL;

COMMENT ON COLUMN public.profiles.ja_pagou IS
  'true = entrou dinheiro em algum momento. E o que a trava do debito le. NUNCA inferir por saldo: bonus, cortesia e estorno tambem viram saldo.';

COMMENT ON COLUMN public.profiles.ja_pagou_em IS
  'Quando a primeira cobranca com valor > 0 foi constatada. Existe para auditoria: booleano pelado nao se defende quando o aluno reclama.';

COMMENT ON COLUMN public.profiles.ja_pagou_origem IS
  'Como foi constatado: stripe_session | hotmart_sales_history | manual_johnny.';

-- Indice parcial: a trava so pergunta pelos que NAO pagaram, que e o conjunto
-- pequeno. Indice cheio em boolean nao pagaria o custo de manutencao.
CREATE INDEX IF NOT EXISTS idx_profiles_ja_pagou_false
  ON public.profiles (id) WHERE ja_pagou = false;

-- REVERSAO:
--   DROP INDEX IF EXISTS idx_profiles_ja_pagou_false;
--   ALTER TABLE public.profiles
--     DROP COLUMN IF EXISTS ja_pagou,
--     DROP COLUMN IF EXISTS ja_pagou_em,
--     DROP COLUMN IF EXISTS ja_pagou_origem;
