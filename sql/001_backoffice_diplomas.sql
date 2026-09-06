-- alfredopina.ai — Backoffice SQL
-- Fase adelantada de Diplomas (normalmente Fase 3), corre sobre una base Azure SQL
-- NUEVA dentro de GR_AlfredoPina (ver CLAUDE.md, decisión 2026-09-06).
--
-- Cliente y Alumno nacen aquí como semilla del esquema completo: cuando se construya
-- Cotizaciones/Grupos (Fase 1/2), se EXTIENDEN estas mismas tablas, no se crean nuevas.
--
-- Cómo correrlo: portal de Azure → tu base de datos nueva → "Query editor (preview)"
-- (o desde SSMS/Azure Data Studio si prefieres), pega y ejecuta este script completo.

CREATE TABLE Cliente (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(200) NOT NULL,
    codigo NVARCHAR(20) NOT NULL,
    CONSTRAINT UQ_Cliente_codigo UNIQUE (codigo)
);

CREATE TABLE Alumno (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nombre_completo NVARCHAR(200) NOT NULL,
    cliente_id INT NOT NULL,
    CONSTRAINT FK_Alumno_Cliente FOREIGN KEY (cliente_id) REFERENCES Cliente(id)
);

CREATE TABLE Diploma (
    folio NVARCHAR(40) NOT NULL PRIMARY KEY,
    alumno_id INT NOT NULL,
    cliente_id INT NOT NULL,
    herramienta NVARCHAR(50) NOT NULL,
    curso NVARCHAR(200) NOT NULL,
    nivel NVARCHAR(50) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    resultado NVARCHAR(20) NOT NULL,
    instructor NVARCHAR(120) NOT NULL,
    grupo NVARCHAR(120) NOT NULL,
    proyecto INT NULL,
    asistencia INT NULL,
    participacion INT NULL,
    blob_path NVARCHAR(300) NULL,
    estatus NVARCHAR(20) NOT NULL DEFAULT 'vigente',
    corrige_a_folio NVARCHAR(40) NULL,
    fecha_generacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Diploma_Alumno FOREIGN KEY (alumno_id) REFERENCES Alumno(id),
    CONSTRAINT FK_Diploma_Cliente FOREIGN KEY (cliente_id) REFERENCES Cliente(id),
    CONSTRAINT FK_Diploma_CorrigeA FOREIGN KEY (corrige_a_folio) REFERENCES Diploma(folio),
    CONSTRAINT CK_Diploma_resultado CHECK (resultado IN ('Aprobado', 'Participó', 'No Aprobado')),
    CONSTRAINT CK_Diploma_estatus CHECK (estatus IN ('vigente', 'anulado'))
);

CREATE INDEX IX_Diploma_cliente_id ON Diploma(cliente_id);
CREATE INDEX IX_Diploma_alumno_id ON Diploma(alumno_id);
