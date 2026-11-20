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
  create role anon; create role authenticated; create role service_role;
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
await db.exec(readFileSync(`${dir}/17_cierre_roles_maquinas.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/18_ats_estado.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/19_permiso_sst.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/20_sst_consulta.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/21_ats_vigencia.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/22_os_responsable.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/23_os_entrega_parcial.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/24_maquinas_galones.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/25_os_entregas_parciales.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/26_os_editar_entrega.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/27_os_en_proceso.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/28_os_maquina_lista.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/29_ats_vencimiento.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/30_formatos_extra.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/31_consulta_todos.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/32_os_libras_stock.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/33_os_listo_recoger.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/34_os_sin_descripcion.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/35_montacargas.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/36_ot_maquina_lista.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/37_restaurar_funciones_os.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/38_ot_maquina_otro.sql`, "utf8"));
await db.exec(`insert into maquinas (nombre) values ('Formadora 1'), ('M'),
  ('Slitter'), ('Slitter 1'), ('Tubería 3'), ('Platina'), ('F1'), ('X')`);  // máquinas de las OT y OS de prueba (28 y 36)
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
await db.exec(readFileSync(`${dir}/17_cierre_roles_maquinas.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/18_ats_estado.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/19_permiso_sst.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/20_sst_consulta.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/21_ats_vigencia.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/22_os_responsable.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/23_os_entrega_parcial.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/24_maquinas_galones.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/25_os_entregas_parciales.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/26_os_editar_entrega.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/27_os_en_proceso.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/28_os_maquina_lista.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/29_ats_vencimiento.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/30_formatos_extra.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/31_consulta_todos.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/32_os_libras_stock.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/33_os_listo_recoger.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/34_os_sin_descripcion.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/35_montacargas.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/36_ot_maquina_lista.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/37_restaurar_funciones_os.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/38_ot_maquina_otro.sql`, "utf8"));
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
await falla("select actualizar_usuario($1, 'Cesar Riveros', 'produccion', $2, '')", [PROD, "x".repeat(61)], /usuarios_frente_largo/);  // frente libre (17), con largo máximo
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
// Vigencia del ATS (29_ats_vencimiento.sql): la pone la base al guardar (ahora + 24 h); lo que mande el navegador no cuenta
const ats = { ot_id: id2, descripcion_labor: "Cambio de motor en altura", alturas: true, firma_encargado: "Fredy", firma_jefe: "Ivan",
  fecha_apertura: "2020-01-01", hora_apertura: "07:00", vigente_hasta: "2030-01-01 00:00" };
const trab = [{ nombre: "Fredy", salud_ok: true, medicamentos_sueno: false, afiliacion_ss: true, certificado: true }];
const pasos = [{ paso: "Montar andamio", controles: "Arnés y línea de vida" }];
await falla("select crear_ats($1, $2, $3)", [ats, trab, pasos], /check/);                                  // alturas sin coordinador
const atsId = await val("select crear_ats($1, $2, $3)", [{ ...ats, firma_coord_alturas: "Lina" }, trab, pasos]);
assert.deepEqual((await db.query(`select vigente_hasta - creado_en = interval '24 hours' as h24,
  fecha_apertura = (creado_en at time zone 'America/Bogota')::date as hoy from ats where id = $1`, [atsId])).rows[0], { h24: true, hoy: true });
// A las 24 h se cierra solo, con la hora en que venció; los que no han vencido siguen abiertos
await db.exec("savepoint a29");
await db.exec("reset role");
assert.equal(await val("select public.cerrar_ats_vencidos()"), 0);
await db.query("update ats set vigente_hasta = now() - interval '1 minute' where id = $1", [atsId]);
assert.equal(await val("select public.cerrar_ats_vencidos()"), 1);
assert.equal(await val("select estado || (cerrada_en = vigente_hasta) from ats where id = $1", [atsId]), "Cerradatrue");
await db.exec("rollback to savepoint a29");
await falla("select public.cerrar_ats_vencidos()", [], /permission denied/);                               // nadie lo llama desde la app
assert.equal(await val("select numero from ats where id = $1", [atsId]), "ATS-0001");   // cada formato cuenta aparte
assert.equal(await val("select estado from ats where id = $1", [atsId]), "Abierta");
// El ATS se cierra con su OT, a la misma hora; uno nuevo sobre una OT cerrada nace cerrado (18_ats_estado.sql)
await db.exec("savepoint a18");
await db.query("select cerrar_ot($1)", [id2]);
assert.equal(await val("select a.estado || (a.cerrada_en = o.cerrada_en) from ats a join ordenes_trabajo o on o.id = a.ot_id where a.id = $1", [atsId]), "Cerradatrue");
const atsTarde = await val("select crear_ats($1, $2, $3)", [{ ...ats, firma_coord_alturas: "Lina", estado: "Abierta" }, trab, pasos]);
assert.equal(await val("select estado from ats where id = $1", [atsTarde]), "Cerrada");
await db.exec("rollback to savepoint a18");
// Vigencia del permiso (19 y 21): obligatoria y después del inicio, sin máximo (las 24 h son del ATS)
const permiso = `insert into permisos_trabajo (ot_id, ats_id, area_proceso, fecha_ejecucion, hora_inicio, vigente_hasta, trabajador_encargado, tarea, tipos, metodo_electrico, firma_ejecutor, firma_emisor)
  values (${id2}, $1, 'Mantenimiento', current_date, '07:00', current_date + time '07:00' + interval '8 hours', 'Fredy', 'Cambio motor', $2, $3, 'Fredy', 'Ivan')`;
const conVigencia = (inicio, hasta) => db.query(`insert into permisos_trabajo (ot_id, area_proceso, fecha_ejecucion, hora_inicio, vigente_hasta, trabajador_encargado, tarea, tipos, firma_ejecutor, firma_emisor)
  values (${id2}, 'Mantenimiento', '2026-11-09', $1, $2, 'Fredy', 'Izaje', '{izaje}', 'Fredy', 'Ivan')`, [inicio, hasta]);
await db.exec("savepoint v24");
await conVigencia("07:00", "2026-11-12 07:00");                                                            // varios días: vale, e izaje es un tipo válido
await db.exec("rollback to savepoint v24");
await assert.rejects(conVigencia("07:00", "2026-11-09 06:00"), /permisos_trabajo_vigencia/);               // termina antes de empezar
await db.exec("rollback to savepoint v24");
await assert.rejects(conVigencia(null, "2026-11-09 10:00"), /permisos_trabajo_vigencia/);                  // sin hora de inicio
await db.exec("rollback to savepoint v24");
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
await falla("select crear_os($1, $2)", [{ area_solicitante: "Formadoras", prioridad: "Rojo", responsable: U }, [{ ...item, maquina: "INVENTADA" }]], /no está en la lista/);  // 28
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
await db.query("select firmar_item($1, 'recibe')", [it1]);         // último recibido: se cierra sola (17_cierre_roles_maquinas.sql)
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
assert.equal(await val("select count(*)::int from ot_lineas"), 1);                                      // solo la de la OT que él registró (31)
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
assert.equal(await val("select count(*)::int from ot_lineas"), 2);                                      // la que registró y la que tiene a cargo
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
await falla("select firmar_item($1, 'entrega')", [it2], /ya se entregó completo/);
assert.equal(await val("select entregado_por::text from os_items where id = $1", [it2]), PROD);
await falla("update os_items set recibido_por = $1 where id = $2", [PROD, it2], /permission denied/);       // nadie firma por otro editando
await comoUsuario();
await falla("select firmar_item($1, 'entrega')", [it2], /Solo el responsable/);
assert.equal(await val("select entregado from os_items where id = $1", [it2]), false);                   // una sola firma: sin chulo
await db.query("select firmar_item($1, 'recibe')", [it2]);
assert.equal(await val("select entregado from os_items where id = $1", [it2]), true);                    // las dos firmas: chuleado
assert.ok(await val("select recibido_en from os_items where id = $1", [it2]));
assert.equal(await val("select estado from ordenes_suministro where id = $1", [os2]), "Cerrada");   // se cerró sola con el recibido
assert.ok(await val("select cerrada_en from ordenes_suministro where id = $1", [os2]));
// Recibir antes de que entreguen no se puede
const it3 = await val("select id from os_items where os_id = $1", [os3]);
await falla("select firmar_item($1, 'recibe')", [it3], /No hay entregas de este ítem por recibir/);
await falla("select firmar_item($1, 'otro')", [it3], /no válida/);
// Con varios ítems sigue abierta hasta el último recibido
const osVarios = await val("select id from ordenes_suministro where numero = $1", [await os({ area_solicitante: "Corte", prioridad: "Verde" }, [item, { ...item, descripcion: "Acople" }])]);
const [ia, ib] = (await db.query("select id from os_items where os_id = $1 order by id", [osVarios])).rows.map((r) => r.id);
for (const como of ["entrega", "recibe"]) await db.query("select firmar_item($1, $2)", [ia, como]);
assert.equal(await val("select estado from ordenes_suministro where id = $1", [osVarios]), "Abierta");
for (const como of ["entrega", "recibe"]) await db.query("select firmar_item($1, $2)", [ib, como]);
assert.equal(await val("select estado from ordenes_suministro where id = $1", [osVarios]), "Cerrada");
await comoUsuario(PROD);
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
// El responsable también corrige (22); su tipo lo pone la base
await corregir(it2, "Mal diligenciado", "Costo de la factura", { costo_unitario: 500 });
assert.deepEqual((await db.query("select tipo, despues from os_correcciones where item_id = $1 order by id desc limit 1", [it2])).rows[0],
  { tipo: "Ajuste del responsable", despues: { costo_unitario: 500, costo_total: 500 * Number(await val("select cantidad from os_items where id = $1", [it2])) } });
assert.equal(await val("select count(*)::int from os_correcciones"), 2);                                // ve las de su OS
assert.equal(await val("select descripcion from os_items where id = $1", [it2]), "Manguera 1/2");
await falla("select corregir_item($1, 'Mal entregado', 'x', '{}')", [c1], /Solo quien pidió la orden o su responsable/);  // OS ajena
await comoUsuario();
await falla("select corregir_item($1, 'Ajuste del responsable', 'x', '{}')", [c1], /mal diligenciado o mal entregado/);
// Entregas parciales (25): lo que falta se entrega después; la OS queda En proceso hasta completar todo
const estadoOS4 = () => val("select estado from ordenes_suministro where id = $1", [os4]);
// Poner en proceso (27): solo el responsable y solo si está abierta
await db.exec("savepoint s27");
await db.query("select poner_en_proceso($1)", [os4]);
assert.equal(await estadoOS4(), "En proceso");
await falla("select poner_en_proceso($1)", [os4], /solo si está abierta/);
await db.exec("rollback to savepoint s27");
await db.exec("savepoint s25");
await falla("select firmar_item($1, 'entrega', 0)", [c1], /Entregue más de 0 y hasta 2 m/);
await falla("select firmar_item($1, 'entrega', 3)", [c1], /hasta 2/);
await db.query("select firmar_item($1, 'entrega', 1.5)", [c1]);                                           // entrega parcial
// Editar la entrega mal digitada (26): mientras no se reciba; el ítem queda completo o parcial según el total
const ent1 = await val("select max(id) from os_entregas where item_id = $1", [c1]);
await falla("select editar_entrega($1, 3)", [ent1], /hasta 2 m/);
await db.query("select editar_entrega($1, 2)", [ent1]);
assert.equal(await val("select (entregado_por is not null) || ' ' || cantidad_entregada::float from os_items where id = $1", [c1]), "true 2");
await db.query("select editar_entrega($1, 1.5)", [ent1]);
assert.equal(await val("select cantidad::float || ' ' || cantidad_anterior::float || ' ' || (editada_en is not null) from os_entregas where id = $1", [ent1]), "1.5 1.5 true");
assert.equal(await estadoOS4(), "En proceso");
assert.equal(await val("select (entregado_por is null) || ' ' || cantidad_entregada::float from os_items where id = $1", [c1]), "true 1.5");
await db.query("select firmar_item($1, 'recibe')", [c1]);                                                 // recibe la parte
await falla("select firmar_item($1, 'recibe')", [c1], /No hay entregas de este ítem por recibir/);
await falla("select editar_entrega($1, 1)", [ent1], /ya fue recibida/);
assert.equal(await estadoOS4(), "En proceso");
await falla("select firmar_item($1, 'entrega', 1)", [c1], /hasta 0.5/);
await db.query("select firmar_item($1, 'entrega')", [c1]);                                                // sin cantidad: lo que falta
await db.query("select firmar_item($1, 'entrega')", [c2]);
for (const it of [c1, c2]) await db.query("select firmar_item($1, 'recibe')", [it]);
assert.equal(await estadoOS4(), "Cerrada");
assert.deepEqual((await db.query("select cantidad::float q, (recibido_por is not null) r from os_entregas where item_id = $1 order by id", [c1])).rows,
  [{ q: 1.5, r: true }, { q: 0.5, r: true }]);
await db.exec("rollback to savepoint s25");
// Borrar una OS desde Supabase se lleva sus entregas y correcciones (26)
await db.exec("savepoint s26; reset role");
await db.query("insert into os_entregas (item_id, cantidad, entregado_por) values ($1, 1, $2)", [c1, U]);
await db.query("delete from ordenes_suministro where id = $1", [os4]);
assert.equal(await val("select count(*)::int from os_correcciones where item_id = $1", [c1]), 0);
await db.exec("rollback to savepoint s26");
await comoUsuario();
assert.equal(await val("select count(*)::int from os_items i where entregado_por is not null and not exists (select 1 from os_entregas e where e.item_id = i.id)"), 0);
assert.equal(await val("select count(*)::int from os_items where entregado_por is not null and cantidad_entregada is distinct from cantidad"), 0);  // las de antes: todo

// SST (19 y 20): llena los cuatro formatos; de los demás ve solo ATS y permisos, con su detalle; producción no
const totalOS = await val("select count(*)::int from ordenes_suministro"), totalLineas = await val("select count(*)::int from ot_lineas");
await db.exec(`reset role; update usuarios set rol = 'sst' where id = '${SIN_ROL}'`);
await comoUsuario(SIN_ROL);
assert.equal(await val("select count(*)::int from permisos_trabajo"), 1);
assert.ok(await val("select count(*)::int from ats") >= 1);
assert.ok(await val("select count(*)::int from ats_trabajadores") >= 1);
assert.ok(await val("select count(*)::int from ats_pasos") >= 1);
assert.equal(await val("select count(*)::int from ordenes_suministro"), 0);                             // las OS de los demás no
assert.equal(await val("select count(*)::int from ot_lineas"), 0);                                      // ni los reportes de sus OT
assert.equal(await val("select count(*)::int from os_items"), 0);
assert.ok(totalOS > 0 && totalLineas > 0);
assert.match(await ot({ maquina: "Slitter 1", prioridad: "Verde" }, linea), /^OT-\d{4}$/);               // crea OT
assert.match(await os({ area_solicitante: "Corte", prioridad: "Verde" }, [item]), /^OS-\d{4}$/);          // y OS
await comoUsuario(PROD);
assert.equal(await val("select count(*)::int from permisos_trabajo"), 0);
assert.equal(await val("select count(*)::int from ats_pasos"), 0);
await db.exec(`reset role; update usuarios set rol = 'sin_rol' where id = '${SIN_ROL}'`);

// Formularios adicionales (30_formatos_extra.sql): el admin le suma formatos a una persona sin cambiarle el rol
await comoUsuario();
await db.query("select actualizar_formatos_extra($1, $2)", [PROD, ["ATS", "ot"]]);
await falla("select actualizar_formatos_extra($1, $2)", [PROD, ["XX"]], /formatos_extra_check/);
await comoUsuario(PROD);
assert.deepEqual(await val("select mis_formatos()"), ["OT", "OS", "ATS"]);                               // produccion (OT, OS) + ATS
assert.equal(await val("select puede('ATS')"), true);
assert.equal(await val("select puede('PERMISO')"), false);
assert.equal(await val("select rol::text from usuarios where id = auth.uid()"), "produccion");          // el rol no cambia
await falla("select actualizar_formatos_extra($1, $2)", [PROD, ["PERMISO"]], /Solo un administrador/);    // nadie se los da a sí mismo
await comoUsuario();
await db.query("select actualizar_formatos_extra($1, '{}')", [PROD]);
assert.deepEqual(await val("select mis_formatos()"), ["OT", "OS", "ATS", "PERMISO"]);                    // admin: todos

// Quien registró una OT ve sus reportes de falla al abrirla en Consulta (31_consulta_todos.sql)
await comoUsuario(PROD);
const otPropia = await idDe(await ot({ maquina: "Slitter 1", prioridad: "Verde" }, linea));             // responsable: U, no él
assert.equal(await val("select count(*)::int from ot_lineas where ot_id = $1", [otPropia]), 1);
await comoUsuario();

// Libras y stock (32_os_libras_stock.sql): el ítem se pide en lb y quien pide marca si es para stock
await comoUsuario();
const os32 = await val("select id from ordenes_suministro where numero = $1", [await os({ area_solicitante: "Corte", prioridad: "Verde" },
  [{ ...item, medida: "lb", stock: true }, { ...item, descripcion: "Sin stock" }])]);
assert.deepEqual((await db.query("select medida, stock from os_items where os_id = $1 order by id", [os32])).rows,
  [{ medida: "lb", stock: true }, { medida: "m", stock: false }]);
await falla("select crear_os($1, $2)", [{ area_solicitante: "Corte", prioridad: "Verde", responsable: U }, [{ ...item, medida: "onzas" }]], /medida_check/);

// Lista para recoger en bodega (33): solo el responsable la marca o desmarca; queda quién y cuándo
await comoUsuario();
const os33 = await val("select id from ordenes_suministro where numero = $1", [await os({ area_solicitante: "Corte", prioridad: "Verde", responsable: PROD }, [item])]);
await falla("select marcar_listo_recoger($1, true)", [os33], /Solo el responsable/);                    // quien pidió no
await comoUsuario(PROD);
await db.query("select marcar_listo_recoger($1, true)", [os33]);
assert.deepEqual((await db.query("select listo_recoger_en is not null as listo, listo_recoger_por::text por, estado from ordenes_suministro where id = $1", [os33])).rows[0],
  { listo: true, por: PROD, estado: "Abierta" });                                                          // no cambia el estado
await db.query("select marcar_listo_recoger($1, false)", [os33]);
assert.equal(await val("select listo_recoger_en from ordenes_suministro where id = $1", [os33]), null);
await falla("update ordenes_suministro set listo_recoger_en = now() where id = $1", [os33], /permission denied/);
await comoUsuario();

// Sin descripción (34): la función describe el ítem; sin función ni descripción no se guarda
await comoUsuario();
const os34 = await val("select id from ordenes_suministro where numero = $1", [await os({ area_solicitante: "Corte", prioridad: "Verde" },
  [{ maquina: item.maquina, cantidad: 1, medida: "und", funcion: "  Guantes de carnaza para soldar " }])]);
assert.deepEqual((await db.query("select descripcion, funcion from os_items where os_id = $1", [os34])).rows[0],
  { descripcion: "Guantes de carnaza para soldar", funcion: "Guantes de carnaza para soldar" });
await falla("select crear_os($1, $2)", [{ area_solicitante: "Corte", prioridad: "Verde", responsable: U }, [{ maquina: item.maquina, cantidad: 1, medida: "und" }]], /Escriba la función/);

// Montacargas (35): trece máquinas numeradas; una OS puede pedir para la #7
assert.equal(await val("select count(*)::int from maquinas where nombre like 'MONTACARGA #%'"), 13);
assert.match(await os({ area_solicitante: "Corte", prioridad: "Verde" }, [{ maquina: "MONTACARGA #7", cantidad: 1, medida: "und", funcion: "Llanta" }]), /^OS-\d{4}$/);

// Sin OTRO (36): la OT solo acepta máquinas de la lista, sin importar mayúsculas ni cómo la escriban
await comoUsuario();
await falla("select crear_ot($1, $2)", [{ maquina: "montacarga 7", prioridad: "Verde", responsable: U }, linea], /no está en la lista/);
await falla("select crear_ot($1, $2)", [{ maquina: "Platina ", prioridad: "Verde", responsable: U }, linea], /no está en la lista/);
assert.match(await ot({ maquina: "MONTACARGA #7", prioridad: "Verde" }, linea), /^OT-\d{4}$/);
assert.match(await ot({ maquina: "OTRO", prioridad: "Verde" }, linea), /^OT-\d{4}$/);                   // OTRO, sin escribir cuál (38)

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

// Roles nuevos con sus formatos, frentes libres y máquinas (17_cierre_roles_maquinas.sql)
await comoUsuario();
assert.equal(await val("select crear_rol($1, $2)", [" Bodega Ñ ", ["OS"]]), "bodega_n");
assert.deepEqual((await db.query("select formatos from roles_disponibles() where rol = 'bodega_n'")).rows[0].formatos, ["OS"]);
await assert.rejects(db.query("select crear_rol($1, $2)", ["bodega ñ", ["OS"]]), /Ya existe/);
await assert.rejects(db.query("select crear_rol($1, $2)", ["calidad", []]), /formatos/);
await db.query("select actualizar_usuario($1, 'Cesar Riveros', 'bodega_n', ' Logística ', 'Despachos')", [PROD]);
assert.equal(await val(`select rol::text || ' · ' || frente from usuarios where id = '${PROD}'`), "bodega_n · Logística");
assert.equal(await val("select count(*)::int from maquinas"), 37);  // 15 de la lista + 8 de prueba + 13 montacargas (35) + OTRO (38)
assert.equal(await val("select agregar_maquina($1)", ["  dobladora "]), "DOBLADORA");
assert.equal(await val("select agregar_maquina($1, $2)", ["Dobladora", "CTL"]), "DOBLADORA");     // ya existe: no se repite
assert.equal(await val("select count(*)::int from maquinas"), 38);
await assert.rejects(db.query("select agregar_maquina('otro')"), /ya es una opción/);
await assert.rejects(db.query("select agregar_maquina('X', 'Bodega')"), /Línea no válida/);
// Editar máquina (24): nombre y línea; sin repetir otra; las órdenes guardadas no cambian
const otDobladora = await ot({ maquina: "DOBLADORA", prioridad: "Verde" }, linea);
assert.equal(await val("select editar_maquina($1, $2, $3)", ["DOBLADORA", " dobladora 2 ", "Cubiertas"]), "DOBLADORA 2");
assert.equal(await val("select nombre || ' · ' || linea from maquinas where nombre = 'DOBLADORA 2'"), "DOBLADORA 2 · Cubiertas");
assert.equal(await val("select maquina from ordenes_trabajo where numero = $1", [otDobladora]), "DOBLADORA");
assert.equal(await val("select editar_maquina('DOBLADORA 2', 'Dobladora 2')"), "DOBLADORA 2");             // misma: solo cambia la línea
assert.equal(await val("select count(*)::int from maquinas where linea is null and nombre = 'DOBLADORA 2'"), 1);
await assert.rejects(db.query("select editar_maquina('DOBLADORA 2', 'ctl bronx')"), /Ya existe la máquina CTL BRONX/);
await assert.rejects(db.query("select editar_maquina('NO EXISTE', 'Y')"), /no está en la lista/);
await assert.rejects(db.query("select editar_maquina('DOBLADORA 2', 'otro')"), /ya es una opción/);
// Galones en la OS (24)
assert.match(await os({ area_solicitante: "Corte", prioridad: "Verde" }, [{ ...item, cantidad: 3, medida: "gal" }]), /^OS-\d{4}$/);
await comoUsuario(PROD);
assert.equal(await val("select puede('OS')"), true);                                                // el rol nuevo llena lo que se le dio
assert.equal(await val("select puede('OT')"), false);
await assert.rejects(db.query("select crear_rol('x_rol', '{OT}')"), /Solo un administrador/);
await assert.rejects(db.query("select agregar_maquina('Y')"), /Solo un administrador/);
await assert.rejects(db.query("select editar_maquina('DOBLADORA 2', 'Y')"), /Solo un administrador/);
await db.exec("reset role");
// Si alguien vuelve a ejecutar 15 (deja crear_os viejo), 37 lo restaura: la OS vuelve a guardar stock y función
await db.exec("reset role; begin");
await db.exec(readFileSync(`${dir}/15_os_proveedor.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/37_restaurar_funciones_os.sql`, "utf8"));
await db.exec(`set app.uid = '${U}'; set role authenticated;`);
const n37 = await val("select crear_os($1, $2)", [{ area_solicitante: "Corte", prioridad: "Verde", responsable: U },
  [{ maquina: "Formadora 1", cantidad: 1, medida: "und", funcion: "Sello", stock: true }]]);
assert.deepEqual((await db.query("select i.descripcion, i.stock from os_items i join ordenes_suministro o on o.id = i.os_id where o.numero = $1", [n37])).rows[0],
  { descripcion: "Sello", stock: true });
await db.exec("reset role; rollback");
// Referencia y función obligatorias en ítems nuevos (39); los viejos sin referencia se siguen editando
await db.exec(`set app.uid = '${U}'; set role authenticated;`);
const viejo = await val("select i.id from os_items i join ordenes_suministro o on o.id = i.os_id where o.numero = $1",
  [await os({ area_solicitante: "Corte", prioridad: "Verde" }, [{ maquina: "Formadora 1", cantidad: 2, medida: "und", funcion: "Viejo" }])]);
await db.exec("reset role");
await db.exec(readFileSync(`${dir}/39_os_referencia_obligatoria.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/39_os_referencia_obligatoria.sql`, "utf8"));   // se puede volver a ejecutar
await db.exec(`set app.uid = '${U}'; set role authenticated;`);
const nuevo = { maquina: "Formadora 1", referencia: "R-1", cantidad: 1, medida: "und", funcion: "Sello" };
const os39 = (it) => db.query("select crear_os($1, $2)", [{ area_solicitante: "Corte", prioridad: "Verde", responsable: U }, [it]]);
await assert.rejects(os39({ ...nuevo, referencia: "  " }), /Escriba la referencia/);
await assert.rejects(os39({ ...nuevo, referencia: undefined }), /Escriba la referencia/);
await assert.rejects(os39({ ...nuevo, funcion: undefined, descripcion: "x" }), /Escriba la función/);
await assert.rejects(os39({ ...nuevo, maquina: undefined }), /máquina|maquina/);
await assert.rejects(os39({ ...nuevo, cantidad: undefined }), /cantidad/);
await assert.rejects(os39({ ...nuevo, medida: undefined }), /medida/);
const n39 = (await os39(nuevo)).rows[0].crear_os;
const i39 = await val("select i.id from os_items i join ordenes_suministro o on o.id = i.os_id where o.numero = $1", [n39]);
await assert.rejects(corregir(i39, "Mal diligenciado", "x", { referencia: "" }), /Escriba la referencia/);
await corregir(i39, "Mal diligenciado", "x", { referencia: "R-9" });
assert.equal(await val("select referencia from os_items where id = $1", [i39]), "R-9");
await corregir(viejo, "Mal diligenciado", "x", { cantidad: 1 });   // ítem viejo sin referencia: sí se corrige
// Observaciones del responsable (40): solo él las escribe, con la orden sin cerrar; vacías se borran
await db.exec("reset role");
await db.exec(readFileSync(`${dir}/40_os_observaciones.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/40_os_observaciones.sql`, "utf8"));   // se puede volver a ejecutar
await comoUsuario();
const os40 = await val("select id from ordenes_suministro where numero = $1", [await os({ area_solicitante: "Corte", prioridad: "Verde", responsable: PROD },
  [{ maquina: "Formadora 1", referencia: "R", cantidad: 1, medida: "und", funcion: "Sello" }])]);
await assert.rejects(db.query("select guardar_observaciones_os($1, 'x')", [os40]), /Solo el responsable/);   // quien pidió no
await comoUsuario(PROD);
await db.query("select guardar_observaciones_os($1, $2)", [os40, "  En bodega, no han pasado por él  "]);
assert.deepEqual((await db.query("select observaciones, observaciones_en is not null en from ordenes_suministro where id = $1", [os40])).rows[0],
  { observaciones: "En bodega, no han pasado por él", en: true });
await assert.rejects(db.query("select guardar_observaciones_os($1, $2)", [os40, "x".repeat(501)]), /observaciones_check/);
await assert.rejects(db.query("update ordenes_suministro set observaciones = 'x' where id = $1", [os40]), /permission denied/);
await db.query("select guardar_observaciones_os($1, ' ')", [os40]);
assert.equal(await val("select observaciones from ordenes_suministro where id = $1", [os40]), null);
await comoUsuario();
assert.equal(await val("select cantidad::int from os_items where id = $1", [viejo]), 1);
// Sin montacargas numerados (41): salen de la lista; las órdenes guardadas no cambian; se agregan y editan uno por uno
await db.exec("reset role");
const conMontacarga = await val("select count(*)::int from os_items where maquina like 'MONTACARGA #%'");
await db.exec(readFileSync(`${dir}/41_quitar_montacargas.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/41_quitar_montacargas.sql`, "utf8"));   // se puede volver a ejecutar
assert.equal(await val("select count(*)::int from maquinas where nombre like 'MONTACARGA%'"), 0);
assert.equal(await val("select count(*)::int from os_items where maquina like 'MONTACARGA #%'"), conMontacarga);
await comoUsuario();
assert.equal(await val("select agregar_maquina('Montacarga 1')"), "MONTACARGA 1");
assert.equal(await val("select editar_maquina('MONTACARGA 1', 'Montacarga 01')"), "MONTACARGA 01");
// Montacargas de la planta (42): 14, sin duplicar los que ya estén aunque estén escritos distinto
await db.exec("reset role");
await db.exec("insert into maquinas (nombre) values ('MONTACARGA snsc  20t #1'), ('CLARK #11')");
await db.exec(readFileSync(`${dir}/42_montacargas_lista.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/42_montacargas_lista.sql`, "utf8"));   // se puede volver a ejecutar
assert.equal(await val("select count(*)::int from maquinas where nombre like 'MONTACARGAS %'"), 12);   // 14 menos los 2 que ya estaban
assert.equal(await val("select count(*)::int from maquinas where nombre in ('MONTACARGAS TOYOTA 5T #3', 'MONTACARGAS TOYOTA 5T #7', 'MONTACARGAS MITSUBISHI')"), 3);
assert.equal(await val("select count(*)::int from maquinas where nombre in ('MONTACARGAS SNSC 20T #1', 'MONTACARGAS CLARK #11')"), 0);
await comoUsuario();
assert.match(await os({ area_solicitante: "Corte", prioridad: "Verde" }, [{ maquina: "MONTACARGAS NISSAN 110 #13", referencia: "R", cantidad: 1, medida: "und", funcion: "Llanta" }]), /^OS-\d{4}$/);
await db.exec("reset role");
// OS en proceso (43): con el último recibido se cierra sola; el responsable la puede cerrar; las atascadas se cierran
await db.exec(readFileSync(`${dir}/23_os_entrega_parcial.sql`, "utf8"));          // como si alguien volviera a ejecutar uno viejo
await db.exec(readFileSync(`${dir}/43_os_cierre_en_proceso.sql`, "utf8"));
await comoUsuario();
const it43 = { maquina: "Formadora 1", referencia: "R", cantidad: 2, medida: "und", funcion: "Sello" };
const os43 = await val("select id from ordenes_suministro where numero = $1", [await os({ area_solicitante: "Corte", prioridad: "Verde", responsable: PROD }, [it43])]);
const i43 = await val("select id from os_items where os_id = $1", [os43]);
await comoUsuario(PROD);
await db.query("select poner_en_proceso($1)", [os43]);
await db.query("select firmar_item($1, 'entrega', 1)", [i43]);
await db.query("select firmar_item($1, 'entrega')", [i43]);
await comoUsuario();
await db.query("select firmar_item($1, 'recibe')", [i43]);
assert.equal(await val("select estado from ordenes_suministro where id = $1", [os43]), "Cerrada");        // se cerró sola
await db.exec("reset role");
await db.exec(`update ordenes_suministro set estado = 'En proceso', cerrada_en = null where id = ${os43}`);  // atascada
await comoUsuario(PROD);
await db.query("select cerrar_os($1)", [os43]);
assert.equal(await val("select estado from ordenes_suministro where id = $1", [os43]), "Cerrada");        // el responsable la cierra
await assert.rejects(db.query("select cerrar_os($1)", [os43]), /no está cerrada/);
await db.exec("reset role");
await db.exec(`update ordenes_suministro set estado = 'En proceso', cerrada_en = null where id = ${os43}`);
await db.exec(readFileSync(`${dir}/43_os_cierre_en_proceso.sql`, "utf8"));       // se puede volver a ejecutar y cierra las atascadas
assert.equal(await val("select estado from ordenes_suministro where id = $1", [os43]), "Cerrada");
assert.equal(await val("select count(*)::int from ordenes_suministro o where estado <> 'Cerrada' and exists (select 1 from os_items i where i.os_id = o.id) and not exists (select 1 from os_items i where i.os_id = o.id and not i.entregado)"), 0);
// Al firmar, la OS en proceso vuelve a Abierta (44); la entrega parcial ya no la pone en proceso
await db.exec(readFileSync(`${dir}/44_os_firma_abierta.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/44_os_firma_abierta.sql`, "utf8"));   // se puede volver a ejecutar
await comoUsuario();
const os44 = await val("select id from ordenes_suministro where numero = $1", [await os({ area_solicitante: "Corte", prioridad: "Verde", responsable: PROD }, [it43, it43])]);
const [a44, b44] = (await db.query("select id from os_items where os_id = $1 order by id", [os44])).rows.map((r) => r.id);
const estado44 = () => val("select estado from ordenes_suministro where id = $1", [os44]);
await comoUsuario(PROD);
await db.query("select firmar_item($1, 'entrega', 1)", [a44]);
assert.equal(await estado44(), "Abierta");                                        // parcial: sigue abierta
await db.query("select poner_en_proceso($1)", [os44]);
await db.query("select firmar_item($1, 'entrega', 1)", [a44]);
assert.equal(await estado44(), "Abierta");                                        // firma del responsable: vuelve a Abierta
await db.query("select poner_en_proceso($1)", [os44]);
await comoUsuario();
await db.query("select firmar_item($1, 'recibe')", [a44]);
assert.equal(await estado44(), "Abierta");                                        // recibido: vuelve a Abierta
await comoUsuario(PROD);
await db.query("select poner_en_proceso($1)", [os44]);
await db.query("select firmar_item($1, 'entrega')", [b44]);
await comoUsuario();
await db.query("select firmar_item($1, 'recibe')", [b44]);
assert.equal(await estado44(), "Cerrada");                                        // el último recibido la cierra
await db.exec("reset role");
// Corregir la cantidad pedida recalcula el ítem y cierra la OS (45): pidieron 6, solo había 1
await db.exec(readFileSync(`${dir}/45_os_corregir_cantidad.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/45_os_corregir_cantidad.sql`, "utf8"));   // se puede volver a ejecutar
await comoUsuario();
const os45 = await val("select id from ordenes_suministro where numero = $1", [await os({ area_solicitante: "Corte", prioridad: "Verde", responsable: PROD }, [{ ...it43, cantidad: 6 }, { ...it43, cantidad: 3 }])]);
const [a45, b45] = (await db.query("select id from os_items where os_id = $1 order by id", [os45])).rows.map((r) => r.id);
const estado45 = () => val("select estado from ordenes_suministro where id = $1", [os45]);
const entregado45 = (id) => val("select entregado from os_items where id = $1", [id]);
await comoUsuario(PROD);
await db.query("select firmar_item($1, 'entrega')", [a45]);                      // entrega 6...
await db.query("select editar_entrega($1, 1)", [await val("select id from os_entregas where item_id = $1", [a45])]);  // ...y la corrige a 1
await db.query("select firmar_item($1, 'entrega', 2)", [b45]);
await comoUsuario();
await db.query("select firmar_item($1, 'recibe')", [a45]);
await db.query("select firmar_item($1, 'recibe')", [b45]);
assert.equal(await entregado45(a45), false);                                      // "Parcial: 1 de 6"
await assert.rejects(db.query("select corregir_item($1, 'Mal diligenciado', 'x', $2)", [a45, { cantidad: 0.5 }]), /no puede ser menor/);
await db.query("select corregir_item($1, 'Mal diligenciado', 'Solo había 1', $2)", [a45, { cantidad: 1 }]);
assert.equal(await entregado45(a45), true);                                       // completo, con las firmas de la entrega
assert.equal(await val("select recibido_por::text from os_items where id = $1", [a45]), U);
assert.equal(await estado45(), "Abierta");                                        // falta el otro ítem
await comoUsuario(PROD);
await db.query("select corregir_item($1, 'Ajuste del responsable', 'Solo había 2', $2)", [b45, { cantidad: 2 }]);
assert.equal(await estado45(), "Cerrada");                                        // lo último completo la cierra
await comoUsuario();
await db.query("select corregir_item($1, 'Mal diligenciado', 'Eran 4', $2)", [b45, { cantidad: 4 }]);
assert.equal(await entregado45(b45), false);                                      // pidieron más: vuelve a pendiente
await db.exec("reset role");
// Listo para recoger por ítem (46): lo marca el responsable; las OS ya marcadas pasan a sus ítems pendientes
await comoUsuario();
const os46 = await val("select id from ordenes_suministro where numero = $1", [await os({ area_solicitante: "Corte", prioridad: "Verde", responsable: PROD }, [it43, it43])]);
const [a46, b46] = (await db.query("select id from os_items where os_id = $1 order by id", [os46])).rows.map((r) => r.id);
await comoUsuario(PROD);
await db.query("select marcar_listo_recoger($1, true)", [os46]);                  // marca vieja de toda la orden
await db.exec("reset role");
await db.exec(readFileSync(`${dir}/46_os_item_listo.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/46_os_item_listo.sql`, "utf8"));           // se puede volver a ejecutar
assert.equal(await val("select count(*)::int from os_items where os_id = $1 and listo_recoger_por is not null", [os46]), 2);
await comoUsuario(PROD);
await db.query("select marcar_item_listo($1, false)", [b46]);
assert.equal(await val("select listo_recoger_en is null from os_items where id = $1", [b46]), true);
await comoUsuario();
await assert.rejects(db.query("select marcar_item_listo($1, true)", [b46]), /Solo el responsable/);   // quien pidió solo lo ve
assert.equal(await val("select listo_recoger_en is not null from os_items where id = $1", [a46]), true);
await db.exec("reset role");
console.log("OK: todas las pruebas del esquema pasaron");
