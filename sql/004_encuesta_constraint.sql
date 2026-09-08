-- alfredopina.ai — Backoffice SQL
-- Corrección de robustez (auditoría de calidad de código, 2026-09-08): evita
-- filas duplicadas en EncuestaRespuestaDetalle si algún día el frontend llega a
-- mandar la misma pregunta dos veces en un solo envío (bug futuro, no uno ya
-- visto) — hoy no hay ningún constraint que lo impida.
--
-- Cómo correrlo: portal de Azure → apcweb-backoffice → "Query editor (preview)"
-- (o SSMS/Azure Data Studio), pega y ejecuta este script completo.

ALTER TABLE EncuestaRespuestaDetalle
ADD CONSTRAINT UQ_EncuestaRespuestaDetalle UNIQUE (respuesta_id, pregunta_id);
