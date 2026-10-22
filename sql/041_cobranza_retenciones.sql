/*
  041 — Retenciones en Cobranza

  Persona física con actividad empresarial: el cliente (persona moral o gobierno) puede RETENER ISR y/o IVA, así que lo que realmente
  se cobra es menos que subtotal + IVA. total = subtotal + iva − retencion_isr − retencion_iva (es el "Total" del CFDI; el saldo y los
  pagos se calculan contra este total). La cuenta automática nace con retenciones en 0; se capturan en el detalle al emitir la factura.
  Montos en pesos, ≥ 0. Idempotente; correrlo ANTES de desplegar.

  Cómo correrlo: portal de Azure → apcweb-backoffice → Query editor (preview), pega y ejecuta este script completo.
*/

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('CuentaPorCobrar') AND name = 'retencion_isr')
  ALTER TABLE CuentaPorCobrar ADD retencion_isr DECIMAL(12,2) NOT NULL CONSTRAINT DF_CxC_retencion_isr DEFAULT 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('CuentaPorCobrar') AND name = 'retencion_iva')
  ALTER TABLE CuentaPorCobrar ADD retencion_iva DECIMAL(12,2) NOT NULL CONSTRAINT DF_CxC_retencion_iva DEFAULT 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_CxC_retenciones')
  ALTER TABLE CuentaPorCobrar ADD CONSTRAINT CK_CxC_retenciones CHECK (retencion_isr >= 0 AND retencion_iva >= 0);
GO
