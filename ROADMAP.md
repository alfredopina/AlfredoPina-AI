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

## Frentes de trabajo

### Frente 0 — Cimientos (en curso)
Que no se caiga nada.
- **Plan de caja de 60 días (prioridad #1, esta semana):** lista de cuentas por cobrar (cliente, factura, monto, fecha, contacto, siguiente acción) y de cotizaciones abiertas con fecha de seguimiento; cobrar lo pendiente y reactivar prospectos antes de construir módulos nuevos. Las cifras van en una hoja privada, no aquí. Plan de deudas y ahorro: proyecto aparte en Claude Cowork, con un asesor financiero para los detalles.
- Confianza del dominio `alfredopina.ai`: reclasificaciones por fabricante, whitelist con TI de clientes, ficha PDF para TI. Palo Alto quita "dominio nuevo" ~2026-10-12.
- Correo y DNS de `lifezen.com.mx`: viernes 2026-09-25 mover DNS a GoDaddy con SPF/DKIM/DMARC (ver `CLAUDE_DETALLE.md` → "Correo y suite").
- Migración Google Workspace → Exchange Online (~2 semanas después), alias `alfredo@alfredopina.ai`, luego Dropbox → OneDrive.
- Pagar la factura vencida de Microsoft (G166761726).
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
- Marca: **un canal principal (LinkedIn)** con una publicación semanal sacada del material de los cursos; después YouTube, blog y boletín reciclando lo mismo.
- Oferta: cursos cortos nuevos, IA y habilidades blandas (con preventa), actualización de cursos y recursos existentes, certificaciones vigentes.
- **Microsoft Certified Trainer (MCT):** revisar requisitos del programa y ponerle fecha límite. Aparte, decidir si se quiere el camino de socio/revendedor.
- Conferencias.
- Estabilidad: contratos marco o anuales con empresas, programas por trimestre, cursos abiertos con fechas fijas, ingreso recurrente (coaching, mentoría, comunidad).
- Sitio: navegación, link a LinkedIn/YouTube, `og:image`, socios comerciales, identidad v2 en el resto.
- **Meta:** más demanda de la que hoy se sostiene manualmente.

### Frente 4 — Administración
Menos horas de oficina; se lleva en paralelo con Viridiana, sin urgencia.
- Facturación, cobranza y contabilidad (integrar proveedor, no construir).
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
