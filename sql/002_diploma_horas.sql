-- alfredopina.ai — Backoffice SQL
-- Agrega la duración del curso (en horas) al Diploma — se necesita para el
-- texto "Con duración de X horas" del PDF. Es un dato del LOTE (una vez por
-- grupo), no por alumno.

ALTER TABLE Diploma ADD horas INT NULL;
