-- alfredopina.ai — Backoffice SQL
-- Encuestas Fase 2: llave anti-duplicado por envío.
--
-- Por qué: encuesta.html reintenta el envío (3 veces, con pausas) cuando el
-- primer intento falla por red/timeout. Si el servidor SÍ alcanzó a guardar la
-- respuesta pero la confirmación se perdió, el reintento la insertaba otra vez
-- y el promedio del grupo quedaba sesgado. Ahora el navegador genera un
-- envio_id (uuid) UNA vez por clic en "Enviar" y lo reusa en cada reintento; el
-- índice único hace que el 2º intento choque, y enviarRespuesta lo interpreta
-- como "ya estaba guardada" (responde ok sin volver a contar).
--
-- Solo agrega una columna NULL y un índice único FILTRADO (las filas viejas, sin
-- envio_id, no cuentan para la unicidad). No hay ALTER COLUMN, así que no hay
-- constraints previos que revisar. Seguro de volver a correr.
--
-- Cómo correrlo: portal de Azure → apcweb-backoffice → "Query editor
-- (preview)", pega y ejecuta completo. Correrlo ANTES de que suba el código de
-- esta fase (enviarRespuesta ya escribe esta columna).

IF COL_LENGTH('EncuestaRespuesta', 'envio_id') IS NULL
  ALTER TABLE EncuestaRespuesta ADD envio_id NVARCHAR(40) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_EncuestaRespuesta_envio_id')
  CREATE UNIQUE INDEX UX_EncuestaRespuesta_envio_id ON EncuestaRespuesta (envio_id) WHERE envio_id IS NOT NULL;
GO
