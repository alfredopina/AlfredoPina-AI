-- alfredopina.ai — Backoffice SQL
-- Encuestas: el banco de preguntas se MUEVE de SQL a Table Storage
-- (2026-09-16, mismo criterio ya aplicado a Diagnóstico el 2026-09-13 con
-- sql/015 — ver CLAUDE.md → Encuestas). La base SQL serverless se auto-pausa
-- (20-60s) y eso podía dejar al primer alumno que abre el link en vivo
-- (durante la sesión de cierre) esperando o de plano sin poder entrar. Table
-- Storage nunca se pausa. Este script reemplaza a sql/003_encuestas.sql en lo
-- que toca a EncuestaPregunta (esa tabla YA NO EXISTE en SQL) — sql/003 se
-- deja tal cual en el repo como registro histórico, no se edita
-- retroactivamente.
--
-- EncuestaRespuesta/EncuestaRespuestaDetalle SE QUEDAN en SQL sin cambios de
-- fondo (siguen necesitando el FK real a Cliente para los reportes
-- cruzados) — solo pregunta_id pasa de INT a NVARCHAR(50), porque el id de
-- una pregunta ahora es un uuid de Table Storage, no un entero
-- autoincremental.
--
-- Cómo correrlo: portal de Azure → apcweb-backoffice → "Query editor
-- (preview)", pega y ejecuta completo. Seguro de volver a correr: si ya hay
-- respuestas reales guardadas, el script se detiene sin tocar nada (avisa
-- con RAISERROR) en vez de cambiar el tipo de columna a ciegas — en ese caso,
-- revisar a mano con Claude antes de continuar.

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EncuestaRespuestaDetalle')
   AND EXISTS (SELECT 1 FROM EncuestaRespuestaDetalle)
BEGIN
  RAISERROR('EncuestaRespuestaDetalle ya tiene datos reales — no se tocó nada. Revisa con Claude antes de correr este script.', 16, 1);
  RETURN;
END
GO

-- El UNIQUE (respuesta_id, pregunta_id) de sql/004_encuesta_constraint.sql
-- depende de pregunta_id — SQL Server no deja cambiar el tipo de una columna
-- con un constraint encima, hay que tirarlo antes y recrearlo después
-- (mismo patrón ya usado en sql/012/sql/016 con los DEFAULT de Grupo).
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_EncuestaRespuestaDetalle')
  ALTER TABLE EncuestaRespuestaDetalle DROP CONSTRAINT UQ_EncuestaRespuestaDetalle;
GO

-- pregunta_id ahora es el uuid (RowKey) de la tabla "EncuestaPreguntas" en
-- Table Storage — SIN FK a propósito, mismo criterio de siempre (ver
-- sql/003_encuestas.sql): si se borra una pregunta, las respuestas
-- históricas se conservan (solo pierden el texto al mostrarse).
ALTER TABLE EncuestaRespuestaDetalle ALTER COLUMN pregunta_id NVARCHAR(50) NOT NULL;
GO

ALTER TABLE EncuestaRespuestaDetalle
ADD CONSTRAINT UQ_EncuestaRespuestaDetalle UNIQUE (respuesta_id, pregunta_id);
GO

DROP TABLE IF EXISTS EncuestaPregunta;
GO
