-- alfredopina.ai — Backoffice SQL
-- Historial de fase de Grupo (Fase 2 — Operación, Tracking Operación): un
-- renglón por cada vez que un Grupo cruza a una fase nueva (Por iniciar → En
-- curso → Proyecto → Calificaciones → Diplomas → Cerrado). Se llena solo
-- desde api/src/grupo-fase.js (crearGrupo/editarGrupo/avanzarFaseGrupo) — la
-- fase en sí no es una columna nueva en Grupo, se sigue derivando de
-- estatus_curso/estatus_cierre (ver derivarFase), esta tabla solo guarda
-- CUÁNDO se cruzó cada una para poder mostrar el stepper con fechas reales y
-- calcular "días en esta fase" sin adivinar.
--
-- Sin FK con ON DELETE CASCADE especial ni columna "activa" — a diferencia de
-- EncuestaRespuestaDetalle/DiagnosticoRespuestaDetalle, aquí sí hay FK directa
-- a Grupo porque Grupo nunca se borra (mismo criterio que Cliente/Diploma:
-- solo se corrige, nunca se elimina), así que no hay riesgo de historial
-- huérfano.
--
-- Cómo correrlo: portal de Azure → apcweb-backoffice → "Query editor (preview)"
-- (o SSMS/Azure Data Studio), pega y ejecuta este script completo. Es seguro
-- volver a correrlo aunque ya se haya ejecutado parcialmente.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'GrupoFaseHistorial')
BEGIN
  CREATE TABLE GrupoFaseHistorial (
    id INT IDENTITY(1,1) PRIMARY KEY,
    grupo_id INT NOT NULL,
    fase NVARCHAR(20) NOT NULL, -- 'Por iniciar','En curso','Proyecto','Calificaciones','Diplomas','Cerrado'
    fecha DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_GrupoFaseHistorial_Grupo FOREIGN KEY (grupo_id) REFERENCES Grupo(id),
    CONSTRAINT CK_GrupoFaseHistorial_fase CHECK (fase IN ('Por iniciar', 'En curso', 'Proyecto', 'Calificaciones', 'Diplomas', 'Cerrado'))
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_GrupoFaseHistorial_grupo_id')
  CREATE INDEX IX_GrupoFaseHistorial_grupo_id ON GrupoFaseHistorial(grupo_id);
GO
