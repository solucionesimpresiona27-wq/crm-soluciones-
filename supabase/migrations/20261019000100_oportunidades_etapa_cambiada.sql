-- Fecha en que la oportunidad llegó a su etapa actual (para "días en la etapa" del embudo).
alter table public.oportunidades add column etapa_cambiada_at timestamptz not null default now();
update public.oportunidades set etapa_cambiada_at = updated_at;

create or replace function public.tg_oportunidades_etapa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.etapa in ('ganado', 'perdido') then
    if tg_op = 'INSERT' or old.etapa is distinct from new.etapa then
      new.cerrada_at := coalesce(new.cerrada_at, now());
    end if;
  else
    new.cerrada_at := null;
  end if;
  if new.etapa <> 'perdido' then
    new.motivo_perdida := null;
  end if;
  if tg_op = 'INSERT' then
    new.etapa_cambiada_at := now();
  elsif old.etapa is distinct from new.etapa then
    new.etapa_cambiada_at := now();
  else
    new.etapa_cambiada_at := old.etapa_cambiada_at;
  end if;
  new.updated_at := now();
  return new;
end
$$;
