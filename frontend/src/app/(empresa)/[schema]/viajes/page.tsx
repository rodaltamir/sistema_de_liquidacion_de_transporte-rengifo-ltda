"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useParams } from "next/navigation";
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
  Info,
  Scale
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

export default function ViajesPage() {
  return (
    <Suspense fallback={
      <div className="p-8 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
        <span className="text-slate-400 text-xs font-semibold tracking-wider uppercase">Cargando Viajes...</span>
      </div>
    }>
      <ViajesContent />
    </Suspense>
  );
}

function ViajesContent() {
  const routeParams = useParams();
  const schema = (routeParams?.schema as string) || "";
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

  // Si viene acción de URL para abrir modal de nuevo viaje
  useEffect(() => {
    if (searchParams.get("action") === "nuevo" && !loading) {
      openCreateModal();
    }
  }, [searchParams, loading]);

  // Recálculo dinámico en el formulario modal
  useEffect(() => {
    const vOri = Number(formData.volumen_origen_litros) || 0;
    const vRec = Number(formData.volumen_recepcionado_litros) || 0;
    const mReal = Math.max(0, vOri - vRec);

    let tol = 0.25;
    if (formData.producto.toUpperCase().includes("DIESEL") || formData.producto.toUpperCase().includes("DIÉSEL")) {
      tol = 0.15;
    } else if (formData.producto.toUpperCase().includes("IYA") || formData.producto.toUpperCase().includes("INSUMOS")) {
      tol = 0.20;
    }

    const mTol = (vOri * tol) / 100.0;
    const mExc = Math.max(0, mReal - mTol);
    const mDescBs = mExc * (Number(formData.precio_merma_litro_bs) || 7.45);

    let fleteBs = 0;
    const volM3 = vRec / 1000.0;
    if (formData.tipo_tarifa === "BS_POR_M3") {
      fleteBs = volM3 * (Number(formData.tarifa_flete) || 0);
    } else {
      fleteBs = volM3 * (Number(formData.tarifa_flete) || 0) * 6.96;
    }

    setLiveCalc({
      merma_real: Math.round(mReal * 100) / 100,
      tolerancia_pct: tol,
      merma_tolerable: Math.round(mTol * 100) / 100,
      merma_excedente: Math.round(mExc * 100) / 100,
      merma_descontar_bs: Math.round(mDescBs * 100) / 100,
      flete_total_bs: Math.round(fleteBs * 100) / 100
    });
  }, [
    formData.volumen_origen_litros,
    formData.volumen_recepcionado_litros,
    formData.producto,
    formData.tarifa_flete,
    formData.tipo_tarifa,
    formData.precio_merma_litro_bs
  ]);

  const loadInitialData = async () => {
    try {
      const uData = await apiFetch(`/tenants/${schema}/unidades/`);
      setUnidades(uData);
    } catch (err) {
      console.error(err);
    }
  };

  const loadViajes = async () => {
    setLoading(true);
    try {
      let query = "";
      const params: string[] = [];
      if (periodo) params.push(`periodo_mes=${periodo}`);
      if (placaFiltro) params.push(`placa=${placaFiltro}`);
      if (params.length > 0) query = `?${params.join("&")}`;

      const data = await apiFetch(`/tenants/${schema}/viajes/${query}`);
      setViajes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingViaje(null);
    const defMes = periodo || new Date().toISOString().slice(0, 7);
    const defPlaca = placaFiltro || (unidades.length > 0 ? unidades[0].placa : "");

    setFormData({
      mic_dta: "",
      lote_codigo: "1",
      placa: defPlaca,
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
      title: `¿Eliminar viaje MIC ${v.mic_dta || v.placa}?`,
      text: "Esta acción no se puede deshacer.",
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
        await apiFetch(`/tenants/${schema}/viajes/${v.id}`, { method: "DELETE" });
        Swal.fire({
          icon: "success",
          title: "Viaje eliminado",
          background: "#0f172a",
          color: "#f8fafc",
          timer: 1200,
          showConfirmButton: false
        });
        loadViajes();
      } catch (err: any) {
        Swal.fire({ icon: "error", title: "Error", text: err.message, background: "#0f172a", color: "#f8fafc", confirmButtonColor: "#f59e0b" });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        mic_dta: formData.mic_dta.trim() || null,
        lote_codigo: formData.lote_codigo.trim() || null,
        placa: formData.placa.trim().toUpperCase(),
        tramo: formData.tramo.trim().toUpperCase(),
        cliente: formData.cliente.trim().toUpperCase(),
        producto: formData.producto.trim().toUpperCase(),
        fecha_carga: formData.fecha_carga,
        fecha_descarga: formData.fecha_descarga,
        periodo_mes: formData.periodo_mes,
        volumen_origen_litros: Number(formData.volumen_origen_litros),
        volumen_recepcionado_litros: Number(formData.volumen_recepcionado_litros),
        tarifa_flete: Number(formData.tarifa_flete),
        tipo_tarifa: formData.tipo_tarifa,
        precio_merma_litro_bs: Number(formData.precio_merma_litro_bs),
        observaciones: formData.observaciones.trim() || null
      };

      if (editingViaje) {
        await apiFetch(`/tenants/${schema}/viajes/${editingViaje.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        Swal.fire({
          icon: "success",
          title: "Viaje actualizado",
          background: "#0f172a",
          color: "#f8fafc",
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
          background: "#0f172a",
          color: "#f8fafc",
          timer: 1400,
          showConfirmButton: false
        });
      }
      setShowModal(false);
      loadViajes();
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "Error al guardar", text: err.message, background: "#0f172a", color: "#f8fafc", confirmButtonColor: "#f59e0b" });
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
        background: "#0f172a",
        color: "#f8fafc",
        confirmButtonColor: "#f59e0b"
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
              (res.periodos_detectados?.length ? `<span class="text-xs text-slate-400">Periodos: ${res.periodos_detectados.join(", ")}</span>` : ""),
        background: "#0f172a",
        color: "#f8fafc",
        confirmButtonColor: "#f59e0b"
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
        background: "#0f172a",
        color: "#f8fafc",
        confirmButtonColor: "#f59e0b"
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
    <div className="space-y-6 sm:space-y-7 font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* Encabezado y Acciones Principales (Tarjeta Banner Ejecutiva) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-500/10">
            <Navigation className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Registro y Control de Viajes
              </h1>
              <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/25">
                {filtered.length} {filtered.length === 1 ? "Viaje" : "Viajes"}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Fletes en Bs, control de volúmenes en destino y cálculo automático de mermas contractuales YPFB (0.35%)
            </p>
          </div>
        </div>

        {/* Acciones: Plantilla, Importar y Nuevo Viaje */}
        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold border border-slate-800 transition active:scale-95"
            title="Descargar plantilla oficial de Excel para carga masiva de viajes"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>Plantilla Excel</span>
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-900/30 transition active:scale-95"
            title="Subir archivo Excel con lista de despachos"
          >
            <Upload className="w-4 h-4" />
            <span>Importar Excel</span>
          </button>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs sm:text-sm font-black shadow-lg shadow-amber-500/20 transition transform active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Nuevo Viaje</span>
          </button>
        </div>
      </div>

      {/* Barra de Métricas Sumatorias (KPIs Simétricos) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Card 1: Viajes Visibles */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-5 shadow-lg shadow-black/20 transition-all flex flex-col justify-between min-h-[125px] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Viajes Visibles</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
              <Navigation className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-black text-white tracking-tight">
              {filtered.length}
            </div>
          </div>
          <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Despachos</span>
            <span className="font-semibold text-slate-300">Periodo actual</span>
          </div>
        </div>

        {/* Card 2: Vol. Despachado */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-sky-500/40 rounded-2xl p-5 shadow-lg shadow-black/20 transition-all flex flex-col justify-between min-h-[125px] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vol. Despachado</span>
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform">
              <Fuel className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-black text-white tracking-tight font-mono">
              {formatNumber(totalDespachado, 0)} <span className="text-xs font-bold text-slate-400">L</span>
            </div>
          </div>
          <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Volumen origen</span>
            <span className="font-bold text-sky-400">{(totalDespachado / 1000).toFixed(2)} m³</span>
          </div>
        </div>

        {/* Card 3: Vol. Recepcionado */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-5 shadow-lg shadow-black/20 transition-all flex flex-col justify-between min-h-[125px] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vol. Recepcionado</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-black text-emerald-400 tracking-tight font-mono">
              {formatNumber(totalRecepcionado, 0)} <span className="text-xs font-bold text-slate-400">L</span>
            </div>
          </div>
          <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Volumen destino</span>
            <span className="font-bold text-emerald-400">{(totalRecepcionado / 1000).toFixed(2)} m³</span>
          </div>
        </div>

        {/* Card 4: Desc. Merma Total */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-rose-500/40 rounded-2xl p-5 shadow-lg shadow-black/20 transition-all flex flex-col justify-between min-h-[125px] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Desc. Mermas</span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 group-hover:scale-105 transition-transform">
              <Scale className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-black text-rose-400 tracking-tight font-mono">
              {formatCurrency(totalDescMermaBs)}
            </div>
          </div>
          <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Merma real</span>
            <span className="font-bold text-rose-400">{formatNumber(totalMermaReal, 1)} L</span>
          </div>
        </div>

        {/* Card 5: Flete Bruto Total */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-5 shadow-lg shadow-black/20 transition-all flex flex-col justify-between min-h-[125px] group sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Flete Bruto</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
              <DollarSign className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-black text-amber-400 tracking-tight font-mono">
              {formatCurrency(totalFleteBs)}
            </div>
          </div>
          <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Base imponible</span>
            <span className="font-semibold text-amber-400">Antes de ded.</span>
          </div>
        </div>

      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 shadow-xl">
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Periodo */}
          <div className="flex items-center gap-2 bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800 text-xs">
            <Calendar className="w-4 h-4 text-amber-500" />
            <span className="text-slate-400 font-medium">Mes:</span>
            <input
              type="month"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="bg-transparent text-white font-bold focus:outline-none cursor-pointer text-xs"
            />
          </div>

          {/* Placa */}
          <div className="flex items-center gap-2 bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800 text-xs">
            <Truck className="w-4 h-4 text-amber-500" />
            <span className="text-slate-400 font-medium">Placa:</span>
            <select
              value={placaFiltro}
              onChange={(e) => setPlacaFiltro(e.target.value)}
              className="bg-transparent text-white font-bold focus:outline-none cursor-pointer text-xs"
            >
              <option value="" className="bg-slate-900">Todas las Placas</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.placa} className="bg-slate-900">
                  {u.placa}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro de Producto */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
            {["TODOS", "GASOLINA", "DIESEL", "IYA"].map((p) => (
              <button
                key={p}
                onClick={() => setProductoFiltro(p)}
                className={`px-3 py-1.5 rounded-lg transition text-[11px] ${
                  productoFiltro === p
                    ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Buscador Equilibrado */}
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por MIC, tramo o cliente..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
          />
        </div>

      </div>

      {/* Tabla de Viajes o Estado Vacío Intuitivo */}
      {loading ? (
        <div className="flex flex-col justify-center items-center py-24 gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl">
          <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Cargando registros...</span>
        </div>
      ) : filtered.length === 0 ? (
        viajes.length === 0 ? (
          /* Guía de Inicio Rápido para Viajes */
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-10 sm:p-14 text-center max-w-2xl mx-auto shadow-2xl">
            <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/25 text-amber-400 flex items-center justify-center mx-auto mb-5 shadow-xl shadow-amber-500/10">
              <Navigation className="w-10 h-10" />
            </div>
            
            <h3 className="text-xl font-bold text-white mb-2">
              Aún no has registrado viajes en el periodo {periodo}
            </h3>
            
            <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto mb-6 leading-relaxed">
              Ingresa los despachos y recepciones de combustible. El sistema calculará en tiempo real el flete bruto en Bs y las mermas excedentes al 0.35%.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs sm:text-sm font-black shadow-lg shadow-amber-500/20 transition transform hover:scale-105 active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Registrar Nuevo Viaje</span>
              </button>

              <button
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-900/30 transition transform hover:scale-105 active:scale-95"
              >
                <Upload className="w-4 h-4" />
                <span>Importar Planilla Excel</span>
              </button>
            </div>

            {/* Tarjetas de Guía */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-left">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-amber-400 font-bold text-xs flex items-center gap-2 mb-1.5">
                  <Scale className="w-4 h-4 flex-shrink-0" />
                  <span>Tolerancia 0.35%</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Cálculo automático de merma contractual y cobro de excedente en Bs.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-emerald-400 font-bold text-xs flex items-center gap-2 mb-1.5">
                  <DollarSign className="w-4 h-4 flex-shrink-0" />
                  <span>Fletes en Bolivianos</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Multiplicación por volumen recepcionado o m³ según tarifa pactada.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-sky-400 font-bold text-xs flex items-center gap-2 mb-1.5">
                  <FileSpreadsheet className="w-4 h-4 flex-shrink-0" />
                  <span>Liquidación Oficial</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Generación automática de Hoja 1 y Hoja 2 para auditoría YPFB.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-12 text-center max-w-md mx-auto shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Search className="w-6 h-6" />
            </div>
            <p className="text-base font-bold text-white">Sin resultados para la búsqueda</p>
            <p className="text-xs text-slate-400 mt-1 mb-5">
              No hay viajes que coincidan con los filtros aplicados.
            </p>
            <button
              onClick={() => { setSearch(""); setPlacaFiltro(""); setProductoFiltro("TODOS"); }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold rounded-xl transition"
            >
              Restablecer Filtros
            </button>
          </div>
        )
      ) : (
        <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="py-3.5 px-3">MIC/DTA</th>
                  <th className="py-3.5 px-3">Placa</th>
                  <th className="py-3.5 px-3">Tramo</th>
                  <th className="py-3.5 px-3">Producto</th>
                  <th className="py-3.5 px-3">Fechas</th>
                  <th className="py-3.5 px-3 text-right">Vol. Origen</th>
                  <th className="py-3.5 px-3 text-right">Vol. Recep.</th>
                  <th className="py-3.5 px-3 text-right">Merma Real</th>
                  <th className="py-3.5 px-3 text-right">Merma Exc.</th>
                  <th className="py-3.5 px-3 text-right">Desc. Merma</th>
                  <th className="py-3.5 px-3 text-right">Tarifa</th>
                  <th className="py-3.5 px-3 text-right">Flete Total</th>
                  <th className="py-3.5 px-3 text-center">Estado</th>
                  <th className="py-3.5 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filtered.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-800/50 transition">
                    <td className="py-3 px-3 font-mono font-bold text-amber-400">{v.mic_dta || "-"}</td>
                    <td className="py-3 px-3 font-mono font-bold text-white">{v.placa}</td>
                    <td className="py-3 px-3 text-slate-300 truncate max-w-[170px]" title={v.tramo}>
                      {v.tramo}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        v.producto === "GASOLINA" 
                          ? "bg-amber-500/15 text-amber-400 border-amber-500/30" 
                          : v.producto === "DIESEL"
                          ? "bg-sky-500/15 text-sky-400 border-sky-500/30"
                          : "bg-purple-500/15 text-purple-400 border-purple-500/30"
                      }`}>
                        {v.producto}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[11px] text-slate-400 whitespace-nowrap">
                      <div>C: {formatDate(v.fecha_carga)}</div>
                      <div>D: {formatDate(v.fecha_descarga)}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-300">{formatNumber(v.volumen_origen_litros, 0)} L</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">{formatNumber(v.volumen_recepcionado_litros, 0)} L</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-300">
                      {formatNumber(v.merma_real_litros, 1)} L
                    </td>
                    <td className={`py-3 px-3 text-right font-mono ${v.merma_excedente_litros > 0 ? "text-amber-400 font-bold" : "text-slate-500"}`}>
                      {formatNumber(v.merma_excedente_litros, 1)} L
                    </td>
                    <td className={`py-3 px-3 text-right font-mono ${v.merma_descontar_bs > 0 ? "text-rose-400 font-bold" : "text-slate-500"}`}>
                      {formatCurrency(v.merma_descontar_bs)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-300">
                      Bs. {formatNumber(v.tarifa_flete, 2)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-amber-400">
                      {formatCurrency(v.flete_total_bs)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        v.estado === "Liquidado"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                      }`}>
                        {v.estado}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleDuplicate(v)}
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition"
                          title="Duplicar / Clonar Viaje (mismo camión y ruta)"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(v)}
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                          title="Editar Viaje"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(v)}
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 w-full max-w-md p-6 sm:p-7">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Importar Viajes (Excel)</h3>
                  <p className="text-[11px] text-slate-400">Carga masiva de despachos y cálculo en bloque</p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-4">
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-200 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-amber-400">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  <span>¿No tienes la plantilla oficial?</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Descárgala antes para completar las columnas de MIC/DTA, Placas, Fechas y Volúmenes.
                </p>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 underline"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Plantilla Oficial (.xlsx)</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Selecciona el archivo Excel (.xlsx) *
                </label>
                <input
                  type="file"
                  required
                  accept=".xlsx, .xlsm, .xltx"
                  onChange={(e) => setImportFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-500/10 file:text-amber-400 hover:file:bg-amber-500/20 cursor-pointer border border-slate-800 rounded-xl p-1.5 bg-slate-950"
                />
                {importFile && (
                  <p className="text-[11px] text-emerald-400 font-semibold mt-1.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Archivo listo: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)</span>
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!importFile || importing}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 w-full max-w-2xl p-6 sm:p-7 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <h3 className="text-base font-black text-white">
                  {editingViaje ? "Editar Despacho / Viaje" : "Registrar Nuevo Despacho"}
                </h3>
                <p className="text-xs text-slate-400">
                  Cálculo automático de mermas técnicas (0.15% Diésel, 0.25% Gasolina, 0.20% IYA)
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">MIC/DTA Nº</label>
                  <input
                    type="text"
                    value={formData.mic_dta}
                    onChange={(e) => setFormData({ ...formData, mic_dta: e.target.value.toUpperCase() })}
                    placeholder="ej. 23BO051130T"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono uppercase text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Placa *</label>
                  <input
                    type="text"
                    required
                    value={formData.placa}
                    onChange={(e) => setFormData({ ...formData, placa: e.target.value.toUpperCase() })}
                    placeholder="ej. 4412-DPC"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono font-bold uppercase text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Lote</label>
                  <input
                    type="text"
                    value={formData.lote_codigo}
                    onChange={(e) => setFormData({ ...formData, lote_codigo: e.target.value })}
                    placeholder="ej. 1"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Tramo de Transporte *</label>
                <input
                  type="text"
                  required
                  value={formData.tramo}
                  onChange={(e) => setFormData({ ...formData, tramo: e.target.value.toUpperCase() })}
                  placeholder="ej. ARICA - TAMBO QUEMADO - LA PAZ"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs uppercase text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Cliente *</label>
                  <input
                    type="text"
                    required
                    value={formData.cliente}
                    onChange={(e) => setFormData({ ...formData, cliente: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs uppercase text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Producto *</label>
                  <select
                    value={formData.producto}
                    onChange={(e) => setFormData({ ...formData, producto: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="GASOLINA" className="bg-slate-900">GASOLINA (Tol. 0.25%)</option>
                    <option value="DIESEL" className="bg-slate-900">DIÉSEL (Tol. 0.15%)</option>
                    <option value="IYA" className="bg-slate-900">INSUMOS Y ADITIVOS (Tol. 0.20%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Periodo Mes *</label>
                  <input
                    type="month"
                    required
                    value={formData.periodo_mes}
                    onChange={(e) => setFormData({ ...formData, periodo_mes: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Fecha de Carga *</label>
                  <input
                    type="date"
                    required
                    value={formData.fecha_carga}
                    onChange={(e) => setFormData({ ...formData, fecha_carga: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Fecha de Descarga *</label>
                  <input
                    type="date"
                    required
                    value={formData.fecha_descarga}
                    onChange={(e) => setFormData({ ...formData, fecha_descarga: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Volumen Origen (Litros) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.volumen_origen_litros}
                    onChange={(e) => setFormData({ ...formData, volumen_origen_litros: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Volumen Recepcionado (Litros) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.volumen_recepcionado_litros}
                    onChange={(e) => setFormData({ ...formData, volumen_recepcionado_litros: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Tarifa Flete (Bs/m³) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.tarifa_flete}
                    onChange={(e) => setFormData({ ...formData, tarifa_flete: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Tipo Tarifa</label>
                  <select
                    value={formData.tipo_tarifa}
                    onChange={(e) => setFormData({ ...formData, tipo_tarifa: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="BS_POR_M3" className="bg-slate-900">Bs. por m³</option>
                    <option value="USD_POR_M3" className="bg-slate-900">USD por m³</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Precio Merma (Bs/L)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.precio_merma_litro_bs}
                    onChange={(e) => setFormData({ ...formData, precio_merma_litro_bs: parseFloat(e.target.value) || 7.45 })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Previsualización en Vivo de Cálculos */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 text-xs">
                <span className="font-bold text-amber-400 uppercase tracking-wider text-[10px] block mb-1">
                  Cálculos Oficiales en Tiempo Real:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Merma Real:</span>
                    <span className="font-mono font-bold text-white">{liveCalc.merma_real} L</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Tolerable ({liveCalc.tolerancia_pct}%):</span>
                    <span className="font-mono font-bold text-white">{liveCalc.merma_tolerable} L</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Merma a Descontar:</span>
                    <span className={`font-mono font-bold ${liveCalc.merma_descontar_bs > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                      {formatCurrency(liveCalc.merma_descontar_bs)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Flete Bruto Estimado:</span>
                    <span className="font-mono font-bold text-amber-400">
                      {formatCurrency(liveCalc.flete_total_bs)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20 transition transform active:scale-95"
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
