/*
  034 — Cotización vía Intermediario

  Una cotización puede emitirse a nombre de un Cliente tipo "Intermediario" (cliente_id = a quien se cotiza y cobra, igual que
  en Grupo) para un cliente final distinto (cliente_final_id, opcional). Es el mismo modelo que Grupo.cliente_final_id.
  Las cotizaciones existentes quedan con NULL (sin intermediario). Idempotente; correrlo ANTES de desplegar.

  Cómo correrlo: portal de Azure → apcweb-backoffice → Query editor (preview), pega y ejecuta este script completo.
*/

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Cotizacion') AND name = 'cliente_final_id')
  ALTER TABLE Cotizacion ADD cliente_final_id INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Cotizacion_ClienteFinal')
  ALTER TABLE Cotizacion ADD CONSTRAINT FK_Cotizacion_ClienteFinal FOREIGN KEY (cliente_final_id) REFERENCES Cliente(id);
GO
