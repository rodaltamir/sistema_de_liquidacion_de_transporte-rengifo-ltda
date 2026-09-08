"use client";

import { Suspense, useState, useEffect, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  FileText
} from "lucide-react";
import Swal from "sweetalert2";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatNumber, formatDate } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth";

export default function AsociacionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" /></div>}>
      <AsociacionDetalleContent params={params} />
    </Suspense>
  );
}

function AsociacionDetalleContent({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const asocId = resolvedParams.id;
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = searchParams.get("tab") === "liquidacion" ? "liquidacion" : "empresas";
  const [activeTab, setActiveTab] = useState<"empresas" | "liquidacion">(initialTab);

  const [asociacion, setAsociacion] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Estado para la liquidación general
  const [periodoMes, setPeriodoMes] = useState("2025-10");
  const [liqData, setLiqData] = useState<any>(null);
  const [loadingLiq, setLoadingLiq] = useState(false);

  useEffect(() => {
    loadAsociacion();
  }, [asocId]);

  useEffect(() => {
    if (activeTab === "liquidacion") {
      loadLiquidacionGeneral();
    }
  }, [activeTab, periodoMes]);

  const loadAsociacion = async () => {
    try {
      const data = await apiFetch(`/asociaciones/${asocId}`);
      setAsociacion(data);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.message,
        background: "#0f172a",
        color: "#fff"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadLiquidacionGeneral = async () => {
    setLoadingLiq(true);
    try {
      const data = await apiFetch(`/asociaciones/${asocId}/liquidacion-general?periodo_mes=${periodoMes}`);
      setLiqData(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingLiq(false);
    }
  };

  const downloadExcel = async () => {
    try {
      const blob = await apiFetch(`/asociaciones/${asocId}/export/excel?periodo_mes=${periodoMes}`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Liquidacion_Asociacion_${periodoMes}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "Error", text: err.message, background: "#0f172a", color: "#fff" });
    }
  };

  const downloadPDF = async () => {
    try {
      const blob = await apiFetch(`/asociaciones/${asocId}/export/pdf?periodo_mes=${periodoMes}`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Liquidacion_Asociacion_${periodoMes}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "Error", text: err.message, background: "#0f172a", color: "#fff" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!asociacion) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <h2 className="text-xl font-bold text-white mb-4">Asociación no encontrada</h2>
        <Link href="/seleccionar-asociacion" className="px-4 py-2 bg-cyan-600 rounded-xl text-white font-bold text-sm">
          Volver
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-slate-900/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-30 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/seleccionar-asociacion"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Volver a Asociaciones"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-white">
                  {asociacion.name}
                </h1>
                {asociacion.sigla && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                    {asociacion.sigla}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                NIT: {asociacion.nit || "S/N"} • Representante: {asociacion.representante_legal || "No asignado"}
              </p>
            </div>
          </div>

          {/* Selector de Pestañas */}
          <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setActiveTab("empresas")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === "empresas"
                  ? "bg-cyan-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>Empresas Afiliadas ({asociacion.empresas?.length || 0})</span>
            </button>
            <button
              onClick={() => setActiveTab("liquidacion")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === "liquidacion"
                  ? "bg-cyan-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Liquidación General (PDF Pág 1)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* ============================================================== */}
        {/* PESTAÑA 1: EMPRESAS AFILIADAS */}
        {/* ============================================================== */}
        {activeTab === "empresas" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Truck className="w-5 h-5 text-cyan-400" />
                  Empresas de Transporte Afiliadas
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Selecciona una empresa para ingresar a su panel operativo o gestionar sus camiones y fletes.
                </p>
              </div>

              <Link
                href={`/seleccionar-empresa?asoc_id=${asociacion.id}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/20 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Empresa en esta Asociación</span>
              </Link>
            </div>

            {asociacion.empresas?.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center max-w-md mx-auto">
                <Truck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white mb-1">Sin empresas registradas</h3>
                <p className="text-sm text-slate-400 mb-6">
                  Esta asociación aún no tiene empresas de transporte asociadas.
                </p>
                <Link
                  href={`/seleccionar-empresa?asoc_id=${asociacion.id}`}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition"
                >
                  Afiliar Empresa
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {asociacion.empresas.map((emp: any) => (
                  <div
                    key={emp.id}
                    className="bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 rounded-2xl p-6 shadow-xl hover:shadow-cyan-500/10 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-950 border border-blue-800 text-blue-400 flex items-center justify-center font-bold text-lg">
                          <Truck className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {emp.schema_name}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition line-clamp-2">
                        {emp.name}
                      </h3>

                      <div className="mt-4 space-y-1.5 text-xs text-slate-400">
                        {emp.nit && (
                          <div className="flex justify-between border-b border-slate-800 pb-1">
                            <span className="text-slate-500">NIT:</span>
                            <span className="font-mono text-slate-300">{emp.nit}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-1">
                          <span className="text-slate-500">Estado:</span>
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Activo
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-800">
                      <Link
                        href={`/${emp.schema_name}/dashboard`}
                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-cyan-500/20"
                      >
                        <span>Entrar a la Empresa</span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* PESTAÑA 2: LIQUIDACIÓN GENERAL CONSOLIDADA (HOJA 1 DEL PDF) */}
        {/* ============================================================== */}
        {activeTab === "liquidacion" && (
          <div>
            {/* Barra superior de controles */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 mb-6 shadow-xl flex flex-col lg:flex-row items-center justify-between gap-4 no-print">
              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <div className="flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-xl border border-slate-700">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs text-slate-400 font-medium">Periodo Mes:</span>
                  <input
                    type="month"
                    value={periodoMes}
                    onChange={(e) => setPeriodoMes(e.target.value)}
                    className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-950/60 border border-blue-800/60 text-blue-300 text-xs font-medium">
                  <Info className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <span>Agrupa viajes de todas las empresas afiliadas para este periodo.</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end">
                <button
                  onClick={downloadExcel}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition"
                  title="Exportar archivo Excel idéntico al reporte"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Exportar Excel</span>
                </button>

                <button
                  onClick={downloadPDF}
                  className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/20 flex items-center gap-1.5 transition"
                  title="Descargar versión PDF oficial"
                >
                  <Download className="w-4 h-4" />
                  <span>Exportar PDF</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition"
                  title="Imprimir formato de conciliación"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir</span>
                </button>
              </div>
            </div>

            {/* Documento Estilo Página 1 del PDF */}
            <div className="bg-white text-slate-900 rounded-2xl shadow-2xl p-6 sm:p-8 overflow-x-auto border border-slate-200">
              
              {/* Encabezado Institucional Página 1 */}
              <div className="border-b-2 border-slate-900 pb-4 mb-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                      Gerencia de Comercialización • Dirección de Importaciones y Operaciones
                    </div>
                    <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 uppercase mt-0.5">
                      {asociacion.name}
                    </h1>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-700">
                      Periodo de Descarga: <span className="text-blue-700 uppercase font-black">{periodoMes}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Unidad de Pagos, Conciliaciones y Aduanas - UPCA
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-center">
                  <h2 className="text-sm font-black uppercase text-slate-800 tracking-wide">
                    LIQUIDACIÓN
                  </h2>
                  <p className="text-[11px] text-slate-600 font-semibold italic">
                    (A LA FINALIZACIÓN DE LA PRESTACIÓN DEL SERVICIO DEL PERIODO {periodoMes.toUpperCase()} Y DESPUÉS DE REALIZADA LA CONCILIACIÓN)
                  </p>
                </div>
              </div>

              {/* Tabla de Conciliación Consolidada */}
              {loadingLiq ? (
                <div className="flex justify-center items-center py-20 text-slate-500">
                  <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-600 rounded-full animate-spin" />
                </div>
              ) : !liqData || liqData.grupos_empresa?.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                  No hay viajes registrados para las empresas afiliadas en el periodo <b>{periodoMes}</b>.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-blue-900 text-white text-[10px] uppercase font-bold text-center border border-blue-950">
                        <th className="py-2 px-1.5 border border-blue-950">LOTE</th>
                        <th className="py-2 px-2 border border-blue-950 text-left">Empresa Transporte</th>
                        <th className="py-2 px-2 border border-blue-950 text-left">Tramo</th>
                        <th className="py-2 px-1 border border-blue-950">Producto</th>
                        <th className="py-2 px-1.5 border border-blue-950">Placa</th>
                        <th className="py-2 px-1 border border-blue-950">Fecha Carga</th>
                        <th className="py-2 px-1 border border-blue-950">Fecha Recep.</th>
                        <th className="py-2 px-1.5 border border-blue-950">Vol. Despachado (L)</th>
                        <th className="py-2 px-1.5 border border-blue-950">Vol. Recepcionado (L)</th>
                        <th className="py-2 px-1 border border-blue-950">Merma Real (L)</th>
                        <th className="py-2 px-1 border border-blue-950">Merma Exced. (L)</th>
                        <th className="py-2 px-1 border border-blue-950">Precio Merma (Bs/L)</th>
                        <th className="py-2 px-1.5 border border-blue-950">Merma Descontar (Bs)</th>
                        <th className="py-2 px-1.5 border border-blue-950">Vol. Facturar (m³)</th>
                        <th className="py-2 px-1.5 border border-blue-950">Flete ($us/m³)</th>
                        <th className="py-2 px-2 border border-blue-950">Importe a Facturar (Bs)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liqData.grupos_empresa.map((grp: any) => (
                        <>
                          {/* Fila Encabezado de Empresa */}
                          <tr key={`header-${grp.empresa_id}`} className="bg-sky-100/80 font-bold text-sky-950">
                            <td colSpan={16} className="py-1.5 px-3 border border-slate-300">
                              EMPRESA: {grp.empresa_name}
                            </td>
                          </tr>

                          {/* Filas de Viajes */}
                          {grp.viajes.map((v: any, vIdx: number) => (
                            <tr
                              key={`viaje-${v.id}`}
                              className={`hover:bg-slate-50 border border-slate-300 ${
                                vIdx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                              }`}
                            >
                              <td className="py-1 px-1.5 text-center border border-slate-300 font-mono">{v.lote_codigo}</td>
                              <td className="py-1 px-2 border border-slate-300 text-slate-700 truncate max-w-[160px]">{grp.empresa_name}</td>
                              <td className="py-1 px-2 border border-slate-300 text-slate-700">{v.tramo}</td>
                              <td className="py-1 px-1 text-center font-bold border border-slate-300 text-blue-900">{v.producto}</td>
                              <td className="py-1 px-1.5 text-center font-mono font-bold border border-slate-300">{v.placa}</td>
                              <td className="py-1 px-1 text-center border border-slate-300 text-slate-600">{formatDate(v.fecha_carga)}</td>
                              <td className="py-1 px-1 text-center border border-slate-300 text-slate-600">{formatDate(v.fecha_descarga)}</td>
                              <td className="py-1 px-1.5 text-right font-mono border border-slate-300">{formatNumber(v.volumen_origen_litros, 0)}</td>
                              <td className="py-1 px-1.5 text-right font-mono font-bold border border-slate-300">{formatNumber(v.volumen_recepcionado_litros, 0)}</td>
                              <td className={`py-1 px-1 text-right font-mono border border-slate-300 ${v.merma_real_litros > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                                {formatNumber(v.merma_real_litros, 1)}
                              </td>
                              <td className={`py-1 px-1 text-right font-mono border border-slate-300 ${v.merma_excedente_litros > 0 ? "text-red-700 font-bold" : "text-slate-400"}`}>
                                {formatNumber(v.merma_excedente_litros, 1)}
                              </td>
                              <td className="py-1 px-1 text-right font-mono border border-slate-300">{formatNumber(v.precio_merma_litro_bs, 2)}</td>
                              <td className={`py-1 px-1.5 text-right font-mono border border-slate-300 ${v.merma_descontar_bs > 0 ? "text-red-600 font-bold" : ""}`}>
                                {formatNumber(v.merma_descontar_bs, 2)}
                              </td>
                              <td className="py-1 px-1.5 text-right font-mono border border-slate-300">{formatNumber(v.volumen_facturar_m3, 3)}</td>
                              <td className="py-1 px-1.5 text-right font-mono border border-slate-300">{formatNumber(v.tarifa_flete, 2)}</td>
                              <td className="py-1 px-2 text-right font-mono font-bold border border-slate-300 text-slate-900">
                                {formatNumber(v.flete_total_bs, 2)}
                              </td>
                            </tr>
                          ))}

                          {/* Subtotal de Empresa */}
                          <tr key={`subtotal-${grp.empresa_id}`} className="bg-slate-100 font-bold text-slate-900 border-t-2 border-b-2 border-slate-400">
                            <td colSpan={7} className="py-1.5 px-3 border border-slate-300 text-right">
                              Total {grp.empresa_name}:
                            </td>
                            <td className="py-1.5 px-1.5 text-right font-mono border border-slate-300">{formatNumber(grp.subtotal_despachado, 0)}</td>
                            <td className="py-1.5 px-1.5 text-right font-mono border border-slate-300">{formatNumber(grp.subtotal_recepcionado, 0)}</td>
                            <td className="py-1.5 px-1 text-right font-mono border border-slate-300">{formatNumber(grp.subtotal_merma_real, 1)}</td>
                            <td className="py-1.5 px-1 text-center border border-slate-300 text-slate-400">-</td>
                            <td className="py-1.5 px-1 text-center border border-slate-300 text-slate-400">-</td>
                            <td className="py-1.5 px-1.5 text-right font-mono text-red-700 border border-slate-300">{formatNumber(grp.subtotal_merma_descontar_bs, 2)}</td>
                            <td className="py-1.5 px-1.5 text-right font-mono border border-slate-300">{formatNumber(grp.subtotal_volumen_m3, 3)}</td>
                            <td className="py-1.5 px-1.5 text-center border border-slate-300 text-slate-400">-</td>
                            <td className="py-1.5 px-2 text-right font-mono text-blue-900 border border-slate-300">
                              {formatNumber(grp.subtotal_importe_bs, 2)}
                            </td>
                          </tr>
                        </>
                      ))}

                      {/* Total General de la Asociación (Idéntico a Pág 1) */}
                      {liqData.totales_generales && (
                        <tr className="bg-amber-100 font-black text-slate-950 border-t-4 border-double border-slate-900 text-xs">
                          <td colSpan={7} className="py-2.5 px-3 border border-slate-400 text-right uppercase tracking-wider">
                            TOTAL GENERAL ASOCIACIÓN:
                          </td>
                          <td className="py-2.5 px-1.5 text-right font-mono border border-slate-400">
                            {formatNumber(liqData.totales_generales.volumen_despachado_litros, 0)}
                          </td>
                          <td className="py-2.5 px-1.5 text-right font-mono border border-slate-400">
                            {formatNumber(liqData.totales_generales.volumen_recepcionado_litros, 0)}
                          </td>
                          <td className="py-2.5 px-1 text-right font-mono border border-slate-400">
                            {formatNumber(liqData.totales_generales.merma_real_litros, 1)}
                          </td>
                          <td className="py-2.5 px-1 text-center border border-slate-400 text-slate-500">-</td>
                          <td className="py-2.5 px-1 text-center border border-slate-400 text-slate-500">-</td>
                          <td className="py-2.5 px-1.5 text-right font-mono text-red-800 border border-slate-400">
                            {formatNumber(liqData.totales_generales.merma_descontar_facturar_bs, 2)}
                          </td>
                          <td className="py-2.5 px-1.5 text-right font-mono border border-slate-400">
                            {formatNumber(liqData.totales_generales.volumen_facturar_m3, 3)}
                          </td>
                          <td className="py-2.5 px-1.5 text-center border border-slate-400 text-slate-500">-</td>
                          <td className="py-2.5 px-2 text-right font-mono text-blue-950 border border-slate-400 text-sm">
                            {formatNumber(liqData.totales_generales.importe_facturar_bs, 2)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Cláusula Legal Oficial (Pie de Página del PDF) */}
              <div className="mt-8 pt-4 border-t border-slate-300 text-[10px] text-slate-600 leading-relaxed italic">
                <b>Nota Legal:</b> Conforme lo establece la Ley 843 en su Art. 4 y de acuerdo a la cláusula contractual de Facturación y Pago, el momento en que finalizará la ejecución o la prestación del Servicio se origina después de realizada la Conciliación (Acta de Conformidad por la Comisión de Recepción) y emitida la planilla de Liquidación.
              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  );
}
