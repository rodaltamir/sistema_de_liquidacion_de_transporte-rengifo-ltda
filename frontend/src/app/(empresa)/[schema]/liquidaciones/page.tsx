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
  TrendingDown,
  ArrowLeft,
  Eye,
  BarChart3
} from "lucide-react";
import Swal from "sweetalert2";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatNumber, formatDate } from "@/lib/format";
import DatePeriodFilter, { DateFilterChangeEvent, FilterMode } from "@/components/DatePeriodFilter";
import ModalPortal from "@/components/ModalPortal";

export default function LiquidacionesPage() {
  const routeParams = useParams();
  const schema = (routeParams?.schema as string) || "";

  const [unidades, setUnidades] = useState<any[]>([]);
  const [unidadesApoyo, setUnidadesApoyo] = useState<any[]>([]);
  const [placasViajes, setPlacasViajes] = useState<string[]>([]);
  const [manualPlaca, setManualPlaca] = useState(false);
  const [selectedPlaca, setSelectedPlaca] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [periodosDisponibles, setPeriodosDisponibles] = useState<any[]>([]);

  // Filtros unificados de fecha y rango
  const [filterMode, setFilterMode] = useState<FilterMode>("mes");
  const [activeFilterLabel, setActiveFilterLabel] = useState("");
  const [dateFilterQuery, setDateFilterQuery] = useState("");
  const [rangeLiquidaciones, setRangeLiquidaciones] = useState<any[]>([]);

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
    if (schema) {
      loadLiquidacionesData();
    }
  }, [schema, filterMode, dateFilterQuery, selectedPlaca, periodo]);

  const loadInitialData = async () => {
    try {
      const [uData, uApoyoData, vData, lData, pData] = await Promise.all([
        apiFetch(`/tenants/${schema}/unidades/`).catch(() => []),
        apiFetch(`/tenants/${schema}/apoyo/unidades/todas`).catch(() => []),
        apiFetch(`/tenants/${schema}/viajes/`).catch(() => []),
        apiFetch(`/tenants/${schema}/liquidaciones/`).catch(() => []),
        apiFetch(`/tenants/${schema}/viajes/periodos`).catch(() => [])
      ]);

      const validUnidades = Array.isArray(uData) ? uData : [];
      const validApoyo = Array.isArray(uApoyoData) ? uApoyoData : [];
      const validViajes = Array.isArray(vData) ? vData : [];
      const validLiqs = Array.isArray(lData) ? lData : [];
      const validPeriodos = Array.isArray(pData) ? pData : [];

      setUnidades(validUnidades);
      setUnidadesApoyo(validApoyo);
      setLiquidaciones(validLiqs);
      setPeriodosDisponibles(validPeriodos);

      // Extraer todas las placas presentes en viajes
      const distinctTripPlacas: string[] = Array.from(
        new Set(validViajes.map((v: any) => v.placa).filter(Boolean))
      );
      setPlacasViajes(distinctTripPlacas);

      // Periodo preferido inicial
      let initPeriodo = "";
      if (validLiqs.length > 0 && validLiqs[0].periodo_mes) {
        initPeriodo = validLiqs[0].periodo_mes;
      } else if (validPeriodos.length > 0 && validPeriodos[0].periodo_mes) {
        initPeriodo = validPeriodos[0].periodo_mes;
      } else if (validViajes.length > 0 && validViajes[0].periodo_mes) {
        initPeriodo = validViajes[0].periodo_mes;
      } else {
        initPeriodo = new Date().toISOString().slice(0, 7);
      }
      setPeriodo(initPeriodo);
      setDateFilterQuery(`periodo_mes=${initPeriodo}`);

      // Placa preferida inicial
      let initPlaca = "";
      if (validLiqs.length > 0 && validLiqs[0].placa) {
        initPlaca = validLiqs[0].placa;
      } else if (validUnidades.length > 0 && validUnidades[0].placa) {
        initPlaca = validUnidades[0].placa;
      } else if (validApoyo.length > 0 && validApoyo[0].placa) {
        initPlaca = validApoyo[0].placa;
      } else if (distinctTripPlacas.length > 0) {
        initPlaca = distinctTripPlacas[0];
      }
      if (initPlaca) {
        setSelectedPlaca(initPlaca);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDateFilterChange = (filter: DateFilterChangeEvent) => {
    setFilterMode(filter.mode);
    setActiveFilterLabel(filter.label);

    if (filter.mode === "mes" && filter.periodo_mes) {
      setPeriodo(filter.periodo_mes);
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
        setPeriodo(`${filter.anio}-S${filter.semestre}`);
      }
    } else if (filter.mode === "anual" && filter.anio) {
      setDateFilterQuery(`anio=${filter.anio}`);
      setPeriodo(`ANUAL-${filter.anio}`);
    } else if (filter.mode === "personalizado" && filter.fecha_desde && filter.fecha_hasta) {
      setDateFilterQuery(`fecha_desde=${filter.fecha_desde}&fecha_hasta=${filter.fecha_hasta}`);
      setPeriodo(`${filter.fecha_desde}_${filter.fecha_hasta}`);
    } else if (filter.mode === "historico") {
      setDateFilterQuery("");
      setPeriodo("");
    }
  };

  const loadLiquidacionesData = async () => {
    setLoading(true);
    try {
      const params: string[] = [];
      if (dateFilterQuery) {
        params.push(dateFilterQuery);
      } else if (filterMode === "mes" && periodo) {
        params.push(`periodo_mes=${periodo}`);
      }
      if (selectedPlaca && selectedPlaca !== "__TODAS__") {
        params.push(`placa=${selectedPlaca}`);
      }
      const q = params.length > 0 ? `?${params.join("&")}` : "";

      const list = await apiFetch(`/tenants/${schema}/liquidaciones/${q}`).catch(() => []);
      const validList = Array.isArray(list) ? list : [];
      setRangeLiquidaciones(validList);

      // Si no es vista "TODAS", obtener la planilla oficial consolidada de la cisterna para el periodo
      if (selectedPlaca !== "__TODAS__") {
        const targetPlaca = selectedPlaca || 
          (validList.length > 0 ? validList[0].placa : 
          (unidades.length > 0 ? unidades[0].placa : 
          (unidadesApoyo.length > 0 ? unidadesApoyo[0].placa : (placasViajes[0] || ""))));

        if (targetPlaca) {
          try {
            const consolidadaUrl = `/tenants/${schema}/liquidaciones/consolidada?placa=${targetPlaca}&tipo_periodo=${filterMode}${dateFilterQuery ? `&${dateFilterQuery}` : (periodo ? `&periodo_mes=${periodo}` : "")}`;
            const detalle = await apiFetch(consolidadaUrl);
            if (detalle && detalle.placa) {
              setActiveLiq(detalle);
              if (!selectedPlaca) setSelectedPlaca(detalle.placa);
            } else {
              setActiveLiq(null);
            }
          } catch (e) {
            setActiveLiq(null);
          }
        } else {
          setActiveLiq(null);
        }
      } else {
        setActiveLiq(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewPlanilla = async (liqId: number) => {
    setLoading(true);
    try {
      const detalle = await apiFetch(`/tenants/${schema}/liquidaciones/${liqId}`);
      setActiveLiq(detalle);
      if (detalle?.placa) setSelectedPlaca(detalle.placa);
      if (detalle?.periodo_mes) setPeriodo(detalle.periodo_mes);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al cargar planilla",
        text: err.message || "No se pudo obtener el detalle de la liquidación.",
        background: "#0f172a",
        color: "#f8fafc"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    let targetPlaca = selectedPlaca;

    if (!targetPlaca || targetPlaca === "__TODAS__") {
      Swal.fire({
        icon: "warning",
        title: "Selecciona una cisterna",
        text: "Por favor selecciona una placa para generar o actualizar su liquidación oficial.",
        background: "#0f172a",
        color: "#f8fafc",
        confirmButtonColor: "#f59e0b"
      });
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        placa: targetPlaca,
        tipo_periodo: filterMode,
        periodo_mes: activeLiq?.periodo_mes || periodo || "ANUAL"
      };

      if (filterMode === "anual") {
        const urlParams = new URLSearchParams(dateFilterQuery);
        const yr = urlParams.get("anio") || activeFilterLabel?.replace(/\D/g, "") || new Date().getFullYear();
        payload.anio = Number(yr);
        payload.periodo_mes = `ANUAL-${yr}`;
      } else if (filterMode === "semestral") {
        const urlParams = new URLSearchParams(dateFilterQuery);
        payload.fecha_desde = urlParams.get("fecha_desde");
        payload.fecha_hasta = urlParams.get("fecha_hasta");
        if (urlParams.get("anio")) payload.anio = Number(urlParams.get("anio"));
        if (urlParams.get("semestre")) payload.semestre = Number(urlParams.get("semestre"));
        payload.periodo_mes = `${payload.anio || new Date().getFullYear()}-S${payload.semestre || 1}`;
      } else if (filterMode === "personalizado") {
        const urlParams = new URLSearchParams(dateFilterQuery);
        payload.fecha_desde = urlParams.get("fecha_desde");
        payload.fecha_hasta = urlParams.get("fecha_hasta");
        payload.periodo_mes = `${payload.fecha_desde}_${payload.fecha_hasta}`;
      }

      const res = await apiFetch(`/tenants/${schema}/liquidaciones/`, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      Swal.fire({
        icon: "success",
        title: "¡Liquidación Generada!",
        text: `Planilla para ${targetPlaca} (${res.codigo}) procesada con éxito.`,
        timer: 1600,
        showConfirmButton: false,
        background: "#0f172a",
        color: "#f8fafc"
      });

      const detalle = await apiFetch(`/tenants/${schema}/liquidaciones/${res.id}`);
      setActiveLiq(detalle);
      loadLiquidacionesData();
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
    const sanitizedAdjust = {
      desc_merma_bs: Number(adjustData.desc_merma_bs) || 0,
      desc_comision_usd_m3_bs: Number(adjustData.desc_comision_usd_m3_bs) || 0,
      desc_comision_7pct_bs: Number(adjustData.desc_comision_7pct_bs) || 0,
      desc_comision_ypfb_bolgart_7pct_bs: Number(adjustData.desc_comision_ypfb_bolgart_7pct_bs) || 0,
      desc_comision_3pct_bs: Number(adjustData.desc_comision_3pct_bs) || 0,
      desc_hojas_ruta_bs: Number(adjustData.desc_hojas_ruta_bs) || 0,
      desc_gps_bs: Number(adjustData.desc_gps_bs) || 0,
      desc_anticipos_otros_bs: Number(adjustData.desc_anticipos_otros_bs) || 0,
      desc_otros_ajustes_bs: Number(adjustData.desc_otros_ajustes_bs) || 0
    };

    try {
      const res = await apiFetch(`/tenants/${schema}/liquidaciones/`, {
        method: "POST",
        body: JSON.stringify({
          periodo_mes: activeLiq.periodo_mes,
          placa: activeLiq.placa,
          ...sanitizedAdjust
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

  // KPIs consolidados para el rango seleccionado
  const totalFleteConsolidado = rangeLiquidaciones.reduce((acc, l) => acc + (l.flete_total_bruto_bs || l.flete_total_bs || 0), 0);
  const totalLiquidoConsolidado = rangeLiquidaciones.reduce((acc, l) => acc + (l.liquido_pagable_bs || 0), 0);
  const totalDeduccionesConsolidado = rangeLiquidaciones.reduce((acc, l) => acc + (l.total_descuentos_bs ?? Math.max(0, (l.flete_total_bruto_bs || 0) - (l.liquido_pagable_bs || 0))), 0);

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
          {/* Indicador de Período Activo Unificado (Sin pedir fecha dos veces) */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <Calendar className="w-4 h-4 text-amber-500" />
            <span className="text-slate-500 dark:text-slate-400 font-medium">Período:</span>
            <span className="text-slate-900 dark:text-white font-bold">
              {activeFilterLabel || periodo}
            </span>
          </div>

          {/* Placa */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <Truck className="w-4 h-4 text-amber-500" />
            <span className="text-slate-500 dark:text-slate-400 font-medium">Placa:</span>
            {!manualPlaca && (unidades.length > 0 || unidadesApoyo.length > 0 || placasViajes.length > 0) ? (
              <select
                value={selectedPlaca}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "__MANUAL__") {
                    setManualPlaca(true);
                    return;
                  }
                  setSelectedPlaca(val);
                }}
                className="bg-transparent text-slate-900 dark:text-white font-bold focus:outline-none cursor-pointer text-xs"
              >
                {filterMode !== "mes" ? (
                  <option value="__TODAS__" className="bg-white dark:bg-slate-900">Todas las Placas</option>
                ) : (
                  <option value="" className="bg-white dark:bg-slate-900">-- Seleccionar Placa --</option>
                )}
                {unidades.length > 0 && (
                  <optgroup label="Flota Propia" className="bg-white dark:bg-slate-900">
                    {unidades.map((u) => (
                      <option key={`propia-${u.id || u.placa}`} value={u.placa} className="bg-white dark:bg-slate-900">
                        {u.placa} (Propia)
                      </option>
                    ))}
                  </optgroup>
                )}
                {unidadesApoyo.length > 0 && (
                  <optgroup label="Flota de Apoyo" className="bg-white dark:bg-slate-900">
                    {unidadesApoyo.map((u) => (
                      <option key={`apoyo-${u.id || u.placa}`} value={u.placa} className="bg-white dark:bg-slate-900">
                        {u.placa} (Apoyo)
                      </option>
                    ))}
                  </optgroup>
                )}
                {placasViajes.filter(p => !unidades.some(u => u.placa === p) && !unidadesApoyo.some(u => u.placa === p)).length > 0 && (
                  <optgroup label="Otras Placas" className="bg-white dark:bg-slate-900">
                    {placasViajes
                      .filter(p => !unidades.some(u => u.placa === p) && !unidadesApoyo.some(u => u.placa === p))
                      .map((p) => (
                        <option key={`viaje-${p}`} value={p} className="bg-white dark:bg-slate-900">
                          {p}
                        </option>
                      ))}
                  </optgroup>
                )}
                <option value="__MANUAL__" className="bg-white dark:bg-slate-900">✏️ Escribir otra placa...</option>
              </select>
            ) : (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={selectedPlaca}
                  onChange={(e) => setSelectedPlaca(e.target.value.toUpperCase())}
                  placeholder="ej. 4412-DPC"
                  className="bg-white dark:bg-slate-900 px-2 py-0.5 rounded text-xs font-mono font-bold uppercase border border-amber-500 focus:outline-none text-slate-900 dark:text-white"
                  autoFocus
                />
                {(unidades.length > 0 || unidadesApoyo.length > 0 || placasViajes.length > 0) && (
                  <button
                    type="button"
                    onClick={() => setManualPlaca(false)}
                    className="text-[10px] text-amber-600 dark:text-amber-400 font-bold hover:underline"
                  >
                    Lista
                  </button>
                )}
              </div>
            )}
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
          <div className="flex flex-wrap items-center gap-3">
            {filterMode !== "mes" && (
              <button
                type="button"
                onClick={() => setActiveLiq(null)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-700 dark:text-slate-200 text-xs font-bold transition border border-slate-200 dark:border-slate-700 shadow-sm"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver al Consolidado</span>
              </button>
            )}

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
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            Código: <span className="text-amber-600 dark:text-amber-400 font-bold">{activeLiq.codigo}</span>
          </div>
        </div>
      )}

      {/* Selector rápido de otras cisternas en el período */}
      {activeLiq && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs no-print">
          <span className="text-slate-500 dark:text-slate-400 font-medium">
            Planilla activa ({activeFilterLabel || periodo}):
          </span>
          <span className="font-mono font-black text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/25">
            {activeLiq.placa}
          </span>
          {placasViajes.filter(p => p !== activeLiq.placa).length > 0 && (
            <>
              <span className="text-slate-400 mx-1">|</span>
              <span className="text-slate-500 dark:text-slate-400">Ver otra cisterna:</span>
              {placasViajes.filter(p => p !== activeLiq.placa).slice(0, 8).map(otherPlaca => (
                <button
                  key={otherPlaca}
                  type="button"
                  onClick={() => setSelectedPlaca(otherPlaca)}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:border-amber-500 border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-700 dark:text-slate-200 text-xs transition hover:scale-105 active:scale-95 shadow-sm"
                >
                  {otherPlaca}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Contenedor del Documento */}
      {loading ? (
        <div className="flex flex-col justify-center items-center py-28 gap-3">
          <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
          <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Procesando liquidación...</span>
        </div>
      ) : (selectedPlaca === "__TODAS__" || (!selectedPlaca && filterMode !== "mes")) && !activeLiq ? (
        /* ============================================================== */
        /* VISTA CONSOLIDADA DEL PERÍODO (ANUAL, SEMESTRAL, RANGO, TODO) */
        /* ============================================================== */
        <div className="space-y-6">
          {/* Tarjeta Banner de Rango */}
          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm dark:shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Consolidado de Liquidaciones: {activeFilterLabel || "Período Seleccionado"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Muestra todas las planillas generadas en el rango, acumulando fletes, mermas y líquido pagable.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                {rangeLiquidaciones.length} {rangeLiquidaciones.length === 1 ? "planilla generada" : "planillas generadas"}
              </span>
            </div>
          </div>

          {/* KPIs del Rango */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Flete Bruto Acumulado
              </span>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                {formatCurrency(totalFleteConsolidado)}
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Base de facturación</span>
            </div>

            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Deducciones Totales
              </span>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
                {formatCurrency(totalDeduccionesConsolidado)}
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Mermas y comisiones</span>
            </div>

            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Líquido Pagable Final
              </span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {formatCurrency(totalLiquidoConsolidado)}
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Neto a percibir</span>
            </div>

            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Planillas Emitidas
              </span>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {rangeLiquidaciones.length}
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Cisternas conciliadas</span>
            </div>
          </div>

          {/* Tabla Consolidada de Liquidaciones */}
          {rangeLiquidaciones.length === 0 ? (
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mx-auto mb-3">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                No se encontraron liquidaciones para este período
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-5">
                No hay planillas de liquidación registradas en {activeFilterLabel || "este rango"}. Puedes seleccionar el modo Mensual en el filtro superior para generar una planilla o revisar otros periodos.
              </p>
              <button
                type="button"
                onClick={() => {
                  setFilterMode("mes");
                  setDateFilterQuery(`periodo_mes=${periodo}`);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-md"
              >
                <span>Cambiar a Vista Mensual ({periodo})</span>
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-500" />
                  <span>Detalle de Planillas Oficiales en el Período</span>
                </h4>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Haz clic en &ldquo;Ver Planilla&rdquo; para inspeccionar las Hojas 2 y 3 completas
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Código</th>
                      <th className="py-3 px-4">Mes</th>
                      <th className="py-3 px-4">Placa</th>
                      <th className="py-3 px-4 text-right">Flete Total</th>
                      <th className="py-3 px-4 text-right">Deducciones</th>
                      <th className="py-3 px-4 text-right">Líquido Pagable</th>
                      <th className="py-3 px-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {rangeLiquidaciones.map((liq) => {
                      const fleteBruto = liq.flete_total_bruto_bs || liq.flete_total_bs || 0;
                      const totalDed = liq.total_descuentos_bs ?? Math.max(0, fleteBruto - (liq.liquido_pagable_bs || 0));
                      return (
                        <tr key={liq.id} className="hover:bg-amber-500/5 transition">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                            {liq.codigo}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-600 dark:text-slate-300">
                            {liq.periodo_mes}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono font-black px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700">
                              {liq.placa}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                            {formatCurrency(fleteBruto)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                            {formatCurrency(totalDed)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                            {formatCurrency(liq.liquido_pagable_bs)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleViewPlanilla(liq.id)}
                              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-sm inline-flex items-center gap-1 transition active:scale-95"
                              title="Ver planilla oficial de 17 columnas"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Ver Planilla</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : !activeLiq ? (
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 sm:p-14 text-center max-w-2xl mx-auto shadow-sm dark:shadow-2xl">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-5 shadow-xl shadow-amber-500/10">
            <FileSpreadsheet className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Planilla Oficial por Cisterna
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto mb-6 leading-relaxed">
            {selectedPlaca 
              ? `No se encontraron despachos registrados para la cisterna ${selectedPlaca} en el período ${activeFilterLabel || periodo}. Selecciona otra cisterna con viajes o ajusta el rango de fechas en los controles superiores.`
              : `Selecciona una placa de la flota y el período en los controles superiores para emitir las Hojas 2 y 3 oficiales conforme al formato de auditoría.`
            }
          </p>
          {selectedPlaca && (
            <button
              onClick={handleGenerate}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs sm:text-sm font-black rounded-xl shadow-xl shadow-amber-500/25 transition transform hover:scale-105 active:scale-95 mb-8"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Consolidar Liquidación ({activeFilterLabel || periodo})</span>
            </button>
          )}

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
                    PERIODO: <span className="font-black text-amber-600 dark:text-amber-400 print:text-blue-800 uppercase">{activeLiq.periodo_mes}</span>
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
                      <th className="py-2 px-1.5 border-x border-slate-200 dark:border-slate-800 print:border-slate-300 text-right">Volumen en Lt. Origen</th>
                      <th className="py-2 px-1.5 border-x border-slate-200 dark:border-slate-800 print:border-slate-300 text-right">Volumen Recepcionado</th>
                      <th className="py-2 px-1 border-x border-slate-200 dark:border-slate-800 print:border-slate-300 text-right">Merma T/Tr</th>
                      <th className="py-2 px-1 border-x border-slate-200 dark:border-slate-800 print:border-slate-300 text-right">Total Merma (Lt)</th>
                      <th className="py-2 px-1 border-x border-slate-200 dark:border-slate-800 print:border-slate-300 text-center">MERMA Tolerable (0.15% / 0.25%)</th>
                      <th className="py-2 px-1.5 border-x border-slate-200 dark:border-slate-800 print:border-slate-300 text-right">Merma a Descontar Y.P.F.B. Bs.</th>
                      <th className="py-2 px-1.5 border-x border-slate-200 dark:border-slate-800 print:border-slate-300 text-right">TARIFA Bs.</th>
                      <th className="py-2 px-2 border-x border-slate-200 dark:border-slate-800 print:border-slate-300 text-right">Total a pagar en Bs.</th>
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
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md overflow-hidden animate-in fade-in">
            <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                    <SlidersHorizontal className="w-4 h-4" />
                  </div>
                  <span>Ajustar Montos de Deducción</span>
                </h3>
                <button
                  onClick={() => setShowAdjustModal(false)}
                  className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded-lg transition"
                >
                  ✕
                </button>
              </div>

              <form id="adjust-form" onSubmit={handleSaveAdjustments} className="p-6 space-y-3.5 flex-1 overflow-y-auto text-xs">
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Descuento Merma (Bs)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={adjustData.desc_merma_bs}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAdjustData({ ...adjustData, desc_merma_bs: v === "" ? "" : v });
                      }}
                      onBlur={(e) => {
                        if (e.target.value === "" || isNaN(Number(e.target.value))) {
                          setAdjustData((prev) => ({ ...prev, desc_merma_bs: 0 }));
                        }
                      }}
                      placeholder="0.00"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Comisión 1 $us p/m3 (Bs)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={adjustData.desc_comision_usd_m3_bs}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAdjustData({ ...adjustData, desc_comision_usd_m3_bs: v === "" ? "" : v });
                      }}
                      onBlur={(e) => {
                        if (e.target.value === "" || isNaN(Number(e.target.value))) {
                          setAdjustData((prev) => ({ ...prev, desc_comision_usd_m3_bs: 0 }));
                        }
                      }}
                      placeholder="0.00"
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
                      onChange={(e) => {
                        const v = e.target.value;
                        setAdjustData({ ...adjustData, desc_comision_7pct_bs: v === "" ? "" : v });
                      }}
                      onBlur={(e) => {
                        if (e.target.value === "" || isNaN(Number(e.target.value))) {
                          setAdjustData((prev) => ({ ...prev, desc_comision_7pct_bs: 0 }));
                        }
                      }}
                      placeholder="0.00"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">YPFB BOL-GART 7% (Bs)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={adjustData.desc_comision_ypfb_bolgart_7pct_bs}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAdjustData({ ...adjustData, desc_comision_ypfb_bolgart_7pct_bs: v === "" ? "" : v });
                      }}
                      onBlur={(e) => {
                        if (e.target.value === "" || isNaN(Number(e.target.value))) {
                          setAdjustData((prev) => ({ ...prev, desc_comision_ypfb_bolgart_7pct_bs: 0 }));
                        }
                      }}
                      placeholder="0.00"
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
                      onChange={(e) => {
                        const v = e.target.value;
                        setAdjustData({ ...adjustData, desc_comision_3pct_bs: v === "" ? "" : v });
                      }}
                      onBlur={(e) => {
                        if (e.target.value === "" || isNaN(Number(e.target.value))) {
                          setAdjustData((prev) => ({ ...prev, desc_comision_3pct_bs: 0 }));
                        }
                      }}
                      placeholder="0.00"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Hojas de Ruta (Bs)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={adjustData.desc_hojas_ruta_bs}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAdjustData({ ...adjustData, desc_hojas_ruta_bs: v === "" ? "" : v });
                      }}
                      onBlur={(e) => {
                        if (e.target.value === "" || isNaN(Number(e.target.value))) {
                          setAdjustData((prev) => ({ ...prev, desc_hojas_ruta_bs: 0 }));
                        }
                      }}
                      placeholder="0.00"
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
                      onChange={(e) => {
                        const v = e.target.value;
                        setAdjustData({ ...adjustData, desc_gps_bs: v === "" ? "" : v });
                      }}
                      onBlur={(e) => {
                        if (e.target.value === "" || isNaN(Number(e.target.value))) {
                          setAdjustData((prev) => ({ ...prev, desc_gps_bs: 0 }));
                        }
                      }}
                      placeholder="0.00"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Anticipos y Otros (Bs)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={adjustData.desc_anticipos_otros_bs}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAdjustData({ ...adjustData, desc_anticipos_otros_bs: v === "" ? "" : v });
                      }}
                      onBlur={(e) => {
                        if (e.target.value === "" || isNaN(Number(e.target.value))) {
                          setAdjustData((prev) => ({ ...prev, desc_anticipos_otros_bs: 0 }));
                        }
                      }}
                      placeholder="0.00"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </form>

              <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex justify-end gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-bold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="adjust-form"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 transition active:scale-95"
                >
                  Guardar y Recalcular
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

    </div>
  );
}
