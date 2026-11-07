/*
  050 — Concepto de las cuentas por cobrar automáticas = nombre del curso (opcional)

  Las cuentas que nacen de una cotización ganada traían como concepto "Cotización AP26-XXX-… — herramienta". Desde ahora el concepto es el NOMBRE del curso o
  proyecto y el folio se ve como subtítulo en Cobranza. Este script pone el nombre del curso en las cuentas automáticas que ya existen (solo las que todavía
  tienen el texto viejo; no toca montos, folios de factura ni cuentas que Viri ya renombró). Se puede correr cuando quieras; idempotente.

  Cómo correrlo: portal de Azure → apcweb-backoffice → Query editor (preview), pega y ejecuta este script completo.
*/

UPDATE x
SET concepto = LEFT(COALESCE(NULLIF(LTRIM(RTRIM(q.temario_nombre)), ''),
                             CASE WHEN q.temario_tipo = 'consultoria' THEN 'Proyecto de consultoría' ELSE 'Programa personalizado' END), 300)
FROM CuentaPorCobrar x
JOIN Cotizacion q ON q.id = x.cotizacion_id
WHERE x.origen = 'Automática' AND x.concepto LIKE 'Cotización %';
GO

SELECT x.id, x.concepto, q.folio FROM CuentaPorCobrar x JOIN Cotizacion q ON q.id = x.cotizacion_id WHERE x.origen = 'Automática';
GO
