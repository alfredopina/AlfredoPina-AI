-- 030: Solicitud personalizada con Objetivo, Alcance y Dirigido a. Idempotente; correr completo ANTES de desplegar.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Solicitud') AND name = 'objetivo')
  ALTER TABLE Solicitud ADD objetivo NVARCHAR(MAX) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Solicitud') AND name = 'alcance')
  ALTER TABLE Solicitud ADD alcance NVARCHAR(MAX) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Solicitud') AND name = 'dirigido_a')
  ALTER TABLE Solicitud ADD dirigido_a NVARCHAR(MAX) NULL;
GO
