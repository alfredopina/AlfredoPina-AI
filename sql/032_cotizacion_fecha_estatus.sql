-- 032: Cotizacion.fecha_estatus = cuándo cambió por última vez de estatus (alimenta "Días en estatus" y la alerta de cotizaciones frías). Idempotente; correr completo ANTES de desplegar.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Cotizacion') AND name = 'fecha_estatus')
  ALTER TABLE Cotizacion ADD fecha_estatus DATETIME2 NULL;
GO

UPDATE Cotizacion
   SET fecha_estatus = CASE
         WHEN estatus IN ('Enviada', 'En negociación') THEN COALESCE(fecha_envio, fecha_creacion)
         WHEN estatus IN ('Ganada', 'Perdida') THEN COALESCE(CAST(fecha_cierre AS DATETIME2), fecha_creacion)
         ELSE fecha_creacion
       END
 WHERE fecha_estatus IS NULL;
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Cotizacion') AND name = 'fecha_estatus' AND is_nullable = 1)
  ALTER TABLE Cotizacion ALTER COLUMN fecha_estatus DATETIME2 NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_Cotizacion_fecha_estatus')
  ALTER TABLE Cotizacion ADD CONSTRAINT DF_Cotizacion_fecha_estatus DEFAULT SYSUTCDATETIME() FOR fecha_estatus;
GO
