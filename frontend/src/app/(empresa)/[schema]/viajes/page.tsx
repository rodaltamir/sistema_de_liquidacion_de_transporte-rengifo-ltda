"use client";

import { Suspense, useState, useEffect, use } from "react";
import { useSearchParams } from "next/navigation";
import { 
  Navigation, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Calendar, 
  Fuel, 
  Truck, 
  Calculator, 
  FileSpreadsheet, 
  AlertTriangle, 
  CheckCircle2, 
  DollarSign
} from "lucide-react";
import Swal from "sweetalert2";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatNumber, formatLitros, formatM3, formatDate } from "@/lib/format";

interface Viaje {
  id: number;
  mic_dta: string | null;
  lote_codigo: string | null;
  unidad_id: number | null;
  placa: string;
  tramo: string;
  cliente: string;
  producto: string;
  fecha_carga: string;
  fecha_descarga: string;
  periodo_mes: string;
  volumen_origen_litros: number;
  volumen_recepcionado_litros: number;
  merma_real_litros: number;
  tolerancia_pct: number;
  merma_tolerable_litros: number;
  merma_excedente_litros: number;
  precio_merma_litro_bs: number;
  merma_descontar_bs: number;
  tarifa_flete: number;
  tipo_tarifa: string;
  flete_total_bs: number;
  estado: string;
  liquidacion_id: number | null;
  observaciones: string | null;
}

export default function ViajesPage({ params }: { params: Promise<{ schema: string }> }) {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center"><div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" /></div>}>
      <ViajesContent params={params} />
    </Suspense>
  );
}

function ViajesContent({ params }: { params: Promise<{ schema: string }> }) {
  const resolvedParams = use(params);
  const schema = resolvedParams.schema;
  const searchParams = useSearchParams();

  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [unidades, setUnidades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [periodo, setPeriodo] = useState("");
  const [placaFiltro, setPlacaFiltro] = useState("");
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingViaje, setEditingViaje] = useState<Viaje | null>(null);

  const [formData, setFormData] = useState({
    mic_dta: "",
    lote_codigo: "",
    placa: "",
    tramo: "ARICA - TAMBO QUEMADO - LA PAZ",
    cliente: "YPFB",
    producto: "GASOLINA",
    fecha_carga: new Date().toISOString().split("T")[0],
    fecha_descarga: new Date().toISOString().split("T")[0],
    periodo_mes: "",
    volumen_origen_litros: 34000,
    volumen_recepcionado_litros: 33900,
    tarifa_flete: 392.00,
    tipo_tarifa: "BS_POR_M3",
    precio_merma_litro_bs: 7.45,
    observaciones: ""
  });

  // Cálculo en vivo dentro del modal
  const [liveCalc, setLiveCalc] = useState({
    merma_real: 0,
    tolerancia_pct: 0.25,
    merma_tolerable: 0,
    merma_excedente: 0,
    merma_descontar_bs: 0,
    flete_total_bs: 0
  });

  useEffect(() => {
    loadInitialData();
  }, [schema]);

  useEffect(() => {
    loadViajes();
  }, [schema, periodo, placaFiltro]);

  // Recalcular en vivo cuando cambian valores en el modal
  useEffect(() => {
    const orig = parseFloat(formData.volumen_origen_litros.toString()) || 0;
    const rec = parseFloat(formData.volumen_recepcionado_litros.toString()) || 0;
    const tarifa = parseFloat(formData.tarifa_flete.toString()) || 0;
    const precioMerma = parseFloat(formData.precio_merma_litro_bs?.toString() || "7.45") || 7.45;

    let tolPct = 0.15;
    if (formData.producto === "GASOLINA") tolPct = 0.25;
    else if (formData.producto === "IYA") tolPct = 0.20;

    const mReal = Math.round((orig - rec) * 10) / 10;
    const mTolerable = Math.round(orig * (tolPct / 100));
    const mExcedente = mReal > mTolerable ? Math.round((mReal - mTolerable) * 10) / 10 : 0;
    const mDescBs = Math.round(mExcedente * precioMerma * 100) / 100;

    let fleteBs = 0;
    if (formData.tipo_tarifa === "BS_POR_M3") {
      fleteBs = Math.round((rec / 1000) * tarifa * 100) / 100;
    } else {
      fleteBs = tarifa;
    }

    setLiveCalc({
      merma_real: mReal,
      tolerancia_pct: tolPct,
      merma_tolerable: mTolerable,
      merma_excedente: mExcedente,
      merma_descontar_bs: mDescBs,
      flete_total_bs: fleteBs
    });
  }, [formData.volumen_origen_litros, formData.volumen_recepcionado_litros, formData.producto, formData.tarifa_flete, formData.tipo_tarifa, formData.precio_merma_litro_bs]);

  const loadInitialData = async () => {
    try {
      const uData = await apiFetch(`/tenants/${schema}/unidades/`);
      setUnidades(uData);

      if (searchParams.get("action") === "nuevo") {
        openCreateModal();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadViajes = async () => {
    setLoading(true);
    try {
      let url = `/tenants/${schema}/viajes/?`;
      if (periodo) url += `periodo_mes=${periodo}&`;
      if (placaFiltro) url += `placa=${placaFiltro}&`;

      const data = await apiFetch(url);
      setViajes(data);

      if (!periodo && data.length > 0) {
        setPeriodo(data[0].periodo_mes);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingViaje(null);
    const defMes = periodo || new Date().toISOString().slice(0, 7);
    setFormData({
      mic_dta: "",
      lote_codigo: "",
      placa: unidades.length > 0 ? unidades[0].placa : "",
      tramo: "ARICA - TAMBO QUEMADO - LA PAZ",
      cliente: "YPFB",
      producto: "GASOLINA",
      fecha_carga: new Date().toISOString().split("T")[0],
      fecha_descarga: new Date().toISOString().split("T")[0],
      periodo_mes: defMes,
      volumen_origen_litros: 34000,
      volumen_recepcionado_litros: 33900,
      tarifa_flete: 392.00,
      tipo_tarifa: "BS_POR_M3",
      precio_merma_litro_bs: 7.45,
      observaciones: ""
    });
    setShowModal(true);
  };

  const openEditModal = (v: Viaje) => {
    setEditingViaje(v);
    setFormData({
      mic_dta: v.mic_dta || "",
      lote_codigo: v.lote_codigo || "",
      placa: v.placa,
      tramo: v.tramo,
      cliente: v.cliente,
      producto: v.producto,
      fecha_carga: v.fecha_carga,
      fecha_descarga: v.fecha_descarga,
      periodo_mes: v.periodo_mes,
      volumen_origen_litros: v.volumen_origen_litros,
      volumen_recepcionado_litros: v.volumen_recepcionado_litros,
      tarifa_flete: v.tarifa_flete,
      tipo_tarifa: v.tipo_tarifa,
      precio_merma_litro_bs: v.precio_merma_litro_bs || 7.45,
      observaciones: v.observaciones || ""
    });
    setShowModal(true);
  };

  const handleDelete = async (v: Viaje) => {
    const result = await Swal.fire({
      title: `¿Eliminar viaje ${v.mic_dta || v.placa}?`,
      text: "Se recalcularán los totales del periodo.",
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
        await apiFetch(`/tenants/${schema}/viajes/${v.id}`, { method: "DELETE" });
        Swal.fire({ icon: "success", title: "Viaje eliminado", background: "#0f172a", color: "#fff", timer: 1500, showConfirmButton: false });
        loadViajes();
      } catch (err: any) {
        Swal.fire({ icon: "error", title: "Error", text: err.message, background: "#0f172a", color: "#fff" });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        volumen_origen_litros: parseFloat(formData.volumen_origen_litros.toString()),
        volumen_recepcionado_litros: parseFloat(formData.volumen_recepcionado_litros.toString()),
        tarifa_flete: parseFloat(formData.tarifa_flete.toString()),
        precio_merma_litro_bs: parseFloat(formData.precio_merma_litro_bs?.toString() || "7.45")
      };

      if (editingViaje) {
        await apiFetch(`/tenants/${schema}/viajes/${editingViaje.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        Swal.fire({ icon: "success", title: "Viaje actualizado", background: "#0f172a", color: "#fff", timer: 1500, showConfirmButton: false });
      } else {
        await apiFetch(`/tenants/${schema}/viajes/`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
        Swal.fire({ icon: "success", title: "Viaje registrado con cálculo automático", background: "#0f172a", color: "#fff", timer: 1500, showConfirmButton: false });
      }
      setShowModal(false);
      loadViajes();
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "Error al guardar", text: err.message, background: "#0f172a", color: "#fff" });
    }
  };

  const filtered = viajes.filter((v) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchPlaca = v.placa.toLowerCase().includes(q);
      const matchMic = v.mic_dta ? v.mic_dta.toLowerCase().includes(q) : false;
      const matchTramo = v.tramo.toLowerCase().includes(q);
      return matchPlaca || matchMic || matchTramo;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Navigation className="w-7 h-7 text-cyan-400" />
            <span>Registro de Viajes y Despachos de Carga</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Fletes, volúmenes de origen y recepción con deducción automática de mermas según contrato YPFB
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Nuevo Viaje</span>
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Periodo */}
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
            <select
              value={placaFiltro}
              onChange={(e) => setPlacaFiltro(e.target.value)}
              className="bg-transparent text-white font-bold focus:outline-none cursor-pointer text-xs"
            >
              <option value="" className="bg-slate-800">Todas las Placas</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.placa} className="bg-slate-800">
                  {u.placa}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Buscador */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por MIC, tramo o placa..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Tabla de Viajes */}
      {loading ? (
        <div className="flex justify-center items-center py-24">
          <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center max-w-md mx-auto">
          <Navigation className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">No hay viajes registrados</h3>
          <p className="text-sm text-slate-400 mb-6">
            No se encontraron despachos para el periodo o filtros seleccionados.
          </p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition"
          >
            Registrar Viaje
          </button>
        </div>
      ) : (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-800/80 border-b border-slate-700/80 text-slate-300 font-bold uppercase text-[10px]">
                  <th className="py-3 px-3">MIC/DTA</th>
                  <th className="py-3 px-3">Placa</th>
                  <th className="py-3 px-3">Tramo</th>
                  <th className="py-3 px-3">Prod.</th>
                  <th className="py-3 px-3">Fechas</th>
                  <th className="py-3 px-3 text-right">Vol. Origen</th>
                  <th className="py-3 px-3 text-right">Vol. Recep.</th>
                  <th className="py-3 px-3 text-right">Merma Real</th>
                  <th className="py-3 px-3 text-right">Excedente</th>
                  <th className="py-3 px-3 text-right">Desc. Merma</th>
                  <th className="py-3 px-3 text-right">Tarifa</th>
                  <th className="py-3 px-3 text-right">Flete Total</th>
                  <th className="py-3 px-3 text-center">Estado</th>
                  <th className="py-3 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3 font-mono font-bold text-cyan-400">{v.mic_dta || "-"}</td>
                    <td className="py-3 px-3 font-mono font-black text-white">{v.placa}</td>
                    <td className="py-3 px-3 text-slate-300 truncate max-w-[170px]" title={v.tramo}>
                      {v.tramo}
                    </td>
                    <td className="py-3 px-3 font-bold text-white">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        v.producto === "GASOLINA" ? "bg-amber-950 text-amber-300 border border-amber-800" : "bg-blue-950 text-blue-300 border border-blue-800"
                      }`}>
                        {v.producto}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[11px] text-slate-400">
                      <div>Carga: {formatDate(v.fecha_carga)}</div>
                      <div>Desc: {formatDate(v.fecha_descarga)}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-300">{formatNumber(v.volumen_origen_litros, 0)} L</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-white">{formatNumber(v.volumen_recepcionado_litros, 0)} L</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-300">
                      {formatNumber(v.merma_real_litros, 1)} L
                    </td>
                    <td className={`py-3 px-3 text-right font-mono ${v.merma_excedente_litros > 0 ? "text-amber-400 font-bold" : "text-slate-500"}`}>
                      {formatNumber(v.merma_excedente_litros, 1)} L
                    </td>
                    <td className={`py-3 px-3 text-right font-mono ${v.merma_descontar_bs > 0 ? "text-red-400 font-bold" : "text-slate-500"}`}>
                      {formatCurrency(v.merma_descontar_bs)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-300">
                      Bs. {formatNumber(v.tarifa_flete, 2)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-emerald-400">
                      {formatCurrency(v.flete_total_bs)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        v.estado === "Liquidado"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                          : "bg-amber-950 text-amber-400 border border-amber-800"
                      }`}>
                        {v.estado}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEditModal(v)}
                          className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-cyan-300 transition"
                          title="Editar Viaje"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(v)}
                          className="p-1 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition"
                          title="Eliminar Viaje"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Registrar / Editar Viaje */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Navigation className="w-5 h-5 text-cyan-400" />
                {editingViaje ? `Editar Viaje (${editingViaje.placa})` : "Registrar Nuevo Despacho / Flete"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              
              {/* Sección 1: Placa, MIC, Tramo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Placa de la Unidad *
                  </label>
                  <select
                    required
                    value={formData.placa}
                    onChange={(e) => setFormData({ ...formData, placa: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono font-bold text-sm focus:outline-none focus:border-cyan-500 uppercase"
                  >
                    <option value="">-- Seleccionar Placa --</option>
                    {unidades.map((u) => (
                      <option key={u.id} value={u.placa}>
                        {u.placa} ({u.marca || "Camión"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Nº MIC / DTA
                  </label>
                  <input
                    type="text"
                    value={formData.mic_dta}
                    onChange={(e) => setFormData({ ...formData, mic_dta: e.target.value.toUpperCase() })}
                    placeholder="23BO051130T"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-cyan-500 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Producto Transportado *
                  </label>
                  <select
                    value={formData.producto}
                    onChange={(e) => setFormData({ ...formData, producto: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                  >
                    <option value="GASOLINA">GASOLINA (Tolerancia 0.25%)</option>
                    <option value="DIESEL">DIESEL OIL (Tolerancia 0.15%)</option>
                    <option value="IYA">INSUMOS Y ADITIVOS (IYA 0.20%)</option>
                    <option value="CRUDO">PETRÓLEO CRUDO (0.15%)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                  Ruta / Tramo *
                </label>
                <input
                  type="text"
                  required
                  value={formData.tramo}
                  onChange={(e) => setFormData({ ...formData, tramo: e.target.value })}
                  placeholder="ARICA - TAMBO QUEMADO - LA PAZ"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500 uppercase"
                />
              </div>

              {/* Fechas y Periodo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Fecha de Carga *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.fecha_carga}
                    onChange={(e) => setFormData({ ...formData, fecha_carga: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Fecha de Descarga *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.fecha_descarga}
                    onChange={(e) => setFormData({ ...formData, fecha_descarga: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Periodo Mes (YYYY-MM) *
                  </label>
                  <input
                    type="month"
                    required
                    value={formData.periodo_mes}
                    onChange={(e) => setFormData({ ...formData, periodo_mes: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Volúmenes y Tarifa */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Volumen Origen (Litros) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={formData.volumen_origen_litros}
                    onChange={(e) => setFormData({ ...formData, volumen_origen_litros: parseFloat(e.target.value) || 0 })}
                    placeholder="33999"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Volumen Recepción (Litros) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={formData.volumen_recepcionado_litros}
                    onChange={(e) => setFormData({ ...formData, volumen_recepcionado_litros: parseFloat(e.target.value) || 0 })}
                    placeholder="33900"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Tarifa Flete (Bs/m³) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.tarifa_flete}
                    onChange={(e) => setFormData({ ...formData, tarifa_flete: parseFloat(e.target.value) || 0 })}
                    placeholder="392.00"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* CAJA DE CÁLCULO EN TIEMPO REAL */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/60 to-slate-900 border border-cyan-500/30 shadow-inner space-y-2 mt-4">
                <div className="flex items-center justify-between text-xs font-bold text-cyan-300 border-b border-cyan-900/60 pb-2">
                  <span className="flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-cyan-400" />
                    Cálculo Automático de Mermas y Flete
                  </span>
                  <span>Tolerancia: {liveCalc.tolerancia_pct}%</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Merma Real:</span>
                    <span className="font-mono font-bold text-slate-200">{liveCalc.merma_real} Lts</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Tolerable YPFB:</span>
                    <span className="font-mono text-slate-300">{liveCalc.merma_tolerable} Lts</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Excedente a Descontar:</span>
                    <span className={`font-mono font-bold ${liveCalc.merma_excedente > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                      {liveCalc.merma_excedente} Lts
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Descuento Merma:</span>
                    <span className={`font-mono font-bold ${liveCalc.merma_descontar_bs > 0 ? "text-red-400" : "text-slate-400"}`}>
                      {formatCurrency(liveCalc.merma_descontar_bs)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs font-bold">
                  <span className="text-slate-300">Flete Bruto Calculado:</span>
                  <span className="text-base font-black text-emerald-400 font-mono">
                    {formatCurrency(liveCalc.flete_total_bs)}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-bold shadow-lg shadow-cyan-500/20 transition"
                >
                  {editingViaje ? "Guardar Cambios" : "Guardar Flete"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
