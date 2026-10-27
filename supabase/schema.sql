-- SyC Dance Academy: esquema inicial.
-- Ejecuta este archivo en Supabase > SQL Editor con una cuenta propietaria del proyecto.
-- No lo ejecutes desde el navegador de la aplicación.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.dance_classes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  style text not null check (style in ('Bachata', 'Salsa Cubana', 'Salsa Línea', 'Kizomba', 'Otros')),
  level integer not null check (level between 0 and 3),
  weekday integer not null check (weekday between 1 and 7),
  start_time time not null,
  teacher text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.dance_classes(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (user_id, class_id)
);

create table if not exists public.class_videos (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.dance_classes(id) on delete cascade,
  title text not null,
  storage_path text unique,
  youtube_url text,
  created_at timestamptz not null default now(),
  constraint class_videos_media_source_check check (
    (storage_path is not null and youtube_url is null)
    or (storage_path is null and youtube_url is not null)
  ),
  constraint class_videos_youtube_url_check check (
    youtube_url is null
    or youtube_url ~* '^https?://(www[.])?(youtube[.]com/(shorts/|watch[?]v=|embed/)|youtu[.]be/)[A-Za-z0-9_-]{11}([?&#].*)?$'
  )
);

-- Perfil automático al registrarse. El rol se fuerza a student; nunca se toma del metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Función auxiliar para comprobar el rol sin provocar recursión de RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.dance_classes enable row level security;
alter table public.enrollments enable row level security;
alter table public.class_videos enable row level security;

-- Privilegios de tabla: las políticas RLS siguen limitando las filas.
revoke all on public.profiles, public.dance_classes, public.enrollments, public.class_videos from anon;
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
grant select, insert, update, delete on public.dance_classes to authenticated;
grant select, insert, update, delete on public.enrollments to authenticated;
grant select, insert, update, delete on public.class_videos to authenticated;

-- Profiles: cada persona ve su perfil; administración puede ver todos.
drop policy if exists "profile_select_self_or_admin" on public.profiles;
create policy "profile_select_self_or_admin" on public.profiles
for select to authenticated
using (id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "profile_update_self_or_admin" on public.profiles;
create policy "profile_update_self_or_admin" on public.profiles
for update to authenticated
using (id = (select auth.uid()) or (select public.is_admin()))
with check (id = (select auth.uid()) or (select public.is_admin()));

-- Dance classes: usuarios registrados ven las clases activas; administración gestiona todo.
drop policy if exists "classes_read_active_or_admin" on public.dance_classes;
create policy "classes_read_active_or_admin" on public.dance_classes
for select to authenticated
using (is_active = true or (select public.is_admin()));

drop policy if exists "classes_admin_insert" on public.dance_classes;
create policy "classes_admin_insert" on public.dance_classes
for insert to authenticated with check ((select public.is_admin()));

drop policy if exists "classes_admin_update" on public.dance_classes;
create policy "classes_admin_update" on public.dance_classes
for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "classes_admin_delete" on public.dance_classes;
create policy "classes_admin_delete" on public.dance_classes
for delete to authenticated using ((select public.is_admin()));

-- Enrollment: alumno solo ve las suyas e inserta solicitudes pendientes para sí mismo.
drop policy if exists "enrollments_read_self_or_admin" on public.enrollments;
create policy "enrollments_read_self_or_admin" on public.enrollments
for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "enrollments_insert_own_pending" on public.enrollments;
create policy "enrollments_insert_own_pending" on public.enrollments
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'pending'
  and exists (select 1 from public.dance_classes c where c.id = class_id and c.is_active = true)
);

drop policy if exists "enrollments_admin_update" on public.enrollments;
create policy "enrollments_admin_update" on public.enrollments
for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "enrollments_admin_delete" on public.enrollments;
create policy "enrollments_admin_delete" on public.enrollments
for delete to authenticated using ((select public.is_admin()));

-- Videos: el alumno solo ve metadata de vídeos de clases aprobadas.
drop policy if exists "videos_read_authorized_or_admin" on public.class_videos;
create policy "videos_read_authorized_or_admin" on public.class_videos
for select to authenticated
using (
  (select public.is_admin())
  or exists (
    select 1 from public.enrollments e
    where e.user_id = (select auth.uid())
      and e.class_id = class_videos.class_id
      and e.status = 'approved'
  )
);

drop policy if exists "videos_admin_insert" on public.class_videos;
create policy "videos_admin_insert" on public.class_videos
for insert to authenticated with check ((select public.is_admin()));

drop policy if exists "videos_admin_update" on public.class_videos;
create policy "videos_admin_update" on public.class_videos
for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "videos_admin_delete" on public.class_videos;
create policy "videos_admin_delete" on public.class_videos
for delete to authenticated using ((select public.is_admin()));

-- Bucket privado para vídeos de clases.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('class-videos', 'class-videos', false, 524288000,
        array['video/mp4','video/webm','video/quicktime','video/x-m4v'])
on conflict (id) do update set public = false;

-- Convención de rutas: <UUID-de-clase>/<nombre-de-archivo>
drop policy if exists "class_video_admin_upload" on storage.objects;
create policy "class_video_admin_upload" on storage.objects
for insert to authenticated
with check (bucket_id = 'class-videos' and (select public.is_admin()));

drop policy if exists "class_video_admin_update" on storage.objects;
create policy "class_video_admin_update" on storage.objects
for update to authenticated
using (bucket_id = 'class-videos' and (select public.is_admin()))
with check (bucket_id = 'class-videos' and (select public.is_admin()));

drop policy if exists "class_video_admin_delete" on storage.objects;
create policy "class_video_admin_delete" on storage.objects
for delete to authenticated
using (bucket_id = 'class-videos' and (select public.is_admin()));

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
      where e.user_id = (select auth.uid())
        and e.status = 'approved'
        and e.class_id::text = (storage.foldername(name))[1]
    )
  )
);

-- Nota: el primer administrador se asigna manualmente al final del README.
