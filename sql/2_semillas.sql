-- =====================================================================
--  Códigos de falla (Anexo de la Guía de formatos de operaciones)
--  Nota: la guía no trae el código 77.
-- =====================================================================
insert into public.codigos_falla (codigo, descripcion) values
(1,'Daño cortadora'),(2,'Descarrilamiento en formado'),(3,'Daño buril'),(4,'Alta frecuencia'),
(5,'Daño bomba'),(6,'Daño rodillos'),(7,'Limpieza mordaza'),(8,'Daño recogedor de chatarra'),
(9,'Falta de puente grúa'),(10,'Falta de material'),(11,'Falta de material por montacarga'),(12,'Falta de espacio'),
(13,'Puesta en marcha'),(14,'Calibrado de tubo'),(15,'Enhebrado de máquina'),(16,'Para por orden de gerencia'),
(17,'Demora por empalme en el floop'),(18,'Daño eléctrico'),(19,'Descanso personal'),(20,'Arrumada de mesa'),
(21,'Daño de rodamientos'),(22,'Limpieza de boquillas de metalizar'),(23,'Daño equipo metalizar'),(24,'Cambio de inductor'),
(25,'Ancho de banda mal'),(26,'Llenada de tanque de soluble'),(27,'Daño compresor'),(28,'Daño pulidora'),
(29,'Falta de personal'),(30,'Daño de bayoneta'),(31,'Tiempo trabajado'),(32,'Temperatura de agua destilada alta'),
(33,'Daño del desembobinador'),(34,'Engrasado de máquina'),(35,'Patronando cabeza de turca'),(36,'Falta de insumo'),
(37,'Daño motor'),(38,'Cambio de herramienta general'),(39,'Cambio herramienta parcial'),(40,'Limpieza de tanque soluble'),
(41,'Limpieza de carcamos'),(42,'Daño tubo refrigeración ferrita'),(43,'Cambio de ferrita'),(44,'Cambio de sierra'),
(45,'Fleje o lámina angosta'),(46,'Daño torre de enfriamiento'),(47,'Limpieza rodillo'),(48,'Daño pistola neumática de zunchado'),
(49,'Daño de bujes en bronce caja reductora'),(50,'Cambio de cabezas turcas'),(51,'Cambio de cabeza de soldaduras'),(52,'Cambio de canecas alambre de zinc'),
(53,'Corte eléctrico Codensa'),(54,'Daño estabilizador de corriente cortadora'),(55,'Daño rodillo impulsores en el floop'),(56,'Nivelar cortadora'),
(57,'Descarrilamiento en el floop'),(58,'Cuadre de máquina por calibrador de tubo'),(59,'Cambio de tubo refrigeración ferrita'),
(60,'Desgaste cuñas de la s brias de la cortadora'),  -- texto tal cual en la guía; confirmar
(61,'Daño caja reductoras'),(62,'Espesor lámina mal'),(63,'Pulir mordazas de cortadora'),(64,'Daño de bobinas'),
(65,'Montaje de herramienta del sistema W'),(66,'Daño equipo soldadura'),(67,'Daño polea del motor calibrado y formado'),(68,'Daño de polipasto del floop'),
(69,'Daño expulsor del tubo'),(70,'Personal prestado a otra bodega'),(71,'Daño rodamiento cabezas soldadura o turca'),(72,'Montaje de equipo para metalizar'),
(73,'Daño en coder'),(74,'Patronando cabeza de soldadura'),(75,'Aseo de área de trabajo'),(76,'Daño puente grúa'),
(78,'Caída de almacenamiento tubería'),(79,'Reempacar tubería por aboyadura'),(80,'Cuadre de ondulación en formado'),(81,'Cambio de receta cortadora'),
(82,'Daño buril externo'),(83,'Otros'),(84,'Daño en variadores'),(85,'Nivelar mesa de salida'),
(86,'Daño del tornillo de desembobinador'),(87,'Nivelar rodillos mesa de tanque de refrigeración'),(88,'Estrellada de tubo contra cortadora')
on conflict (codigo) do update set descripcion = excluded.descripcion;
