# Operaciones La Campana

Registro digital de la Orden de Trabajo (FO-OPE-001), la Orden de Suministro (FO-OPE-002), el ATS (FR-SST-011) y el Permiso de Trabajo de Alto Riesgo (FR-SST-039), más un dashboard. HTML, CSS y JavaScript puro con Supabase y Chart.js. No necesita compilación.

## Puesta en marcha

1. **Supabase → SQL Editor:** ejecute en orden `sql/1_esquema.sql`, `sql/2_semillas.sql`, `sql/3_roles.sql` y `sql/4_lista_roles.sql`.
2. **Supabase → Authentication → Sign In / Providers:** desactive **"Allow new users to sign up"**. Si queda activo, cualquiera podría crearse una cuenta.
   **Authentication → Users → Add user → Create new user:** se entra con **usuario y contraseña**, sin correo real. Para el usuario `juan.perez` escriba como Email `juan.perez@usuarios.lacampana.co` (el dominio de `DOMINIO_USUARIOS` en `config.js`), ponga la contraseña y marque **Auto Confirm User**. Ese correo no existe y nunca recibe mensajes.
   **Table Editor → usuarios:** al crear el usuario aparece su fila; escriba su nombre completo en `nombre` y elija su `rol` (ver tabla abajo). Un usuario nuevo queda en `sin_rol` y no puede hacer nada hasta que se le asigne uno.
3. **`config.js`:** ponga `SUPABASE_URL` y `SUPABASE_ANON_KEY` (Project Settings → API).
4. Publique la carpeta en cualquier hosting estático (GitHub Pages, Netlify…) y abra `registro.html`.

## Roles

| Rol | Formularios que llena | Dashboard |
|---|---|---|
| `admin` (Dirección de Operaciones) | Todos, y completa las firmas | Sí |
| `produccion` | OT y OS | No |
| `mantenimiento` | OT, OS, ATS y Permiso | No |
| `abastecimiento` | OS | No |
| `sst` | ATS y Permiso | No |
| `sin_rol` | Ninguno | No |

En **Table Editor → usuarios**, la columna `rol` es una lista desplegable con todos los roles. `admin` no aparece en `rol_formatos` porque no lo necesita: puede todo.

Qué formato llena cada rol está en la tabla `rol_formatos` (Table Editor) y se puede cambiar sin tocar el código. La base de datos aplica los roles, así que esconder un botón no es lo único que los protege: cada rol solo ve lo que necesita para llenar sus formatos, y solo `admin` ve los datos del dashboard.

## Seguridad: nada de contraseñas en el código

- **Nunca** ponga en el código ni suba a GitHub contraseñas, la llave secreta (`sb_secret_…` o `service_role`) ni la contraseña de la base de datos. Si alguna se sube, rótela de inmediato en Supabase: borrarla del repositorio no basta, porque queda en el historial.
- En `config.js` solo va la URL y la llave **publishable** (`sb_publishable_…` o `anon`). Esa llave está hecha para ir en el navegador; lo que protege los datos son las reglas RLS de `sql/1_esquema.sql`. Si alguien pega la llave secreta, la app se niega a arrancar.
- Las contraseñas de los usuarios las guarda Supabase Auth, cifradas. La app nunca las almacena.

## Archivos

| Archivo | Qué hace |
|---|---|
| `registro.html` / `registro.js` | Los cuatro formatos en pestañas |
| `dashboard.html` / `dashboard.js` | Indicadores, gráficas, tabla de órdenes y firmas |
| `comun.js` | Cliente Supabase, login y utilidades compartidas |
| `config.js` | Llaves y catálogos de la guía (frentes, líderes, EPP, medidas) |
| `styles.css` | Estilos según `DESIGN.md` |
| `sql/` | Esquema, reglas, seguridad (RLS) y códigos de falla |

## Reglas que aplica la base de datos

- La máquina es obligatoria en la OT y en cada ítem de la OS. La fecha y la hora las pone el servidor.
- Una orden pasa a **Cerrada** solo con las tres firmas: Autorizado, Entregado y Recibido.
- Una OT de alto riesgo no se puede marcar como entregada sin un ATS y un Permiso vinculados.
- Riesgo para personas obliga a prioridad Rojo.
- Nadie puede borrar órdenes. Después de creadas solo `admin` puede completar las firmas.
- Sin sesión no se ve ni se registra nada.

## Prueba del esquema

`sql/prueba_esquema.mjs` corre las reglas contra un Postgres embebido, sin tocar Supabase:

```
npm i @electric-sql/pglite@0.2.17
node sql/prueba_esquema.mjs sql
```
