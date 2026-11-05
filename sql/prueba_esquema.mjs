// Prueba del esquema en un Postgres embebido (sin tocar Supabase).
// Uso:  npm i @electric-sql/pglite@0.2.17   y luego   node prueba_esquema.mjs <carpeta sql>
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const dir = process.argv[2] || ".";
const db = new PGlite();
const U = "11111111-1111-1111-1111-111111111111";

// Lo mínimo de Supabase que usa el esquema: auth.users, auth.uid() y los roles.
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
  create role anon; create role authenticated;
  grant usage on schema public, auth to anon, authenticated;
  grant select on auth.users to authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  -- Supabase Storage: buckets, objetos (con RLS) y foldername()
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid default auth.uid());
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated;
  grant select, insert on storage.objects to authenticated;
  grant select on storage.buckets to authenticated;
`);
await db.exec(readFileSync(`${dir}/1_esquema.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/2_semillas.sql`, "utf8"));
// Crear usuarios en auth.users llena public.usuarios (como hace Supabase > Authentication > Add user)
const SIN_ROL = "22222222-2222-2222-2222-222222222222", PROD = "33333333-3333-3333-3333-333333333333";
await db.exec(`insert into auth.users values ('${U}', 'fredy.verdugo@usuarios.lacampana.co', '{"nombre": "Fredy Verdugo"}'),
  ('${SIN_ROL}', 'lina.h@usuarios.lacampana.co', '{}'), ('${PROD}', 'cesar.r@usuarios.lacampana.co', '{}');`);
await db.exec(readFileSync(`${dir}/3_roles.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/4_lista_roles.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/5_bandeja.sql`, "utf8"));
// Una OT guardada antes de los consecutivos conserva su número con el formato nuevo
await db.exec(`insert into ordenes_trabajo (maquina, prioridad, responsable) values ('Vieja', 'Rojo', '${U}')`);
assert.equal((await db.query("select numero from ordenes_trabajo")).rows[0].numero, "OT-0001");
await db.exec(readFileSync(`${dir}/6_consecutivos.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/7_os_fotos.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/8_ot_requisitos.sql`, "utf8"));
assert.equal((await db.query("select numero from ordenes_trabajo")).rows[0].numero, "00001");
await db.exec(readFileSync(`${dir}/9_guia_octubre.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/10_permisos_funciones.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/11_os_costos.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/12_os_firmas_items.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/13_os_total_sin_fotos.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/14_os_correcciones.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/15_os_proveedor.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/16_usuarios_frentes.sql`, "utf8"));
assert.equal((await db.query("select numero from ordenes_trabajo")).rows[0].numero, "OT-0001");  // formato de la guía
// Todos se pueden volver a ejecutar sin romper nada
await db.exec(readFileSync(`${dir}/3_roles.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/4_lista_roles.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/5_bandeja.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/6_consecutivos.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/7_os_fotos.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/8_ot_requisitos.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/9_guia_octubre.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/10_permisos_funciones.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/11_os_costos.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/12_os_firmas_items.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/13_os_total_sin_fotos.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/14_os_correcciones.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/15_os_proveedor.sql`, "utf8"));
// Nombres sin tildes también se llenan al volver a ejecutar 16 ("Sofia Arevalo" = "Sofía Arévalo" de la guía)
await db.exec(`update usuarios set nombre = 'Sofia Arevalo' where id = '${SIN_ROL}'`);
await db.exec(readFileSync(`${dir}/16_usuarios_frentes.sql`, "utf8"));
assert.equal((await db.query(`select frente from usuarios where id = '${SIN_ROL}'`)).rows[0].frente, "Abastecimiento");
await db.exec(`update usuarios set nombre = 'lina.h', frente = null, encargo = null where id = '${SIN_ROL}'`);  // como estaba
assert.equal((await db.query("select numero from ordenes_trabajo")).rows[0].numero, "OT-0001");  // volver a ejecutar 6 no lo cambia
assert.equal((await db.query("select udt_name from information_schema.columns where table_name = 'usuarios' and column_name = 'rol'")).rows[0].udt_name, "rol_usuario");
await assert.rejects(db.query("update usuarios set rol = 'jefe'"), /invalid input value for enum/);
// El rol lo asigna el administrador en Table Editor > usuarios
await db.exec(`update usuarios set rol = 'admin' where id = '${U}'; update usuarios set rol = 'produccion' where id = '${PROD}';`);

const comoUsuario = (uid = U) => db.exec(`reset role; set app.uid = '${uid}'; set role authenticated;`);
const val = async (sql, p) => Object.values((await db.query(sql, p)).rows[0] ?? {})[0];
const falla = async (sql, p, texto) => {
  await db.exec("savepoint s");
  try { await db.query(sql, p); } catch (e) { await db.exec("rollback to savepoint s"); if (texto) assert.match(e.message, texto); return; }
  throw new Error("Debía fallar: " + sql);
};

await db.exec("begin");
assert.equal(await val("select count(*)::int from codigos_falla"), 116);                                   // 1–117 sin el 77 (guía de octubre)
assert.equal(await val("select lineas::text from codigos_falla where codigo = 117"), "{Entrepiso}");
assert.equal(await val("select lineas from codigos_falla where codigo = 5"), null);              // general
assert.equal(await val("select count(*)::int from codigos_falla where codigo = 77"), 0);

assert.equal(await val("select nombre from usuarios where usuario = 'lina.h'"), "lina.h");   // sin nombre: usa el usuario
assert.equal(await val("select rol from usuarios where usuario = 'lina.h'"), "sin_rol");    // usuario nuevo: sin rol

await comoUsuario();
assert.equal(await val(`select nombre from usuarios where id = '${U}'`), "Fredy Verdugo");
assert.equal(await val("select count(*)::int from usuarios"), 3);                           // admin ve todos los perfiles
await falla("insert into usuarios values (gen_random_uuid(), 'x', 'x')", [], /permission denied/);
// Las funciones de trigger no se llaman directo (10_permisos_funciones.sql); los triggers igual se disparan más abajo
await falla("select asignar_numero()", [], /permission denied/);
await falla("select validar_alto_riesgo()", [], /permission denied/);
await falla("update usuarios set nombre = 'otro'", [], /permission denied/);
// Frente y encargo (16_usuarios_frentes.sql): quien se llama como en la guía queda lleno; el admin edita a los demás
assert.equal(await val(`select frente || ' · ' || encargo from usuarios_activos() where id = '${U}'`), "Mantenimiento · Mecánica de CTL's y slitters");
await db.query("select actualizar_usuario($1, 'Cesar Riveros', 'produccion', 'Producción', ' Tuberías ')", [PROD]);
assert.equal(await val(`select nombre || ' · ' || frente || ' · ' || encargo from usuarios where id = '${PROD}'`), "Cesar Riveros · Producción · Tuberías");
await falla("select actualizar_usuario($1, 'Fredy Verdugo', 'produccion', 'Mantenimiento', '')", [U], /su propio rol/);
await falla("select actualizar_usuario($1, 'Cesar Riveros', 'produccion', 'Bodega', '')", [PROD], /check/);
await falla("select actualizar_usuario($1, ' ', 'produccion', 'Producción', '')", [PROD], /nombre completo/);

const ot = (orden, lineas) => val("select crear_ot($1, $2)", [{ responsable: U, ...orden }, lineas]);
const linea = [{ codigo_falla: 5, reporte: "Se reventó una manguera" }];

assert.equal(await ot({ maquina: "Formadora 1", prioridad: "Rojo" }, linea), "OT-0002");
assert.equal(await val("select estado from ordenes_trabajo where id = 2"), "Abierta");
assert.equal(await val("select creado_por::text from ordenes_trabajo where id = 2"), U);
await falla("select crear_ot($1, $2)", [{ maquina: "F1", prioridad: "Rojo", responsable: U }, []], /al menos un código/);
await falla("select crear_ot($1, $2)", [{ maquina: " ", prioridad: "Rojo", responsable: U }, linea]);                       // regla 2
await falla("select crear_ot($1, $2)", [{ maquina: "F1", prioridad: "Rojo" }, linea], /ot_con_responsable/);
await falla("select crear_ot($1, $2)", [{ maquina: "F1", prioridad: "Rojo", responsable: U }, [{ codigo_falla: 77, reporte: "x" }]]);
await falla("select crear_ot($1, $2)", [{ maquina: "F1", prioridad: "Rojo", responsable: U }, [{ codigo_falla: 83, reporte: "" }]]);
await falla("select crear_ot($1, $2)", [{ maquina: "F1", prioridad: "Rojo", responsable: U }, [{ codigo_falla: 83, reporte: "x".repeat(501) }]], /reporte_500/);
assert.equal(await ot({ maquina: "F1", prioridad: "Rojo" }, [{ codigo_falla: 83, reporte: "x".repeat(500) }]), "OT-0003");  // los intentos rechazados no gastan número

// Códigos nuevos: siguiente número libre; la misma descripción no se repite
const maxCodigo = await val("select max(codigo) from codigos_falla");
assert.equal(await val("select agregar_codigo($1)", ["  Falla de encoder "]), maxCodigo + 1);
assert.equal(await val("select agregar_codigo($1)", ["FALLA DE ENCODER"]), maxCodigo + 1);
await falla("select agregar_codigo($1)", [" "], /entre 1 y 100/);

// La OT la cierra solo su responsable; nadie la edita ni la borra
await falla("update ordenes_trabajo set autorizado_por = 'Ivan' where id = 2", [], /permission denied/);
await falla("update ordenes_trabajo set estado = 'Cerrada' where id = 2", [], /permission denied/);
await falla("delete from ordenes_trabajo where id = 2", [], /permission denied/);
await db.query("select cerrar_ot(2)");
assert.equal(await val("select estado from ordenes_trabajo where id = 2"), "Cerrada");
assert.ok(await val("select cerrada_en from ordenes_trabajo where id = 2"));
await falla("select cerrar_ot(2)", [], /debe estar abierta/);

// ATS y Permiso
const n2 = await ot({ maquina: "Slitter", prioridad: "Amarillo" }, linea);
assert.equal(n2, "OT-0004");
const idDe = (n) => val("select id from ordenes_trabajo where numero = $1", [n]);
const id2 = await idDe(n2);
const ats = { ot_id: id2, descripcion_labor: "Cambio de motor en altura", alturas: true, firma_encargado: "Fredy", firma_jefe: "Ivan" };
const trab = [{ nombre: "Fredy", salud_ok: true, medicamentos_sueno: false, afiliacion_ss: true, certificado: true }];
const pasos = [{ paso: "Montar andamio", controles: "Arnés y línea de vida" }];
await falla("select crear_ats($1, $2, $3)", [ats, trab, pasos], /check/);                                  // alturas sin coordinador
const atsId = await val("select crear_ats($1, $2, $3)", [{ ...ats, firma_coord_alturas: "Lina" }, trab, pasos]);
assert.equal(await val("select numero from ats where id = $1", [atsId]), "ATS-0001");   // cada formato cuenta aparte
const permiso = `insert into permisos_trabajo (ot_id, ats_id, area_proceso, fecha_ejecucion, trabajador_encargado, tarea, tipos, metodo_electrico, firma_ejecutor, firma_emisor) values (${id2}, $1, 'Mantenimiento', current_date, 'Fredy', 'Cambio motor', $2, $3, 'Fredy', 'Ivan')`;
await falla(permiso, [atsId, ["alturas", "electrico"], null], /check/);                                    // eléctrico sin método
await falla(permiso, [atsId, ["otro"], null], /check/);
await db.query(permiso, [atsId, ["alturas", "electrico"], "Desenergizado"]);
assert.equal(await val("select numero from permisos_trabajo"), "PT-0001");

// OS
const os = (orden, items) => val("select crear_os($1, $2)", [{ responsable: U, ...orden }, items]);
const item = { maquina: "Formadora 1", cantidad: 2, medida: "m", descripcion: "Manguera hidráulica" };
await falla("select crear_os($1, $2)", [{ area_solicitante: "Formadoras", prioridad: "Rojo", responsable: U }, [{ ...item, medida: "cm" }]]);
await falla("select crear_os($1, $2)", [{ area_solicitante: "Formadoras", prioridad: "Rojo", responsable: U }, [{ ...item, cantidad: 0 }]]);
await falla("select crear_os($1, $2)", [{ area_solicitante: "Formadoras", prioridad: "Rojo", responsable: U }, [{ ...item, maquina: "" }]]);
await falla("select crear_os($1, $2)", [{ area_solicitante: "Formadoras", prioridad: "Rojo" }, [item]], /os_con_responsable/);
const n4 = await os({ area_solicitante: "Formadoras", prioridad: "Rojo", ot_id: 2 }, [item]);
assert.equal(n4, "OS-0001");
const os1 = await val("select id from ordenes_suministro where numero = $1", [n4]);
assert.equal(await val("select estado from ordenes_suministro where id = $1", [os1]), "Abierta");

// La OS se cierra con sus ítems firmados, sin foto (13_os_total_sin_fotos.sql); nadie la edita; no se suben fotos a una OS cerrada
const foto = (id, archivo = "a.jpg") => db.query("insert into storage.objects (bucket_id, name) values ('fotos-os', $1)", [`${id}/${archivo}`]);
assert.equal(await val("select file_size_limit::int from storage.buckets where id = 'fotos-os'"), 1048576);
await falla("update ordenes_suministro set autorizado_por = 'Ivan' where id = $1", [os1], /permission denied/);
const it1 = await val("select id from os_items where os_id = $1", [os1]);
await db.query("select firmar_item($1, 'entrega')", [it1]);   // aquí la misma persona pide y entrega: firma las dos
await db.query("select firmar_item($1, 'recibe')", [it1]);
await db.query("select cerrar_os($1)", [os1]);
assert.equal(await val("select estado from ordenes_suministro where id = $1", [os1]), "Cerrada");
assert.ok(await val("select cerrada_en from ordenes_suministro where id = $1", [os1]));
await falla("select cerrar_os($1)", [os1], /debe estar abierta/);
await db.exec("savepoint s");
await assert.rejects(foto(os1, "b.jpg"), /row-level security/);
await db.exec("rollback to savepoint s");

// Vistas del dashboard
assert.equal(await val("select count(*)::int from v_ordenes"), 5);
assert.equal(await val("select count(*)::int from v_fallas where codigo_falla = 5"), 2);

// Producción: llena OT y OS; no ATS ni Permiso; no ve el dashboard, no firma ni cambia su rol
await comoUsuario(PROD);
assert.match(await ot({ maquina: "Tubería 3", prioridad: "Verde" }, linea), /^OT-\d{4}$/);
assert.match(await os({ area_solicitante: "Tuberías", prioridad: "Verde" }, [item]), /^OS-\d{4}$/);
await falla("select crear_ats($1, $2, $3)", [{ ...ats, firma_coord_alturas: "Lina" }, trab, pasos], /row-level security/);
await falla(permiso, [null, ["alturas"], null], /row-level security/);
assert.equal(await val("select count(*)::int from v_ordenes"), 0);
assert.equal(await val("select count(*)::int from v_fallas"), 0);
assert.equal(await val("select count(*)::int from ordenes_suministro"), 1);                             // solo la suya
assert.equal(await val("select count(*)::int from ot_lineas"), 0);
assert.equal(await val("select count(*)::int from ats"), 0);
assert.equal(await val("select count(*)::int from usuarios"), 1);                                       // solo su perfil
await falla("update ordenes_trabajo set autorizado_por = 'yo' where id = 2", [], /permission denied/);
await falla("update usuarios set rol = 'admin'", [], /permission denied/);
// Producción no puede colgar líneas a una OT ajena ni cerrar una OT de la que no es responsable
await falla("insert into ot_lineas (ot_id, codigo_falla, reporte) values (2, 5, 'x')", [], /row-level security/);
await falla(`select cerrar_ot(${id2})`, [], /Solo el responsable/);
assert.equal(await val("select count(*)::int from usuarios_activos()"), 2);                            // nombres con rol, sin sin_rol
await falla("select actualizar_usuario($1, 'Yo', 'admin', 'Dirección', '')", [PROD], /Solo un administrador/);
await falla("select agregar_codigo('Sensor de producción')", [], /Solo la Dirección/);                  // solo admin agrega códigos

// Bandeja: el responsable ve los reportes de su OT y la cierra
await comoUsuario();
const n3 = await ot({ maquina: "Platina", prioridad: "Verde", responsable: PROD }, linea);
await comoUsuario(PROD);
assert.equal(await val("select count(*)::int from ordenes_trabajo where responsable = auth.uid()"), 1);
assert.equal(await val("select count(*)::int from ot_lineas"), 1);
// El responsable marca si requiere ATS / Permiso; no obliga a nada para cerrar
await falla(`select marcar_requisitos_ot(${id2}, true, true)`, [], /Solo el responsable/);
await db.query("select marcar_requisitos_ot($1, true, false)", [await idDe(n3)]);
assert.deepEqual((await db.query("select requiere_ats, requiere_permiso from ordenes_trabajo where responsable = auth.uid()")).rows[0],
  { requiere_ats: true, requiere_permiso: false });
await db.query("select cerrar_ot($1)", [await idDe(n3)]);
assert.equal(await val("select estado from ordenes_trabajo where responsable = auth.uid()"), "Cerrada");
await falla("select marcar_requisitos_ot($1, false, false)", [await idDe(n3)], /debe estar abierta/);

// Bandeja OS: el responsable ve la OS ajena y sus ítems, sube la foto y la cierra; otro no puede subirle fotos
await comoUsuario();
const os2 = await val("select id from ordenes_suministro where numero = $1", [await os({ area_solicitante: "Corte", prioridad: "Verde", responsable: PROD }, [item])]);
const os3 = await val("select id from ordenes_suministro where numero = $1", [await os({ area_solicitante: "Corte", prioridad: "Verde" }, [item])]);
await comoUsuario(PROD);
assert.equal(await val("select count(*)::int from os_items where os_id = $1", [os2]), 1);
await db.exec("savepoint s");
await assert.rejects(foto(os3), /row-level security/);
await db.exec("rollback to savepoint s");
await falla("select cerrar_os($1)", [os2], /dos firmas/);                                                // sin firmar los ítems no cierra
// Firmas por ítem (12_os_firmas_items.sql): entrega el responsable (PROD), recibe el solicitante (U)
const it2 = await val("select id from os_items where os_id = $1", [os2]);
await falla("select firmar_item($1, 'recibe')", [it2], /Solo quien pidió/);                                // el responsable no firma el recibido
await db.query("select firmar_item($1, 'entrega')", [it2]);
await falla("select firmar_item($1, 'entrega')", [it2], /ya está firmada/);
assert.equal(await val("select entregado_por::text from os_items where id = $1", [it2]), PROD);
await falla("update os_items set recibido_por = $1 where id = $2", [PROD, it2], /permission denied/);       // nadie firma por otro editando
await comoUsuario();
await falla("select firmar_item($1, 'entrega')", [it2], /Solo el responsable/);
assert.equal(await val("select entregado from os_items where id = $1", [it2]), false);                   // una sola firma: sin chulo
await db.query("select firmar_item($1, 'recibe')", [it2]);
assert.equal(await val("select entregado from os_items where id = $1", [it2]), true);                    // las dos firmas: chuleado
assert.ok(await val("select recibido_en from os_items where id = $1", [it2]));
await falla("select firmar_item($1, 'otro')", [it2], /no válida/);
// Recibir antes de que entreguen no se puede
const it3 = await val("select id from os_items where os_id = $1", [os3]);
await falla("select firmar_item($1, 'recibe')", [it3], /Primero el responsable/);
await comoUsuario(PROD);
await db.query("select cerrar_os($1)", [os2]);                                                          // sin foto
await falla("select firmar_item($1, 'entrega')", [it2], /ya está cerrada/);
assert.equal(await val("select estado from ordenes_suministro where id = $1", [os2]), "Cerrada");

// Costos de la OS: el total lo calcula la base al guardar (13), aunque llegue otro; opcionales y no negativos
await comoUsuario();
const os4 = await val("select id from ordenes_suministro where numero = $1", [await os({ area_solicitante: "Corte", prioridad: "Verde" },
  [{ ...item, cantidad: 2.5, costo_unitario: 1000, costo_total: 9, proveedor: " Ferretería Andina " }, { ...item, descripcion: "Sin costo", costo_total: 5, proveedor: "" }])]);
assert.deepEqual((await db.query("select costo_unitario::float c, costo_total::float t from os_items where os_id = $1 order by id", [os4])).rows,
  [{ c: 1000, t: 2500 }, { c: null, t: null }]);
assert.deepEqual((await db.query("select proveedor from os_items where os_id = $1 order by id", [os4])).rows.map((r) => r.proveedor),
  ["Ferretería Andina", null]);                                                                          // proveedor (15): opcional, sin espacios
await falla("select crear_os($1, $2)", [{ area_solicitante: "Corte", prioridad: "Verde", responsable: U }, [{ ...item, costo_unitario: -1 }]], /costo_(unitario|total)_check/);

// Correcciones (14_os_correcciones.sql): solo quien pidió la OS; el ítem cambia y lo anterior queda en el historial
const [c1, c2] = (await db.query("select id from os_items where os_id = $1 order by id", [os4])).rows.map((r) => r.id);
const corregir = (it, tipo, detalle, cambios) => db.query("select corregir_item($1, $2, $3, $4)", [it, tipo, detalle, cambios]);
await corregir(c1, "Mal entregado", "  Llegaron 2 y no 2,5  ", { cantidad: 2, referencia: "R-2", id: 999, entregado_por: PROD, os_id: os2 });
assert.deepEqual((await db.query("select id, os_id, cantidad::float q, costo_total::float t, referencia, entregado_por from os_items where id = $1", [c1])).rows[0],
  { id: c1, os_id: os4, q: 2, t: 2000, referencia: "R-2", entregado_por: null });                      // campos ajenos no se tocan
assert.deepEqual((await db.query("select tipo, detalle, antes, despues, por::text from os_correcciones where item_id = $1", [c1])).rows[0],
  { tipo: "Mal entregado", detalle: "Llegaron 2 y no 2,5", antes: { cantidad: 2.5, costo_total: 2500, referencia: null },
    despues: { cantidad: 2, costo_total: 2000, referencia: "R-2" }, por: U });
await corregir(c2, "Mal diligenciado", "Solo la nota", {});
await corregir(c2, "Mal diligenciado", "Era otro proveedor", { proveedor: "Aceros SAS" });                // el proveedor también se corrige
assert.deepEqual((await db.query("select antes, despues from os_correcciones where item_id = $1 order by id desc limit 1", [c2])).rows[0],
  { antes: { proveedor: null }, despues: { proveedor: "Aceros SAS" } });                                              // sin cambios: queda la nota
assert.deepEqual((await db.query("select antes, despues from os_correcciones where item_id = $1 order by id", [c2])).rows[0], { antes: {}, despues: {} });
await falla("select corregir_item($1, 'Perdido', 'x', '{}')", [c1], /tipo_check/);
await falla("select corregir_item($1, 'Mal entregado', '  ', '{}')", [c1], /detalle_check/);
await falla("select corregir_item($1, 'Mal entregado', 'x', $2)", [c1, { cantidad: 0 }], /cantidad_check/);
await falla("select corregir_item($1, 'Mal entregado', 'x', $2)", [c1, { medida: "caja" }], /medida_check/);
await falla("insert into os_correcciones (item_id, tipo, detalle) values ($1, 'Mal entregado', 'x')", [c1], /permission denied/);
await falla("update os_correcciones set detalle = 'otra'", [], /permission denied/);
await corregir(it2, "Mal entregado", "Era otra manguera", { descripcion: "Manguera 1/2" });               // OS cerrada: también
await comoUsuario(PROD);
await falla("select corregir_item($1, 'Mal entregado', 'x', '{}')", [it2], /Solo quien pidió/);         // el responsable no corrige
assert.equal(await val("select count(*)::int from os_correcciones"), 1);                                // pero ve las de su OS
assert.equal(await val("select descripcion from os_items where id = $1", [it2]), "Manguera 1/2");
await comoUsuario();

// Sin rol: no hace nada
await comoUsuario(SIN_ROL);
await falla("select crear_ot($1, $2)", [{ maquina: "F1", prioridad: "Rojo" }, linea], /row-level security/);
await falla("select crear_os($1, $2)", [{ area_solicitante: "Corte", prioridad: "Rojo" }, [item]], /row-level security/);
assert.equal(await val("select count(*)::int from ordenes_trabajo"), 0);
assert.equal(await val("select count(*)::int from usuarios_activos()"), 0);
await falla("select agregar_codigo('x')", [], /Solo la Dirección/);

// Sin sesión no se ve ni se crea nada
await db.exec("reset role; set app.uid = ''; set role anon;");
await falla("select * from v_ordenes", [], /permission denied/);
await falla("select crear_ot($1, $2)", [{ maquina: "F1", prioridad: "Rojo" }, linea], /permission denied/);
await db.exec("rollback");

// Desde la 10.000 el número no se corta; un código de la guía ya usado con otra descripción detiene el script 9
await db.exec("reset role; begin; update consecutivos set ultimo = 9999 where formato = 'OT'");
await db.exec(`insert into ordenes_trabajo (maquina, prioridad, responsable) values ('X', 'Verde', '${U}')`);
assert.equal(await val("select numero from ordenes_trabajo order by id desc limit 1"), "OT-10000");
await db.exec("update codigos_falla set descripcion = 'Creado en la app' where codigo = 89");
await assert.rejects(db.exec(readFileSync(`${dir}/9_guia_octubre.sql`, "utf8")), /89 \(Creado en la app\)/);
await db.exec("rollback");

// Una base con la versión anterior de 11 (costo_total calculado) pasa a editable y conserva lo que tenía
await db.exec("reset role; begin");
await db.exec(`alter table os_items drop column costo_total;
  alter table os_items add column costo_total numeric generated always as (round(cantidad * costo_unitario, 2)) stored;
  insert into ordenes_suministro (area_solicitante, prioridad, responsable) values ('Corte', 'Verde', '${U}');
  insert into os_items (os_id, maquina, cantidad, medida, descripcion, costo_unitario) select max(id), 'M', 2, 'und', 'x', 10 from ordenes_suministro;`);
await db.exec(readFileSync(`${dir}/11_os_costos.sql`, "utf8"));
assert.equal(await val("select is_generated from information_schema.columns where table_name = 'os_items' and column_name = 'costo_total'"), "NEVER");
assert.equal(await val("select costo_total::float from os_items"), 20);
await db.exec(readFileSync(`${dir}/13_os_total_sin_fotos.sql`, "utf8"));
await db.exec("update os_items set costo_total = 25");                                                   // los ya guardados no se recalculan
assert.equal(await val("select costo_total::float from os_items"), 25);
await db.exec("rollback");
console.log("OK: todas las pruebas del esquema pasaron");
