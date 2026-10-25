/*
  044 — Clientes: tipo "Tercero"

  Un Tercero es alguien a quien Alfredo le factura por cuenta de otra persona ("favores": el tercero paga el impuesto): vive en Clientes para
  guardar sus datos, pero NO se mide como cliente (sin semáforo de inactividad ni tarjetas de Clientes), NO sale en los selectores de
  Solicitud, Cotización o Grupo, y NUNCA aparece en las búsquedas públicas. Solo Cobranza lo ofrece. Es el mismo patrón que Prospecto:
  el único cambio de esquema es ampliar el CHECK de tipo_cliente. Idempotente; correrlo ANTES de desplegar.

  Cómo correrlo: portal de Azure → apcweb-backoffice → Query editor (preview), pega y ejecuta este script completo.
*/

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Cliente_tipo_cliente')
  ALTER TABLE Cliente DROP CONSTRAINT CK_Cliente_tipo_cliente;
GO
ALTER TABLE Cliente ADD CONSTRAINT CK_Cliente_tipo_cliente CHECK (tipo_cliente IN ('Directo', 'Intermediario', 'Indirecto', 'Prospecto', 'Tercero'));
GO
