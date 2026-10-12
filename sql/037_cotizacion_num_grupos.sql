/*
  037 — Número de grupos en la cotización

  Una cotización puede cubrir varios grupos del mismo programa (se cotiza el total con descuento por volumen: 5 % por 2 grupos,
  10 % por 3 o más). num_grupos = cuántos grupos (default 1: las cotizaciones existentes no cambian) y participantes_num = número
  EXACTO de participantes por grupo (opcional; sirve para mostrar el costo por participante en la propuesta).
  Idempotente; correrlo ANTES de desplegar.

  Cómo correrlo: portal de Azure → apcweb-backoffice → Query editor (preview), pega y ejecuta este script completo.
*/

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Cotizacion') AND name = 'num_grupos')
  ALTER TABLE Cotizacion ADD num_grupos INT NOT NULL CONSTRAINT DF_Cotizacion_num_grupos DEFAULT 1;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Cotizacion') AND name = 'participantes_num')
  ALTER TABLE Cotizacion ADD participantes_num INT NULL;
GO
