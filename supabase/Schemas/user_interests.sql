create table public.user_interests (
  user_id uuid not null,
  interest_id bigint not null,
  created_at timestamp without time zone null default now(),
  constraint user_interests_pkey primary key (user_id, interest_id),
  constraint fk_interest_id foreign KEY (interest_id) references interests (id) on delete CASCADE,
  constraint user_interests_interest_id_fkey foreign KEY (interest_id) references interests (id) on delete CASCADE,
  constraint user_interests_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_user_interests_user_id on public.user_interests using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_user_interests_interest_id on public.user_interests using btree (interest_id) TABLESPACE pg_default;

create index IF not exists idx_user_interests_created_at on public.user_interests using btree (created_at) TABLESPACE pg_default;

create trigger trg_prevent_duplicate_user_interests BEFORE INSERT on user_interests for EACH row
execute FUNCTION prevent_duplicate_user_interests ();