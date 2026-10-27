-- Añade compatibilidad con enlaces de YouTube y carga los vídeos compartidos.
-- Seguro para volver a ejecutar: no duplica enlaces ya asociados a una clase.

alter table public.class_videos
  add column if not exists youtube_url text;

alter table public.class_videos
  alter column storage_path drop not null;

alter table public.class_videos
  drop constraint if exists class_videos_media_source_check;

alter table public.class_videos
  add constraint class_videos_media_source_check check (
    (storage_path is not null and youtube_url is null)
    or (storage_path is null and youtube_url is not null)
  );

alter table public.class_videos
  drop constraint if exists class_videos_youtube_url_check;

alter table public.class_videos
  add constraint class_videos_youtube_url_check check (
    youtube_url is null
    or youtube_url ~* '^https?://(www[.])?(youtube[.]com/(shorts/|watch[?]v=|embed/)|youtu[.]be/)[A-Za-z0-9_-]{11}([?&#].*)?$'
  );

do $$
begin
  if exists (
    select required.title
    from (values ('Bachata 2'), ('Bachata 3'), ('Salsa Línea 1'), ('Salsa Línea 2')) as required(title)
    where not exists (
      select 1 from public.dance_classes c where c.title = required.title
    )
  ) then
    raise exception 'Faltan clases del horario. Ejecuta primero supabase/seed_schedule_2026_2027.sql.';
  end if;
end;
$$;

with videos (class_title, title, youtube_url) as (
  values
    ('Bachata 2', 'Clase 1', 'https://youtube.com/shorts/GLrzsMZ1rMA'),
    ('Bachata 2', 'Clase 2', 'https://youtube.com/shorts/qboQi-EBb5c'),
    ('Bachata 2', 'Clase 3', 'https://youtube.com/shorts/bbWH3FQ3ucs'),
    ('Bachata 2', 'Clase 4', 'https://youtube.com/shorts/9WtfFcNz7GA'),
    ('Bachata 2', 'Clase 5', 'https://youtube.com/shorts/4B7djDy_hFQ'),
    ('Bachata 2', 'Clase 6', 'https://youtube.com/shorts/_6R2cqAEBZE'),
    ('Bachata 2', 'Clase 7', 'https://youtube.com/shorts/DWz1DCen-rQ'),
    ('Bachata 3', 'Clase 1', 'https://youtube.com/shorts/gwY61KUuBu0'),
    ('Bachata 3', 'Clase 2', 'https://youtube.com/shorts/8_PsNAS6Zo8'),
    ('Bachata 3', 'Clase 3', 'https://youtube.com/shorts/Kqq7Jp2_Ssk'),
    ('Bachata 3', 'Clase 4', 'https://youtube.com/shorts/dUx2xIbXbrc'),
    ('Bachata 3', 'Clase 5', 'https://youtube.com/shorts/2Hesb4yBREE'),
    ('Salsa Línea 1', 'Clase 1', 'https://youtube.com/shorts/3KILgpCBQXA'),
    ('Salsa Línea 1', 'Clase 2', 'https://youtube.com/shorts/IUZNePNfW6Q'),
    ('Salsa Línea 1', 'Clase 3', 'https://youtube.com/shorts/EIVpOvw3boY'),
    ('Salsa Línea 1', 'Clase 4', 'https://youtube.com/shorts/bW6teS9yvBc'),
    ('Salsa Línea 1', 'Clase 5', 'https://youtube.com/shorts/quYE9IHH9uY'),
    ('Salsa Línea 1', 'Clase 6', 'https://youtube.com/shorts/8UNZZMKdNOE'),
    ('Salsa Línea 2', 'Clase 1', 'https://youtube.com/shorts/8d36-Ik_Oyo'),
    ('Salsa Línea 2', 'Clase 2', 'https://youtube.com/shorts/GNy4LJAJ5mM'),
    ('Salsa Línea 2', 'Clase 3', 'https://youtube.com/shorts/9BCHB68y8r0'),
    ('Salsa Línea 2', 'Clase 4', 'https://youtube.com/shorts/5GJcVlblAKc'),
    ('Salsa Línea 2', 'Clase 5', 'https://youtube.com/shorts/LfJyHDCfK0M')
)
insert into public.class_videos (class_id, title, youtube_url)
select c.id, v.title, v.youtube_url
from videos v
join public.dance_classes c on c.title = v.class_title
where not exists (
  select 1
  from public.class_videos existing
  where existing.class_id = c.id
    and existing.youtube_url = v.youtube_url
);
