/*
  038 — Temas a medida en la Solicitud personalizada

  Temas que el cliente pidió y que no están en el catálogo de Productos: lista JSON [{nombre, objetivo}] (hasta 10). Viajan a la
  Cotización y salen en la ruta de aprendizaje de la propuesta con la etiqueta "A tu medida". Idempotente; correrlo ANTES de desplegar.

  Cómo correrlo: portal de Azure → apcweb-backoffice → Query editor (preview), pega y ejecuta este script completo.
*/

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Solicitud') AND name = 'temas_custom_json')
  ALTER TABLE Solicitud ADD temas_custom_json NVARCHAR(MAX) NULL;
GO
