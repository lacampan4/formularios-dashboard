# Operaciones La Campana

Registro digital de la Orden de Trabajo (FO-OPE-001), la Orden de Suministro (FO-OPE-002), el ATS (FR-SST-011) y el Permiso de Trabajo de Alto Riesgo (FR-SST-039), más un dashboard. HTML, CSS y JavaScript puro con Supabase y Chart.js. No necesita compilación.

## Puesta en marcha

1. **Supabase → SQL Editor:** ejecute en orden `sql/1_esquema.sql`, `sql/2_semillas.sql`, `sql/3_roles.sql`, `sql/4_lista_roles.sql`, `sql/5_bandeja.sql`, `sql/6_consecutivos.sql`, `sql/7_os_fotos.sql` y `sql/8_ot_requisitos.sql`. Si vuelve a ejecutar uno, ejecute también todos los que siguen, porque cada uno ajusta reglas del anterior.
2. **Supabase → Authentication → Sign In / Providers:** desactive **"Allow new users to sign up"**. Si queda activo, cualquiera podría crearse una cuenta.
   **Authentication → Users → Add user → Create new user:** se entra con **usuario y contraseña**, sin correo real. Para el usuario `juan.perez` escriba como Email `juan.perez@usuarios.lacampana.co` (el dominio de `DOMINIO_USUARIOS` en `config.js`), ponga la contraseña y marque **Auto Confirm User**. Ese correo no existe y nunca recibe mensajes.
   **Table Editor → usuarios:** al crear el usuario aparece su fila; escriba su nombre completo en `nombre` y elija su `rol` (ver tabla abajo). Un usuario nuevo queda en `sin_rol` y no puede hacer nada hasta que se le asigne uno.
3. **`config.js`:** ponga `SUPABASE_URL` y `SUPABASE_ANON_KEY` (Project Settings → API).
4. Publique la carpeta en cualquier hosting estático (GitHub Pages, Netlify…) y abra `registro.html`.

## Roles

| Rol | Formularios que llena | Dashboard |
|---|---|---|
| `admin` (Dirección de Operaciones) | Todos, crea códigos de falla nuevos y usa la Consulta | Sí |
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
| `bandeja.html` / `bandeja.js` | Bandeja de entrada: las OT y OS en las que el usuario es responsable; desde ahí adjunta las fotos de la OS y las cierra |
| `consulta.html` / `consulta.js` | Lista de formatos guardados y detalle completo de cada uno, con impresión (solo admin). Enlace directo (por id interno): `consulta.html#OT/5`, `#OS/3`, `#ATS/2`, `#PT/4` |
| `dashboard.html` / `dashboard.js` | Indicadores, gráficas, tabla de órdenes y firmas |
| `comun.js` | Cliente Supabase, login y utilidades compartidas |
| `config.js` | Llaves y catálogos de la guía (frentes, líderes, EPP, medidas) |
| `styles.css` | Estilos según `DESIGN.md` |
| `sql/` | Esquema, reglas, seguridad (RLS) y códigos de falla |

## Reglas que aplica la base de datos

- La máquina es obligatoria en la OT y en cada ítem de la OS. La fecha y la hora las pone el servidor.
- La OT no lleva firmas: el solicitante es quien la registra y se escoge un **responsable**. La OT llega a la bandeja del responsable y solo él la pasa a **Cerrada**.
- El reporte de falla admite hasta 500 caracteres. Quien llena OT puede crear códigos de falla nuevos, que quedan en la lista para todos.
- Al revisar la OT, el responsable marca si requiere ATS y/o Permiso de trabajo de alto riesgo. Es su análisis: no impide cerrarla.
- La OS tampoco lleva firmas: llega a la bandeja del responsable, que adjunta una o más fotos como prueba (se comprimen en el teléfono antes de subirlas; Supabase rechaza archivos de más de 1 MB o que no sean JPEG). Sin foto no se puede cerrar. Las fotos no se pueden cambiar ni borrar.
- Cada formato (OT, OS, ATS, Permiso) recibe al guardar un número consecutivo propio de 5 dígitos (00001, 00002…), sin saltos.
- Nadie puede borrar órdenes.
- Sin sesión no se ve ni se registra nada.

## Prueba del esquema

`sql/prueba_esquema.mjs` corre las reglas contra un Postgres embebido, sin tocar Supabase:

```
npm i @electric-sql/pglite@0.2.17
node sql/prueba_esquema.mjs sql
```
