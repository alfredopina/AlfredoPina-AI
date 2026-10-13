# ROADMAP — alfredopina.ai y automatización de Alfredo Piña

Rumbo del negocio y **única lista vigente de pendientes**. Manda sobre el orden de trabajo; `CLAUDE.md` solo trae reglas y estado, el detalle técnico vive en `docs/` (índice: `CLAUDE_DETALLE.md`) y los vencimientos en `VIGENCIAS.md`. Se reescribió el 2026-10-13 con el sitio ya funcional; la versión anterior (frentes 0 a 4 y la secuencia de sept-2026) quedó en el historial de git.

> Repositorio público: aquí no van cifras de ingresos ni datos de clientes.

## Misión

**Automatizar el negocio de Alfredo para vender más y crecer sus ingresos.** El sitio nació para estabilizar un negocio que dependía de mucho trabajo manual sin ningún control (cotizar, agendar, armar programas, dar seguimiento, cerrar cursos). El objetivo: que cada una de esas tareas pase de **horas a minutos**, para que Alfredo dedique su tiempo a **vender** y no a operar.

## Visión

Pasar de **una línea de negocio a varias** para tener ingresos más estables y, con el tiempo, pasivos. El sitio es el **punto de aterrizaje de la marca** y de cada estrategia de venta:

1. **Hoy:** cursos a **empresas** (la única línea que existe). Ya automatizada: solicitudes → cotizaciones → propuesta → grupo → cierre del curso.
2. **En construcción:** cursos **abiertos a profesionistas** (inscripción, cobro y lista de espera).
3. **Después, sin definir todavía:** más líneas que salgan de ahí — herramientas gratuitas en el sitio que conviertan visitas en ventas, productos digitales (¿PDFs?), quizás instructores. No hay mapa más allá de esto, y está bien: se decide con lo que enseñen las dos primeras.

Los **objetivos y metas de venta** se definen en otro chat (proyecto de estrategia); este sitio es la parte que libera la automatización.

## Brújula de vida

El negocio sostiene cinco pilares: **Vínculos y familia · Profesional · Espíritu y naturaleza · Cuerpo · Dinero**. El roadmap ataca el profesional para mejorar el financiero y **no puede costar los otros tres**. Sueño primero (6 h mínimo, 7 después); los cambios delicados (DNS, migraciones) se hacen temprano, no de madrugada; gimnasio, el cerro de los domingos y la familia se agendan como un curso; máximo 2 o 3 noches de construcción por semana. El detalle personal vive en un documento privado.

## Reglas de juego

1. **Lista de espera:** lo que se descubre construyendo va a la lista de espera; solo pasa a acción si **bloquea ventas o crea un riesgo real**.
2. **Congelamiento:** el plan de abajo es lo acordado; lo que se congela son las ideas nuevas fuera de él.
3. **Comprar, no construir,** lo regulado (timbrado SAT, cobro con tarjeta): se integra un proveedor.
4. **Preventa antes de producir:** los cursos nuevos se validan con 1 o 2 clientes antes de armar el temario completo.
5. **Medir antes de automatizar:** registro de tiempo por tarea para saber cuánto se ahorró.
6. Antes de un módulo nuevo, las 4 preguntas de `CLAUDE.md`.

## Dónde estamos (2026-10-13)

**El sitio es funcional y está completo en su alcance para la línea de empresas.** Está construido y desplegado: el recorrido público (temario → solicitud), Solicitudes, Cotizaciones con propuesta web y su tablero, Clientes, Grupos, Programas, Materiales y Presentaciones, Diagnósticos, Calificaciones, Diplomas con verificación pública, Encuestas, Alertas y notificaciones por correo, Configuración, Pendientes, el modelo de datos, la identidad de marca v2, los respaldos y el monitoreo de la base (ícono de estado y cuota). Diagnóstico y Encuesta se contestan solo por link/QR y, junto con la solicitud, escriben en colas que el admin importa: **el sitio público ya no despierta la base**. Detalle de cada módulo: `docs/`.

**Lo que falta no es construir el sitio de empresas, sino (a) las dos estrategias de venta de aquí a diciembre y (b) alimentarlo.** Hoy solo hay productos de **Excel** cargados.

## Macro: de aquí a diciembre

**Meta:** en diciembre el sitio opera **dos estrategias de venta claras, ya automatizadas**: cursos a empresas (hoy) y cursos abiertos.

### Próximas 2 a 3 semanas
- **Módulo de cursos abiertos** (grande; ver "Diseño pendiente" abajo): catálogo de cursos abiertos con fechas, página de inscripción, cobro y lista de espera. **Tiene fecha: debe estar listo antes de diciembre** para el valle de dic-ene. Arranca con una sesión de diseño en texto, no con código.
- **Módulo de facturación / cobranza** (diseño acordado 2026-10-08, abajo). Se construye cuando haya datos reales cargados; va ligado al cobro de los cursos abiertos.
- **Auditoría de software, a lo largo del mes.** Informes **00 (inventario) y 01 (control de acceso y API) hechos**; del 01 solo falta **A01-001: invertir las reglas de `staticwebapp.config.json`** (todo `/api/*` cerrado salvo las ~27 públicas; con prueba de humo de las 15 páginas y adaptar `api/test-regla-publico-sin-sql.js`) y luego el guardia `exigirAdmin` en código. Siguen los informes **02 a 12** (dependencias, CDN sin SRI y workflows; XSS y subidas de archivos; privacidad y legalidad; costos; rendimiento; deuda técnica y pruebas, entre otros) y la **CSP** (primero en modo solo-reporte). Seguimiento privado en `C:\Users\alfre\Documents\Auditoria\`.
- **Respaldos** (auditoría 2026-10-13, abajo): ampliar el respaldo a lo que hoy no cubre y probar una restauración de SQL.
- **Costos de Azure:** el presupuesto/alerta de $30 ya existe; al cierre de octubre Alfredo decide si lo baja. Medir cuánto tarda la base en dormirse (Azure reporta 60 min, se habían observado 20-30).

### Alimentar el sitio (conforme lo pidan los clientes)
- **Datos reales:** clientes, solicitudes, cotizaciones y programas; la primera cotización cronometrada contra la meta de ~5 minutos.
- **Productos de las otras herramientas** (Power BI, Power Apps, Power Automate, Ofimática, IA Aplicada), cada una con viaje · temas · proyectos · programas · materiales, y los **temarios** y **presentaciones** que faltan. Hoy solo Excel.
- **Bancos de preguntas:** 30 del Diagnóstico (15 Excel + 15 Power BI) y las 15 definitivas de la Encuesta.
- **Cotización de Proyectos** (cotizar proyectos, no solo programas).
- **Dashboard:** versión mínima primero (leads, cotizaciones pendientes, ingreso del mes contra meta, próximos cursos), completa después reutilizando los reportes de Diagnóstico y Encuestas; con **medición del sitio** (visitas y origen de las solicitudes; pospuesta desde 2026-09-10).

### Derivados que van saliendo
- **Centro de presentaciones** (fuera del repo, en Dropbox): sus herramientas (12 ideas aprobadas: equipos al azar, sorteo, plan de sesión primero…), quizzes, versiones por duración y la actualización de los cursos viejos de Power BI y Excel.
- **Herramientas públicas para vender más** (alimentan la visión): testimonios y logos con permiso, página de Conferencias, diagnóstico de nivel público con resultado inmediato, herramientas gratuitas (calculadora de horas ahorradas, "¿Tu Excel está listo para Power BI?", "La fórmula de la semana"…), ebooks como imán de prospectos (requiere dónde guardar correos y actualizar el aviso de privacidad). LinkedIn como canal principal, con una publicación semanal sacada del material de los cursos.
- **Kit de marca:** panel interno en `/admin`, PNG de logos, favicons y `og:image`, avatar y portada de LinkedIn y YouTube, plantillas de PowerPoint y Excel, firma de correo, fondos de Teams/Zoom.
- **Manuales nuevos en HTML por Programa** (empezar por Excel Básico-Intermedio), imprimibles a PDF, con contenido original y bibliografía verificada.
- **Base `DemoVentas`** para los cursos de Power BI (en un servidor nuevo en Central US, solo autenticación Entra).

## Macro: durante este año (sin urgencia, pero hay que resolverlos)

- **DC-3 y credenciales:** renovar las 4 certificaciones Associate y actualizar el registro **STPS** de persona física con todos los programas; con eso se desbloquea el **módulo DC-3** (investigación en `docs/dc3-stps.md`). Decidir el camino **MCT** con fecha límite.
- **Registro de marca (IMPI)** de "Alfredo Piña" / "alfredopina" y revisión de usuarios en redes.
- **Migración a Microsoft 365** después de los cursos de octubre: pasar los 5 buzones de Google Workspace a Exchange Online, alias `alfredo@alfredopina.ai` y cancelar Google solo después de auditar. Toca el buzón registrado en la STPS (`contacto@lifezen.com.mx`), el proveedor de las notificaciones y el DMARC (plan en `docs/confianza-dominio-correo.md`). **Decisión (2026-10-13):** `lifezen.com.mx` **sigue siendo la identidad principal de Alfredo** (login de `/admin`, suscripción de Azure, correo propio y otros negocios); `alfredopina.ai` es para la **marca** (alias `alfredo@` y, a futuro, buzones como `hola@` o el de notificaciones para clientes). Por eso el dominio y la licencia de `lifezen.com.mx` son críticos y deben estar en `VIGENCIAS.md`.
- **Dropbox → OneDrive** (el repo del sitio vive en una carpeta de Dropbox).
- **Revisión legal del Aviso de Privacidad y Términos** (siguen en V1) **antes de cargar datos personales reales**; los cursos abiertos suman datos de personas físicas y con DC-3 se agregan las CURP.
- **Confianza del dominio:** reclasificaciones por fabricante (Palo Alto cae solo por antigüedad), Google Business Profile, notificaciones de Search Console y Bing, y revisar su sección de Seguridad una vez al mes.
- **Acceso de Viridiana:** hoy es admin completa; cuando use facturación y cobranza, decidir qué puede ver y hacer (roles) y si hace falta una bitácora de quién cambia qué. Hoy todo depende de Alfredo (riesgo conocido y aceptado; cambiará cuando haya asistentes).
- **Plan de caja de 60 días** (cuentas por cobrar y cotizaciones abiertas con fecha de seguimiento): prioridad de negocio; las cifras van en una hoja privada.
- **Vigencias:** mantener `VIGENCIAS.md` al día y llenar sus filas pendientes (dominios, Microsoft 365, Google, Dropbox, certificaciones).
- **Menores:** borrar el grupo de recursos vacío `LifeZen` en Azure; probar el botón "Agregar a LinkedIn" con un diploma real, portada de la página y sumar a Viridiana.

## Diseño pendiente: cursos abiertos

Es la segunda línea de negocio y rompe un supuesto del modelo actual: **todo el sistema vende a empresas** (Cliente = empresa; no se modelan alumnos sueltos). Antes de construir hay que decidir, en una sesión de diseño en texto:
1. **Cobro:** proveedor de pagos (comprar, no construir) y cómo se concilia con la facturación.
2. **Facturación** de cada inscripción (persona física o empresa que paga por sus empleados).
3. **Quién es el inscrito:** hoy no existe la entidad Alumno; los cursos abiertos la necesitan (datos personales: aviso de privacidad y consentimiento).
4. **Grupo abierto:** cupo, fechas, modalidad (en línea / presencial), lista de espera y qué pasa si no se llena.
5. **Ciclo posterior:** confirmación y recordatorios por correo, diploma, encuesta y DC-3 cuando aplique, reembolsos y términos.
6. **Cómo se vende:** página pública de inscripción, y cómo se conecta con las herramientas gratuitas y LinkedIn.

## Cobranza y facturación — diseño acordado (2026-10-08)

Tracking de cuentas por cobrar que nace de una **Cotización ganada**, con semáforo por vencimiento (el plazo de gobierno cuenta desde el contra-recibo), pagos como filas y alertas. Viridiana factura con **Facturama** y lleva el control en un Excel (UUID, folio, RFC, razón social, uso CFDI, total, estatus, complemento de pago) que es la fuente a integrar. Integración por niveles: **1)** folio/UUID capturado en el sitio, **2)** lectura por API de Facturama, **3)** clientes sincronizados, **4)** timbrar desde el sitio (solo con botón explícito de Viri). Los correos de cobranza y los correos al cliente quedan **fuera hasta que Alfredo los pida**. Detalle en la memoria privada del proyecto.

## Respaldos — auditoría del 2026-10-13 (pendiente; Alfredo lo repasa con Claude con calma, no es urgente)

Qué se respalda **hoy**: el respaldo semanal copia **5 tablas** de Table Storage (`Cursos`, `Recursos`, `Temas`, `TemariosEstandar`, `Proyectos`) a un JSON en el contenedor `respaldos`. **No cubre:**
- **Contenido que Alfredo escribió y no se puede regenerar:** los bancos de preguntas (`DiagnosticoPreguntas`, `EncuestaPreguntas` y `EncuestaConfig`), los **Pendientes** (el corkboard), `ConfiguracionNotificaciones` (interruptores, destinatarios, umbrales), y los **links** que ya están en manos de clientes (`PropuestasCotizacion`, `EncuestaLinks`, `DiplomasVerif`, `DiplomasGrupo` y los reportes publicados): si se pierden, esos links y QR dejan de funcionar.
- **Los archivos (blobs):** plantilla y firmas de diplomas, materiales descargables, imágenes de preguntas, logos de intermediarios, fotos de grupo y presentaciones. Table Storage y los blobs no tienen restauración a un punto en el tiempo.
- **Las colas** (`SolicitudesPendientes`, `DiagnosticoPendientes`, `EncuestaPendientes`): viven pocos días, pero lo que esté pendiente de importar se pierde si la tabla se pierde.
- **SQL:** Azure guarda respaldos automáticos solo ~7 días; no hay copia fuera de Azure ni se ha probado nunca una restauración.

Propuesta (por decidir): (1) agregar al respaldo semanal las tablas de contenido y de links (cambio chico); (2) activar en el portal la **eliminación temporal (soft delete) y el versionado de blobs**; (3) subir la retención de SQL (hasta 35 días, centavos por el tamaño de la base) y **probar una restauración a una base nueva** una vez, para saber que funciona y cuánto tarda; (4) revisar si conviene una copia periódica de SQL a un blob.

## Después (2027)

- **Manual técnico del sistema (inicios de 2027):** un documento para entregar a un desarrollador que no estuvo aquí y que pueda entender y mantener todo sin depender de Alfredo ni de Claude. Debe cubrir con lenguaje técnico: arquitectura y diagrama de componentes; aplicaciones y recursos de Azure (Static Web App, Functions, Table Storage, SQL, Communication Services, app de Entra); dónde vive cada **llave, secreto y variable** y cómo rotarlos (nunca los valores); catálogo de las ~175 Functions con su ruta y acceso; modelo de datos y colas; cómo se despliega, se prueba y se revierte; las reglas técnicas y por qué existen; procedimientos de operación (respaldo, restauración, vencimientos); quién tiene acceso a qué; y cómo reconstruirlo desde cero. Parte de lo que ya existe y solo hay que consolidar: `RUNBOOK.md`, `VIGENCIAS.md`, `docs/` y el inventario de la auditoría. Es también la mejor cura del riesgo de que todo dependa de una sola persona.
- Seguir creciendo capacidades y **aterrizajes para otras estrategias de venta** (instructores, productos digitales, lo que enseñen las dos primeras líneas).
- **B2C**, cliente final, con un experimento pequeño antes de construir.
- **data-master:** empresa hermana, con identidad y datos separados.
- Retirar `by LifeZenTraining` del diploma hacia sept-2027.

## Lista de espera (no urgente)

- Separar el CSS/JS inline de `cursos.html`; correo `@alfredopina.ai` (ligado a la migración).
- Apex `alfredopina.ai` sin `www` (decidido dejarlo así); `npm audit` (decidido no tocarlo: 2 CVEs moderados no explotables aquí).
- Dominios adicionales (data-master.mx, quieroaprenderexcel.com, pixeco.com.mx): revisar SPF/DKIM/DMARC.
- Entidad Alumno para el resto del sistema (hoy nombre como texto en Diagnóstico/Diplomas/Encuestas); alertas de enviadas sin abrir, bitácora de estatus y buscador por folio en Cotizaciones.
- Link real de YouTube en el pie (no hay canal todavía).
- **Aviso cuando el sitio se cae:** el 2026-09-25 estuvo caído horas por una factura vencida y nada avisó. Un monitoreo de disponibilidad gratuito (una alerta de Azure o un servicio externo) que mande correo si `www.alfredopina.ai` deja de responder.
- **Probar cambios riesgosos antes de producción:** hoy cada push a `main` se despliega directo. Para cambios delicados (como la inversión de reglas de rutas) usar una rama con pull request, que Static Web Apps Free despliega en un entorno de vista previa.

## Decisiones ya tomadas (para no reabrirlas)

- **El resumen semanal de los lunes se queda:** es la única excepción a "nada público despierta la base" (1 despertar por semana, ≈ 8 % de la cuota).
- **Todos los scripts de `sql/`** (001 a 037) están corridos en producción.
- **Presupuesto de Azure en $30** por ahora; se revisa al cierre de octubre.

_Última actualización: 2026-10-13._
