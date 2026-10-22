/*
  040 — Cobranza (Fase 1: libreta de cobros)

  CuentaPorCobrar = una FACTURA por cobrar (una Cotización ganada puede tener varias: anticipos/parcialidades).
  Pago = filas aparte; el saldo y el total pagado se CALCULAN, nunca son columnas editables.
  - subtotal / iva / total explícitos: la Cotización va ANTES de impuestos (precio_final = subtotal), el IVA se suma aparte.
  - vencimiento se calcula: inicio_plazo + plazo_dias (en gobierno el inicio es el contra-recibo, no la fecha de factura).
  - estatus: Por facturar → Facturada → Parcial → Pagada, y Cancelada. Parcial/Pagada se recalculan al registrar o anular un
    pago (misma transacción); Cancelada es manual. Nada se borra: un pago mal capturado se ANULA (anulado = 1).
  - folio_factura / uuid_factura / rfc_receptor: capturados a mano hoy; quedan listos para leerse/sincronizarse de Facturama
    después sin migrar nada. Un mismo complemento de pago puede cubrir varias facturas (uuid_complemento repetible).
  - Una sola cuenta 'Automática' por cotización (índice único filtrado): el hook de "Ganada" es idempotente por ahí.

  Idempotente; correrlo ANTES de desplegar.
  Cómo correrlo: portal de Azure → apcweb-backoffice → Query editor (preview), pega y ejecuta este script completo.
*/

IF OBJECT_ID('CuentaPorCobrar') IS NULL
BEGIN
  CREATE TABLE CuentaPorCobrar (
    id INT IDENTITY(1,1) PRIMARY KEY,
    cliente_id INT NOT NULL,
    cotizacion_id INT NULL,
    grupo_id INT NULL,
    origen NVARCHAR(12) NOT NULL DEFAULT 'Manual',            -- 'Automática' (nació al ganar la cotización) | 'Manual'
    estrategia NVARCHAR(12) NOT NULL DEFAULT 'empresas',      -- 'empresas' | 'abiertos'
    concepto NVARCHAR(300) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    iva DECIMAL(12,2) NOT NULL DEFAULT 0,
    total DECIMAL(12,2) NOT NULL,
    folio_factura NVARCHAR(40) NULL,
    uuid_factura NVARCHAR(40) NULL,
    rfc_receptor NVARCHAR(15) NULL,
    fecha_emision DATE NULL,
    orden_compra NVARCHAR(60) NULL,
    inicio_plazo DATE NULL,
    plazo_dias INT NOT NULL DEFAULT 30,
    vencimiento AS DATEADD(day, plazo_dias, inicio_plazo),
    estatus NVARCHAR(15) NOT NULL DEFAULT 'Por facturar',
    fecha_estatus DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    notas NVARCHAR(MAX) NULL,
    fecha_creacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_CxC_Cliente FOREIGN KEY (cliente_id) REFERENCES Cliente(id),
    CONSTRAINT FK_CxC_Cotizacion FOREIGN KEY (cotizacion_id) REFERENCES Cotizacion(id),
    CONSTRAINT FK_CxC_Grupo FOREIGN KEY (grupo_id) REFERENCES Grupo(id),
    CONSTRAINT CK_CxC_origen CHECK (origen IN ('Automática', 'Manual')),
    CONSTRAINT CK_CxC_estrategia CHECK (estrategia IN ('empresas', 'abiertos')),
    CONSTRAINT CK_CxC_estatus CHECK (estatus IN ('Por facturar', 'Facturada', 'Parcial', 'Pagada', 'Cancelada')),
    CONSTRAINT CK_CxC_montos CHECK (subtotal >= 0 AND iva >= 0 AND total >= 0),
    CONSTRAINT CK_CxC_plazo CHECK (plazo_dias BETWEEN 0 AND 365)
  );
  CREATE INDEX IX_CxC_cliente_id ON CuentaPorCobrar(cliente_id);
  CREATE INDEX IX_CxC_cotizacion_id ON CuentaPorCobrar(cotizacion_id);
  CREATE INDEX IX_CxC_estatus ON CuentaPorCobrar(estatus);
  -- una sola cuenta AUTOMÁTICA por cotización: aunque se marque Ganada dos veces, nunca se duplica
  CREATE UNIQUE INDEX UQ_CxC_automatica_cotizacion ON CuentaPorCobrar(cotizacion_id) WHERE origen = 'Automática' AND cotizacion_id IS NOT NULL;
END
GO

IF OBJECT_ID('PagoCobranza') IS NULL
BEGIN
  CREATE TABLE PagoCobranza (
    id INT IDENTITY(1,1) PRIMARY KEY,
    cuenta_id INT NOT NULL,
    fecha DATE NULL,                                           -- NULL = histórico "sin fecha" (el Excel de 2026 no la trae)
    monto DECIMAL(12,2) NOT NULL,
    metodo NVARCHAR(30) NULL,
    uuid_complemento NVARCHAR(40) NULL,
    folio_complemento NVARCHAR(40) NULL,
    notas NVARCHAR(300) NULL,
    anulado BIT NOT NULL DEFAULT 0,
    fecha_anulado DATETIME2 NULL,
    fecha_creacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Pago_Cuenta FOREIGN KEY (cuenta_id) REFERENCES CuentaPorCobrar(id),
    CONSTRAINT CK_Pago_monto CHECK (monto > 0)
  );
  CREATE INDEX IX_Pago_cuenta_id ON PagoCobranza(cuenta_id);
END
GO
