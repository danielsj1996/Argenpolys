# Backend

## Orígenes permitidos

La aplicación servida por Express puede conectarse al backend desde el mismo
origen sin configuración adicional. Para permitir un frontend servido desde
otro dominio, definí `ALLOWED_ORIGINS` como una lista de orígenes HTTP(S)
separados por comas, sin rutas:

```text
ALLOWED_ORIGINS=http://localhost:5173,https://mi-frontend.example.com
```

El backend aplica esta lista tanto a Express como a Socket.IO. Los clientes
sin encabezado `Origin` (por ejemplo, herramientas de servidor) siguen
permitidos; los navegadores de otro origen deben coincidir con la lista.

## Cuentas e historial con Supabase

La aplicación sigue permitiendo partidas como invitado. Para habilitar registro,
inicio de sesión e historial:

1. Creá un proyecto de Supabase y ejecutá [`supabase/schema.sql`](./supabase/schema.sql)
   en el SQL Editor.
2. Configurá estas variables en el entorno del backend (por ejemplo, Render):

   ```text
   SUPABASE_URL=https://<proyecto>.supabase.co
   SUPABASE_ANON_KEY=<clave-publica-anon>
   SUPABASE_SERVICE_ROLE_KEY=<clave-secreta-service-role>
   ```

   La clave `service_role` solo se usa en el servidor. No la publiques ni la
   agregues al frontend.
3. En Supabase Authentication, configurá la URL de redirección del sitio y,
   opcionalmente, habilitá los proveedores Google y Facebook y sus credenciales.
   Los botones OAuth aparecen en la pantalla de inicio; sus proveedores deben
   estar habilitados en el panel de Supabase.
4. Para desarrollo local, iniciá el backend desde `backend` con esas variables
   definidas en el entorno o en `backend/.env`. No subas ese archivo al repositorio.

El endpoint `/api/config` solo publica la URL y la clave `anon`, que están
diseñadas para uso público con Row Level Security. `/api/historial` requiere
una sesión válida. El servidor verifica los JWT de Supabase y guarda el
historial con la clave privada. Las partidas de invitados se pueden jugar pero
no se asocian a una cuenta.

## Fichas 3D

Los jugadores eligen caballo, computador o churros antes de crear o unirse a
una sala. La selección se conserva localmente y se replica a los participantes.
El backend solo acepta los identificadores de modelos incluidos en
`frontend/models/fichas3d`.
