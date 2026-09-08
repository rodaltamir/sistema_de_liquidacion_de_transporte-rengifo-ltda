from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Float, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

class UnidadTransporte(Base):
    """
    Equipos / Flota de Camiones y Cisternas que realizan los viajes de transporte de hidrocarburos/carga.
    Registra datos técnicos, capacidades en litros/m3, compartimentos, conductor, propietario y documentación.
    """
    __tablename__ = "unidades_transporte"
    __table_args__ = {"schema": "tenant"}

    id = Column(Integer, primary_key=True, index=True)
    placa = Column(String(50), unique=True, index=True, nullable=False)  # ej. "4412-DPC"
    marca = Column(String(100), nullable=True)  # ej. "Volvo FH", "Scania R440"
    modelo_ano = Column(String(50), nullable=True)  # ej. "2020"
    color = Column(String(50), nullable=True)
    tipo_unidad = Column(String(100), default="Cisterna Combustible")  # Cisterna, Tractocamión Cisterna, Camión Plataforma
    capacidad_litros = Column(Float, default=34000.0)  # ej. 34000.0 Litros
    capacidad_m3 = Column(Float, default=34.0)          # ej. 34.0 m3
    num_compartimentos = Column(Integer, default=4)

    # Conductor asignado
    conductor_nombre = Column(String(200), nullable=True)
    conductor_ci = Column(String(50), nullable=True)
    conductor_telefono = Column(String(50), nullable=True)
    conductor_licencia = Column(String(50), nullable=True)

    # Propietario del camión
    propietario_nombre = Column(String(200), nullable=True)
    propietario_ci = Column(String(50), nullable=True)
    propietario_telefono = Column(String(50), nullable=True)

    # Documentación técnica y habilitación (YPFB / ANH / Senasac / Tránsito)
    soat_numero = Column(String(100), nullable=True)
    soat_vencimiento = Column(Date, nullable=True)
    b_sisa = Column(String(100), nullable=True)
    cert_calibracion_senasac = Column(String(100), nullable=True)
    inspeccion_tecnica = Column(String(100), nullable=True)

    estado = Column(String(50), default="Activo")  # "Activo", "En Ruta", "Mantenimiento", "Inactivo"
    notas = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    viajes = relationship("Viaje", back_populates="unidad")


class ParametroLiquidacion(Base):
    """
    Panel de Control / Configuración de Parámetros de Liquidación y Descuentos.
    Contiene las tasas de tolerancia de mermas, tarifas, descuentos normativos (Ley 843, comisiones,
    garantías BOL-GART YPFB, hojas de ruta, GPS) y firmas autorizadas de la empresa.
    """
    __tablename__ = "parametros_liquidacion"
    __table_args__ = {"schema": "tenant"}

    id = Column(Integer, primary_key=True, index=True)
    
    # Tipo de Cambio (USD a BOB)
    tipo_cambio_usd_bob = Column(Float, default=6.96)
    
    # Tolerancias de Merma por producto (YPFB estándar)
    merma_tolerancia_diesel_pct = Column(Float, default=0.15)    # 0.15% YPFB Diesel
    merma_tolerancia_gasolina_pct = Column(Float, default=0.25)  # 0.25% YPFB Gasolina
    merma_tolerancia_iya_pct = Column(Float, default=0.20)       # 0.20% Insumos y Aditivos
    merma_tolerancia_crudo_pct = Column(Float, default=0.15)     # 0.15% Petróleo Crudo

    # Precios de Merma de Referencia (Bs/Litro)
    precio_merma_diesel_litro_bs = Column(Float, default=3.72)
    precio_merma_gasolina_litro_bs = Column(Float, default=3.74)
    precio_merma_general_bs = Column(Float, default=7.45)        # Como en la Hoja 2 del PDF

    # Deducciones contractuales y comisiones
    comision_usd_m3 = Column(Float, default=1.00)                 # Descuento Comisión 1 $us p/m3
    comision_pct_1 = Column(Float, default=7.0)                  # Descuento Comisión 7% (Retención / Administración)
    comision_ypfb_bolgart_pct = Column(Float, default=7.0)       # Descuento YPFB BOL-GART 7% (Garantía de Transporte)
    comision_pct_2 = Column(Float, default=3.0)                  # Descuento Comisión 3%
    costo_hojas_de_ruta_bs = Column(Float, default=240.00)       # Hojas de Ruta
    costo_gps_bs = Column(Float, default=135.00)                 # GPS / Monitoreo Satelital
    anticipos_otros_pct = Column(Float, default=0.0)             # Anticipos y Otros

    # Nombres y cargos para las firmas en las planillas (Páginas 2 y 3 del PDF)
    firma_realizado_por = Column(String(200), default="JAQUELINE LOVERA TIÑINI")
    firma_revisado_por = Column(String(200), default="JOSE LOVERA TIÑINI / GERENTE GENERAL")
    firma_autorizado_por = Column(String(200), default="DIRECTORIO")
    firma_cancelado_por = Column(String(200), default="TOMASA TIÑINI MITA / APOYO")

    # Cláusula legal que rige la liquidación
    leyenda_legal = Column(Text, default="Conforme lo establece la Ley 843 en su Art. 4 y de acuerdo a la cláusula contractual de Facturación y Pago, el momento en que finalizará la ejecución o la prestación del Servicio se origina después de realizada la Conciliación (Acta de Conformidad por la Comisión de Recepción) y emitida la planilla de Liquidación.")
    
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())


class Viaje(Base):
    """
    Registro de Viajes / Despachos de Fletes.
    Detalla tramo, fechas de carga/descarga, producto, volúmenes de origen y recepción,
    cálculo automático de merma real, merma tolerable, merma excedente a descontar y flete bruto.
    """
    __tablename__ = "viajes"
    __table_args__ = {"schema": "tenant"}

    id = Column(Integer, primary_key=True, index=True)
    mic_dta = Column(String(100), nullable=True, index=True)  # ej. "23BO051130T", "23CL257330A"
    lote_codigo = Column(String(100), nullable=True)          # ej. "LOTE 1"
    
    unidad_id = Column(Integer, ForeignKey("tenant.unidades_transporte.id", ondelete="SET NULL"), nullable=True)
    placa = Column(String(50), nullable=False, index=True)    # ej. "4412-DPC"
    tramo = Column(String(255), nullable=False)               # ej. "ARICA - TAMBO QUEMADO - LA PAZ"
    cliente = Column(String(150), default="YPFB")
    producto = Column(String(100), default="GASOLINA")        # DIESEL, GASOLINA, IYA, DO, CRUDO

    fecha_carga = Column(Date, nullable=False)
    fecha_descarga = Column(Date, nullable=False)
    periodo_mes = Column(String(20), nullable=False, index=True)  # ej. "2023-03" (mar.-22 o mar.-23)

    # Volúmenes
    volumen_origen_litros = Column(Float, nullable=False)        # ej. 33999.0
    volumen_recepcionado_litros = Column(Float, nullable=False)  # ej. 33900.0

    # Mermas
    merma_real_litros = Column(Float, default=0.0)               # volumen_origen - volumen_recepcionado (-99.0)
    tolerancia_pct = Column(Float, default=0.25)                 # ej. 0.25% Gasolina, 0.15% Diesel
    merma_tolerable_litros = Column(Float, default=0.0)          # volumen_origen * % (85.0)
    merma_excedente_litros = Column(Float, default=0.0)          # Exceso sobre tolerancia (14.0)
    precio_merma_litro_bs = Column(Float, default=7.45)
    merma_descontar_bs = Column(Float, default=0.0)              # 104.30 Bs

    # Flete y tarifa
    tarifa_flete = Column(Float, nullable=False)                 # ej. 392.00 Bs o 503.61 $us/m3
    tipo_tarifa = Column(String(50), default="BS_POR_M3")        # "BS_POR_M3", "USD_POR_M3", "BS_TOTAL_VIAJE"
    flete_total_bs = Column(Float, nullable=False)               # ej. 13288.80 Bs

    # Estado y relación
    estado = Column(String(50), default="Pendiente")             # "Pendiente", "Liquidado", "Conciliado"
    liquidacion_id = Column(Integer, ForeignKey("tenant.liquidaciones.id", ondelete="SET NULL"), nullable=True)
    observaciones = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    unidad = relationship("UnidadTransporte", back_populates="viajes")
    liquidacion = relationship("Liquidacion", back_populates="viajes_items")


class Liquidacion(Base):
    """
    Planilla de Liquidación Mensual de Fletes por Placa (Camión).
    Representa exactamente las Hojas 2 y 3 del PDF:
    - Hoja 2: Detalle de viajes, volúmenes, mermas, tarifas y fletes.
    - Hoja 3: Cuadro de deducciones (Mermas, Comisiones 1 $us/m3, 7%, BOL-GART 7%, 3%, Hojas de Ruta, GPS) y Líquido Pagable.
    """
    __tablename__ = "liquidaciones"
    __table_args__ = {"schema": "tenant"}

    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String(100), unique=True, index=True)        # ej. "LIQ-2023-03-4412-DPC"
    periodo_mes = Column(String(20), nullable=False, index=True) # ej. "2023-03"
    placa = Column(String(50), nullable=False, index=True)       # ej. "4412-DPC"
    fecha_emision = Column(Date, nullable=False)

    # Resumen Operativo (Página 2)
    total_viajes = Column(Integer, default=0)
    total_volumen_origen_litros = Column(Float, default=0.0)
    total_volumen_recepcionado_litros = Column(Float, default=0.0)
    total_merma_real_litros = Column(Float, default=0.0)
    total_merma_excedente_litros = Column(Float, default=0.0)
    flete_total_bruto_bs = Column(Float, default=0.0)            # ej. 75543.71 Bs

    # Desglose de Deducciones y Comisiones (Página 3)
    desc_merma_bs = Column(Float, default=0.0)                   # 104.30 Bs
    desc_comision_usd_m3_bs = Column(Float, default=0.0)         # 935.73 Bs
    desc_comision_7pct_bs = Column(Float, default=0.0)           # 5288.06 Bs
    desc_comision_ypfb_bolgart_7pct_bs = Column(Float, default=0.0) # 5288.06 Bs
    desc_comision_3pct_bs = Column(Float, default=0.0)           # 2266.31 Bs
    desc_hojas_ruta_bs = Column(Float, default=0.0)              # 240.00 Bs
    desc_gps_bs = Column(Float, default=0.0)                     # 135.00 Bs
    desc_anticipos_otros_bs = Column(Float, default=0.0)         # 0.00 Bs
    desc_otros_ajustes_bs = Column(Float, default=0.0)

    total_descuentos_bs = Column(Float, default=0.0)             # 14257.46 Bs
    liquido_pagable_bs = Column(Float, default=0.0)              # 61286.25 Bs

    # Firmas congeladas al momento de generar la liquidación
    firmas_json = Column(Text, nullable=True)
    estado = Column(String(50), default="Generada")              # "Borrador", "Generada", "Pagada", "Anulada"
    notas = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    viajes_items = relationship("Viaje", back_populates="liquidacion")
