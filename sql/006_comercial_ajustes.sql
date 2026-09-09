-- alfredopina.ai — Backoffice SQL
-- Ajustes a Fase 1 Comercial (sesión 2026-09-09) tras la primera prueba real
-- del panel Clientes: Contacto necesita distinguir "planta" (misma empresa,
-- otra ubicación física — algunos clientes tienen contactos en más de una) y
-- Cliente necesita año de antigüedad para poder ordenar/mostrarlo en el panel.
--
-- Cómo correrlo: portal de Azure → apcweb-backoffice → "Query editor (preview)"
-- (o SSMS/Azure Data Studio), pega y ejecuta este script completo.

ALTER TABLE Contacto ADD planta NVARCHAR(100) NULL;
ALTER TABLE Cliente ADD cliente_desde INT NULL;
