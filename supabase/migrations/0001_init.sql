create extension if not exists vector;

create table journeys (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('claim', 'loan')),
  state text not null default 'triggered',
  customer_id text not null,
  policy_id text,
  language text not null default 'en',
  extracted jsonb not null default '{}',
  score int,
  score_breakdown jsonb,
  claim_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references journeys(id),
  ts timestamptz not null default now(),
  kind text not null check (kind in ('transition', 'llm_call', 'rule_eval', 'external_call', 'user_action')),
  payload jsonb not null default '{}'
);

-- append-only: nobody updates or deletes an event
create function events_readonly() returns trigger language plpgsql as $$
begin raise exception 'events are append-only'; end $$;
create trigger events_readonly before update or delete on events
  for each row execute function events_readonly();

create table documents (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references journeys(id),
  kind text not null,
  storage_path text not null,
  sha256 text not null,
  extracted jsonb,
  created_at timestamptz not null default now()
);

create table policies (
  id text primary key,
  insurer text not null,
  product text not null,
  wording_version text not null,
  source_pdf text
);

create table policy_chunks (
  id uuid primary key default gen_random_uuid(),
  policy_id text not null references policies(id),
  clause_ref text,
  page int not null,
  text text not null,
  embedding vector
);

create table mock_claims (
  claim_id text primary key,
  journey_id uuid not null references journeys(id),
  status text not null,
  status_history jsonb not null default '[]'
);
