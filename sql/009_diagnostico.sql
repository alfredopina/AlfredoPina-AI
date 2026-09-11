-- alfredopina.ai — Backoffice SQL
-- Diagnóstico (Fase 2 — Operación, ver CLAUDE.md → "Modelo del negocio y
-- roadmap estratégico"): reemplaza el Google Forms actual de Alfredo para
-- nivelar un grupo por conocimiento previo. Corre sobre la misma base
-- apcweb-backoffice que ya usan Diplomas/Encuestas/Comercial — reusa la
-- tabla Cliente que Diplomas ya creó, no se vuelve a crear aquí.
--
-- Cómo correrlo: portal de Azure → apcweb-backoffice → "Query editor (preview)"
-- (o SSMS/Azure Data Studio), pega y ejecuta este script completo. Es seguro
-- volver a correrlo aunque ya se haya ejecutado parcialmente — cada CREATE
-- TABLE está envuelto en un IF NOT EXISTS.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DiagnosticoPregunta')
BEGIN
  CREATE TABLE DiagnosticoPregunta (
    id INT IDENTITY(1,1) PRIMARY KEY,
    herramienta VARCHAR(20) NOT NULL,
    nivel TINYINT NOT NULL, -- 1 Básico, 2 Intermedio, 3 Avanzado
    texto NVARCHAR(500) NOT NULL,
    imagen_url NVARCHAR(500) NOT NULL,
    opcion_a NVARCHAR(300) NOT NULL,
    opcion_b NVARCHAR(300) NOT NULL,
    opcion_c NVARCHAR(300) NOT NULL,
    opcion_d NVARCHAR(300) NOT NULL,
    opcion_correcta CHAR(1) NOT NULL,
    orden INT NOT NULL DEFAULT 0,
    activa BIT NOT NULL DEFAULT 1,
    fecha_creacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_DiagnosticoPregunta_herramienta CHECK (herramienta IN ('excel', 'powerbi')),
    CONSTRAINT CK_DiagnosticoPregunta_nivel CHECK (nivel IN (1, 2, 3)),
    CONSTRAINT CK_DiagnosticoPregunta_opcion_correcta CHECK (opcion_correcta IN ('A', 'B', 'C', 'D'))
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DiagnosticoRespuesta')
BEGIN
  CREATE TABLE DiagnosticoRespuesta (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(200) NOT NULL,
    cliente_id INT NOT NULL,
    herramienta VARCHAR(20) NOT NULL,
    fecha_envio DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_DiagnosticoRespuesta_herramienta CHECK (herramienta IN ('excel', 'powerbi')),
    CONSTRAINT FK_DiagnosticoRespuesta_Cliente FOREIGN KEY (cliente_id) REFERENCES Cliente(id)
  );
END
GO

-- pregunta_id SIN FK a propósito, mismo criterio que EncuestaRespuestaDetalle:
-- si se borra una pregunta, las respuestas históricas se conservan (solo
-- pierden el texto/imagen al mostrarse, no el hecho de haber acertado o no).
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DiagnosticoRespuestaDetalle')
BEGIN
  CREATE TABLE DiagnosticoRespuestaDetalle (
    id INT IDENTITY(1,1) PRIMARY KEY,
    respuesta_id INT NOT NULL,
    pregunta_id INT NOT NULL,
    nivel TINYINT NOT NULL,
    opcion_seleccionada CHAR(1) NOT NULL,
    fue_correcta BIT NOT NULL, -- foto al momento de responder, no se recalcula si la pregunta se edita después
    CONSTRAINT CK_DiagnosticoRespuestaDetalle_opcion CHECK (opcion_seleccionada IN ('A', 'B', 'C', 'D')),
    CONSTRAINT FK_DiagnosticoRespuestaDetalle_Respuesta FOREIGN KEY (respuesta_id) REFERENCES DiagnosticoRespuesta(id)
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DiagnosticoRespuesta_cliente_id')
  CREATE INDEX IX_DiagnosticoRespuesta_cliente_id ON DiagnosticoRespuesta(cliente_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DiagnosticoRespuestaDetalle_respuesta_id')
  CREATE INDEX IX_DiagnosticoRespuestaDetalle_respuesta_id ON DiagnosticoRespuestaDetalle(respuesta_id);
GO
