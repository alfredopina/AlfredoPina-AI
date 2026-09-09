-- alfredopina.ai — Backoffice SQL
-- Fase 1 del roadmap (bloque Comercial) — misma base apcweb-backoffice que ya
-- usan Diplomas/Encuestas. Esta pasada solo entrega Clientes/Contactos/Tarifas,
-- pero deja el esquema COMPLETO de Solicitud/Cotizacion listo de una vez, para
-- que esas dos fases (1.1 y 1.2) solo tengan que construir Functions/UI encima
-- sin volver a tocar el modelo de datos.
--
-- Cómo correrlo: portal de Azure → apcweb-backoffice → "Query editor (preview)"
-- (o SSMS/Azure Data Studio), pega y ejecuta este script completo.

ALTER TABLE Cliente ADD notas NVARCHAR(MAX) NULL;

CREATE TABLE Contacto (
    id INT IDENTITY(1,1) PRIMARY KEY,
    cliente_id INT NOT NULL,
    nombre NVARCHAR(200) NOT NULL,
    correo NVARCHAR(200) NULL,
    telefono NVARCHAR(30) NULL,
    tiene_whatsapp BIT NOT NULL DEFAULT 0,
    area NVARCHAR(100) NULL,
    es_principal BIT NOT NULL DEFAULT 0,
    fecha_creacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Contacto_Cliente FOREIGN KEY (cliente_id) REFERENCES Cliente(id)
);

CREATE INDEX IX_Contacto_cliente_id ON Contacto(cliente_id);

-- TarifaHerramienta se administra desde ya (Configuración → Tarifas) — Cotizacion
-- (Fase 1.2) la va a leer para calcular precio_sugerido, pero el precio final
-- siempre se guarda como valor fijo en la Cotización (precio_final), nunca como
-- referencia viva a esta tabla — si Alfredo sube una tarifa mañana, las
-- cotizaciones ya emitidas no deben cambiar de precio solas.
CREATE TABLE TarifaHerramienta (
    herramienta NVARCHAR(50) NOT NULL PRIMARY KEY,
    precio_hora DECIMAL(10,2) NOT NULL
);

INSERT INTO TarifaHerramienta (herramienta, precio_hora) VALUES
('excel', 1200.00),
('powerbi', 1200.00),
('powerapps', 1200.00),
('powerautomate', 1200.00),
('ia', 1200.00),
('ofimatica', 1200.00);

-- Solicitud y Cotizacion: esquema completo, sin Functions todavía (llegan en
-- Fase 1.1 y 1.2). temas_json es una FOTO de los temas al momento de crear el
-- registro (snapshot [{temaId,nombre,horas,nivel}]) — no una referencia viva a
-- Temas/TemariosEstandar, que viven en Table Storage, no en esta base; así se
-- evita necesitar JOINs entre las dos bases (decisión ya tomada, ver CLAUDE.md
-- sesión 2026-09-08).
CREATE TABLE Solicitud (
    id INT IDENTITY(1,1) PRIMARY KEY,
    cliente_id INT NOT NULL,
    contacto_id INT NULL,
    herramienta NVARCHAR(50) NOT NULL,
    temario_tipo NVARCHAR(20) NOT NULL,
    temario_nombre NVARCHAR(200) NULL,
    temas_json NVARCHAR(MAX) NULL,
    horas_totales DECIMAL(6,1) NULL,
    canal_origen NVARCHAR(20) NOT NULL,
    estatus NVARCHAR(30) NOT NULL DEFAULT 'Nueva',
    notas NVARCHAR(MAX) NULL,
    fecha_creacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Solicitud_Cliente FOREIGN KEY (cliente_id) REFERENCES Cliente(id),
    CONSTRAINT FK_Solicitud_Contacto FOREIGN KEY (contacto_id) REFERENCES Contacto(id),
    CONSTRAINT CK_Solicitud_temario_tipo CHECK (temario_tipo IN ('estandar', 'personalizado')),
    CONSTRAINT CK_Solicitud_canal_origen CHECK (canal_origen IN ('Manual', 'Sitio'))
);

CREATE INDEX IX_Solicitud_cliente_id ON Solicitud(cliente_id);

CREATE TABLE Cotizacion (
    id INT IDENTITY(1,1) PRIMARY KEY,
    folio NVARCHAR(40) NOT NULL,
    solicitud_id INT NULL,
    cliente_id INT NOT NULL,
    contacto_id INT NULL,
    herramienta NVARCHAR(50) NOT NULL,
    temario_tipo NVARCHAR(20) NOT NULL,
    temario_nombre NVARCHAR(200) NULL,
    temas_json NVARCHAR(MAX) NULL,
    horas DECIMAL(6,1) NOT NULL,
    precio_sugerido DECIMAL(10,2) NULL,
    descuento_pct DECIMAL(5,2) NULL,
    precio_final DECIMAL(10,2) NOT NULL,
    fecha_creacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    fecha_envio DATETIME2 NULL,
    fecha_vigencia DATE NULL,
    estatus NVARCHAR(30) NOT NULL DEFAULT 'Borrador',
    reemplaza_a_folio NVARCHAR(40) NULL,
    blob_path NVARCHAR(300) NULL,
    CONSTRAINT UQ_Cotizacion_folio UNIQUE (folio),
    CONSTRAINT FK_Cotizacion_Solicitud FOREIGN KEY (solicitud_id) REFERENCES Solicitud(id),
    CONSTRAINT FK_Cotizacion_Cliente FOREIGN KEY (cliente_id) REFERENCES Cliente(id),
    CONSTRAINT FK_Cotizacion_Contacto FOREIGN KEY (contacto_id) REFERENCES Contacto(id),
    CONSTRAINT FK_Cotizacion_ReemplazaA FOREIGN KEY (reemplaza_a_folio) REFERENCES Cotizacion(folio),
    CONSTRAINT CK_Cotizacion_temario_tipo CHECK (temario_tipo IN ('estandar', 'personalizado')),
    CONSTRAINT CK_Cotizacion_estatus CHECK (estatus IN ('Borrador', 'Enviada', 'En negociación', 'Ganada', 'Perdida', 'Expirada', 'Reemplazada'))
);

CREATE INDEX IX_Cotizacion_cliente_id ON Cotizacion(cliente_id);
CREATE INDEX IX_Cotizacion_solicitud_id ON Cotizacion(solicitud_id);
