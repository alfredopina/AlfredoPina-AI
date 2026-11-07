/*
  CONSULTA DE SOLO LECTURA — no modifica nada. (2026-11-07)

  Regla nueva de Calificaciones (api/src/calificaciones-calc.js):
    cumple proyecto   = Proyecto + Puntos >= 80
    cumple asistencia = Asistencias / Frecuencias >= 80 %
    Aprobado = cumple las dos · Participó = cumple solo una · No Aprobado = ninguna
  Antes bastaba Calificación >= 80 (80 % Proyecto + 20 % Asistencia + Puntos), así que se podía aprobar solo con el proyecto.

  El resultado se GUARDA al cargar las calificaciones de un grupo (foto): los grupos ya cargados conservan el resultado
  de la regla vieja hasta que se vuelvan a cargar. Esta consulta lista a quién le cambiaría el resultado, para decidir
  qué grupos se recargan (los diplomas ya emitidos NO cambian solos).

  Cómo correrla: portal de Azure → apcweb-backoffice → Editor de consultas, pega y ejecuta. Son dos resultados:
  (1) resumen por tipo de cambio y (2) detalle por alumno.
*/

;WITH base AS (
  SELECT c.id, c.grupo_id, c.alumno_id, c.proyecto, c.puntos, c.asistencias, c.frecuencias, c.calificacion, c.resultado AS resultado_guardado,
         -- mismas cuentas que el servidor: décimas de punto, ya redondeadas a 1 decimal
         ROUND(10.0 * (ISNULL(c.proyecto, 0) + ISNULL(c.puntos, 0)), 0) AS proy_puntos10,
         ROUND(1000.0 * c.asistencias / NULLIF(c.frecuencias, 0), 0) AS asist_pct10
    FROM Calificacion c
   WHERE c.frecuencias IS NOT NULL AND c.frecuencias > 0 AND c.asistencias IS NOT NULL
), nuevo AS (
  SELECT b.*,
         CASE WHEN b.proy_puntos10 >= 800 THEN 1 ELSE 0 END AS cumple_proyecto,
         CASE WHEN b.asist_pct10 >= 800 THEN 1 ELSE 0 END AS cumple_asistencia
    FROM base b
), resultado AS (
  SELECT n.*,
         CASE WHEN n.cumple_proyecto = 1 AND n.cumple_asistencia = 1 THEN N'Aprobado'
              WHEN n.cumple_proyecto = 1 OR n.cumple_asistencia = 1 THEN N'Participó'
              ELSE N'No Aprobado' END AS resultado_nuevo
    FROM nuevo n
)
-- (1) resumen: cuántos alumnos cambian y de qué a qué
SELECT r.resultado_guardado AS [resultado hoy], r.resultado_nuevo AS [resultado con la regla nueva], COUNT(*) AS alumnos
  FROM resultado r
 WHERE r.resultado_guardado <> r.resultado_nuevo
 GROUP BY r.resultado_guardado, r.resultado_nuevo
 ORDER BY alumnos DESC;

;WITH base AS (
  SELECT c.id, c.grupo_id, c.alumno_id, c.proyecto, c.puntos, c.asistencias, c.frecuencias, c.calificacion, c.resultado AS resultado_guardado,
         ROUND(10.0 * (ISNULL(c.proyecto, 0) + ISNULL(c.puntos, 0)), 0) AS proy_puntos10,
         ROUND(1000.0 * c.asistencias / NULLIF(c.frecuencias, 0), 0) AS asist_pct10
    FROM Calificacion c
   WHERE c.frecuencias IS NOT NULL AND c.frecuencias > 0 AND c.asistencias IS NOT NULL
), resultado AS (
  SELECT b.*,
         CASE WHEN b.proy_puntos10 >= 800 AND b.asist_pct10 >= 800 THEN N'Aprobado'
              WHEN b.proy_puntos10 >= 800 OR b.asist_pct10 >= 800 THEN N'Participó'
              ELSE N'No Aprobado' END AS resultado_nuevo
    FROM base b
)
-- (2) detalle por alumno (los grupos más recientes primero)
SELECT g.id AS grupo_id, g.grupo_codigo, g.nombre_curso, a.nombre_completo AS alumno,
       r.proyecto, r.puntos, r.asistencias, r.frecuencias,
       CAST(r.asist_pct10 / 10.0 AS DECIMAL(5,1)) AS [asistencia %],
       r.calificacion, r.resultado_guardado AS [resultado hoy], r.resultado_nuevo AS [resultado con la regla nueva]
  FROM resultado r
  JOIN Alumno a ON a.id = r.alumno_id
  JOIN Grupo g ON g.id = r.grupo_id
 WHERE r.resultado_guardado <> r.resultado_nuevo
 ORDER BY g.id DESC, a.nombre_completo;
