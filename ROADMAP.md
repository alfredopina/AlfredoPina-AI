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
- **Estructura del sitio (2026-10-25):** la página de cursos para grupos pasó a **Cursos In Company** (`/in-company`; `/cursos` redirige); los cursos abiertos serán **Cursos Abiertos** (`/cursos-abiertos`) y **Recursos** queda aparte, para las dos estrategias. Detalle en `docs/marca-y-sitio-publico.md`.
- **Cierre de la semana del 22 al 25 de oct (2026-10-25):** hechos el módulo de **Cobranza** (primera versión), **Cursos In Company** (`/in-company`), el lote de ajustes de la portada y el contacto, el tablero de Configuración, el aviso de costo de la base, todos los **viajes por herramienta actualizados y con al menos un programa cada uno**, y ajustes de cotizaciones paralelas (descartar una). Falta cargar más programas y temarios.
- **Semana del 26 de oct (acordado 2026-10-25, 6 frentes; Alfredo trabaja materiales y Teams hasta la sesión del martes 27, y retoma el sitio ese martes por la tarde; recordatorio programado):** **(1) afinar Cobranza hasta que quede fina**: Viridiana manda el histórico, corregir los errores de la importación de prueba, exportar la base y actualizar el Tracking View con cobranza; **(2) empezar Cursos Abiertos** (sesión de diseño en texto); **(3) cotización para Consultoría** (módulo pospuesto hace tiempo); **(4) los cambios pendientes del sitio público** (sección "Próxima vuelta del sitio público", abajo). **(5) el Dashboard** (Alfredo empieza a trabajarlo esta semana; versión mínima primero: leads, cotizaciones pendientes, ingreso del mes contra meta, próximos cursos; se alimenta de Cobranza y de la "estrategia" de cada registro). **(6) el cambio de "Ofimática Básica" a "Microsoft 365"** (abajo). **Los 5 primeros tienen el mismo peso por ahora y el sexto también va esta semana**: el martes por la tarde Alfredo define cuánto peso y en qué orden.
- **Módulo de cursos abiertos** (grande; ver "Diseño pendiente" abajo): catálogo de cursos abiertos con fechas, página de inscripción, cobro y lista de espera. **Tiene fecha: debe estar listo antes de diciembre** para el valle de dic-ene. Arranca con una sesión de diseño en texto, no con código, **la semana del 26 de octubre** (después de facturación).
- **Módulo de facturación / cobranza** (diseño acordado 2026-10-08, abajo; detalle en `docs/cobranza.md`): **fase 1 (libreta de cobros) construida el 2026-10-22, pendiente de que Alfredo corra `sql/040_cobranza.sql` y haga el push.** Tracking Cobranza en el sidebar, cuenta automática al ganar la cotización, alta manual, pagos, división en parcialidades, semáforo, alertas y métricas. **Falta:** la importación única del Excel de Viri (necesita la ruta del archivo; dry-run primero) y, más adelante, los niveles 2 a 4 de Facturama. Va ligado al cobro de los cursos abiertos.
- **Auditoría de software, a lo largo del mes.** Informes **00 (inventario) y 01 (control de acceso y API) hechos**; el 01 quedó **cerrado casi por completo**: **A01-001 (inversión de reglas de rutas) se hizo el 2026-10-14** — `/api/*` es solo admin por defecto y las 26 públicas viven en `api/rutas-publicas.js`; queda solo, opcional, el guardia `exigirAdmin` dentro del código de cada Function admin (segunda capa). Siguen los informes **02 a 12** (dependencias, CDN sin SRI y workflows; XSS y subidas de archivos; privacidad y legalidad; costos; rendimiento; deuda técnica y pruebas, entre otros) y la **CSP** (primero en modo solo-reporte). Seguimiento privado en `C:\Users\alfre\Documents\Auditoria\`.
- **Informe 02 de la auditoría (cadena de suministro) — PLAN LISTO, arranca el 2026-10-15**, en una rama con pull request y vista previa (mismo patrón de la inversión de reglas): **(1)** alojar en el propio sitio las 8 librerías de CDN que hoy se cargan sin verificación (gsap ×2 en cursos.html; html2canvas, jsPDF y JSZip en diplomas-grupo.html y el admin; Sortable y qr-code-styling en el admin) y las tipografías de Google (también evita que los firewalls de clientes rompan las páginas y que Google vea cada visita), **(2)** declarar `permissions` mínimos en los 4 workflows y actualizar `actions/checkout@v3`, **(3)** quitar la dependencia sin uso `@pdf-lib/fontkit` y revisar los 8 avisos moderados de `npm audit`, **(4)** fijar y confirmar la versión de Node del servidor (hoy no está declarada `platform.apiRuntime`; Node 20 ya venció en abril de 2026; probar antes en la vista previa), **(5)** opcional: separar `BACKUP_CRON_SECRET` en un secreto por cron. **Le toca a Alfredo:** activar la verificación en dos pasos y el candado de transferencia del dominio en GitHub, Azure/Microsoft, GoDaddy y Google (guardar los códigos de recuperación fuera de la computadora), el clic de "Dependabot security updates" en GitHub y, si se hace el punto 5, pegar los secretos nuevos en GitHub y Azure.
- **Respaldos** (auditoría 2026-10-13, abajo): ampliar el respaldo a lo que hoy no cubre y probar una restauración de SQL.
- **Costos de Azure:** el presupuesto/alerta de $30 ya existe; al cierre de octubre Alfredo decide si lo baja. Medir cuánto tarda la base en dormirse (Azure reporta 60 min, se habían observado 20-30).
- **Decisión de base de datos en diciembre (2026-10-21):** Alfredo prueba octubre y noviembre con la base serverless gratuita tal como está y **en diciembre decide si migra** a una base siempre despierta con precio fijo (Azure SQL modelo DTU: **Standard S0 ≈ $15/mes**, 10 DTU, 250 GB; Basic ≈ $5, 5 DTU, 2 GB; precios de terceros para East US, confirmar en la calculadora para Central US). Si migra, **se hace en diciembre**, no antes. Para decidir con datos, anotar al cierre de octubre y de noviembre: cuota restante y fecha en que se agotó (si se agotó), el "Costo estimado" de Estado del sistema contra Azure Cost Management, y cuántas veces se sintió la espera de despertar. Notas para ese día: S0 ≈ 0.1 núcleo, unas 5 a 10 veces menos potencia que la base actual despierta (0.5 a 1 núcleo); se prueba unos días y se mira el porcentaje de DTU en el portal (si toca 100 % seguido, subir a S1 ≈ $30, sin verificar); no hay conversión directa confirmada de la base gratuita (lo probable: base nueva y migrar datos); la cadena de conexión la pega Alfredo; la tarjeta de cuota, el botón Despertar y la regla "público sin SQL" dejarían de ser por costo (no estorban, no hace falta quitarlas).

### Próxima vuelta del sitio público (pedido 2026-10-25; ANTES de diseñar Cursos Abiertos)
- **Portada, tarjetas de herramientas:** "Ver cursos →" pasa a **"Ver temarios →"** (lleva a `/in-company#herramienta`); cuando exista Cursos Abiertos, un segundo enlace **"Ver calendario"** (a `/cursos-abiertos` de esa herramienta).
- **Portada:** nueva sección **"Cursos Abiertos"** con el calendario de próximas fechas (cuando se desarrolle; alimentada desde el admin, sin tocar código).
- **Portada:** un poco de espacio antes de la sección de LinkedIn (hoy queda pegada a las tarjetas de metodología).
- **Contacto:** quitar el teléfono; quedan **correo y WhatsApp** (`=CONTACTAR( correo , whatsapp )`). Quitar la fórmula **=CONTACTAR()** del hero.
- **Botón "Hablemos" del menú y etiqueta "HABLEMOS" del pie:** pasan a **Contactar** en estilo fórmula (propuesta de texto en el chat del 2026-10-25; Alfredo confirma).
- **Admin → grupo SITIO: panel "Personalizar" HECHO (2026-10-28)**: LinkedIn de la portada (se pega el código de inserción), contacto (correo y WhatsApp), perfiles y redes y un aviso del sitio con vencimiento; falta (después): testimonios y logos con permiso y el calendario de cursos abiertos. Detalle en `docs/marca-y-sitio-publico.md`.
- **Repaso del sitio público** (propuestas en el chat del 2026-10-25) para decidir qué entra antes del diseño de Cursos Abiertos.

### Próxima vuelta del sitio público (pedido 2026-10-25; ANTES de diseñar Cursos Abiertos)
- **HECHO 2026-10-25:** tarjetas de la portada y botón del hero ahora dicen **"Ver temarios →"**; teléfono fuera del contacto (queda `=CONTACTAR( correo , whatsapp )`); fórmula `=CONTACTAR()` fuera del hero; botón del menú **`☕ =CONTACTAR()`** y etiqueta del pie **CONTACTAR** (antes "Hablemos"); más espacio antes de LinkedIn.
- **Portada, tarjetas:** cuando exista Cursos Abiertos, segundo enlace **"Ver calendario"** (a `/cursos-abiertos` de esa herramienta).
- **Portada:** nueva sección **"Cursos Abiertos"** con el calendario de próximas fechas (cuando se desarrolle; alimentada desde el admin, sin tocar código).
- **Admin → grupo SITIO: panel "Personalizar" HECHO (2026-10-28)**: LinkedIn de la portada (se pega el código de inserción), contacto (correo y WhatsApp), perfiles y redes y un aviso del sitio con vencimiento; falta (después): testimonios y logos con permiso y el calendario de cursos abiertos. Detalle en `docs/marca-y-sitio-publico.md`.
- **Repaso del sitio público** (propuestas del chat del 2026-10-25), en este orden: **(1)** herramientas sin programa publicado en Cursos In Company dicen "en construcción": cambiarlo por "Cotiza un temario a la medida" con el formulario; **(2)** portada con dos puertas (empresa / profesionista); **(3)** revisión legal del Aviso de Privacidad antes de recibir inscripciones y pagos; y en paralelo autoalojar fuentes y librerías (auditoría 02), medición de visitas, cierres de Recursos hacia las dos estrategias, decidir el futuro de la Agenda y revisar el menú en celular.

### Cambio de herramienta: "Ofimática Básica" → "Microsoft 365" (decidido 2026-10-25 con el director comercial; semana del 26 de oct)
- **Fase A HECHA (2026-10-27):** nombre visible "Microsoft 365", ícono nuevo (cuatro cuadros 2×2, mismo naranja) y logo por herramienta en generadores, sitio, admin, propuesta, diploma y Centro de Presentaciones; el identificador interno `ofimatica` quedó igual (detalle y lista de archivos en `docs/marca-y-sitio-publico.md`). **Falta:** renombrar en admin → Programas los que digan "Ofimática"; reconstruir presentaciones y manuales ya hechos (`construir.cmd`, ícono viejo hasta entonces); decidir qué entra en Microsoft 365 antes de cargar más programas; Fase B (alias del identificador) opcional.
Mejor estrategia comercial; implica **muchos cambios, hay que hacerlo bien y por fases**. **Mapa de impacto** (≈45 archivos mencionan "ofimática"): identidad de marca (`MANUAL_IDENTIDAD.md`: nombre, color `#f97316` y tinta `#b8500a`, familia de íconos "mosaicos de la suite" y el logo por herramienta `assets/img/brand/herramientas/` e `iconos/`; se regeneran con `tools/build-iconos.js`, `build-logos.js`, `build-pngs.js`, `build-herramientas.js`); sitio público (menú `tools/build-layout.js`, portada, `cursos.html`, el viaje `viaje-ofi.js/css`, `recursos.html`, `cards.css`, agenda, diagnóstico, encuesta, reportes, diplomas, propuesta); admin (`admin/index.html`, catálogo de herramientas `api/src/herramientas.js`, propuestas `api/src/propuestas.js`, tarifa en SQL, centro de presentaciones); datos (Programas, Temas, Proyectos, Materiales en Table Storage); y los **materiales fuera del repo** (carpetas `Materialesofimatica…`, presentaciones, manuales, diplomas de los cursos de Teams) más la convención de nombres "Curso_ Nombre comercial (N hr)".
- **Recomendación de método:** **Fase A** = nombre visible, ícono e identidad en todo el sitio y el admin, y el nombre en los materiales nuevos. **El identificador interno `ofimatica` se queda igual** (SQL, Table Storage, `#ofimatica`, nombres de archivo): cambiarlo exige migrar datos y rompe enlaces, sin beneficio visible. **Fase B** (opcional, después): renombrar el identificador con un alias para que los enlaces viejos sigan funcionando.
- **Hacerlo ANTES de cargar más programas y materiales** de esta herramienta, para no rehacerlos. Decidir primero qué entra en "Microsoft 365" (Teams, Outlook, OneDrive, SharePoint, Word, PowerPoint…) y qué sigue en Excel o Power Platform, y si cambia el color, el ícono o el nombre corto del menú.

### Alimentar el sitio (conforme lo pidan los clientes)
- **Datos reales:** clientes, solicitudes, cotizaciones y programas; la primera cotización cronometrada contra la meta de ~5 minutos.
- **Productos de las otras herramientas** (Power BI, Power Apps, Power Automate, Ofimática, IA Aplicada), cada una con viaje · temas · proyectos · programas · materiales, y los **temarios** y **presentaciones** que faltan. Hoy hay productos de Excel; los **viajes de Excel** (rehecho 2026-10-23), **Power BI** (2026-10-14), **Ofimática Básica** (2026-10-22), **IA Aplicada** (2026-10-23), **Power Apps** y **Power Automate** (2026-10-23) ya están construidos (falta verlos en producción con sus programas cargados: sin programa estándar publicado la pestaña dice "en construcción" y no muestra el viaje).
- **Bancos de preguntas:** 30 del Diagnóstico (15 Excel + 15 Power BI) y las 15 definitivas de la Encuesta.
- **Cotización de Proyectos** (cotizar proyectos, no solo programas).
- **Dashboard → Resumen: HECHO 2026-10-29 (pendiente de que Alfredo lo pruebe con sesión real; detalle en `docs/dashboard.md`):** las 25 tarjetas de los 5 Trackings con valor, línea de 12 meses y comparación contra el mes anterior, filtros (mes · estrategia · tipo de cliente · herramienta) y foto diaria en Table Storage. **Falta:** dashboards de detalle por sección (Cobranza, Cotizaciones, Solicitudes, Grupos, Clientes; Encuestas/Diplomas/Calificaciones), **meta mensual** (Alfredo la define con estos datos; entonces la comparación se hace contra la meta), y la medición del sitio. Cuando existan los Cursos Abiertos hay que registrar la estrategia en Solicitudes/Cotizaciones/Grupos para activar ese filtro. **Dashboard (resto del plan original):** versión mínima primero (leads, cotizaciones pendientes, ingreso del mes contra meta, próximos cursos), completa después reutilizando los reportes de Diagnóstico y Encuestas; con **medición del sitio** (visitas y origen de las solicitudes; pospuesta desde 2026-09-10).

### Derivados que van saliendo
- **Centro de presentaciones** (fuera del repo, en Dropbox): sus herramientas (12 ideas aprobadas: equipos al azar, sorteo, plan de sesión primero…), quizzes, versiones por duración y la actualización de los cursos viejos de Power BI y Excel.
- **Materiales del curso de Teams** (fuera del repo): temas 1 a 3 en estándar v2 (presentación de 157 diapositivas y manual compacto); falta el acuerdo del tema 4, rehacer los temas 5 y 6 y subir la presentación al admin. El estándar y la dinámica de creación están en `docs/productos-materiales.md` → «Producción de materiales».
- **Herramientas públicas para vender más** (alimentan la visión): testimonios y logos con permiso, página de Conferencias, diagnóstico de nivel público con resultado inmediato, herramientas gratuitas (calculadora de horas ahorradas, "¿Tu Excel está listo para Power BI?", "La fórmula de la semana"…), ebooks como imán de prospectos (requiere dónde guardar correos y actualizar el aviso de privacidad). LinkedIn como canal principal, con una publicación semanal sacada del material de los cursos.
- **Kit de marca:** panel interno en `/admin`, PNG de logos, favicons y `og:image`, avatar y portada de LinkedIn y YouTube, plantillas de PowerPoint y Excel, firma de correo, fondos de Teams/Zoom.
- **Manuales nuevos en HTML por Programa** (empezar por Excel Básico-Intermedio), imprimibles a PDF, con contenido original y bibliografía verificada.
- **Base `DemoVentas`** para los cursos de Power BI (en un servidor nuevo en Central US, solo autenticación Entra).

## Macro: durante este año (sin urgencia, pero hay que resolverlos)

- **DC-3 y credenciales:** renovar las 4 certificaciones Associate y actualizar el registro **STPS** de persona física con todos los programas; con eso se desbloquea el **módulo DC-3** (investigación en `docs/dc3-stps.md`). Decidir el camino **MCT** con fecha límite.
- **Registro de marca (IMPI)** de "Alfredo Piña" / "alfredopina" y revisión de usuarios en redes.
- **Migración a Microsoft 365** después de los cursos de octubre: pasar los 5 buzones de Google Workspace a Exchange Online, alias `alfredo@alfredopina.ai` y cancelar Google solo después de auditar. Toca el buzón registrado en la STPS (`contacto@lifezen.com.mx`), el proveedor de las notificaciones y el DMARC (plan en `docs/confianza-dominio-correo.md`). **Antes de mover los MX:** publicar el SPF y las claves DKIM de Microsoft y mantener DMARC en `p=quarantine` (hoy ya está; **no subir a `reject`**, porque los clientes que reenvían tu correo, como ccmty, lo romperían: ver "Reportes DMARC" en ese documento). **Decisión (2026-10-13):** `lifezen.com.mx` **sigue siendo la identidad principal de Alfredo** (login de `/admin`, suscripción de Azure, correo propio y otros negocios); `alfredopina.ai` es para la **marca** (alias `alfredo@` y, a futuro, buzones como `hola@` o el de notificaciones para clientes). Por eso el dominio y la licencia de `lifezen.com.mx` son críticos y deben estar en `VIGENCIAS.md`.
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
- **Trackings con ventana emergente en vez de página (decisión de Alfredo 2026-10-22, no urgente):** Cobranza abre el detalle y el alta en ventanas emergentes y a Alfredo le gusta más (se ve mejor y es más simple). Llevar ese patrón a Solicitudes, Cotizaciones, Clientes y Grupos, donde hoy "crear" es una pestaña del panel. Antes, sesión de diseño en texto (qué se conserva de cada formulario).
- **Aviso por correo "nueva cuenta por cobrar" y destinatarios por aviso: HECHO 2026-10-25 (ver `docs/notificaciones-config.md`).** Sale a quien factura cuando nace una cuenta (cotización ganada, grupo nuevo o "generar su cuenta" en un grupo existente); cada aviso de Configuración → Notificaciones tiene su cuadro de destinatarios (vacío = el correo de siempre). **Pendiente (pedido de Alfredo 2026-10-25, para el martes 27): el correo "Cuenta nueva por facturar" debe mostrar el SUBTOTAL, sin IVA ni retenciones, tanto a Alfredo como a Viri** (Alfredo cotiza solo subtotal y Viri se encarga de IVA y retenciones al facturar). Hoy `notificarCuentaCobranza` muestra el total con IVA: cambiar a `subtotal` en `api/src/cobranza-aviso.js` / `api/src/notificaciones-correo.js` (y su texto "con IVA, antes de retenciones"), con su prueba en `api/test-avisos-destinos.js`. **Falta de Alfredo:** escribir el correo de Viri (y el suyo) en el cuadro de "Cuenta nueva por facturar".
- **Ventanas emergentes en Cobranza: HECHAS 2026-10-29 (ver `docs/cobranza.md`; las ven Alfredo y Viri, 1 vez cada 12 h, vencidas en una sola ventana).** Texto del pedido original: **(pedido de Alfredo 2026-10-25)** al entrar a Cobranza, por cada cuenta "Por facturar" una ventana pregunta "¿ya la facturaste?" (Sí, ya la facturé → captura folio/UUID/fecha y pasa a Facturada · Todavía no · Más tarde/Esc), **2 veces al día** (la regla de Grupos y Cotizaciones: 1 vez cada 12 h por navegador, guardado en `localStorage`), con resumen, contador "1 de N", botón **Seguimiento (N)** a demanda, marca en las filas e "Info". **Diferencia clave:** hoy las ventanas automáticas son solo de Alfredo (`window.ADMIN_ES_ALFREDO`); esta es para **Viri**. Decidir con Alfredo quién la ve (Viri sí; ¿Alfredo también?) y ajustar esa regla por Tracking.
- **Homologar el nombre de las estrategias: HECHO 2026-10-28** (lo visible dice "Cursos In company" y "Cursos Abiertos"; los valores internos `empresas` / `abiertos` no cambian). Falta, al importar, aceptar ambas formas y revisar si otro panel (Dashboard, Tracking View, Cursos Abiertos) usa otro nombre.
- **Reporte de Cobranza para el contador: HECHO 2026-10-29 (ver `docs/cobranza.md`; Excel con el formato original + datos nuevos, por periodo).** Texto del pedido original: **(botón "Exportar reporte", ya dibujado junto a "+ Nueva cuenta", sin función):** todas las facturas con nombre fiscal, RFC, subtotal, IVA, retenciones, total, fecha de pago y complemento; las de terceros (tipo Otro) incluidas. Falta definir el formato (Excel) y el rango de fechas con Alfredo.
- **Línea de cobros en Cobranza: HECHA 2026-10-28; tarjeta de Cobranza en Tracking View: HECHA 2026-10-29 (ver `docs/cobranza.md`).** Cobranza ya recuerda su vista (HECHO 2026-10-29). Falta de ese plan: revisar con Alfredo cómo se siente con datos reales.
- Link real de YouTube en el pie (no hay canal todavía).
- **Aviso cuando el sitio se cae:** el 2026-09-25 estuvo caído horas por una factura vencida y nada avisó. Un monitoreo de disponibilidad gratuito (una alerta de Azure o un servicio externo) que mande correo si `www.alfredopina.ai` deja de responder.
- **Probar cambios riesgosos antes de producción:** hoy cada push a `main` se despliega directo. Para cambios delicados (como la inversión de reglas de rutas) usar una rama con pull request, que Static Web Apps Free despliega en un entorno de vista previa.

## Decisiones ya tomadas (para no reabrirlas)

- **El resumen semanal de los lunes se queda:** es la única excepción a "nada público despierta la base" (1 despertar por semana, ≈ 8 % de la cuota).
- **Todos los scripts de `sql/`** (001 a 037) están corridos en producción.
- **Presupuesto de Azure en $30** por ahora; se revisa al cierre de octubre.
- **Base de datos: no se migra en octubre ni noviembre** (2026-10-21). Se prueba el esquema actual y la decisión de migrar a una base siempre despierta se toma en diciembre (ver "Costos de Azure" arriba).

_Última actualización: 2026-10-13._
