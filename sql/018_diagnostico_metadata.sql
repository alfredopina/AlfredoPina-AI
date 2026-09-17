-- alfredopina.ai — Backoffice SQL
-- Diagnóstico — Fase 1 de la ronda de afinación 2026-09-17: agrega metadata
-- nueva a DiagnosticoRespuesta (area/correo/tiempo_respuesta_seg — las 3
-- opcionales, capturadas por diagnostico.html a partir de la Fase 2) y
-- permite la opción fija "No lo sé" en
-- DiagnosticoRespuestaDetalle.opcion_seleccionada (letra 'N', cuenta siempre
-- como incorrecta — nunca se compara contra opcion_correcta, que solo puede
-- ser A/B/C/D).
--
-- 100% aditivo — no toca ninguna fila existente de DiagnosticoRespuesta ni
-- DiagnosticoRespuestaDetalle, y NO toca en absoluto el banco de preguntas
-- (vive en Table Storage, ni siquiera es esta base — el banco real que
-- Alfredo está cargando en paralelo no corre ningún riesgo con este script).
-- Seguro de volver a correr: cada bloque revisa si ya se aplicó antes de
-- tocar algo, mismo patrón idempotente que sql/006/sql/014.
--
-- Cómo correrlo: portal de Azure → apcweb-backoffice → "Query editor
-- (preview)", pega y ejecuta completo.

IF COL_LENGTH('DiagnosticoRespuesta', 'area') IS NULL
  ALTER TABLE DiagnosticoRespuesta ADD area NVARCHAR(150) NULL;
GO

IF COL_LENGTH('DiagnosticoRespuesta', 'correo') IS NULL
  ALTER TABLE DiagnosticoRespuesta ADD correo NVARCHAR(200) NULL;
GO

IF COL_LENGTH('DiagnosticoRespuesta', 'tiempo_respuesta_seg') IS NULL
  ALTER TABLE DiagnosticoRespuesta ADD tiempo_respuesta_seg INT NULL;
GO

-- Amplía el CHECK para aceptar 'N' junto a A/B/C/D — mismo patrón de "tirar y
-- recrear el constraint" ya usado en sql/017 (Encuestas), ver CLAUDE.md →
-- "Ya resueltos" para la lección de por qué no basta con intentar agregar el
-- valor directo sobre un CHECK que ya existe.
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_DiagnosticoRespuestaDetalle_opcion')
  ALTER TABLE DiagnosticoRespuestaDetalle DROP CONSTRAINT CK_DiagnosticoRespuestaDetalle_opcion;
GO

ALTER TABLE DiagnosticoRespuestaDetalle
  ADD CONSTRAINT CK_DiagnosticoRespuestaDetalle_opcion CHECK (opcion_seleccionada IN ('A', 'B', 'C', 'D', 'N'));
GO
