# La Campana · App de Operaciones — Análisis y arquitectura (Fase 1)

Fuente: *Guía de formatos de operaciones – La Campana* (13 páginas, 27-oct-2026, @Ivan). Se leyó el texto completo y se renderizaron las páginas 6–10 (imágenes de los formatos) para sacar los campos que no están en el texto.

---

## 1. Contexto organizacional (catálogos)

Cuatro frentes bajo la Dirección de Operaciones (Ivan Ibáñez):

| Frente | Líder | Se encarga de |
|---|---|---|
| Producción | Cesar Riveros | Tuberías |
| Producción | Juan Carlos Sánchez | Formadoras |
| Producción | Sebastián Hernández | Corte |
| Producción | Andres Sanchez | Corte de vigas y corte de planchas |
| Producción | Wilson García | Mecanizados |
| Producción | Raúl Salazar | Mecánica de máquinas pequeñas |
| Mantenimiento | Fredy Verdugo | Mecánica de CTL's y slitters |
| Mantenimiento | Jhon Lozano | Mecánica de formadoras y tuberías |
| Mantenimiento | Ricardo Arcila | Parte eléctrica de todas las máquinas y varios |
| Abastecimiento | Andrés Moreno | Compras especializadas o importadas |
| Abastecimiento | Sofía Arévalo | Compras de insumos nacionales |
| SST | Lina Hernández | Seguridad y salud en el trabajo |

Esto alimenta: "Área solicitante" (OS), "Autorizado / Entregado / Recibido por", filtros del dashboard por frente/línea.

---

## 2. Los cuatro formatos y sus campos

### 2.1 Orden de Trabajo — FO-OPE-001 (Versión 01)

| Campo | Tipo | Regla |
|---|---|---|
| No. orden | consecutivo `OT-0001` | Lo asigna el sistema |
| Máquina | texto/catálogo | **Obligatorio** (regla de oro 2) |
| Fecha y hora | timestamp | Momento real de emisión (regla 3) → `now()` del servidor |
| Prioridad | Rojo / Amarillo / Verde | Obligatorio, una sola |
| Código + Reporte de falla | **tabla de líneas** (el papel tiene ~20 filas) | Código del catálogo (sección 5); si es 83 "Otros", el reporte es obligatorio |
| Autorizado por | nombre | Firma 1 |
| Entregado por | nombre | Firma 2 |
| Recibido por | nombre | Firma 3 (recibe "a conformidad") |

### 2.2 Orden de Suministro — FO-OPE-002 (Versión 01)

Encabezado: No. orden (`OS-0001`), Área solicitante, Fecha, Hora, Prioridad.
**Tabla de ítems** (≈11 filas en papel), por ítem:

| Campo | Regla |
|---|---|
| Máquina | **Obligatorio por ítem** |
| Referencia, Marca, Código | Identifican el repuesto exacto |
| Cantidad | número > 0 |
| Medida | und, kg, m, L |
| Descripción | Qué es el ítem |
| Función | Para qué se usa |

Pie: Autorizado por, Entregado por (almacén/compras), Recibido por.
**Vínculo OT→OS:** "cuando una OT necesita repuestos se llena una OS y en Descripción o Función se anota el número de la OT". Propuesta: campo opcional `OT relacionada` (selector) en vez de texto libre, para poder cruzarlo en el dashboard.

### 2.3 Análisis de Trabajo Seguro — FR-SST-011 (Versión 1, 25/05/2022)

- Encabezado: Sede, Área de ubicación del trabajo, Jefe inmediato, Responsables del trabajo.
- Permisos adicionales (checkbox): Trabajo en alturas · Trabajo en caliente · Energías peligrosas.
- **Datos de identificación** (hasta 5 trabajadores): Nombre, Cargo, y Sí/No para: Óptimo estado de salud · Consumo de medicamentos que causan sueño · Afiliación vigente al Sistema General de Seguridad Social · Certificado para la actividad; Firma (certifica que participó).
- Descripción de la labor (texto). Equipos, herramientas, materiales y/o sustancias químicas (texto).
- **Paso a paso** (tabla, ~6 filas): Paso · Peligros/riesgos del entorno · Consecuencias · Medidas de control.
- Fechas (diaria/semanal): Apertura y Cierre.
- Firmas responsables: Trabajador encargado · Jefe inmediato · Coordinador de trabajo en alturas (si aplica) · SST.
- Nota: si cambian las condiciones (lluvia, viento, tormenta eléctrica, emergencia) el permiso queda suspendido.

### 2.4 Permiso de Trabajo Tareas de Alto Riesgo – Área de Mantenimiento — FR-SST-039 (Versión 1, 22/07/2024)

Solo la **primera de 8 páginas** viene en la guía:

1. **Datos básicos:** Área/proceso, Ubicación de la labor, Sede, Fecha de ejecución, Hora inicio estimada, Hora finalización estimada, Vigencia del permiso, Trabajador encargado, Ayudante de seguridad.
2. **Descripción:** Tarea a realizar, Descripción de la tarea, Método de trabajo eléctrico (Energizado / Desenergizado), Nivel de tensión, Herramientas y/o equipos.
3. **EPP (Sí/No):** Eslinga de posicionamiento en Y · Sistema de anclaje ganchos/mosquetones · Arnés de cuerpo entero · Lentes/monogafas · Protección auditiva · Mascarilla respiratoria · Línea de vida horizontal · Casco con barbuquejo · Guante dieléctrico · Visor arco dieléctrico · Ropa/dotación sin partes metálicas · Botas dieléctricas.

Por el texto de la guía sabemos que además existen: generalidades, **sección 5** específica por tipo (alturas / caliente / aislamiento y control de energías – bloqueo y etiquetado / riesgo eléctrico), documentos anexos (afiliación seguridad social, aptitud médica), lista de verificación de equipo para trabajo en caliente (soldadura, pulidora, oxicorte, sierra sable, taladro), firmas de emisión (ejecutor, emisor, SST), verificación y control diario, y cierre Sí/No (trabajador + jefe SST). **Los campos exactos de las páginas 2–8 no están en el PDF** → ver Pregunta 1.

---

## 3. Prioridades

| Color | Significa | Ejemplo |
|---|---|---|
| Rojo – Urgente | Máquina parada, riesgo para personas o un pedido se cae hoy | Se reventó una manguera en la formadora |
| Amarillo – Programable | Hay que hacerlo pero no detiene la operación; se agenda | Cambiar un sensor que falla de vez en cuando |
| Verde – Preventivo | Está en el plan de mantenimiento | Cambio de aceite programado |

## 4. Reglas de negocio → cómo las aplica la app

| # | Regla | Implementación |
|---|---|---|
| 1 | Si no está escrito, no pasó | Toda OT/OS queda en Supabase; no hay borrado desde la app |
| 2 | Siempre la máquina | `maquina NOT NULL` en OT y en cada ítem de OS |
| 3 | Fecha y hora reales | `creado_en default now()`, no editable por el usuario |
| 4 | Rojo solo emergencias | KPI "% en Rojo" en el dashboard con alerta si > 30 % |
| 5 | Emergencia de palabra, orden en el mismo turno | Campo opcional "hora real del evento" vs. hora de registro; el dashboard marca las que se registraron tarde |
| 6 | Sin ATS + Permiso no se empieza alto riesgo | OT con "tarea de alto riesgo" marcada no puede pasar a *En ejecución* sin ATS y Permiso vinculados con firmas |
| 7 | Entrega entre turnos | Proceso operativo; fuera de alcance de la app (se puede anotar en la OS) |
| 8 | Tres firmas para cerrar | `estado = 'Cerrada'` solo si Autorizado, Entregado y Recibido están llenos (lo calcula la BD) |
| 9 | Riesgo para personas → avisar a SST | Casilla "riesgo para personas" en la OT; si se marca, la orden aparece destacada para SST. (Notificación por correo = fase posterior, ver Pregunta 4) |
| 10 | Entrega semanal a Dirección | Vista "Órdenes cerradas de la semana" en el dashboard |
| — | Paso a paso alto riesgo (7 pasos) | OT → ATS → Permiso → lista de verificación → firmas de emisión → control diario → cierre |

## 5. Códigos de falla (anexo)

87 códigos del **01 al 88; el 77 no existe en la guía**. "83 – Otros" obliga a explicar en Reporte de falla. Se cargan como tabla semilla `codigos_falla` (código, descripción) para el selector y para agrupar en el dashboard. Erratas a confirmar en el PDF: "Desgaste cuñas de la s brias de la cortadora" (60).

---

## 6. Propuesta de arquitectura

Sitio estático (HTML + CSS + JS puro), sin build, mismo patrón que `mesa-ayuda-campana`. Supabase JS v2 y Chart.js 4 por CDN con versión fija.

```
operaciones-campana/
├── registro.html        # pestañas OT · OS · ATS · Permiso
├── dashboard.html       # KPIs, filtros, gráficas, tabla
├── styles.css           # tokens de DESIGN.md
├── config.js            # URL + publishable key de Supabase, catálogos (frentes, líderes, medidas)
├── registro.js
├── dashboard.js
├── img/logo.png         # reutilizado de mesa-ayuda
└── sql/
    ├── 1_esquema.sql    # tablas, checks, triggers, RLS
    └── 2_semillas.sql   # codigos_falla, frentes
```

### 6.1 Modelo de datos (Supabase / Postgres)

```
ordenes_trabajo   id, numero (OT-0001 generado), creado_en, maquina*, prioridad*,
                  alto_riesgo bool, riesgo_personas bool, autorizado_por,
                  entregado_por, recibido_por, estado (calculado), creado_por
ot_lineas         id, ot_id → ordenes_trabajo, codigo_falla → codigos_falla, reporte*
ordenes_suministro id, numero (OS-0001), creado_en, area_solicitante*, prioridad*,
                  ot_id (opcional) → ordenes_trabajo, autorizado/entregado/recibido_por, estado
os_items          id, os_id, maquina*, referencia, marca, codigo, cantidad>0,
                  medida in (und,kg,m,L), descripcion*, funcion
ats               id, ot_id → ordenes_trabajo, sede, area, jefe_inmediato, responsables,
                  alturas/caliente/energias bool, descripcion_labor, equipos,
                  fecha_apertura, fecha_cierre, firmas (4 nombres)
ats_trabajadores  id, ats_id, nombre, cargo, salud_ok, medicamentos_sueno,
                  afiliacion_ss, certificado, firma
ats_pasos         id, ats_id, paso, peligros, consecuencias, controles
permisos_trabajo  id, ot_id, ats_id, datos básicos (sección 1), descripción (2),
                  metodo_electrico, nivel_tension, epp jsonb {elemento: si/no},
                  secciones_extra jsonb (págs. 2–8, hasta tener el formato), cierre
codigos_falla     codigo pk, descripcion
```

- Consecutivo: `id` identity + columna generada `numero = 'OT-' || lpad(id::text, 4, '0')` (sin carreras entre usuarios).
- Validación en la BD (checks/NOT NULL), no solo en el navegador: la llave pública es visible.
- `estado` calculado por trigger: *Abierta* → *Cerrada* cuando las tres firmas están.
- Guardado de orden + líneas en una sola llamada (función RPC `crear_ot(...)`/`crear_os(...)`) para que no quede una orden sin líneas si falla la red.
- Dashboard lee de vistas SQL (`v_kpis`, `v_ot_por_codigo`, `v_ordenes_semana`) para que el JS solo pinte.

### 6.2 Seguridad (RLS)

Recomendado, igual que mesa-ayuda: **Supabase Auth** con correo; `registro` exige sesión, `dashboard` solo para rol admin/dirección. Sin login, cualquiera con el enlace leería todas las órdenes y nombres del personal. → Pregunta 3.

### 6.3 Dashboard (Chart.js)

- KPIs: OT abiertas · OS abiertas · % en Rojo · Órdenes sin las 3 firmas.
- Gráficas: OT por prioridad (dona) · Top 10 códigos de falla (barras horizontales) · OT por máquina · OS por área solicitante · Órdenes por día/semana (línea) · Tiempo emisión→cierre promedio por prioridad.
- Tabla: órdenes recientes con filtros (fecha, formato, prioridad, frente, estado) y vista "cerradas esta semana" para la entrega a Dirección.

### 6.4 Fuera de alcance (fase 1)

Firma manuscrita/digital (se registra el nombre), impresión en PDF de las órdenes, notificaciones por correo/WhatsApp, edición/borrado de órdenes, modo sin conexión.

---

## 7. Preguntas que necesito resueltas antes de implementar

1. **Permiso FR-SST-039:** la guía solo trae la página 1 de 8. ¿Me pasas el PDF completo? Mientras tanto propongo implementar secciones 1–3 + cierre, y guardar el resto en `jsonb`.
2. **Máquinas:** el PDF no tiene lista de máquinas. ¿Hay catálogo (nombre/código) o lo dejamos como texto libre?
3. **Acceso:** ¿login con Supabase Auth (recomendado) o formulario abierto? ¿Quién ve el dashboard?
4. **Alcance de formatos:** ¿las 4 en la primera entrega, o primero OT + OS (núcleo diario) y luego ATS + Permiso?
5. **Proyecto Supabase:** ¿uno nuevo o el mismo de mesa-ayuda (`eawsujtnbouigdrnvzmd`)?
6. **Firmas:** ¿basta con el nombre de quien autoriza/entrega/recibe, o deben ser usuarios con sesión que "firman" desde su cuenta?
