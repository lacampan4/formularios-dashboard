# Operaciones La Campana

Registro digital de la Orden de Trabajo (FO-OPE-001), la Orden de Suministro (FO-OPE-002), el ATS (FR-SST-011) y el Permiso de Trabajo de Alto Riesgo (FR-SST-039), más un dashboard. HTML, CSS y JavaScript puro con Supabase y Chart.js. No necesita compilación.

## Puesta en marcha

1. **Supabase → SQL Editor:** ejecute `sql/1_esquema.sql` y después `sql/2_semillas.sql`.
2. **Supabase → Authentication → Users:** cree (o invite) a cada usuario con su correo. La app no tiene registro abierto.
3. **`config.js`:** ponga `SUPABASE_URL` y `SUPABASE_ANON_KEY` (Project Settings → API).
4. Publique la carpeta en cualquier hosting estático (GitHub Pages, Netlify…) y abra `registro.html`.

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
- Nadie puede borrar órdenes. Después de creadas solo se pueden completar las firmas.
- Sin sesión no se ve ni se registra nada.

## Prueba del esquema

`sql/prueba_esquema.mjs` corre las reglas contra un Postgres embebido, sin tocar Supabase:

```
npm i @electric-sql/pglite@0.2.17
node sql/prueba_esquema.mjs sql
```
