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
  DollarSign,
  Filter
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
    <Suspense fallback={<div className="p-8 flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" /></div>}>
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
    const orig = parseFloat(formData.volumen_origen_litros?.toString() || "0") || 0;
    const rec = parseFloat(formData.volumen_recepcionado_litros?.toString() || "0") || 0;
    const tarifa = parseFloat(formData.tarifa_flete?.toString() || "0") || 0;
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
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      background: "#ffffff",
      color: "#0f172a"
    });

    if (result.isConfirmed) {
      try {
        await apiFetch(`/tenants/${schema}/viajes/${v.id}`, { method: "DELETE" });
        Swal.fire({
          icon: "success",
          title: "Viaje eliminado",
          background: "#ffffff",
          color: "#0f172a",
          timer: 1500,
          showConfirmButton: false
        });
        loadViajes();
      } catch (err: any) {
        Swal.fire({ icon: "error", title: "Error", text: err.message, background: "#ffffff", color: "#0f172a" });
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
        Swal.fire({
          icon: "success",
          title: "Viaje actualizado",
          background: "#ffffff",
          color: "#0f172a",
          timer: 1500,
          showConfirmButton: false
        });
      } else {
        await apiFetch(`/tenants/${schema}/viajes/`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
        Swal.fire({
          icon: "success",
          title: "Viaje registrado con cálculo automático",
          background: "#ffffff",
          color: "#0f172a",
          timer: 1500,
          showConfirmButton: false
        });
      }
      setShowModal(false);
      loadViajes();
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "Error al guardar", text: err.message, background: "#ffffff", color: "#0f172a" });
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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Navigation className="w-6 h-6" />
            </div>
            <span>Registro de Viajes y Despachos</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Control de fletes, volúmenes y deducción automática de mermas según contrato YPFB
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm shadow-blue-500/10 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Nuevo Viaje</span>
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Periodo */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="text-slate-500 font-medium">Mes:</span>
            <input
              type="month"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="bg-transparent text-slate-900 font-semibold focus:outline-none cursor-pointer text-xs"
            />
          </div>

          {/* Placa */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
            <Truck className="w-4 h-4 text-blue-600" />
            <span className="text-slate-500 font-medium">Placa:</span>
            <select
              value={placaFiltro}
              onChange={(e) => setPlacaFiltro(e.target.value)}
              className="bg-transparent text-slate-900 font-semibold focus:outline-none cursor-pointer text-xs"
            >
              <option value="">Todas las Placas</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.placa}>
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
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition"
          />
        </div>
      </div>

      {/* Tabla de Viajes */}
      {loading ? (
        <div className="flex justify-center items-center py-24">
          <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center max-w-md mx-auto shadow-sm">
          <Navigation className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 mb-1">No hay viajes registrados</h3>
          <p className="text-xs text-slate-500 mb-5">
            No se encontraron despachos para el periodo o filtros seleccionados.
          </p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition"
          >
            Registrar Viaje
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
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
              <tbody className="divide-y divide-slate-100">
                {filtered.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3 font-mono font-bold text-blue-600">{v.mic_dta || "-"}</td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">{v.placa}</td>
                    <td className="py-3 px-3 text-slate-700 truncate max-w-[170px]" title={v.tramo}>
                      {v.tramo}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        v.producto === "GASOLINA" 
                          ? "bg-amber-50 text-amber-700 border-amber-200" 
                          : v.producto === "DIESEL"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}>
                        {v.producto}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[11px] text-slate-500">
                      <div>C: {formatDate(v.fecha_carga)}</div>
                      <div>D: {formatDate(v.fecha_descarga)}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600">{formatNumber(v.volumen_origen_litros, 0)} L</td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900">{formatNumber(v.volumen_recepcionado_litros, 0)} L</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600">
                      {formatNumber(v.merma_real_litros, 1)} L
                    </td>
                    <td className={`py-3 px-3 text-right font-mono ${v.merma_excedente_litros > 0 ? "text-amber-600 font-bold" : "text-slate-400"}`}>
                      {formatNumber(v.merma_excedente_litros, 1)} L
                    </td>
                    <td className={`py-3 px-3 text-right font-mono ${v.merma_descontar_bs > 0 ? "text-red-600 font-bold" : "text-slate-400"}`}>
                      {formatCurrency(v.merma_descontar_bs)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600">
                      Bs. {formatNumber(v.tarifa_flete, 2)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600">
                      {formatCurrency(v.flete_total_bs)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        v.estado === "Liquidado"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}>
                        {v.estado}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditModal(v)}
                          className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition"
                          title="Editar Viaje"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(v)}
                          className="p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Navigation className="w-5 h-5 text-blue-600" />
                {editingViaje ? `Editar Viaje (${editingViaje.placa})` : "Registrar Nuevo Despacho / Flete"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              
              {/* Sección 1: Placa, MIC, Tramo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Placa de la Unidad *
                  </label>
                  <select
                    required
                    value={formData.placa}
                    onChange={(e) => setFormData({ ...formData, placa: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono font-semibold text-sm focus:outline-none focus:border-blue-600 uppercase"
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nº MIC / DTA
                  </label>
                  <input
                    type="text"
                    value={formData.mic_dta}
                    onChange={(e) => setFormData({ ...formData, mic_dta: e.target.value.toUpperCase() })}
                    placeholder="23BO051130T"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono text-sm focus:outline-none focus:border-blue-600 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Producto Transportado *
                  </label>
                  <select
                    value={formData.producto}
                    onChange={(e) => setFormData({ ...formData, producto: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-blue-600"
                  >
                    <option value="GASOLINA">GASOLINA (Tolerancia 0.25%)</option>
                    <option value="DIESEL">DIESEL OIL (Tolerancia 0.15%)</option>
                    <option value="IYA">INSUMOS Y ADITIVOS (IYA 0.20%)</option>
                    <option value="CRUDO">PETRÓLEO CRUDO (0.15%)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ruta / Tramo *
                </label>
                <input
                  type="text"
                  required
                  value={formData.tramo}
                  onChange={(e) => setFormData({ ...formData, tramo: e.target.value })}
                  placeholder="ARICA - TAMBO QUEMADO - LA PAZ"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-blue-600 uppercase"
                />
              </div>

              {/* Fechas y Periodo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fecha de Carga *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.fecha_carga}
                    onChange={(e) => setFormData({ ...formData, fecha_carga: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fecha de Descarga *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.fecha_descarga}
                    onChange={(e) => setFormData({ ...formData, fecha_descarga: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Periodo Mes (YYYY-MM) *
                  </label>
                  <input
                    type="month"
                    required
                    value={formData.periodo_mes}
                    onChange={(e) => setFormData({ ...formData, periodo_mes: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Volúmenes y Tarifa */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Volumen Origen (Litros) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={formData.volumen_origen_litros}
                    onChange={(e) => setFormData({ ...formData, volumen_origen_litros: parseFloat(e.target.value) || 0 })}
                    placeholder="33999"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono text-sm focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Volumen Recepción (Litros) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={formData.volumen_recepcionado_litros}
                    onChange={(e) => setFormData({ ...formData, volumen_recepcionado_litros: parseFloat(e.target.value) || 0 })}
                    placeholder="33900"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono text-sm focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tarifa Flete (Bs/m³) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.tarifa_flete}
                    onChange={(e) => setFormData({ ...formData, tarifa_flete: parseFloat(e.target.value) || 0 })}
                    placeholder="392.00"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono text-sm focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* CAJA DE CÁLCULO EN TIEMPO REAL */}
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 text-slate-800 space-y-2 mt-4">
                <div className="flex items-center justify-between text-xs font-bold text-blue-900 border-b border-blue-200/60 pb-2">
                  <span className="flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-blue-600" />
                    Cálculo Automático de Mermas y Flete
                  </span>
                  <span className="text-blue-700">Tolerancia: {liveCalc.tolerancia_pct}%</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs">
                  <div>
                    <span className="text-slate-500 text-[11px] block">Merma Real:</span>
                    <span className="font-mono font-bold text-slate-800">{liveCalc.merma_real} Lts</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Tolerable YPFB:</span>
                    <span className="font-mono text-slate-800">{liveCalc.merma_tolerable} Lts</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Excedente a Descontar:</span>
                    <span className={`font-mono font-bold ${liveCalc.merma_excedente > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                      {liveCalc.merma_excedente} Lts
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Descuento Merma:</span>
                    <span className={`font-mono font-bold ${liveCalc.merma_descontar_bs > 0 ? "text-red-600" : "text-slate-600"}`}>
                      {formatCurrency(liveCalc.merma_descontar_bs)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-blue-200/60 text-xs font-bold">
                  <span className="text-slate-600">Flete Bruto Calculado:</span>
                  <span className="text-base font-black text-emerald-600 font-mono">
                    {formatCurrency(liveCalc.flete_total_bs)}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition"
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
