"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { 
  LayoutDashboard,
  Truck, 
  Navigation, 
  FileSpreadsheet, 
  DollarSign, 
  Fuel, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  Plus, 
  Calendar,
  Layers,
  ChevronRight,
  Users,
  ShieldCheck,
  FileCheck,
  Sparkles,
  Calculator
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatNumber, formatM3, formatLitros, formatDate } from "@/lib/format";
import { getSavedState, saveState } from "@/lib/storage";
import DatePeriodFilter, { DateFilterChangeEvent } from "@/components/DatePeriodFilter";

export default function EmpresaDashboardPage() {
  const routeParams = useParams();
  const schema = (routeParams?.schema as string) || "";

  const currentYear = new Date().getFullYear();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentFilterQuery, setCurrentFilterQuery] = useState(`anio=${currentYear}`);
  const [activeLabel, setActiveLabel] = useState(`Gestión ${currentYear}`);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (!schema) return;
    const saved = getSavedState<any>(`transporte_${schema}_dashboard_memoria`, null);
    if (saved) {
      if (saved.currentFilterQuery !== undefined) setCurrentFilterQuery(saved.currentFilterQuery);
      if (saved.activeLabel !== undefined) setActiveLabel(saved.activeLabel);
    }
    setIsHydrated(true);
  }, [schema]);

  const loadDashboard = async (query = "") => {
    setLoading(true);
    try {
      const url = query
        ? `/tenants/${schema}/dashboard/?${query}`
        : `/tenants/${schema}/dashboard/`;
      const res = await apiFetch(url);
      setData(res);
      if (res.periodo_activo && !activeLabel) {
        setActiveLabel(res.periodo_activo);
      }
    } catch (err) {
      console.error("Error cargando dashboard", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (schema && isHydrated) {
      loadDashboard(currentFilterQuery);
    }
  }, [schema, isHydrated, currentFilterQuery]);

  // Memoria Inteligente: persistir filtro del Dashboard
  useEffect(() => {
    if (!schema || !isHydrated) return;
    saveState(`transporte_${schema}_dashboard_memoria`, {
      currentFilterQuery,
      activeLabel
    });
  }, [schema, isHydrated, currentFilterQuery, activeLabel]);

  const handleFilterChange = (filter: DateFilterChangeEvent) => {
    setActiveLabel(filter.label);
    let q = "";
    if (filter.mode === "mes" && filter.periodo_mes) {
      q = `periodo_mes=${filter.periodo_mes}`;
    } else if (filter.mode === "semestral" && filter.fecha_desde && filter.fecha_hasta) {
      q = `fecha_desde=${filter.fecha_desde}&fecha_hasta=${filter.fecha_hasta}`;
    } else if (filter.mode === "anual" && filter.anio && !isNaN(filter.anio)) {
      q = `anio=${filter.anio}`;
    } else if (filter.mode === "personalizado" && filter.fecha_desde && filter.fecha_hasta) {
      q = `fecha_desde=${filter.fecha_desde}&fecha_hasta=${filter.fecha_hasta}`;
    } else if (filter.mode === "historico") {
      q = `historico=true`;
    }
    setCurrentFilterQuery(q);
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col justify-center items-center py-32 gap-3">
        <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
        <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold tracking-wider uppercase">
          Cargando Panel Operativo...
        </span>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const distribucion = data?.distribucion_productos || {};
  const safeDashboardYear = data?.anio && !isNaN(data.anio) ? data.anio : new Date().getFullYear();
  const rawLabel = activeLabel || data?.periodo_activo || `Gestión ${safeDashboardYear} (Anual)`;
  const displayLabel = rawLabel.replace(/\bNaN\b/g, String(safeDashboardYear));

  return (
    <div className="space-y-4 font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* Encabezado del Dashboard (Sleek & Intuitivo) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Panel de Control Operativo
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                {displayLabel}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Métricas consolidadas de fletes facturables, mermas y liquidaciones netas.
            </p>
          </div>
        </div>

        {/* Acciones Rápidas */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/${schema}/viajes?action=nuevo`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Nuevo Viaje</span>
          </Link>
        </div>
      </div>

      {/* ======================================================== */}
      {/* FILTROS DE FECHA Y VISUALIZADOR DE MESES INTERACTIVO     */}
      {/* ======================================================== */}
      <DatePeriodFilter
        initialMode="anual"
        currentPeriodoMes={data?.anio ? String(data.anio) : data?.periodo_activo}
        periodosDisponibles={data?.periodos_disponibles || []}
        onChange={handleFilterChange}
      />

      {/* Grid de KPIs Principales (5 Tarjetas Compactas y Claras) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        
        {/* Flete Bruto Acumulado */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Flete Bruto</span>
            <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">
              {formatCurrency(kpis.total_flete_bruto_bs)}
            </div>
            <span className="text-[10px] text-slate-400 font-medium">{kpis.total_viajes || 0} viajes conciliados</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 flex-shrink-0">
            <DollarSign className="w-4.5 h-4.5" />
          </div>
        </div>

        {/* Flete Bruto menos Mermas (Dato Solicitado) */}
        <div className="bg-white dark:bg-slate-900 border border-blue-500/30 rounded-xl p-3.5 shadow-sm flex items-center justify-between bg-blue-50/10">
          <div>
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">Flete - Mermas</span>
            <div className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 font-mono mt-0.5">
              {formatCurrency(Math.max(0, (kpis.total_flete_bruto_bs || 0) - (kpis.total_merma_descontar_bs || 0)))}
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              {(kpis.total_merma_descontar_bs || 0) > 0 ? `Merma: -${formatCurrency(kpis.total_merma_descontar_bs)}` : "Sin retención"}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 flex-shrink-0">
            <Calculator className="w-4.5 h-4.5" />
          </div>
        </div>

        {/* Líquido Pagable */}
        <div className="bg-white dark:bg-slate-900 border border-emerald-500/30 rounded-xl p-3.5 shadow-sm flex items-center justify-between bg-emerald-50/10">
          <div>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Líquido Pagable</span>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
              {formatCurrency(kpis.total_liquido_pagable_bs)}
            </div>
            <span className="text-[10px] text-emerald-600/80 font-medium">{kpis.total_liquidaciones || 0} planillas emitidas</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 flex-shrink-0">
            <CheckCircle2 className="w-4.5 h-4.5" />
          </div>
        </div>

        {/* Volumen Transportado */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Vol. Entregado</span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
              {formatM3(kpis.total_volumen_m3)}
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              {formatNumber(kpis.total_volumen_m3 ? kpis.total_volumen_m3 * 1000 : 0, 0)} L
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-500 flex-shrink-0">
            <Fuel className="w-4.5 h-4.5" />
          </div>
        </div>

        {/* Mermas a Descontar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Mermas Excedentes</span>
            <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 font-mono mt-0.5">
              {formatCurrency(kpis.total_merma_descontar_bs)}
            </div>
            <span className="text-[10px] text-slate-400 font-medium">{formatLitros(kpis.total_merma_litros)}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 flex-shrink-0">
            <AlertTriangle className="w-4.5 h-4.5" />
          </div>
        </div>

      </div>

      {/* Sección 2: Distribución por Producto y Flota */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Distribución de Carga por Producto */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl transition-colors duration-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                  <Fuel className="w-4 h-4" />
                </div>
                <span>Volumen Transportado por Tipo de Hidrocarburo</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Desglose de productos recepcionados en planta de almacenaje ({activeLabel || "Periodo"})
              </p>
            </div>
          </div>

          {Object.keys(distribucion).length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No hay despachos registrados para este filtro de fechas.
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(distribucion).map(([prod, litros]: any) => {
                const total = Object.values(distribucion).reduce((a: any, b: any) => a + b, 0) as number;
                const pct = total > 0 ? (litros / total) * 100 : 0;
                return (
                  <div key={prod} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-700 dark:text-slate-200">{prod}</span>
                      <span className="text-amber-600 dark:text-amber-400 font-mono">{formatLitros(litros)} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Estado de la Flota de Camiones */}
        <div className="bg-white dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between transition-colors duration-200">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                  <Truck className="w-4 h-4" />
                </div>
                <span>Flota de Unidades</span>
              </h3>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-amber-600 dark:text-amber-400 border border-slate-200 dark:border-slate-700">
                {kpis.total_unidades || 0} Camiones
              </span>
            </div>

            <div className="space-y-3 mt-4">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Unidades Operativas</span>
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-white">{kpis.unidades_activas || 0}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Habilitación YPFB / ANH</span>
                </div>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">100% Vigente</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 mt-4">
            <Link
              href={`/${schema}/flota`}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-amber-600 dark:text-amber-400 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center justify-center gap-2 transition"
            >
              <span>Administrar Flota de Camiones</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

      </div>

      {/* Sección 3: Viajes Recientes */}
      <div className="bg-white dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl transition-colors duration-200">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                <Navigation className="w-4 h-4" />
              </div>
              <span>Despachos y Fletes Recientes</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Últimos registros de carga y recepción ingresados</p>
          </div>

          <Link
            href={`/${schema}/viajes`}
            className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 transition"
          >
            <span>Ver Todos los Viajes</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {!data?.viajes_recientes || data.viajes_recientes.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            No hay viajes registrados recientemente en esta empresa.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="pb-3 px-3">Placa</th>
                  <th className="pb-3 px-3">Tramo</th>
                  <th className="pb-3 px-3">Producto</th>
                  <th className="pb-3 px-3">Fecha Carga</th>
                  <th className="pb-3 px-3 text-right">Volumen</th>
                  <th className="pb-3 px-3 text-right">Flete Total</th>
                  <th className="pb-3 px-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                {data.viajes_recientes.map((vr: any) => (
                  <tr key={vr.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">{vr.placa}</td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300">{vr.tramo}</td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-amber-600 dark:text-amber-400">{vr.producto}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-500 dark:text-slate-400">{formatDate(vr.fecha_carga)}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-700 dark:text-slate-300">{formatLitros(vr.volumen_litros)}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(vr.flete_bs)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        vr.estado === "Liquidado"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                      }`}>
                        {vr.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
