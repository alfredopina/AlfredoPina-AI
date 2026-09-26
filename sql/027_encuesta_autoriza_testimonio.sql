-- alfredopina.ai — Backoffice SQL
-- Encuestas: permiso opcional para usar el comentario como testimonio.
--
-- Por qué: cuando el instructor es Alfredo, encuesta.html muestra una casilla
-- "Autorizo usar mi comentario como testimonio en alfredopina.ai y LinkedIn
-- (solo nombre y empresa)". Ese permiso se guarda junto con la respuesta para
-- poder filtrar después qué comentarios sí se pueden publicar (Resultados lo
-- marca con "Testimonio autorizado"). enviarRespuesta solo lo guarda en 1 si
-- de verdad hay comentario, hay nombre y el instructor es Alfredo — el
-- navegador no es fuente de verdad.
--
-- Solo agrega una columna con DEFAULT 0 (las respuestas existentes quedan en
-- "no autorizó"). No hay ALTER COLUMN, así que no hay constraints previos que
-- revisar. Seguro de volver a correr.
--
-- Cómo correrlo: portal de Azure → apcweb-backoffice → "Query editor
-- (preview)", pega y ejecuta completo. Correrlo ANTES de que suba el código de
-- esta fase (enviarRespuesta y Resultados ya leen/escriben esta columna).

IF COL_LENGTH('EncuestaRespuesta', 'autoriza_testimonio') IS NULL
BEGIN
  ALTER TABLE EncuestaRespuesta
    ADD autoriza_testimonio BIT NOT NULL
        CONSTRAINT DF_EncuestaRespuesta_autoriza_testimonio DEFAULT 0;
END
GO
