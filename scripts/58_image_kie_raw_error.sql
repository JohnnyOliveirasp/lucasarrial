-- 58: erro CRU do Kie na própria row (caso 05/08: 7 falhas Seedream investigadas
-- às cegas — log do pm2 gira em minutos e o erro real se perdeu).
alter table public.image_generations add column if not exists kie_raw_error text;
