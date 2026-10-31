/*
  045 — Cotización de consultoría (servicio por horas, 2026-10-31)

  Un tercer tipo de programa junto a 'estandar' y 'personalizado': 'consultoria' (dashboards a la medida, ayuda con un archivo, etc.).
  La Solicitud guarda su contenido en consultoria_json = { fases: [{ nombre, descripcion, horas }], entregables: [texto], imagen: url|null };
  la Cotización nace de ella como cualquier otra (misma tabla, mismo tablero, mismas métricas) y solo cambia cómo se cotiza (horas × la
  tarifa nueva 'consultoria') y cómo se ve la propuesta ("Fases del proyecto"). Idempotente; correrlo ANTES de desplegar.

  La tarifa de consultoría arranca en 1200.00 por hora (igual que las demás): cámbiala en Configuración → Tarifas.

  Cómo correrlo: portal de Azure → apcweb-backoffice → Query editor (preview), pega y ejecuta este script completo.
*/

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Solicitud') AND name = 'consultoria_json')
  ALTER TABLE Solicitud ADD consultoria_json NVARCHAR(MAX) NULL;
GO

-- los CHECK de temario_tipo (Solicitud y Cotizacion) solo conocen estandar / personalizado: se vuelven a crear con 'consultoria'
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Solicitud_temario_tipo' AND parent_object_id = OBJECT_ID('Solicitud'))
  ALTER TABLE Solicitud DROP CONSTRAINT CK_Solicitud_temario_tipo;
GO
ALTER TABLE Solicitud ADD CONSTRAINT CK_Solicitud_temario_tipo CHECK (temario_tipo IN ('estandar', 'personalizado', 'consultoria'));
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Cotizacion_temario_tipo' AND parent_object_id = OBJECT_ID('Cotizacion'))
  ALTER TABLE Cotizacion DROP CONSTRAINT CK_Cotizacion_temario_tipo;
GO
ALTER TABLE Cotizacion ADD CONSTRAINT CK_Cotizacion_temario_tipo CHECK (temario_tipo IN ('estandar', 'personalizado', 'consultoria'));
GO

IF NOT EXISTS (SELECT 1 FROM TarifaHerramienta WHERE herramienta = 'consultoria')
  INSERT INTO TarifaHerramienta (herramienta, precio_hora) VALUES ('consultoria', 1200.00);
GO
