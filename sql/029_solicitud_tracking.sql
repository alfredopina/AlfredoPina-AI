-- 029: Tracking de Solicitudes. Idempotente; correr completo ANTES de desplegar. Detalle: CLAUDE_DETALLE.md
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Solicitud') AND name = 'fecha_estatus')
  ALTER TABLE Solicitud ADD fecha_estatus DATETIME2 NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Solicitud') AND name = 'creo_prospecto')
  ALTER TABLE Solicitud ADD creo_prospecto BIT NOT NULL CONSTRAINT DF_Solicitud_creo_prospecto DEFAULT 0;
GO

-- estatus: solo Nueva / Cotizada / Descartada
UPDATE Solicitud SET estatus = 'Nueva' WHERE estatus = 'En seguimiento';
UPDATE Solicitud SET estatus = 'Cotizada' WHERE estatus IN ('Ganada', 'Perdida');
GO

-- fecha_estatus de lo que todavía no la tiene
UPDATE s
   SET fecha_estatus = CASE
         WHEN s.estatus = 'Cotizada'
           THEN COALESCE((SELECT MIN(c.fecha_creacion) FROM Cotizacion c WHERE c.solicitud_id = s.id), s.fecha_creacion)
         ELSE s.fecha_creacion
       END
  FROM Solicitud s
 WHERE s.fecha_estatus IS NULL;
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Solicitud') AND name = 'fecha_estatus' AND is_nullable = 1)
BEGIN
  ALTER TABLE Solicitud ALTER COLUMN fecha_estatus DATETIME2 NOT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_Solicitud_fecha_estatus')
  ALTER TABLE Solicitud ADD CONSTRAINT DF_Solicitud_fecha_estatus DEFAULT SYSUTCDATETIME() FOR fecha_estatus;
GO

-- creo_prospecto histórico (aproximado, ver arriba): primera solicitud de cada empresa que hoy es Prospecto
UPDATE s
   SET creo_prospecto = 1
  FROM Solicitud s
  JOIN Cliente c ON c.id = s.cliente_id
 WHERE c.tipo_cliente = 'Prospecto'
   AND s.creo_prospecto = 0
   AND s.id = (SELECT MIN(s2.id) FROM Solicitud s2 WHERE s2.cliente_id = s.cliente_id)
   AND NOT EXISTS (SELECT 1 FROM Solicitud s3 WHERE s3.cliente_id = s.cliente_id AND s3.creo_prospecto = 1);
GO
