-- alfredopina.ai — Backoffice SQL
-- Encuestas (Fase 3.1 de Cierre) — corre sobre la misma base apcweb-backoffice
-- que ya usa Diplomas. Reusa la tabla Cliente que Diplomas ya creó (Fase 3.2,
-- adelantada) — no se vuelve a crear aquí.
--
-- Cómo correrlo: portal de Azure → apcweb-backoffice → "Query editor (preview)"
-- (o SSMS/Azure Data Studio), pega y ejecuta este script completo.

CREATE TABLE EncuestaPregunta (
    id INT IDENTITY(1,1) PRIMARY KEY,
    seccion NVARCHAR(50) NOT NULL,
    texto NVARCHAR(300) NOT NULL,
    tipo NVARCHAR(20) NOT NULL,
    orden INT NOT NULL DEFAULT 0,
    activa BIT NOT NULL DEFAULT 1,
    CONSTRAINT CK_EncuestaPregunta_seccion CHECK (seccion IN ('Instructor', 'Curso y Materiales')),
    CONSTRAINT CK_EncuestaPregunta_tipo CHECK (tipo IN ('escala', 'texto'))
);

CREATE TABLE EncuestaRespuesta (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(200) NULL,
    cliente_id INT NOT NULL,
    curso NVARCHAR(200) NOT NULL,
    instructor NVARCHAR(120) NOT NULL,
    fecha DATE NOT NULL,
    fecha_envio DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_EncuestaRespuesta_Cliente FOREIGN KEY (cliente_id) REFERENCES Cliente(id)
);

-- pregunta_id es una referencia SIN FK a propósito: eliminarPregunta borra la
-- fila de EncuestaPregunta pero deja intactas las respuestas ya guardadas (son
-- historial, no se tocan). Si hubiera FK, borrar una pregunta con respuestas
-- fallaría (o, con CASCADE, borraría también el historial) — ninguna de las
-- dos es lo que se quiere. listRespuestasEncuesta hace LEFT JOIN y muestra
-- "(pregunta eliminada)" cuando ya no encuentra la pregunta viva.
CREATE TABLE EncuestaRespuestaDetalle (
    id INT IDENTITY(1,1) PRIMARY KEY,
    respuesta_id INT NOT NULL,
    pregunta_id INT NOT NULL,
    valor NVARCHAR(500) NOT NULL,
    CONSTRAINT FK_EncuestaRespuestaDetalle_Respuesta FOREIGN KEY (respuesta_id) REFERENCES EncuestaRespuesta(id)
);

CREATE INDEX IX_EncuestaRespuesta_cliente_id ON EncuestaRespuesta(cliente_id);
CREATE INDEX IX_EncuestaRespuestaDetalle_respuesta_id ON EncuestaRespuestaDetalle(respuesta_id);

-- Semilla — 10 preguntas de escala (5 Instructor, 5 Curso y Materiales) + 1 de
-- texto. Textos de ejemplo razonables; Alfredo los ajusta desde el admin →
-- Encuestas → Preguntas en cuanto tenga los definitivos, sin tocar código.
INSERT INTO EncuestaPregunta (seccion, texto, tipo, orden, activa) VALUES
('Instructor', 'El instructor domina los temas del curso', 'escala', 10, 1),
('Instructor', 'El instructor explica con claridad', 'escala', 20, 1),
('Instructor', 'El instructor resuelve dudas de forma efectiva', 'escala', 30, 1),
('Instructor', 'El instructor mantiene el interés del grupo', 'escala', 40, 1),
('Instructor', 'El instructor administra bien el tiempo de la sesión', 'escala', 50, 1),
('Curso y Materiales', 'El contenido del curso cumplió tus expectativas', 'escala', 60, 1),
('Curso y Materiales', 'Los materiales y ejercicios fueron útiles', 'escala', 70, 1),
('Curso y Materiales', 'La duración del curso fue adecuada', 'escala', 80, 1),
('Curso y Materiales', 'El nivel del curso fue el correcto para tu experiencia previa', 'escala', 90, 1),
('Curso y Materiales', 'Recomendarías este curso a un colega', 'escala', 100, 1),
('Instructor', 'Comentarios para tu instructor', 'texto', 110, 1);
