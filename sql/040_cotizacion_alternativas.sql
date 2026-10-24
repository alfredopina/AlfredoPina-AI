/*
  040 — Cotizaciones alternativas (una misma oportunidad con 2 o más cotizaciones)

  Un cliente pide, por ejemplo, 1 grupo y 2 grupos del mismo curso: se venderá UNA. Las cotizaciones se "vinculan" con el mismo
  alternativa_grupo (INT = id de la primera del grupo; NULL = sin alternativas). Cuando una se gana, las demás abiertas pasan solas a
  el estatus nuevo "Descartada" (no es una pérdida: no cuenta en la conversión ni en el pipeline). Idempotente; correrlo ANTES de desplegar.

  Cómo correrlo: portal de Azure → apcweb-backoffice → Query editor (preview), pega y ejecuta este script completo.
*/

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Cotizacion') AND name = 'alternativa_grupo')
  ALTER TABLE Cotizacion ADD alternativa_grupo INT NULL;
GO

-- el CHECK de estatus no conoce "Descartada": se vuelve a crear con ese valor (mismo nombre, mismos demás valores)
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Cotizacion_estatus' AND parent_object_id = OBJECT_ID('Cotizacion'))
  ALTER TABLE Cotizacion DROP CONSTRAINT CK_Cotizacion_estatus;
GO
ALTER TABLE Cotizacion ADD CONSTRAINT CK_Cotizacion_estatus
  CHECK (estatus IN ('Borrador', 'Enviada', 'En negociación', 'Ganada', 'Perdida', 'Expirada', 'Reemplazada', 'Descartada'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Cotizacion_alternativa_grupo' AND object_id = OBJECT_ID('Cotizacion'))
  CREATE INDEX IX_Cotizacion_alternativa_grupo ON Cotizacion(alternativa_grupo) WHERE alternativa_grupo IS NOT NULL;
GO
