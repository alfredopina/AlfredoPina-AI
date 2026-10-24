/*
  042 — Cobranza: una cuenta automática por Grupo sin cotización

  Un Grupo que nace directo (el cliente contrata sin cotización: Gobierno, CAINTRA…) dispara su cuenta "Por facturar". Para que nunca
  se duplique, índice único filtrado: a lo más UNA cuenta 'Automática' sin cotización por grupo. (Las que nacen de una cotización ya
  tienen su propio índice único por cotizacion_id, sql/040.) Idempotente; correrlo ANTES de desplegar.

  Cómo correrlo: portal de Azure → apcweb-backoffice → Query editor (preview), pega y ejecuta este script completo.
*/

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_CxC_automatica_grupo' AND object_id = OBJECT_ID('CuentaPorCobrar'))
  CREATE UNIQUE INDEX UQ_CxC_automatica_grupo ON CuentaPorCobrar(grupo_id)
    WHERE origen = 'Automática' AND grupo_id IS NOT NULL AND cotizacion_id IS NULL;
GO
