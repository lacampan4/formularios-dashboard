---
version: 1.0
name: la-campana-operaciones
description: Sistema visual de la app de Operaciones de La Campana Servicios de Acero S.A. (registro.html + dashboard.html). Base estructural tomada del estilo "supabase" de awesome-design-md (lienzo blanco, tinta casi negra, un solo color de acción), con el verde sustituido por el rojo corporativo de La Campana. Rojo, blanco y gris; el rojo es el único color de marca.

colors:
  # Marca (mismos valores que styles.css de mesa-ayuda-campana)
  rojo: "#e2231a"          # primario: barra superior, botón principal, línea de sección
  rojo-osc: "#b81a13"      # hover / pressed del primario
  rojo-claro: "#fdecea"    # fondos suaves de error o selección
  blanco: "#ffffff"        # lienzo de tarjetas y formularios
  # Grises
  negro: "#1d1d1d"         # texto principal
  gris-900: "#2a2a2a"      # superficies oscuras (pie, tooltips)
  gris-600: "#6b6b6b"      # texto secundario, etiquetas
  gris-400: "#9a9a9a"      # placeholder, ejes de gráficas
  gris-200: "#e2e2e2"      # bordes, divisores
  gris-100: "#f2f2f2"      # fondo de página
  gris-50: "#f7f7f7"       # encabezado de tablas (como en los formatos impresos)
  # Semáforo de prioridad (definido por la guía, NO es decoración)
  prio-rojo: "#e2231a"
  prio-amarillo: "#ffc600"
  prio-verde: "#00a651"
  # Estados de sistema
  ok: "#1e8e4a"
  aviso: "#b37f00"
  error: "#b81a13"

typography:
  family: "'Poppins', Arial, sans-serif"   # Google Fonts, pesos 400/500/600/700
  mono: "ui-monospace, Consolas, monospace" # consecutivos OT-0001, códigos de falla
  display:   { size: 28px, weight: 700, lineHeight: 1.15, letterSpacing: -0.4px }  # título de página
  h2:        { size: 20px, weight: 600, lineHeight: 1.25 }                         # título de sección/tarjeta
  h3:        { size: 15px, weight: 600, lineHeight: 1.3, transform: uppercase, letterSpacing: 0.4px } # "1. DATOS BÁSICOS"
  body:      { size: 15px, weight: 400, lineHeight: 1.5 }
  label:     { size: 12px, weight: 600, lineHeight: 1.3, transform: uppercase, letterSpacing: 0.5px, color: gris-600 }
  caption:   { size: 13px, weight: 400, lineHeight: 1.45, color: gris-600 }
  kpi:       { size: 34px, weight: 700, lineHeight: 1.0, numeric: tabular-nums }
  button:    { size: 15px, weight: 600, lineHeight: 1.0 }

rounded:
  sm: 6px      # botones, inputs
  md: 10px     # chips de prioridad, selects
  lg: 14px     # tarjetas (igual que --radio de mesa-ayuda)
  full: 9999px

spacing: { xxs: 4px, xs: 8px, sm: 12px, md: 16px, lg: 24px, xl: 32px, xxl: 48px }

elevation:
  card: "0 4px 18px rgba(0,0,0,.08)"
  topbar: "0 2px 8px rgba(0,0,0,.20)"
  none: "none"

breakpoints: { movil: "<600px", tablet: "600–1023px", escritorio: ">=1024px" }
---

# La Campana · Operaciones — DESIGN.md

Usa este archivo como fuente de verdad para toda decisión visual de `registro.html` y `dashboard.html`. Si algo no está aquí, prefiere la consistencia con lo que ya existe antes que inventar un estilo nuevo.

## 1. Carácter

Industrial, sobrio, legible en planta. La app es la versión digital de los formatos impresos FO-OPE-001/002 y FR-SST-011/039, así que **se parece a ellos**: encabezado rojo con el logo, línea roja bajo cada sección, etiquetas en mayúscula gris, tablas de líneas finas. Blanco y gris dominan; el rojo aparece poco y siempre con intención.

Regla 60-30-10: 60 % blanco/gris-100 (lienzo), 30 % grises de texto y bordes, 10 % rojo (barra superior, botón principal, líneas de sección, foco).

## 2. Color

| Token | Uso | Nunca |
|---|---|---|
| `rojo` | Barra superior, botón primario, borde inferior de títulos de sección, anillo de foco | Fondos grandes dentro de la página, texto largo |
| `rojo-osc` | Hover/pressed del primario, texto de error | — |
| `blanco` | Tarjetas, inputs, texto sobre rojo | — |
| `gris-100` | Fondo de página | Tarjetas |
| `gris-50` | Cabecera de tablas (como los formatos) | — |
| `gris-200` | Bordes de input, divisores, líneas de tabla | — |
| `gris-600` | Etiquetas, texto secundario | Texto sobre gris-100 menor de 13px |
| `negro` | Texto principal | — |

**Semáforo de prioridad.** Rojo/Amarillo/Verde los define la guía; se usan **solo** para prioridad (chips, selector, series de gráficas de prioridad). Como el rojo de prioridad coincide con el de marca, la prioridad **siempre** lleva texto ("Rojo · Urgente"), nunca color solo.

| Prioridad | Fondo | Texto | Etiqueta |
|---|---|---|---|
| Rojo | `prio-rojo` | blanco | Rojo · Urgente |
| Amarillo | `prio-amarillo` | `negro` | Amarillo · Programable |
| Verde | `prio-verde` | blanco | Verde · Preventivo |

Contraste verificado (AA): `rojo` sobre blanco 4.7:1, blanco sobre `rojo` 4.7:1, `negro` sobre `prio-amarillo` 10.8:1, `gris-600` sobre blanco 5.3:1. Blanco sobre `prio-verde` (#00a651) es 3.2:1 → usar solo en texto ≥ 14px bold (chips), nunca en párrafos.

## 3. Tipografía

Poppins (la misma de mesa-ayuda-campana). Los números de KPI y consecutivos usan `font-variant-numeric: tabular-nums`; los consecutivos (`OT-0001`) y códigos de falla (`37`) van en `mono`.

Etiquetas de campo: estilo `label` (mayúscula, 12px, gris-600), arriba del input — calca los formatos impresos ("MÁQUINA", "FECHA", "HORA").

## 4. Layout

- Ancho máx. contenido: 1200px, margen lateral 16px en móvil.
- **registro.html**: una columna en móvil, grilla de 12 columnas en escritorio. Arriba, selector de formato en pestañas (OT · OS · ATS · Permiso). Cada formato = una tarjeta con secciones numeradas como el papel.
- **dashboard.html**: fila de 4 KPIs → fila de filtros (rango de fechas, formato, prioridad, frente) → grilla de gráficas 2×N (1 columna en móvil) → tabla de órdenes recientes.
- El formulario se usa en planta desde celular: botones y controles mínimo 44px de alto.

## 5. Componentes

**Barra superior** — fondo `rojo`, logo blanco a la izquierda (`img/logo.png` de mesa-ayuda), enlaces "Registro" / "Dashboard" en blanco 600; el activo con subrayado blanco de 2px. Sticky, sombra `topbar`.

**Encabezado de formato** — replica el papel: a la izquierda título del formato (h2) y debajo código y versión en `caption` ("FO-OPE-001 · Versión 01"); a la derecha caja gris-50 con "No. ORDEN" en `rojo` y el consecutivo en `mono` (lo asigna la base de datos; antes de guardar muestra "Se asigna al guardar").

**Título de sección** — h3 en mayúscula con `border-bottom: 2px solid rojo`, igual a "1. DATOS BÁSICOS DEL PERMISO".

**Input / select / textarea** — fondo blanco, borde 1px `gris-200`, radio `sm`, alto 44px, padding 10px 12px. Foco: borde `rojo` + `box-shadow: 0 0 0 3px rgba(226,35,26,.18)`. Error: borde `rojo-osc`, mensaje `caption` en `rojo-osc` debajo, `aria-invalid="true"`. Obligatorio: asterisco rojo tras la etiqueta.

**Selector de prioridad** — tres botones-radio grandes en fila con el color del semáforo; no seleccionado = borde del color y fondo blanco; seleccionado = fondo del color + ✓. Es un `<fieldset>` con radios reales (accesible por teclado).

**Tabla de líneas (OT códigos, OS ítems, ATS trabajadores/pasos)** — cabecera `gris-50` con borde inferior `rojo` 2px, filas con divisor `gris-200`. Botón "+ Agregar fila" secundario debajo; icono ✕ para quitar fila. En móvil cada fila se apila como mini-tarjeta.

**Sí/No (EPP, condiciones de salud)** — `<select>` obligatorio con opciones "Sí / No" y sin respuesta por defecto (el papel exige marcar); funciona igual en tabla y en celular.

**Botones**
- Primario: fondo `rojo`, texto blanco, radio `sm`, padding 12px 20px; hover `rojo-osc`; disabled opacidad .6.
- Secundario: fondo blanco, borde `gris-200`, texto `negro`; hover fondo `gris-100`.
- Peligro (quitar fila): texto `rojo-osc`, sin fondo.

**Tarjeta** — fondo blanco, radio `lg`, padding 24px (16px móvil), sombra `card`.

**KPI** — tarjeta con `label` arriba, número en `kpi`, variación en `caption`. El KPI "Órdenes en Rojo" muestra su % del total; si supera 30 % el número cambia a `rojo` (regla de oro 4: "si todo es urgente, nada es urgente").

**Chip de estado** — radio `full`, 12px 600: Abierta (gris-200/negro), En ejecución (amarillo suave #fff4cc / negro), Cerrada (#e3f4ea / `ok`).

**Toast** — abajo a la derecha, fondo `gris-900`, texto blanco, borde izquierdo 4px `ok` o `rojo`. Se anuncia con `role="status"`.

## 6. Gráficas (Chart.js)

- Fuente Poppins 12px, color `gris-600`; rejilla `gris-200`, sin bordes de eje.
- Una serie por gráfica, en `rojo`; el título la nombra (sin leyenda). Rojo + gris como dos series falla el validador de paleta (el gris "se lee como gris"): si se necesitan dos series, usar dos gráficas.
- Series de prioridad: siempre el semáforo, en el orden Rojo, Amarillo, Verde, con la etiqueta de texto en el eje; el amarillo lleva borde `#b37f00` (sobre blanco tiene contraste 1.5:1).
- Barras con radio 4px; donas con `cutout: '65%'` y total al centro.
- Leyenda abajo, puntos circulares. Tooltip fondo `gris-900`.
- Toda gráfica tiene título h2 y, debajo, un resumen en texto para lectores de pantalla.

## 7. Accesibilidad (no negociable)

Contraste AA, foco visible en todo control, `<label for>` en cada campo, grupos con `<fieldset><legend>`, objetivos táctiles ≥ 44px, mensajes de error asociados con `aria-describedby`, prioridad nunca solo por color.

## 8. Qué no hacer

- No usar degradados, sombras de color ni más rojos que los tres tokens.
- No usar el verde/amarillo fuera de prioridad o estados.
- No introducir otra fuente ni librería de UI (CSS propio, sin frameworks).
- No poner el rojo de fondo en secciones completas del formulario.
