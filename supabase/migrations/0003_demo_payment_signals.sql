create table payment_signals (
  order_id text primary key,
  session_id uuid not null,
  hospital_name text not null,
  amount_paise bigint not null check (amount_paise > 0),
  payment_id text unique,
  payment_method text,
  status text not null default 'created' check (status in ('created', 'paid', 'failed')),
  paid_at timestamptz,
  seen_at timestamptz,
  created_at timestamptz not null default now()
);

create index payment_signals_session_paid_idx on payment_signals(session_id, paid_at desc);
alter table payment_signals enable row level security;
revoke all on table payment_signals from anon, authenticated;
