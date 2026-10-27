-- Ejecutar una vez en Supabase > SQL Editor para habilitar la gestión de alumnos.
-- Añade el estado de cuenta y limita matrículas/lecturas a cuentas activas.

alter table public.profiles
  add column if not exists is_active boolean not null default true;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and p.is_active = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
revoke update (is_active) on public.profiles from anon, authenticated;

create or replace function public.set_student_active(
  target_user_id uuid,
  new_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar el acceso de alumnos.'
      using errcode = '42501';
  end if;

  update public.profiles
  set is_active = new_is_active
  where id = target_user_id
    and role = 'student';

  if not found then
    raise exception 'No se encontró el perfil de alumno.'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.set_student_active(uuid, boolean) from public, anon;
grant execute on function public.set_student_active(uuid, boolean) to authenticated;

drop policy if exists "classes_read_active_or_admin" on public.dance_classes;
create policy "classes_read_active_or_admin" on public.dance_classes
for select to authenticated
using (
  (select public.is_admin())
  or (
    is_active = true
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_active = true
    )
  )
);

drop policy if exists "enrollments_read_self_or_admin" on public.enrollments;
create policy "enrollments_read_self_or_admin" on public.enrollments
for select to authenticated
using (
  (select public.is_admin())
  or (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_active = true
    )
  )
);

drop policy if exists "enrollments_insert_own_pending" on public.enrollments;
create policy "enrollments_insert_own_pending" on public.enrollments
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'pending'
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active = true
  )
  and exists (
    select 1 from public.dance_classes c
    where c.id = class_id and c.is_active = true
  )
);

drop policy if exists "enrollments_admin_insert" on public.enrollments;
create policy "enrollments_admin_insert" on public.enrollments
for insert to authenticated
with check ((select public.is_admin()));

drop policy if exists "enrollments_admin_update" on public.enrollments;
create policy "enrollments_admin_update" on public.enrollments
for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "enrollments_admin_delete" on public.enrollments;
drop policy if exists "enrollments_delete_own_pending_or_admin" on public.enrollments;
create policy "enrollments_delete_own_pending_or_admin" on public.enrollments
for delete to authenticated
using (
  (select public.is_admin())
  or (
    user_id = (select auth.uid())
    and status = 'pending'
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_active = true
    )
  )
);

drop policy if exists "videos_read_authorized_or_admin" on public.class_videos;
create policy "videos_read_authorized_or_admin" on public.class_videos
for select to authenticated
using (
  (select public.is_admin())
  or exists (
    select 1
    from public.enrollments e
    join public.profiles p on p.id = e.user_id
    where e.user_id = (select auth.uid())
      and e.class_id = class_videos.class_id
      and e.status = 'approved'
      and p.is_active = true
  )
);

drop policy if exists "class_video_authorized_read" on storage.objects;
create policy "class_video_authorized_read" on storage.objects
for select to authenticated
using (
  bucket_id = 'class-videos'
  and (
    (select public.is_admin())
    or exists (
      select 1
      from public.enrollments e
      join public.profiles p on p.id = e.user_id
      where e.user_id = (select auth.uid())
        and e.status = 'approved'
        and e.class_id::text = (storage.foldername(name))[1]
        and p.is_active = true
    )
  )
);
