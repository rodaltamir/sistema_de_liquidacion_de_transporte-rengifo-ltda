from datetime import date
from sqlalchemy.orm import Session
from app.db.session import SessionLocal, get_tenant_session
from app.core.security import get_password_hash
from app.models.public import User, Asociacion, Empresa
from app.models.tenant import UnidadTransporte, ParametroLiquidacion, Viaje, Liquidacion
from app.api.empresas import init_tenant_schema
from app.services.calculation_engine import calculate_viaje_values, calculate_liquidacion_resumen
import json

def seed():
    from app.db.base_class import Base
    from app.db.session import engine
    from app.models.public import User, Asociacion, Empresa
    public_tables = [User.__table__, Asociacion.__table__, Empresa.__table__]
    Base.metadata.create_all(bind=engine, tables=public_tables)

    db = SessionLocal()
    try:
        print("Iniciando sembrado de base de datos...")

        # 1. Usuarios
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(
                name="Administrador General",
                username="admin",
                email="admin@transporte.com",
                hashed_password=get_password_hash("admin123"),
                role="admin"
            )
            db.add(admin)
            print("Usuario 'admin' creado (pass: admin123)")

        operador = db.query(User).filter(User.username == "usuario").first()
        if not operador:
            operador = User(
                name="Operador de Liquidaciones",
                username="usuario",
                email="operador@transporte.com",
                hashed_password=get_password_hash("user123"),
                role="user"
            )
            db.add(operador)
            print("Usuario 'usuario' creado (pass: user123)")

        db.commit()

        # 2. Asociación (Página 1 del PDF)
        asoc_andina = db.query(Asociacion).filter(Asociacion.name.ilike("%ANDINA%")).first()
        if not asoc_andina:
            asoc_andina = Asociacion(
                name="ASOC. ANDINA ASOCIADOS",
                sigla="ANDINA ASOCIADOS",
                nit="1029384756",
                representante_legal="Lic. Rolando Choque Gutiérrez",
                direccion="Av. 6 de Marzo Km 5, El Alto, La Paz",
                telefono="22819000",
                email="contacto@asoc-andina.bo"
            )
            db.add(asoc_andina)
            db.commit()
            db.refresh(asoc_andina)
            print(f"Asociación '{asoc_andina.name}' creada.")

        # 3. Empresa 1 (Asociada): BRITANIC S.R.L. (Página 1 del PDF)
        emp_britanic = db.query(Empresa).filter(Empresa.schema_name == "empresa_britanic").first()
        if not emp_britanic:
            emp_britanic = Empresa(
                name='EMPRESA DE TRANSPORTES NACIONAL E INTERNACIONAL "BRITANIC S.R.L."',
                schema_name="empresa_britanic",
                nit="1024567890",
                asociacion_id=asoc_andina.id,
                representante_legal="Ing. Javier Britanic",
                direccion="Zona Franca El Alto, Calle 4 Nº 200",
                telefono="71520030",
                email="administracion@britanic-trans.bo",
                icon="Truck"
            )
            db.add(emp_britanic)
            db.commit()
            db.refresh(emp_britanic)
            init_tenant_schema("empresa_britanic")
            print("Empresa Britanic S.R.L. creada con su esquema dedicado.")

        # 4. Empresa 2 (Asociada): TRUCK'S DRIVERS S.R.L. (Página 1 del PDF)
        emp_trucks = db.query(Empresa).filter(Empresa.schema_name == "empresa_trucks_drivers").first()
        if not emp_trucks:
            emp_trucks = Empresa(
                name="TRUCK'S DRIVERS S.R.L.",
                schema_name="empresa_trucks_drivers",
                nit="1039847291",
                asociacion_id=asoc_andina.id,
                representante_legal="Sr. Carlos Mamani Ticona",
                direccion="Carretera a Oruro Km 12",
                telefono="72099881",
                email="contacto@trucksdrivers.bo",
                icon="Truck"
            )
            db.add(emp_trucks)
            db.commit()
            db.refresh(emp_trucks)
            init_tenant_schema("empresa_trucks_drivers")
            print("Empresa Truck's Drivers S.R.L. creada con su esquema dedicado.")

        # 5. Empresa 3 (Independiente): CHAXMANA TRANSPORT Ltda. (Páginas 2 y 3 del PDF)
        emp_chaxmana = db.query(Empresa).filter(Empresa.schema_name == "empresa_chaxmana").first()
        if not emp_chaxmana:
            emp_chaxmana = Empresa(
                name="CHAXMANA TRANSPORT Ltda.",
                schema_name="empresa_chaxmana",
                nit="2049182039",
                asociacion_id=None,  # EMPRESA INDEPENDIENTE!
                representante_legal="JOSE LOVERA TIÑINI",
                direccion="Av. Litoral Nº 850, El Alto",
                telefono="77299100",
                email="administracion@chaxmanatransport.bo",
                icon="Truck"
            )
            db.add(emp_chaxmana)
            db.commit()
            db.refresh(emp_chaxmana)
            init_tenant_schema("empresa_chaxmana")
            print("Empresa CHAXMANA TRANSPORT Ltda. (Independiente) creada.")

        # -------------------------------------------------------------
        # POBLAR DATOS PARA CHAXMANA TRANSPORT (Páginas 2 y 3 del PDF)
        # -------------------------------------------------------------
        s_chax = get_tenant_session("empresa_chaxmana")
        try:
            # Configuración de parámetros
            p_chax = s_chax.query(ParametroLiquidacion).first()
            if not p_chax:
                p_chax = ParametroLiquidacion()
                s_chax.add(p_chax)
            
            p_chax.tipo_cambio_usd_bob = 6.96
            p_chax.precio_merma_general_bs = 7.45
            p_chax.merma_tolerancia_gasolina_pct = 0.25
            p_chax.merma_tolerancia_diesel_pct = 0.15
            p_chax.comision_usd_m3 = 1.00
            p_chax.comision_pct_1 = 7.0
            p_chax.comision_ypfb_bolgart_pct = 7.0
            p_chax.comision_pct_2 = 3.0
            p_chax.costo_hojas_de_ruta_bs = 240.00
            p_chax.costo_gps_bs = 135.00
            p_chax.firma_realizado_por = "JAQUELINE LOVERA TIÑINI"
            p_chax.firma_revisado_por = "JOSE LOVERA TIÑINI / GERENTE GENERAL"
            p_chax.firma_autorizado_por = "DIRECTORIO"
            p_chax.firma_cancelado_por = "TOMASA TIÑINI MITA / APOYO"
            s_chax.commit()

            # Unidad de transporte 4412-DPC
            u_4412 = s_chax.query(UnidadTransporte).filter(UnidadTransporte.placa == "4412-DPC").first()
            if not u_4412:
                u_4412 = UnidadTransporte(
                    placa="4412-DPC",
                    marca="Volvo FH12",
                    modelo_ano="2019",
                    tipo_unidad="Tractocamión Cisterna Combustible",
                    capacidad_litros=34000.0,
                    capacidad_m3=34.0,
                    num_compartimentos=4,
                    conductor_nombre="Jaqueline Lovera Tiñini",
                    conductor_ci="4892819 LP",
                    propietario_nombre="Jose Lovera Tiñini",
                    propietario_ci="3928190 LP",
                    soat_numero="SOAT-2026-9921",
                    b_sisa="B-SISA-88129",
                    cert_calibracion_senasac="CAL-IBMETRO-2025-09",
                    estado="Activo"
                )
                s_chax.add(u_4412)
                s_chax.commit()

            # Viajes de CHAXMANA en marzo 2023 (Página 2 del PDF)
            viajes_chax_defs = [
                {
                    "mic_dta": "23BO051130T",
                    "tramo": "ARICA - TAMBO QUEMADO - LA PAZ",
                    "cliente": "YPFB",
                    "producto": "GASOLINA",
                    "fecha_carga": date(2023, 2, 26),
                    "fecha_descarga": date(2023, 3, 3),
                    "volumen_origen_litros": 33999.0,
                    "volumen_recepcionado_litros": 33900.0,
                    "tarifa_flete": 392.00,
                    "precio_merma_litro_bs": 7.45,
                    "periodo_mes": "2023-03"
                },
                {
                    "mic_dta": "23CL257330A",
                    "tramo": "IQUIQUE - TAMBO QUEMADO - LA PAZ",
                    "cliente": "YPFB",
                    "producto": "DIESEL",
                    "fecha_carga": date(2023, 3, 8),
                    "fecha_descarga": date(2023, 3, 14),
                    "volumen_origen_litros": 33242.0,
                    "volumen_recepcionado_litros": 33215.0,
                    "tarifa_flete": 738.00,
                    "precio_merma_litro_bs": 7.45,
                    "periodo_mes": "2023-03"
                },
                {
                    "mic_dta": "23BO131667G",
                    "tramo": "ARICA - TAMBO QUEMADO - LA PAZ",
                    "cliente": "YPFB",
                    "producto": "GASOLINA",
                    "fecha_carga": date(2023, 3, 22),
                    "fecha_descarga": date(2023, 3, 25),
                    "volumen_origen_litros": 33999.0,
                    "volumen_recepcionado_litros": 33922.0,
                    "tarifa_flete": 392.00,
                    "precio_merma_litro_bs": 7.45,
                    "periodo_mes": "2023-03"
                },
                {
                    "mic_dta": "23CL280549Y",
                    "tramo": "IQUIQUE - PISIGA - LA PAZ",
                    "cliente": "YPFB",
                    "producto": "DIESEL",
                    "fecha_carga": date(2023, 3, 26),
                    "fecha_descarga": date(2023, 4, 1),
                    "volumen_origen_litros": 33204.0,
                    "volumen_recepcionado_litros": 33168.0,
                    "tarifa_flete": 737.00,
                    "precio_merma_litro_bs": 7.45,
                    "periodo_mes": "2023-03"
                }
            ]

            viajes_creados = []
            for vd in viajes_chax_defs:
                v_exist = s_chax.query(Viaje).filter(Viaje.mic_dta == vd["mic_dta"]).first()
                if not v_exist:
                    calc = calculate_viaje_values(
                        volumen_origen_litros=vd["volumen_origen_litros"],
                        volumen_recepcionado_litros=vd["volumen_recepcionado_litros"],
                        producto=vd["producto"],
                        tarifa_flete=vd["tarifa_flete"],
                        tipo_tarifa="BS_POR_M3",
                        params=p_chax,
                        precio_merma_litro_override=vd["precio_merma_litro_bs"]
                    )
                    v_new = Viaje(
                        mic_dta=vd["mic_dta"],
                        placa="4412-DPC",
                        unidad_id=u_4412.id,
                        tramo=vd["tramo"],
                        cliente=vd["cliente"],
                        producto=vd["producto"],
                        fecha_carga=vd["fecha_carga"],
                        fecha_descarga=vd["fecha_descarga"],
                        periodo_mes=vd["periodo_mes"],
                        volumen_origen_litros=vd["volumen_origen_litros"],
                        volumen_recepcionado_litros=vd["volumen_recepcionado_litros"],
                        merma_real_litros=calc["merma_real_litros"],
                        tolerancia_pct=calc["tolerancia_pct"],
                        merma_tolerable_litros=calc["merma_tolerable_litros"],
                        merma_excedente_litros=calc["merma_excedente_litros"],
                        precio_merma_litro_bs=calc["precio_merma_litro_bs"],
                        merma_descontar_bs=calc["merma_descontar_bs"],
                        tarifa_flete=vd["tarifa_flete"],
                        tipo_tarifa="BS_POR_M3",
                        flete_total_bs=calc["flete_total_bs"],
                        estado="Pendiente"
                    )
                    s_chax.add(v_new)
                    viajes_creados.append(v_new)
                else:
                    viajes_creados.append(v_exist)

            s_chax.commit()

            # Crear la Liquidación del mes 2023-03 para 4412-DPC (exacta a Hojas 2 y 3)
            liq_4412 = s_chax.query(Liquidacion).filter(
                Liquidacion.placa == "4412-DPC",
                Liquidacion.periodo_mes == "2023-03"
            ).first()

            if not liq_4412:
                # Calculo exacto de deducciones (según Hoja 3 del PDF)
                resumen_chax = calculate_liquidacion_resumen(
                    viajes_creados,
                    p_chax,
                    overrides={
                        "desc_merma_bs": 104.30,
                        "desc_comision_usd_m3_bs": 935.73,
                        "desc_comision_7pct_bs": 5288.06,
                        "desc_comision_ypfb_bolgart_7pct_bs": 5288.06,
                        "desc_comision_3pct_bs": 2266.31,
                        "desc_hojas_ruta_bs": 240.00,
                        "desc_gps_bs": 135.00,
                        "desc_anticipos_otros_bs": 0.00
                    }
                )

                firmas_chax = {
                    "realizado_por": "JAQUELINE LOVERA TIÑINI",
                    "revisado_por": "JOSE LOVERA TIÑINI / GERENTE GENERAL",
                    "autorizado_por": "DIRECTORIO",
                    "cancelado_por": "TOMASA TIÑINI MITA / APOYO"
                }

                liq_4412 = Liquidacion(
                    codigo="LIQ-2023-03-4412-DPC",
                    periodo_mes="2023-03",
                    placa="4412-DPC",
                    fecha_emision=date(2023, 4, 2),
                    **resumen_chax,
                    firmas_json=json.dumps(firmas_chax),
                    estado="Generada",
                    notas="Liquidación oficial aprobada conforme contrato YPFB y conciliación física."
                )
                s_chax.add(liq_4412)
                s_chax.commit()
                s_chax.refresh(liq_4412)

                for v in viajes_creados:
                    v.liquidacion_id = liq_4412.id
                    v.estado = "Liquidado"
                s_chax.commit()
                print("Liquidación 2023-03 de 4412-DPC creada con éxito (Líquido: 61,286.25 Bs).")

        finally:
            s_chax.close()

        # -------------------------------------------------------------
        # POBLAR VIAJES DE LA ASOCIACIÓN EN OCTUBRE 2025 (Página 1 del PDF)
        # -------------------------------------------------------------
        # 1. Britanic
        s_brit = get_tenant_session("empresa_britanic")
        try:
            p_brit = s_brit.query(ParametroLiquidacion).first() or ParametroLiquidacion()
            viajes_brit = [
                ("3116-NRP", "Arica - Tambo Quemado - Cochabamba", "DO", date(2025, 10, 4), date(2025, 10, 7), 32001, 31957, 44, 0, 5.670111, 0.0, 31.957, 503.61, 16093.86),
                ("3766-SYX", "Arica - Tambo Quemado - Cochabamba", "IYA", date(2025, 10, 22), date(2025, 10, 26), 33001, 32935, 66, 0, 5.264275, 0.0, 32.935, 503.61, 16586.40),
                ("4414-UFC", "Arica - Tambo Quemado - Cochabamba", "IYA", date(2025, 10, 22), date(2025, 10, 27), 33001, 32927, 74, 0, 5.264275, 0.0, 32.927, 503.61, 16582.37),
                ("6011-NLG", "Arica - Tambo Quemado - Cochabamba", "IYA", date(2025, 10, 22), date(2025, 10, 27), 32999, 32877, 122, 23, 5.264275, 121.08, 32.877, 503.61, 16557.19),
                ("6418-ECX", "Arica - Tambo Quemado - Cochabamba", "IYA", date(2025, 10, 22), date(2025, 10, 27), 32999, 32925, 74, 0, 5.264275, 0.0, 32.925, 503.61, 16581.36),
                ("3766-SYX", "Arica - Tambo Quemado - Potosí", "DO", date(2025, 10, 4), date(2025, 10, 7), 32000, 31963, 37, 0, 5.670111, 0.0, 31.963, 707.48, 22613.18),
                ("4414-UFC", "Arica - Tambo Quemado - Sucre", "DO", date(2025, 10, 4), date(2025, 10, 7), 31998, 32008, -10, 0, 5.670111, 0.0, 31.998, 721.81, 23096.48),
                ("6011-NLG", "Arica - Tambo Quemado - Sucre", "DO", date(2025, 10, 4), date(2025, 10, 7), 32000, 32007, -7, 0, 5.670111, 0.0, 32.000, 721.81, 23097.92),
                ("2540-HXU", "Mollendo - Desaguadero - La Paz", "DO", date(2025, 10, 8), date(2025, 10, 11), 34262, 34118, 144, 144, 6.312489, 909.00, 34.118, 512.43, 17483.09),
                ("2595-SHU", "Mollendo - Desaguadero - La Paz", "DO", date(2025, 10, 28), date(2025, 10, 30), 34601, 34392, 209, 209, 6.090792, 1272.98, 34.392, 512.43, 17623.49),
                ("2887-OLK", "Mollendo - Desaguadero - La Paz", "DO", date(2025, 10, 7), date(2025, 10, 9), 34260, 34164, 96, 27, 6.312491, 170.44, 34.164, 512.43, 17506.66),
            ]

            for pl, tramo, prod, fc, fd, vo, vr, mr, me, pm, md, vf, tf, imp in viajes_brit:
                # Crear unidad si no existe
                u = s_brit.query(UnidadTransporte).filter(UnidadTransporte.placa == pl).first()
                if not u:
                    u = UnidadTransporte(placa=pl, marca="Volvo FH", capacidad_litros=vo, estado="Activo")
                    s_brit.add(u)
                    s_brit.commit()

                v_ex = s_brit.query(Viaje).filter(Viaje.placa == pl, Viaje.fecha_carga == fc).first()
                if not v_ex:
                    v_new = Viaje(
                        lote_codigo="1",
                        placa=pl,
                        unidad_id=u.id,
                        tramo=tramo,
                        producto=prod,
                        fecha_carga=fc,
                        fecha_descarga=fd,
                        periodo_mes="2025-10",
                        volumen_origen_litros=vo,
                        volumen_recepcionado_litros=vr,
                        merma_real_litros=mr,
                        tolerancia_pct=0.15 if prod == "DO" else 0.20,
                        merma_tolerable_litros=max(0, mr - me),
                        merma_excedente_litros=me,
                        precio_merma_litro_bs=pm,
                        merma_descontar_bs=md,
                        tarifa_flete=tf,
                        tipo_tarifa="USD_POR_M3",
                        flete_total_bs=imp,
                        estado="Conciliado"
                    )
                    s_brit.add(v_new)
            s_brit.commit()
            print("Viajes de Britanic S.R.L. (Página 1 PDF) sembrados.")
        finally:
            s_brit.close()

        # 2. Truck's Drivers
        s_td = get_tenant_session("empresa_trucks_drivers")
        try:
            viajes_td = [
                ("5239-EFG", "Arica - Tambo Quemado - La Paz", "IYA", date(2025, 10, 28), date(2025, 10, 30), 33002, 33002, 0, 0, 5.264275, 0.0, 33.002, 431.98, 14256.20),
                ("5614-FSP", "Arica - Tambo Quemado - La Paz", "IYA", date(2025, 10, 27), date(2025, 10, 29), 33001, 33435, -434, 0, 5.435144, 0.0, 33.001, 431.98, 14255.77),
                ("5239-EFG", "Arica - Tambo Quemado - Santa Cruz", "DO", date(2025, 10, 4), date(2025, 10, 8), 33311, 33322, -11, 0, 5.669517, 0.0, 33.311, 865.07, 28816.35),
                ("5614-FSP", "Arica - Tambo Quemado - Santa Cruz", "DO", date(2025, 10, 4), date(2025, 10, 8), 33313, 33338, -25, 0, 5.669517, 0.0, 33.313, 865.07, 28818.08),
                ("5239-EFG", "Mollendo - Desaguadero - La Paz", "DO", date(2025, 10, 21), date(2025, 10, 23), 33860, 33746, 114, 114, 6.120739, 697.76, 33.746, 512.43, 17292.46),
                ("5271-IUE", "Mollendo - Desaguadero - La Paz", "DO", date(2025, 10, 8), date(2025, 10, 11), 33896, 33752, 144, 144, 6.312869, 909.05, 33.752, 512.43, 17295.54),
                ("5271-IUE", "Mollendo - Desaguadero - La Paz", "DO", date(2025, 10, 17), date(2025, 10, 22), 33881, 33724, 157, 157, 6.254795, 982.00, 33.724, 512.43, 17281.19),
                ("5271-IUE", "Mollendo - Desaguadero - La Paz", "DO", date(2025, 10, 24), date(2025, 10, 27), 33877, 33776, 101, 27, 6.120727, 165.26, 33.776, 512.43, 17307.84),
                ("5614-FSP", "Mollendo - Desaguadero - La Paz", "DO", date(2025, 10, 21), date(2025, 10, 23), 33872, 33758, 114, 114, 6.120726, 697.76, 33.758, 512.43, 17298.61),
            ]

            for pl, tramo, prod, fc, fd, vo, vr, mr, me, pm, md, vf, tf, imp in viajes_td:
                u = s_td.query(UnidadTransporte).filter(UnidadTransporte.placa == pl).first()
                if not u:
                    u = UnidadTransporte(placa=pl, marca="Scania R440", capacidad_litros=vo, estado="Activo")
                    s_td.add(u)
                    s_td.commit()

                v_ex = s_td.query(Viaje).filter(Viaje.placa == pl, Viaje.fecha_carga == fc).first()
                if not v_ex:
                    v_new = Viaje(
                        lote_codigo="1",
                        placa=pl,
                        unidad_id=u.id,
                        tramo=tramo,
                        producto=prod,
                        fecha_carga=fc,
                        fecha_descarga=fd,
                        periodo_mes="2025-10",
                        volumen_origen_litros=vo,
                        volumen_recepcionado_litros=vr,
                        merma_real_litros=mr,
                        tolerancia_pct=0.15 if prod == "DO" else 0.20,
                        merma_tolerable_litros=max(0, mr - me),
                        merma_excedente_litros=me,
                        precio_merma_litro_bs=pm,
                        merma_descontar_bs=md,
                        tarifa_flete=tf,
                        tipo_tarifa="USD_POR_M3",
                        flete_total_bs=imp,
                        estado="Conciliado"
                    )
                    s_td.add(v_new)
            s_td.commit()
            print("Viajes de Truck's Drivers S.R.L. (Página 1 PDF) sembrados.")
        finally:
            s_td.close()

        print("\n¡Sembrado de datos finalizado con éxito!")

    finally:
        db.close()

if __name__ == "__main__":
    seed()
