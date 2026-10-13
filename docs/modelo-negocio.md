# Modelo del negocio

> Los 3 pilares (Comercial / Producto / Operación) y decisiones de infraestructura de datos. Partido de `CLAUDE_DETALLE.md` el 2026-10-13 sin cambiar el texto (los encabezados `##` de abajo son los originales). Índice de todos los temas: `CLAUDE_DETALLE.md`.

---

## Modelo del negocio y roadmap estratégico — definido 2026-09-05, sesión de teorización

Alfredo identificó que, sin planearlo, ya está automatizando 3 roles de su negocio. Este modelo es el norte para ordenar todo lo que falta — antes de agregar un módulo nuevo, ubicarlo en uno de estos 3 pilares:

- **Comercial** (adquirir + cerrar venta): Landing, Cursos (catálogo público), Agenda, Solicitudes, Cotizaciones. Esto es, en la práctica, su CRM.
- **Producto / Catálogo** (plantillas de lo que vende, sin dueño/cliente): Cursos (Temarios), Recursos. Ya construidos.
- **Operación** (instancias de entrega, cada una le pertenece a un Cliente): Cliente (empresa — Alfredo solo vende a empresas, no modelar alumnos sueltos sin empresa), Grupo/Cohorte (instancia de un Temario entregada a un Cliente, con fase: *por arrancar → en curso → proyecto práctico → cerrado*), Alumno (persona, siempre bajo un Cliente), Instructor (Alfredo + 3 instructores externos ocasionales), **Diagnóstico** (nivelar el grupo por conocimiento previo — **corregido 2026-09-10**: la teoría original lo puso en Comercial asumiendo que calificaba leads antes de cotizar; el uso real de Alfredo es casi siempre post-venta, ya con el curso vendido, para dividir el grupo por nivel — a veces sí ayuda a vender, pero es la excepción, no la regla), Diploma, Encuesta.

**Nota importante sobre la fase "proyecto práctico"**: no es trámite administrativo, es una herramienta de venta. ~2 semanas después de terminar el curso, Alfredo hace una sesión de 1-2h donde los alumnos presentan un proyecto práctico que él dejó de tarea; él solo modera/da retro, y RH invita a jefes/decisores. Eso genera prueba social en vivo frente a quien decide la siguiente compra. Cuando se diseñe el Grupo a detalle, esta fase debe capturar más que un status: fecha, quién asistió como invitado, y una nota/resultado reusable como material de venta (cierra el círculo de vuelta hacia Comercial).

**Decisión de infraestructura — Azure SQL para este bloque nuevo, YA CONFIRMADA:** Cursos/Recursos se quedan en Table Storage (funcionan bien, aislados). Cliente/Solicitud/Cotización/Grupo/Alumno/Instructor/Diploma/Encuesta son una cadena genuinamente relacional (reportes cruzados: qué Cliente compró qué, qué Instructor califica mejor, conversión Solicitud→Cotización→Cierre) — ahí Table Storage sin JOINs sería doloroso. A la escala real del negocio (~150 clientes en 15 años, ~5 grupos/mes, ~15 alumnos/grupo) el volumen total es mínimo, una base Azure SQL tier Basic (~$5 USD/mes, 2GB) sobra sin subir de tier.

**Ajustado 2026-09-06 — base NUEVA, no reutilizar la existente:** la decisión original era reutilizar la base Basic que Alfredo ya paga (de un ejercicio viejo de Power BI), pero esa base vive en el grupo de recursos de LifeZen, no en `GR_AlfredoPina`. Se decidió mejor crear una base Azure SQL nueva **dentro de `GR_AlfredoPina`** (misma región Central US, mismo tier Basic ~$5 USD/mes) — así toda la infraestructura de alfredopina.ai queda junta, y si algún día Alfredo limpia/borra recursos viejos de LifeZen, no hay riesgo de tocar accidentalmente data real de negocio (Clientes, Alumnos, Diplomas). Costo mientras conviven ambas bases: ~$10 USD/mes total; Alfredo eventualmente eliminará la vieja (no urgente, es limpieza suya, no bloquea nada). Alfredo crea el servidor+base desde el portal (mismo patrón que ya usó para Storage Account/tablas — él da de alta el recurso, Claude construye sobre la cadena de conexión que resulte) y activa el firewall "Allow Azure services and resources to access this server".

