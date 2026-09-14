-- alfredopina.ai — Backoffice SQL
-- Diagnóstico: el banco de preguntas se MUEVE de SQL a Table Storage
-- (2026-09-13, ver CLAUDE.md → Diagnóstico) — la base SQL serverless se
-- auto-pausa (20-60s) y eso hacía que la primera persona en abrir el link en
-- vivo se desesperara o de plano no pudiera entrar. Table Storage nunca se
-- pausa. Este script reemplaza a sql/009_diagnostico.sql en lo que toca a
-- DiagnosticoPregunta (esa tabla YA NO EXISTE en SQL) — sql/009 se deja tal
-- cual en el repo como registro histórico, no se edita retroactivamente.
--
-- DiagnosticoRespuesta/DiagnosticoRespuestaDetalle SE QUEDAN en SQL sin
-- cambios de fondo (siguen necesitando el FK real a Cliente para los
-- reportes cruzados) — solo pregunta_id pasa de INT a NVARCHAR(50), porque
-- el id de una pregunta ahora es un uuid de Table Storage, no un entero
-- autoincremental.
--
-- Cómo correrlo: portal de Azure → apcweb-backoffice → "Query editor
-- (preview)", pega y ejecuta completo. Seguro de volver a correr: si ya hay
-- respuestas reales guardadas, el script se detiene sin tocar nada (avisa
-- con RAISERROR) en vez de borrar datos a ciegas — en ese caso, revisar a
-- mano con Claude antes de continuar. Si no hay datos (el caso esperado: el
-- banco real de preguntas nunca se cargó, ver "Pendientes de Alfredo"),
-- tira y recrea las 3 tablas limpias, siempre con el mismo resultado final.

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DiagnosticoRespuesta')
   AND EXISTS (SELECT 1 FROM DiagnosticoRespuesta)
BEGIN
  RAISERROR('DiagnosticoRespuesta ya tiene datos reales — no se tocó nada. Revisa con Claude antes de correr este script.', 16, 1);
  RETURN;
END
GO

IF OBJECT_ID('DiagnosticoRespuestaDetalle', 'U') IS NOT NULL DROP TABLE DiagnosticoRespuestaDetalle;
IF OBJECT_ID('DiagnosticoRespuesta', 'U') IS NOT NULL DROP TABLE DiagnosticoRespuesta;
IF OBJECT_ID('DiagnosticoPregunta', 'U') IS NOT NULL DROP TABLE DiagnosticoPregunta;
GO

CREATE TABLE DiagnosticoRespuesta (
  id INT IDENTITY(1,1) PRIMARY KEY,
  nombre NVARCHAR(200) NOT NULL,
  cliente_id INT NOT NULL,
  herramienta VARCHAR(20) NOT NULL,
  fecha_envio DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_DiagnosticoRespuesta_herramienta CHECK (herramienta IN ('excel', 'powerbi')),
  CONSTRAINT FK_DiagnosticoRespuesta_Cliente FOREIGN KEY (cliente_id) REFERENCES Cliente(id)
);
GO

-- pregunta_id ahora es el uuid (RowKey) de la tabla "DiagnosticoPreguntas" en
-- Table Storage — SIN FK a propósito, mismo criterio de siempre: si se borra
-- una pregunta, las respuestas históricas se conservan (solo pierden el
-- texto/imagen al mostrarse, no el hecho de haber acertado o no).
CREATE TABLE DiagnosticoRespuestaDetalle (
  id INT IDENTITY(1,1) PRIMARY KEY,
  respuesta_id INT NOT NULL,
  pregunta_id NVARCHAR(50) NOT NULL,
  nivel TINYINT NOT NULL,
  opcion_seleccionada CHAR(1) NOT NULL,
  fue_correcta BIT NOT NULL, -- foto al momento de responder, no se recalcula si la pregunta se edita después
  CONSTRAINT CK_DiagnosticoRespuestaDetalle_opcion CHECK (opcion_seleccionada IN ('A', 'B', 'C', 'D')),
  CONSTRAINT FK_DiagnosticoRespuestaDetalle_Respuesta FOREIGN KEY (respuesta_id) REFERENCES DiagnosticoRespuesta(id)
);
GO

CREATE INDEX IX_DiagnosticoRespuesta_cliente_id ON DiagnosticoRespuesta(cliente_id);
CREATE INDEX IX_DiagnosticoRespuestaDetalle_respuesta_id ON DiagnosticoRespuestaDetalle(respuesta_id);
GO
