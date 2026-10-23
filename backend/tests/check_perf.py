from app.db.session import engine
from sqlalchemy import text

with engine.connect() as conn:
    rows = conn.execute(text("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'empresa_driver_s_r_l' AND tablename = 'viajes'")).fetchall()
    print("Indexes on empresa_driver_s_r_l.viajes:")
    for r in rows:
        print(f"  {r[0]}: {r[1]}")
