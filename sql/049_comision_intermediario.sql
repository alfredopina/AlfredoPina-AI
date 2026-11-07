/*
  049 — Comisión del intermediario (Capacitanet cobra el 20 %)

  Un cliente tipo Intermediario puede llevar una comisión (comision_intermediario_pct): al ganar una cotización emitida a él, la cuenta por cobrar
  nace con el subtotal NETO (precio cotizado − comisión); el intermediario la descuenta en la factura que Alfredo le emite. Los demás intermediarios
  quedan sin comisión (NULL): ahí se respeta el monto cotizado. La cuenta guarda el porcentaje y el monto cotizado (comision_pct / comision_base) y una
  marca comision_revisada para que Viri confirme el cálculo. Las cuentas que ya existen NO se tocan. Idempotente; correrlo ANTES de desplegar.

  Cómo correrlo: portal de Azure → apcweb-backoffice → Query editor (preview), pega y ejecuta este script completo.
*/

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Cliente') AND name = 'comision_intermediario_pct')
  ALTER TABLE Cliente ADD comision_intermediario_pct DECIMAL(5,2) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('CuentaPorCobrar') AND name = 'comision_pct')
  ALTER TABLE CuentaPorCobrar ADD comision_pct DECIMAL(5,2) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('CuentaPorCobrar') AND name = 'comision_base')
  ALTER TABLE CuentaPorCobrar ADD comision_base DECIMAL(12,2) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('CuentaPorCobrar') AND name = 'comision_revisada')
  ALTER TABLE CuentaPorCobrar ADD comision_revisada BIT NOT NULL CONSTRAINT DF_CxC_comision_revisada DEFAULT 0;
GO

-- Capacitanet (código CAP): 20 %. Si su código es otro, se pone desde Clientes → editar el intermediario → "Comisión del intermediario (%)".
UPDATE Cliente SET comision_intermediario_pct = 20
WHERE codigo = 'CAP' AND tipo_cliente = 'Intermediario' AND comision_intermediario_pct IS NULL;
GO

SELECT id, nombre, codigo, tipo_cliente, comision_intermediario_pct FROM Cliente WHERE tipo_cliente = 'Intermediario';
GO
