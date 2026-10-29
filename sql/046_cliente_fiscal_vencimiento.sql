/*
  046 — Datos fiscales y de cobro en Clientes + fecha de vencimiento manual en Cobranza

  1) Cliente: nombre fiscal, RFC, plazo de pago (días) y tipo de factura por defecto. Solo aplican a Directo, Intermediario y Tercero (el sitio
     no los pide a Prospecto ni a Indirecto, pero la columna es la misma). Toda cuenta por cobrar nueva (manual, de cotización o de grupo) nace
     con esos datos ya puestos; Viri los corrige en la cuenta si hace falta. Todo es opcional (NULL = no capturado).
  2) CuentaPorCobrar.vencimiento_manual: algunos clientes no pagan "a N días" sino un día fijo del mes (p. ej. los 20). Si hay fecha manual,
     el vencimiento es esa fecha; si no, sigue siendo inicio del plazo + días de plazo. La columna calculada `vencimiento` (la que usan el
     semáforo, las alertas y la Línea de cobros) pasa a ser COALESCE(vencimiento_manual, inicio_plazo + plazo_dias).

  Idempotente; correrlo ANTES de desplegar.
  Cómo correrlo: portal de Azure → apcweb-backoffice → Query editor (preview), pega y ejecuta este script completo.
*/

IF COL_LENGTH('Cliente', 'razon_social') IS NULL ALTER TABLE Cliente ADD razon_social NVARCHAR(200) NULL;
IF COL_LENGTH('Cliente', 'rfc') IS NULL ALTER TABLE Cliente ADD rfc NVARCHAR(15) NULL;
IF COL_LENGTH('Cliente', 'plazo_pago_dias') IS NULL ALTER TABLE Cliente ADD plazo_pago_dias INT NULL;
IF COL_LENGTH('Cliente', 'tipo_factura_default') IS NULL ALTER TABLE Cliente ADD tipo_factura_default NVARCHAR(10) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Cliente_plazo_pago')
  ALTER TABLE Cliente ADD CONSTRAINT CK_Cliente_plazo_pago CHECK (plazo_pago_dias IS NULL OR plazo_pago_dias BETWEEN 0 AND 365);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Cliente_tipo_factura_default')
  ALTER TABLE Cliente ADD CONSTRAINT CK_Cliente_tipo_factura_default CHECK (tipo_factura_default IS NULL OR tipo_factura_default IN ('Empresa', 'Gobierno', 'Anterior'));
GO

IF COL_LENGTH('CuentaPorCobrar', 'vencimiento_manual') IS NULL ALTER TABLE CuentaPorCobrar ADD vencimiento_manual DATE NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.computed_columns WHERE object_id = OBJECT_ID('CuentaPorCobrar') AND name = 'vencimiento' AND definition LIKE '%vencimiento_manual%')
BEGIN
  ALTER TABLE CuentaPorCobrar DROP COLUMN vencimiento;
  EXEC('ALTER TABLE CuentaPorCobrar ADD vencimiento AS COALESCE(vencimiento_manual, DATEADD(day, plazo_dias, inicio_plazo))');
END
GO
