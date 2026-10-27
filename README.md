# SyC Dance Academy — aplicación web

Aplicación responsive con React, Vite y Supabase para registro de alumnos, solicitudes de acceso, gestión de clases y biblioteca de vídeos privada.

## Requisitos

- Node.js LTS instalado.
- Visual Studio Code.
- Tu proyecto existente de Supabase.
- La URL del proyecto y la clave **publishable** (`sb_publishable_...`).

**No pongas nunca una clave `sb_secret_` ni `service_role` en el frontend.** No compartas contraseñas de base de datos.

## 1. Instalar el proyecto

Abre esta carpeta en VS Code. En Terminal ejecuta:

```bash
npm install
```

## 2. Configurar las variables de Supabase

Copia `.env.example` y crea un archivo nuevo llamado `.env.local` en la raíz del proyecto:

```bash
cp .env.example .env.local
```

En Windows también puedes crear `.env.local` manualmente desde el explorador de VS Code. Sustituye los valores de ejemplo:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_SB_PUBLISHABLE
```

Obtén ambos valores en el panel de Supabase, dentro de la configuración de API/Connect del proyecto. No añadas comillas. `.env.local` no debe subirse a Git.

## 3. Crear tablas y políticas seguras

1. Entra en el panel de tu proyecto Supabase.
2. Abre **SQL Editor** y crea una consulta nueva.
3. Copia el contenido de `supabase/schema.sql` y ejecútalo.
4. Revisa que se hayan creado las tablas `profiles`, `dance_classes`, `enrollments`, `class_videos` y el bucket privado `class-videos`.

El SQL habilita Row Level Security (RLS). Las clases están disponibles para usuarios autenticados; las solicitudes quedan pendientes; la metadata y los archivos de vídeo requieren acceso aprobado o rol de administrador.

## 4. Crear la primera cuenta de administrador

Haz primero una cuenta desde la aplicación (registro normal) y confirma el correo si Supabase lo solicita.

Después, en Supabase abre **SQL Editor** y ejecuta esta consulta, reemplazando el correo por el correo exacto de esa cuenta:

```sql
update public.profiles p
set role = 'admin'
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('TU_CORREO_DE_ADMIN');
```

Comprueba que el resultado haya afectado exactamente a una fila. Si no afectó ninguna, verifica que la cuenta se registró y que el perfil existe. No crees una interfaz que permita a los alumnos asignarse el rol de administrador.

Cierra sesión e inicia sesión de nuevo para cargar el rol actualizado.

## 5. Activar el inicio de sesión por correo

En Supabase, abre **Authentication → URL Configuration** y configura la URL local de desarrollo como `http://localhost:5173`. Al publicar la web, añade también la URL real de producción y configura las URL de redirección correspondientes.

En **Authentication → Providers → Email**, decide si exigirás confirmación de correo. Si la confirmación está activada, los alumnos deben verificar el correo antes de entrar.

## 6. Ejecutar localmente

```bash
npm run dev
```

Abre la URL local que muestra Vite (normalmente `http://localhost:5173`).

Para comprobar que compila:

```bash
npm run build
```

## Publicar en GitHub Pages

El repositorio incluye un flujo de GitHub Actions que construye y publica la aplicación al subir cambios a `main`. Para activarlo:

1. En GitHub, abre **Settings → Secrets and variables → Actions → New repository secret** y crea:
   - `VITE_SUPABASE_URL`: URL del proyecto Supabase.
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: clave publishable de Supabase. Nunca uses una clave `sb_secret_` o `service_role`.
2. Abre **Settings → Pages** y selecciona **GitHub Actions** como origen de publicación.
3. En Supabase, abre **Authentication → URL Configuration** y establece `https://elaipuej.github.io/syc_dance_academy/` como **Site URL**. Añade esa misma URL a las **Redirect URLs**.
4. En GitHub, abre **Actions** y comprueba que el flujo **Deploy to GitHub Pages** termine correctamente. La web estará en <https://elaipuej.github.io/syc_dance_academy/>.

No subas `.env.local` al repositorio. La aplicación es cliente y la clave publishable queda incluida en el JavaScript generado por el build; protege los datos mediante las políticas RLS de Supabase.

## 7. Flujo de uso

- El alumno crea su cuenta e inicia sesión.
- El alumno solicita acceso a una o varias clases.
- La pestaña **Mis clases** muestra las clases aprobadas y las solicitudes pendientes del alumno. Desde cada clase aprobada se accede a sus vídeos; **Todas las clases** conserva el catálogo para explorar y solicitar acceso.
- Un administrador aprueba o rechaza las solicitudes.
- El administrador añade clases desde la pestaña Administración.
- Para cargar el horario de SyC Dance Academy del curso 2026-2027, ejecuta `supabase/seed_schedule_2026_2027.sql` en **Supabase → SQL Editor** después de crear el esquema. El script solo inserta clases que no coincidan ya con los datos del horario.
- El administrador sube vídeos asociados a una clase.
- Después de crear las clases, ejecuta `supabase/youtube_videos_2026_2027.sql` en **Supabase → SQL Editor** para permitir y cargar los enlaces iniciales de YouTube. El script comprueba que existan las clases necesarias antes de insertar y se puede volver a ejecutar sin duplicar enlaces.
- Los vídeos solo aparecen a alumnos con acceso aprobado a la clase; las miniaturas se cargan de forma diferida y el reproductor de YouTube se abre al tocar una tarjeta.
- En el móvil, el botón Atrás recorre la navegación interna y permanece en la app al llegar a la pantalla inicial.
- Solo alumnos con matrícula `approved` para esa clase pueden consultar sus vídeos.
- Los archivos de vídeo subidos se almacenan en un bucket privado y la aplicación genera enlaces firmados de duración limitada. Los vídeos de YouTube siguen sujetos a las opciones de privacidad y disponibilidad definidas en YouTube.
- YouTube controla su reproductor incrustado: no se puede garantizar que el usuario no abra el vídeo en YouTube ni impedir que comparta un enlace. Para un control estricto del reproductor, aloja los vídeos en un servicio de streaming privado en lugar de YouTube.

## 8. Importante antes de publicar

- Añade una política de privacidad y el proceso de atención de solicitudes de protección de datos que corresponda.
- El límite de archivo del bucket de ejemplo es 500 MiB. Ajusta el límite y los tipos permitidos según los vídeos que vayas a subir y tu plan de Supabase.
- Si necesitas archivos de más de 500 MiB, usa cargas reanudables/TUS y configura los límites apropiados; este prototipo usa una carga estándar.
- La app de ejemplo permite cambiar roles desde el panel de administrador. Mantén la cuenta de administración protegida y asigna el rol inicial solo desde SQL.
- Revisa las políticas RLS en un entorno de prueba antes de guardar datos reales.
- El correo de los perfiles se obtiene de la sesión/autenticación; el ejemplo no muestra una columna de correo en `profiles`.
- No subas `.env.local` a Git. Si publicas el proyecto, configura las variables de entorno en el proveedor de hosting.

## Estructura

```text
syc-dance-academy/
├── src/
│   ├── lib/supabase.js
│   ├── App.jsx
│   ├── main.jsx
│   └── styles.css
├── supabase/schema.sql
├── .env.example
├── index.html
├── package.json
└── README.md
```
