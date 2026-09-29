"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
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
  Edit,
  DollarSign,
  ShieldCheck,
  TrendingDown
} from "lucide-react";
import Swal from "sweetalert2";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatNumber, formatDate } from "@/lib/format";
import DatePeriodFilter, { DateFilterChangeEvent } from "@/components/DatePeriodFilter";

export default function LiquidacionesPage() {
  const routeParams = useParams();
  const schema = (routeParams?.schema as string) || "";

  const [unidades, setUnidades] = useState<any[]>([]);
  const [selectedPlaca, setSelectedPlaca] = useState("");
  const [periodo, setPeriodo] = useState("2023-03");
  const [periodosDisponibles, setPeriodosDisponibles] = useState<any[]>([]);

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
      const [uData, lData, pData] = await Promise.all([
        apiFetch(`/tenants/${schema}/unidades/`),
        apiFetch(`/tenants/${schema}/liquidaciones/`),
        apiFetch(`/tenants/${schema}/viajes/periodos`).catch(() => [])
      ]);
      setUnidades(uData || []);
      setLiquidaciones(lData || []);
      setPeriodosDisponibles(pData || []);

      if (lData && lData.length > 0) {
        setPeriodo(lData[0].periodo_mes);
        setSelectedPlaca(lData[0].placa);
      } else if (pData && pData.length > 0) {
        setPeriodo(pData[0].periodo_mes);
        if (uData && uData.length > 0) setSelectedPlaca(uData[0].placa);
      } else if (uData && uData.length > 0) {
        setSelectedPlaca(uData[0].placa);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDateFilterChange = (filter: DateFilterChangeEvent) => {
    if (filter.periodo_mes) {
      setPeriodo(filter.periodo_mes);
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
      Swal.fire({
        icon: "warning",
        title: "Atención",
        text: "Selecciona placa y mes.",
        background: "#0f172a",
        color: "#f8fafc",
        confirmButtonColor: "#f59e0b"
      });
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
        color: "#f8fafc"
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
        color: "#f8fafc",
        confirmButtonColor: "#f59e0b"
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
      Swal.fire({ icon: "error", title: "Error al exportar Excel", text: err.message, background: "#0f172a", color: "#f8fafc", confirmButtonColor: "#f59e0b" });
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
      Swal.fire({ icon: "error", title: "Error al exportar PDF", text: err.message, background: "#0f172a", color: "#f8fafc", confirmButtonColor: "#f59e0b" });
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

      Swal.fire({
        icon: "success",
        title: "Deducciones actualizadas",
        background: "#0f172a",
        color: "#f8fafc",
        timer: 1500,
        showConfirmButton: false
      });
      setShowAdjustModal(false);
      const detalle = await apiFetch(`/tenants/${schema}/liquidaciones/${res.id}`);
      setActiveLiq(detalle);
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "Error", text: err.message, background: "#0f172a", color: "#f8fafc", confirmButtonColor: "#f59e0b" });
    }
  };

  const handleDeleteLiquidacion = async () => {
    if (!activeLiq) return;
    const result = await Swal.fire({
      title: `¿Eliminar liquidación ${activeLiq.codigo}?`,
      text: "Los viajes quedarán en estado Pendiente para poder volver a liquidarse.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#e11d48",
      cancelButtonColor: "#334155",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      background: "#0f172a",
      color: "#f8fafc"
    });

    if (result.isConfirmed) {
      try {
        await apiFetch(`/tenants/${schema}/liquidaciones/${activeLiq.id}`, { method: "DELETE" });
        Swal.fire({
          icon: "success",
          title: "Liquidación eliminada",
          background: "#0f172a",
          color: "#f8fafc",
          timer: 1500,
          showConfirmButton: false
        });
        setActiveLiq(null);
        loadInitialData();
      } catch (err: any) {
        Swal.fire({ icon: "error", title: "Error", text: err.message, background: "#0f172a", color: "#f8fafc", confirmButtonColor: "#f59e0b" });
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
    <div className="space-y-6 sm:space-y-7 font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* Encabezado y Acción Principal (Tarjeta Banner Ejecutiva) */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-lg dark:shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-5 no-print transition-colors duration-200">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/30 flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-500/10">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Planillas Oficiales de Liquidación por Camión
              </h1>
              <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                Hojas 2 y 3 Oficiales
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Generación oficial fiel al formato Excel con detalle de 17 columnas de fletes, deducciones normativas y firmas
            </p>
          </div>
        </div>

        {activeLiq && (
          <div className="flex items-center gap-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 self-start md:self-auto">
            <span className="text-slate-500 dark:text-slate-400">Liquidación:</span>
            <span className="text-amber-600 dark:text-amber-400 font-bold">{activeLiq.codigo}</span>
          </div>
        )}
      </div>

      {/* Visualizador de Meses y Filtros de Fechas */}
      <div className="no-print">
        <DatePeriodFilter
          currentPeriodoMes={periodo}
          periodosDisponibles={periodosDisponibles}
          onChange={handleDateFilterChange}
        />
      </div>

      {/* Barra de Controles y Generación */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col lg:flex-row items-center justify-between gap-4 no-print transition-colors duration-200">
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Mes */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <Calendar className="w-4 h-4 text-amber-500" />
            <span className="text-slate-500 dark:text-slate-400 font-medium">Mes Activo:</span>
            <input
              type="month"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="bg-transparent text-slate-900 dark:text-white font-bold focus:outline-none cursor-pointer text-xs"
            />
          </div>

          {/* Placa */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <Truck className="w-4 h-4 text-amber-500" />
            <span className="text-slate-500 dark:text-slate-400 font-medium">Placa:</span>
            <select
              value={selectedPlaca}
              onChange={(e) => setSelectedPlaca(e.target.value)}
              className="bg-transparent text-slate-900 dark:text-white font-bold focus:outline-none cursor-pointer text-xs"
            >
              <option value="" className="bg-white dark:bg-slate-900">-- Seleccionar Placa --</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.placa} className="bg-white dark:bg-slate-900">
                  {u.placa}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleGenerate}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs sm:text-sm font-black rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition transform active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Generar / Actualizar Liquidación</span>
          </button>
        </div>

        {/* Acciones de Exportación si hay liquidación activa */}
        {activeLiq && (
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end">
            <button
              onClick={downloadExcel}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-900/30 flex items-center gap-1.5 transition active:scale-95"
              title="Descargar archivo Excel con ambas pestañas"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel (.xlsx)</span>
            </button>

            <button
              onClick={downloadPDF}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-900/30 flex items-center gap-1.5 transition active:scale-95"
              title="Descargar reporte en formato PDF"
            >
              <Download className="w-4 h-4" />
              <span>PDF</span>
            </button>

            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition active:scale-95"
              title="Imprimir formato oficial"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>

            <button
              onClick={openAdjustModal}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-amber-600 dark:text-amber-400 border border-slate-200 dark:border-slate-700 transition"
              title="Ajustar deducciones manualmente"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            <button
              onClick={handleDeleteLiquidacion}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-500/20 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 transition"
              title="Eliminar liquidación"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Selector de Pestañas de Visualización */}
      {activeLiq && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print">
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
            <button
              onClick={() => setActiveTab("ambas")}
              className={`px-3.5 py-1.5 rounded-xl transition ${
                activeTab === "ambas" 
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20" 
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Planilla Completa (Hojas 2 y 3)
            </button>
            <button
              onClick={() => setActiveTab("hoja1")}
              className={`px-3.5 py-1.5 rounded-xl transition ${
                activeTab === "hoja1" 
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20" 
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Hoja 1: Detalle de Fletes (Pág. 2)
            </button>
            <button
              onClick={() => setActiveTab("hoja2")}
              className={`px-3.5 py-1.5 rounded-xl transition ${
                activeTab === "hoja2" 
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20" 
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Hoja 2: Deducciones y Líquido (Pág. 3)
            </button>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            Código: <span className="text-amber-600 dark:text-amber-400 font-bold">{activeLiq.codigo}</span>
          </div>
        </div>
      )}

      {/* Contenedor del Documento */}
      {loading ? (
        <div className="flex flex-col justify-center items-center py-28 gap-3">
          <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
          <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Procesando liquidación...</span>
        </div>
      ) : !activeLiq ? (
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 sm:p-14 text-center max-w-2xl mx-auto shadow-sm dark:shadow-2xl">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-5 shadow-xl shadow-amber-500/10">
            <FileSpreadsheet className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Generación de Planillas Oficiales por Cisterna
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto mb-6 leading-relaxed">
            {selectedPlaca 
              ? `No se ha generado aún la liquidación para la placa ${selectedPlaca} en el periodo ${periodo}. Haz clic para calcular fletes y deducciones.`
              : `Selecciona una placa de la flota y el periodo mensual en los controles superiores para emitir las Hojas 2 y 3 oficiales conforme al formato de auditoría.`
            }
          </p>
          <button
            onClick={handleGenerate}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs sm:text-sm font-black rounded-xl shadow-xl shadow-amber-500/25 transition transform hover:scale-105 active:scale-95 mb-8"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Generar Planilla Oficial Ahora</span>
          </button>

          {/* Tarjetas de Guía */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-left">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
              <div className="text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center gap-2 mb-1.5">
                <FileSpreadsheet className="w-4 h-4 flex-shrink-0" />
                <span>Hoja 1 (Pág. 2)</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                Detalle operativo de 17 columnas con MICs, tramos y mermas por viaje.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
              <div className="text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-2 mb-1.5">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Hoja 2 (Pág. 3)</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                Deducciones normativas de ley y determinación del líquido pagable en Bs.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
              <div className="text-sky-600 dark:text-sky-400 font-bold text-xs flex items-center gap-2 mb-1.5">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                <span>Firmas Oficiales</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                Responsables de elaboración, revisión gerencial y auditoría legal.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* ============================================================== */}
          {/* HOJA 1: DETALLE OPERATIVO DE FLETES (PÁGINA 2 DEL PDF) */}
          {/* ============================================================== */}
          {(activeTab === "hoja1" || activeTab === "ambas") && (
            <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl shadow-xl dark:shadow-2xl p-6 sm:p-8 overflow-x-auto border border-slate-200 dark:border-slate-800 print:bg-white print:text-slate-900 print:border-none print:shadow-none print:p-0">
              
              {/* Encabezado Hoja 1 */}
              <div className="flex flex-col sm:flex-row items-start justify-between gap-4 border-b-2 border-slate-200 dark:border-slate-700 print:border-slate-900 pb-4 mb-5">
                <div>
                  <h2 className="text-base font-black tracking-tight uppercase text-amber-600 dark:text-amber-400 print:text-slate-900">
                    LIQUIDACION DE FLETES
                  </h2>
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-300 print:text-slate-700 mt-1">
                    MES: <span className="font-black text-amber-600 dark:text-amber-400 print:text-blue-800 uppercase">{activeLiq.periodo_mes}</span>
                  </div>
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-300 print:text-slate-700">
                    PLACA: <span className="font-mono font-black text-slate-900 dark:text-white print:text-slate-950 text-sm">{activeLiq.placa}</span>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end">
                  <div className="text-sm font-black text-slate-900 dark:text-white print:text-slate-900 uppercase">
                    {empresaNombre}
                  </div>
                  <div className="inline-flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 print:border-slate-300 rounded-lg px-2.5 py-0.5 mt-1 text-[11px] font-bold bg-slate-50 dark:bg-slate-950 print:bg-slate-50">
                    <span className="text-slate-500 dark:text-slate-400 print:text-slate-500">TASA MERMA:</span>
                    <span className="text-rose-600 dark:text-rose-400 print:text-red-700 font-mono font-black">7,45 Bs/L</span>
                  </div>
                </div>
              </div>

              {/* Tabla de Viajes de la Placa (17 Columnas exactas de Pág 2) */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-200 print:bg-slate-100 print:text-slate-800 text-[10px] uppercase font-black text-center border-y border-slate-200 dark:border-slate-800 print:border-slate-300">
                      <th className="py-2 px-1 border-x border-slate-200 dark:border-slate-800 print:border-slate-300">Nº</th>
                      <th className="py-2 px-1.5 border-x border-slate-200 dark:border-slate-800 print:border-slate-300">FECHA DE CARGA</th>
                      <th className="py-2 px-1.5 border-x border-slate-200 dark:border-slate-800 print:border-slate-300">FECHA DE DESCARGA</th>
                      <th className="py-2 px-1.5 border-x border-slate-200 dark:border-slate-800 print:border-slate-300">MIC/DTA Nº</th>
                      <th className="py-2 px-2 border-x border-slate-200 dark:border-slate-800 print:border-slate-300 text-left">EMPRESA</th>
                      <th className="py-2 px-1 border-x border-slate-200 dark:border-slate-800 print:border-slate-300">PLACA</th>
                      <th className="py-2 px-2 border-x border-slate-200 dark:border-slate-800 print:border-slate-300 text-left">TRAMO</th>
                      <th className="py-2 px-1 border-x border-slate-200 dark:border-slate-800 print:border-slate-300">CLIENTE</th>
                      <th className="py-2 px-1 border-x border-slate-200 dark:border-slate-800 print:border-slate-300">PRODUCTO</th>
                      <th className="py-2 px-1.5 border-x border-slate-200 dark:border-slate-800 print:border-slate-300 text-right">Volumen en LL Origen</th>
                      <th className="py-2 px-1.5 border-x border-slate-200 dark:border-slate-800 print:border-slate-300 text-right">Volumen Recepcionado</th>
                      <th className="py-2 px-1 border-x border-slate-200 dark:border-slate-800 print:border-slate-300 text-right">Merma T:T</th>
                      <th className="py-2 px-1 border-x border-slate-200 dark:border-slate-800 print:border-slate-300 text-right">Total Merma Litros</th>
                      <th className="py-2 px-1 border-x border-slate-200 dark:border-slate-800 print:border-slate-300 text-center">MERMA [0,15% D / 0,25% G]</th>
                      <th className="py-2 px-1.5 border-x border-slate-200 dark:border-slate-800 print:border-slate-300 text-right">Merma a Descontar Y.P.F.B.</th>
                      <th className="py-2 px-1.5 border-x border-slate-200 dark:border-slate-800 print:border-slate-300 text-right">TARIFA Bs.</th>
                      <th className="py-2 px-2 border-x border-slate-200 dark:border-slate-800 print:border-slate-300 text-right">Total a pagar en Bob.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeLiq.viajes?.map((v: any, idx: number) => (
                      <tr 
                        key={v.id} 
                        className={`border-b border-slate-200 dark:border-slate-800 print:border-slate-200 hover:bg-amber-50/40 dark:hover:bg-slate-800/40 print:hover:bg-slate-50 ${
                          idx % 2 === 0 ? "bg-white dark:bg-slate-900/60 print:bg-white" : "bg-slate-50/70 dark:bg-slate-950/40 print:bg-slate-50/50"
                        }`}
                      >
                        <td className="py-1 px-1 text-center font-bold border-x border-slate-200 dark:border-slate-800 print:border-slate-200 text-slate-700 dark:text-slate-300 print:text-slate-800">{idx + 1}</td>
                        <td className="py-1 px-1.5 text-center text-slate-500 dark:text-slate-400 print:text-slate-600 border-x border-slate-200 dark:border-slate-800 print:border-slate-200">{formatDate(v.fecha_carga)}</td>
                        <td className="py-1 px-1.5 text-center text-slate-500 dark:text-slate-400 print:text-slate-600 border-x border-slate-200 dark:border-slate-800 print:border-slate-200">{formatDate(v.fecha_descarga)}</td>
                        <td className="py-1 px-1.5 text-center font-mono font-bold text-slate-900 dark:text-white print:text-slate-800 border-x border-slate-200 dark:border-slate-800 print:border-slate-200">{v.mic_dta || "-"}</td>
                        <td className="py-1 px-2 text-slate-700 dark:text-slate-300 print:text-slate-700 truncate max-w-[130px] border-x border-slate-200 dark:border-slate-800 print:border-slate-200">{empresaNombre}</td>
                        <td className="py-1 px-1 text-center font-mono font-bold text-amber-700 dark:text-amber-400 print:text-slate-900 border-x border-slate-200 dark:border-slate-800 print:border-slate-200">{v.placa}</td>
                        <td className="py-1 px-2 text-slate-700 dark:text-slate-300 print:text-slate-800 uppercase text-[10px] border-x border-slate-200 dark:border-slate-800 print:border-slate-200">{v.tramo}</td>
                        <td className="py-1 px-1 text-center font-bold text-slate-600 dark:text-slate-300 print:text-slate-700 border-x border-slate-200 dark:border-slate-800 print:border-slate-200">{v.cliente || "YPFB"}</td>
                        <td className="py-1 px-1 text-center font-bold text-amber-700 dark:text-amber-400 print:text-blue-900 border-x border-slate-200 dark:border-slate-800 print:border-slate-200">{v.producto}</td>
                        <td className="py-1 px-1.5 text-right font-mono text-slate-700 dark:text-slate-200 print:text-slate-800 border-x border-slate-200 dark:border-slate-800 print:border-slate-200">{formatNumber(v.volumen_origen_litros, 0)}</td>
                        <td className="py-1 px-1.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 print:text-slate-900 border-x border-slate-200 dark:border-slate-800 print:border-slate-200">{formatNumber(v.volumen_recepcionado_litros, 0)}</td>
                        <td className="py-1 px-1 text-right font-mono text-slate-700 dark:text-slate-300 print:text-slate-700 border-x border-slate-200 dark:border-slate-800 print:border-slate-200">
                          {v.merma_real_litros > 0 ? `-${formatNumber(v.merma_real_litros, 1)}` : formatNumber(v.merma_real_litros, 1)}
                        </td>
                        <td className="py-1 px-1 text-right font-mono text-slate-700 dark:text-slate-300 print:text-slate-700 border-x border-slate-200 dark:border-slate-800 print:border-slate-200">{formatNumber(v.merma_excedente_litros, 1)}</td>
                        <td className="py-1 px-1 text-center font-mono text-slate-500 dark:text-slate-400 print:text-slate-600 border-x border-slate-200 dark:border-slate-800 print:border-slate-200">{v.merma_tolerable_litros.toFixed(0)}</td>
                        <td className="py-1 px-1.5 text-right font-mono font-semibold text-rose-700 dark:text-rose-400 print:text-red-700 border-x border-slate-200 dark:border-slate-800 print:border-slate-200">{formatNumber(v.merma_descontar_bs, 1)}</td>
                        <td className="py-1 px-1.5 text-right font-mono text-slate-700 dark:text-slate-300 print:text-slate-800 border-x border-slate-200 dark:border-slate-800 print:border-slate-200">{formatNumber(v.tarifa_flete, 2)}</td>
                        <td className="py-1 px-2 text-right font-mono font-bold text-amber-700 dark:text-amber-400 print:text-slate-950 border-x border-slate-200 dark:border-slate-800 print:border-slate-200">{formatNumber(v.flete_total_bs, 2)}</td>
                      </tr>
                    ))}

                    {/* Fila de Totales Pág 2 */}
                    <tr className="bg-slate-100 dark:bg-slate-800/90 print:bg-slate-100 font-black text-slate-900 dark:text-white print:text-slate-900 border-t-2 border-b border-slate-300 dark:border-slate-700 print:border-slate-400 text-xs">
                      <td colSpan={9} className="py-2.5 px-3 text-right uppercase border-x border-slate-300 dark:border-slate-700 print:border-slate-300">
                        TOTALES:
                      </td>
                      <td className="py-2.5 px-1.5 text-right font-mono border-x border-slate-300 dark:border-slate-700 print:border-slate-300">
                        {formatNumber(activeLiq.total_volumen_origen_litros, 0)}
                      </td>
                      <td className="py-2.5 px-1.5 text-right font-mono border-x border-slate-300 dark:border-slate-700 print:border-slate-300">
                        {formatNumber(activeLiq.total_volumen_recepcionado_litros, 0)}
                      </td>
                      <td className="py-2.5 px-1 text-right font-mono border-x border-slate-300 dark:border-slate-700 print:border-slate-300">
                        -{formatNumber(activeLiq.total_merma_real_litros, 1)}
                      </td>
                      <td className="py-2.5 px-1 text-right font-mono border-x border-slate-300 dark:border-slate-700 print:border-slate-300">
                        {formatNumber(activeLiq.total_merma_excedente_litros, 1)}
                      </td>
                      <td className="py-2.5 px-1 border-x border-slate-300 dark:border-slate-700 print:border-slate-300"></td>
                      <td className="py-2.5 px-1.5 text-right font-mono text-rose-700 dark:text-rose-400 print:text-red-700 border-x border-slate-300 dark:border-slate-700 print:border-slate-300">
                        {formatNumber(activeLiq.desc_merma_bs, 1)}
                      </td>
                      <td className="py-2.5 px-1.5 border-x border-slate-300 dark:border-slate-700 print:border-slate-300"></td>
                      <td className="py-2.5 px-2 text-right font-mono text-amber-900 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/15 print:bg-amber-50 border-x border-slate-300 dark:border-slate-700 print:border-slate-300 text-sm font-black">
                        {formatNumber(activeLiq.flete_total_bruto_bs, 2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Bloque de Firmas Página 2 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-10 text-center text-xs">
                <div className="border border-slate-200 dark:border-slate-800 print:border-slate-300 rounded-2xl p-3 bg-slate-50 dark:bg-slate-950/60 print:bg-white">
                  <div className="font-bold text-[10px] uppercase text-slate-500 dark:text-slate-400 print:text-slate-500 mb-6">REALIZADO POR:</div>
                  <div className="font-bold text-slate-900 dark:text-white print:text-slate-900 border-t border-slate-200 dark:border-slate-800 print:border-slate-300 pt-1 text-[11px]">{firmas.realizado_por}</div>
                </div>
                <div className="border border-slate-200 dark:border-slate-800 print:border-slate-300 rounded-2xl p-3 bg-slate-50 dark:bg-slate-950/60 print:bg-white">
                  <div className="font-bold text-[10px] uppercase text-slate-500 dark:text-slate-400 print:text-slate-500 mb-6">REVISADO POR:</div>
                  <div className="font-bold text-slate-900 dark:text-white print:text-slate-900 border-t border-slate-200 dark:border-slate-800 print:border-slate-300 pt-1 text-[11px]">{firmas.revisado_por}</div>
                </div>
                <div className="border border-slate-200 dark:border-slate-800 print:border-slate-300 rounded-2xl p-3 bg-slate-50 dark:bg-slate-950/60 print:bg-white">
                  <div className="font-bold text-[10px] uppercase text-slate-500 dark:text-slate-400 print:text-slate-500 mb-6">AUTORIZADO POR:</div>
                  <div className="font-bold text-slate-900 dark:text-white print:text-slate-900 border-t border-slate-200 dark:border-slate-800 print:border-slate-300 pt-1 text-[11px]">{firmas.autorizado_por}</div>
                </div>
                <div className="border border-slate-200 dark:border-slate-800 print:border-slate-300 rounded-2xl p-3 bg-slate-50 dark:bg-slate-950/60 print:bg-white">
                  <div className="font-bold text-[10px] uppercase text-slate-500 dark:text-slate-400 print:text-slate-500 mb-6">CANCELADO POR:</div>
                  <div className="font-bold text-slate-900 dark:text-white print:text-slate-900 border-t border-slate-200 dark:border-slate-800 print:border-slate-300 pt-1 text-[11px]">{firmas.cancelado_por}</div>
                </div>
              </div>

            </div>
          )}


          {/* ============================================================== */}
          {/* HOJA 2: RESUMEN DE DESCUENTOS Y LÍQUIDO PAGABLE (PÁG 3 DEL PDF) */}
          {/* ============================================================== */}
          {(activeTab === "hoja2" || activeTab === "ambas") && (
            <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl shadow-xl dark:shadow-2xl p-6 sm:p-8 max-w-3xl mx-auto border border-slate-200 dark:border-slate-800 print:bg-white print:text-slate-900 print:border-none print:shadow-none print:p-0 page-break">
              
              {/* Encabezado Hoja 2 */}
              <div className="flex items-start justify-between border-b-2 border-slate-200 dark:border-slate-700 print:border-slate-900 pb-4 mb-6">
                <div>
                  <h2 className="text-base font-black tracking-tight uppercase text-amber-600 dark:text-amber-400 print:text-slate-900">
                    LIQUIDACION DE FLETES
                  </h2>
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-300 print:text-slate-700 mt-1">
                    MES: <span className="font-black text-amber-600 dark:text-amber-400 print:text-blue-800 uppercase">{activeLiq.periodo_mes}</span>
                  </div>
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-300 print:text-slate-700">
                    PLACA: <span className="font-mono font-black text-slate-900 dark:text-white print:text-slate-950">{activeLiq.placa}</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-black text-slate-900 dark:text-white print:text-slate-900 uppercase">
                    {empresaNombre}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 print:text-slate-500 uppercase font-bold">
                    Resumen de Deducciones y Pagos
                  </div>
                </div>
              </div>

              {/* Tabla Central de Deducciones (Idéntica a Pág 3 del PDF) */}
              <div className="border border-slate-200 dark:border-slate-800 print:border-slate-300 rounded-2xl overflow-hidden mb-8 shadow-sm dark:shadow-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-200 print:bg-slate-100 print:text-slate-800 font-black text-[11px] uppercase border-b border-slate-200 dark:border-slate-800 print:border-slate-300">
                      <th className="py-3 px-4">DESCRIPCION</th>
                      <th className="py-3 px-4 text-right">TOTAL Bs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 print:divide-slate-200 text-[12px]">
                    <tr className="bg-amber-50 dark:bg-amber-500/15 print:bg-slate-50 font-black text-amber-900 dark:text-amber-300 print:text-slate-950">
                      <td className="py-3 px-4 uppercase">FLETE TOTAL</td>
                      <td className="py-3 px-4 text-right font-mono text-sm font-black text-amber-700 dark:text-amber-400 print:text-blue-900">
                        {formatNumber(activeLiq.flete_total_bruto_bs, 2)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 print:text-slate-700">Descuento por Merma</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-900 dark:text-white print:text-slate-900">{formatNumber(activeLiq.desc_merma_bs, 2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 print:text-slate-700">Descuento de Comision 1 $us p/m3</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-900 dark:text-white print:text-slate-900">{formatNumber(activeLiq.desc_comision_usd_m3_bs, 2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 print:text-slate-700">Descuento de Comision 7%</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-900 dark:text-white print:text-slate-900">{formatNumber(activeLiq.desc_comision_7pct_bs, 2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 print:text-slate-700">Descuento YPFB BOL-GART 7%</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-900 dark:text-white print:text-slate-900">{formatNumber(activeLiq.desc_comision_ypfb_bolgart_7pct_bs, 2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 print:text-slate-700">Descuento de Comision 3%</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-900 dark:text-white print:text-slate-900">{formatNumber(activeLiq.desc_comision_3pct_bs, 2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 print:text-slate-700">Hojas de Ruta</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-900 dark:text-white print:text-slate-900">{formatNumber(activeLiq.desc_hojas_ruta_bs, 2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 print:text-slate-700">GPS</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-900 dark:text-white print:text-slate-900">{formatNumber(activeLiq.desc_gps_bs, 2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 print:text-slate-700">Anticipos y Otros 7%</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-900 dark:text-white print:text-slate-900">{formatNumber(activeLiq.desc_anticipos_otros_bs, 2)}</td>
                    </tr>

                    {activeLiq.desc_otros_ajustes_bs !== 0 && (
                      <tr>
                        <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 print:text-slate-700">Otros Ajustes / Descuentos</td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-900 dark:text-white print:text-slate-900">{formatNumber(activeLiq.desc_otros_ajustes_bs, 2)}</td>
                      </tr>
                    )}

                    {/* Total Descuento */}
                    <tr className="bg-rose-50 dark:bg-rose-500/15 print:bg-slate-50 font-bold text-rose-900 dark:text-rose-300 print:text-slate-900 border-t-2 border-slate-200 dark:border-slate-700 print:border-slate-300">
                      <td className="py-3 px-4 uppercase font-black">TOTAL DESCUENTO</td>
                      <td className="py-3 px-4 text-right font-mono text-sm text-rose-700 dark:text-rose-400 print:text-red-600 font-black">
                        {formatNumber(activeLiq.total_descuentos_bs, 2)}
                      </td>
                    </tr>

                    {/* Líquido Pagable */}
                    <tr className="bg-emerald-50 dark:bg-emerald-500/20 print:bg-emerald-50 font-black text-emerald-950 dark:text-emerald-300 print:text-slate-950 border-t-2 border-emerald-500 print:border-emerald-300">
                      <td className="py-3.5 px-4 uppercase text-sm">LIQUIDO PAGABLE</td>
                      <td className="py-3.5 px-4 text-right font-mono text-base font-black text-emerald-700 dark:text-emerald-400 print:text-emerald-700">
                        {formatNumber(activeLiq.liquido_pagable_bs, 2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Bloque de Firmas Página 3 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-12 text-center text-xs">
                <div className="border border-slate-200 dark:border-slate-800 print:border-slate-300 rounded-2xl p-3 bg-slate-50 dark:bg-slate-950/60 print:bg-white">
                  <div className="font-bold text-[10px] uppercase text-slate-500 dark:text-slate-400 print:text-slate-500 mb-6">REALIZADO POR:</div>
                  <div className="font-bold text-slate-900 dark:text-white print:text-slate-900 border-t border-slate-200 dark:border-slate-800 print:border-slate-300 pt-1 text-[11px]">{firmas.realizado_por}</div>
                </div>
                <div className="border border-slate-200 dark:border-slate-800 print:border-slate-300 rounded-2xl p-3 bg-slate-50 dark:bg-slate-950/60 print:bg-white">
                  <div className="font-bold text-[10px] uppercase text-slate-500 dark:text-slate-400 print:text-slate-500 mb-6">REVISADO POR:</div>
                  <div className="font-bold text-slate-900 dark:text-white print:text-slate-900 border-t border-slate-200 dark:border-slate-800 print:border-slate-300 pt-1 text-[11px]">{firmas.revisado_por}</div>
                </div>
                <div className="border border-slate-200 dark:border-slate-800 print:border-slate-300 rounded-2xl p-3 bg-slate-50 dark:bg-slate-950/60 print:bg-white">
                  <div className="font-bold text-[10px] uppercase text-slate-500 dark:text-slate-400 print:text-slate-500 mb-6">AUTORIZADO POR:</div>
                  <div className="font-bold text-slate-900 dark:text-white print:text-slate-900 border-t border-slate-200 dark:border-slate-800 print:border-slate-300 pt-1 text-[11px]">{firmas.autorizado_por}</div>
                </div>
                <div className="border border-slate-200 dark:border-slate-800 print:border-slate-300 rounded-2xl p-3 bg-slate-50 dark:bg-slate-950/60 print:bg-white">
                  <div className="font-bold text-[10px] uppercase text-slate-500 dark:text-slate-400 print:text-slate-500 mb-6">CANCELADO POR:</div>
                  <div className="font-bold text-slate-900 dark:text-white print:text-slate-900 border-t border-slate-200 dark:border-slate-800 print:border-slate-300 pt-1 text-[11px]">{firmas.cancelado_por}</div>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* Modal para Ajustar Deducciones Manualmente */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <span>Ajustar Montos de Deducción</span>
              </h3>
              <button
                onClick={() => setShowAdjustModal(false)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAdjustments} className="p-6 space-y-3.5 max-h-[75vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Descuento Merma (Bs)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustData.desc_merma_bs}
                    onChange={(e) => setAdjustData({ ...adjustData, desc_merma_bs: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Comisión 1 $us p/m3 (Bs)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustData.desc_comision_usd_m3_bs}
                    onChange={(e) => setAdjustData({ ...adjustData, desc_comision_usd_m3_bs: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Comisión 7% (Bs)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustData.desc_comision_7pct_bs}
                    onChange={(e) => setAdjustData({ ...adjustData, desc_comision_7pct_bs: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">YPFB BOL-GART 7% (Bs)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustData.desc_comision_ypfb_bolgart_7pct_bs}
                    onChange={(e) => setAdjustData({ ...adjustData, desc_comision_ypfb_bolgart_7pct_bs: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Comisión 3% (Bs)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustData.desc_comision_3pct_bs}
                    onChange={(e) => setAdjustData({ ...adjustData, desc_comision_3pct_bs: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Hojas de Ruta (Bs)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustData.desc_hojas_ruta_bs}
                    onChange={(e) => setAdjustData({ ...adjustData, desc_hojas_ruta_bs: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">GPS (Bs)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustData.desc_gps_bs}
                    onChange={(e) => setAdjustData({ ...adjustData, desc_gps_bs: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Anticipos y Otros (Bs)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustData.desc_anticipos_otros_bs}
                    onChange={(e) => setAdjustData({ ...adjustData, desc_anticipos_otros_bs: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-bold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 transition"
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
