"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { 
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
  Users
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatNumber, formatM3, formatLitros, formatDate } from "@/lib/format";

export default function EmpresaDashboardPage({ params }: { params: Promise<{ schema: string }> }) {
  const resolvedParams = use(params);
  const schema = resolvedParams.schema;

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
      <div className="flex justify-center items-center py-32">
        <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const distribucion = data?.distribucion_productos || {};

  return (
    <div className="space-y-6">
      {/* Encabezado del Dashboard */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Truck className="w-6 h-6" />
            </div>
            <span>Panel de Control de Operaciones</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Resumen de viajes, liquidaciones, mermas de hidrocarburos y flota activa
          </p>
        </div>

        {/* Selector de Mes y Acciones Rápidas */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs shadow-sm">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="text-slate-500 font-medium">Periodo:</span>
            <input
              type="month"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="bg-transparent text-slate-900 font-semibold focus:outline-none cursor-pointer text-xs"
            />
          </div>

          <Link
            href={`/${schema}/viajes?action=nuevo`}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Viaje</span>
          </Link>
        </div>
      </div>

      {/* Grid de KPIs Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Flete Bruto Acumulado */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-blue-300 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Flete Bruto del Mes</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {formatCurrency(kpis.total_flete_bruto_bs)}
          </div>
          <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
            <span className="text-blue-600 font-semibold">{kpis.total_viajes || 0}</span> viajes completados
          </div>
        </div>

        {/* Líquido Pagable */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-emerald-300 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Líquido Pagable</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600 tracking-tight">
            {formatCurrency(kpis.total_liquido_pagable_bs)}
          </div>
          <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
            <span className="text-emerald-600 font-semibold">{kpis.total_liquidaciones || 0}</span> planillas generadas
          </div>
        </div>

        {/* Volumen Transportado */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-blue-300 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Volumen Transportado</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <Fuel className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {formatM3(kpis.total_volumen_m3)}
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Equivalente a {formatNumber(kpis.total_volumen_m3 ? kpis.total_volumen_m3 * 1000 : 0, 0)} Litros
          </div>
        </div>

        {/* Mermas a Descontar */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-amber-300 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mermas Excedentes</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-600 tracking-tight">
            {formatCurrency(kpis.total_merma_descontar_bs)}
          </div>
          <div className="text-[11px] text-slate-500 mt-2 flex items-center justify-between">
            <span>Merma real total:</span>
            <span className="text-slate-800 font-semibold">{formatLitros(kpis.total_merma_litros)}</span>
          </div>
        </div>

      </div>

      {/* Sección 2: Distribución por Producto y Flota */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Distribución de Carga por Producto */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Fuel className="w-5 h-5 text-blue-600" />
                <span>Volumen Transportado por Tipo de Producto</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Desglose de hidrocarburos recibidos en destino</p>
            </div>
          </div>

          {Object.keys(distribucion).length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
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
                      <span className="text-slate-800">{prod}</span>
                      <span className="text-blue-600 font-mono">{formatLitros(litros)} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-500"
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
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                <span>Flota de Unidades</span>
              </h3>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {kpis.total_unidades || 0} Camiones
              </span>
            </div>

            <div className="space-y-3 mt-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-medium text-slate-700">Unidades Activas / En Ruta</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{kpis.unidades_activas || 0}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-medium text-slate-700">Habilitación Vigente YPFB</span>
                </div>
                <span className="text-xs font-bold text-emerald-600">100%</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 mt-4">
            <Link
              href={`/${schema}/flota`}
              className="w-full py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-blue-600 border border-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              <span>Administrar Flota de Camiones</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

      </div>

      {/* Sección 3: Viajes Recientes */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Navigation className="w-5 h-5 text-blue-600" />
              <span>Despachos y Fletes Recientes</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Últimos registros de carga y recepción</p>
          </div>

          <Link
            href={`/${schema}/viajes`}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition"
          >
            <span>Ver Todos los Viajes</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {!data?.viajes_recientes || data.viajes_recientes.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            No hay viajes registrados recientemente.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                  <th className="pb-3 px-3">Placa</th>
                  <th className="pb-3 px-3">Tramo</th>
                  <th className="pb-3 px-3">Producto</th>
                  <th className="pb-3 px-3">Fecha Carga</th>
                  <th className="pb-3 px-3 text-right">Volumen</th>
                  <th className="pb-3 px-3 text-right">Flete Total</th>
                  <th className="pb-3 px-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.viajes_recientes.map((vr: any) => (
                  <tr key={vr.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">{vr.placa}</td>
                    <td className="py-3 px-3 text-slate-600">{vr.tramo}</td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-blue-600">{vr.producto}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-500">{formatDate(vr.fecha_carga)}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-700">{formatLitros(vr.volumen_litros)}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600">
                      {formatCurrency(vr.flete_bs)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        vr.estado === "Liquidado"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
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
