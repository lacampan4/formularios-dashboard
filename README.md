# Operaciones La Campana

Registro digital de la Orden de Trabajo (FO-OPE-001), la Orden de Suministro (FO-OPE-002), el ATS (FR-SST-011) y el Permiso de Trabajo de Alto Riesgo (FR-SST-039), más un dashboard. HTML, CSS y JavaScript puro con Supabase y Chart.js. No necesita compilación.

## Puesta en marcha

1. **Supabase → SQL Editor:** ejecute en orden `sql/1_esquema.sql`, `sql/2_semillas.sql`, `sql/3_roles.sql`, `sql/4_lista_roles.sql`, `sql/5_bandeja.sql`, `sql/6_consecutivos.sql`, `sql/7_os_fotos.sql`, `sql/8_ot_requisitos.sql`, `sql/9_guia_octubre.sql`, `sql/10_permisos_funciones.sql`, `sql/11_os_costos.sql`, `sql/12_os_firmas_items.sql`, `sql/13_os_total_sin_fotos.sql`, `sql/14_os_correcciones.sql`, `sql/15_os_proveedor.sql`, `sql/16_usuarios_frentes.sql`, `sql/17_cierre_roles_maquinas.sql`, `sql/18_ats_estado.sql`, `sql/19_permiso_sst.sql`, `sql/20_sst_consulta.sql`, `sql/21_ats_vigencia.sql`, `sql/22_os_responsable.sql`, `sql/23_os_entrega_parcial.sql`, `sql/24_maquinas_galones.sql`, `sql/25_os_entregas_parciales.sql`, `sql/26_os_editar_entrega.sql` y `sql/27_os_en_proceso.sql`. Si vuelve a ejecutar uno, ejecute también todos los que siguen, porque cada uno ajusta reglas del anterior.
2. **Supabase → Authentication → Sign In / Providers:** desactive **"Allow new users to sign up"**. Si queda activo, cualquiera podría crearse una cuenta.
   Después de crear el primer admin (abajo), los demás usuarios se crean desde la app en **Usuarios** (ver "Crear usuarios desde la app").
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
| `sst` | Todos (OT, OS, ATS y Permiso). En **Consulta** ve todos los ATS y permisos de alto riesgo de la planta, para hacer seguimiento | No |
| `sin_rol` | Ninguno | No |

En **Table Editor → usuarios**, la columna `rol` es una lista desplegable con todos los roles. `admin` no aparece en `rol_formatos` porque no lo necesita: puede todo.

Qué formato llena cada rol está en la tabla `rol_formatos` (Table Editor) y se puede cambiar sin tocar el código. La base de datos aplica los roles, así que esconder un botón no es lo único que los protege: cada rol solo ve lo que necesita para llenar sus formatos, y solo `admin` ve los datos del dashboard.

## Crear usuarios desde la app

En **Usuarios** (solo admin) se crean las cuentas y se edita el nombre, el rol, el frente y de qué se encarga cada persona. Crear una cuenta exige la llave secreta de Supabase, que nunca puede ir en el navegador, así que la crea la Edge Function `crear-usuario`: revisa que quien la llama sea admin y crea el usuario ya confirmado. Se publica una sola vez:

1. **Supabase → Edge Functions → Deploy a new function → Via Editor.**
2. Nombre: `crear-usuario` (exactamente así).
3. Borre el código de ejemplo, pegue todo `supabase/functions/crear-usuario/index.ts` y dele **Deploy function**. Deje activo **Verify JWT**.

La llave secreta la pone Supabase sola dentro de la función; no hay que copiarla en ningún lado. Si cambia `DOMINIO_USUARIOS` en `config.js`, cámbielo también al inicio de esa función y vuelva a publicarla. Desde `sql/17` la función lee los roles de la base: si la publicó antes, vuelva a publicarla con el código nuevo.

## Seguridad: nada de contraseñas en el código

- **Nunca** ponga en el código ni suba a GitHub contraseñas, la llave secreta (`sb_secret_…` o `service_role`) ni la contraseña de la base de datos. Si alguna se sube, rótela de inmediato en Supabase: borrarla del repositorio no basta, porque queda en el historial.
- En `config.js` solo va la URL y la llave **publishable** (`sb_publishable_…` o `anon`). Esa llave está hecha para ir en el navegador; lo que protege los datos son las reglas RLS de `sql/1_esquema.sql`. Si alguien pega la llave secreta, la app se niega a arrancar.
- Las contraseñas de los usuarios las guarda Supabase Auth, cifradas. La app nunca las almacena.

## Archivos

| Archivo | Qué hace |
|---|---|
| `registro.html` / `registro.js` | Los cuatro formatos en pestañas |
| `usuarios.html` / `usuarios.js` | Crear usuarios y editar su rol, frente y de qué se encarga (solo admin). Usa la Edge Function `supabase/functions/crear-usuario` |
| `bandeja.html` / `bandeja.js` | Bandeja de entrada: las OT y OS en las que el usuario es responsable y las OS que pidió. En **Abrir** (ventana flotante con `consulta.html?bandeja`) se firma cada ítem de la OS y se cierra |
| `consulta.html` / `consulta.js` | Lista de formatos guardados y detalle completo de cada uno, con impresión (admin; SST la usa solo para ATS y permisos). **Descargar Excel** (solo admin) baja las OT y las OS de la consulta en dos hojas: una fila por OT y una fila por ítem de OS, con costos y firmas. Enlace directo (por id interno): `consulta.html#OT/5`, `#OS/3`, `#ATS/2`, `#PT/4` |
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
- La OS llega a la bandeja del responsable. Cada ítem lo firma el responsable al entregarlo y quien pidió la OS al recibirlo, cada uno con su usuario; con las dos firmas queda chuleado. La OS se cierra sola, con la hora, cuando quien la pidió firma el recibido del último ítem; el responsable ya no tiene que cerrarla. Ya no lleva fotos (las que se subieron antes quedan guardadas en el bucket `fotos-os`).
- El **responsable** de la OS llena **costo unitario** y **proveedor** directamente en la tabla de ítems (al escribir aparece **Guardar**) y puede **Editar** los demás datos de los ítems (costos, proveedor, cantidad, etc.); queda en el historial de correcciones como "Ajuste del responsable". (`sql/22_os_responsable.sql`).
- **Firmar entrega** entrega todo lo que falta del ítem. **Entrega parcial** pide cuánto se entrega (ej. 10 de 20 L); lo que falta se entrega después, en una o varias entregas, y cada una la recibe quien pidió. Con una entrega parcial la OS queda **En proceso**; se cierra sola cuando todo está entregado y recibido (`sql/25_os_entregas_parciales.sql`). Estados: Abierta (verde), En proceso (naranja), Cerrada (rojo). El responsable también la pasa a En proceso con **Poner en proceso** (`sql/27_os_en_proceso.sql`). Si digitó mal una cantidad, el responsable la corrige con **Editar cantidad** mientras no la hayan recibido; queda la cantidad anterior (`sql/26_os_editar_entrega.sql`).
- El ATS queda **Abierto** al guardarlo y se cierra solo, a la misma hora, cuando se cierra la OT a la que está enlazado (`sql/18_ats_estado.sql`). Si la OT ya estaba cerrada, el ATS se guarda cerrado. Las firmas del formato no cambian.
- El costo total de cada ítem es cantidad × costo unitario: lo calcula la base de datos al guardar. Cada ítem puede llevar su proveedor (opcional).
- Si un ítem quedó **mal diligenciado** o fue **mal entregado**, quien pidió la OS lo corrige desde el detalle (botón "Corregir"), aunque la OS esté cerrada: escribe qué estaba mal y cuál fue el cambio. El ítem queda con los datos nuevos y los anteriores en el historial "Correcciones", con quién y cuándo; no se edita ni se borra.
- Cada formato (OT, OS, ATS, Permiso) recibe al guardar un número consecutivo propio, sin saltos, con el formato de la guía: OT-0001, OS-0001, ATS-0001, PT-0001.
- La OT muestra solo los códigos de falla generales y los de la línea de la máquina elegida (CTL, Slitter, Cubiertas, Perlin en C, Entrepiso). La línea de cada máquina está en `LINEA_DE_MAQUINA` de `config.js`.
- En **Usuarios**, Rol, Frente y "Se encarga de" traen "+ Agregar…". Un rol nuevo se crea con los formatos que puede llenar (OT, OS, ATS, Permiso) y queda en `rol_formatos`.
- Las máquinas de la OT están en la tabla `maquinas`. El admin agrega una nueva con "+ Nueva máquina" (y su línea, para el filtro de códigos) y queda en la lista para todos. Al elegir una máquina de la lista, el admin ve **Editar máquina** para corregir su nombre o su línea (`sql/24_maquinas_galones.sql`); las órdenes ya guardadas conservan el nombre anterior.
- Los ítems de la OS se piden en und, kg, m, L o **gal** (galones).
- El Permiso de Trabajo sigue el FR-SST-039 completo (borrador de SST del 22/07/2024): datos básicos, descripción, EPP, generalidades, medidas preventivas específicas del tipo de tarea (alturas, caliente, eléctrico/energías, izaje), listas de verificación de trabajo en caliente por equipo (sierra sable, taladro, soldadura, pulidora, oxicorte), verificación diaria, anexos, firmas y cierre. Las preguntas están en `config.js` (`PERMISO_*`) y las respuestas se guardan en `detalle_extra`.
- El **ATS** tiene fecha y hora de apertura y una vigencia "válido hasta" que no puede pasar de 24 horas (`sql/21_ats_vigencia.sql`). El permiso también tiene "válido hasta" (después del inicio), pero sin máximo. Las listas de verificación de trabajo en caliente se diligencian una vez, al emitir el permiso.
- Nadie puede borrar órdenes.
- Sin sesión no se ve ni se registra nada.

## Prueba del esquema

`sql/prueba_esquema.mjs` corre las reglas contra un Postgres embebido, sin tocar Supabase:

```
npm i @electric-sql/pglite@0.2.17
node sql/prueba_esquema.mjs sql
```
