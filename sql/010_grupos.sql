-- alfredopina.ai — Backoffice SQL
-- Grupos (Fase 2 — Operación, primer módulo, ver CLAUDE.md → "Modelo del
-- negocio y roadmap estratégico"): reemplaza el Excel de control que Alfredo
-- lleva hoy. Un Grupo es una instancia real de curso entregada a un Cliente —
-- corre sobre la misma base apcweb-backoffice que ya usan Diplomas/Encuestas/
-- Comercial/Diagnóstico, reusando Cliente/Contacto/Cotizacion sin volver a
-- crearlas aquí.
--
-- cliente_final_id existe para el caso de reventa/intermediario (ej.
-- Capacitanet vende y Clarios recibe el curso) — cliente_id es quien contrató
-- (a quien se le cotiza/cobra), cliente_final_id es opcional y solo se llena
-- si hay un cliente distinto recibiendo el curso.
--
-- herramientas/niveles se guardan como JSON array de texto (["excel","ia"] /
-- [1,3]) en vez de tablas de unión — un Grupo rara vez combina más de 2-3
-- herramientas o niveles, y no hay necesidad de reportarlas por separado con
-- JOINs; mismo criterio de simplicidad que ya usa el proyecto para snapshots
-- (ver temas_json en Solicitud/Cotizacion).
--
-- instructor se guarda como texto plano (no FK) — mismo criterio que ya usa
-- Diplomas, la lista de instructores vive en Blob (getInstructores), no en SQL.
--
-- Sin eliminarGrupo a propósito: mismo criterio del proyecto de nunca borrar
-- de verdad (Cliente/Diploma/Solicitud tampoco se borran) — un Grupo mal
-- capturado se corrige con editarGrupo.
--
-- Cómo correrlo: portal de Azure → apcweb-backoffice → "Query editor (preview)"
-- (o SSMS/Azure Data Studio), pega y ejecuta este script completo. Es seguro
-- volver a correrlo aunque ya se haya ejecutado parcialmente — el CREATE
-- TABLE está envuelto en un IF NOT EXISTS.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Grupo')
BEGIN
  CREATE TABLE Grupo (
    id INT IDENTITY(1,1) PRIMARY KEY,
    cliente_id INT NOT NULL,
    cliente_final_id INT NULL,
    contacto_id INT NULL,
    modalidad NVARCHAR(30) NULL,
    grupo_codigo NVARCHAR(50) NULL,
    herramientas NVARCHAR(200) NOT NULL, -- JSON array de slugs: ["excel","powerbi",...]
    nombre_curso NVARCHAR(200) NULL,
    niveles NVARCHAR(20) NOT NULL, -- JSON array: [1,2,3] (1=Básico,2=Intermedio,3=Avanzado)
    horas DECIMAL(6,1) NULL,
    sesiones INT NULL,
    fecha_inicio DATE NULL,
    fecha_fin DATE NULL,
    instructor NVARCHAR(150) NULL,
    estatus_curso NVARCHAR(20) NOT NULL DEFAULT 'Por iniciar',
    estatus_cierre NVARCHAR(20) NULL,
    cotizacion_id INT NULL,
    fotos_rs BIT NOT NULL DEFAULT 0,
    correos_ml BIT NOT NULL DEFAULT 0,
    pagado BIT NOT NULL DEFAULT 0,
    fecha_cierre DATE NULL,
    notas NVARCHAR(MAX) NULL,
    fecha_creacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Grupo_Cliente FOREIGN KEY (cliente_id) REFERENCES Cliente(id),
    CONSTRAINT FK_Grupo_ClienteFinal FOREIGN KEY (cliente_final_id) REFERENCES Cliente(id),
    CONSTRAINT FK_Grupo_Contacto FOREIGN KEY (contacto_id) REFERENCES Contacto(id),
    CONSTRAINT FK_Grupo_Cotizacion FOREIGN KEY (cotizacion_id) REFERENCES Cotizacion(id),
    CONSTRAINT CK_Grupo_modalidad CHECK (modalidad IN ('Online', 'Presencial', 'Híbrido')),
    CONSTRAINT CK_Grupo_estatus_curso CHECK (estatus_curso IN ('Por iniciar', 'En proceso', 'Terminado')),
    CONSTRAINT CK_Grupo_estatus_cierre CHECK (estatus_cierre IN ('Proyecto', 'Calificaciones', 'Diplomas', 'Cerrado'))
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Grupo_cliente_id')
  CREATE INDEX IX_Grupo_cliente_id ON Grupo(cliente_id);
GO
