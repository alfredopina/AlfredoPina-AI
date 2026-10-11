/*
  036 — Relleno de fecha de alta para los clientes que ya existían

  Los clientes anteriores a sql/035 no tienen dato real de cuándo nacieron. En lugar de dejarlos vacíos se les pone la fecha de su
  PRIMERA INTERACCIÓN registrada (lo más antiguo entre su primer contacto, solicitud, cotización, grupo, diploma, respuesta de
  encuesta o de diagnóstico) y origen_alta = 'Anterior'. Es una aproximación y el admin la marca con "≈" y el origen "Anterior";
  un cliente sin ninguna interacción se queda en NULL ("—"). No toca a los que ya tienen fecha u origen (altas nuevas, que sí
  guardan su dato real). Idempotente: se puede correr más de una vez.

  Cómo correrlo: portal de Azure → apcweb-backoffice → Query editor (preview), pega y ejecuta este script completo.
*/

;WITH Primera AS (
  SELECT cliente_id, MIN(f) AS primera
  FROM (
    SELECT cliente_id, fecha_creacion AS f FROM Contacto
    UNION ALL SELECT cliente_id, fecha_creacion FROM Solicitud
    UNION ALL SELECT cliente_id, fecha_creacion FROM Cotizacion
    UNION ALL SELECT cliente_id, fecha_creacion FROM Grupo
    UNION ALL SELECT cliente_id, fecha_generacion FROM Diploma
    UNION ALL SELECT cliente_id, fecha_envio FROM EncuestaRespuesta
    UNION ALL SELECT cliente_id, fecha_envio FROM DiagnosticoRespuesta
  ) x
  GROUP BY cliente_id
)
UPDATE c
SET c.fecha_creacion = p.primera, c.origen_alta = 'Anterior'
FROM Cliente c
JOIN Primera p ON p.cliente_id = c.id
WHERE c.fecha_creacion IS NULL AND c.origen_alta IS NULL;
GO
