-- alfredopina.ai — Backoffice SQL
-- 048 — Cursos Abiertos: modelo de datos (Grupo abierto, sesiones, inscripciones y lista de espera).
-- Diseño completo y por qué: docs/cursos-abiertos.md.
--
-- · Un GRUPO ABIERTO es un Grupo con estrategia 'abiertos'. Su Cliente es uno reservado, "Cursos Abiertos (público)" (código ABIERTOS), de tipo
--   'Prospecto' A PROPÓSITO: ese tipo ya se excluye de las métricas de Clientes, del Dashboard y de los buscadores de Solicitud/Cotización/Grupo
--   (tipo_cliente NOT IN ('Prospecto','Tercero')), así que el cliente reservado no ensucia nada ni se puede elegir por error para un curso In Company.
-- · Los estados que ve el público (abierto, últimos lugares, lleno, próximamente) y «Grupo confirmado» NO se guardan: se calculan con cupo,
--   inscripciones y fechas. Aquí solo van los datos.
-- · Las SESIONES (fecha y hora de inicio y fin) viven en GrupoSesion; Grupo.sesiones sigue siendo el texto libre de siempre (para In Company).
-- · INSCRIPCION une Alumno y Grupo (una fila por persona; un envío del sitio puede traer 1 a 3). Guarda quién paga, la factura, el estado de pago
--   (independiente de cualquier proveedor de cobro), el origen de la visita (utm) y la clave del envío que impide duplicados al importar la cola.
--   Un apartado VENCIDO no es un estado: es 'apartada' con apartado_hasta ya pasado (Alfredo decide si libera el lugar).
-- · LISTAESPERA guarda los «avísame» del sitio.
--
-- Idempotente (seguro de volver a correr): cada pieza revisa si ya existe. Cómo correrlo: portal de Azure → apcweb-backoffice →
-- "Query editor (preview)" (o SSMS/Azure Data Studio), pega y ejecuta este script completo. Despierta la base (cuota gratis): córrelo una sola vez.
-- Revisado antes de tocar columnas existentes: no hay ALTER COLUMN ni se tira ningún constraint; todo lo nuevo entra con DEFAULT o NULL.

-- ── Alumno: WhatsApp de contacto (opcional) ──
IF COL_LENGTH('Alumno', 'whatsapp') IS NULL
  ALTER TABLE Alumno ADD whatsapp NVARCHAR(40) NULL;
GO

-- ── Cliente reservado para los grupos abiertos ──
IF NOT EXISTS (SELECT 1 FROM Cliente WHERE codigo = 'ABIERTOS')
  INSERT INTO Cliente (nombre, codigo, tipo_cliente, origen_alta)
  VALUES (N'Cursos Abiertos (público)', 'ABIERTOS', 'Prospecto', 'Cursos Abiertos');
GO

-- ── Grupo: lo propio de un grupo abierto ──
IF COL_LENGTH('Grupo', 'estrategia') IS NULL
  ALTER TABLE Grupo ADD estrategia NVARCHAR(12) NOT NULL CONSTRAINT DF_Grupo_estrategia DEFAULT 'empresas';
GO
IF COL_LENGTH('Grupo', 'programa_id') IS NULL ALTER TABLE Grupo ADD programa_id NVARCHAR(80) NULL;            -- el Programa estándar del que salió
IF COL_LENGTH('Grupo', 'cupo_total') IS NULL ALTER TABLE Grupo ADD cupo_total INT NULL;
IF COL_LENGTH('Grupo', 'minimo_para_abrir') IS NULL ALTER TABLE Grupo ADD minimo_para_abrir INT NULL;
IF COL_LENGTH('Grupo', 'precio_persona') IS NULL ALTER TABLE Grupo ADD precio_persona DECIMAL(10,2) NULL;      -- sin IVA, por persona
IF COL_LENGTH('Grupo', 'precio_preventa') IS NULL ALTER TABLE Grupo ADD precio_preventa DECIMAL(10,2) NULL;
IF COL_LENGTH('Grupo', 'preventa_hasta') IS NULL ALTER TABLE Grupo ADD preventa_hasta DATE NULL;
IF COL_LENGTH('Grupo', 'sede') IS NULL ALTER TABLE Grupo ADD sede NVARCHAR(160) NULL;                         -- solo si es presencial
IF COL_LENGTH('Grupo', 'publicacion') IS NULL ALTER TABLE Grupo ADD publicacion NVARCHAR(12) NULL;            -- 'borrador' | 'publicado' | 'cancelado'
IF COL_LENGTH('Grupo', 'mes_estimado') IS NULL ALTER TABLE Grupo ADD mes_estimado NVARCHAR(7) NULL;           -- 'AAAA-MM' si aún no hay sesiones
IF COL_LENGTH('Grupo', 'resumen_publico') IS NULL ALTER TABLE Grupo ADD resumen_publico NVARCHAR(300) NULL;
IF COL_LENGTH('Grupo', 'temario_corto') IS NULL ALTER TABLE Grupo ADD temario_corto NVARCHAR(MAX) NULL;       -- JSON: ["punto 1","punto 2"]
IF COL_LENGTH('Grupo', 'publicado_en') IS NULL ALTER TABLE Grupo ADD publicado_en DATETIME2 NULL;             -- última vez que salió en «Publicar calendario»
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Grupo_estrategia')
  ALTER TABLE Grupo ADD CONSTRAINT CK_Grupo_estrategia CHECK (estrategia IN ('empresas', 'abiertos'));
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Grupo_publicacion')
  ALTER TABLE Grupo ADD CONSTRAINT CK_Grupo_publicacion CHECK (publicacion IS NULL OR publicacion IN ('borrador', 'publicado', 'cancelado'));
-- un grupo abierto siempre tiene publicación, cupo, mínimo y precio; uno In Company no lleva nada de esto
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Grupo_abierto_datos')
  ALTER TABLE Grupo ADD CONSTRAINT CK_Grupo_abierto_datos CHECK (
    (estrategia = 'empresas' AND publicacion IS NULL AND cupo_total IS NULL)
    OR (estrategia = 'abiertos' AND publicacion IS NOT NULL AND cupo_total IS NOT NULL AND minimo_para_abrir IS NOT NULL AND precio_persona IS NOT NULL
        AND cupo_total >= 1 AND minimo_para_abrir >= 1 AND minimo_para_abrir <= cupo_total AND precio_persona >= 0
        AND (precio_preventa IS NULL OR (precio_preventa >= 0 AND precio_preventa < precio_persona AND preventa_hasta IS NOT NULL))));
GO
-- el código del grupo abierto es su dirección en el sitio (#g-<código>): no se repite
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_Grupo_abierto_codigo')
  CREATE UNIQUE INDEX UQ_Grupo_abierto_codigo ON Grupo(grupo_codigo) WHERE estrategia = 'abiertos' AND grupo_codigo IS NOT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Grupo_estrategia')
  CREATE INDEX IX_Grupo_estrategia ON Grupo(estrategia);
GO

-- ── GrupoSesion: fecha y hora de cada sesión (con zona: el sitio las muestra en hora de Monterrey) ──
IF OBJECT_ID('GrupoSesion') IS NULL
BEGIN
  CREATE TABLE GrupoSesion (
    id INT IDENTITY(1,1) PRIMARY KEY,
    grupo_id INT NOT NULL,
    orden INT NOT NULL,
    inicio DATETIMEOFFSET(0) NOT NULL,
    fin DATETIMEOFFSET(0) NOT NULL,
    CONSTRAINT FK_GrupoSesion_Grupo FOREIGN KEY (grupo_id) REFERENCES Grupo(id),
    CONSTRAINT CK_GrupoSesion_horas CHECK (fin > inicio),
    CONSTRAINT UQ_GrupoSesion_orden UNIQUE (grupo_id, orden)
  );
  CREATE INDEX IX_GrupoSesion_inicio ON GrupoSesion(inicio);
END
GO

-- ── Inscripcion: una fila por persona inscrita a un grupo abierto ──
IF OBJECT_ID('Inscripcion') IS NULL
BEGIN
  CREATE TABLE Inscripcion (
    id INT IDENTITY(1,1) PRIMARY KEY,
    grupo_id INT NOT NULL,
    alumno_id INT NOT NULL,
    estado NVARCHAR(12) NOT NULL DEFAULT 'apartada',          -- 'apartada' | 'confirmada' | 'cancelada'
    paga NVARCHAR(8) NOT NULL DEFAULT 'yo',                   -- 'yo' (la persona) | 'empresa'
    requiere_factura BIT NOT NULL DEFAULT 0,
    rfc NVARCHAR(15) NULL,
    razon_social NVARCHAR(200) NULL,
    estado_pago NVARCHAR(12) NOT NULL DEFAULT 'pendiente',    -- 'pendiente' | 'pagado' | 'reembolsado' (no depende de ningún proveedor de cobro)
    proveedor_ref NVARCHAR(100) NULL,                         -- referencia del proveedor de pagos, cuando exista
    monto_estimado DECIMAL(10,2) NULL,                        -- lo que calculó el sitio para ESTA persona (precio vigente y descuento de equipo)
    apartado_hasta DATETIME2 NULL,                            -- vence el apartado sin pago (UTC); vencido = apartada con esta fecha ya pasada
    envio_id NVARCHAR(64) NULL,                               -- clave del envío del sitio (idempotencia al importar la cola)
    persona_ix TINYINT NULL,                                  -- 0, 1 o 2 dentro de ese envío
    utm_source NVARCHAR(120) NULL,
    utm_medium NVARCHAR(120) NULL,
    utm_campaign NVARCHAR(120) NULL,
    cuenta_cobrar_id INT NULL,                                -- la cuenta en Cobranza (una por envío si paga una empresa)
    origen NVARCHAR(10) NOT NULL DEFAULT 'sitio',             -- 'sitio' | 'manual'
    notas NVARCHAR(MAX) NULL,
    fecha_creacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    fecha_estado DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Inscripcion_Grupo FOREIGN KEY (grupo_id) REFERENCES Grupo(id),
    CONSTRAINT FK_Inscripcion_Alumno FOREIGN KEY (alumno_id) REFERENCES Alumno(id),
    CONSTRAINT FK_Inscripcion_Cuenta FOREIGN KEY (cuenta_cobrar_id) REFERENCES CuentaPorCobrar(id),
    CONSTRAINT CK_Inscripcion_estado CHECK (estado IN ('apartada', 'confirmada', 'cancelada')),
    CONSTRAINT CK_Inscripcion_paga CHECK (paga IN ('yo', 'empresa')),
    CONSTRAINT CK_Inscripcion_pago CHECK (estado_pago IN ('pendiente', 'pagado', 'reembolsado')),
    CONSTRAINT CK_Inscripcion_origen CHECK (origen IN ('sitio', 'manual')),
    CONSTRAINT UQ_Inscripcion_persona UNIQUE (grupo_id, alumno_id)
  );
  CREATE INDEX IX_Inscripcion_grupo ON Inscripcion(grupo_id, estado);
  -- un envío del sitio se importa una sola vez aunque el admin reintente
  CREATE UNIQUE INDEX UQ_Inscripcion_envio ON Inscripcion(envio_id, persona_ix) WHERE envio_id IS NOT NULL;
END
GO

-- ── ListaEspera: los «avísame» del sitio ──
IF OBJECT_ID('ListaEspera') IS NULL
BEGIN
  CREATE TABLE ListaEspera (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(200) NOT NULL,
    correo NVARCHAR(200) NOT NULL,
    interes NVARCHAR(30) NOT NULL,                            -- slug de herramienta o 'otro'
    paga NVARCHAR(8) NOT NULL DEFAULT 'yo',
    contexto NVARCHAR(30) NULL,                               -- de qué parte de la página lo pidió
    grupo_referencia NVARCHAR(50) NULL,                       -- código del grupo lleno / sin fecha que lo originó
    estado NVARCHAR(12) NOT NULL DEFAULT 'nueva',             -- 'nueva' | 'avisada' | 'descartada'
    envio_id NVARCHAR(64) NULL,
    utm_source NVARCHAR(120) NULL,
    utm_medium NVARCHAR(120) NULL,
    utm_campaign NVARCHAR(120) NULL,
    notas NVARCHAR(MAX) NULL,
    fecha_creacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    fecha_estado DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_ListaEspera_paga CHECK (paga IN ('yo', 'empresa')),
    CONSTRAINT CK_ListaEspera_estado CHECK (estado IN ('nueva', 'avisada', 'descartada'))
  );
  CREATE INDEX IX_ListaEspera_estado ON ListaEspera(estado, interes);
  CREATE UNIQUE INDEX UQ_ListaEspera_envio ON ListaEspera(envio_id) WHERE envio_id IS NOT NULL;
END
GO
