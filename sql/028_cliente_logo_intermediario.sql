/*
  028 — Logo de Cliente Intermediario

  Un Cliente tipo "Intermediario" puede tener un logo (Blob, contenedor
  "intermediarios", {clienteId}.png — ver api/src/intermediarios-storage.js).
  mostrar_logo es el único dato nuevo en SQL: gatilla si ese logo se expone en
  Reportes/Cotizaciones colaborativas — la imagen en sí vive fuera de SQL, la
  Function pública que la sirve (getLogoIntermediario) no toca la base, así
  que el permiso se congela en el snapshot del reporte al generarlo (ver
  calificaciones-reporte-calc.js), no se checa en vivo cada vez que alguien
  abre el link.

  Cómo correrlo: portal de Azure → apcweb-backoffice → Query editor (preview),
  pega y ejecuta este script completo. Es idempotente.
*/

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Cliente') AND name = 'mostrar_logo')
  ALTER TABLE Cliente ADD mostrar_logo BIT NOT NULL CONSTRAINT DF_Cliente_mostrar_logo DEFAULT 1;
GO
