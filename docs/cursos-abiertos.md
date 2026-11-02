# Cursos Abiertos — diseño del módulo (2026-11-02)

Segunda estrategia de venta (junto a Cursos In Company): **grupos con fecha fija** a los que se inscriben profesionistas que pagan de su bolsa, o RH/jefes que inscriben de 1 a 3 colaboradores (piden factura y DC-3). Tráfico desde LinkedIn y correos, sobre todo en celular.

**Estado (2026-11-02):** **lado público construido, sin lanzar** (rama `feat/cursos-abiertos-sitio`, sin commit): página `/cursos-abiertos` (oculta: `noindex`, rótulo en el encabezado, sin pestaña en el menú), Functions públicas `calendarioAbiertos` (lee la foto), `reservarCursoAbierto` (contador atómico + cola) y `avisarCursoAbierto` (cola), `api/test-cursos-abiertos.js` y `tools/publicar-calendario.js` (publica la foto a mano mientras no exista el botón del admin). **Falta:** importar la cola al admin, Tracking Abiertos, "Publicar calendario" del admin, cuenta por cobrar y correos. **Para lanzar:** pestaña en `tools/build-layout.js` (`nav.active`), quitar `noindex`, `ejemplo:false` en la foto y tener la importación del admin (sin ella la cola se acumula sin atenderse). Mockups: mockup v1 hecho (`docs/mockups/cursos-abiertos.html` + `assets/data/cursos-abiertos-ejemplo.json`; datos ficticios, no envía nada). Este documento es el diseño del módulo real. **Nada del módulo está construido todavía.** Decisiones marcadas ⚠ esperan respuesta de Alfredo.

## Las 4 preguntas del CLAUDE.md

1. **¿Desde cuántos lugares se crea/edita/borra?**
   - *Grupo abierto:* solo desde el admin (Tracking Cursos Abiertos). No se borra: se cancela.
   - *Inscripción:* nace en el sitio público (cola) o por alta manual en el admin; se edita solo en el admin (pago, cancelación). No se borra.
   - *Lista de espera:* nace en el sitio público (cola) o alta manual; se marca "avisada" o "descartada". No se borra.
2. **¿Qué estados tiene?**
   - *Grupo (publicación):* `borrador → publicado → cancelado`. Además la fase de vida del Grupo ya existente (por iniciar, en curso, cerrado).
   - *Estados visibles* (abierto, últimos lugares, lleno, próximamente, grupo confirmado): **se derivan, no se guardan** (cupo, apartados, inscritos, mínimo, fechas).
   - *Inscripción:* `apartada → confirmada` · `apartada → vencida` · `apartada|confirmada → cancelada`.
   - *Pago:* `pendiente → pagado → reembolsado`, independiente del proveedor (hoy transferencia a mano; mañana un proveedor externo).
3. **¿Qué pasa si falla a la mitad?**
   - *Envío público:* reintentos con pausas (`[4000, 8000, 15000]`) y **clave de idempotencia** (misma clave = misma inscripción, nunca duplicada).
   - *Importación al admin:* cada elemento de la cola se importa por separado; si uno falla se queda en la cola (visible, con opción de descartar), nunca bloquea al resto.
   - *Reserva de lugar:* contador atómico (ver abajo). Si el contador y SQL se desfasan, **SQL manda** y el admin concilia al importar.
4. **¿Qué límite o costo tiene?**
   - Lo público **no despierta SQL** (regla del proyecto): lee una foto en Table Storage y escribe en una cola. Costo marginal ≈ 0.
   - Datos personales de personas físicas: **revisar Aviso de Privacidad y Términos antes de cargar datos reales** (ya está en ROADMAP).
   - Cupo: ver contador atómico.

## Vocabulario y modelo

- **Programa** = lo que se vende · **Grupo** = una impartición. Un **Grupo abierto** es un Grupo con `estrategia = 'abiertos'` y sin empresa.
- Sus inscritos son **Alumnos del grupo** (ya existen Grupo, Alumno, Calificación, Diploma y Encuesta).
- El pago se registra en **Cobranza** (alta manual; `CuentaPorCobrar.estrategia` ya acepta `'abiertos'`).

### Lo que ya existe y choca (hallazgo al revisar el SQL)

- `Grupo.cliente_id` es `NOT NULL` y `Alumno.cliente_id` es `NOT NULL`: todo el sistema asume "Cliente = empresa".
- `Grupo.sesiones` es **texto libre** (`013`), no hay fecha y hora por sesión. Los abiertos necesitan sesiones estructuradas (la página pública calcula fechas y horario de ahí).

### ⚠ Decisión A — qué Cliente tiene un Grupo abierto

- **Recomendado:** un Cliente reservado, "Cursos Abiertos (público)", para `Grupo.cliente_id`. No rompe ninguna consulta con INNER JOIN a Cliente y el Dashboard filtra por estrategia. Para `Alumno.cliente_id`: la **empresa que paga** si pagó la empresa (se crea como prospecto, ya existe ese concepto), y el Cliente reservado si pagó la persona.
- *Alternativa:* hacer `cliente_id` nullable en Grupo y Alumno. Es más "limpio" pero obliga a revisar todo JOIN y reporte; riesgo alto.
- *A verificar al construir:* que el diploma de un alumno de grupo abierto no muestre "Cursos Abiertos (público)" como empresa.

**Decisión A, resuelta al escribir el SQL (2026-11-02):** el Cliente reservado (`ABIERTOS`, "Cursos Abiertos (público)") es de tipo **Prospecto** a propósito. Ese tipo ya se excluye de las métricas de Clientes, del Dashboard y de los buscadores de Solicitud/Cotización/Grupo, así que no hay que tocar ~10 consultas ni se puede elegir por error en un curso In Company.

### Tablas nuevas o cambios (SQL, `sql/048_cursos_abiertos.sql`, ya escrito)

| Cambio | Para qué |
|---|---|
| `Grupo` + `estrategia`, `cupo_total`, `minimo_para_abrir`, `precio_persona`, `precio_preventa`, `preventa_hasta`, `modalidad_sede`, `publicacion` (`borrador/publicado/cancelado`), `resumen`, `temario_corto` (JSON), `programa_id` | Datos del grupo abierto. `modalidad` ya existe. |
| `GrupoSesion` (`grupo_id`, `inicio`, `fin`) | Sesiones con fecha y hora. `Grupo.fecha_inicio/fecha_fin` se calculan de aquí para abiertos. |
| `Inscripcion` (`id`, `grupo_id`, `alumno_id`, `estado`, `paga` yo/empresa, `requiere_factura`, `rfc`, `razon_social`, `estado_pago`, `proveedor_ref`, `apartado_hasta`, `utm_source/medium/campaign`, `clave_idempotencia` única, `cuenta_cobrar_id`, `creada`) | Une Alumno y Grupo; guarda el origen de la visita y la clave que impide duplicados. |
| `ListaEspera` (`nombre`, `correo`, `interes`, `paga`, `grupo_referencia`, `contexto`, `utm_*`, `clave_idempotencia` única, `estado`, `creada`) | Quién pidió aviso. Base del siguiente grupo. |
| `Alumno` + `whatsapp` (opcional) | Contacto de la persona. `correo` ya existe (`023`). |

*No se guarda* el estado visible (abierto/últimos/lleno/próximamente) ni "grupo confirmado": se calculan.

### Campos del Grupo abierto en la foto pública

La forma está en `assets/data/cursos-abiertos-ejemplo.json` (objeto `{ version, generado, ajustes, grupos[] }`). Campos: `codigo`, `programa_id`, `programa_nombre`, `herramienta`, `nivel`, `sesiones[{inicio,fin}]`, `mes_estimado` (si no hay fecha), `modalidad`, `sede`, `horas_totales`, `precio_persona`, `precio_preventa`, `preventa_hasta`, `cupo_total`, `inscritos_confirmados`, `apartados_sin_pago`, `minimo_para_abrir`, `publicacion`, `resumen`, `temario_corto[]`. `ajustes`: zona horaria, moneda, umbral de "últimos lugares", máximo de personas por inscripción, horas de vigencia del apartado, descuento de equipo (`desde_personas`, `porcentaje`), temas destacados y landing por herramienta. **La foto solo incluye grupos publicados** y ningún dato de personas.

## Flujo de punta a punta

1. **Admin** crea el grupo abierto (borrador), carga sesiones, cupo, precios y temario corto.
2. **Admin pulsa "Publicar calendario"**: escribe la foto en Table Storage (`apcwebrecursos`) y deja el contador del grupo (cupo y reservados).
3. **Sitio público** `/cursos-abiertos` lee la foto con una Function pública nueva (en `api/rutas-publicas.js`, luego `node tools/generar-rutas.js`; **sin `getPool()`**, lo vigila `test-regla-publico-sin-sql.js`).
4. **Visitante** se inscribe o pide aviso: la Function pública valida (campo trampa `web`, tiempo de llenado `tf`, correo/WhatsApp), reserva en el contador y deja el envío en la **cola** de Table Storage. Mismo patrón que Solicitud, Diagnóstico y Encuesta.
5. **Admin** importa la cola al abrir el panel o con "Importar ahora" (como `importarDiagnosticosPendientes`): crea Alumno(s) e Inscripción, y una **cuenta por cobrar** en Cobranza (estrategia `abiertos`) a nombre de la persona o la empresa.
6. **Pago**: se registra en Cobranza (alta manual). La inscripción pasa a `confirmada` y se republica la foto con los cupos al día.
7. **Después**: Calificaciones, Diploma (con QR, ya existe `/verificar`), Encuesta; DC-3 cuando aplique (`docs/dc3-stps.md`).

### ⚠ Decisión B — cupo y sobreventa (recomendado: contador atómico)

La foto se publica con retraso: dos personas pueden querer el último lugar a la vez. **Recomendado:** una entidad de Table Storage por grupo con `cupo_total` y `reservados`; cada reserva pública la actualiza con `If-Match` (ETag) y reintenta si hay choque. Si no hay lugares, rechaza con un mensaje claro y ofrece lista de espera. SQL concilia al importar. *Alternativa:* sin control en tiempo real y resolver a mano los casos raros (aceptable con pocos grupos, riesgoso en una campaña de LinkedIn).

### ⚠ Decisión C — apartados vencidos

**Recomendado:** al pasar `apartado_hasta` (48 h de ejemplo) la inscripción aparece como **vencida** con alerta en el admin; Alfredo decide si libera el lugar. *Alternativa:* liberar sola (puede quitarle el lugar a alguien que ya pagó y aún no se registra).

### ⚠ Decisión D — cuándo nace la cuenta por cobrar

**Recomendado:** al **importar** la inscripción (regla "alta manual" ya acordada), para no perder rastro de apartados sin pago. *Alternativa:* solo al confirmar el pago.

## Admin: Tracking "Abiertos" (grupo TRACKING, junto a Grupos; una palabra por ítem)

**Mockup:** `docs/mockups/tracking-cursos-abiertos.html` (pestañas Calendario · Inscripciones · Lista de espera, Vistas, filtros, semáforo, «Publicar calendario» y el formulario de Nuevo Grupo con el interruptor «¿Curso abierto?»).

**Alta del grupo (decisión de Alfredo 2026-11-02):** se hace en **Grupos → Nuevo Grupo**, con un quinto interruptor **«¿Curso abierto?»** junto a Cliente final, Más de 1 Grupo, Cotización e Histórico. Al activarlo: Cliente automático (Cursos Abiertos público), se apagan Cliente final, Más de 1 Grupo y Cotización, se elige un **Programa estándar** (de ahí salen herramienta, nivel y horas) y aparecen sesiones, modalidad/sede, cupo, mínimo, precios, preventa, temario corto y publicación, con vista previa del sitio. «Nuevo grupo abierto» del Tracking abre ese mismo formulario con el interruptor activado.

⚠ **Decisión E:** ¿el Tracking de Grupos muestra también los abiertos? Recomendado: sí, con un filtro Estrategia (por defecto Todas) para no duplicar la fase, los diplomas ni las calificaciones; Abiertos es la vista especializada (inscripciones, cupo, publicación).

Es Tracking y no solo un filtro de Grupos: tiene fase propia, urgencia que nadie más calcula y acciones directas.

- **Calendario:** lista de grupos con semáforo (rojo = no llega al mínimo y faltan 14 días o menos; ámbar = apartados vencidos, preventa que vence en 7 días o menos, o faltan 30 días o menos sin llegar al mínimo; verde-azulado = en orden; gris = borrador, sin fecha o impartido). Crear/editar, publicar, cancelar.
- **Inscripciones:** por grupo; alta manual, marcar pago, cancelar. Acciones con `confirmarAccion()`.
- **Lista de espera:** avisar, descartar, convertir en inscripción.
- Cada grupo enlaza a Diplomas, Calificaciones y Encuesta existentes.
- **Cola pendiente** visible con opción de descartar un envío atorado (excepción ya aprobada para colas).
- Dashboard: filtro por estrategia (`abiertos`) y "próximos cursos".

## Reglas que no hay que olvidar

- Lo público nunca llama a `getPool()` ni importa un módulo que lo haga.
- Todo código del admin que toque `apcweb-backoffice` usa `REINTENTO_PAUSAS_MS=[4000,8000,15000]` copiando un IIFE existente.
- Correos por `enviarCorreo({ tipo })` con tipo registrado en `api/src/notificaciones-ajustes.js` (confirmación de inscripción, recordatorios).
- Constancia DC-3: la misma redacción de la portada ("Registrado ante la STPS para expedir constancias DC-3"); no prometer más.
- Sin pago en línea por ahora (transferencia con instrucciones); el modelo guarda `estado_pago` y `proveedor_ref` para integrar un proveedor después.
- Repo público: sin datos de personas ni cifras de ingresos.
- Estados nunca solo por color (ícono + texto); `.clase[hidden]{display:none}`; `color-mix()` con long-hands.

**Avance 2026-11-02 (rama `feat/cursos-abiertos-modelo`):** SQL 048 escrito y corrido por Alfredo; backend admin hecho y probado (`api/test-grupo-abierto.js`): `crearGrupoAbierto`, `editarGrupoAbierto`, `getGruposAbiertosAdmin`, `publicarCalendarioAbiertos` (arma la foto desde SQL y concilia el contador con SQL + la cola). Nacen cerradas (solo admin). **Falta:** la pantalla (interruptor «¿Curso abierto?» en Grupos → Nuevo Grupo, Tracking Abiertos y botón Publicar), la importación de la cola y Cobranza/correos.

## Orden de construcción

1. **Modelo:** script SQL (Grupo, GrupoSesion, Inscripcion, ListaEspera, Alumno.whatsapp, Cliente reservado) + forma de la foto. Probado con `npm test`.
2. **Admin Calendario:** crear/editar grupo abierto y sesiones, publicar la foto.
3. **Función pública** que sirve la foto + página `/cursos-abiertos` real (el mockup convertido, `build-layout.js` con la pestaña).
4. **Cola, contador atómico, importación** e Inscripciones / Lista de espera.
5. **Cobranza y correos** (cuenta por cobrar, confirmación, recordatorios).
6. **Dashboard** (filtro por estrategia) y portada ("Ver calendario").

## Pendientes ligados

- Contenido real: temarios cortos, precios, sede, preventas, testimonios con permiso, redacción final de las preguntas frecuentes (hoy borrador en el mockup).
- Landing por herramienta (enlaces "Ver curso"; hoy rutas de ejemplo).
- Revisión legal del Aviso de Privacidad y Términos antes de datos reales; política de reembolso y de reposición de sesiones.
- Proveedor de pagos (más adelante, comprar no construir) y su conciliación con facturación.
