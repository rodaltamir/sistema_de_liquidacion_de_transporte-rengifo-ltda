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
  FileCheck
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatNumber, formatM3, formatLitros, formatDate } from "@/lib/format";

export default function EmpresaDashboardPage() {
  const routeParams = useParams();
  const schema = (routeParams?.schema as string) || "";

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("");

  useEffect(() => {
    loadDashboard();
  }, [schema, periodo]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const url = periodo 
        ? `/tenants/${schema}/dashboard/?periodo_mes=${periodo}`
        : `/tenants/${schema}/dashboard/`;
      const res = await apiFetch(url);
      setData(res);
      if (!periodo && res.periodo_activo) {
        setPeriodo(res.periodo_activo);
      }
    } catch (err) {
      console.error("Error cargando dashboard", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col justify-center items-center py-32 gap-3">
        <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
        <span className="text-slate-400 text-xs font-semibold tracking-wider uppercase">Cargando Panel Operativo...</span>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const distribucion = data?.distribucion_productos || {};

  return (
    <div className="space-y-6 sm:space-y-7 font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* Encabezado del Dashboard (Tarjeta Banner Ejecutiva) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-500/10">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Panel de Control Operativo
              </h1>
              <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/25">
                Periodo {periodo}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Monitoreo ejecutivo de viajes, fletes facturables, mermas de hidrocarburos y liquidaciones
            </p>
          </div>
        </div>

        {/* Selector de Mes y Acciones Rápidas */}
        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3.5 py-2 rounded-xl text-xs shadow-md">
            <Calendar className="w-4 h-4 text-amber-500" />
            <span className="text-slate-400 font-medium">Periodo:</span>
            <input
              type="month"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="bg-transparent text-white font-bold focus:outline-none cursor-pointer text-xs"
            />
          </div>

          <Link
            href={`/${schema}/viajes?action=nuevo`}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs sm:text-sm font-black shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition transform active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Nuevo Viaje</span>
          </Link>
        </div>
      </div>

      {/* Grid de KPIs Principales Simétricos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        
        {/* Flete Bruto Acumulado */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-5 shadow-lg shadow-black/20 transition-all flex flex-col justify-between min-h-[125px] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Flete Bruto</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
              <DollarSign className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-black text-amber-400 tracking-tight font-mono">
              {formatCurrency(kpis.total_flete_bruto_bs)}
            </div>
          </div>
          <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Operaciones</span>
            <span className="font-semibold text-slate-300">{kpis.total_viajes || 0} viajes conciliados</span>
          </div>
        </div>

        {/* Líquido Pagable */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-5 shadow-lg shadow-black/20 transition-all flex flex-col justify-between min-h-[125px] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Líquido Pagable</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-black text-emerald-400 tracking-tight font-mono">
              {formatCurrency(kpis.total_liquido_pagable_bs)}
            </div>
          </div>
          <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Monto neto transportista</span>
            <span className="font-bold text-emerald-400">{kpis.total_liquidaciones || 0} planillas</span>
          </div>
        </div>

        {/* Volumen Transportado */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-sky-500/40 rounded-2xl p-5 shadow-lg shadow-black/20 transition-all flex flex-col justify-between min-h-[125px] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Volumen Entregado</span>
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform">
              <Fuel className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-black text-white tracking-tight">
              {formatM3(kpis.total_volumen_m3)}
            </div>
          </div>
          <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Equivalencia</span>
            <span className="font-bold text-sky-400">{formatNumber(kpis.total_volumen_m3 ? kpis.total_volumen_m3 * 1000 : 0, 0)} L</span>
          </div>
        </div>

        {/* Mermas a Descontar */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-rose-500/40 rounded-2xl p-5 shadow-lg shadow-black/20 transition-all flex flex-col justify-between min-h-[125px] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mermas Excedentes</span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 group-hover:scale-105 transition-transform">
              <AlertTriangle className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-black text-rose-400 tracking-tight font-mono">
              {formatCurrency(kpis.total_merma_descontar_bs)}
            </div>
          </div>
          <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Fuera de tolerancia (0.35%)</span>
            <span className="font-bold text-rose-400">{formatLitros(kpis.total_merma_litros)}</span>
          </div>
        </div>

      </div>

      {/* Sección 2: Distribución por Producto y Flota */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Distribución de Carga por Producto */}
        <div className="lg:col-span-2 bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                  <Fuel className="w-4 h-4" />
                </div>
                <span>Volumen Transportado por Tipo de Hidrocarburo</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Desglose de productos recepcionados en planta de almacenaje</p>
            </div>
          </div>

          {Object.keys(distribucion).length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No hay despachos registrados para este periodo.
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(distribucion).map(([prod, litros]: any) => {
                const total = Object.values(distribucion).reduce((a: any, b: any) => a + b, 0) as number;
                const pct = total > 0 ? (litros / total) * 100 : 0;
                return (
                  <div key={prod} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-200">{prod}</span>
                      <span className="text-amber-400 font-mono">{formatLitros(litros)} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
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
        <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                  <Truck className="w-4 h-4" />
                </div>
                <span>Flota de Unidades</span>
              </h3>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-slate-700">
                {kpis.total_unidades || 0} Camiones
              </span>
            </div>

            <div className="space-y-3 mt-4">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-medium text-slate-300">Unidades Operativas</span>
                </div>
                <span className="text-sm font-bold text-white">{kpis.unidades_activas || 0}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-medium text-slate-300">Habilitación YPFB / ANH</span>
                </div>
                <span className="text-xs font-bold text-emerald-400">100% Vigente</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800 mt-4">
            <Link
              href={`/${schema}/flota`}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-amber-400 hover:text-amber-300 border border-slate-700 text-xs font-bold flex items-center justify-center gap-2 transition"
            >
              <span>Administrar Flota de Camiones</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

      </div>

      {/* Sección 3: Viajes Recientes */}
      <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                <Navigation className="w-4 h-4" />
              </div>
              <span>Despachos y Fletes Recientes</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Últimos registros de carga y recepción ingresados</p>
          </div>

          <Link
            href={`/${schema}/viajes`}
            className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
          >
            <span>Ver Todos los Viajes</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {!data?.viajes_recientes || data.viajes_recientes.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            No hay viajes registrados recientemente en esta empresa.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="pb-3 px-3">Placa</th>
                  <th className="pb-3 px-3">Tramo</th>
                  <th className="pb-3 px-3">Producto</th>
                  <th className="pb-3 px-3">Fecha Carga</th>
                  <th className="pb-3 px-3 text-right">Volumen</th>
                  <th className="pb-3 px-3 text-right">Flete Total</th>
                  <th className="pb-3 px-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {data.viajes_recientes.map((vr: any) => (
                  <tr key={vr.id} className="hover:bg-slate-800/50 transition">
                    <td className="py-3 px-3 font-mono font-bold text-white">{vr.placa}</td>
                    <td className="py-3 px-3 text-slate-300">{vr.tramo}</td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-amber-400">{vr.producto}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-400">{formatDate(vr.fecha_carga)}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-300">{formatLitros(vr.volumen_litros)}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                      {formatCurrency(vr.flete_bs)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        vr.estado === "Liquidado"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : "bg-amber-500/15 text-amber-400 border-amber-500/30"
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
