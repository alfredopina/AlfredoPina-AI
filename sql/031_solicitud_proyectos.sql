-- 031: Proyectos elegidos en una Solicitud personalizada (foto de id/nombre/resumen). Idempotente; correr ANTES de desplegar.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Solicitud') AND name = 'proyectos_json')
  ALTER TABLE Solicitud ADD proyectos_json NVARCHAR(MAX) NULL;
GO
