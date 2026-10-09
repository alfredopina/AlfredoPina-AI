-- 033: Motivo de pérdida de una Cotización (lista fija de la app) y nota opcional. Idempotente; correr completo ANTES de desplegar.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Cotizacion') AND name = 'motivo_perdida')
  ALTER TABLE Cotizacion ADD motivo_perdida NVARCHAR(40) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Cotizacion') AND name = 'nota_cierre')
  ALTER TABLE Cotizacion ADD nota_cierre NVARCHAR(500) NULL;
GO
