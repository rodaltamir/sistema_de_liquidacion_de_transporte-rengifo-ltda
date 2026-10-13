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

        default_prods = ["GASOLINA", "DIESEL", "INSUMOS Y ADITIVOS"]
        prods_saved = []
        if params.productos_json:
            try:
                prods_saved = json.loads(params.productos_json)
            except Exception:
                pass

        viaje_prods = [r[0] for r in session.query(Viaje.producto).distinct().all() if r[0]]
        all_prods = []
        for p in default_prods + prods_saved + viaje_prods:
            p_clean = str(p).strip().upper()
            if p_clean and p_clean not in all_prods:
                all_prods.append(p_clean)

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
            "tramos": all_tramos
        }
    finally:
        session.close()

@router.post("/productos")
def add_empresa_producto(
    schema_name: str,
    item: CatalogItemCreate,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    """
    Guarda un nuevo producto en la configuración exclusiva de esta empresa.
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
            curr = ["GASOLINA", "DIESEL", "INSUMOS Y ADITIVOS"]

        if nom not in curr:
            curr.append(nom)
            params.productos_json = json.dumps(curr)
            session.commit()

        return {"ok": True, "productos": curr}
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
