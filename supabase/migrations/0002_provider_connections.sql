create table provider_connections (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique,
  provider text not null check (provider in ('star', 'hdfc-ergo')),
  account_id text not null,
  access_token_ciphertext text not null,
  scope text not null,
  expires_at timestamptz not null,
  selected_policy_id text,
  
  policy_snapshot jsonb,
  balance_snapshot jsonb,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- App routes use the server-only service role; browser roles get no claim or token access.
alter table provider_connections enable row level security;
alter table journeys enable row level security;
alter table events enable row level security;
alter table documents enable row level security;
alter table mock_claims enable row level security;
revoke all on table provider_connections from anon, authenticated;

alter table journeys add column connection_id uuid references provider_connections(id);
alter table journeys add column provider_policy_id text;
alter table journeys add column assessment jsonb;

create index journeys_connection_id_idx on journeys(connection_id);

insert into storage.buckets (id, name, public)
values ('claim-documents', 'claim-documents', false)
on conflict (id) do nothing;

insert into policies (id, insurer, product, wording_version, source_pdf)
values ('pol_hdfc_demo', 'HDFC ERGO (mock)', 'Synthetic Health Plan', 'DEMO-1', null)
on conflict (id) do nothing;
