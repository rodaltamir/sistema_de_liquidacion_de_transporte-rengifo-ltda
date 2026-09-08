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
