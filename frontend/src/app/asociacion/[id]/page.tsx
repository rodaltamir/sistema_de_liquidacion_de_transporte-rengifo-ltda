"use client";

import { Suspense, useState, useEffect, use, Fragment } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import { 
  Building2, 
  ArrowLeft, 
  Truck, 
  FileSpreadsheet, 
  Download, 
  Printer, 
  Plus, 
  ArrowRight, 
  Calendar, 
  Layers, 
  Info,
  CheckCircle2,
  FileText,
  Fuel,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  ShieldCheck
} from "lucide-react";
import Swal from "sweetalert2";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatNumber, formatDate } from "@/lib/format";
import ThemeToggle from "@/components/ThemeToggle";
import DatePeriodFilter, { DateFilterChangeEvent, FilterMode } from "@/components/DatePeriodFilter";

export default function AsociacionDetallePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
        <span className="text-slate-400 text-xs font-semibold tracking-wider uppercase">Cargando Asociación...</span>
      </div>
    }>
      <AsociacionDetalleContent />
    </Suspense>
  );
}

function AsociacionDetalleContent() {
  const routeParams = useParams();
  const asocId = (routeParams?.id as string) || "";
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = searchParams.get("tab") === "liquidacion" ? "liquidacion" : "empresas";
  const [activeTab, setActiveTab] = useState<"empresas" | "liquidacion">(initialTab);

  const [asociacion, setAsociacion] = useState<any>(null);
  const [resumenStats, setResumenStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filtros unificados de periodo de tiempo (Mensual, Semestral, Anual, Personalizado, Todo)
  const currentYear = new Date().getFullYear();
  const [filterMode, setFilterMode] = useState<FilterMode>("anual");
  const [activeFilterLabel, setActiveFilterLabel] = useState(`Gestión ${currentYear} (Anual)`);
  const [dateFilterQuery, setDateFilterQuery] = useState(`anio=${currentYear}`);
  const [periodoMes, setPeriodoMes] = useState(`ANUAL-${currentYear}`);
  const [liqData, setLiqData] = useState<any>(null);
  const [loadingLiq, setLoadingLiq] = useState(false);

  useEffect(() => {
    loadAsociacion();
  }, [asocId]);

  useEffect(() => {
    loadResumen();
    if (activeTab === "liquidacion") {
      loadLiquidacionGeneral();
    }
  }, [asocId, activeTab, filterMode, dateFilterQuery, periodoMes]);

  const loadAsociacion = async () => {
    try {
      const data = await apiFetch(`/asociaciones/${asocId}`);
      setAsociacion(data);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al cargar asociación",
        text: err.message,
        background: "#0f172a",
        color: "#f8fafc",
        confirmButtonColor: "#f59e0b"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDateFilterChange = (filter: DateFilterChangeEvent) => {
    setFilterMode(filter.mode);
    setActiveFilterLabel(filter.label);

    if (filter.mode === "mes" && filter.periodo_mes) {
      setPeriodoMes(filter.periodo_mes);
      setDateFilterQuery(`periodo_mes=${filter.periodo_mes}`);
    } else if (filter.mode === "semestral") {
      const q = [
        filter.anio ? `anio=${filter.anio}` : "",
        filter.semestre ? `semestre=${filter.semestre}` : "",
        filter.fecha_desde ? `fecha_desde=${filter.fecha_desde}` : "",
        filter.fecha_hasta ? `fecha_hasta=${filter.fecha_hasta}` : ""
      ].filter(Boolean).join("&");
      setDateFilterQuery(q);
      if (filter.anio && filter.semestre) {
        setPeriodoMes(`${filter.anio}-S${filter.semestre}`);
      }
    } else if (filter.mode === "anual" && filter.anio) {
      setDateFilterQuery(`anio=${filter.anio}`);
      setPeriodoMes(`ANUAL-${filter.anio}`);
    } else if (filter.mode === "personalizado" && filter.fecha_desde && filter.fecha_hasta) {
      setDateFilterQuery(`fecha_desde=${filter.fecha_desde}&fecha_hasta=${filter.fecha_hasta}`);
      setPeriodoMes(`${filter.fecha_desde}_${filter.fecha_hasta}`);
    } else if (filter.mode === "historico") {
      setDateFilterQuery("");
      setPeriodoMes("");
    }
  };

  const loadResumen = async () => {
    try {
      const qParams: string[] = [`tipo_periodo=${filterMode}`];
      if (dateFilterQuery) {
        qParams.push(dateFilterQuery);
      } else if (periodoMes) {
        qParams.push(`periodo_mes=${periodoMes}`);
      }
      const stats = await apiFetch(`/asociaciones/${asocId}/resumen?${qParams.join("&")}`);
      setResumenStats(stats);
    } catch (err) {
      console.warn("No se pudieron cargar estadísticas resumidas de la asociación", err);
    }
  };

  const loadLiquidacionGeneral = async () => {
    setLoadingLiq(true);
    try {
      const qParams: string[] = [`tipo_periodo=${filterMode}`];
      if (dateFilterQuery) {
        qParams.push(dateFilterQuery);
      } else if (periodoMes) {
        qParams.push(`periodo_mes=${periodoMes}`);
      }
      const data = await apiFetch(`/asociaciones/${asocId}/liquidacion-general?${qParams.join("&")}`);
      setLiqData(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingLiq(false);
    }
  };

  const downloadExcel = async () => {
    try {
      const qParams: string[] = [`tipo_periodo=${filterMode}`];
      if (dateFilterQuery) {
        qParams.push(dateFilterQuery);
      } else if (periodoMes) {
        qParams.push(`periodo_mes=${periodoMes}`);
      }
      const blob = await apiFetch(`/asociaciones/${asocId}/export/excel?${qParams.join("&")}`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeLabel = (liqData?.periodo_mes || activeFilterLabel || periodoMes || "General").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
      a.download = `Liquidacion_Asociacion_${(asociacion?.name || asocId).replace(/\s+/g, "_")}_${safeLabel}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      Swal.fire({ 
        icon: "error", 
        title: "Error al exportar Excel", 
        text: err.message, 
        background: "#0f172a", 
        color: "#f8fafc", 
        confirmButtonColor: "#f59e0b" 
      });
    }
  };

  const downloadPDF = async () => {
    try {
      const qParams: string[] = [`tipo_periodo=${filterMode}`];
      if (dateFilterQuery) {
        qParams.push(dateFilterQuery);
      } else if (periodoMes) {
        qParams.push(`periodo_mes=${periodoMes}`);
      }
      const blob = await apiFetch(`/asociaciones/${asocId}/export/pdf?${qParams.join("&")}`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeLabel = (liqData?.periodo_mes || activeFilterLabel || periodoMes || "General").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
      a.download = `Liquidacion_Asociacion_${(asociacion?.name || asocId).replace(/\s+/g, "_")}_${safeLabel}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      Swal.fire({ 
        icon: "error", 
        title: "Error al exportar PDF", 
        text: err.message, 
        background: "#0f172a", 
        color: "#f59e0b" 
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
        <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold tracking-wider uppercase">Cargando Asociación...</span>
      </div>
    );
  }

  if (!asociacion) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-4">
          <Building2 className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Asociación no encontrada</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm">
          No se encontró el registro de la asociación solicitada o fue dada de baja.
        </p>
        <Link 
          href="/seleccionar-asociacion" 
          className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 rounded-xl text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition"
        >
          Volver al Directorio
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950 transition-colors duration-200">
      
      {/* Top Navbar Sleek & Compact */}
      <header className="bg-white/90 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-xs dark:shadow-lg no-print">
        <div className="max-w-[1700px] w-full mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <Link
              href="/seleccionar-asociacion"
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition group"
              title="Volver al Directorio de Asociaciones"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            </Link>

            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shadow-inner flex-shrink-0">
              <Building2 className="w-5 h-5 text-amber-500" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black tracking-tight text-slate-900 dark:text-white truncate" title={asociacion.name}>
                  {asociacion.name}
                </h1>
                {asociacion.sigla && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex-shrink-0">
                    {asociacion.sigla}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 truncate">
                <span>{asociacion.empresas?.length || 0} empresas afiliadas</span>
                {asociacion.representante_legal && (
                  <>
                    <span>&bull;</span>
                    <span>Rep: <strong className="text-slate-700 dark:text-slate-300">{asociacion.representante_legal}</strong></span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />

            {/* Selector de Pestañas Moderno */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setActiveTab("empresas")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === "empresas"
                    ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Empresas ({asociacion.empresas?.length || 0})</span>
              </button>
              <button
                onClick={() => setActiveTab("liquidacion")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === "liquidacion"
                    ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Liquidación Oficial</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido Principal con ancho completo */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-6">
        
        {/* ============================================================== */}
        {/* MINI DASHBOARD EJECUTIVO DE LA ASOCIACIÓN (COMPACTO) */}
        {/* ============================================================== */}
        <section className="no-print">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            
            {/* KPI 1: Empresas Afiliadas */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Empresas Socias</span>
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
                  {asociacion.empresas?.length || 0}
                </div>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">Consorcio Activo</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 flex-shrink-0">
                <Building2 className="w-4.5 h-4.5" />
              </div>
            </div>

            {/* KPI 2: Flota de Cisternas */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Flota Total</span>
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
                  {resumenStats?.total_camiones ?? 0}
                </div>
                <span className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold">Cisternas registradas</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-500 flex-shrink-0">
                <Truck className="w-4.5 h-4.5" />
              </div>
            </div>

            {/* KPI 3: Viajes Conciliados */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Viajes Conciliados</span>
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
                  {resumenStats?.total_viajes ?? 0}
                </div>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">Despachos {periodoMes}</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 flex-shrink-0">
                <Layers className="w-4.5 h-4.5" />
              </div>
            </div>

            {/* KPI 4: Volumen Total */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Vol. Recepcionado</span>
                <div className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                  {resumenStats ? formatNumber(resumenStats.total_volumen_litros, 0) : "0"} <span className="text-[10px]">L</span>
                </div>
                <span className="text-[10px] text-emerald-600 font-semibold">{resumenStats ? `${formatNumber(resumenStats.total_volumen_m3, 2)} m³` : "0 m³"}</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 flex-shrink-0">
                <Fuel className="w-4.5 h-4.5" />
              </div>
            </div>

            {/* KPI 5: Flete Total Consolidado */}
            <div className="bg-white dark:bg-slate-900 border border-amber-500/30 rounded-xl p-3.5 shadow-sm flex items-center justify-between col-span-2 sm:col-span-1 bg-amber-50/10">
              <div>
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Flete Facturable</span>
                <div className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                  {resumenStats ? `Bs ${formatNumber(resumenStats.total_fletes_bs, 2)}` : "Bs 0.00"}
                </div>
                <span className="text-[10px] text-amber-700 dark:text-amber-400/80 font-semibold">Total a liquidar</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 flex-shrink-0">
                <DollarSign className="w-4.5 h-4.5" />
              </div>
            </div>

          </div>
        </section>

        {/* ============================================================== */}
        {/* PESTAÑA 1: EMPRESAS AFILIADAS */}
        {/* ============================================================== */}
        {activeTab === "empresas" && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-500">
                    <Truck className="w-4.5 h-4.5" />
                  </div>
                  <span>Empresas de Transporte Afiliadas</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Selecciona una empresa para ingresar a su espacio de trabajo, o afilia nuevas empresas al consorcio.
                </p>
              </div>

              <Link
                href={`/seleccionar-empresa?asoc_id=${asociacion.id}`}
                className="inline-flex items-center gap-2 px-4.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition transform active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Afiliar Nueva Empresa</span>
              </Link>
            </div>

            {asociacion.empresas?.length === 0 ? (
              <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center max-w-lg mx-auto shadow-sm dark:shadow-2xl">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
                  <Truck className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Sin empresas afiliadas</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                  Esta asociación aún no cuenta con empresas de transporte asociadas en su padrón. Comienza afiliando la primera empresa.
                </p>
                <Link
                  href={`/seleccionar-empresa?asoc_id=${asociacion.id}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-xl text-xs font-bold transition shadow-lg shadow-amber-500/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>Afiliar Empresa Ahora</span>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {asociacion.empresas.map((emp: any) => (
                  <div
                    key={emp.id}
                    className="bg-white dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 shadow-sm hover:shadow-md dark:shadow-xl dark:hover:shadow-2xl dark:hover:shadow-black/50 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-500 flex items-center justify-center font-bold text-lg group-hover:scale-105 transition-transform">
                          <Truck className="w-6 h-6" />
                        </div>
                        <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {emp.schema_name}
                        </span>
                      </div>

                      <h3 className="text-lg font-black text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition break-words leading-snug">
                        {emp.name}
                      </h3>

                      <div className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
                        {emp.nit && (
                          <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/80 pb-1.5">
                            <span className="text-slate-400 dark:text-slate-500">NIT:</span>
                            <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{emp.nit}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-1">
                          <span className="text-slate-400 dark:text-slate-500">Estado Operativo:</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5 text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Habilitado
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
                      <Link
                        href={`/${emp.schema_name}/dashboard`}
                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition shadow-md shadow-amber-500/20 group-hover:shadow-amber-500/30"
                      >
                        <span>Entrar a la Empresa</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ============================================================== */}
        {/* PESTAÑA 2: LIQUIDACIÓN GENERAL CONSOLIDADA (HOJA 1 DEL PDF) */}
        {/* ============================================================== */}
        {activeTab === "liquidacion" && (
          <section className="space-y-6">
            
            {/* Filtro Unificado de Fechas y Períodos (Mensual, Semestral, Anual, Personalizado, Histórico) */}
            <div className="no-print">
              <DatePeriodFilter
                initialMode={filterMode}
                currentPeriodoMes={periodoMes.startsWith("ANUAL-") ? undefined : periodoMes}
                onChange={handleDateFilterChange}
              />
            </div>

            {/* Barra superior de controles y exportación */}
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm dark:shadow-xl flex flex-col lg:flex-row items-center justify-between gap-4 no-print">
              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Período Activo:</span>
                  <span className="text-slate-900 dark:text-white font-bold">
                    {activeFilterLabel || liqData?.periodo_mes || periodoMes || "Todo"}
                  </span>
                </div>

                <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-medium">
                  <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <span>Consolidación oficial de viajes de todas las empresas afiliadas para este periodo.</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end">
                <button
                  onClick={downloadExcel}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-900/20 flex items-center gap-1.5 transition active:scale-95"
                  title="Exportar archivo Excel oficial"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Exportar Excel</span>
                </button>

                <button
                  onClick={downloadPDF}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-900/20 flex items-center gap-1.5 transition active:scale-95"
                  title="Descargar versión PDF oficial"
                >
                  <Download className="w-4 h-4" />
                  <span>Exportar PDF</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition active:scale-95"
                  title="Imprimir formato oficial de conciliación"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir</span>
                </button>
              </div>
            </div>

            {/* Documento Estilo Página 1 del PDF - Vista Dark Screen & Light Print */}
            <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl shadow-xl dark:shadow-2xl p-6 sm:p-8 overflow-x-auto border border-slate-200 dark:border-slate-800 print:bg-white print:text-slate-900 print:border-none print:shadow-none print:p-0">
              
              {/* Encabezado Institucional Página 1 */}
              <div className="border-b-2 border-slate-200 dark:border-slate-700 pb-5 mb-6 print:border-slate-900">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-white/95 p-2 flex items-center justify-center shadow-md border border-slate-200 dark:border-transparent flex-shrink-0">
                      <img src="/rengifo_logo_icon.svg" alt="Rengifo" className="w-full h-full object-contain" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 print:text-slate-600 font-bold">
                        Gerencia de Comercialización &bull; Dirección de Importaciones y Operaciones
                      </div>
                      <h1 className="text-base sm:text-xl font-black tracking-tight text-slate-900 dark:text-white print:text-slate-900 uppercase mt-0.5">
                        {asociacion.name}
                      </h1>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-600 dark:text-slate-300 print:text-slate-700">
                      Periodo de Descarga: <span className="text-amber-600 dark:text-amber-400 print:text-blue-700 uppercase font-black">{liqData?.periodo_mes || activeFilterLabel || periodoMes || "GENERAL"}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 print:text-slate-500">
                      Unidad de Pagos, Conciliaciones y Aduanas - UPCA
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-center">
                  <h2 className="text-sm font-black uppercase text-amber-600 dark:text-amber-400 print:text-slate-800 tracking-wide">
                    LIQUIDACIÓN OFICIAL
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 print:text-slate-600 font-semibold italic">
                    (A LA FINALIZACIÓN DE LA PRESTACIÓN DEL SERVICIO DEL PERIODO {(liqData?.periodo_mes || activeFilterLabel || periodoMes || "GENERAL").toUpperCase()} Y DESPUÉS DE REALIZADA LA CONCILIACIÓN)
                  </p>
                </div>
              </div>

              {/* Tabla de Conciliación Consolidada */}
              {loadingLiq ? (
                <div className="flex flex-col justify-center items-center py-20 gap-3 text-slate-400">
                  <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Calculando liquidación consolidada...</span>
                </div>
              ) : !liqData || liqData.grupos_empresa?.length === 0 ? (
                <div className="text-center py-16 text-slate-500 dark:text-slate-400 text-sm">
                  No hay viajes registrados para las empresas afiliadas en el periodo <b className="text-slate-900 dark:text-white">{periodoMes}</b>.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-200 print:bg-slate-800 print:text-white text-[10px] uppercase font-bold text-center border border-slate-200 dark:border-slate-800 print:border-slate-900">
                        <th className="py-2.5 px-1.5 border border-slate-200 dark:border-slate-800 print:border-slate-900">LOTE</th>
                        <th className="py-2.5 px-2 border border-slate-200 dark:border-slate-800 print:border-slate-900 text-left">Empresa Transporte</th>
                        <th className="py-2.5 px-2 border border-slate-200 dark:border-slate-800 print:border-slate-900 text-left">Tramo</th>
                        <th className="py-2.5 px-1 border border-slate-200 dark:border-slate-800 print:border-slate-900">Producto</th>
                        <th className="py-2.5 px-1.5 border border-slate-200 dark:border-slate-800 print:border-slate-900">Placa</th>
                        <th className="py-2.5 px-1 border border-slate-200 dark:border-slate-800 print:border-slate-900">Fecha Carga</th>
                        <th className="py-2.5 px-1 border border-slate-200 dark:border-slate-800 print:border-slate-900">Fecha Recep.</th>
                        <th className="py-2.5 px-1.5 border border-slate-200 dark:border-slate-800 print:border-slate-900">Vol. Despachado (L)</th>
                        <th className="py-2.5 px-1.5 border border-slate-200 dark:border-slate-800 print:border-slate-900">Vol. Recepcionado (L)</th>
                        <th className="py-2.5 px-1 border border-slate-200 dark:border-slate-800 print:border-slate-900">Merma Real (L)</th>
                        <th className="py-2.5 px-1 border border-slate-200 dark:border-slate-800 print:border-slate-900">Merma Exced. (L)</th>
                        <th className="py-2.5 px-1 border border-slate-200 dark:border-slate-800 print:border-slate-900">Precio Merma (Bs/L)</th>
                        <th className="py-2.5 px-1.5 border border-slate-200 dark:border-slate-800 print:border-slate-900">Merma Descontar (Bs)</th>
                        <th className="py-2.5 px-1.5 border border-slate-200 dark:border-slate-800 print:border-slate-900">Vol. Facturar (m³)</th>
                        <th className="py-2.5 px-1.5 border border-slate-200 dark:border-slate-800 print:border-slate-900">Flete ($us/m³)</th>
                        <th className="py-2.5 px-2 border border-slate-200 dark:border-slate-800 print:border-slate-900">Importe Facturar (Bs)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liqData.grupos_empresa.map((grp: any) => {
                        // Agrupar viajes de la empresa por producto (DO e IYA)
                        const prodMap: Record<string, any[]> = {};
                        grp.viajes.forEach((v: any) => {
                          const pCode = (v.producto || "DO").toUpperCase();
                          if (!prodMap[pCode]) prodMap[pCode] = [];
                          prodMap[pCode].push(v);
                        });

                        return (
                          <Fragment key={grp.empresa_id}>
                            {/* Fila Encabezado de Empresa */}
                            <tr className="bg-amber-500/10 dark:bg-amber-500/15 print:bg-sky-50 font-bold text-amber-900 dark:text-amber-300 print:text-sky-950 border-t border-b border-amber-500/20">
                              <td colSpan={16} className="py-2 px-3 border border-slate-200 dark:border-slate-800 print:border-slate-300 font-black text-xs uppercase tracking-wide">
                                EMPRESA: {grp.empresa_name}
                              </td>
                            </tr>

                            {Object.entries(prodMap).map(([prodKey, pViajes]) => {
                              const subProdDesp = pViajes.reduce((acc, v) => acc + (v.volumen_origen_litros || 0), 0);
                              const subProdRec = pViajes.reduce((acc, v) => acc + (v.volumen_recepcionado_litros || 0), 0);
                              const subProdMconf = pViajes.reduce((acc, v) => acc + (v.merma_real_litros || 0), 0);
                              const subProdMdesc = pViajes.reduce((acc, v) => acc + (v.merma_descontar_bs || 0), 0);
                              const subProdM3 = pViajes.reduce((acc, v) => acc + (v.volumen_facturar_m3 || (v.volumen_recepcionado_litros / 1000.0) || 0), 0);
                              const subProdImp = pViajes.reduce((acc, v) => acc + (v.flete_total_bs || 0), 0);

                              return (
                                <Fragment key={`${grp.empresa_id}-${prodKey}`}>
                                  {/* Filas de Viajes */}
                                  {pViajes.map((v: any, vIdx: number) => (
                                    <tr
                                      key={`viaje-${v.id}`}
                                      className={`hover:bg-amber-50/40 dark:hover:bg-slate-800/50 print:hover:bg-slate-50 border border-slate-200 dark:border-slate-800 print:border-slate-300 ${
                                        vIdx % 2 === 0 ? "bg-white dark:bg-slate-900/50 print:bg-white" : "bg-slate-50/70 dark:bg-slate-950/40 print:bg-slate-50/50"
                                      }`}
                                    >
                                      <td className="py-1.5 px-1.5 text-center border border-slate-200 dark:border-slate-800 print:border-slate-300 font-mono text-slate-600 dark:text-slate-300 print:text-slate-800">{v.lote_codigo}</td>
                                      <td className="py-1.5 px-2 border border-slate-200 dark:border-slate-800 print:border-slate-300 text-slate-800 dark:text-slate-200 print:text-slate-700 truncate max-w-[160px]">{grp.empresa_name}</td>
                                      <td className="py-1.5 px-2 border border-slate-200 dark:border-slate-800 print:border-slate-300 text-slate-600 dark:text-slate-300 print:text-slate-700">{v.tramo}</td>
                                      <td className="py-1.5 px-1 text-center font-bold border border-slate-200 dark:border-slate-800 print:border-slate-300 text-amber-700 dark:text-amber-400 print:text-blue-900">{v.producto}</td>
                                      <td className="py-1.5 px-1.5 text-center font-mono font-bold border border-slate-200 dark:border-slate-800 print:border-slate-300 text-slate-900 dark:text-white print:text-slate-900">{v.placa}</td>
                                      <td className="py-1.5 px-1 text-center border border-slate-200 dark:border-slate-800 print:border-slate-300 text-slate-500 dark:text-slate-400 print:text-slate-600">{formatDate(v.fecha_carga)}</td>
                                      <td className="py-1.5 px-1 text-center border border-slate-200 dark:border-slate-800 print:border-slate-300 text-slate-500 dark:text-slate-400 print:text-slate-600">{formatDate(v.fecha_descarga)}</td>
                                      <td className="py-1.5 px-1.5 text-right font-mono border border-slate-200 dark:border-slate-800 print:border-slate-300 text-slate-700 dark:text-slate-200 print:text-slate-800">{formatNumber(v.volumen_origen_litros, 0)}</td>
                                      <td className="py-1.5 px-1.5 text-right font-mono font-bold border border-slate-200 dark:border-slate-800 print:border-slate-300 text-emerald-600 dark:text-emerald-400 print:text-slate-900">{formatNumber(v.volumen_recepcionado_litros, 0)}</td>
                                      <td className={`py-1.5 px-1 text-right font-mono border border-slate-200 dark:border-slate-800 print:border-slate-300 ${v.merma_real_litros > 0 ? "text-amber-700 dark:text-amber-400 print:text-amber-700" : "text-emerald-700 dark:text-emerald-400 print:text-emerald-700"}`}>
                                        {formatNumber(v.merma_real_litros, 1)}
                                      </td>
                                      <td className={`py-1.5 px-1 text-right font-mono border border-slate-200 dark:border-slate-800 print:border-slate-300 ${v.merma_excedente_litros > 0 ? "text-rose-600 dark:text-rose-400 print:text-red-700 font-bold" : "text-slate-400 dark:text-slate-500 print:text-slate-400"}`}>
                                        {formatNumber(v.merma_excedente_litros, 1)}
                                      </td>
                                      <td className="py-1.5 px-1 text-right font-mono border border-slate-200 dark:border-slate-800 print:border-slate-300 text-slate-600 dark:text-slate-300 print:text-slate-700">{formatNumber(v.precio_merma_litro_bs, 2)}</td>
                                      <td className={`py-1.5 px-1.5 text-right font-mono border border-slate-200 dark:border-slate-800 print:border-slate-300 ${v.merma_descontar_bs > 0 ? "text-rose-600 dark:text-rose-400 print:text-red-600 font-bold" : "text-slate-500 dark:text-slate-400"}`}>
                                        {formatNumber(v.merma_descontar_bs, 2)}
                                      </td>
                                      <td className="py-1.5 px-1.5 text-right font-mono border border-slate-200 dark:border-slate-800 print:border-slate-300 text-slate-700 dark:text-slate-300 print:text-slate-800">{formatNumber(v.volumen_facturar_m3, 3)}</td>
                                      <td className="py-1.5 px-1.5 text-right font-mono border border-slate-200 dark:border-slate-800 print:border-slate-300 text-slate-700 dark:text-slate-300 print:text-slate-800">{formatNumber(v.tarifa_flete, 2)}</td>
                                      <td className="py-1.5 px-2 text-right font-mono font-bold border border-slate-200 dark:border-slate-800 print:border-slate-300 text-amber-700 dark:text-amber-400 print:text-slate-900">
                                        {formatNumber(v.flete_total_bs, 2)}
                                      </td>
                                    </tr>
                                  ))}

                                  {/* Subtotal por Producto (ej. Total DO) */}
                                  <tr className="bg-slate-50 dark:bg-slate-950 font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                                    <td colSpan={3} className="py-1.5 px-2 border border-slate-200 dark:border-slate-800 print:border-slate-300 text-right"></td>
                                    <td className="py-1.5 px-1 text-center font-black text-amber-600 dark:text-amber-400 border border-slate-200 dark:border-slate-800 print:border-slate-300">Total {prodKey}</td>
                                    <td colSpan={3} className="border border-slate-200 dark:border-slate-800 print:border-slate-300"></td>
                                    <td className="py-1.5 px-1.5 text-right font-mono border border-slate-200 dark:border-slate-800 print:border-slate-300">{formatNumber(subProdDesp, 0)}</td>
                                    <td className="py-1.5 px-1.5 text-right font-mono border border-slate-200 dark:border-slate-800 print:border-slate-300">{formatNumber(subProdRec, 0)}</td>
                                    <td className="py-1.5 px-1 text-right font-mono border border-slate-200 dark:border-slate-800 print:border-slate-300">{formatNumber(subProdMconf, 1)}</td>
                                    <td colSpan={2} className="border border-slate-200 dark:border-slate-800 print:border-slate-300"></td>
                                    <td className="py-1.5 px-1.5 text-right font-mono text-rose-600 dark:text-rose-400 border border-slate-200 dark:border-slate-800 print:border-slate-300">{formatNumber(subProdMdesc, 2)}</td>
                                    <td className="py-1.5 px-1.5 text-right font-mono border border-slate-200 dark:border-slate-800 print:border-slate-300">{formatNumber(subProdM3, 3)}</td>
                                    <td className="border border-slate-200 dark:border-slate-800 print:border-slate-300"></td>
                                    <td className="py-1.5 px-2 text-right font-mono font-bold text-amber-600 dark:text-amber-400 border border-slate-200 dark:border-slate-800 print:border-slate-300">{formatNumber(subProdImp, 2)}</td>
                                  </tr>
                                </Fragment>
                              );
                            })}

                            {/* Subtotal de Empresa */}
                            <tr className="bg-slate-100 dark:bg-slate-800/90 print:bg-slate-100 font-bold text-slate-900 dark:text-white print:text-slate-900 border-t-2 border-b-2 border-slate-300 dark:border-slate-700 print:border-slate-400">
                              <td colSpan={7} className="py-2 px-3 border border-slate-200 dark:border-slate-800 print:border-slate-300 text-left font-black">
                                Total {grp.empresa_name}
                              </td>
                              <td className="py-2 px-1.5 text-right font-mono border border-slate-200 dark:border-slate-800 print:border-slate-300">{formatNumber(grp.subtotal_despachado, 0)}</td>
                              <td className="py-2 px-1.5 text-right font-mono border border-slate-200 dark:border-slate-800 print:border-slate-300">{formatNumber(grp.subtotal_recepcionado, 0)}</td>
                              <td className="py-2 px-1 text-right font-mono border border-slate-200 dark:border-slate-800 print:border-slate-300">{formatNumber(grp.subtotal_merma_real, 1)}</td>
                              <td className="py-2 px-1 text-center border border-slate-200 dark:border-slate-800 print:border-slate-300 text-slate-400 dark:text-slate-500 print:text-slate-400">-</td>
                              <td className="py-2 px-1 text-center border border-slate-200 dark:border-slate-800 print:border-slate-300 text-slate-400 dark:text-slate-500 print:text-slate-400">-</td>
                              <td className="py-2 px-1.5 text-right font-mono text-rose-600 dark:text-rose-400 print:text-red-700 border border-slate-200 dark:border-slate-800 print:border-slate-300">{formatNumber(grp.subtotal_merma_descontar_bs, 2)}</td>
                              <td className="py-2 px-1.5 text-right font-mono border border-slate-200 dark:border-slate-800 print:border-slate-300">{formatNumber(grp.subtotal_volumen_m3, 3)}</td>
                              <td className="py-2 px-1.5 text-center border border-slate-200 dark:border-slate-800 print:border-slate-300 text-slate-400 dark:text-slate-500 print:text-slate-400">-</td>
                              <td className="py-2 px-2 text-right font-mono text-amber-700 dark:text-amber-400 print:text-blue-900 border border-slate-200 dark:border-slate-800 print:border-slate-300 font-black">
                                {formatNumber(grp.subtotal_importe_bs, 2)}
                              </td>
                            </tr>
                          </Fragment>
                        );
                      })}

                      {/* Total General de la Asociación (Idéntico a Pág 1) */}
                      {liqData.totales_generales && (
                        <tr className="bg-amber-100 dark:bg-amber-500/25 print:bg-amber-50 font-black text-amber-950 dark:text-amber-300 print:text-slate-950 border-t-4 border-double border-amber-500 print:border-slate-800 text-xs">
                          <td colSpan={7} className="py-3 px-3 border border-slate-300 dark:border-slate-700 print:border-slate-400 text-right uppercase tracking-wider text-slate-900 dark:text-white print:text-slate-950">
                            TOTAL GENERAL ASOCIACIÓN:
                          </td>
                          <td className="py-3 px-1.5 text-right font-mono border border-slate-300 dark:border-slate-700 print:border-slate-400 text-slate-900 dark:text-white print:text-slate-950">
                            {formatNumber(liqData.totales_generales.volumen_despachado_litros, 0)}
                          </td>
                          <td className="py-3 px-1.5 text-right font-mono border border-slate-300 dark:border-slate-700 print:border-slate-400 text-slate-900 dark:text-white print:text-slate-950">
                            {formatNumber(liqData.totales_generales.volumen_recepcionado_litros, 0)}
                          </td>
                          <td className="py-3 px-1 text-right font-mono border border-slate-300 dark:border-slate-700 print:border-slate-400 text-slate-900 dark:text-white print:text-slate-950">
                            {formatNumber(liqData.totales_generales.merma_real_litros, 1)}
                          </td>
                          <td className="py-3 px-1 text-center border border-slate-300 dark:border-slate-700 print:border-slate-400 text-slate-400 dark:text-slate-500">-</td>
                          <td className="py-3 px-1 text-center border border-slate-300 dark:border-slate-700 print:border-slate-400 text-slate-400 dark:text-slate-500">-</td>
                          <td className="py-3 px-1.5 text-right font-mono text-rose-700 dark:text-rose-400 print:text-red-800 border border-slate-300 dark:border-slate-700 print:border-slate-400 font-bold">
                            {formatNumber(liqData.totales_generales.merma_descontar_facturar_bs, 2)}
                          </td>
                          <td className="py-3 px-1.5 text-right font-mono border border-slate-300 dark:border-slate-700 print:border-slate-400 text-slate-900 dark:text-white print:text-slate-950">
                            {formatNumber(liqData.totales_generales.volumen_facturar_m3, 3)}
                          </td>
                          <td className="py-3 px-1 text-center border border-slate-300 dark:border-slate-700 print:border-slate-400 text-slate-400 dark:text-slate-500">-</td>
                          <td className="py-3 px-2 text-right font-mono text-amber-900 dark:text-amber-400 print:text-blue-950 border border-slate-300 dark:border-slate-700 print:border-slate-400 text-sm font-black">
                            {formatNumber(liqData.totales_generales.importe_facturar_bs, 2)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Glosario de Abreviaciones de Producto y Cláusula Legal */}
              <div className="mt-5 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-950/70 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Abreviaturas de Producto:</span>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-mono font-bold">
                      <strong>DO</strong> = Diesel
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20 font-mono font-bold">
                      <strong>IYA</strong> = Insumos y Aditivos
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 italic">
                    * Combustibles unificados bajo código oficial DO
                  </span>
                </div>

                <div className="pt-2 text-[10px] text-slate-500 dark:text-slate-400 print:text-slate-600 leading-relaxed italic border-t border-slate-200 dark:border-slate-800">
                  <b>Nota Legal:</b> Conforme lo establece la Ley 843 en su Art. 4 y de acuerdo a la cláusula contractual de Facturación y Pago, el momento en que finalizará la ejecución o la prestación del Servicio se origina después de realizada la Conciliación (Acta de Conformidad por la Comisión de Recepción) y emitida la planilla de Liquidación.
                </div>
              </div>

              {/* Firmas Oficiales de Auditoría y Directorio */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6">
                <div className="border border-slate-200 dark:border-slate-800 print:border-slate-300 rounded-2xl p-4 text-center bg-slate-50 dark:bg-slate-950/60 print:bg-slate-50/50">
                  <div className="h-12 border-b border-dashed border-slate-300 dark:border-slate-700 print:border-slate-400 mb-2"></div>
                  <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200 print:text-slate-800 uppercase">DIRECTORIO ASOCIACIÓN</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">Firma y Sello</div>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 print:border-slate-300 rounded-2xl p-4 text-center bg-slate-50 dark:bg-slate-950/60 print:bg-slate-50/50">
                  <div className="h-12 border-b border-dashed border-slate-300 dark:border-slate-700 print:border-slate-400 mb-2"></div>
                  <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200 print:text-slate-800 uppercase">COMISIÓN DE CONCILIACIÓN</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">Firma y Sello</div>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 print:border-slate-300 rounded-2xl p-4 text-center bg-slate-50 dark:bg-slate-950/60 print:bg-slate-50/50">
                  <div className="h-12 border-b border-dashed border-slate-300 dark:border-slate-700 print:border-slate-400 mb-2"></div>
                  <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200 print:text-slate-800 uppercase">REPRESENTANTES LEGALES</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">Firma y Sello</div>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 print:border-slate-300 rounded-2xl p-4 text-center bg-slate-50 dark:bg-slate-950/60 print:bg-slate-50/50">
                  <div className="h-12 border-b border-dashed border-slate-300 dark:border-slate-700 print:border-slate-400 mb-2"></div>
                  <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200 print:text-slate-800 uppercase">AUDITORÍA / CONTABILIDAD</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">Firma y Sello</div>
                </div>
              </div>

            </div>
          </section>
        )}

      </main>
    </div>
  );
}
