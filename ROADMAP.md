# ROADMAP — Automatización de Alfredo Piña

Documento maestro del rumbo del negocio. Se creó el 2026-09-24 a partir de la conversación de Director de Proyecto. **Este archivo manda sobre el orden de trabajo**; `CLAUDE.md` solo apunta aquí y `CLAUDE_DETALLE.md` guarda el detalle técnico de cada módulo. Versión visual: artifact "Roadmap Alfredo Piña".

> Repositorio público: aquí no van cifras de ingresos ni datos de clientes.

## Norte

Automatizar la operación para **vender más y con menos variabilidad**, y dedicar el tiempo a lo que más valor tiene: conferencias, productividad, coaching y marca personal.

Dos dolores concretos que este roadmap debe resolver:
1. **Falta de tiempo.** De día se dan cursos; de noche se cotiza, agenda, escribe correos, arma programas y temarios, y se apagan urgencias comerciales.
2. **Variabilidad de ingresos** de un mes a otro. Las horas libres no la arreglan solas: se necesita visibilidad del pipeline y algo de ingreso recurrente.

## Brújula de vida

El negocio existe para sostener cinco pilares: **Vínculos y familia · Profesional · Espíritu y naturaleza · Cuerpo · Dinero**. El roadmap ataca el pilar profesional para mejorar el financiero, y **no puede costar los otros tres**. El detalle personal vive en un documento privado, no en este repositorio.

Lo que ya funcionó en el pilar del cuerpo es el método a copiar: **pocas acciones, una cifra que se mide cada semana y constancia diaria.** Más variables no significan más probabilidad si ninguna se termina.

### Límites de vida (propuesta, por confirmar horarios)
- **Sueño primero.** Meta: 6 horas como mínimo esta semana y 7 después. Una hora de cierre para el trabajo nocturno, salvo urgencia real. Los cambios delicados (DNS, migraciones) se hacen temprano, no de madrugada.
- **Innegociables:** gimnasio, el cerro los domingos y el tiempo en familia se agendan como si fueran un curso.
- **Tope de noches:** máximo 2 o 3 de construcción por semana.
- **Revisión semanal de 20 minutos** con tres cifras: dinero cobrado, cotizaciones abiertas y horas dormidas.
- **Alguien más en el circuito:** compartir el plan con la pareja y tener una o dos personas de confianza para desahogarse.

## Reglas de juego

1. **Lista de espera.** Todo lo que se descubre mientras se construye va a la lista de espera. Solo pasa a acción si **bloquea ventas o crea un riesgo real** (ejemplo: el dominio bloqueado por filtros corporativos).
2. **Tope de construcción:** máximo 2 o 3 noches por semana. El sistema no debe comerse las horas que debe liberar.
3. **Bloques protegidos** en el calendario para ventas y marca personal (2 por semana, como si fueran un curso). Las horas libres no se convierten solas en ventas.
4. **Medir antes de automatizar:** una semana de registro de tiempo por tarea (cotizar, agendar, correos, programas, temarios).
5. **Antes de construir un módulo nuevo**, contestar las 4 preguntas de `CLAUDE.md`.
6. **Comprar, no construir,** lo regulado (timbrado de facturas SAT: se integra un proveedor autorizado).
7. **Preventa antes de producir:** los cursos nuevos se validan con 1 o 2 clientes antes de armar el temario completo.

## Orden macro del sitio (acordado con Alfredo 2026-10-10 — manda sobre el resto de este documento para el SITIO)

**Hecho:** la sección comercial (Solicitudes, Cotizaciones, propuesta web, alertas y notificaciones por correo, Configuración cerrada). Solo falta subir datos reales.

**Pendientes del sitio, en este orden:**
1. Subir datos reales (clientes, solicitudes, cotizaciones, programas).
2. **Cotización de Proyectos** (cotizar proyectos, no solo programas).
3. **Materiales de Excel.**
4. **Módulo de facturación / cobranza** (diseño en la memoria privada del proyecto: Tracking de cuentas por cobrar + integración Facturama por niveles; el Excel de Viridiana es la fuente).
5. **Power BI:** viaje · temas · proyectos · programas · materiales.
6. **Dashboard** (mínimo primero: leads, cotizaciones pendientes, ingreso del mes contra meta, próximos cursos).
7. **Power Apps, Power Automate, Ofimática e IA Aplicada:** lo mismo de cada uno (viaje · temas · proyectos · programas · materiales).

**También en el check macro (agregados 2026-10-10; la ubicación es propuesta, Alfredo ajusta el orden):**
- **Antes del punto 1 (subir datos reales):** (a) **respaldo de los datos de SQL**: revisar cuántos días de retención tiene la base y **probar una restauración una vez** (el respaldo semanal solo cubre Table Storage); (b) **revisión legal del Aviso de Privacidad y Términos** (siguen en V1) antes de cargar datos personales reales; con DC-3 vienen además las CURP.
- **Cursos abiertos (estrategia 2 del coach, valle de dic-ene):** página de inscripción, cobro y lista de espera. Hoy el sitio no tiene nada que lo soporte. **Con fecha: debe estar listo antes de diciembre**, así que va justo después de la cotización de Proyectos (punto 2), no al final.
- **Con el punto 4 (facturación):** **acceso de Viridiana** — qué puede ver y hacer (roles; hoy es admin completa o nada), y decidir si hace falta la bitácora de quién cambia qué. Ella usará facturación y cobranza.
- **Con el punto 6 (dashboard):** **medición del sitio** (analítica de visitas y de dónde vienen las solicitudes; pospuesta desde 2026-09-10), para los indicadores semanales que pidió el coach.
- **Tareas de Alfredo que desbloquean cosas (no son construcción):** **DC-3 y credenciales** — renovar las 4 certificaciones Associate, actualizar su registro STPS de persona física con todos los programas, y pasar el archivo de Viridiana; después se construye el módulo DC-3. **Migración de correo a Microsoft 365** — después de los cursos de octubre; toca el buzón registrado en la STPS (`contacto@lifezen.com.mx`), el proveedor de las notificaciones y el DMARC.
- **Regla del congelamiento (por confirmar con Alfredo):** esta lista es el plan acordado; lo que se congela son las ideas nuevas fuera de ella.

**Inmediato después (bloque de endurecimiento):** auditoría de seguridad · limpieza · tier gratuito (límites de Azure: `staticwebapp.config.json` ya pesa ~14.5 de 20 KB, tamaño de la API, vCore-segundos) · memoria (CLAUDE.md y memoria del proyecto) · lo que salga de esas revisiones. Incluye el ícono de estado de la base de datos (pendiente 2026-10-11).

## Frentes de trabajo

### Frente 0 — Cimientos (en curso)
Que no se caiga nada.
- **Plan de caja de 60 días (prioridad #1, esta semana):** lista de cuentas por cobrar (cliente, factura, monto, fecha, contacto, siguiente acción) y de cotizaciones abiertas con fecha de seguimiento; cobrar lo pendiente y reactivar prospectos antes de construir módulos nuevos. Las cifras van en una hoja privada, no aquí. Plan de deudas y ahorro: proyecto aparte en Claude Cowork, con un asesor financiero para los detalles.
- Confianza del dominio `alfredopina.ai`: reclasificaciones por fabricante, whitelist con TI de clientes, ficha PDF para TI. Palo Alto quita "dominio nuevo" ~2026-10-12.
- Correo y DNS de `lifezen.com.mx`: viernes 2026-09-25 mover DNS a GoDaddy con SPF/DKIM/DMARC (ver `CLAUDE_DETALLE.md` → "Correo y suite").
- Migración Google Workspace → Exchange Online (~2 semanas después), alias `alfredo@alfredopina.ai`, luego Dropbox → OneDrive.
- **Calendario de pagos y vencimientos** (Azure, Microsoft 365, Google Workspace, dominios, Dropbox, OneDrive) con recordatorios, método de pago con saldo y cobro automático, y un segundo contacto de facturación. El 2026-09-25 una factura vencida de Azure deshabilitó la suscripción y tumbó el sitio unas horas.
- Accesos y respaldos ordenados (Viridiana como segunda admin).
- **Meta:** correo con SPF/DKIM/DMARC en PASS, dominio confiable, cero facturas vencidas.

### Frente 1 — Cerrar el ciclo del curso
Diagnóstico → Encuesta → Calificaciones → Diplomas → Reporte de resultados (y de ahí, siguiente curso recomendado).
- Pendiente: banco de 30 preguntas de Diagnóstico, 15 preguntas de Encuesta, Diplomas (formato cerrado), quitar creación de empresas en `generarDiplomas`, correr `sql/024`.
- El reporte de resultados y el diploma terminan con **recomendación del siguiente curso** = recompra automática.
- **Meta:** un curso completo de punta a punta sin tocar nada a mano.

### Frente 2 — Motor comercial (prioridad actual)
Aquí está el ahorro de horas y la estabilidad.
- Primer objetivo: **solicitud → cotización → correo → agenda en ~5 minutos**, con programa/temario generado desde el catálogo.
- Catálogo al 100%: programas, temarios, cursos y recursos (resolver Temario vs Curso).
- Solicitudes con tracking propio (semáforo + umbral), Proyectos, cotizaciones probadas en vivo, seguimiento y notificaciones, resumen semanal, botones de eliminar.
- **Dashboard:** versión mínima primero (leads abiertos, cotizaciones pendientes, ingreso del mes contra meta, próximos cursos); versión completa con históricos después, reutilizando los reportes de Diagnóstico y Encuestas.
- **Pipeline:** mantener visible cuánto hay cotizado y cuánto viene, para ver un mes flojo con semanas de anticipación.
- **Meta:** saber cuántos leads entran, cuántos se cotizan y cuántos cierran; bajar de horas nocturnas a mínimas.

### Frente 3 — Oferta y marca personal
Lo que hace crecer la demanda.
- Marca: **un canal principal (LinkedIn)** con una publicación semanal sacada del material de los cursos; después YouTube, blog y boletín reciclando lo mismo. **Proyecto de contenido en Claude Cowork** (chats por canal: LinkedIn, YouTube, cursos y conferencias); su documento de arranque es privado y vive fuera de este repositorio.
- Oferta: cursos cortos nuevos, IA y habilidades blandas (con preventa), actualización de cursos y recursos existentes, certificaciones vigentes.
- **Pendiente (anotado 2026-10-06, después del congelamiento del sitio): manuales nuevos en HTML por Programa**, con la identidad v2, imprimibles a PDF, contenido original (no copiar a Microsoft) y bibliografía con enlaces verificados a Microsoft Learn; archivos de práctica con datos ficticios. Reemplaza los PowerPoint de hace 10-15 años. Empezar por Excel Básico-Intermedio (molde para el resto); primero el manual del alumno. Falta que Alfredo pase el temario actual y diga con qué versión de Office/Power BI imparte.
- **Microsoft Certified Trainer (MCT):** revisar requisitos del programa y ponerle fecha límite. Aparte, decidir si se quiere el camino de socio/revendedor.
- Conferencias.
- Estabilidad: contratos marco o anuales con empresas, programas por trimestre, cursos abiertos con fechas fijas, ingreso recurrente (coaching, mentoría, comunidad).
- Sitio: navegación, link a LinkedIn/YouTube, `og:image`, socios comerciales, identidad v2 en el resto.
- **Sitio más completo (ideas acordadas 2026-09-26, sin prioridad frente al motor comercial):** (1) testimonios y logos de clientes con permiso, la prueba social más barata; (2) página de Conferencias con videos, temas, fotos reales y ficha descargable para organizadores; (3) Diagnóstico de nivel público con resultado inmediato y curso recomendado; (4) ebooks gratuitos como imanes de prospectos (requiere dónde guardar correos y actualizar el aviso de privacidad); (5) herramientas gratuitas: calculadora de horas ahorradas por automatizar, termómetro de productividad y balance de vida (reflexión, no diagnóstico médico), "¿Tu Excel está listo para Power BI?", "La fórmula de la semana" y muro de egresados con permiso; (6) fotos dentro de Conferencias y Conóceme, no como sección aparte; (7) blog: no por ahora, LinkedIn hace de blog y se muestran sus últimas publicaciones en el sitio. Sección de contacto: se dejó como está; agenda pública o reservas con Microsoft Bookings quedaron descartadas por ahora.
- **Meta:** más demanda de la que hoy se sostiene manualmente.

### Frente 4 — Administración
Menos horas de oficina; se lleva en paralelo con Viridiana, sin urgencia.
- Facturación, cobranza y contabilidad (integrar proveedor, no construir).
- **Cobranza (diseño acordado 2026-10-08; se construye ~2 semanas después de cerrar comercial y cursos abiertos, antes si hace falta para dic-ene):** Tracking de cuentas por cobrar que nace de una Cotización ganada, con semáforo por vencimiento (el plazo de gobierno cuenta desde el contra-recibo), pagos como filas y alertas. Viridiana factura con **Facturama** y lleva el control en un Excel (UUID, folio, RFC, razón social, uso CFDI, total, estatus, complemento de pago) que es la fuente a integrar. Integración por niveles: 1) folio/UUID capturado en el sitio, 2) lectura por API de Facturama, 3) clientes sincronizados, 4) timbrar desde el sitio (solo con botón explícito de Viri). Detalle en la memoria privada del proyecto.
- Consolidar nubes: hoy se pagan Dropbox, Google Drive y OneDrive.
- Inventario de activos: dominios, sitios, cuentas, marcas, licencias.
- **Meta:** un solo lugar para archivos y un inventario de todo lo que se paga.

### Después (2027)
- **B2C:** cliente final, con un experimento pequeño antes de construir.
- **data-master:** empresa hermana, con identidad y datos separados.

## Secuencia de las próximas semanas

| Cuándo | Qué |
|---|---|
| Esta semana | Cimientos (DNS, factura Microsoft), registro de horas por tarea |
| Semanas 2 a 4 | Cotización en 5 minutos, plantillas de correo, programas y temarios generados, seguimiento de solicitudes, dashboard mínimo |
| En paralelo, ligero | Una publicación de LinkedIn por semana; fecha límite de MCT |
| Hacia fin de año | Cursos nuevos con preventa, dashboard completo, bases de marca sólidas |

## Datos que faltan para medir el éxito

- Horas por tarea (registro de una semana).
- Leads por mes, cotizaciones enviadas, tasa de cierre.
- Ingresos por línea (cursos corporativos, consultoría, conferencias) y variación mes a mes.
- Meta a 12 meses (ingresos u horas libres por semana): **por definir con Alfredo**.

## Lista de espera (no urgente)

- Rol Lector en Azure para Viridiana; analítica de tráfico del sitio.
- Separar CSS/JS inline de `cursos.html`; centralizar `resolverCliente`.
- Auditoría de límites de Azure Static Web Apps al terminar Productos.
- Monitoreo de consumo de la base de datos dentro del sitio.
- Kit de marca (panel interno, PNG, plantillas de PowerPoint/Excel, firma de correo).
- IMPI: revisar registro de "Alfredo Piña".
- Apex `alfredopina.ai` sin `www` (decidido dejarlo así).
- Dominios adicionales (data-master.mx, quieroaprenderexcel.com, pixeco.com.mx): revisar SPF/DKIM/DMARC.
- `npm audit` (decidido no tocarlo).

_Última actualización: 2026-09-24._
