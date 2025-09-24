-- Replace generate_code to avoid pgcrypto/gen_random_bytes dependency
-- Uses built-in md5() and random() with clock_timestamp() to produce a hex string
-- Length capped between 4 and 32 and uppercased for readability
create or replace function public.generate_code(p_len int default 8)
returns text
language sql
stable
as $$
  select upper(substr(md5(random()::text || clock_timestamp()::text), 1, greatest(4, least(p_len, 12))));
$$;
