/*
  043 — Cobranza: tipo de factura y nombre fiscal

  - tipo_factura: Empresa (retiene ISR 10 % + 2/3 del IVA) · Gobierno (solo ISR 10 %) · Anterior (sin retención, monto + IVA: así se
    facturaba antes) · Otro (facturas por cuenta de terceros, "favores": se guardan completas para el contador pero NO cuentan en las
    métricas internas ni en las alertas; solo para clientes de tipo Tercero, ver 044). NULL = aún sin clasificar (cuenta como cualquier otra).
  - razon_social: el nombre FISCAL de la factura (el que usa Viri); el nombre comercial es el Cliente del sitio.
  Idempotente; correrlo ANTES de desplegar.

  Cómo correrlo: portal de Azure → apcweb-backoffice → Query editor (preview), pega y ejecuta este script completo.
*/

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('CuentaPorCobrar') AND name = 'tipo_factura')
  ALTER TABLE CuentaPorCobrar ADD tipo_factura NVARCHAR(10) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('CuentaPorCobrar') AND name = 'razon_social')
  ALTER TABLE CuentaPorCobrar ADD razon_social NVARCHAR(200) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_CxC_tipo_factura')
  ALTER TABLE CuentaPorCobrar ADD CONSTRAINT CK_CxC_tipo_factura CHECK (tipo_factura IS NULL OR tipo_factura IN ('Empresa', 'Gobierno', 'Anterior', 'Otro'));
GO
