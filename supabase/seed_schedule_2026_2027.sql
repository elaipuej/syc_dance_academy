-- Horario SyC Dance Academy, curso 2026-2027.
-- Ejecuta este archivo en Supabase > SQL Editor después de crear el esquema.
-- Si se vuelve a ejecutar, no inserta clases que ya coincidan con estos datos.

with schedule (title, style, level, weekday, start_time, teacher) as (
  values
    ('Salsa Cubana 1', 'Salsa Cubana', 1, 2, time '18:00', 'Sergio y Carmen'),
    ('Salsa Línea 1', 'Salsa Línea', 2, 5, time '18:00', 'Sergio y Carmen'),
    ('Kizomba 0', 'Kizomba', 0, 1, time '19:00', 'Ana'),
    ('Bachata 1', 'Bachata', 1, 2, time '19:00', 'Sergio y Carmen'),
    ('Bachata 3', 'Bachata', 3, 3, time '19:00', 'Sergio y Carmen'),
    ('Bachata 0', 'Bachata', 0, 4, time '19:00', 'Raúl'),
    ('Bachata 2', 'Bachata', 2, 5, time '19:00', 'Sergio y Carmen'),
    ('Bachata 0', 'Bachata', 0, 1, time '20:00', 'Raúl'),
    ('Bachata 3', 'Bachata', 3, 2, time '20:00', 'Sergio y Carmen'),
    ('Salsa Línea 2', 'Salsa Línea', 3, 3, time '20:00', 'Sergio y Carmen'),
    ('Salsa Línea 0', 'Salsa Línea', 1, 4, time '20:00', 'Raúl'),
    ('Salsa Cubana 1', 'Salsa Cubana', 1, 5, time '20:00', 'Sergio y Carmen'),
    ('Salsa Cubana 0', 'Salsa Cubana', 0, 1, time '21:00', 'Raúl'),
    ('Salsa Cubana 2', 'Salsa Cubana', 2, 2, time '21:00', 'Sergio y Carmen'),
    ('Bachata 2', 'Bachata', 2, 3, time '21:00', 'Sergio y Carmen'),
    ('Kizomba 1', 'Kizomba', 1, 4, time '21:00', 'Ana'),
    ('Bachata 1', 'Bachata', 1, 5, time '21:00', 'Sergio y Carmen')
)
insert into public.dance_classes (title, style, level, weekday, start_time, teacher)
select s.title, s.style, s.level, s.weekday, s.start_time, s.teacher
from schedule s
where not exists (
  select 1
  from public.dance_classes c
  where c.title = s.title
    and c.style = s.style
    and c.level = s.level
    and c.weekday = s.weekday
    and c.start_time = s.start_time
    and c.teacher = s.teacher
);
