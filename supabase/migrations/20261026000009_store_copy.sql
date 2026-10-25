-- The DND Club · notification copy for the new storefront.
-- The delivered notice used to point at The Pulse, which the redesign removed. Point it at the
-- order page instead, where reviews and size exchanges now live.
create or replace function public.orders_delivered_link() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'delivered' and old.status is distinct from new.status then
    update public.notifications
       set link = '/orders/' || new.id, body = 'How does it fit? Rate it, or swap the size within 7 days.'
     where user_id = new.user_id and kind = 'order_delivered' and link = '/pulse' and dispatched_at is null;
  end if;
  return null;
end $$;

-- Runs after orders_change, which sends the notice (triggers fire in name order).
create trigger orders_zz_delivered_link after update of status on public.orders
  for each row execute function public.orders_delivered_link();
