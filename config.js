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
const TIPOS_PERMISO = { alturas: "Trabajo en alturas", caliente: "Trabajo en caliente", energias: "Energías peligrosas (bloqueo y etiquetado)",
  electrico: "Trabajo riesgo eléctrico", izaje: "Trabajo con izaje de cargas" };

// ===== FR-SST-039 completo (borrador de SST, versión 1 del 22/07/2024) =====
// Sección 3
const EPP = [
  "Botas dieléctricas de acuerdo a la tarea crítica", "Mascarilla respiratoria de seguridad",
  "Arnés de cuerpo entero y eslinga de posicionamiento o en Y", "Casco con barbuquejo y protección auditiva",
  "Sistema de acceso (línea de vida, andamio, manlift)", "Ropa/dotación y sin partes metálicas",
  "Lentes y/o monogafas/visor de arco eléctrico", "Guante dieléctrico o de acuerdo a la tarea",
];
// Sección 4 (SÍ / NO / N/A)
const PERMISO_GENERALIDADES = [
  "El personal que realiza la labor conoce y/o se le explican los riesgos de los trabajos del área (elaboración de ATS) para control y gestión del riesgo.",
  "¿Se ha informado al jefe del área de la actividad a realizar?",
  "¿El personal cumple con los requisitos de aptitud y EPP adecuado y necesario para realizar la tarea?",
  "Se verificó la existencia de procedimientos de la tarea y se cumplen sus requisitos.",
  "¿Se ha colocado la señalización adecuada para evitar que el personal que está trabajando o ajeno al trabajo sufra o provoque un incidente (avisos de prevención, cintas, conos, etc.)?",
  "Va a utilizar sustancias químicas y cuenta con los controles para su manipulación.",
  "¿El personal conoce la ubicación de los equipos de emergencia (camillas, extintores y botiquines), procedimientos de rescate y salidas de emergencia?",
  "No utilizar joyas metálicas, como pulseras, anillos, cadenas, y evitar cargar objetos metálicos en los bolsillos de su dotación.",
];
// Sección 5 (SÍ / NO / N/A): se diligencia el grupo de cada tipo de tarea marcado (tipos: claves de TIPOS_PERMISO)
const PERMISO_ESPECIFICAS = [
  { titulo: "Trabajo en alturas", tipos: ["alturas"], items: [
    "Arnés EPPC certificados, apropiados y en buen estado.",
    "Utiliza plataforma elevadora (manlift) y ha realizado la inspección preoperacional.",
    "Escaleras apropiadas y en buen estado o estructura apropiada de anclaje.",
    "Los andamios se encuentran certificados, completos, en sus partes y accesorios.",
    "Evaluar interferencia con fuentes de energía o tránsito de personas.",
    "Cuenta con freno de seguridad, punto de anclaje certificado y apropiado para el tipo de línea de vida.",
    "Los conectores o mosquetones son de doble seguro."] },
  { titulo: "Trabajo en caliente", tipos: ["caliente"], items: [
    "Equipo y cables en buen estado, libres de empalmes.",
    "Evaluar EPP, instalaciones, ventilación, área de trabajo y herramientas adecuadas para la labor.",
    "Mantener fuentes inflamables a una distancia de 10 metros de la fuente de calor y un extintor a 3 metros.",
    "¿Se necesita instalar guardas, mamparas y demás medidas de protección?",
    "Área señalizada, aislada y libre de sustancias químicas.",
    "Se encuentra diligenciado el preoperacional de los equipos.",
    "Mantener los cilindros de gas fijos, asegurados y verticales."] },
  { titulo: "Trabajo riesgo eléctrico, aislamiento y control de energías peligrosas", tipos: ["electrico", "energias"], items: [
    "¿Se realizó la desconexión de la/las fuente(s) de alimentación de energía, así como la verificación de la ausencia de posibles fuentes de tensión o exposición a riesgos?",
    "¿Se realizó la conexión a tierra de todas aquellas posibles fuentes de tensión? (indique el equipo usado/lugar)",
    "¿La zona de trabajo está libre de puntos energizados que representen un riesgo en la actividad a ejecutar?",
    "Los trabajadores cuentan con la matrícula CONTE o entrenamiento adecuado de acuerdo al alcance de los trabajos a realizar y están autorizados para realizar la tarea.",
    "¿La máquina o equipo cuenta con la ficha de bloqueo y etiquetado, así como la debida notificación del personal sobre la tarea a realizar?",
    "Aplicación de dispositivos de bloqueo y rotulado."] },
  { titulo: "Trabajo con izaje de cargas", tipos: ["izaje"], items: [
    "Evaluar si la señalización ofrece condiciones seguras para personas, equipos y vehículos.",
    "Evaluar interferencia de equipos con áreas energizadas, estructuras y tuberías.",
    "Se verificaron todos y cada uno de los puntos de izaje asegurando que el espacio y radio de giro de la grúa es suficiente.",
    "Se realizó preoperacional a la grúa, así como el plan de izaje.",
    "Cuenta con señalero para realizar la maniobra, así como aparejos certificados."] },
];
// Hoja "Trabajo en caliente": lista de verificación de cada equipo que se va a usar (Sí / No).
// El permiso dura máximo 24 h, así que se diligencia un solo día (el formato en papel traía 7).
const PERMISO_CALIENTE = [
  { titulo: "Sierra sable", datos: ["Referencia del equipo a utilizar"], items: [
    "Herramientas manuales de potencia: ¿se encuentran sin conexiones de arranque directo (tienen pulsadores de marcha y detención)?",
    "Zapata antirrebote: ¿se encuentra en buen estado?",
    "Herramienta: ¿el cable de conexión está sin deterioro, ni empalmes y/o conductores expuestos?",
    "Las cuchillas de corte: ¿son de cambio directo por desgaste excesivo según los parámetros definidos por el fabricante?",
    "Cuchillas de corte: ¿se inspeccionan antes de cada uso (desgaste, fisura, deformaciones y/o deterioro)?",
    "Sistema de ajuste de la cuchilla: ¿corresponde a la herramienta y asegura el sistema?",
    "Trabajador: ¿está libre de objetos, accesorios, ropa, cabello suelto y otros elementos que puedan ser atrapados por partes móviles?",
    "Protecciones de seguridad: ¿se encuentran disponibles para evitar la proyección de partículas (mamparas)?"] },
  { titulo: "Taladro", datos: ["Tipo de equipo a utilizar (taladro estándar, inalámbrico, percutor)", "Medidas de brocas a utilizar", "Referencia del equipo a utilizar"], items: [
    "Herramienta: ¿se encuentra sin conexiones de arranque directo?",
    "Herramienta: ¿el cable de conexión está sin deterioro, ni empalmes y/o conductores expuestos?",
    "Herramienta: ¿cuenta con conexión a tierra?",
    "Instalación de brocas: ¿el trabajador verificó el correcto ajuste de la broca al mandril del taladro? (aplica para taladro inalámbrico o percutor)",
    "Instalación de brocas: ¿el trabajador verificó el correcto ajuste de la broca haciendo uso de la llave correspondiente al mandril del taladro? (aplica para taladro convencional)",
    "Condiciones de la broca: ¿se inspeccionan antes de cada uso (desgaste, fisura, deformaciones y/o deterioro)?",
    "Estado del mango o empuñadura: ¿se encuentra en buen estado? (bien ajustado, sin fisuras o deformaciones)",
    "Interruptores y selector de dirección de giro: ¿se encuentran en adecuadas condiciones de uso?",
    "Extensiones eléctricas (si se van a usar): ¿se encuentran en buenas condiciones? Sin cables o conductores expuestos, enchufes en adecuadas condiciones.",
    "Orden y aseo: ¿el entorno de trabajo y la herramienta a utilizar cuentan con las condiciones de limpieza adecuadas?",
    "Trabajador: ¿está libre de objetos, accesorios, ropa, cabello suelto y otros elementos que puedan ser atrapados por partes móviles?"] },
  { titulo: "Equipo de soldadura", datos: ["Referencia del equipo a utilizar"], estado: "¿En qué estado se encuentran las ruedas? (sin fisuras, fracturas y/o deformaciones)", items: [
    "El equipo a utilizar: ¿cuenta con conexión a tierra y esta se encuentra conectada?",
    "Antorcha: ¿se encuentra en buen estado? (sin golpes) (aplica para equipo de soldadura MIG)",
    "Porta electrodos: ¿cuenta con apertura fácil y sujeción firme? (no aplica para equipo de soldadura MIG)",
    "Pinza porta masa: ¿cuenta con apertura fácil y sujeción firme? (aplica para equipo de soldadura MIG/revestida)",
    "Cables y conexiones del equipo: ¿se encuentran libres de empalmes, sin fatiga mecánica y sin conductores expuestos?",
    "Cilindros: ¿se encuentran en posición vertical, asegurados con cadena metálica y libres de fugas? (aplica para equipo de soldadura MIG)",
    "Cilindros: ¿cumplen con el estándar de identificación? (nombre del producto y rotulación NFPA o UN) (aplica para equipo de soldadura MIG)",
    "¿Se observa bloqueo visual en llaves de paso, válvulas y equipos?",
    "Interruptores: ¿permiten el funcionamiento sin obstrucción?",
    "Potenciómetros: ¿permiten el funcionamiento sin obstrucción?",
    "Mangueras de goma: ¿tienen grietas, globos, quemaduras, desgaste o pérdidas (fugas)?"] },
  { titulo: "Pulidora", datos: ["Referencia del equipo a utilizar"], items: [
    "Herramientas manuales de potencia: ¿se encuentran sin conexiones de arranque directo (tienen pulsadores de marcha y detención)?",
    "Herramienta: ¿cuenta con todas las guardas de seguridad?",
    "Herramienta: ¿el cable de conexión está sin deterioro, ni empalmes y/o conductores expuestos?",
    "Los discos: ¿son de cambio directo por desgaste excesivo según los parámetros definidos por el fabricante?",
    "Elementos de corte o pulido: ¿se inspeccionan antes de cada uso (desgaste, fisura, deformaciones y/o deterioro)?",
    "Sistema de ajuste de los discos: ¿corresponde a la herramienta y asegura el sistema?",
    "Discos: ¿corresponden a la tarea y son superiores a las RPM nominales de la herramienta?",
    "Trabajador: ¿está libre de objetos, accesorios, ropa, cabello suelto y otros elementos que puedan ser atrapados por partes móviles?",
    "Protecciones de seguridad: ¿se encuentran disponibles para evitar la proyección de partículas (mamparas)?"] },
  { titulo: "Oxicorte", datos: ["Referencia del equipo a utilizar"], items: [
    "Cilindros: ¿se encuentran en posición vertical, asegurados con cadena metálica y libres de fugas?",
    "Cilindros: ¿se encuentran libres de grasa?",
    "Mangueras de goma: ¿tienen grietas, globos, quemaduras, desgaste o pérdidas (fugas)?",
    "Válvulas: ¿permiten la apertura y cierre con facilidad?",
    "Sistemas de uniones y rosca: ¿están libres de óxido, golpes y/o fugas?",
    "Soplete: ¿tiene instalado el sistema antirretorno, permite regular la presión de los gases y está libre de fugas?",
    "Manómetros: ¿se encuentran en buenas condiciones?"] },
];
// Cierre (SÍ / NO): lo que declara el trabajador y lo que verifica el jefe del área de SST
const PERMISO_CIERRE = {
  trabajador: ["El trabajo ha sido terminado", "El sitio y los equipos quedan en condiciones seguras", "Entrego el área limpia y libre de desechos y materiales"],
  sst: ["El área queda limpia y libre de desechos y materiales", "Se ha terminado satisfactoriamente el trabajo", "El permiso de trabajo ha sido suspendido DEFINITIVAMENTE"],
};
