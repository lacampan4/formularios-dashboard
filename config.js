// Supabase > Project Settings > API. La llave publishable (anon) es pública por diseño; la seguridad está en RLS (sql/1_esquema.sql).
const SUPABASE_URL = "https://ciabttsnavhatfmzyjsv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_A7Pix3bljZId950FaqzCTg_RB0ZA_RN";
// Se entra con usuario: Supabase exige correo, así que "juan.perez" se guarda como "juan.perez@usuarios.lacampana.co".
// Ese correo no existe y nunca recibe mensajes. Al crear usuarios en Supabase use exactamente este dominio.
const DOMINIO_USUARIOS = "usuarios.lacampana.co";

// Guía de formatos de operaciones, sección 1 "Quién es quién"
const FRENTES = [
  { frente: "Producción", lider: "Cesar Riveros", area: "Tuberías" },
  { frente: "Producción", lider: "Juan Carlos Sánchez", area: "Formadoras" },
  { frente: "Producción", lider: "Sebastián Hernández", area: "Corte" },
  { frente: "Producción", lider: "Andres Sanchez", area: "Corte de vigas y corte de planchas" },
  { frente: "Producción", lider: "Wilson García", area: "Mecanizados" },
  { frente: "Producción", lider: "Raúl Salazar", area: "Mecánica de máquinas pequeñas" },
  { frente: "Mantenimiento", lider: "Fredy Verdugo", area: "Mecánica de CTL's y slitters" },
  { frente: "Mantenimiento", lider: "Jhon Lozano", area: "Mecánica de formadoras y tuberías" },
  { frente: "Mantenimiento", lider: "Ricardo Arcila", area: "Parte eléctrica de todas las máquinas y varios" },
  { frente: "Abastecimiento", lider: "Andrés Moreno", area: "Compras especializadas o importadas" },
  { frente: "Abastecimiento", lider: "Sofía Arévalo", area: "Compras de insumos nacionales" },
  { frente: "SST", lider: "Lina Hernández", area: "Seguridad y salud en el trabajo" },
];
const PERSONAS = ["Ivan Ibáñez", ...FRENTES.map((f) => f.lider)];

// Lista de máquinas de la OT; al final del desplegable va "OTRO", que pide escribirla
const MAQUINAS = [
  "CABALLETE", "CANAL PECHO PALOMA", "CTL BRONX", "CTL SESCO", "CUBIERTA ARQUITECTONICA", "CUBIERTA TRAPEZOIDAL",
  "ENTREPISO", "FORMACERO", "LÍNEA TUBERÍA GG80", "MAQUINAS PEQUENAS", "PERLIN EN C", "PLATINA",
  "SLITTER LOOPCO", "SLITTER YODER", "TUBERIA BRITISH",
];
// Línea de cada máquina, para mostrar en la OT solo los códigos de falla que le aplican (codigos_falla.lineas)
const LINEA_DE_MAQUINA = {
  "CTL BRONX": "CTL", "CTL SESCO": "CTL", "SLITTER LOOPCO": "Slitter", "SLITTER YODER": "Slitter",
  "CUBIERTA ARQUITECTONICA": "Cubiertas", "CUBIERTA TRAPEZOIDAL": "Cubiertas", "PERLIN EN C": "Perlin en C", "ENTREPISO": "Entrepiso",
};

const PRIORIDADES = { Rojo: "Urgente", Amarillo: "Programable", Verde: "Preventivo" };
const MEDIDAS = ["und", "kg", "m", "L"];
const TIPOS_PERMISO = { alturas: "Trabajo en alturas", caliente: "Trabajo en caliente", energias: "Energías peligrosas (bloqueo y etiquetado)", electrico: "Trabajo riesgo eléctrico" };
// FR-SST-039, sección 3
const EPP = [
  "Eslinga de posicionamiento en Y", "Sistema de anclaje ganchos y/o mosquetones", "Arnés de cuerpo entero",
  "Lentes y/o monogafas", "Protección auditiva de inserción o copa", "Mascarilla respiratoria de seguridad",
  "Línea de vida horizontal", "Casco con barbuquejo", "Guante dieléctrico de acuerdo a la tarea",
  "Visor arco dieléctrico y sin partes metálicas", "Ropa/dotación sin partes metálicas", "Botas dieléctricas de acuerdo a la tarea crítica",
];
