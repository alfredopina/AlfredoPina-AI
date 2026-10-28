/*
  045 — Cobranza: las facturas de terceros no tienen estrategia

  Una factura por cuenta de terceros (tipo "Otro", cliente tipo Tercero) no es ingreso de Alfredo: no pertenece a ninguna estrategia (Cursos In company ni
  Cursos Abiertos). Por eso estrategia pasa a aceptar NULL, y un CHECK garantiza la regla en los dos sentidos: tipo Otro ⇒ sin estrategia; cualquier otro
  tipo (o sin clasificar) ⇒ estrategia obligatoria. Así "cobrado por estrategia" nunca se ensucia con dinero que no es de Alfredo.
  Revisado antes del ALTER COLUMN: estrategia solo tiene CK_CxC_estrategia (admite NULL) y un DEFAULT; ningún índice ni llave la usa.
  Las cuentas que ya existen quedan igual (ninguna es de tipo Otro todavía). Idempotente; correrlo ANTES de desplegar y ANTES de la importación.

  Cómo correrlo: portal de Azure → apcweb-backoffice → Query editor (preview), pega y ejecuta este script completo.
*/

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('CuentaPorCobrar') AND name = 'estrategia' AND is_nullable = 0)
  ALTER TABLE CuentaPorCobrar ALTER COLUMN estrategia NVARCHAR(12) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_CxC_estrategia_tercero')
  ALTER TABLE CuentaPorCobrar ADD CONSTRAINT CK_CxC_estrategia_tercero
    CHECK ((tipo_factura = 'Otro' AND estrategia IS NULL) OR (ISNULL(tipo_factura, '') <> 'Otro' AND estrategia IS NOT NULL));
GO
