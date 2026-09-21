/*
  023 — Calificaciones como base del reporte de evaluación

  022 nació pensada solo para el diploma (3 porcentajes + resultado tecleado).
  Ahora Calificacion alimenta también el reporte al cliente, con estas reglas
  (viven en api/src/calificaciones-calc.js, con pruebas):
    - Puntos    : extra sobre la calificación (decimal, puede pasar de 100 en total)
    - Asistencias / Frecuencias : enteros — sesiones a las que asistió / sesiones
                  que tuvo el curso (igual para todo el grupo)
    - Proyecto  : calificación porcentual del proyecto (0-100)
    - Calificación = 80% Proyecto + 20% (Asistencias/Frecuencias) + Puntos
    - Resultado se CALCULA: Aprobado si Calificación >= 80; si no, Participó si
      asistencia >= 80%; si no, No Aprobado
  Se guardan las entradas Y la calificación/resultado ya calculados al cargar
  (foto): un cambio futuro de reglas no reescribe grupos cerrados ni diplomas.
  `calificacion` se guarda SIN toparla a 100 (para poder marcar "100+"); los
  promedios la topan.

  También agrega Alumno.correo (opcional) y notas por alumno (van al reporte).

  Cambio de columnas: participacion/asistencia/proyecto de 022 tenían otra
  semántica (porcentajes) y solo hay datos de prueba — Alfredo autorizó
  borrarlos ("borra todo, es un ejemplo"). Por eso la limpieza y el cambio de
  columnas van DENTRO del IF de abajo: al correr el script una segunda vez,
  cuando ya existan calificaciones reales, NO toca nada. También borra los
  Alumnos que el ejemplo creó y que no tienen Diploma ni Calificación (no
  guardan más que nombre y cliente).

  Cómo correrlo: portal de Azure → apcweb-backoffice → Editor de consultas,
  pega y ejecuta este script completo. Es idempotente.
*/

IF COL_LENGTH('Calificacion', 'frecuencias') IS NULL
BEGIN
  DELETE FROM Calificacion;
  DELETE FROM Alumno
   WHERE NOT EXISTS (SELECT 1 FROM Diploma d WHERE d.alumno_id = Alumno.id)
     AND NOT EXISTS (SELECT 1 FROM Calificacion c WHERE c.alumno_id = Alumno.id);

  -- constraints de las columnas que cambian (revisados en 022: uno por columna)
  IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Calificacion_participacion')
    ALTER TABLE Calificacion DROP CONSTRAINT CK_Calificacion_participacion;
  IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Calificacion_asistencia')
    ALTER TABLE Calificacion DROP CONSTRAINT CK_Calificacion_asistencia;
  IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Calificacion_proyecto')
    ALTER TABLE Calificacion DROP CONSTRAINT CK_Calificacion_proyecto;

  ALTER TABLE Calificacion DROP COLUMN participacion, asistencia, proyecto;
  ALTER TABLE Calificacion ADD
    puntos DECIMAL(5,1) NULL,
    asistencias INT NULL,
    frecuencias INT NULL,
    proyecto DECIMAL(5,1) NULL,
    calificacion DECIMAL(5,1) NULL,
    notas NVARCHAR(500) NULL;
END
GO

IF COL_LENGTH('Alumno', 'correo') IS NULL
  ALTER TABLE Alumno ADD correo NVARCHAR(200) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Calificacion_puntos')
  ALTER TABLE Calificacion ADD CONSTRAINT CK_Calificacion_puntos CHECK (puntos IS NULL OR puntos BETWEEN 0 AND 100);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Calificacion_proyecto')
  ALTER TABLE Calificacion ADD CONSTRAINT CK_Calificacion_proyecto CHECK (proyecto IS NULL OR proyecto BETWEEN 0 AND 100);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Calificacion_asistencias')
  ALTER TABLE Calificacion ADD CONSTRAINT CK_Calificacion_asistencias CHECK (asistencias IS NULL OR asistencias >= 0);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Calificacion_frecuencias')
  ALTER TABLE Calificacion ADD CONSTRAINT CK_Calificacion_frecuencias CHECK (frecuencias IS NULL OR frecuencias >= 1);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Calificacion_asist_max')
  ALTER TABLE Calificacion ADD CONSTRAINT CK_Calificacion_asist_max CHECK (asistencias IS NULL OR frecuencias IS NULL OR asistencias <= frecuencias);
GO
