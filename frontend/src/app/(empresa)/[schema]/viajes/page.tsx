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
  FileSpreadsheet, 
  AlertTriangle, 
  CheckCircle2, 
  DollarSign,
  Copy,
  Upload,
  Download,
  X,
  FileCheck,
  Info
} from "lucide-react";
import Swal from "sweetalert2";
import { apiFetch, getApiUrl } from "@/lib/api";
import { formatCurrency, formatNumber, formatDate } from "@/lib/format";

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

  // Filtros
  const [periodo, setPeriodo] = useState("");
  const [placaFiltro, setPlacaFiltro] = useState("");
  const [productoFiltro, setProductoFiltro] = useState("TODOS");
  const [search, setSearch] = useState("");

  // Modales
  const [showModal, setShowModal] = useState(false);
  const [editingViaje, setEditingViaje] = useState<Viaje | null>(null);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  // Formulario de viaje
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
      lote_codigo: "1",
      placa: unidades.length > 0 ? unidades[0].placa : "",
      tramo: "ARICA - TAMBO QUEMADO - LA PAZ",
      cliente: "YPFB",
      producto: "GASOLINA",
      fecha_carga: new Date().toISOString().split("T")[0],
      fecha_descarga: new Date().toISOString().split("T")[0],
      periodo_mes: defMes,
      volumen_origen_litros: 34000,
      volumen_recepcionado_litros: 33920,
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
      lote_codigo: v.lote_codigo || "1",
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

  const handleDuplicate = (v: Viaje) => {
    setEditingViaje(null); // Es un registro nuevo
    const today = new Date().toISOString().split("T")[0];
    setFormData({
      mic_dta: "", // Dejar en blanco para que ingrese el nuevo MIC
      lote_codigo: v.lote_codigo || "1",
      placa: v.placa,
      tramo: v.tramo,
      cliente: v.cliente,
      producto: v.producto,
      fecha_carga: today,
      fecha_descarga: today,
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
      text: "Esta acción no se puede deshacer.",
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
          timer: 1200,
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
          timer: 1200,
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
          timer: 1400,
          showConfirmButton: false
        });
      }
      setShowModal(false);
      loadViajes();
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "Error al guardar", text: err.message, background: "#ffffff", color: "#0f172a" });
    }
  };

  // Descarga de Plantilla Excel
  const downloadTemplate = async () => {
    try {
      const blob = await apiFetch(`/tenants/${schema}/viajes/plantilla-excel`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Plantilla_Carga_Viajes_${schema}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al descargar plantilla",
        text: err.message,
        background: "#ffffff",
        color: "#0f172a"
      });
    }
  };

  // Importación Masiva Excel
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;

    setImporting(true);
    try {
      const formPayload = new FormData();
      formPayload.append("file", importFile);

      const res = await apiFetch(`/tenants/${schema}/viajes/importar-excel`, {
        method: "POST",
        body: formPayload
      });

      setShowImportModal(false);
      setImportFile(null);

      Swal.fire({
        icon: "success",
        title: "¡Importación Exitosa!",
        html: `<b>${res.total_importados}</b> viajes importados y calculados con éxito.<br/>` + 
              (res.periodos_detectados?.length ? `<span class="text-xs text-slate-500">Periodos: ${res.periodos_detectados.join(", ")}</span>` : ""),
        background: "#ffffff",
        color: "#0f172a"
      });

      if (res.periodos_detectados && res.periodos_detectados.length > 0) {
        setPeriodo(res.periodos_detectados[0]);
      }
      loadViajes();
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al importar Excel",
        text: err.message,
        background: "#ffffff",
        color: "#0f172a"
      });
    } finally {
      setImporting(false);
    }
  };

  // Filtrado de viajes
  const filtered = viajes.filter((v) => {
    if (productoFiltro !== "TODOS" && v.producto !== productoFiltro) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchPlaca = v.placa.toLowerCase().includes(q);
      const matchMic = v.mic_dta ? v.mic_dta.toLowerCase().includes(q) : false;
      const matchTramo = v.tramo.toLowerCase().includes(q);
      const matchCliente = v.cliente.toLowerCase().includes(q);
      return matchPlaca || matchMic || matchTramo || matchCliente;
    }
    return true;
  });

  // Métricas Sumatorias de los viajes visibles
  const totalDespachado = filtered.reduce((acc, v) => acc + (v.volumen_origen_litros || 0), 0);
  const totalRecepcionado = filtered.reduce((acc, v) => acc + (v.volumen_recepcionado_litros || 0), 0);
  const totalMermaReal = filtered.reduce((acc, v) => acc + (v.merma_real_litros || 0), 0);
  const totalDescMermaBs = filtered.reduce((acc, v) => acc + (v.merma_descontar_bs || 0), 0);
  const totalFleteBs = filtered.reduce((acc, v) => acc + (v.flete_total_bs || 0), 0);

  return (
    <div className="space-y-6">
      
      {/* Encabezado y Acciones Principales */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Navigation className="w-6 h-6" />
            </div>
            <span>Registro y Control de Viajes</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Fletes, control de volúmenes en destino y cálculo automático de mermas técnicas YPFB
          </p>
        </div>

        {/* Acciones: Nuevo, Plantilla, Importar */}
        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition"
            title="Descargar plantilla oficial de Excel para importar viajes"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Descargar Plantilla Excel</span>
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition"
            title="Subir archivo Excel con lista de viajes"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importar desde Excel</span>
          </button>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm shadow-blue-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Viaje</span>
          </button>
        </div>
      </div>

      {/* Barra de Métricas Sumatorias (KPIs en vivo) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Viajes Visibles</span>
          <span className="text-xl font-bold text-slate-900">{filtered.length}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Despachos filtrados</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Vol. Despachado</span>
          <span className="text-xl font-bold text-slate-900 font-mono">{formatNumber(totalDespachado, 0)} <span className="text-xs font-normal text-slate-500">L</span></span>
          <span className="text-[10px] text-slate-400 block mt-0.5">{(totalDespachado / 1000).toFixed(2)} m³</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Vol. Recepcionado</span>
          <span className="text-xl font-bold text-slate-900 font-mono">{formatNumber(totalRecepcionado, 0)} <span className="text-xs font-normal text-slate-500">L</span></span>
          <span className="text-[10px] text-slate-400 block mt-0.5">{(totalRecepcionado / 1000).toFixed(2)} m³ facturables</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Desc. Merma Total</span>
          <span className="text-xl font-bold text-rose-600 font-mono">{formatCurrency(totalDescMermaBs)}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Merma real: {formatNumber(totalMermaReal, 1)} L</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Flete Bruto Total</span>
          <span className="text-xl font-bold text-emerald-600 font-mono">{formatCurrency(totalFleteBs)}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Antes de deducciones</span>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5 shadow-2xs">
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Periodo */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
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
            <Truck className="w-3.5 h-3.5 text-blue-600" />
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

          {/* Filtro de Producto */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            {["TODOS", "GASOLINA", "DIESEL", "IYA"].map((p) => (
              <button
                key={p}
                onClick={() => setProductoFiltro(p)}
                className={`px-2.5 py-1 rounded-md font-semibold transition text-[11px] ${
                  productoFiltro === p
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Buscador */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por MIC, tramo o cliente..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition"
          />
        </div>

      </div>

      {/* Tabla de Viajes */}
      {loading ? (
        <div className="flex justify-center items-center py-24">
          <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-md mx-auto shadow-2xs">
          <Navigation className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 mb-1">No hay viajes registrados</h3>
          <p className="text-xs text-slate-500 mb-5">
            Puedes registrar un viaje individual o importar una lista completa desde un archivo Excel.
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={openCreateModal}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs"
            >
              Registrar Manualmente
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Importar Excel</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <th className="py-3 px-3">MIC/DTA</th>
                  <th className="py-3 px-3">Placa</th>
                  <th className="py-3 px-3">Tramo</th>
                  <th className="py-3 px-3">Producto</th>
                  <th className="py-3 px-3">Fechas</th>
                  <th className="py-3 px-3 text-right">Vol. Origen</th>
                  <th className="py-3 px-3 text-right">Vol. Recep.</th>
                  <th className="py-3 px-3 text-right">Merma Real</th>
                  <th className="py-3 px-3 text-right">Merma Exc.</th>
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
                          ? "bg-amber-50 text-amber-800 border-amber-200" 
                          : v.producto === "DIESEL"
                          ? "bg-blue-50 text-blue-800 border-blue-200"
                          : "bg-purple-50 text-purple-800 border-purple-200"
                      }`}>
                        {v.producto}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[11px] text-slate-500 whitespace-nowrap">
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
                    <td className={`py-3 px-3 text-right font-mono ${v.merma_descontar_bs > 0 ? "text-rose-600 font-bold" : "text-slate-400"}`}>
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
                          onClick={() => handleDuplicate(v)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition"
                          title="Duplicar / Clonar Viaje (mismo camión y ruta)"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(v)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition"
                          title="Editar Viaje"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(v)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
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

      {/* Modal Importar Masivamente desde Excel */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Importar Viajes (Excel)</h3>
                  <p className="text-[11px] text-slate-500">Carga masiva de despachos y cálculo en bloque</p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-4">
              <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-blue-950">
                  <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span>¿No tienes la plantilla oficial?</span>
                </div>
                <p className="text-[11px] text-blue-800">
                  Descárgala antes para completar las columnas de MIC/DTA, Placas, Fechas y Volúmenes.
                </p>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 underline"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Plantilla Oficial (.xlsx)</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Selecciona el archivo Excel (.xlsx) *
                </label>
                <input
                  type="file"
                  required
                  accept=".xlsx, .xlsm, .xltx"
                  onChange={(e) => setImportFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border border-slate-300 rounded-xl p-1.5 bg-slate-50"
                />
                {importFile && (
                  <p className="text-[11px] text-emerald-600 font-semibold mt-1.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Archivo listo: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)</span>
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!importFile || importing}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                >
                  {importing ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Procesar e Importar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Registrar / Editar Viaje Manual */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingViaje ? "Editar Despacho / Viaje" : "Registrar Nuevo Despacho"}
                </h3>
                <p className="text-xs text-slate-500">
                  Cálculo automático de mermas técnicas (0.15% Diésel, 0.25% Gasolina, 0.20% IYA)
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">MIC/DTA Nº</label>
                  <input
                    type="text"
                    value={formData.mic_dta}
                    onChange={(e) => setFormData({ ...formData, mic_dta: e.target.value.toUpperCase() })}
                    placeholder="ej. 23BO051130T"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono uppercase focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Placa *</label>
                  <input
                    type="text"
                    required
                    value={formData.placa}
                    onChange={(e) => setFormData({ ...formData, placa: e.target.value.toUpperCase() })}
                    placeholder="ej. 4412-DPC"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Lote</label>
                  <input
                    type="text"
                    value={formData.lote_codigo}
                    onChange={(e) => setFormData({ ...formData, lote_codigo: e.target.value })}
                    placeholder="ej. 1"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tramo de Transporte *</label>
                <input
                  type="text"
                  required
                  value={formData.tramo}
                  onChange={(e) => setFormData({ ...formData, tramo: e.target.value.toUpperCase() })}
                  placeholder="ej. ARICA - TAMBO QUEMADO - LA PAZ"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs uppercase focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cliente *</label>
                  <input
                    type="text"
                    required
                    value={formData.cliente}
                    onChange={(e) => setFormData({ ...formData, cliente: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs uppercase focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Producto *</label>
                  <select
                    value={formData.producto}
                    onChange={(e) => setFormData({ ...formData, producto: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
                  >
                    <option value="GASOLINA">GASOLINA (Tol. 0.25%)</option>
                    <option value="DIESEL">DIÉSEL (Tol. 0.15%)</option>
                    <option value="IYA">INSUMOS Y ADITIVOS (Tol. 0.20%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Periodo Mes *</label>
                  <input
                    type="month"
                    required
                    value={formData.periodo_mes}
                    onChange={(e) => setFormData({ ...formData, periodo_mes: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha de Carga *</label>
                  <input
                    type="date"
                    required
                    value={formData.fecha_carga}
                    onChange={(e) => setFormData({ ...formData, fecha_carga: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha de Descarga *</label>
                  <input
                    type="date"
                    required
                    value={formData.fecha_descarga}
                    onChange={(e) => setFormData({ ...formData, fecha_descarga: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Volumen Origen (Litros) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.volumen_origen_litros}
                    onChange={(e) => setFormData({ ...formData, volumen_origen_litros: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Volumen Recepcionado (Litros) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.volumen_recepcionado_litros}
                    onChange={(e) => setFormData({ ...formData, volumen_recepcionado_litros: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tarifa Flete (Bs/m³) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.tarifa_flete}
                    onChange={(e) => setFormData({ ...formData, tarifa_flete: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo Tarifa</label>
                  <select
                    value={formData.tipo_tarifa}
                    onChange={(e) => setFormData({ ...formData, tipo_tarifa: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
                  >
                    <option value="BS_POR_M3">Bs. por m³</option>
                    <option value="USD_POR_M3">USD por m³</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Precio Merma (Bs/L)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.precio_merma_litro_bs}
                    onChange={(e) => setFormData({ ...formData, precio_merma_litro_bs: parseFloat(e.target.value) || 7.45 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Previsualización en Vivo de Cálculos */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] block mb-1">
                  Cálculos Oficiales en Tiempo Real:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Merma Real:</span>
                    <span className="font-mono font-bold text-slate-800">{liveCalc.merma_real} L</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Tolerable ({liveCalc.tolerancia_pct}%):</span>
                    <span className="font-mono font-bold text-slate-800">{liveCalc.merma_tolerable} L</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Merma a Descontar:</span>
                    <span className={`font-mono font-bold ${liveCalc.merma_descontar_bs > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {formatCurrency(liveCalc.merma_descontar_bs)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Flete Bruto Estimado:</span>
                    <span className="font-mono font-bold text-emerald-700">
                      {formatCurrency(liveCalc.flete_total_bs)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
                >
                  {editingViaje ? "Actualizar Despacho" : "Guardar Despacho"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
