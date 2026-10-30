"use client";

import { Suspense, useState, useEffect, useMemo, Fragment } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { 
  History, 
  Receipt, 
  FileSpreadsheet, 
  Download, 
  Eye, 
  Trash2, 
  Search, 
  RefreshCw, 
  Clock, 
  Pin, 
  Edit3, 
  Layers, 
  Truck, 
  Calendar, 
  DollarSign, 
  TrendingDown, 
  ShieldCheck, 
  CheckCircle2, 
  X, 
  ArrowRight, 
  Plus,
  FileText,
  SlidersHorizontal,
  Hash,
  ChevronLeft,
  ChevronRight,
  Filter,
  Calculator
} from "lucide-react";
import Swal from "sweetalert2";
import { apiFetch } from "@/lib/api";
import { downloadBlob } from "@/lib/download";
import { formatCurrency, formatNumber, formatDate, formatDateTime } from "@/lib/format";
import { getSavedState, saveState } from "@/lib/storage";
import DatePeriodFilter, { DateFilterChangeEvent, FilterMode } from "@/components/DatePeriodFilter";
import ModalPortal from "@/components/ModalPortal";
import { useTheme } from "@/context/ThemeContext";

const getVolFactLitros = (v: any) => {
  const raw = Number(v?.volumen_facturado);
  if (raw && raw > 0) {
    return raw < 1000 ? raw * 1000 : raw;
  }
  return Number(v?.volumen_recepcionado_litros) || 0;
};

export default function HistorialPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col justify-center items-center py-32 gap-3">
        <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
        <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold tracking-wider uppercase">
          Cargando Historial de Liquidaciones...
        </span>
      </div>
    }>
      <HistorialContent />
    </Suspense>
  );
}

function HistorialContent() {
  const routeParams = useParams();
  const searchParams = useSearchParams();
  const schema = (routeParams?.schema as string) || "";
  const router = useRouter();
  const { resolvedTheme } = useTheme();

  const swalBg = resolvedTheme === "dark" ? "#0f172a" : "#ffffff";
  const swalColor = resolvedTheme === "dark" ? "#f8fafc" : "#0f172a";
  const swalCancelColor = resolvedTheme === "dark" ? "#334155" : "#94a3b8";

  // Estados principales
  const [liquidaciones, setLiquidaciones] = useState<any[]>([]);
  const [unidades, setUnidades] = useState<any[]>([]);
  const [unidadesApoyo, setUnidadesApoyo] = useState<any[]>([]);
  const [facturasDisponibles, setFacturasDisponibles] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  // Filtros Centralizados
  const [searchInput, setSearchInput] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  
  // 1. Filtro de Cisterna / Placa
  const [placaFiltro, setPlacaFiltro] = useState<string>("TODAS");

  // 2. Método de Filtrado: "periodo" (fechas) vs "factura"
  const [metodoFiltro, setMetodoFiltro] = useState<"periodo" | "factura">("periodo");

  // 2.a Filtro por Fechas / Período
  const [periodoFiltro, setPeriodoFiltro] = useState<string>("TODOS");
  const [periodosDisponibles, setPeriodosDisponibles] = useState<string[]>([]);
  const [dateFilterEvent, setDateFilterEvent] = useState<DateFilterChangeEvent | null>(null);

  // 2.b Filtro por Factura(s)
  const [modoFactura, setModoFactura] = useState<"unica" | "rango">("unica");
  const [facturaInput, setFacturaInput] = useState<string>("");
  const [facturaDesdeInput, setFacturaDesdeInput] = useState<string>("");
  const [facturaHastaInput, setFacturaHastaInput] = useState<string>("");

  // 3. Filtro por Estado
  const [estadoFiltro, setEstadoFiltro] = useState<string>("TODOS");

  // Modal de Previsualización Oficial
  const [selectedLiq, setSelectedLiq] = useState<any>(null);
  const [selectedLiqDetalle, setSelectedLiqDetalle] = useState<any>(null);
  const [loadingDetalle, setLoadingDetalle] = useState<boolean>(false);
  const [activeModalTab, setActiveModalTab] = useState<"ambas" | "hoja1" | "hoja2">("ambas");
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // Búsqueda debounced (150ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Carga inicial y restauración de memoria inteligente
  useEffect(() => {
    if (!schema) return;
    loadHistorial();
  }, [schema]);

  const loadHistorial = async () => {
    setLoading(true);
    try {
      const [data, uData, uApoyoData, fData] = await Promise.all([
        apiFetch(`/tenants/${schema}/liquidaciones/`).catch(() => []),
        apiFetch(`/tenants/${schema}/unidades/`).catch(() => []),
        apiFetch(`/tenants/${schema}/apoyo/unidades/todas`).catch(() => []),
        apiFetch(`/tenants/${schema}/liquidaciones/facturas-disponibles`).catch(() => [])
      ]);
      const valid = Array.isArray(data) ? data : [];
      setLiquidaciones(valid);
      setUnidades(Array.isArray(uData) ? uData : []);
      setUnidadesApoyo(Array.isArray(uApoyoData) ? uApoyoData : []);
      setFacturasDisponibles(Array.isArray(fData) ? fData : []);

      // Extraer períodos disponibles
      const distinctPeriodos: string[] = Array.from(
        new Set(valid.map((l: any) => l.periodo_mes).filter(Boolean))
      );
      setPeriodosDisponibles(distinctPeriodos);

      // Restaurar filtros de memoria si existen
      const saved = getSavedState<any>(`transporte_${schema}_historial_memoria`, null);
      if (saved) {
        if (saved.searchInput !== undefined) {
          setSearchInput(saved.searchInput);
          setSearch(saved.searchInput);
        }
        if (saved.placaFiltro !== undefined) setPlacaFiltro(saved.placaFiltro);
        if (saved.metodoFiltro !== undefined) setMetodoFiltro(saved.metodoFiltro);
        if (saved.periodoFiltro !== undefined) setPeriodoFiltro(saved.periodoFiltro);
        if (saved.modoFactura !== undefined) setModoFactura(saved.modoFactura);
        if (saved.facturaInput !== undefined) setFacturaInput(saved.facturaInput);
        if (saved.facturaDesdeInput !== undefined) setFacturaDesdeInput(saved.facturaDesdeInput);
        if (saved.facturaHastaInput !== undefined) setFacturaHastaInput(saved.facturaHastaInput);
        if (saved.estadoFiltro !== undefined) setEstadoFiltro(saved.estadoFiltro);
      }

      // Priorizar parámetros URL si viene redirigido desde Liquidaciones u otro módulo
      const urlPlaca = searchParams.get("placa");
      const urlPeriodo = searchParams.get("periodo");
      const urlFactura = searchParams.get("factura");
      if (urlPlaca) {
        setPlacaFiltro(urlPlaca);
      }
      if (urlPeriodo) {
        setPeriodoFiltro(urlPeriodo);
        setMetodoFiltro("periodo");
      }
      if (urlFactura) {
        setMetodoFiltro("factura");
        setModoFactura("unica");
        setFacturaInput(urlFactura);
      }

      setIsHydrated(true);
    } catch (err) {
      console.error("Error al cargar historial de liquidaciones", err);
      setLiquidaciones([]);
    } finally {
      setLoading(false);
    }
  };

  // Persistir filtros en memoria inteligente
  useEffect(() => {
    if (!isHydrated || !schema) return;
    saveState(`transporte_${schema}_historial_memoria`, {
      searchInput,
      placaFiltro,
      metodoFiltro,
      periodoFiltro,
      modoFactura,
      facturaInput,
      facturaDesdeInput,
      facturaHastaInput,
      estadoFiltro
    });
  }, [
    isHydrated, 
    schema, 
    searchInput, 
    placaFiltro, 
    metodoFiltro, 
    periodoFiltro, 
    modoFactura, 
    facturaInput, 
    facturaDesdeInput, 
    facturaHastaInput, 
    estadoFiltro
  ]);

  // Catálogo agrupado de cisternas / placas disponibles
  const placasCatalog = useMemo(() => {
    const propias = unidades.map((u: any) => u.placa).filter(Boolean);
    const apoyo = unidadesApoyo.map((u: any) => u.placa).filter(Boolean);
    const liqsPlacas = liquidaciones
      .map((l: any) => l.placa)
      .filter((p: string) => p && p !== "TODAS" && !propias.includes(p) && !apoyo.includes(p));
    return {
      propias,
      apoyo,
      otras: Array.from(new Set(liqsPlacas))
    };
  }, [unidades, unidadesApoyo, liquidaciones]);

  // Selección de factura mediante chip interactivo
  const handleSelectFacturaChip = (facNum: string) => {
    if (modoFactura === "unica") {
      setFacturaInput(facNum);
    } else {
      if (!facturaDesdeInput || (facturaDesdeInput && facturaHastaInput)) {
        setFacturaDesdeInput(facNum);
        setFacturaHastaInput("");
      } else {
        const dNum = parseInt(facturaDesdeInput.replace(/\D/g, ""), 10);
        const hNum = parseInt(facNum.replace(/\D/g, ""), 10);
        if (!isNaN(dNum) && !isNaN(hNum)) {
          if (hNum < dNum) {
            setFacturaDesdeInput(facNum);
            setFacturaHastaInput(facturaDesdeInput);
          } else {
            setFacturaHastaInput(facNum);
          }
        } else {
          setFacturaHastaInput(facNum);
        }
      }
    }
  };

  // Lista de liquidaciones filtrada
  const filteredLiquidaciones = useMemo(() => {
    return liquidaciones.filter((item) => {
      // 1. Filtro de búsqueda general de texto
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchCodigo = (item.codigo || "").toLowerCase().includes(q);
        const matchPlaca = (item.placa || "").toLowerCase().includes(q);
        const matchPeriodo = (item.periodo_mes || "").toLowerCase().includes(q);
        const matchNotas = (item.notas || "").toLowerCase().includes(q);
        if (!matchCodigo && !matchPlaca && !matchPeriodo && !matchNotas) return false;
      }

      // 2. Filtro de Placa / Cisterna
      if (placaFiltro !== "TODAS") {
        const pClean = (item.placa || "").toUpperCase().trim();
        if (pClean !== placaFiltro.toUpperCase().trim()) return false;
      }

      // 3. Filtro de Estado
      if (estadoFiltro !== "TODOS") {
        if (estadoFiltro === "Editada") {
          const isEditada = (item.estado || "").toLowerCase().includes("editada") || Boolean(item.updated_at);
          if (!isEditada) return false;
        } else if (estadoFiltro === "Generada") {
          if (item.estado !== "Generada" || item.updated_at) return false;
        } else if (estadoFiltro === "Consolidado") {
          if (item.estado !== "Consolidado General" && item.placa !== "TODAS") return false;
        }
      }

      // 4. Filtro por Método (Período vs Factura)
      if (metodoFiltro === "factura") {
        if (modoFactura === "unica" && facturaInput.trim()) {
          const target = facturaInput.trim().toLowerCase();
          const matchCod = (item.codigo || "").toLowerCase().includes(target);
          const matchPer = (item.periodo_mes || "").toLowerCase().includes(target);
          const matchNot = (item.notas || "").toLowerCase().includes(target);
          if (!matchCod && !matchPer && !matchNot) return false;
        } else if (modoFactura === "rango") {
          const dDigits = facturaDesdeInput.replace(/\D/g, "");
          const hDigits = facturaHastaInput.replace(/\D/g, "");
          if (dDigits && hDigits) {
            const minNum = Math.min(parseInt(dDigits, 10), parseInt(hDigits, 10));
            const maxNum = Math.max(parseInt(dDigits, 10), parseInt(hDigits, 10));
            const allNumbers = (item.codigo + " " + item.periodo_mes + " " + (item.notas || "")).match(/\d+/g) || [];
            const hasMatch = allNumbers.some((nStr) => {
              const n = parseInt(nStr, 10);
              return n >= minNum && n <= maxNum;
            });
            if (!hasMatch) return false;
          } else if (facturaDesdeInput.trim()) {
            const d = facturaDesdeInput.trim().toLowerCase();
            if (!(item.codigo || "").toLowerCase().includes(d) && !(item.periodo_mes || "").toLowerCase().includes(d)) return false;
          }
        }
      } else {
        // Modo Fechas / Período
        if (dateFilterEvent) {
          if (dateFilterEvent.mode === "mes" && dateFilterEvent.periodo_mes) {
            if (item.periodo_mes !== dateFilterEvent.periodo_mes) return false;
          } else if (dateFilterEvent.mode === "anual" && dateFilterEvent.anio) {
            const yStr = String(dateFilterEvent.anio);
            if (!item.periodo_mes.includes(yStr) && !String(item.fecha_emision).startsWith(yStr)) return false;
          } else if (dateFilterEvent.mode === "semestral" && dateFilterEvent.fecha_desde && dateFilterEvent.fecha_hasta) {
            const dStr = dateFilterEvent.fecha_desde.slice(0, 7);
            const hStr = dateFilterEvent.fecha_hasta.slice(0, 7);
            if (item.periodo_mes < dStr || item.periodo_mes > hStr) return false;
          } else if (dateFilterEvent.mode === "personalizado" && dateFilterEvent.fecha_desde && dateFilterEvent.fecha_hasta) {
            const dStr = dateFilterEvent.fecha_desde;
            const hStr = dateFilterEvent.fecha_hasta;
            const emision = item.fecha_emision ? String(item.fecha_emision) : item.periodo_mes;
            if (emision < dStr || emision > hStr) return false;
          }
        } else if (periodoFiltro !== "TODOS") {
          if (item.periodo_mes !== periodoFiltro) return false;
        }
      }

      return true;
    });
  }, [
    liquidaciones, 
    search, 
    placaFiltro, 
    estadoFiltro, 
    metodoFiltro, 
    modoFactura, 
    facturaInput, 
    facturaDesdeInput, 
    facturaHastaInput, 
    dateFilterEvent, 
    periodoFiltro
  ]);

  // Métricas agregadas de resumen
  const kpis = useMemo(() => {
    const totalCount = filteredLiquidaciones.length;
    const fleteTotal = filteredLiquidaciones.reduce((acc, l) => acc + (Number(l.flete_total_bruto_bs) || 0), 0);
    const mermasTotal = filteredLiquidaciones.reduce((acc, l) => acc + (Number(l.descuento_merma_bs ?? l.total_mermas_bs) || 0), 0);
    const deduccionesTotal = filteredLiquidaciones.reduce((acc, l) => acc + (Number(l.total_descuentos_bs) || 0), 0);
    const liquidoTotal = filteredLiquidaciones.reduce((acc, l) => acc + (Number(l.liquido_pagable_bs) || 0), 0);
    const fleteMenosMermas = Math.max(0, fleteTotal - mermasTotal);
    const editadasCount = filteredLiquidaciones.filter((l) => (l.estado || "").toLowerCase().includes("editada")).length;
    const generadasCount = filteredLiquidaciones.filter((l) => l.estado === "Generada").length;

    return {
      totalCount,
      fleteTotal,
      mermasTotal,
      fleteMenosMermas,
      deduccionesTotal,
      liquidoTotal,
      editadasCount,
      generadasCount
    };
  }, [filteredLiquidaciones]);

  // Abrir previsualización oficial
  const handleOpenPreview = async (liq: any) => {
    setSelectedLiq(liq);
    setSelectedLiqDetalle(null);
    setLoadingDetalle(true);
    try {
      const detalle = await apiFetch(`/tenants/${schema}/liquidaciones/${liq.id}`);
      setSelectedLiqDetalle(detalle);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al cargar planilla",
        text: err.message || "No se pudo obtener el detalle de la liquidación.",
        background: swalBg,
        color: swalColor,
        confirmButtonColor: "#f59e0b"
      });
    } finally {
      setLoadingDetalle(false);
    }
  };

  // Descarga directa Excel
  const handleDownloadExcel = async (liq: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDownloadingId(liq.id);
    try {
      const blob = await apiFetch(`/tenants/${schema}/liquidaciones/${liq.id}/export/excel`);
      const safePlaca = liq.placa === "TODAS" ? "FLOTA_CONSOLIDADA" : liq.placa;
      const filename = `Liquidacion_${safePlaca}_${liq.periodo_mes}.xlsx`;
      downloadBlob(blob, filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al exportar Excel",
        text: err.message || "No se pudo descargar el archivo Excel.",
        background: swalBg,
        color: swalColor,
        confirmButtonColor: "#f59e0b"
      });
    } finally {
      setDownloadingId(null);
    }
  };

  // Descarga directa PDF
  const handleDownloadPDF = async (liq: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDownloadingId(liq.id);
    try {
      const blob = await apiFetch(`/tenants/${schema}/liquidaciones/${liq.id}/export/pdf`);
      const safePlaca = liq.placa === "TODAS" ? "FLOTA_CONSOLIDADA" : liq.placa;
      const filename = `Liquidacion_${safePlaca}_${liq.periodo_mes}.pdf`;
      downloadBlob(blob, filename, "application/pdf");
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al exportar PDF",
        text: err.message || "No se pudo descargar el archivo PDF.",
        background: swalBg,
        color: swalColor,
        confirmButtonColor: "#f59e0b"
      });
    } finally {
      setDownloadingId(null);
    }
  };

  // Anular liquidación y liberar viajes
  const handleAnular = async (liq: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const result = await Swal.fire({
      title: `¿Anular liquidación ${liq.codigo}?`,
      html: `
        <div style="text-align: left; font-size: 0.875rem; line-height: 1.5;">
          <p>Estás a punto de anular el registro de liquidación para la cisterna <strong>${liq.placa}</strong> en el período <strong>${liq.periodo_mes}</strong>.</p>
          <p style="margin-top: 8px; font-size: 0.75rem; color: #f59e0b;">
            ⚠️ Todos los despachos vinculados quedarán liberados en estado <strong>'Pendiente'</strong> para volver a liquidarse cuando lo requieras.
          </p>
        </div>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#e11d48",
      cancelButtonColor: swalCancelColor,
      confirmButtonText: "Sí, anular y liberar viajes",
      cancelButtonText: "Cancelar",
      background: swalBg,
      color: swalColor
    });

    if (result.isConfirmed) {
      try {
        await apiFetch(`/tenants/${schema}/liquidaciones/${liq.id}`, { method: "DELETE" });
        Swal.fire({
          icon: "success",
          title: "Liquidación Anulada",
          text: "El registro fue eliminado y sus viajes volvieron a estado Pendiente.",
          background: swalBg,
          color: swalColor,
          timer: 1600,
          showConfirmButton: false
        });
        if (selectedLiq?.id === liq.id) {
          setSelectedLiq(null);
          setSelectedLiqDetalle(null);
        }
        loadHistorial();
      } catch (err: any) {
        Swal.fire({
          icon: "error",
          title: "Error al anular",
          text: err.message || "No se pudo anular la liquidación.",
          background: swalBg,
          color: swalColor,
          confirmButtonColor: "#f59e0b"
        });
      }
    }
  };

  const previewFirmas = selectedLiqDetalle?.firmas || {
    realizado_por: "JAQUELINE LOVERA TIÑINI",
    revisado_por: "JOSE LOVERA TIÑINI / GERENTE GENERAL",
    autorizado_por: "DIRECTORIO",
    cancelado_por: "TOMASA TIÑINI MITA / APOYO"
  };

  const previewEmpresaNombre = selectedLiqDetalle?.empresa?.name || "EMPRESA DE TRANSPORTE";

  return (
    <div className="space-y-4 font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* Encabezado Principal del Historial */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
            <History className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Historial de Liquidaciones Emitidas
              </h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                {kpis.totalCount} {kpis.totalCount === 1 ? "registro" : "registros"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Control cronológico de planillas liquidadas, re-liquidadas y editadas con acceso directo a previsualización, Excel y PDF.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => router.push(`/${schema}/liquidaciones`)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-sm transition active:scale-95"
            title="Ir a generar o calcular nuevas liquidaciones"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Nueva Liquidación</span>
          </button>

          <button
            onClick={loadHistorial}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition"
            title="Actualizar historial"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-amber-500" : ""}`} />
          </button>
        </div>
      </div>

      {/* Tarjetas KPI de Resumen Acumulado */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Liquidaciones Registradas
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-white">
              {kpis.totalCount}
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              {kpis.generadasCount} oficiales • {kpis.editadasCount} con edición
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Flete Total Facturado
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-white font-mono truncate">
              {formatCurrency(kpis.fleteTotal)}
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              Importe bruto acumulado
            </div>
          </div>
        </div>

        {/* Flete - Mermas (Dato Nuevo Historial) */}
        <div className="bg-white dark:bg-slate-900 border border-blue-500/30 rounded-2xl p-4 shadow-sm flex items-center gap-3 bg-blue-50/10">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Calculator className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              Flete - Mermas
            </div>
            <div className="text-lg font-black text-blue-600 dark:text-blue-400 font-mono truncate">
              {formatCurrency(kpis.fleteMenosMermas)}
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              {kpis.mermasTotal > 0 ? `Mermas: -${formatCurrency(kpis.mermasTotal)}` : "Sin descuento merma"}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Deducciones Aplicadas
            </div>
            <div className="text-lg font-black text-rose-600 dark:text-rose-400 font-mono truncate">
              {formatCurrency(kpis.deduccionesTotal)}
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              Mermas, comisiones y fijos
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Líquido Pagable Neto
            </div>
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono truncate">
              {formatCurrency(kpis.liquidoTotal)}
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              Monto transferible a transportistas
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros Centralizada (Placas, Fechas, Facturas, Estados y Buscador) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3.5">
        
        {/* Fila 1: Pestañas de Método de Filtrado + Selectores Principales */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Selector de Método: Período vs Factura */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setMetodoFiltro("periodo")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition text-xs cursor-pointer ${
                  metodoFiltro === "periodo"
                    ? "bg-amber-500 text-slate-950 font-black shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Por Fechas / Período</span>
              </button>
              <button
                type="button"
                onClick={() => setMetodoFiltro("factura")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition text-xs cursor-pointer ${
                  metodoFiltro === "factura"
                    ? "bg-amber-500 text-slate-950 font-black shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Por Factura(s)</span>
              </button>
            </div>

            {/* Selector de Cisterna / Placa */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1 text-xs">
              <Truck className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-slate-500 dark:text-slate-400 font-medium">Placa:</span>
              <select
                value={placaFiltro}
                onChange={(e) => setPlacaFiltro(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="TODAS" className="bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 font-bold">
                  📋 Todas las Cisternas / Flota
                </option>
                {placasCatalog.propias.length > 0 && (
                  <optgroup label="Flota Propia" className="bg-white dark:bg-slate-900">
                    {placasCatalog.propias.map((p) => (
                      <option key={`p-${p}`} value={p} className="bg-white dark:bg-slate-900">
                        {p} (Propia)
                      </option>
                    ))}
                  </optgroup>
                )}
                {placasCatalog.apoyo.length > 0 && (
                  <optgroup label="Flota de Apoyo" className="bg-white dark:bg-slate-900">
                    {placasCatalog.apoyo.map((p) => (
                      <option key={`a-${p}`} value={p} className="bg-white dark:bg-slate-900">
                        {p} (Apoyo)
                      </option>
                    ))}
                  </optgroup>
                )}
                {placasCatalog.otras.length > 0 && (
                  <optgroup label="Otras Cisternas con Liquidación" className="bg-white dark:bg-slate-900">
                    {placasCatalog.otras.map((p) => (
                      <option key={`o-${p}`} value={p} className="bg-white dark:bg-slate-900">
                        {p}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Selector de Estado */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1 text-xs">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={estadoFiltro}
                onChange={(e) => setEstadoFiltro(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="TODOS">Todos los Estados</option>
                <option value="Generada">🟢 Oficiales Generadas</option>
                <option value="Editada">🟡 Editadas / Con Ajustes</option>
                <option value="Consolidado">🔵 Consolidados Flota</option>
              </select>
            </div>
          </div>

          {/* Buscador Rápido (Código, Placa, Factura o Notas) */}
          <div className="relative w-full lg:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar LIQ-..., placa, factura..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
            />
            {searchInput && (
              <button
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Fila 2: Sub-Barra Contextual (Fechas vs Facturas) */}
        {metodoFiltro === "periodo" ? (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <DatePeriodFilter
              currentPeriodoMes={periodoFiltro === "TODOS" ? undefined : periodoFiltro}
              periodosDisponibles={periodosDisponibles}
              onChange={(filterEv) => {
                setDateFilterEvent(filterEv);
                if (filterEv.periodo_mes) setPeriodoFiltro(filterEv.periodo_mes);
              }}
              compact={true}
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setDateFilterEvent(null);
                  setPeriodoFiltro("TODOS");
                }}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  periodoFiltro === "TODOS" && !dateFilterEvent
                    ? "bg-amber-500 text-slate-950 border-amber-600 shadow-sm"
                    : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Todos los Períodos
              </button>

              {(searchInput || placaFiltro !== "TODAS" || estadoFiltro !== "TODOS" || periodoFiltro !== "TODOS" || dateFilterEvent) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    setSearch("");
                    setPlacaFiltro("TODAS");
                    setEstadoFiltro("TODOS");
                    setPeriodoFiltro("TODOS");
                    setDateFilterEvent(null);
                  }}
                  className="text-xs px-2.5 py-1 text-rose-500 hover:text-rose-600 font-bold transition hover:underline cursor-pointer"
                >
                  Limpiar Filtros
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Selector Única vs Rango */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setModoFactura("unica")}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      modoFactura === "unica"
                        ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Factura Única
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoFactura("rango")}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      modoFactura === "rango"
                        ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Rango de Facturas
                  </button>
                </div>

                {modoFactura === "unica" ? (
                  <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1 text-xs">
                    <Receipt className="w-3.5 h-3.5 text-amber-500" />
                    <span className="font-semibold text-slate-500 dark:text-slate-400">N° Factura:</span>
                    <input
                      type="text"
                      placeholder="ej. 1045"
                      value={facturaInput}
                      onChange={(e) => setFacturaInput(e.target.value)}
                      className="bg-transparent font-mono font-bold text-slate-900 dark:text-white w-24 focus:outline-none"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1 text-xs">
                      <span className="font-semibold text-slate-500 dark:text-slate-400">Desde:</span>
                      <input
                        type="text"
                        placeholder="ej. 1040"
                        value={facturaDesdeInput}
                        onChange={(e) => setFacturaDesdeInput(e.target.value)}
                        className="bg-transparent font-mono font-bold text-slate-900 dark:text-white w-20 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1 text-xs">
                      <span className="font-semibold text-slate-500 dark:text-slate-400">Hasta:</span>
                      <input
                        type="text"
                        placeholder="ej. 1055"
                        value={facturaHastaInput}
                        onChange={(e) => setFacturaHastaInput(e.target.value)}
                        className="bg-transparent font-mono font-bold text-slate-900 dark:text-white w-20 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {(facturaInput || facturaDesdeInput || facturaHastaInput) && (
                <button
                  type="button"
                  onClick={() => {
                    setFacturaInput("");
                    setFacturaDesdeInput("");
                    setFacturaHastaInput("");
                  }}
                  className="text-xs px-2.5 py-1 text-rose-500 hover:text-rose-600 font-bold transition hover:underline cursor-pointer"
                >
                  Limpiar Facturas
                </button>
              )}
            </div>

            {/* Chips de Facturas Disponibles */}
            {facturasDisponibles.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full">
                <span className="text-[10px] uppercase font-bold text-slate-400 flex-shrink-0">Facturas registradas:</span>
                {facturasDisponibles.slice(0, 40).map((f: any) => {
                  const isSel = modoFactura === "unica"
                    ? facturaInput.trim() === String(f.nro_factura).trim()
                    : facturaDesdeInput.trim() === String(f.nro_factura).trim() || facturaHastaInput.trim() === String(f.nro_factura).trim();
                  return (
                    <button
                      key={`hchip-${f.nro_factura}`}
                      type="button"
                      onClick={() => handleSelectFacturaChip(String(f.nro_factura))}
                      className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-mono transition cursor-pointer ${
                        isSel
                          ? "bg-amber-500 text-slate-950 font-bold border-amber-600 shadow-xs"
                          : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-500"
                      }`}
                      title={`Factura ${f.nro_factura}: ${f.total_viajes} viajes`}
                    >
                      <span className="font-bold">#{f.nro_factura}</span>
                      <span className="text-[10px] opacity-75">({f.total_viajes}v)</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Listado Principal de Liquidaciones */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
            <span className="text-xs text-slate-400 font-semibold tracking-wider uppercase">
              Cargando Liquidaciones...
            </span>
          </div>
        ) : filteredLiquidaciones.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-3">
              <Receipt className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
              No se encontraron liquidaciones
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
              {search || periodoFiltro !== "TODOS" || estadoFiltro !== "TODOS"
                ? "No hay resultados que coincidan con los filtros aplicados. Prueba limpiando la búsqueda."
                : "Aún no se ha generado ninguna liquidación en el sistema para esta empresa."}
            </p>
            <button
              onClick={() => router.push(`/${schema}/liquidaciones`)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-sm transition"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Generar Primera Liquidación</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/70 text-slate-600 dark:text-slate-300 font-bold text-[11px] uppercase border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-3.5">Código / N°</th>
                  <th className="py-3 px-3">Fecha Emisión</th>
                  <th className="py-3 px-3">Cisterna / Placa</th>
                  <th className="py-3 px-3">Período / Criterio</th>
                  <th className="py-3 px-2 text-center">Despachos</th>
                  <th className="py-3 px-3 text-right">Flete Bruto</th>
                  <th className="py-3 px-3 text-right">Flete - Mermas</th>
                  <th className="py-3 px-3 text-right">Deducciones</th>
                  <th className="py-3 px-3 text-right">Líquido Pagable</th>
                  <th className="py-3 px-3 text-center">Estado</th>
                  <th className="py-3 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredLiquidaciones.map((liq) => {
                  const isEditada = (liq.estado || "").toLowerCase().includes("editada") || Boolean(liq.updated_at);
                  const isConsolidado = liq.estado === "Consolidado General" || liq.placa === "TODAS";

                  return (
                    <tr
                      key={liq.id}
                      onClick={() => handleOpenPreview(liq)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition group"
                    >
                      {/* Código */}
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                            <Receipt className="w-3.5 h-3.5" />
                          </div>
                          <span className="font-mono font-bold text-slate-900 dark:text-white group-hover:text-amber-500 transition">
                            {liq.codigo}
                          </span>
                        </div>
                      </td>

                      {/* Fecha de Emisión y Registro */}
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <div className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                          {formatDate(liq.fecha_emision)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5 text-slate-400" />
                          {formatDateTime(liq.created_at)}
                        </div>
                      </td>

                      {/* Cisterna / Placa */}
                      <td className="py-3 px-3">
                        {isConsolidado ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                            <Layers className="w-3 h-3" />
                            <span>Flota Completa</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700">
                            <Truck className="w-3 h-3 text-amber-500" />
                            <span>{liq.placa}</span>
                          </span>
                        )}
                      </td>

                      {/* Período / Criterio */}
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {liq.periodo_mes}
                        </span>
                      </td>

                      {/* Cantidad de Despachos */}
                      <td className="py-3 px-2 text-center">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {liq.total_viajes}
                        </span>
                        <span className="text-[10px] text-slate-400 block">viajes</span>
                      </td>

                      {/* Flete Total Bruto */}
                      <td className="py-3 px-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {formatNumber(liq.flete_total_bruto_bs, 2)} Bs
                      </td>

                      {/* Flete - Mermas */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                        {formatNumber(Math.max(0, (liq.flete_total_bruto_bs || 0) - (liq.descuento_merma_bs ?? liq.total_mermas_bs ?? 0)), 2)} Bs
                      </td>

                      {/* Deducciones */}
                      <td className="py-3 px-3 text-right font-mono text-rose-600 dark:text-rose-400 font-semibold">
                        -{formatNumber(liq.total_descuentos_bs, 2)} Bs
                      </td>

                      {/* Líquido Pagable */}
                      <td className="py-3 px-3 text-right font-mono text-sm font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {formatCurrency(liq.liquido_pagable_bs)}
                      </td>

                      {/* Estado */}
                      <td className="py-3 px-3 text-center">
                        {isEditada ? (
                          <div className="inline-flex flex-col items-center">
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-xs"
                              title="Planilla re-liquidada con ajustes posteriores guardados"
                            >
                              <Edit3 className="w-3 h-3 text-amber-500" />
                              <span>{liq.estado || "Editada"}</span>
                            </span>
                            {liq.updated_at && (
                              <span className="text-[9px] font-mono text-amber-600/75 dark:text-amber-400/75 mt-0.5">
                                {formatDateTime(liq.updated_at)}
                              </span>
                            )}
                          </div>
                        ) : isConsolidado ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25">
                            <Layers className="w-3 h-3 text-indigo-500" />
                            <span>Consolidado</span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shadow-xs"
                            title="Liquidación oficial consolidada"
                          >
                            <Pin className="w-3 h-3 fill-emerald-500 text-emerald-500 -rotate-45" />
                            <span>Generada</span>
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenPreview(liq)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition"
                            title="Ver previsualización de la planilla oficial"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/${schema}/liquidaciones?placa=${encodeURIComponent(liq.placa)}&periodo=${encodeURIComponent(liq.periodo_mes)}&from=historial`);
                            }}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-sky-500/15 text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 border border-slate-200 dark:border-slate-700 transition"
                            title="Ajustar o re-liquidar en el módulo Liquidaciones"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-sky-500" />
                          </button>

                          <button
                            type="button"
                            disabled={downloadingId === liq.id}
                            onClick={(e) => handleDownloadExcel(liq, e)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition"
                            title="Descargar Planilla oficial en Excel (.xlsx)"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                          </button>

                          <button
                            type="button"
                            disabled={downloadingId === liq.id}
                            onClick={(e) => handleDownloadPDF(liq, e)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition"
                            title="Descargar Planilla oficial en PDF"
                          >
                            <Download className="w-3.5 h-3.5 text-rose-600" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleAnular(liq, e)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 transition"
                            title="Anular liquidación y liberar viajes"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* MODAL DE PREVISUALIZACIÓN OFICIAL DE LA LIQUIDACIÓN            */}
      {/* ============================================================== */}
      {selectedLiq && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
              
              {/* Barra Superior del Modal */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                        Planilla Oficial de Liquidación: {selectedLiq.codigo}
                      </h3>
                      <span className="px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        {selectedLiq.placa}
                      </span>
                      {selectedLiq.estado?.toLowerCase().includes("editada") ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                          <Edit3 className="w-2.5 h-2.5" />
                          <span>{selectedLiq.estado}</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <Pin className="w-2.5 h-2.5 fill-emerald-500" />
                          <span>Oficial Generada</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Período {selectedLiq.periodo_mes} • Emisión: {formatDate(selectedLiq.fecha_emision)} • Registro: {formatDateTime(selectedLiq.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Selector de Hoja */}
                  <div className="flex items-center bg-slate-200 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setActiveModalTab("ambas")}
                      className={`px-3 py-1 rounded-lg transition ${
                        activeModalTab === "ambas"
                          ? "bg-amber-500 text-slate-950 shadow font-black"
                          : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      Ambas Hojas
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModalTab("hoja1")}
                      className={`px-3 py-1 rounded-lg transition ${
                        activeModalTab === "hoja1"
                          ? "bg-amber-500 text-slate-950 shadow font-black"
                          : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      Hoja 1
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModalTab("hoja2")}
                      className={`px-3 py-1 rounded-lg transition ${
                        activeModalTab === "hoja2"
                          ? "bg-amber-500 text-slate-950 shadow font-black"
                          : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      Hoja 2
                    </button>
                  </div>

                  {/* Botón de Redirección a Liquidaciones para Ajuste */}
                  <button
                    type="button"
                    onClick={() => {
                      router.push(`/${schema}/liquidaciones?placa=${encodeURIComponent(selectedLiq.placa)}&periodo=${encodeURIComponent(selectedLiq.periodo_mes)}&from=historial`);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black shadow-sm transition active:scale-95 cursor-pointer"
                    title="Abrir esta liquidación en el módulo Liquidaciones para editar deducciones o recalcular"
                  >
                    <Edit3 className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Ajustar en Liquidaciones</span>
                  </button>

                  {/* Botones de Descarga */}
                  <button
                    type="button"
                    onClick={() => handleDownloadExcel(selectedLiq)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition active:scale-95"
                    title="Descargar en Excel"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadPDF(selectedLiq)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm transition active:scale-95"
                    title="Descargar en PDF"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLiq(null);
                      setSelectedLiqDetalle(null);
                    }}
                    className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white transition"
                    title="Cerrar previsualización"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Contenedor del Cuerpo de la Planilla */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {loadingDetalle ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-8 h-8 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                    <span className="text-xs text-slate-400 font-semibold tracking-wider uppercase">
                      Cargando Despachos y Firmas Oficiales...
                    </span>
                  </div>
                ) : (
                  <>
                    {/* HOJA 1: DETALLE OPERATIVO DE FLETES (19 COLUMNAS) */}
                    {(activeModalTab === "hoja1" || activeModalTab === "ambas") && (
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm overflow-x-auto">
                        
                        <div className="flex flex-col sm:flex-row items-start justify-between gap-3 border-b-2 border-slate-200 dark:border-slate-700 pb-3 mb-4">
                          <div>
                            <h4 className="text-base font-black tracking-tight uppercase text-amber-600 dark:text-amber-400">
                              LIQUIDACION DE FLETES
                            </h4>
                            <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-0.5">
                              PERIODO: <span className="font-black text-amber-600 dark:text-amber-400 uppercase">{selectedLiq.periodo_mes}</span>
                            </div>
                            <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                              PLACA: <span className="font-mono font-black text-slate-900 dark:text-white text-sm">{selectedLiq.placa}</span>
                            </div>
                          </div>

                          <div className="text-right flex flex-col items-end">
                            <div className="text-sm font-black text-slate-900 dark:text-white uppercase">
                              {previewEmpresaNombre}
                            </div>
                            <div className="inline-flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-0.5 mt-1 text-[11px] font-bold bg-slate-50 dark:bg-slate-950">
                              <span className="text-slate-500 dark:text-slate-400">TASA MERMA:</span>
                              <span className="text-rose-600 dark:text-rose-400 font-mono font-black">7,45 Bs/L</span>
                            </div>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[11px] border-collapse">
                            <thead>
                              <tr className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-200 text-[10px] uppercase font-black text-center border-y border-slate-200 dark:border-slate-800">
                                <th className="py-2 px-1 border-x border-slate-200 dark:border-slate-800">Nº</th>
                                <th className="py-2 px-1.5 border-x border-slate-200 dark:border-slate-800">FECHA DE CARGA</th>
                                <th className="py-2 px-1.5 border-x border-slate-200 dark:border-slate-800">FECHA DE DESCARGA</th>
                                <th className="py-2 px-1.5 border-x border-slate-200 dark:border-slate-800">MCI/DTA Nº Y OTROS</th>
                                <th className="py-2 px-1 border-x border-slate-200 dark:border-slate-800">PLACA</th>
                                <th className="py-2 px-2 border-x border-slate-200 dark:border-slate-800 text-left">TRAMO</th>
                                <th className="py-2 px-1 border-x border-slate-200 dark:border-slate-800">CLIENTE</th>
                                <th className="py-2 px-1 border-x border-slate-200 dark:border-slate-800">PRODUCTO</th>
                                <th className="py-2 px-1 border-x border-slate-200 dark:border-slate-800">N° FACTURA</th>
                                <th className="py-2 px-1.5 border-x border-slate-200 dark:border-slate-800">FECHA FACTURA</th>
                                <th className="py-2 px-1.5 border-x border-slate-200 dark:border-slate-800 text-right">Volumen en Lt. Origen</th>
                                <th className="py-2 px-1.5 border-x border-slate-200 dark:border-slate-800 text-right">Volumen Recepcionado</th>
                                <th className="py-2 px-1 border-x border-slate-200 dark:border-slate-800 text-right">Merma T/Tr</th>
                                <th className="py-2 px-1 border-x border-slate-200 dark:border-slate-800 text-right">Total Merma</th>
                                <th className="py-2 px-1 border-x border-slate-200 dark:border-slate-800 text-center">MERMA Tolerable</th>
                                <th className="py-2 px-1.5 border-x border-slate-200 dark:border-slate-800 text-right">Merma a Descontar Bs.</th>
                                <th className="py-2 px-1.5 border-x border-slate-200 dark:border-slate-800 text-right">Vol. Facturado</th>
                                <th className="py-2 px-1.5 border-x border-slate-200 dark:border-slate-800 text-right">TARIFA Bs.</th>
                                <th className="py-2 px-2 border-x border-slate-200 dark:border-slate-800 text-right">Total a pagar Bob.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(() => {
                                const viajes = selectedLiqDetalle?.viajes || [];
                                if (viajes.length === 0) {
                                  return (
                                    <tr>
                                      <td colSpan={19} className="py-6 text-center text-xs text-slate-400">
                                        No se encontraron viajes asociados en la base de datos para esta liquidación.
                                      </td>
                                    </tr>
                                  );
                                }

                                return viajes.map((v: any, idx: number) => {
                                  const fFactura = v.fecha_factura || v.fecha_descarga || v.fecha_carga;
                                  const nFac = v.nro_factura || "S/F";
                                  const volFactLt = getVolFactLitros(v);

                                  return (
                                    <tr
                                      key={v.id || idx}
                                      className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 text-[10px]"
                                    >
                                      <td className="py-1.5 px-1 border-x border-slate-100 dark:border-slate-800 text-center font-bold">{idx + 1}</td>
                                      <td className="py-1.5 px-1.5 border-x border-slate-100 dark:border-slate-800 whitespace-nowrap text-center">{formatDate(v.fecha_carga)}</td>
                                      <td className="py-1.5 px-1.5 border-x border-slate-100 dark:border-slate-800 whitespace-nowrap text-center">{formatDate(v.fecha_descarga)}</td>
                                      <td className="py-1.5 px-1.5 border-x border-slate-100 dark:border-slate-800 font-mono text-center">{v.mic_dta || "-"}</td>
                                      <td className="py-1.5 px-1 border-x border-slate-100 dark:border-slate-800 font-mono font-bold text-center">{v.placa}</td>
                                      <td className="py-1.5 px-2 border-x border-slate-100 dark:border-slate-800 truncate max-w-[130px] font-semibold">{v.tramo}</td>
                                      <td className="py-1.5 px-1 border-x border-slate-100 dark:border-slate-800 text-center truncate max-w-[90px]">{v.cliente}</td>
                                      <td className="py-1.5 px-1 border-x border-slate-100 dark:border-slate-800 text-center font-bold">{v.producto}</td>
                                      <td className="py-1.5 px-1 border-x border-slate-100 dark:border-slate-800 text-center font-mono font-bold text-amber-600 dark:text-amber-400">{nFac}</td>
                                      <td className="py-1.5 px-1.5 border-x border-slate-100 dark:border-slate-800 text-center whitespace-nowrap">{formatDate(fFactura)}</td>
                                      <td className="py-1.5 px-1.5 border-x border-slate-100 dark:border-slate-800 text-right font-mono">{formatNumber(v.volumen_origen_litros, 0)}</td>
                                      <td className="py-1.5 px-1.5 border-x border-slate-100 dark:border-slate-800 text-right font-mono">{formatNumber(v.volumen_recepcionado_litros, 0)}</td>
                                      <td className="py-1.5 px-1 border-x border-slate-100 dark:border-slate-800 text-right font-mono">{formatNumber(v.merma_real_litros, 1)}</td>
                                      <td className="py-1.5 px-1 border-x border-slate-100 dark:border-slate-800 text-right font-mono font-bold">{formatNumber(v.merma_real_litros, 1)}</td>
                                      <td className="py-1.5 px-1 border-x border-slate-100 dark:border-slate-800 text-center font-mono">{formatNumber(v.tolerancia_pct, 2)}%</td>
                                      <td className="py-1.5 px-1.5 border-x border-slate-100 dark:border-slate-800 text-right font-mono font-bold text-rose-600 dark:text-rose-400">{formatNumber(v.merma_descontar_bs, 2)}</td>
                                      <td className="py-1.5 px-1.5 border-x border-slate-100 dark:border-slate-800 text-right font-mono font-bold text-blue-600 dark:text-blue-400">{formatNumber(volFactLt, 0)} L</td>
                                      <td className="py-1.5 px-1.5 border-x border-slate-100 dark:border-slate-800 text-right font-mono">{formatNumber(v.tarifa_flete, 2)}</td>
                                      <td className="py-1.5 px-2 border-x border-slate-100 dark:border-slate-800 text-right font-mono font-black text-amber-600 dark:text-amber-400">{formatNumber(v.flete_total_bs, 2)}</td>
                                    </tr>
                                  );
                                });
                              })()}
                            </tbody>
                            <tfoot>
                              <tr className="bg-slate-100 dark:bg-slate-950 font-black text-[11px] border-t-2 border-slate-300 dark:border-slate-700">
                                <td colSpan={10} className="py-2.5 px-2 text-right uppercase">
                                  TOTALES CONSOLIDADOS:
                                </td>
                                <td className="py-2.5 px-1.5 text-right font-mono">
                                  {formatNumber(selectedLiq.total_volumen_origen_litros, 0)}
                                </td>
                                <td className="py-2.5 px-1.5 text-right font-mono">
                                  {formatNumber(selectedLiq.total_volumen_recepcionado_litros, 0)}
                                </td>
                                <td className="py-2.5 px-1 text-right font-mono">
                                  {formatNumber(selectedLiq.total_merma_real_litros, 1)}
                                </td>
                                <td className="py-2.5 px-1 text-right font-mono">
                                  {formatNumber(selectedLiq.total_merma_real_litros, 1)}
                                </td>
                                <td className="py-2.5 px-1 text-center">-</td>
                                <td className="py-2.5 px-1.5 text-right font-mono text-rose-600 dark:text-rose-400 font-black">
                                  {formatNumber(selectedLiq.desc_merma_bs, 2)}
                                </td>
                                <td className="py-2.5 px-1.5 text-right font-mono text-blue-600 dark:text-blue-400 font-black">
                                  -
                                </td>
                                <td className="py-2.5 px-1.5 text-right font-mono">-</td>
                                <td className="py-2.5 px-2 text-right font-mono text-xs font-black text-amber-600 dark:text-amber-400">
                                  {formatNumber(selectedLiq.flete_total_bruto_bs, 2)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* HOJA 2: RESUMEN DE DEDUCCIONES Y LÍQUIDO PAGABLE */}
                    {(activeModalTab === "hoja2" || activeModalTab === "ambas") && (
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm max-w-2xl mx-auto">
                        
                        <div className="flex items-start justify-between border-b-2 border-slate-200 dark:border-slate-700 pb-3 mb-5">
                          <div>
                            <h4 className="text-base font-black tracking-tight uppercase text-amber-600 dark:text-amber-400">
                              LIQUIDACION DE FLETES
                            </h4>
                            <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-0.5">
                              MES: <span className="font-black text-amber-600 dark:text-amber-400 uppercase">{selectedLiq.periodo_mes}</span>
                            </div>
                            <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                              PLACA: <span className="font-mono font-black text-slate-900 dark:text-white">{selectedLiq.placa}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-sm font-black text-slate-900 dark:text-white uppercase">
                              {previewEmpresaNombre}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">
                              Resumen de Deducciones y Pagos
                            </div>
                          </div>
                        </div>

                        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mb-6 shadow-sm">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-200 font-black text-[11px] uppercase border-b border-slate-200 dark:border-slate-800">
                                <th className="py-2.5 px-4">DESCRIPCIÓN</th>
                                <th className="py-2.5 px-4 text-right">TOTAL Bs</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[12px]">
                              <tr className="bg-amber-50 dark:bg-amber-500/10 font-black text-amber-900 dark:text-amber-300">
                                <td className="py-2.5 px-4 uppercase">FLETE TOTAL</td>
                                <td className="py-2.5 px-4 text-right font-mono font-black text-amber-600 dark:text-amber-400">
                                  {formatNumber(selectedLiq.flete_total_bruto_bs, 2)}
                                </td>
                              </tr>
                              <tr>
                                <td className="py-2 px-4 text-slate-700 dark:text-slate-300">Descuento por Merma</td>
                                <td className="py-2 px-4 text-right font-mono text-slate-900 dark:text-white">{formatNumber(selectedLiq.desc_merma_bs, 2)}</td>
                              </tr>
                              <tr>
                                <td className="py-2 px-4 text-slate-700 dark:text-slate-300">Descuento de Comisión 1 $us p/m3</td>
                                <td className="py-2 px-4 text-right font-mono text-slate-900 dark:text-white">{formatNumber(selectedLiq.desc_comision_usd_m3_bs, 2)}</td>
                              </tr>
                              <tr>
                                <td className="py-2 px-4 text-slate-700 dark:text-slate-300">Descuento de Comisión 7%</td>
                                <td className="py-2 px-4 text-right font-mono text-slate-900 dark:text-white">{formatNumber(selectedLiq.desc_comision_7pct_bs, 2)}</td>
                              </tr>
                              <tr>
                                <td className="py-2 px-4 text-slate-700 dark:text-slate-300">Descuento YPFB BOL-GART 7%</td>
                                <td className="py-2 px-4 text-right font-mono text-slate-900 dark:text-white">{formatNumber(selectedLiq.desc_comision_ypfb_bolgart_7pct_bs, 2)}</td>
                              </tr>
                              <tr>
                                <td className="py-2 px-4 text-slate-700 dark:text-slate-300">Descuento de Comisión 3%</td>
                                <td className="py-2 px-4 text-right font-mono text-slate-900 dark:text-white">{formatNumber(selectedLiq.desc_comision_3pct_bs, 2)}</td>
                              </tr>
                              <tr>
                                <td className="py-2 px-4 text-slate-700 dark:text-slate-300">Hojas de Ruta</td>
                                <td className="py-2 px-4 text-right font-mono text-slate-900 dark:text-white">{formatNumber(selectedLiq.desc_hojas_ruta_bs, 2)}</td>
                              </tr>
                              <tr>
                                <td className="py-2 px-4 text-slate-700 dark:text-slate-300">GPS</td>
                                <td className="py-2 px-4 text-right font-mono text-slate-900 dark:text-white">{formatNumber(selectedLiq.desc_gps_bs, 2)}</td>
                              </tr>
                              <tr>
                                <td className="py-2 px-4 text-slate-700 dark:text-slate-300">Anticipos y Otros 7%</td>
                                <td className="py-2 px-4 text-right font-mono text-slate-900 dark:text-white">{formatNumber(selectedLiq.desc_anticipos_otros_bs, 2)}</td>
                              </tr>
                              {Number(selectedLiq.desc_otros_ajustes_bs || 0) !== 0 && (
                                <tr>
                                  <td className="py-2 px-4 text-slate-700 dark:text-slate-300">Otros Ajustes / Descuentos</td>
                                  <td className="py-2 px-4 text-right font-mono text-slate-900 dark:text-white">{formatNumber(selectedLiq.desc_otros_ajustes_bs, 2)}</td>
                                </tr>
                              )}
                              <tr className="bg-rose-50 dark:bg-rose-500/15 font-bold text-rose-900 dark:text-rose-300 border-t-2 border-slate-200 dark:border-slate-700">
                                <td className="py-2.5 px-4 uppercase font-black">TOTAL DESCUENTO</td>
                                <td className="py-2.5 px-4 text-right font-mono text-rose-700 dark:text-rose-400 font-black">
                                  {formatNumber(selectedLiq.total_descuentos_bs, 2)}
                                </td>
                              </tr>
                              <tr className="bg-emerald-50 dark:bg-emerald-500/20 font-black text-emerald-950 dark:text-emerald-300 border-t-2 border-emerald-500">
                                <td className="py-3 px-4 uppercase text-sm">LÍQUIDO PAGABLE</td>
                                <td className="py-3 px-4 text-right font-mono text-base font-black text-emerald-600 dark:text-emerald-400">
                                  {formatNumber(selectedLiq.liquido_pagable_bs, 2)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Bloque de Firmas */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-8 text-center text-xs">
                          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 bg-slate-50 dark:bg-slate-950/60">
                            <div className="font-bold text-[9px] uppercase text-slate-400 mb-5">REALIZADO POR:</div>
                            <div className="font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-800 pt-1 text-[10px]">{previewFirmas.realizado_por}</div>
                          </div>
                          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 bg-slate-50 dark:bg-slate-950/60">
                            <div className="font-bold text-[9px] uppercase text-slate-400 mb-5">REVISADO POR:</div>
                            <div className="font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-800 pt-1 text-[10px]">{previewFirmas.revisado_por}</div>
                          </div>
                          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 bg-slate-50 dark:bg-slate-950/60">
                            <div className="font-bold text-[9px] uppercase text-slate-400 mb-5">AUTORIZADO POR:</div>
                            <div className="font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-800 pt-1 text-[10px]">{previewFirmas.autorizado_por}</div>
                          </div>
                          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 bg-slate-50 dark:bg-slate-950/60">
                            <div className="font-bold text-[9px] uppercase text-slate-400 mb-5">CANCELADO POR:</div>
                            <div className="font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-800 pt-1 text-[10px]">{previewFirmas.cancelado_por}</div>
                          </div>
                        </div>

                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Pie del Modal */}
              <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Planilla oficial con validez operativa y contractual
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLiq(null);
                    setSelectedLiqDetalle(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition"
                >
                  Cerrar
                </button>
              </div>

            </div>
          </div>
        </ModalPortal>
      )}

    </div>
  );
}
