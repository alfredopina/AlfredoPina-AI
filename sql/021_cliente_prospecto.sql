/*
  021 — Tipo de Cliente "Prospecto"

  Un Prospecto es una empresa que todavía no es cliente (solo tiene Solicitud,
  Cotización o Diagnóstico). Vive en la misma tabla Cliente — asciende a
  Directo/Indirecto solo cuando se le da de alta un Grupo (lo hace el backend
  de crearGrupo/editarGrupo), sin cambiar de id ni perder historial. El único
  cambio de esquema es ampliar el CHECK de tipo_cliente; el DEFAULT 'Directo'
  se queda tal cual (las altas que nacen Prospecto lo mandan explícito).

  Cómo correrlo: portal de Azure → apcweb-backoffice → Editor de consultas,
  pega y ejecuta este script completo. Es idempotente.
*/

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Cliente_tipo_cliente')
  ALTER TABLE Cliente DROP CONSTRAINT CK_Cliente_tipo_cliente;
GO
ALTER TABLE Cliente ADD CONSTRAINT CK_Cliente_tipo_cliente CHECK (tipo_cliente IN ('Directo', 'Intermediario', 'Indirecto', 'Prospecto'));
GO
