/*
  039 — WhatsApp de contacto en la cotización vía intermediario

  Cuando una cotización se emite a un intermediario, el botón "Tengo dudas" de la propuesta debe llevar a SU contacto (no al de
  Alfredo). telefono_contacto = el número tal como Alfredo lo escribe al crear la cotización (para precargarlo al editarla); en la
  propuesta viaja ya normalizado. Opcional: vacío = el botón sigue yendo a Alfredo. Idempotente; correrlo ANTES de desplegar.

  Cómo correrlo: portal de Azure → apcweb-backoffice → Query editor (preview), pega y ejecuta este script completo.
*/

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Cotizacion') AND name = 'telefono_contacto')
  ALTER TABLE Cotizacion ADD telefono_contacto NVARCHAR(30) NULL;
GO
