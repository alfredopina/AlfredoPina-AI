/*
  047 — Fecha de cancelación en las cuentas por cobrar

  Hasta ahora "cuándo se canceló" se deducía de fecha_estatus (el momento del último cambio de estatus). Las canceladas que vienen de la importación
  del Excel de Viri quedaron con la fecha de la importación, no la real. Esta columna guarda la fecha de cancelación de verdad:
    - al cancelar una cuenta desde el sitio se llena sola con el día de hoy (y se borra si se reabre);
    - en las canceladas históricas queda vacía (el Excel no la traía) y Viri la captura en la cuenta cuando la sepa.
  El reporte para el contador la muestra en su hoja "Canceladas del año". Sin retrocarga a propósito: nunca se inventa una fecha.

  Idempotente; correrlo ANTES de desplegar.
  Cómo correrlo: portal de Azure → apcweb-backoffice → Query editor (preview), pega y ejecuta este script completo.
*/

IF COL_LENGTH('CuentaPorCobrar', 'fecha_cancelacion') IS NULL ALTER TABLE CuentaPorCobrar ADD fecha_cancelacion DATE NULL;
GO
