from fastapi import APIRouter, Depends, HTTPException
from app.db.session import get_tenant_session
from app.api.deps import verify_tenant_exists
from app.models.public import Empresa
from app.models.tenant import ParametroLiquidacion
from app.schemas.parametro import ParametroUpdate, ParametroResponse

router = APIRouter(prefix="/tenants/{schema_name}/parametros", tags=["Panel de Control y Parámetros"])

@router.get("/", response_model=ParametroResponse)
def get_parametros(schema_name: str, empresa: Empresa = Depends(verify_tenant_exists)):
    session = get_tenant_session(schema_name)
    try:
        params = session.query(ParametroLiquidacion).first()
        if not params:
            params = ParametroLiquidacion()
            session.add(params)
            session.commit()
            session.refresh(params)
        return params
    finally:
        session.close()

@router.put("/", response_model=ParametroResponse)
def update_parametros(
    schema_name: str,
    param_in: ParametroUpdate,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        params = session.query(ParametroLiquidacion).first()
        if not params:
            params = ParametroLiquidacion()
            session.add(params)

        update_data = param_in.model_dump(exclude_unset=True)
        for field, val in update_data.items():
            setattr(params, field, val)

        session.commit()
        session.refresh(params)
        return params
    finally:
        session.close()


import json
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.models.tenant import Viaje

class CatalogItemCreate(BaseModel):
    nombre: Optional[str] = None
    producto: Optional[str] = None
    tramo: Optional[str] = None
    tolerancia_pct: Optional[float] = None
    nombre_anterior: Optional[str] = None

    def get_value(self) -> str:
        val = self.nombre or self.producto or self.tramo or ""
        return str(val).strip().upper()

@router.get("/catalogos")
def get_empresa_catalogos(
    schema_name: str,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    """
    Retorna los productos y tramos habilitados específicamente para esta empresa.
    """
    session = get_tenant_session(schema_name)
    try:
        params = session.query(ParametroLiquidacion).first()
        if not params:
            params = ParametroLiquidacion()
            session.add(params)
            session.commit()
            session.refresh(params)

        default_items = [
            {"nombre": "GASOLINA", "tolerancia_pct": params.merma_tolerancia_gasolina_pct if params else 0.25},
            {"nombre": "DIESEL", "tolerancia_pct": params.merma_tolerancia_diesel_pct if params else 0.15},
            {"nombre": "INSUMOS Y ADITIVOS", "tolerancia_pct": params.merma_tolerancia_iya_pct if params else 0.20}
        ]

        prods_dict = {it["nombre"]: it["tolerancia_pct"] for it in default_items}
        if params.productos_json:
            try:
                raw_prods = json.loads(params.productos_json)
                for it in raw_prods:
                    if isinstance(it, dict):
                        n = str(it.get("nombre", "")).strip().upper()
                        if n:
                            prods_dict[n] = float(it.get("tolerancia_pct", getattr(params, "merma_tolerancia_otro_pct", 0.0) or 0.0))
                    elif isinstance(it, str):
                        n = it.strip().upper()
                        if n and n not in prods_dict:
                            prods_dict[n] = float(getattr(params, "merma_tolerancia_otro_pct", 0.0) or 0.0)
            except Exception:
                pass

        viaje_prods = [r[0] for r in session.query(Viaje.producto).distinct().all() if r[0]]
        for vp in viaje_prods:
            vp_clean = str(vp).strip().upper()
            if vp_clean and vp_clean not in prods_dict:
                prods_dict[vp_clean] = float(getattr(params, "merma_tolerancia_otro_pct", 0.0) or 0.0)

        all_prods = list(prods_dict.keys())
        all_prods_detalle = [{"nombre": k, "tolerancia_pct": v} for k, v in prods_dict.items()]

        default_tramos = [
            "ARICA - TAMBO QUEMADO - LA PAZ",
            "IQUIQUE - PISIGA - ORURO",
            "MEJILLONES - OLLAGÜE - UYUNI"
        ]
        tramos_saved = []
        if params.tramos_json:
            try:
                tramos_saved = json.loads(params.tramos_json)
            except Exception:
                pass

        viaje_tramos = [r[0] for r in session.query(Viaje.tramo).distinct().all() if r[0]]
        all_tramos = []
        for t in default_tramos + tramos_saved + viaje_tramos:
            t_clean = str(t).strip().upper()
            if t_clean and t_clean not in all_tramos:
                all_tramos.append(t_clean)

        return {
            "productos": all_prods,
            "productos_detalle": all_prods_detalle,
            "tramos": all_tramos
        }
    finally:
        session.close()

@router.post("/productos")
@router.put("/productos")
def add_or_update_empresa_producto(
    schema_name: str,
    item: CatalogItemCreate,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    """
    Guarda o actualiza un producto en la configuración exclusiva de esta empresa con su tolerancia %.
    """
    nom = item.get_value()
    if not nom:
        raise HTTPException(status_code=400, detail="Nombre de producto requerido")

    session = get_tenant_session(schema_name)
    try:
        params = session.query(ParametroLiquidacion).first()
        if not params:
            params = ParametroLiquidacion()
            session.add(params)

        curr = []
        if params.productos_json:
            try:
                curr = json.loads(params.productos_json)
            except Exception:
                curr = []
        if not isinstance(curr, list):
            curr = []

        normalized = []
        for p in curr:
            if isinstance(p, dict):
                normalized.append({
                    "nombre": str(p.get("nombre", "")).strip().upper(),
                    "tolerancia_pct": float(p.get("tolerancia_pct", 0.0))
                })
            elif isinstance(p, str):
                p_up = p.strip().upper()
                tol_def = 0.15 if "DIESEL" in p_up else (0.25 if "GASOLINA" in p_up else (0.20 if "IYA" in p_up else 0.0))
                normalized.append({
                    "nombre": p_up,
                    "tolerancia_pct": tol_def
                })

        tol = float(item.tolerancia_pct) if item.tolerancia_pct is not None else float(getattr(params, "merma_tolerancia_otro_pct", 0.0) or 0.0)
        nombre_ant = item.nombre_anterior.strip().upper() if item.nombre_anterior else None

        updated = False
        if nombre_ant:
            for it in normalized:
                if it["nombre"] == nombre_ant:
                    it["nombre"] = nom
                    it["tolerancia_pct"] = tol
                    updated = True
                    break

        if not updated:
            found = False
            for it in normalized:
                if it["nombre"] == nom:
                    it["tolerancia_pct"] = tol
                    found = True
                    break
            if not found:
                normalized.append({"nombre": nom, "tolerancia_pct": tol})

        params.productos_json = json.dumps(normalized)
        session.commit()

        return {
            "ok": True,
            "productos": [p["nombre"] for p in normalized],
            "productos_detalle": normalized
        }
    finally:
        session.close()

@router.post("/tramos")
def add_empresa_tramo(
    schema_name: str,
    item: CatalogItemCreate,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    """
    Guarda un nuevo tramo / ruta en la configuración exclusiva de esta empresa.
    """
    nom = item.get_value()
    if not nom:
        raise HTTPException(status_code=400, detail="Nombre de tramo requerido")

    session = get_tenant_session(schema_name)
    try:
        params = session.query(ParametroLiquidacion).first()
        if not params:
            params = ParametroLiquidacion()
            session.add(params)

        curr = []
        if params.tramos_json:
            try:
                curr = json.loads(params.tramos_json)
            except Exception:
                curr = []
        if not isinstance(curr, list):
            curr = []

        if nom not in curr:
            curr.append(nom)
            params.tramos_json = json.dumps(curr)
            session.commit()

        return {"ok": True, "tramos": curr}
    finally:
        session.close()
