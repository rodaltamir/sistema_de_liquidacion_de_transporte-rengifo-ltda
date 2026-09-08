"use client";

import { useState, useEffect, use } from "react";
import { 
  FileSpreadsheet, 
  Download, 
  Printer, 
  Calendar, 
  Truck, 
  Plus, 
  CheckCircle2, 
  Layers, 
  FileText, 
  SlidersHorizontal, 
  Info, 
  Fuel, 
  Trash2, 
  Edit 
} from "lucide-react";
import Swal from "sweetalert2";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatNumber, formatDate } from "@/lib/format";

export default function LiquidacionesPage({ params }: { params: Promise<{ schema: string }> }) {
  const resolvedParams = use(params);
  const schema = resolvedParams.schema;

  const [unidades, setUnidades] = useState<any[]>([]);
  const [selectedPlaca, setSelectedPlaca] = useState("");
  const [periodo, setPeriodo] = useState("2023-03");

  const [liquidaciones, setLiquidaciones] = useState<any[]>([]);
  const [activeLiq, setActiveLiq] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"hoja1" | "hoja2" | "ambas">("ambas");

  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustData, setAdjustData] = useState<any>({});

  useEffect(() => {
    loadInitialData();
  }, [schema]);

  useEffect(() => {
    if (periodo && selectedPlaca) {
      loadLiquidacionActual();
    }
  }, [schema, periodo, selectedPlaca]);

  const loadInitialData = async () => {
    try {
      const uData = await apiFetch(`/tenants/${schema}/unidades/`);
      setUnidades(uData);

      // Buscar si hay liquidaciones existentes
      const lData = await apiFetch(`/tenants/${schema}/liquidaciones/`);
      setLiquidaciones(lData);

      if (lData.length > 0) {
        setPeriodo(lData[0].periodo_mes);
        setSelectedPlaca(lData[0].placa);
      } else if (uData.length > 0) {
        setSelectedPlaca(uData[0].placa);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadLiquidacionActual = async () => {
    setLoading(true);
    try {
      // Buscar si existe para esta placa y periodo
      const list = await apiFetch(`/tenants/${schema}/liquidaciones/?periodo_mes=${periodo}&placa=${selectedPlaca}`);
      if (list && list.length > 0) {
        const detalle = await apiFetch(`/tenants/${schema}/liquidaciones/${list[0].id}`);
        setActiveLiq(detalle);
      } else {
        setActiveLiq(null);
      }
    } catch (err) {
      console.error(err);
      setActiveLiq(null);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedPlaca || !periodo) {
      Swal.fire({ icon: "warning", title: "Atención", text: "Selecciona placa y mes.", background: "#0f172a", color: "#fff" });
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch(`/tenants/${schema}/liquidaciones/`, {
        method: "POST",
        body: JSON.stringify({
          periodo_mes: periodo,
          placa: selectedPlaca
        })
      });

      Swal.fire({
        icon: "success",
        title: "¡Liquidación Generada!",
        text: `Planilla para ${selectedPlaca} (${periodo}) procesada con éxito.`,
        timer: 1500,
        showConfirmButton: false,
        background: "#0f172a",
        color: "#fff"
      });

      const detalle = await apiFetch(`/tenants/${schema}/liquidaciones/${res.id}`);
      setActiveLiq(detalle);

      // Recargar lista
      const lData = await apiFetch(`/tenants/${schema}/liquidaciones/`);
      setLiquidaciones(lData);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "No se pudo generar",
        text: err.message || "Verifica que existan viajes para esta placa en el periodo.",
        background: "#0f172a",
        color: "#fff"
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = async () => {
    if (!activeLiq) return;
    try {
      const blob = await apiFetch(`/tenants/${schema}/liquidaciones/${activeLiq.id}/export/excel`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Liquidacion_${activeLiq.placa}_${activeLiq.periodo_mes}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "Error", text: err.message, background: "#0f172a", color: "#fff" });
    }
  };

  const downloadPDF = async () => {
    if (!activeLiq) return;
    try {
      const blob = await apiFetch(`/tenants/${schema}/liquidaciones/${activeLiq.id}/export/pdf`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Liquidacion_${activeLiq.placa}_${activeLiq.periodo_mes}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "Error", text: err.message, background: "#0f172a", color: "#fff" });
    }
  };

  const openAdjustModal = () => {
    if (!activeLiq) return;
    setAdjustData({
      desc_merma_bs: activeLiq.desc_merma_bs,
      desc_comision_usd_m3_bs: activeLiq.desc_comision_usd_m3_bs,
      desc_comision_7pct_bs: activeLiq.desc_comision_7pct_bs,
      desc_comision_ypfb_bolgart_7pct_bs: activeLiq.desc_comision_ypfb_bolgart_7pct_bs,
      desc_comision_3pct_bs: activeLiq.desc_comision_3pct_bs,
      desc_hojas_ruta_bs: activeLiq.desc_hojas_ruta_bs,
      desc_gps_bs: activeLiq.desc_gps_bs,
      desc_anticipos_otros_bs: activeLiq.desc_anticipos_otros_bs,
      desc_otros_ajustes_bs: activeLiq.desc_otros_ajustes_bs
    });
    setShowAdjustModal(true);
  };

  const handleSaveAdjustments = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`/tenants/${schema}/liquidaciones/`, {
        method: "POST",
        body: JSON.stringify({
          periodo_mes: activeLiq.periodo_mes,
          placa: activeLiq.placa,
          ...adjustData
        })
      });

      Swal.fire({ icon: "success", title: "Deducciones actualizadas", background: "#0f172a", color: "#fff", timer: 1500, showConfirmButton: false });
      setShowAdjustModal(false);
      const detalle = await apiFetch(`/tenants/${schema}/liquidaciones/${res.id}`);
      setActiveLiq(detalle);
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "Error", text: err.message, background: "#0f172a", color: "#fff" });
    }
  };

  const handleDeleteLiquidacion = async () => {
    if (!activeLiq) return;
    const result = await Swal.fire({
      title: `¿Eliminar liquidación ${activeLiq.codigo}?`,
      text: "Los viajes quedarán en estado Pendiente para poder volver a liquidarse.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#334155",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      background: "#0f172a",
      color: "#fff"
    });

    if (result.isConfirmed) {
      try {
        await apiFetch(`/tenants/${schema}/liquidaciones/${activeLiq.id}`, { method: "DELETE" });
        Swal.fire({ icon: "success", title: "Liquidación eliminada", background: "#0f172a", color: "#fff", timer: 1500, showConfirmButton: false });
        setActiveLiq(null);
        loadInitialData();
      } catch (err: any) {
        Swal.fire({ icon: "error", title: "Error", text: err.message, background: "#0f172a", color: "#fff" });
      }
    }
  };

  const empresaNombre = activeLiq?.empresa?.name || "EMPRESA DE TRANSPORTE";
  const firmas = activeLiq?.firmas || {
    realizado_por: "JAQUELINE LOVERA TIÑINI",
    revisado_por: "JOSE LOVERA TIÑINI / GERENTE GENERAL",
    autorizado_por: "DIRECTORIO",
    cancelado_por: "TOMASA TIÑINI MITA / APOYO"
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <FileSpreadsheet className="w-7 h-7 text-cyan-400" />
            <span>Planillas de Liquidación Mensual por Camión</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Generación oficial fiel al formato Excel (Páginas 2 y 3 del PDF) con detalle de viajes, deducciones y firmas
          </p>
        </div>
      </div>

      {/* Barra de Controles y Generación */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col lg:flex-row items-center justify-between gap-4 no-print">
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Mes */}
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-xl border border-slate-700 text-xs">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400 font-medium">Mes:</span>
            <input
              type="month"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="bg-transparent text-white font-bold focus:outline-none cursor-pointer text-xs"
            />
          </div>

          {/* Placa */}
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-xl border border-slate-700 text-xs">
            <Truck className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400 font-medium">Placa:</span>
            <select
              value={selectedPlaca}
              onChange={(e) => setSelectedPlaca(e.target.value)}
              className="bg-transparent text-white font-bold focus:outline-none cursor-pointer text-xs"
            >
              <option value="" className="bg-slate-800">-- Seleccionar Placa --</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.placa} className="bg-slate-800">
                  {u.placa}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleGenerate}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/20 flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Generar / Actualizar Liquidación</span>
          </button>
        </div>

        {/* Acciones de Exportación si hay liquidación activa */}
        {activeLiq && (
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
            <button
              onClick={downloadExcel}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition"
              title="Descargar archivo Excel con ambas pestañas"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel (.xlsx)</span>
            </button>

            <button
              onClick={downloadPDF}
              className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/20 flex items-center gap-1.5 transition"
              title="Descargar reporte en formato PDF"
            >
              <Download className="w-4 h-4" />
              <span>PDF</span>
            </button>

            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition"
              title="Imprimir formato"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>

            <button
              onClick={openAdjustModal}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title="Ajustar deducciones manualmente"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            <button
              onClick={handleDeleteLiquidacion}
              className="p-2 rounded-xl bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-400 border border-slate-700 transition"
              title="Eliminar liquidación"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Selector de Pestañas de Visualización */}
      {activeLiq && (
        <div className="flex items-center justify-between no-print">
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab("ambas")}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition ${
                activeTab === "ambas" ? "bg-cyan-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Ver Planilla Completa (Hojas 2 y 3)
            </button>
            <button
              onClick={() => setActiveTab("hoja1")}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition ${
                activeTab === "hoja1" ? "bg-cyan-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Hoja 1: Detalle de Fletes (Pág. 2)
            </button>
            <button
              onClick={() => setActiveTab("hoja2")}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition ${
                activeTab === "hoja2" ? "bg-cyan-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Hoja 2: Deducciones y Líquido (Pág. 3)
            </button>
          </div>

          <div className="text-xs text-slate-400 font-mono hidden sm:block">
            Código: <span className="text-cyan-400 font-bold">{activeLiq.codigo}</span>
          </div>
        </div>
      )}

      {/* Contenedor del Documento */}
      {loading ? (
        <div className="flex justify-center items-center py-28">
          <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      ) : !activeLiq ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-16 text-center max-w-lg mx-auto">
          <FileSpreadsheet className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">Sin liquidación generada</h3>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            No se ha generado la planilla para la placa <b>{selectedPlaca || "seleccionada"}</b> en el periodo <b>{periodo}</b>. 
            Haz clic en el botón para calcular los fletes y deducciones automáticamente.
          </p>
          <button
            onClick={handleGenerate}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/20 transition"
          >
            Generar Liquidación Ahora
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* ============================================================== */}
          {/* HOJA 1: DETALLE OPERATIVO DE FLETES (PÁGINA 2 DEL PDF) */}
          {/* ============================================================== */}
          {(activeTab === "hoja1" || activeTab === "ambas") && (
            <div className="bg-white text-slate-900 rounded-2xl shadow-2xl p-6 sm:p-8 overflow-x-auto border border-slate-200">
              
              {/* Encabezado Hoja 1 */}
              <div className="flex flex-col sm:flex-row items-start justify-between gap-4 border-b-2 border-slate-900 pb-4 mb-5">
                <div>
                  <h2 className="text-base font-black tracking-tight uppercase text-slate-900">
                    LIQUIDACION DE FLETES
                  </h2>
                  <div className="text-xs font-bold text-slate-700 mt-1">
                    MES: <span className="font-black text-blue-800 uppercase">{activeLiq.periodo_mes}</span>
                  </div>
                  <div className="text-xs font-bold text-slate-700">
                    PLACA: <span className="font-mono font-black text-slate-950 text-sm">{activeLiq.placa}</span>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end">
                  <div className="text-sm font-black text-slate-900 uppercase">
                    {empresaNombre}
                  </div>
                  <div className="inline-flex items-center gap-1.5 border border-slate-300 rounded px-2 py-0.5 mt-1 text-[11px] font-bold bg-slate-50">
                    <span className="text-slate-500">TASA MERMA:</span>
                    <span className="text-red-700 font-mono font-black">7,45</span>
                  </div>
                </div>
              </div>

              {/* Tabla de Viajes de la Placa (17 Columnas exactas de Pág 2) */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 text-[10px] uppercase font-black text-center border-y border-slate-300">
                      <th className="py-2 px-1 border-x border-slate-300">Nº</th>
                      <th className="py-2 px-1.5 border-x border-slate-300">FECHA DE CARGA</th>
                      <th className="py-2 px-1.5 border-x border-slate-300">FECHA DE DESCARGA</th>
                      <th className="py-2 px-1.5 border-x border-slate-300">MIC/DTA Nº</th>
                      <th className="py-2 px-2 border-x border-slate-300 text-left">EMPRESA</th>
                      <th className="py-2 px-1 border-x border-slate-300">PLACA</th>
                      <th className="py-2 px-2 border-x border-slate-300 text-left">TRAMO</th>
                      <th className="py-2 px-1 border-x border-slate-300">CLIENTE</th>
                      <th className="py-2 px-1 border-x border-slate-300">PRODUCTO</th>
                      <th className="py-2 px-1.5 border-x border-slate-300 text-right">Volumen en LL Origen</th>
                      <th className="py-2 px-1.5 border-x border-slate-300 text-right">Volumen Recepcionado</th>
                      <th className="py-2 px-1 border-x border-slate-300 text-right">Merma T:T</th>
                      <th className="py-2 px-1 border-x border-slate-300 text-right">Total Merma Litros</th>
                      <th className="py-2 px-1 border-x border-slate-300 text-center">MERMA [0,15% D / 0,25% G]</th>
                      <th className="py-2 px-1.5 border-x border-slate-300 text-right">Merma a Descontar Y.P.F.B.</th>
                      <th className="py-2 px-1.5 border-x border-slate-300 text-right">TARIFA Bs.</th>
                      <th className="py-2 px-2 border-x border-slate-300 text-right">Total a pagar en Bob.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeLiq.viajes?.map((v: any, idx: number) => (
                      <tr key={v.id} className={`border-b border-slate-200 hover:bg-slate-50 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                        <td className="py-1 px-1 text-center font-bold border-x border-slate-200">{idx + 1}</td>
                        <td className="py-1 px-1.5 text-center text-slate-600 border-x border-slate-200">{formatDate(v.fecha_carga)}</td>
                        <td className="py-1 px-1.5 text-center text-slate-600 border-x border-slate-200">{formatDate(v.fecha_descarga)}</td>
                        <td className="py-1 px-1.5 text-center font-mono font-bold text-slate-800 border-x border-slate-200">{v.mic_dta || "-"}</td>
                        <td className="py-1 px-2 text-slate-700 truncate max-w-[130px] border-x border-slate-200">{empresaNombre}</td>
                        <td className="py-1 px-1 text-center font-mono font-bold border-x border-slate-200">{v.placa}</td>
                        <td className="py-1 px-2 text-slate-800 uppercase text-[10px] border-x border-slate-200">{v.tramo}</td>
                        <td className="py-1 px-1 text-center font-bold text-slate-700 border-x border-slate-200">{v.cliente || "YPFB"}</td>
                        <td className="py-1 px-1 text-center font-bold text-blue-900 border-x border-slate-200">{v.producto}</td>
                        <td className="py-1 px-1.5 text-right font-mono border-x border-slate-200">{formatNumber(v.volumen_origen_litros, 0)}</td>
                        <td className="py-1 px-1.5 text-right font-mono font-bold border-x border-slate-200">{formatNumber(v.volumen_recepcionado_litros, 0)}</td>
                        <td className="py-1 px-1 text-right font-mono text-slate-700 border-x border-slate-200">
                          {v.merma_real_litros > 0 ? `-${formatNumber(v.merma_real_litros, 1)}` : formatNumber(v.merma_real_litros, 1)}
                        </td>
                        <td className="py-1 px-1 text-right font-mono text-slate-700 border-x border-slate-200">{formatNumber(v.merma_excedente_litros, 1)}</td>
                        <td className="py-1 px-1 text-center font-mono text-slate-600 border-x border-slate-200">{v.merma_tolerable_litros.toFixed(0)}</td>
                        <td className="py-1 px-1.5 text-right font-mono font-semibold text-red-700 border-x border-slate-200">{formatNumber(v.merma_descontar_bs, 1)}</td>
                        <td className="py-1 px-1.5 text-right font-mono border-x border-slate-200">{formatNumber(v.tarifa_flete, 2)}</td>
                        <td className="py-1 px-2 text-right font-mono font-bold text-slate-950 border-x border-slate-200">{formatNumber(v.flete_total_bs, 2)}</td>
                      </tr>
                    ))}

                    {/* Fila de Totales Pág 2 */}
                    <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-b border-slate-400 text-xs">
                      <td colSpan={9} className="py-2 px-3 text-right uppercase border-x border-slate-300">
                        TOTALES:
                      </td>
                      <td className="py-2 px-1.5 text-right font-mono border-x border-slate-300">
                        {formatNumber(activeLiq.total_volumen_origen_litros, 0)}
                      </td>
                      <td className="py-2 px-1.5 text-right font-mono border-x border-slate-300">
                        {formatNumber(activeLiq.total_volumen_recepcionado_litros, 0)}
                      </td>
                      <td className="py-2 px-1 text-right font-mono border-x border-slate-300">
                        -{formatNumber(activeLiq.total_merma_real_litros, 1)}
                      </td>
                      <td className="py-2 px-1 text-right font-mono border-x border-slate-300">
                        {formatNumber(activeLiq.total_merma_excedente_litros, 1)}
                      </td>
                      <td className="py-2 px-1 border-x border-slate-300"></td>
                      <td className="py-2 px-1.5 text-right font-mono text-red-700 border-x border-slate-300">
                        {formatNumber(activeLiq.desc_merma_bs, 1)}
                      </td>
                      <td className="py-2 px-1.5 border-x border-slate-300"></td>
                      <td className="py-2 px-2 text-right font-mono text-emerald-800 bg-amber-100 border-x border-slate-300 text-sm">
                        {formatNumber(activeLiq.flete_total_bruto_bs, 2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Bloque de Firmas Página 2 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-10 text-center text-xs">
                <div className="border border-slate-300 rounded-lg p-3">
                  <div className="font-bold text-[10px] uppercase text-slate-500 mb-6">REALIZADO POR:</div>
                  <div className="font-bold text-slate-900 border-t border-slate-300 pt-1 text-[11px]">{firmas.realizado_por}</div>
                </div>
                <div className="border border-slate-300 rounded-lg p-3">
                  <div className="font-bold text-[10px] uppercase text-slate-500 mb-6">REVISADO POR:</div>
                  <div className="font-bold text-slate-900 border-t border-slate-300 pt-1 text-[11px]">{firmas.revisado_por}</div>
                </div>
                <div className="border border-slate-300 rounded-lg p-3">
                  <div className="font-bold text-[10px] uppercase text-slate-500 mb-6">AUTORIZADO POR:</div>
                  <div className="font-bold text-slate-900 border-t border-slate-300 pt-1 text-[11px]">{firmas.autorizado_por}</div>
                </div>
                <div className="border border-slate-300 rounded-lg p-3">
                  <div className="font-bold text-[10px] uppercase text-slate-500 mb-6">CANCELADO POR:</div>
                  <div className="font-bold text-slate-900 border-t border-slate-300 pt-1 text-[11px]">{firmas.cancelado_por}</div>
                </div>
              </div>

            </div>
          )}


          {/* ============================================================== */}
          {/* HOJA 2: RESUMEN DE DESCUENTOS Y LÍQUIDO PAGABLE (PÁG 3 DEL PDF) */}
          {/* ============================================================== */}
          {(activeTab === "hoja2" || activeTab === "ambas") && (
            <div className="bg-white text-slate-900 rounded-2xl shadow-2xl p-6 sm:p-8 max-w-3xl mx-auto border border-slate-200 page-break">
              
              {/* Encabezado Hoja 2 */}
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3 mb-6">
                <div>
                  <h2 className="text-base font-black tracking-tight uppercase text-slate-900">
                    LIQUIDACION DE FLETES
                  </h2>
                  <div className="text-xs font-bold text-slate-700 mt-0.5">
                    MES: <span className="font-black text-blue-800 uppercase">{activeLiq.periodo_mes}</span>
                  </div>
                  <div className="text-xs font-bold text-slate-700">
                    PLACA: <span className="font-mono font-black text-slate-950">{activeLiq.placa}</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-black text-slate-900 uppercase">
                    {empresaNombre}
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">
                    Resumen de Deducciones y Pagos
                  </div>
                </div>
              </div>

              {/* Tabla Central de Deducciones (Idéntica a Pág 3 del PDF) */}
              <div className="border border-slate-300 rounded-xl overflow-hidden mb-8 shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-200 text-slate-800 font-black text-[11px] uppercase border-b border-slate-300">
                      <th className="py-2.5 px-4">DESCRIPCION</th>
                      <th className="py-2.5 px-4 text-right">TOTAL Bs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[12px]">
                    <tr className="bg-slate-100 font-black text-slate-950">
                      <td className="py-2.5 px-4 uppercase">FLETE TOTAL</td>
                      <td className="py-2.5 px-4 text-right font-mono text-sm font-black text-blue-900">
                        {formatNumber(activeLiq.flete_total_bruto_bs, 2)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 text-slate-700">Descuento por Merma</td>
                      <td className="py-2 px-4 text-right font-mono text-slate-900">{formatNumber(activeLiq.desc_merma_bs, 2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 text-slate-700">Descuento de Comision 1 $us p/m3</td>
                      <td className="py-2 px-4 text-right font-mono text-slate-900">{formatNumber(activeLiq.desc_comision_usd_m3_bs, 2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 text-slate-700">Descuento de Comision 7%</td>
                      <td className="py-2 px-4 text-right font-mono text-slate-900">{formatNumber(activeLiq.desc_comision_7pct_bs, 2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 text-slate-700">Descuento YPFB BOL-GART 7%</td>
                      <td className="py-2 px-4 text-right font-mono text-slate-900">{formatNumber(activeLiq.desc_comision_ypfb_bolgart_7pct_bs, 2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 text-slate-700">Descuento de Comision 3%</td>
                      <td className="py-2 px-4 text-right font-mono text-slate-900">{formatNumber(activeLiq.desc_comision_3pct_bs, 2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 text-slate-700">Hojas de Ruta</td>
                      <td className="py-2 px-4 text-right font-mono text-slate-900">{formatNumber(activeLiq.desc_hojas_ruta_bs, 2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 text-slate-700">GPS</td>
                      <td className="py-2 px-4 text-right font-mono text-slate-900">{formatNumber(activeLiq.desc_gps_bs, 2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 text-slate-700">Anticipos y Otros 7%</td>
                      <td className="py-2 px-4 text-right font-mono text-slate-900">{formatNumber(activeLiq.desc_anticipos_otros_bs, 2)}</td>
                    </tr>

                    {activeLiq.desc_otros_ajustes_bs !== 0 && (
                      <tr>
                        <td className="py-2 px-4 text-slate-700">Otros Ajustes / Descuentos</td>
                        <td className="py-2 px-4 text-right font-mono text-slate-900">{formatNumber(activeLiq.desc_otros_ajustes_bs, 2)}</td>
                      </tr>
                    )}

                    {/* Total Descuento */}
                    <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                      <td className="py-2.5 px-4 uppercase">TOTAL DESCUENTO</td>
                      <td className="py-2.5 px-4 text-right font-mono text-sm text-red-700 font-black">
                        {formatNumber(activeLiq.total_descuentos_bs, 2)}
                      </td>
                    </tr>

                    {/* Líquido Pagable */}
                    <tr className="bg-emerald-100 font-black text-slate-950 border-t-2 border-slate-400">
                      <td className="py-3 px-4 uppercase text-sm">LIQUIDO PAGABLE</td>
                      <td className="py-3 px-4 text-right font-mono text-base font-black text-emerald-900">
                        {formatNumber(activeLiq.liquido_pagable_bs, 2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Bloque de Firmas Página 3 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-12 text-center text-xs">
                <div className="border border-slate-300 rounded-lg p-3">
                  <div className="font-bold text-[10px] uppercase text-slate-500 mb-6">REALIZADO POR:</div>
                  <div className="font-bold text-slate-900 border-t border-slate-300 pt-1 text-[11px]">{firmas.realizado_por}</div>
                </div>
                <div className="border border-slate-300 rounded-lg p-3">
                  <div className="font-bold text-[10px] uppercase text-slate-500 mb-6">REVISADO POR:</div>
                  <div className="font-bold text-slate-900 border-t border-slate-300 pt-1 text-[11px]">{firmas.revisado_por}</div>
                </div>
                <div className="border border-slate-300 rounded-lg p-3">
                  <div className="font-bold text-[10px] uppercase text-slate-500 mb-6">AUTORIZADO POR:</div>
                  <div className="font-bold text-slate-900 border-t border-slate-300 pt-1 text-[11px]">{firmas.autorizado_por}</div>
                </div>
                <div className="border border-slate-300 rounded-lg p-3">
                  <div className="font-bold text-[10px] uppercase text-slate-500 mb-6">CANCELADO POR:</div>
                  <div className="font-bold text-slate-900 border-t border-slate-300 pt-1 text-[11px]">{firmas.cancelado_por}</div>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* Modal para Ajustar Deducciones Manualmente */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-cyan-400" />
                <span>Ajustar Montos de Deducción</span>
              </h3>
              <button
                onClick={() => setShowAdjustModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAdjustments} className="p-6 space-y-3 max-h-[75vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Descuento Merma (Bs)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustData.desc_merma_bs}
                    onChange={(e) => setAdjustData({ ...adjustData, desc_merma_bs: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Comisión 1 $us p/m3 (Bs)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustData.desc_comision_usd_m3_bs}
                    onChange={(e) => setAdjustData({ ...adjustData, desc_comision_usd_m3_bs: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Comisión 7% (Bs)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustData.desc_comision_7pct_bs}
                    onChange={(e) => setAdjustData({ ...adjustData, desc_comision_7pct_bs: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">YPFB BOL-GART 7% (Bs)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustData.desc_comision_ypfb_bolgart_7pct_bs}
                    onChange={(e) => setAdjustData({ ...adjustData, desc_comision_ypfb_bolgart_7pct_bs: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Comisión 3% (Bs)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustData.desc_comision_3pct_bs}
                    onChange={(e) => setAdjustData({ ...adjustData, desc_comision_3pct_bs: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Hojas de Ruta (Bs)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustData.desc_hojas_ruta_bs}
                    onChange={(e) => setAdjustData({ ...adjustData, desc_hojas_ruta_bs: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">GPS (Bs)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustData.desc_gps_bs}
                    onChange={(e) => setAdjustData({ ...adjustData, desc_gps_bs: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Anticipos y Otros (Bs)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustData.desc_anticipos_otros_bs}
                    onChange={(e) => setAdjustData({ ...adjustData, desc_anticipos_otros_bs: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/20"
                >
                  Guardar y Recalcular
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
