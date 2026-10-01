/*
  029 — Foto final del grupo

  Un Grupo puede tener una foto (Blob, contenedor "grupo-fotos", {grupoId} —
  ver api/src/grupo-foto-storage.js). foto_grupo_visible es el único dato
  nuevo en SQL: gatilla si esa foto se expone en el Reporte de Resultados —
  la imagen en sí vive fuera de SQL. A diferencia del logo de Intermediario
  (que es material de marca, sin personas), esta foto SÍ puede mostrar caras
  de empleados del cliente, así que el permiso se congela en el snapshot del
  reporte al generarlo (mostrarFoto en porGrupo, ver
  calificaciones-reporte-calc.js) Y además getFotoGrupoReporte valida en cada
  solicitud que ese grupo pertenezca al reporte del token — doble candado,
  no uno solo como el logo.

  Cómo correrlo: portal de Azure → apcweb-backoffice → Query editor (preview),
  pega y ejecuta este script completo. Es idempotente.
*/

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Grupo') AND name = 'foto_grupo_visible')
  ALTER TABLE Grupo ADD foto_grupo_visible BIT NOT NULL CONSTRAINT DF_Grupo_foto_grupo_visible DEFAULT 1;
GO
