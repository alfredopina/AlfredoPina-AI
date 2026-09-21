/*
  022 — Calificaciones

  Una fila por alumno y Grupo: participación / asistencia / proyecto (0-100) y
  el resultado que Alfredo captura a mano (Aprobado / Participó / No Aprobado).
  El Alumno nace aquí (tabla Alumno ya existente, ligado al cliente FINAL del
  grupo si lo tiene, si no al cliente que contrató). La fila de "Resultados"
  por grupo no se guarda — se calcula con GROUP BY sobre esta tabla, así nunca
  se desincroniza.

  No lleva columna de herramienta: un grupo con varias herramientas se califica
  una sola vez (el diploma leerá las herramientas del Grupo).

  Volver a cargar un grupo REEMPLAZA su set completo (lo hace cargarCalificaciones
  en una transacción, con confirmación previa en el panel) — el UNIQUE evita
  que el mismo alumno aparezca dos veces en un grupo.

  Cómo correrlo: portal de Azure → apcweb-backoffice → Editor de consultas,
  pega y ejecuta este script completo. Es idempotente.
*/

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Calificacion')
BEGIN
  CREATE TABLE Calificacion (
    id INT IDENTITY(1,1) PRIMARY KEY,
    grupo_id INT NOT NULL,
    alumno_id INT NOT NULL,
    participacion INT NULL,
    asistencia INT NULL,
    proyecto INT NULL,
    resultado NVARCHAR(20) NOT NULL,
    fecha_carga DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Calificacion_Grupo FOREIGN KEY (grupo_id) REFERENCES Grupo(id),
    CONSTRAINT FK_Calificacion_Alumno FOREIGN KEY (alumno_id) REFERENCES Alumno(id),
    CONSTRAINT UQ_Calificacion_grupo_alumno UNIQUE (grupo_id, alumno_id),
    CONSTRAINT CK_Calificacion_resultado CHECK (resultado IN ('Aprobado', 'Participó', 'No Aprobado')),
    CONSTRAINT CK_Calificacion_participacion CHECK (participacion IS NULL OR participacion BETWEEN 0 AND 100),
    CONSTRAINT CK_Calificacion_asistencia CHECK (asistencia IS NULL OR asistencia BETWEEN 0 AND 100),
    CONSTRAINT CK_Calificacion_proyecto CHECK (proyecto IS NULL OR proyecto BETWEEN 0 AND 100)
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Calificacion_grupo_id')
  CREATE INDEX IX_Calificacion_grupo_id ON Calificacion(grupo_id);
GO
