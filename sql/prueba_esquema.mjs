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
`);
await db.exec(readFileSync(`${dir}/1_esquema.sql`, "utf8"));
await db.exec(readFileSync(`${dir}/2_semillas.sql`, "utf8"));
// Crear usuarios en auth.users llena public.usuarios (como hace Supabase > Authentication > Add user)
await db.exec(`insert into auth.users values ('${U}', 'fredy.verdugo@usuarios.lacampana.co', '{"nombre": "Fredy Verdugo"}'),
  ('22222222-2222-2222-2222-222222222222', 'lina.h@usuarios.lacampana.co', '{}');`);

const comoUsuario = () => db.exec(`reset role; set app.uid = '${U}'; set role authenticated;`);
const val = async (sql, p) => Object.values((await db.query(sql, p)).rows[0] ?? {})[0];
const falla = async (sql, p, texto) => {
  await db.exec("savepoint s");
  try { await db.query(sql, p); } catch (e) { await db.exec("rollback to savepoint s"); if (texto) assert.match(e.message, texto); return; }
  throw new Error("Debía fallar: " + sql);
};

await db.exec("begin");
assert.equal(await val("select count(*)::int from codigos_falla"), 87);
assert.equal(await val("select count(*)::int from codigos_falla where codigo = 77"), 0);

await comoUsuario();
assert.equal(await val(`select nombre from usuarios where id = '${U}'`), "Fredy Verdugo");
assert.equal(await val("select nombre from usuarios where usuario = 'lina.h'"), "lina.h"); // sin nombre: usa el usuario
await falla("insert into usuarios values (gen_random_uuid(), 'x', 'x')", [], /permission denied/);
await falla("update usuarios set nombre = 'otro'", [], /permission denied/);

const ot =(orden, lineas) => val("select crear_ot($1, $2)", [orden, lineas]);
const linea = [{ codigo_falla: 5, reporte: "Se reventó una manguera" }];

assert.equal(await ot({ maquina: "Formadora 1", prioridad: "Rojo" }, linea), "OT-0001");
assert.equal(await val("select estado from ordenes_trabajo where id = 1"), "Abierta");
assert.equal(await val("select creado_por::text from ordenes_trabajo where id = 1"), U);
await falla("select crear_ot($1, $2)", [{ maquina: "F1", prioridad: "Rojo" }, []], /al menos un código/);
await falla("select crear_ot($1, $2)", [{ maquina: " ", prioridad: "Rojo" }, linea]);                       // regla 2
await falla("select crear_ot($1, $2)", [{ maquina: "F1", prioridad: "Amarillo", riesgo_personas: true }, linea]);
await falla("select crear_ot($1, $2)", [{ maquina: "F1", prioridad: "Rojo" }, [{ codigo_falla: 77, reporte: "x" }]]);
await falla("select crear_ot($1, $2)", [{ maquina: "F1", prioridad: "Rojo" }, [{ codigo_falla: 83, reporte: "" }]]);

// Regla 8: tres firmas cierran la orden; solo se pueden editar firmas; nada se borra.
await db.query("update ordenes_trabajo set autorizado_por = 'Ivan', entregado_por = 'Jhon' where id = 1");
assert.equal(await val("select estado from ordenes_trabajo where id = 1"), "Abierta");
await db.query("update ordenes_trabajo set recibido_por = 'Juan Carlos' where id = 1");
assert.equal(await val("select estado from ordenes_trabajo where id = 1"), "Cerrada");
assert.ok(await val("select cerrada_en from ordenes_trabajo where id = 1"));
await falla("update ordenes_trabajo set maquina = 'otra' where id = 1", [], /permission denied/);
await falla("update ordenes_trabajo set estado = 'Cerrada' where id = 1", [], /permission denied/);
await falla("delete from ordenes_trabajo where id = 1", [], /permission denied/);

// Regla 6: alto riesgo no se entrega sin ATS y Permiso.
const n2 = await ot({ maquina: "Slitter", prioridad: "Amarillo", alto_riesgo: true }, linea);
assert.match(n2, /^OT-\d{4}$/);
const id2 = Number(n2.slice(3));
await falla(`update ordenes_trabajo set entregado_por = 'Fredy' where id = ${id2}`, [], /alto riesgo/);
const ats = { ot_id: id2, descripcion_labor: "Cambio de motor en altura", alturas: true, firma_encargado: "Fredy", firma_jefe: "Ivan" };
const trab = [{ nombre: "Fredy", salud_ok: true, medicamentos_sueno: false, afiliacion_ss: true, certificado: true }];
const pasos = [{ paso: "Montar andamio", controles: "Arnés y línea de vida" }];
await falla("select crear_ats($1, $2, $3)", [ats, trab, pasos], /check/);                                  // alturas sin coordinador
const atsId = await val("select crear_ats($1, $2, $3)", [{ ...ats, firma_coord_alturas: "Lina" }, trab, pasos]);
await falla(`update ordenes_trabajo set entregado_por = 'Fredy' where id = ${id2}`, [], /alto riesgo/);          // falta permiso
const permiso = `insert into permisos_trabajo (ot_id, ats_id, area_proceso, fecha_ejecucion, trabajador_encargado, tarea, tipos, metodo_electrico, firma_ejecutor, firma_emisor) values (${id2}, $1, 'Mantenimiento', current_date, 'Fredy', 'Cambio motor', $2, $3, 'Fredy', 'Ivan')`;
await falla(permiso, [atsId, ["alturas", "electrico"], null], /check/);                                    // eléctrico sin método
await falla(permiso, [atsId, ["otro"], null], /check/);
await db.query(permiso, [atsId, ["alturas", "electrico"], "Desenergizado"]);
await db.query(`update ordenes_trabajo set entregado_por = 'Fredy' where id = ${id2}`);

// OS
const os = (orden, items) => val("select crear_os($1, $2)", [orden, items]);
const item = { maquina: "Formadora 1", cantidad: 2, medida: "m", descripcion: "Manguera hidráulica" };
await falla("select crear_os($1, $2)", [{ area_solicitante: "Formadoras", prioridad: "Rojo" }, [{ ...item, medida: "cm" }]]);
await falla("select crear_os($1, $2)", [{ area_solicitante: "Formadoras", prioridad: "Rojo" }, [{ ...item, cantidad: 0 }]]);
await falla("select crear_os($1, $2)", [{ area_solicitante: "Formadoras", prioridad: "Rojo" }, [{ ...item, maquina: "" }]]);
assert.match(await os({ area_solicitante: "Formadoras", prioridad: "Rojo", ot_id: 1 }, [item]), /^OS-\d{4}$/);

// Vistas del dashboard
assert.equal(await val("select count(*)::int from v_ordenes"), 3);
assert.equal(await val("select count(*)::int from v_fallas where codigo_falla = 5"), 2);

// Sin sesión no se ve ni se crea nada
await db.exec("reset role; set app.uid = ''; set role anon;");
await falla("select * from v_ordenes", [], /permission denied/);
await falla("select crear_ot($1, $2)", [{ maquina: "F1", prioridad: "Rojo" }, linea], /permission denied/);
await db.exec("rollback");
console.log("OK: todas las pruebas del esquema pasaron");
