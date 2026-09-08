"use client";

import { useState, useEffect, use } from "react";
import { 
  Settings, 
  Save, 
  ShieldCheck, 
  Fuel, 
  DollarSign, 
  FileText, 
  Users, 
  CheckCircle2, 
  Info,
  Scale
} from "lucide-react";
import Swal from "sweetalert2";
import { apiFetch } from "@/lib/api";

export default function ConfiguracionPage({ params }: { params: Promise<{ schema: string }> }) {
  const resolvedParams = use(params);
  const schema = resolvedParams.schema;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    tipo_cambio_usd_bob: 6.96,
    merma_tolerancia_diesel_pct: 0.15,
    merma_tolerancia_gasolina_pct: 0.25,
    merma_tolerancia_iya_pct: 0.20,
    merma_tolerancia_crudo_pct: 0.15,
    precio_merma_diesel_litro_bs: 3.72,
    precio_merma_gasolina_litro_bs: 3.74,
    precio_merma_general_bs: 7.45,
    comision_usd_m3: 1.00,
    comision_pct_1: 7.0,
    comision_ypfb_bolgart_pct: 7.0,
    comision_pct_2: 3.0,
    costo_hojas_de_ruta_bs: 240.00,
    costo_gps_bs: 135.00,
    anticipos_otros_pct: 0.0,
    firma_realizado_por: "JAQUELINE LOVERA TIÑINI",
    firma_revisado_por: "JOSE LOVERA TIÑINI / GERENTE GENERAL",
    firma_autorizado_por: "DIRECTORIO",
    firma_cancelado_por: "TOMASA TIÑINI MITA / APOYO",
    leyenda_legal: "Conforme lo establece la Ley 843 en su Art. 4 y de acuerdo a la cláusula contractual de Facturación y Pago, el momento en que finalizará la ejecución o la prestación del Servicio se origina después de realizada la Conciliación (Acta de Conformidad por la Comisión de Recepción) y emitida la planilla de Liquidación."
  });

  useEffect(() => {
    loadParametros();
  }, [schema]);

  const loadParametros = async () => {
    try {
      const data = await apiFetch(`/tenants/${schema}/parametros/`);
      if (data) {
        setFormData({
          tipo_cambio_usd_bob: data.tipo_cambio_usd_bob ?? 6.96,
          merma_tolerancia_diesel_pct: data.merma_tolerancia_diesel_pct ?? 0.15,
          merma_tolerancia_gasolina_pct: data.merma_tolerancia_gasolina_pct ?? 0.25,
          merma_tolerancia_iya_pct: data.merma_tolerancia_iya_pct ?? 0.20,
          merma_tolerancia_crudo_pct: data.merma_tolerancia_crudo_pct ?? 0.15,
          precio_merma_diesel_litro_bs: data.precio_merma_diesel_litro_bs ?? 3.72,
          precio_merma_gasolina_litro_bs: data.precio_merma_gasolina_litro_bs ?? 3.74,
          precio_merma_general_bs: data.precio_merma_general_bs ?? 7.45,
          comision_usd_m3: data.comision_usd_m3 ?? 1.00,
          comision_pct_1: data.comision_pct_1 ?? 7.0,
          comision_ypfb_bolgart_pct: data.comision_ypfb_bolgart_pct ?? 7.0,
          comision_pct_2: data.comision_pct_2 ?? 3.0,
          costo_hojas_de_ruta_bs: data.costo_hojas_de_ruta_bs ?? 240.00,
          costo_gps_bs: data.costo_gps_bs ?? 135.00,
          anticipos_otros_pct: data.anticipos_otros_pct ?? 0.0,
          firma_realizado_por: data.firma_realizado_por || "JAQUELINE LOVERA TIÑINI",
          firma_revisado_por: data.firma_revisado_por || "JOSE LOVERA TIÑINI / GERENTE GENERAL",
          firma_autorizado_por: data.firma_autorizado_por || "DIRECTORIO",
          firma_cancelado_por: data.firma_cancelado_por || "TOMASA TIÑINI MITA / APOYO",
          leyenda_legal: data.leyenda_legal || ""
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch(`/tenants/${schema}/parametros/`, {
        method: "PUT",
        body: JSON.stringify(formData)
      });
      Swal.fire({
        icon: "success",
        title: "Parámetros Guardados",
        text: "Los nuevos porcentajes y deducciones se aplicarán a los cálculos de flete.",
        background: "#0f172a",
        color: "#fff",
        timer: 1800,
        showConfirmButton: false
      });
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "Error", text: err.message, background: "#0f172a", color: "#fff" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Settings className="w-7 h-7 text-cyan-400" />
            <span>Panel de Control y Parámetros de Liquidación</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Configuración de tolerancias de merma, comisiones de flete, deducciones legales (Ley 843) y firmas oficiales
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 transition self-start sm:self-auto disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? "Guardando..." : "Guardar Cambios"}</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* BLOQUE 1: SUSTENTO LEGAL Y NORMATIVO */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                1. Marco Legal y Cláusula Contractual de Liquidación
              </h3>
              <p className="text-xs text-slate-400">Régimen tributario y de hidrocarburos del Estado Plurinacional</p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-blue-950/40 border border-blue-800/60 text-xs text-blue-200 leading-relaxed flex items-start gap-3">
            <Info className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div>
              <b>Base Legal Aplicable:</b> Los contratos de flete de hidrocarburos con YPFB se rigen bajo la Ley 843 (Art. 4) que establece el momento de perfeccionamiento del hecho generador tras la conciliación de mermas y acta de conformidad. Las deducciones del 7% y BOL-GART responden a fondos de retención de garantía y cobertura logística.
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
              Leyenda Legal al Pie de la Planilla
            </label>
            <textarea
              rows={3}
              value={formData.leyenda_legal}
              onChange={(e) => setFormData({ ...formData, leyenda_legal: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 leading-relaxed"
            />
          </div>
        </div>

        {/* BLOQUE 2: TOLERANCIAS DE MERMA Y PRECIOS */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Fuel className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                2. Porcentajes de Tolerancia de Merma y Factores de Descuento
              </h3>
              <p className="text-xs text-slate-400">Límites permisibles de evaporación y transporte por tipo de producto</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Tolerancia Diesel (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.merma_tolerancia_diesel_pct}
                onChange={(e) => setFormData({ ...formData, merma_tolerancia_diesel_pct: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Estándar YPFB: 0.15%</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Tolerancia Gasolina (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.merma_tolerancia_gasolina_pct}
                onChange={(e) => setFormData({ ...formData, merma_tolerancia_gasolina_pct: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Estándar YPFB: 0.25%</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Tolerancia Insumos y Aditivos (IYA %)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.merma_tolerancia_iya_pct}
                onChange={(e) => setFormData({ ...formData, merma_tolerancia_iya_pct: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Estándar: 0.20%</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Factor Precio Merma General (Bs/Litro)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.precio_merma_general_bs}
                onChange={(e) => setFormData({ ...formData, precio_merma_general_bs: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Valor contractual aplicado en Hoja 2 del PDF (7.45 Bs)</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Tipo de Cambio Oficial (USD a BOB)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.tipo_cambio_usd_bob}
                onChange={(e) => setFormData({ ...formData, tipo_cambio_usd_bob: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">T/C de conversión para tarifas y comisiones</span>
            </div>
          </div>
        </div>

        {/* BLOQUE 3: COMISIONES Y DEDUCCIONES ESTÁNDAR */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                3. Descuentos y Deducciones del Líquido Pagable (Hoja 3 PDF)
              </h3>
              <p className="text-xs text-slate-400">Comisiones porcentuales, retenciones y costos logísticos fijos</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Comisión 1 ($us por m³)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.comision_usd_m3}
                onChange={(e) => setFormData({ ...formData, comision_usd_m3: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Cobro por metro cúbico (1 $us/m3)</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Descuento Comisión 7% (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.comision_pct_1}
                onChange={(e) => setFormData({ ...formData, comision_pct_1: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Retención Impositiva y Logística</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Descuento YPFB BOL-GART 7% (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.comision_ypfb_bolgart_pct}
                onChange={(e) => setFormData({ ...formData, comision_ypfb_bolgart_pct: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Boleta de Garantía de Transporte</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Descuento Comisión 3% (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.comision_pct_2}
                onChange={(e) => setFormData({ ...formData, comision_pct_2: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Gestión Operativa</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Costo Hojas de Ruta (Bs Fijo)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.costo_hojas_de_ruta_bs}
                onChange={(e) => setFormData({ ...formData, costo_hojas_de_ruta_bs: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Valorado ANH/Tránsito: 240.00 Bs</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Costo GPS / Precintos (Bs Fijo)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.costo_gps_bs}
                onChange={(e) => setFormData({ ...formData, costo_gps_bs: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Monitoreo Satelital: 135.00 Bs</span>
            </div>
          </div>
        </div>

        {/* BLOQUE 4: FIRMAS AUTORIZADAS */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                4. Personas Autorizadas para Firmas de Planilla
              </h3>
              <p className="text-xs text-slate-400">Nombres y cargos que se imprimen en los 4 bloques de firma</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                1. Realizado Por:
              </label>
              <input
                type="text"
                value={formData.firma_realizado_por}
                onChange={(e) => setFormData({ ...formData, firma_realizado_por: e.target.value })}
                placeholder="JAQUELINE LOVERA TIÑINI"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                2. Revisado Por (Gerente General):
              </label>
              <input
                type="text"
                value={formData.firma_revisado_por}
                onChange={(e) => setFormData({ ...formData, firma_revisado_por: e.target.value })}
                placeholder="JOSE LOVERA TIÑINI / GERENTE GENERAL"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                3. Autorizado Por:
              </label>
              <input
                type="text"
                value={formData.firma_autorizado_por}
                onChange={(e) => setFormData({ ...formData, firma_autorizado_por: e.target.value })}
                placeholder="DIRECTORIO"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                4. Cancelado Por (Apoyo Administrativo):
              </label>
              <input
                type="text"
                value={formData.firma_cancelado_por}
                onChange={(e) => setFormData({ ...formData, firma_cancelado_por: e.target.value })}
                placeholder="TOMASA TIÑINI MITA / APOYO"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Botón Guardar Inferior */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-bold shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Guardando..." : "Guardar Todos los Parámetros"}</span>
          </button>
        </div>

      </form>
    </div>
  );
}
