"use client";

import { Suspense, useState, useEffect, Fragment } from "react";
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
  Scale,
  Handshake,
  Save,
  Clock,
  History,
  Eye,
  Tag,
  FileText
} from "lucide-react";
import Swal from "sweetalert2";
import { apiFetch, getApiUrl } from "@/lib/api";
import { formatCurrency, formatNumber, formatDate } from "@/lib/format";
import DatePeriodFilter, { DateFilterChangeEvent } from "@/components/DatePeriodFilter";
import SaveNewCatalogModal from "@/components/SaveNewCatalogModal";
import ModalPortal from "@/components/ModalPortal";

interface ItemDescuento {
  concepto: string;
  monto: number;
}

interface Viaje {
  id: number;
  mic_dta: string | null;
  nro_factura?: string | null;
  fecha_factura?: string | null;
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
  volumen_facturado?: number;
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
  es_apoyo?: boolean | null;
  empresa_apoyo_id?: number | null;
  empresa_apoyo_nombre?: string | null;
  descuentos_adicionales?: ItemDescuento[];
  descuentos_mermas?: ItemDescuento[];
  total_descuentos_adicionales_bs?: number;
  total_descuentos_mermas_bs?: number;
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

// Validador de asignación a un único mes con holgura de 1-2 días respecto al fin de mes
function determineTripPeriod(fechaCargaStr: string, fechaDescargaStr?: string): string {
  if (!fechaCargaStr) return new Date().toISOString().slice(0, 7);
  if (!fechaDescargaStr) return fechaCargaStr.slice(0, 7);

  const partsC = fechaCargaStr.split("-").map(Number);
  const partsD = fechaDescargaStr.split("-").map(Number);
  if (partsC.length < 3 || partsD.length < 3) return fechaCargaStr.slice(0, 7);

  const [yC, mC, dC] = partsC;
  const [yD, mD, dD] = partsD;

  if (yC === yD && mC === mD) {
    return `${yC}-${String(mC).padStart(2, "0")}`;
  }

  // Último día del mes de carga
  const lastDayCarga = new Date(yC, mC, 0).getDate();
  const diasRestantesCarga = lastDayCarga - dC;

  // Regla de holgura: Si cargó en los últimos 2 días del mes (días restantes <= 2),
  // se consolida en el mes de descarga
  if (diasRestantesCarga <= 2) {
    return `${yD}-${String(mD).padStart(2, "0")}`;
  }

  // De lo contrario, por finalización de despacho se consolida en mes de descarga
  return `${yD}-${String(mD).padStart(2, "0")}`;
}

function ViajesContent() {
  const routeParams = useParams();
  const schema = (routeParams?.schema as string) || "";
  const searchParams = useSearchParams();

  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [unidades, setUnidades] = useState<any[]>([]);
  const [unidadesApoyo, setUnidadesApoyo] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [periodo, setPeriodo] = useState("");
  const [activeFilterLabel, setActiveFilterLabel] = useState("");
  const [dateFilterQuery, setDateFilterQuery] = useState("");
  const [periodosDisponibles, setPeriodosDisponibles] = useState<any[]>([]);
  const [placaFiltro, setPlacaFiltro] = useState("");
  const [productoFiltro, setProductoFiltro] = useState("TODOS");
  const [search, setSearch] = useState("");

  // Pestaña Principal: "planilla" o "historial"
  const [activeMainTab, setActiveMainTab] = useState<"planilla" | "historial">("planilla");

  // Catálogos dinámicos por empresa
  const [catalogProductos, setCatalogProductos] = useState<string[]>([
    "GASOLINA",
    "DIESEL",
    "INSUMOS Y ADITIVOS"
  ]);
  const [catalogTramos, setCatalogTramos] = useState<string[]>([
    "ARICA - TAMBO QUEMADO - LA PAZ",
    "IQUIQUE - TAMBO QUEMADO - LA PAZ",
    "MEJILLONES - TAMBO QUEMADO - LA PAZ",
    "YACUIBA - SANTA CRUZ",
    "PISIGA - ORURO"
  ]);

  // Filtros especiales para el Módulo de Historial
  const [historialFacturadoFilter, setHistorialFacturadoFilter] = useState<"TODOS" | "FACTURADOS" | "SIN_FACTURAR">("TODOS");
  const [selectedViajeDetail, setSelectedViajeDetail] = useState<Viaje | null>(null);

  // Modales
  const [showModal, setShowModal] = useState(false);
  const [editingViaje, setEditingViaje] = useState<Viaje | null>(null);

  // Confirmación de guardado en catálogo para nuevas placas o clientes
  const [showSaveNewModal, setShowSaveNewModal] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState<{
    isNewPlaca: boolean;
    isNewCliente: boolean;
    placa: string;
    cliente: string;
  } | null>(null);
  const [savingCatalog, setSavingCatalog] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  // Formulario de viaje
  const [formData, setFormData] = useState({
    mic_dta: "",
    nro_factura: "",
    fecha_factura: "",
    lote_codigo: "1",
    placa: "",
    es_apoyo: false,
    empresa_apoyo_id: null as number | null,
    empresa_apoyo_nombre: "",
    tramo: "ARICA - TAMBO QUEMADO - LA PAZ",
    cliente: "Y.P.F.B.",
    producto: "GASOLINA",
    fecha_carga: new Date().toISOString().split("T")[0],
    fecha_descarga: new Date().toISOString().split("T")[0],
    periodo_mes: new Date().toISOString().slice(0, 7),
    volumen_origen_litros: 34000 as number | string,
    volumen_recepcionado_litros: 33900 as number | string,
    volumen_facturado: 33.900 as number | string,
    tarifa_flete: 392.00 as number | string,
    tipo_tarifa: "BS_POR_M3",
    precio_merma_litro_bs: 7.45 as number | string,
    observaciones: "",
    descuentos_adicionales: [] as ItemDescuento[],
    descuentos_mermas: [] as ItemDescuento[]
  });

  // Cálculo en vivo dentro del modal
  const [liveCalc, setLiveCalc] = useState({
    merma_real: -100,
    tolerancia_pct: 0.25,
    merma_tolerable: 85,
    merma_excedente: 15,
    merma_descontar_bs: 111.75,
    flete_total_bs: 13288.80,
    total_descuentos_adicionales: 0,
    total_descuentos_mermas: 0
  });

  // Manejadores para listas dinámicas de descuentos
  const addDescuentoAdicional = () => {
    setFormData(prev => ({
      ...prev,
      descuentos_adicionales: [...prev.descuentos_adicionales, { concepto: "", monto: 0 }]
    }));
  };
  const removeDescuentoAdicional = (index: number) => {
    setFormData(prev => ({
      ...prev,
      descuentos_adicionales: prev.descuentos_adicionales.filter((_, idx) => idx !== index)
    }));
  };
  const updateDescuentoAdicional = (index: number, field: "concepto" | "monto", val: any) => {
    setFormData(prev => {
      const next = [...prev.descuentos_adicionales];
      next[index] = { ...next[index], [field]: val };
      return { ...prev, descuentos_adicionales: next };
    });
  };

  const addDescuentoMerma = () => {
    setFormData(prev => ({
      ...prev,
      descuentos_mermas: [...prev.descuentos_mermas, { concepto: "", monto: 0 }]
    }));
  };
  const removeDescuentoMerma = (index: number) => {
    setFormData(prev => ({
      ...prev,
      descuentos_mermas: prev.descuentos_mermas.filter((_, idx) => idx !== index)
    }));
  };
  const updateDescuentoMerma = (index: number, field: "concepto" | "monto", val: any) => {
    setFormData(prev => {
      const next = [...prev.descuentos_mermas];
      next[index] = { ...next[index], [field]: val };
      return { ...prev, descuentos_mermas: next };
    });
  };

  useEffect(() => {
    loadInitialData();
  }, [schema]);

  useEffect(() => {
    loadViajes();
  }, [schema, periodo, dateFilterQuery, placaFiltro]);

  // Si viene acción de URL para abrir modal de nuevo viaje
  useEffect(() => {
    if (searchParams.get("action") === "nuevo" && !loading) {
      openCreateModal();
    }
  }, [searchParams, loading]);

  // Recálculo dinámico en el formulario modal (estándar físico YPFB y nuevo volumen facturado)
  useEffect(() => {
    const vOri = Number(formData.volumen_origen_litros) || 0;
    const vRec = Number(formData.volumen_recepcionado_litros) || 0;
    // Merma Real: volumen recepcionado - volumen origen (ej. 33900 - 33999 = -99.0 L)
    const mReal = Math.round((vRec - vOri) * 10) / 10;

    let tol = 0.25;
    const prodUpper = (formData.producto || "").toUpperCase();
    if (prodUpper.includes("DIESEL") || prodUpper.includes("DIÉSEL") || prodUpper === "DO") {
      tol = 0.15;
    } else if (prodUpper.includes("IYA") || prodUpper.includes("INSUMOS") || prodUpper.includes("ADIT")) {
      tol = 0.20;
    } else if (
      prodUpper.includes("PLANCHA") || 
      prodUpper.includes("ACERO") || 
      prodUpper.includes("SOYA") || 
      prodUpper.includes("GIRASOL")
    ) {
      tol = 0.0;
    }

    // Merma Tolerable en Litros = Volumen Origen * Tolerancia %
    const mTol = Math.round((vOri * (tol / 100.0)) * 10) / 10;
    
    // Total Merma Excedente = si la pérdida absoluta excede la tolerable
    const mExc = Math.max(0, Math.round((Math.abs(mReal) - mTol) * 10) / 10);
    
    // Descuento por Merma en Bs = Merma Excedente * precio_merma
    const precioMerma = Number(formData.precio_merma_litro_bs) || 7.45;
    const mDescBs = Math.round(mExc * precioMerma * 100) / 100;

    // Volumen Facturado y Operación Principal: Volumen Facturado * Tarifa = Total a Pagar
    const vFact = formData.volumen_facturado !== "" && formData.volumen_facturado !== undefined 
      ? Number(formData.volumen_facturado) 
      : Math.round((vRec / 1000.0) * 1000) / 1000;

    let fleteBs = 0;
    if (formData.tipo_tarifa === "BS_POR_M3") {
      fleteBs = Math.round(vFact * (Number(formData.tarifa_flete) || 0) * 100) / 100;
    } else {
      fleteBs = Math.round(vFact * (Number(formData.tarifa_flete) || 0) * 6.96 * 100) / 100;
    }

    const totDescAdic = (formData.descuentos_adicionales || []).reduce((acc, it) => acc + (Number(it.monto) || 0), 0);
    const totDescMerm = (formData.descuentos_mermas || []).reduce((acc, it) => acc + (Number(it.monto) || 0), 0);

    setLiveCalc({
      merma_real: mReal,
      tolerancia_pct: tol,
      merma_tolerable: mTol,
      merma_excedente: mExc,
      merma_descontar_bs: mDescBs,
      flete_total_bs: fleteBs,
      total_descuentos_adicionales: Math.round(totDescAdic * 100) / 100,
      total_descuentos_mermas: Math.round(totDescMerm * 100) / 100
    });
  }, [
    formData.volumen_origen_litros,
    formData.volumen_recepcionado_litros,
    formData.volumen_facturado,
    formData.producto,
    formData.tarifa_flete,
    formData.tipo_tarifa,
    formData.precio_merma_litro_bs,
    formData.descuentos_adicionales,
    formData.descuentos_mermas
  ]);

  const loadInitialData = async () => {
    try {
      const [uData, uApoyoData, pData, cData, catData] = await Promise.all([
        apiFetch(`/tenants/${schema}/unidades/`).catch(() => []),
        apiFetch(`/tenants/${schema}/apoyo/unidades/todas`).catch(() => []),
        apiFetch(`/tenants/${schema}/viajes/periodos`).catch(() => []),
        apiFetch(`/tenants/${schema}/clientes/`).catch(() => []),
        apiFetch(`/tenants/${schema}/parametros/catalogos`).catch(() => null)
      ]);
      setUnidades(Array.isArray(uData) ? uData : []);
      setUnidadesApoyo(Array.isArray(uApoyoData) ? uApoyoData : []);
      setPeriodosDisponibles(Array.isArray(pData) ? pData : []);
      setClientes(Array.isArray(cData) ? cData : []);
      if (catData) {
        if (Array.isArray(catData.productos) && catData.productos.length > 0) {
          setCatalogProductos(catData.productos);
        }
        if (Array.isArray(catData.tramos) && catData.tramos.length > 0) {
          setCatalogTramos(catData.tramos);
        }
      }
      if (Array.isArray(pData) && pData.length > 0 && !periodo) {
        setPeriodo(pData[0].periodo_mes);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateNuevoTramo = async () => {
    const { value: nuevoTramo } = await Swal.fire({
      title: "Nuevo Tramo de Transporte",
      text: "Se guardará permanentemente en el catálogo de esta empresa.",
      input: "text",
      inputPlaceholder: "ej. ARICA - TAMBO QUEMADO - LA PAZ",
      showCancelButton: true,
      confirmButtonText: "Guardar Tramo",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#f59e0b",
      background: "#0f172a",
      color: "#f8fafc"
    });
    if (nuevoTramo && nuevoTramo.trim()) {
      const tramoUpper = nuevoTramo.trim().toUpperCase();
      try {
        await apiFetch(`/tenants/${schema}/parametros/tramos`, {
          method: "POST",
          body: JSON.stringify({ tramo: tramoUpper })
        });
        setCatalogTramos(prev => Array.from(new Set([...prev, tramoUpper])));
        setFormData(prev => ({ ...prev, tramo: tramoUpper }));
        Swal.fire({
          icon: "success",
          title: "Tramo registrado",
          text: `El tramo ${tramoUpper} ahora está disponible para la empresa.`,
          timer: 1600,
          showConfirmButton: false,
          background: "#0f172a",
          color: "#f8fafc"
        });
      } catch (e: any) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: e.message || "No se pudo guardar el tramo",
          background: "#0f172a",
          color: "#f8fafc"
        });
      }
    }
  };

  const handleCreateNuevoProducto = async () => {
    const { value: nuevoProd } = await Swal.fire({
      title: "Nuevo Producto de Transporte",
      text: "Se guardará permanentemente en el catálogo de esta empresa.",
      input: "text",
      inputPlaceholder: "ej. PLANCHAS DE ACERO, SOYA A GRANEL...",
      showCancelButton: true,
      confirmButtonText: "Guardar Producto",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#f59e0b",
      background: "#0f172a",
      color: "#f8fafc"
    });
    if (nuevoProd && nuevoProd.trim()) {
      const prodUpper = nuevoProd.trim().toUpperCase();
      try {
        await apiFetch(`/tenants/${schema}/parametros/productos`, {
          method: "POST",
          body: JSON.stringify({ producto: prodUpper })
        });
        setCatalogProductos(prev => Array.from(new Set([...prev, prodUpper])));
        setFormData(prev => ({ ...prev, producto: prodUpper }));
        Swal.fire({
          icon: "success",
          title: "Producto registrado",
          text: `El producto ${prodUpper} ahora está disponible para la empresa.`,
          timer: 1600,
          showConfirmButton: false,
          background: "#0f172a",
          color: "#f8fafc"
        });
      } catch (e: any) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: e.message || "No se pudo guardar el producto",
          background: "#0f172a",
          color: "#f8fafc"
        });
      }
    }
  };

  const loadPeriodos = async () => {
    try {
      const pData = await apiFetch(`/tenants/${schema}/viajes/periodos`).catch(() => []);
      setPeriodosDisponibles(Array.isArray(pData) ? pData : []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadViajes = async () => {
    setLoading(true);
    try {
      let query = "";
      const params: string[] = [];
      if (dateFilterQuery) {
        params.push(dateFilterQuery);
      } else if (periodo) {
        params.push(`periodo_mes=${periodo}`);
      }
      if (placaFiltro) params.push(`placa=${placaFiltro}`);
      if (params.length > 0) query = `?${params.join("&")}`;

      const data = await apiFetch(`/tenants/${schema}/viajes/${query}`).catch(() => []);
      setViajes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setViajes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDateFilterChange = (filter: DateFilterChangeEvent) => {
    setActiveFilterLabel(filter.label);
    let q = "";
    if (filter.mode === "mes" && filter.periodo_mes) {
      q = `periodo_mes=${filter.periodo_mes}`;
      setPeriodo(filter.periodo_mes);
    } else if (filter.mode === "semestral" && filter.fecha_desde && filter.fecha_hasta) {
      q = `fecha_desde=${filter.fecha_desde}&fecha_hasta=${filter.fecha_hasta}`;
      setPeriodo("");
    } else if (filter.mode === "anual" && filter.anio) {
      q = `anio=${filter.anio}`;
      setPeriodo("");
    } else if (filter.mode === "personalizado" && filter.fecha_desde && filter.fecha_hasta) {
      q = `fecha_desde=${filter.fecha_desde}&fecha_hasta=${filter.fecha_hasta}`;
      setPeriodo("");
    } else if (filter.mode === "historico") {
      q = "";
      setPeriodo("");
    }
    setDateFilterQuery(q);
  };

  const handlePlacaChange = (val: string) => {
    const upperVal = val.toUpperCase().trim();
    const matchApoyo = unidadesApoyo.find(u => u.placa?.toUpperCase() === upperVal);
    if (matchApoyo) {
      const vOri = matchApoyo.capacidad_litros || 34000;
      const vRec = vOri - 100;
      setFormData(prev => ({
        ...prev,
        placa: upperVal,
        es_apoyo: true,
        empresa_apoyo_id: matchApoyo.empresa_apoyo_id,
        empresa_apoyo_nombre: matchApoyo.empresa_apoyo_nombre || "Empresa de Apoyo",
        volumen_origen_litros: vOri,
        volumen_recepcionado_litros: vRec,
        volumen_facturado: Math.round((vRec / 1000.0) * 1000) / 1000
      }));
      return;
    }

    const matchPropia = unidades.find(u => u.placa?.toUpperCase() === upperVal);
    if (matchPropia) {
      const vOri = matchPropia.capacidad_litros || 34000;
      const vRec = vOri - 100;
      setFormData(prev => ({
        ...prev,
        placa: upperVal,
        es_apoyo: false,
        empresa_apoyo_id: null,
        empresa_apoyo_nombre: "",
        volumen_origen_litros: vOri,
        volumen_recepcionado_litros: vRec,
        volumen_facturado: Math.round((vRec / 1000.0) * 1000) / 1000
      }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      placa: upperVal,
      es_apoyo: false,
      empresa_apoyo_id: null,
      empresa_apoyo_nombre: ""
    }));
  };

  const openCreateModal = () => {
    setEditingViaje(null);
    const today = new Date().toISOString().split("T")[0];
    const defMes = determineTripPeriod(today, today);
    const defPlaca = placaFiltro || (unidades.length > 0 ? unidades[0].placa : (unidadesApoyo.length > 0 ? unidadesApoyo[0].placa : ""));
    const defCliente = clientes.length > 0 ? clientes[0].nombre : "Y.P.F.B.";
    const matchApoyo = unidadesApoyo.find(u => u.placa === defPlaca);

    const vOri = matchApoyo ? (matchApoyo.capacidad_litros || 34000) : 34000;
    const vRec = vOri - 100;

    setFormData({
      mic_dta: "",
      nro_factura: "",
      fecha_factura: "",
      lote_codigo: "1",
      placa: defPlaca,
      es_apoyo: Boolean(matchApoyo),
      empresa_apoyo_id: matchApoyo ? matchApoyo.empresa_apoyo_id : null,
      empresa_apoyo_nombre: matchApoyo ? (matchApoyo.empresa_apoyo_nombre || "") : "",
      tramo: "ARICA - TAMBO QUEMADO - LA PAZ",
      cliente: defCliente,
      producto: "GASOLINA",
      fecha_carga: today,
      fecha_descarga: today,
      periodo_mes: defMes,
      volumen_origen_litros: vOri,
      volumen_recepcionado_litros: vRec,
      volumen_facturado: Math.round((vRec / 1000.0) * 1000) / 1000,
      tarifa_flete: 392.00,
      tipo_tarifa: "BS_POR_M3",
      precio_merma_litro_bs: 7.45,
      observaciones: "",
      descuentos_adicionales: [],
      descuentos_mermas: []
    });
    setShowModal(true);
  };

  const openEditModal = (v: Viaje) => {
    setEditingViaje(v);

    let parsedAdic: ItemDescuento[] = [];
    if (Array.isArray(v.descuentos_adicionales)) {
      parsedAdic = v.descuentos_adicionales;
    } else if (typeof v.descuentos_adicionales === "string") {
      try { parsedAdic = JSON.parse(v.descuentos_adicionales); } catch (e) {}
    }

    let parsedMerm: ItemDescuento[] = [];
    if (Array.isArray(v.descuentos_mermas)) {
      parsedMerm = v.descuentos_mermas;
    } else if (typeof v.descuentos_mermas === "string") {
      try { parsedMerm = JSON.parse(v.descuentos_mermas); } catch (e) {}
    }

    const volFact = v.volumen_facturado !== null && v.volumen_facturado !== undefined 
      ? v.volumen_facturado 
      : Math.round(((Number(v.volumen_recepcionado_litros) || 0) / 1000.0) * 1000) / 1000;

    setFormData({
      mic_dta: v.mic_dta || "",
      nro_factura: v.nro_factura || "",
      fecha_factura: v.fecha_factura || "",
      lote_codigo: v.lote_codigo || "1",
      placa: v.placa,
      es_apoyo: Boolean(v.es_apoyo),
      empresa_apoyo_id: v.empresa_apoyo_id || null,
      empresa_apoyo_nombre: v.empresa_apoyo_nombre || "",
      tramo: v.tramo,
      cliente: v.cliente,
      producto: v.producto,
      fecha_carga: v.fecha_carga,
      fecha_descarga: v.fecha_descarga,
      periodo_mes: v.periodo_mes,
      volumen_origen_litros: v.volumen_origen_litros,
      volumen_recepcionado_litros: v.volumen_recepcionado_litros,
      volumen_facturado: volFact,
      tarifa_flete: v.tarifa_flete,
      tipo_tarifa: v.tipo_tarifa,
      precio_merma_litro_bs: v.precio_merma_litro_bs || 7.45,
      observaciones: v.observaciones || "",
      descuentos_adicionales: parsedAdic,
      descuentos_mermas: parsedMerm
    });
    setShowModal(true);
  };

  const handleDuplicate = (v: Viaje) => {
    setEditingViaje(null); // Es un registro nuevo
    const today = new Date().toISOString().split("T")[0];

    let parsedAdic: ItemDescuento[] = [];
    if (Array.isArray(v.descuentos_adicionales)) {
      parsedAdic = v.descuentos_adicionales;
    } else if (typeof v.descuentos_adicionales === "string") {
      try { parsedAdic = JSON.parse(v.descuentos_adicionales); } catch (e) {}
    }

    let parsedMerm: ItemDescuento[] = [];
    if (Array.isArray(v.descuentos_mermas)) {
      parsedMerm = v.descuentos_mermas;
    } else if (typeof v.descuentos_mermas === "string") {
      try { parsedMerm = JSON.parse(v.descuentos_mermas); } catch (e) {}
    }

    const volFact = v.volumen_facturado !== null && v.volumen_facturado !== undefined 
      ? v.volumen_facturado 
      : Math.round(((Number(v.volumen_recepcionado_litros) || 0) / 1000.0) * 1000) / 1000;

    setFormData({
      mic_dta: "", // Dejar en blanco para que ingrese el nuevo MIC
      nro_factura: "",
      fecha_factura: "",
      lote_codigo: v.lote_codigo || "1",
      placa: v.placa,
      es_apoyo: Boolean(v.es_apoyo),
      empresa_apoyo_id: v.empresa_apoyo_id || null,
      empresa_apoyo_nombre: v.empresa_apoyo_nombre || "",
      tramo: v.tramo,
      cliente: v.cliente,
      producto: v.producto,
      fecha_carga: today,
      fecha_descarga: today,
      periodo_mes: v.periodo_mes,
      volumen_origen_litros: v.volumen_origen_litros,
      volumen_recepcionado_litros: v.volumen_recepcionado_litros,
      volumen_facturado: volFact,
      tarifa_flete: v.tarifa_flete,
      tipo_tarifa: v.tipo_tarifa,
      precio_merma_litro_bs: v.precio_merma_litro_bs || 7.45,
      observaciones: v.observaciones || "",
      descuentos_adicionales: parsedAdic,
      descuentos_mermas: parsedMerm
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

  const executeSaveViaje = async () => {
    try {
      // Validar descuentos adicionales
      for (let i = 0; i < formData.descuentos_adicionales.length; i++) {
        const item = formData.descuentos_adicionales[i];
        if (!item.concepto || !item.concepto.trim()) {
          Swal.fire({
            icon: "warning",
            title: "Descuento Adicional Incompleto",
            text: `Por favor ingresa el concepto para el descuento adicional #${i + 1}.`,
            background: "#0f172a",
            color: "#f8fafc",
            confirmButtonColor: "#f59e0b"
          });
          return;
        }
        if (isNaN(Number(item.monto)) || Number(item.monto) <= 0) {
          Swal.fire({
            icon: "warning",
            title: "Monto de Descuento Inválido",
            text: `El monto para el descuento "${item.concepto}" debe ser un número mayor a 0.`,
            background: "#0f172a",
            color: "#f8fafc",
            confirmButtonColor: "#f59e0b"
          });
          return;
        }
      }

      // Validar descuentos por merma
      for (let i = 0; i < formData.descuentos_mermas.length; i++) {
        const item = formData.descuentos_mermas[i];
        if (!item.concepto || !item.concepto.trim()) {
          Swal.fire({
            icon: "warning",
            title: "Descuento por Merma Incompleto",
            text: `Por favor ingresa el concepto para el descuento de merma #${i + 1}.`,
            background: "#0f172a",
            color: "#f8fafc",
            confirmButtonColor: "#f59e0b"
          });
          return;
        }
        if (isNaN(Number(item.monto)) || Number(item.monto) <= 0) {
          Swal.fire({
            icon: "warning",
            title: "Monto de Descuento Inválido",
            text: `El monto para el descuento de merma "${item.concepto}" debe ser un número mayor a 0.`,
            background: "#0f172a",
            color: "#f8fafc",
            confirmButtonColor: "#f59e0b"
          });
          return;
        }
      }

      const vRecNum = Number(formData.volumen_recepcionado_litros) || 0;
      const vFactNum = formData.volumen_facturado !== "" && formData.volumen_facturado !== undefined
        ? Number(formData.volumen_facturado)
        : Math.round((vRecNum / 1000.0) * 1000) / 1000;

      const payload = {
        mic_dta: formData.mic_dta.trim() || null,
        nro_factura: formData.nro_factura.trim() || null,
        fecha_factura: formData.fecha_factura || null,
        lote_codigo: formData.lote_codigo.trim() || null,
        placa: formData.placa.trim().toUpperCase(),
        es_apoyo: formData.es_apoyo,
        empresa_apoyo_id: formData.empresa_apoyo_id,
        empresa_apoyo_nombre: formData.empresa_apoyo_nombre || null,
        tramo: formData.tramo.trim().toUpperCase(),
        cliente: formData.cliente.trim().toUpperCase(),
        producto: formData.producto.trim().toUpperCase(),
        fecha_carga: formData.fecha_carga,
        fecha_descarga: formData.fecha_descarga,
        periodo_mes: formData.periodo_mes,
        volumen_origen_litros: Number(formData.volumen_origen_litros) || 0,
        volumen_recepcionado_litros: vRecNum,
        volumen_facturado: vFactNum,
        tarifa_flete: Number(formData.tarifa_flete) || 0,
        tipo_tarifa: formData.tipo_tarifa,
        precio_merma_litro_bs: Number(formData.precio_merma_litro_bs) || 7.45,
        descuentos_adicionales: formData.descuentos_adicionales,
        descuentos_mermas: formData.descuentos_mermas,
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
      setShowSaveNewModal(false);
      setPendingSaveData(null);
      loadViajes();
      loadPeriodos();
    } catch (err: any) {
      Swal.fire({ 
        icon: "error", 
        title: "Error al guardar", 
        text: err.message, 
        background: "#0f172a", 
        color: "#f8fafc", 
        confirmButtonColor: "#f59e0b" 
      });
    }
  };

  const handleConfirmSaveCatalog = async () => {
    setSavingCatalog(true);
    try {
      const cleanPlaca = formData.placa.trim().toUpperCase();
      const cleanCliente = formData.cliente.trim().toUpperCase();

      // Guardar placa si es nueva
      if (pendingSaveData?.isNewPlaca && cleanPlaca) {
        try {
          const nuevaUnidad = await apiFetch(`/tenants/${schema}/unidades/`, {
            method: "POST",
            body: JSON.stringify({
              placa: cleanPlaca,
              tipo_unidad: "Cisterna Combustible",
              capacidad_litros: Number(formData.volumen_origen_litros) || 34000,
              capacidad_m3: (Number(formData.volumen_origen_litros) || 34000) / 1000,
              num_compartimentos: 4,
              estado: "Activo"
            })
          });
          if (nuevaUnidad) {
            setUnidades(prev => [...prev, nuevaUnidad]);
          }
        } catch (e) {
          console.warn("No se pudo registrar la placa automáticamente en el catálogo:", e);
        }
      }

      // Guardar cliente si es nuevo
      if (pendingSaveData?.isNewCliente && cleanCliente) {
        try {
          const nuevoCli = await apiFetch(`/tenants/${schema}/clientes/`, {
            method: "POST",
            body: JSON.stringify({
              nombre: cleanCliente
            })
          });
          if (nuevoCli) {
            setClientes(prev => [...prev, nuevoCli]);
          }
        } catch (e) {
          console.warn("No se pudo registrar el cliente automáticamente en el catálogo:", e);
        }
      }

      // Proceder con el registro del despacho
      await executeSaveViaje();
    } finally {
      setSavingCatalog(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPlaca = formData.placa.trim().toUpperCase();
    const cleanCliente = formData.cliente.trim().toUpperCase();

    if (!cleanPlaca) {
      Swal.fire({
        icon: "warning",
        title: "Placa requerida",
        text: "Por favor escribe o selecciona la placa de la cisterna.",
        background: "#0f172a",
        color: "#f8fafc",
        confirmButtonColor: "#f59e0b"
      });
      return;
    }

    if (!cleanCliente) {
      Swal.fire({
        icon: "warning",
        title: "Cliente requerido",
        text: "Por favor escribe o selecciona el cliente o consignatario.",
        background: "#0f172a",
        color: "#f8fafc",
        confirmButtonColor: "#f59e0b"
      });
      return;
    }

    const vOriNum = Number(formData.volumen_origen_litros) || 0;
    const vRecNum = Number(formData.volumen_recepcionado_litros) || 0;

    // Control anti-duplicados por MIC/DTA si fue ingresado
    if (formData.mic_dta && formData.mic_dta.trim()) {
      const micUpper = formData.mic_dta.trim().toUpperCase();
      const dupMic = viajes.find(v => v.mic_dta && v.mic_dta.toUpperCase() === micUpper && v.id !== editingViaje?.id);
      if (dupMic) {
        Swal.fire({
          icon: "warning",
          title: "MIC/DTA ya Registrado",
          text: `El MIC/DTA ${micUpper} ya se encuentra registrado para la cisterna ${dupMic.placa} (Carga: ${dupMic.fecha_carga}). No se permiten viajes duplicados.`,
          background: "#0f172a",
          color: "#f8fafc",
          confirmButtonColor: "#f59e0b"
        });
        return;
      }
    }

    // Control anti-duplicados por placa, fechas de carga/descarga y volumen
    const dupTrip = viajes.find(v => 
      v.placa?.toUpperCase() === cleanPlaca &&
      v.fecha_carga === formData.fecha_carga &&
      v.fecha_descarga === formData.fecha_descarga &&
      Number(v.volumen_recepcionado_litros) === vRecNum &&
      v.id !== editingViaje?.id
    );
    if (dupTrip) {
      Swal.fire({
        icon: "warning",
        title: "Despacho Duplicado",
        text: `Ya existe un viaje registrado para la placa ${cleanPlaca} en el tramo de fechas ${formData.fecha_carga} a ${formData.fecha_descarga}.`,
        background: "#0f172a",
        color: "#f8fafc",
        confirmButtonColor: "#f59e0b"
      });
      return;
    }

    // Si ambos volúmenes están vacíos o en 0, alertar y confirmar si desea guardar con 0
    if (vOriNum === 0 && vRecNum === 0) {
      const confirmZero = await Swal.fire({
        title: "¿Guardar con volúmenes en 0?",
        text: "Tanto el volumen origen como el recepcionado están en 0. ¿Deseas registrar este despacho con 0 litros o prefieres completar los datos?",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Sí, guardar con 0",
        cancelButtonText: "Completar litros",
        confirmButtonColor: "#f59e0b",
        cancelButtonColor: "#334155",
        background: "#0f172a",
        color: "#f8fafc"
      });
      if (!confirmZero.isConfirmed) return;
    }

    const isPlacaRegistered = unidades.some(u => u.placa?.toUpperCase() === cleanPlaca) ||
                              unidadesApoyo.some(u => u.placa?.toUpperCase() === cleanPlaca);
    const isClienteRegistered = clientes.some(c => c.nombre?.toUpperCase() === cleanCliente);

    // Si la placa o el cliente son nuevos, preguntar si se guardan en el catálogo
    if (!isPlacaRegistered || !isClienteRegistered) {
      setPendingSaveData({
        isNewPlaca: !isPlacaRegistered,
        isNewCliente: !isClienteRegistered,
        placa: cleanPlaca,
        cliente: cleanCliente
      });
      setShowSaveNewModal(true);
      return;
    }

    // Ambos ya están registrados: guardar viaje directamente
    await executeSaveViaje();
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

  // Filtrado de viajes para Planilla
  const filtered = (Array.isArray(viajes) ? viajes : []).filter((v) => {
    if (productoFiltro !== "TODOS" && v.producto !== productoFiltro) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchPlaca = v.placa.toLowerCase().includes(q);
      const matchMic = v.mic_dta ? v.mic_dta.toLowerCase().includes(q) : false;
      const matchFactura = v.nro_factura ? v.nro_factura.toLowerCase().includes(q) : false;
      const matchTramo = v.tramo.toLowerCase().includes(q);
      const matchCliente = v.cliente.toLowerCase().includes(q);
      return matchPlaca || matchMic || matchFactura || matchTramo || matchCliente;
    }
    return true;
  });

  // Filtrado específico para Historial
  const historialFiltered = (Array.isArray(viajes) ? viajes : []).filter((v) => {
    if (historialFacturadoFilter === "FACTURADOS" && (!v.nro_factura || !v.nro_factura.trim())) {
      return false;
    }
    if (historialFacturadoFilter === "SIN_FACTURAR" && v.nro_factura && v.nro_factura.trim()) {
      return false;
    }
    if (productoFiltro !== "TODOS" && v.producto !== productoFiltro) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchPlaca = v.placa.toLowerCase().includes(q);
      const matchMic = v.mic_dta ? v.mic_dta.toLowerCase().includes(q) : false;
      const matchFactura = v.nro_factura ? v.nro_factura.toLowerCase().includes(q) : false;
      const matchTramo = v.tramo.toLowerCase().includes(q);
      const matchCliente = v.cliente.toLowerCase().includes(q);
      return matchPlaca || matchMic || matchFactura || matchTramo || matchCliente;
    }
    return true;
  });

  // Métricas Sumatorias de Planilla
  const totalDespachado = filtered.reduce((acc, v) => acc + (v.volumen_origen_litros || 0), 0);
  const totalRecepcionado = filtered.reduce((acc, v) => acc + (v.volumen_recepcionado_litros || 0), 0);
  const totalMermaReal = filtered.reduce((acc, v) => acc + (v.merma_real_litros || 0), 0);
  const totalDescMermaBs = filtered.reduce((acc, v) => acc + (v.merma_descontar_bs || 0), 0);
  const totalVolFacturado = filtered.reduce((acc, v) => acc + (Number(v.volumen_facturado) || (Number(v.volumen_recepcionado_litros) / 1000) || 0), 0);
  const totalFleteBs = filtered.reduce((acc, v) => acc + (v.flete_total_bs || 0), 0);

  // Métricas de Historial
  const histTotalViajes = viajes.length;
  const histFacturados = viajes.filter(v => v.nro_factura && v.nro_factura.trim());
  const histSinFactura = viajes.filter(v => !v.nro_factura || !v.nro_factura.trim());
  const histMontoFacturadoBs = histFacturados.reduce((acc, v) => acc + (v.flete_total_bs || 0), 0);
  const histMontoSinFacturaBs = histSinFactura.reduce((acc, v) => acc + (v.flete_total_bs || 0), 0);

  return (
    <div className="space-y-4 font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* Encabezado y Acciones Principales (Sleek & Intuitivo) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Control de Viajes y Fletes
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                {activeMainTab === "planilla" ? `${filtered.length} despachos` : `${historialFiltered.length} en historial`}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Despachos, volúmenes de combustible, subtotales por tramo/producto, facturación y mermas contractuales YPFB.
            </p>
          </div>
        </div>

        {/* Acciones: Plantilla, Importar y Nuevo Viaje */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition"
            title="Descargar plantilla oficial de Excel"
          >
            <Download className="w-3.5 h-3.5 text-amber-500" />
            <span>Plantilla</span>
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition active:scale-95"
            title="Subir archivo Excel con lista de despachos"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importar</span>
          </button>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Nuevo Viaje</span>
          </button>
        </div>
      </div>

      {/* Pestañas Principales: Planilla de Despachos vs Historial de Viajes */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveMainTab("planilla")}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
            activeMainTab === "planilla"
              ? "bg-amber-500 text-slate-950 shadow-sm"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Planilla de Despachos</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeMainTab === "planilla" ? "bg-slate-950/20 text-slate-950 font-black" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
            {filtered.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab("historial")}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
            activeMainTab === "historial"
              ? "bg-amber-500 text-slate-950 shadow-sm"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800"
          }`}
        >
          <History className="w-4 h-4" />
          <span>Historial de Viajes & Facturas</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeMainTab === "historial" ? "bg-slate-950/20 text-slate-950 font-black" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
            {histFacturados.length} facturados
          </span>
        </button>
      </div>

      {/* Visualizador de Meses y Filtros de Fechas */}
      <DatePeriodFilter
        currentPeriodoMes={periodo}
        periodosDisponibles={periodosDisponibles}
        onChange={handleDateFilterChange}
      />

      {/* Métricas Clave Dinámicas (según pestaña activa) */}
      {activeMainTab === "planilla" ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Flete Bruto Total */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Flete Bruto</span>
              <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                {formatCurrency(totalFleteBs)}
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Base de liquidación</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 flex-shrink-0">
              <DollarSign className="w-4.5 h-4.5" />
            </div>
          </div>

          {/* Card 2: Vol. Recepcionado */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Vol. Recepcionado</span>
              <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                {formatNumber(totalRecepcionado, 0)} <span className="text-xs font-bold text-slate-400">L</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Vol. Facturado: {formatNumber(totalVolFacturado, 3)}</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 flex-shrink-0">
              <Fuel className="w-4.5 h-4.5" />
            </div>
          </div>

          {/* Card 3: Desc. Merma Total */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Desc. Mermas</span>
              <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 font-mono mt-0.5">
                {formatCurrency(totalDescMermaBs)}
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Merma real: {formatNumber(totalMermaReal, 1)} L</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 flex-shrink-0">
              <Scale className="w-4.5 h-4.5" />
            </div>
          </div>

          {/* Card 4: Total Despachos */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Despachos</span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
                {filtered.length}
              </div>
              <span className="text-[10px] text-slate-400 font-medium">{activeFilterLabel || periodo}</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center flex-shrink-0">
              <Navigation className="w-4.5 h-4.5" />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Historial Card 1: Total Registros */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Total Despachos</span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
                {histTotalViajes}
              </div>
              <span className="text-[10px] text-slate-400 font-medium">{historialFiltered.length} mostrados</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet className="w-4.5 h-4.5" />
            </div>
          </div>

          {/* Historial Card 2: Con Factura */}
          <div className="bg-white dark:bg-slate-900 border border-emerald-500/30 rounded-xl p-3.5 shadow-sm flex items-center justify-between bg-emerald-50/10">
            <div>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Facturados</span>
              <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                {histFacturados.length} <span className="text-xs text-slate-400">({histTotalViajes > 0 ? Math.round((histFacturados.length / histTotalViajes) * 100) : 0}%)</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Con número asignado</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4.5 h-4.5" />
            </div>
          </div>

          {/* Historial Card 3: Monto Facturado en Bs */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Monto Facturado</span>
              <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                {formatCurrency(histMontoFacturadoBs)}
              </div>
              <span className="text-[10px] text-slate-400 font-medium">En bolivianos</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 flex-shrink-0">
              <DollarSign className="w-4.5 h-4.5" />
            </div>
          </div>

          {/* Historial Card 4: Pendiente por Facturar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Por Facturar</span>
              <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 font-mono mt-0.5">
                {histSinFactura.length}
              </div>
              <span className="text-[10px] text-slate-400 font-medium">{formatCurrency(histMontoSinFacturaBs)} pendiente</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 flex-shrink-0">
              <AlertTriangle className="w-4.5 h-4.5" />
            </div>
          </div>
        </div>
      )}

      {/* Barra de Filtros y Búsqueda (con Catálogos Dinámicos de Empresa) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 sm:p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {/* Placa */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
            <Truck className="w-3.5 h-3.5 text-amber-500" />
            <select
              value={placaFiltro}
              onChange={(e) => setPlacaFiltro(e.target.value)}
              className="bg-transparent text-slate-900 dark:text-white font-bold focus:outline-none cursor-pointer text-xs"
            >
              <option value="" className="bg-white dark:bg-slate-900">Todas las Placas</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.placa} className="bg-white dark:bg-slate-900">
                  {u.placa}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro de Facturación (Exclusivo en Historial) */}
          {activeMainTab === "historial" && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setHistorialFacturadoFilter("TODOS")}
                className={`px-2.5 py-1 rounded-md transition text-[11px] whitespace-nowrap ${
                  historialFacturadoFilter === "TODOS"
                    ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setHistorialFacturadoFilter("FACTURADOS")}
                className={`px-2.5 py-1 rounded-md transition text-[11px] whitespace-nowrap ${
                  historialFacturadoFilter === "FACTURADOS"
                    ? "bg-emerald-600 text-white font-bold shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Solo Facturados
              </button>
              <button
                type="button"
                onClick={() => setHistorialFacturadoFilter("SIN_FACTURAR")}
                className={`px-2.5 py-1 rounded-md transition text-[11px] whitespace-nowrap ${
                  historialFacturadoFilter === "SIN_FACTURAR"
                    ? "bg-rose-600 text-white font-bold shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Sin Facturar
              </button>
            </div>
          )}

          {/* Filtro Dinámico de Productos de la Empresa */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold overflow-x-auto max-w-full">
            {["TODOS", ...catalogProductos].map((p) => (
              <button
                key={p}
                onClick={() => setProductoFiltro(p)}
                className={`px-2.5 py-1 rounded-md transition text-[11px] whitespace-nowrap ${
                  productoFiltro === p
                    ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Buscador Rápido (Con soporte directo de Nº de Factura) */}
        <div className="relative w-full md:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={activeMainTab === "historial" ? "Buscar por Nº de Factura, placa, cliente, MIC..." : "Buscar por MIC, tramo, placa o cliente..."}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 transition"
          />
        </div>
      </div>

      {/* ============================================================== */}
      {/* VISTA 1: PLANILLA OFICIAL AGRUPADA (17 Columnas + Subtotales)   */}
      {/* ============================================================== */}
      {activeMainTab === "planilla" && (
        loading ? (
          <div className="flex flex-col justify-center items-center py-24 gap-3 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm dark:shadow-xl">
            <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Cargando registros...</span>
          </div>
        ) : filtered.length === 0 ? (
          viajes.length === 0 ? (
            /* Guía de Inicio Rápido para Viajes */
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 sm:p-14 text-center max-w-2xl mx-auto shadow-sm dark:shadow-2xl">
              <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-5 shadow-xl shadow-amber-500/10">
                <Navigation className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Aún no has registrado viajes en el periodo {periodo}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto mb-6 leading-relaxed">
                Ingresa los despachos y recepciones de combustible. El sistema calculará en tiempo real el flete bruto en Bs, los subtotales agrupados por tramo y las mermas contractuales YPFB.
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
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center max-w-md mx-auto shadow-sm dark:shadow-xl">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Search className="w-6 h-6" />
              </div>
              <p className="text-base font-bold text-slate-900 dark:text-white">Sin resultados para la búsqueda</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-5">
                No hay viajes que coincidan con los filtros aplicados en la planilla.
              </p>
              <button
                onClick={() => { setSearch(""); setPlacaFiltro(""); setProductoFiltro("TODOS"); }}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition"
              >
                Restablecer Filtros
              </button>
            </div>
          )
        ) : (
          <div className="bg-white dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm dark:shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-black uppercase text-[10px]">
                    <th className="py-3 px-1 text-center">Nº</th>
                    <th className="py-3 px-2 text-center whitespace-nowrap">FECHA DE CARGA</th>
                    <th className="py-3 px-2 text-center whitespace-nowrap">FECHA DE DESCARGA</th>
                    <th className="py-3 px-2 text-center whitespace-nowrap">MCI/DTA Nº Y OTROS</th>
                    <th className="py-3 px-2 text-center">PLACA</th>
                    <th className="py-3 px-2.5 text-left">TRAMO</th>
                    <th className="py-3 px-2 text-center">CLIENTE</th>
                    <th className="py-3 px-2 text-center">PRODUCTO</th>
                    <th className="py-3 px-2 text-right whitespace-nowrap">Volumen en Lt. Origen</th>
                    <th className="py-3 px-2 text-right whitespace-nowrap">Volumen Recepcionado/Descargado</th>
                    <th className="py-3 px-1.5 text-right whitespace-nowrap">Merma T/Tr</th>
                    <th className="py-3 px-1.5 text-right whitespace-nowrap">Total Merma (Lt)</th>
                    <th className="py-3 px-1.5 text-center whitespace-nowrap">MERMA Tolerable</th>
                    <th className="py-3 px-2 text-right whitespace-nowrap">Merma a Descontar Y.P.F.B. Bs.</th>
                    <th className="py-3 px-2 text-right whitespace-nowrap">Volumen Facturado</th>
                    <th className="py-3 px-2 text-right whitespace-nowrap">TARIFA Bs.</th>
                    <th className="py-3 px-2 text-right whitespace-nowrap">Total a pagar en Bob.</th>
                    <th className="py-3 px-2 text-center whitespace-nowrap">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {(() => {
                    // Agrupación de viajes por (tramo, producto) y orden cronológico
                    const groupsMap: { [k: string]: { tramo: string; producto: string; items: Viaje[] } } = {};
                    for (const v of filtered) {
                      const t = (v.tramo || "SIN TRAMO").trim().toUpperCase();
                      const p = (v.producto || "SIN PRODUCTO").trim().toUpperCase();
                      const key = `${t}___${p}`;
                      if (!groupsMap[key]) {
                        groupsMap[key] = { tramo: t, producto: p, items: [] };
                      }
                      groupsMap[key].items.push(v);
                    }

                    const groups = Object.values(groupsMap).map((g) => {
                      g.items.sort((a, b) => (a.fecha_carga || "").localeCompare(b.fecha_carga || ""));
                      return g;
                    });

                    let globalIdx = 0;

                    return groups.map((group, gIdx) => {
                      const grpVolOrig = group.items.reduce((acc, x) => acc + (Number(x.volumen_origen_litros) || 0), 0);
                      const grpVolRec = group.items.reduce((acc, x) => acc + (Number(x.volumen_recepcionado_litros) || 0), 0);
                      const grpMermaReal = group.items.reduce((acc, x) => acc + (Number(x.merma_real_litros) || 0), 0);
                      const grpMermaExc = group.items.reduce((acc, x) => acc + (Number(x.merma_excedente_litros) || 0), 0);
                      const grpMermaTol = group.items.reduce((acc, x) => acc + (Number(x.merma_tolerable_litros) || 0), 0);
                      const grpMDesc = group.items.reduce((acc, x) => acc + (Number(x.merma_descontar_bs) || 0), 0);
                      const grpVolFact = group.items.reduce((acc, x) => acc + (Number(x.volumen_facturado) || (Number(x.volumen_recepcionado_litros) / 1000) || 0), 0);
                      const grpFlete = group.items.reduce((acc, x) => acc + (Number(x.flete_total_bs) || 0), 0);
                      const grpTarifa = group.items[0]?.tarifa_flete || 0;

                      const nrosFac = Array.from(new Set(group.items.map(x => x.nro_factura).filter(Boolean)));
                      const fechasFac = Array.from(new Set(group.items.map(x => x.fecha_factura).filter(Boolean)));
                      const facLabel = nrosFac.length > 0 ? nrosFac.join(", ") : "S/F";
                      const fechaLabel = fechasFac.length > 0 ? fechasFac.map(f => formatDate(f)).join(", ") : "-";

                      return (
                        <Fragment key={`grp-${gIdx}`}>
                          {group.items.map((v) => {
                            globalIdx++;
                            return (
                              <tr key={v.id} className="hover:bg-amber-50/40 dark:hover:bg-slate-800/50 transition">
                                <td className="py-2.5 px-1 text-center font-bold text-slate-700 dark:text-slate-300">{globalIdx}</td>
                                <td className="py-2.5 px-2 text-center text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDate(v.fecha_carga)}</td>
                                <td className="py-2.5 px-2 text-center text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDate(v.fecha_descarga)}</td>
                                <td className="py-2.5 px-2 text-center font-mono font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">{v.mic_dta || "-"}</td>
                                <td className="py-2.5 px-2 text-center">
                                  <div className="font-mono font-bold text-slate-900 dark:text-white flex items-center justify-center gap-1.5">
                                    <span>{v.placa}</span>
                                  </div>
                                  {v.es_apoyo ? (
                                    <div className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold flex items-center justify-center gap-1 mt-0.5">
                                      <Handshake className="w-3 h-3 text-amber-600 dark:text-amber-500" />
                                      <span className="truncate max-w-[100px]" title={v.empresa_apoyo_nombre || "Empresa de Apoyo"}>
                                        {v.empresa_apoyo_nombre || "Apoyo"}
                                      </span>
                                    </div>
                                  ) : null}
                                </td>
                                <td className="py-2.5 px-2.5 text-slate-700 dark:text-slate-300 truncate max-w-[160px]" title={v.tramo}>
                                  {v.tramo}
                                </td>
                                <td className="py-2.5 px-2 text-center font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                  {v.cliente || "Y.P.F.B."}
                                </td>
                                <td className="py-2.5 px-2 text-center whitespace-nowrap">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                    v.producto === "GASOLINA" 
                                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" 
                                      : v.producto === "DIESEL"
                                      ? "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30"
                                      : v.producto.includes("PLANCHA")
                                      ? "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30"
                                      : v.producto.includes("SOYA")
                                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                      : v.producto.includes("GIRASOL")
                                      ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30"
                                      : "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30"
                                  }`}>
                                    {v.producto}
                                  </span>
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatNumber(v.volumen_origen_litros, 0)} L</td>
                                <td className="py-2.5 px-2 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{formatNumber(v.volumen_recepcionado_litros, 0)} L</td>
                                <td className="py-2.5 px-1.5 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                  {v.merma_real_litros > 0 ? `-${formatNumber(v.merma_real_litros, 1)}` : formatNumber(v.merma_real_litros, 1)} L
                                </td>
                                <td className={`py-2.5 px-1.5 text-right font-mono whitespace-nowrap ${v.merma_excedente_litros > 0 ? "text-amber-700 dark:text-amber-400 font-bold" : "text-slate-400 dark:text-slate-500"}`}>
                                  {formatNumber(v.merma_excedente_litros, 1)} L
                                </td>
                                <td className="py-2.5 px-1.5 text-center font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                  {v.merma_tolerable_litros ? v.merma_tolerable_litros.toFixed(0) : "0"} L
                                </td>
                                <td className={`py-2.5 px-2 text-right font-mono whitespace-nowrap ${v.merma_descontar_bs > 0 ? "text-rose-700 dark:text-rose-400 font-bold" : "text-slate-400 dark:text-slate-500"}`}>
                                  {formatCurrency(v.merma_descontar_bs)}
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono font-bold text-sky-700 dark:text-sky-400 whitespace-nowrap">
                                  {formatNumber(v.volumen_facturado !== null && v.volumen_facturado !== undefined ? v.volumen_facturado : (v.volumen_recepcionado_litros / 1000), 3)}
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                  Bs. {formatNumber(v.tarifa_flete, 2)}
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                                  <div>{formatCurrency(v.flete_total_bs)}</div>
                                  {((v.total_descuentos_adicionales_bs || 0) + (v.total_descuentos_mermas_bs || 0)) > 0 && (
                                    <div className="text-[9px] text-rose-500 font-normal">
                                      Desc: -{formatCurrency((v.total_descuentos_adicionales_bs || 0) + (v.total_descuentos_mermas_bs || 0))}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-2 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => handleDuplicate(v)}
                                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition"
                                      title="Duplicar Despacho"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => openEditModal(v)}
                                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
                                      title="Editar Despacho"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDelete(v)}
                                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition"
                                      title="Eliminar Despacho"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}

                          {/* FILA ESPECIAL: Subtotal del Grupo con Facturación y Fechas */}
                          <tr className="bg-amber-100/70 dark:bg-amber-950/40 font-bold border-y-2 border-amber-300 dark:border-amber-700 text-[10.5px]">
                            <td colSpan={8} className="py-2.5 px-3 text-left border-x border-amber-300 dark:border-amber-700">
                              <span className="font-black text-amber-900 dark:text-amber-300 uppercase mr-2">TOTAL {group.producto}</span>
                              <span className="text-slate-700 dark:text-slate-300 font-medium">| FACTURA: <strong className="font-mono text-slate-900 dark:text-white">{facLabel}</strong></span>
                              <span className="text-slate-700 dark:text-slate-300 font-medium ml-2">| FECHA FACTURA: <strong className="text-slate-900 dark:text-white">{fechaLabel}</strong></span>
                            </td>
                            <td className="py-2 px-2 text-right font-mono border-x border-amber-300 dark:border-amber-700 font-bold text-slate-900 dark:text-white">{formatNumber(grpVolOrig, 0)} L</td>
                            <td className="py-2 px-2 text-right font-mono border-x border-amber-300 dark:border-amber-700 font-bold text-emerald-800 dark:text-emerald-300">{formatNumber(grpVolRec, 0)} L</td>
                            <td className="py-2 px-1 text-right font-mono border-x border-amber-300 dark:border-amber-700 font-bold text-slate-700 dark:text-slate-300">-{formatNumber(Math.abs(grpMermaReal), 1)} L</td>
                            <td className="py-2 px-1 text-right font-mono border-x border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-400">{formatNumber(grpMermaExc, 1)} L</td>
                            <td className="py-2 px-1 text-center font-mono border-x border-amber-300 dark:border-amber-700 text-slate-500">{formatNumber(grpMermaTol, 1)} L</td>
                            <td className="py-2 px-2 text-right font-mono border-x border-amber-300 dark:border-amber-700 font-bold text-rose-700 dark:text-rose-400">{formatCurrency(grpMDesc)}</td>
                            <td className="py-2 px-2 text-right font-mono border-x border-amber-300 dark:border-amber-700 font-black text-sky-800 dark:text-sky-300">{formatNumber(grpVolFact, 3)}</td>
                            <td className="py-2 px-2 text-right font-mono border-x border-amber-300 dark:border-amber-700 text-slate-700 dark:text-slate-300">Bs. {formatNumber(grpTarifa, 2)}</td>
                            <td className="py-2 px-2 text-right font-mono border-x border-amber-300 dark:border-amber-700 font-black text-amber-900 dark:text-amber-400">{formatCurrency(grpFlete)}</td>
                            <td className="py-2 px-1 border-x border-amber-300 dark:border-amber-700"></td>
                          </tr>
                        </Fragment>
                      );
                    });
                  })()}

                  {/* Fila de Totales Generales de Planilla */}
                  <tr className="bg-slate-100 dark:bg-slate-800/90 font-black text-slate-900 dark:text-white border-t-2 border-b border-slate-300 dark:border-slate-700 text-xs">
                    <td colSpan={8} className="py-3 px-3 text-right uppercase border-x border-slate-300 dark:border-slate-700">
                      TOTAL GENERAL:
                    </td>
                    <td className="py-3 px-2 text-right font-mono border-x border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-white">{formatNumber(totalDespachado, 0)} L</td>
                    <td className="py-3 px-2 text-right font-mono border-x border-slate-300 dark:border-slate-700 font-bold text-emerald-700 dark:text-emerald-400">{formatNumber(totalRecepcionado, 0)} L</td>
                    <td className="py-3 px-1.5 text-right font-mono border-x border-slate-300 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300">-{formatNumber(Math.abs(totalMermaReal), 1)} L</td>
                    <td className="py-3 px-1.5 border-x border-slate-300 dark:border-slate-700"></td>
                    <td className="py-3 px-1.5 border-x border-slate-300 dark:border-slate-700"></td>
                    <td className="py-3 px-2 text-right font-mono border-x border-slate-300 dark:border-slate-700 font-bold text-rose-700 dark:text-rose-400">{formatCurrency(totalDescMermaBs)}</td>
                    <td className="py-3 px-2 text-right font-mono border-x border-slate-300 dark:border-slate-700 font-black text-sky-700 dark:text-sky-400">{formatNumber(totalVolFacturado, 3)}</td>
                    <td className="py-3 px-2 border-x border-slate-300 dark:border-slate-700"></td>
                    <td className="py-3 px-2 text-right font-mono border-x border-slate-300 dark:border-slate-700 font-black text-amber-600 dark:text-amber-400 text-sm">{formatCurrency(totalFleteBs)}</td>
                    <td className="py-3 px-2 border-x border-slate-300 dark:border-slate-700"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ============================================================== */}
      {/* VISTA 2: HISTORIAL DE VIAJES & AUDITORÍA DE FACTURACIÓN          */}
      {/* ============================================================== */}
      {activeMainTab === "historial" && (
        loading ? (
          <div className="flex flex-col justify-center items-center py-24 gap-3 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm dark:shadow-xl">
            <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Buscando en historial...</span>
          </div>
        ) : historialFiltered.length === 0 ? (
          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center max-w-md mx-auto shadow-sm dark:shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Search className="w-6 h-6" />
            </div>
            <p className="text-base font-bold text-slate-900 dark:text-white">Sin registros de historial</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-5">
              No se encontraron viajes con los criterios de búsqueda o factura especificados.
            </p>
            <button
              onClick={() => { setSearch(""); setPlacaFiltro(""); setProductoFiltro("TODOS"); setHistorialFacturadoFilter("TODOS"); }}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition"
            >
              Restablecer Filtros
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm dark:shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-black uppercase text-[10px]">
                    <th className="py-3 px-3 whitespace-nowrap">Nº Factura</th>
                    <th className="py-3 px-2.5 whitespace-nowrap">Fecha Fact.</th>
                    <th className="py-3 px-3 whitespace-nowrap">MCI/DTA Nº Y OTROS</th>
                    <th className="py-3 px-2.5">Placa</th>
                    <th className="py-3 px-2.5 whitespace-nowrap">Fechas Carga/Desc.</th>
                    <th className="py-3 px-3">Tramo</th>
                    <th className="py-3 px-2.5">Cliente</th>
                    <th className="py-3 px-2.5">Producto</th>
                    <th className="py-3 px-2.5 text-right whitespace-nowrap">Vol. Facturado</th>
                    <th className="py-3 px-2.5 text-right whitespace-nowrap">Tarifa</th>
                    <th className="py-3 px-3 text-right whitespace-nowrap">Total Flete Bs.</th>
                    <th className="py-3 px-2 text-right whitespace-nowrap">Descuentos</th>
                    <th className="py-3 px-2.5 text-center">Estado</th>
                    <th className="py-3 px-3 text-center whitespace-nowrap">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {historialFiltered.map((v) => {
                    const totDesc = (v.total_descuentos_adicionales_bs || 0) + (v.total_descuentos_mermas_bs || 0) + (v.merma_descontar_bs || 0);
                    return (
                      <tr key={`hist-${v.id}`} className="hover:bg-amber-50/40 dark:hover:bg-slate-800/50 transition">
                        <td className="py-3 px-3 whitespace-nowrap">
                          {v.nro_factura && v.nro_factura.trim() ? (
                            <span className="inline-flex items-center gap-1 font-mono font-black text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/25">
                              <Tag className="w-3 h-3 text-emerald-600" />
                              <span>{v.nro_factura}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 font-bold">
                              Sin Facturar
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2.5 text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {v.fecha_factura ? formatDate(v.fecha_factura) : "-"}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                          {v.mic_dta || "-"}
                        </td>
                        <td className="py-3 px-2.5">
                          <div className="font-mono font-bold text-slate-900 dark:text-white">
                            {v.placa}
                          </div>
                          {v.es_apoyo ? (
                            <span className="text-[9px] text-blue-600 font-semibold block truncate max-w-[90px]" title={v.empresa_apoyo_nombre || "Apoyo"}>
                              {v.empresa_apoyo_nombre || "Apoyo"}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-3 px-2.5 text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          <div>C: {formatDate(v.fecha_carga)}</div>
                          <div>D: {formatDate(v.fecha_descarga)}</div>
                        </td>
                        <td className="py-3 px-3 text-slate-700 dark:text-slate-300 truncate max-w-[150px]" title={v.tramo}>
                          {v.tramo}
                        </td>
                        <td className="py-3 px-2.5 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {v.cliente || "Y.P.F.B."}
                        </td>
                        <td className="py-3 px-2.5 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            v.producto === "GASOLINA" 
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" 
                              : v.producto === "DIESEL"
                              ? "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30"
                              : "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30"
                          }`}>
                            {v.producto}
                          </span>
                        </td>
                        <td className="py-3 px-2.5 text-right font-mono font-bold text-sky-700 dark:text-sky-400 whitespace-nowrap">
                          {formatNumber(v.volumen_facturado !== null && v.volumen_facturado !== undefined ? v.volumen_facturado : (v.volumen_recepcionado_litros / 1000), 3)}
                        </td>
                        <td className="py-3 px-2.5 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          Bs. {formatNumber(v.tarifa_flete, 2)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                          {formatCurrency(v.flete_total_bs)}
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-[11px] whitespace-nowrap">
                          {totDesc > 0 ? (
                            <span className="text-rose-600 dark:text-rose-400 font-bold">
                              -{formatCurrency(totDesc)}
                            </span>
                          ) : (
                            <span className="text-slate-400">Bs. 0.00</span>
                          )}
                        </td>
                        <td className="py-3 px-2.5 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            v.estado === "Liquidado"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                          }`}>
                            {v.estado}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setSelectedViajeDetail(v)}
                              className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition"
                              title="Ver Detalle Completo de Viaje y Descuentos"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDuplicate(v)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition"
                              title="Duplicar Despacho"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openEditModal(v)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
                              title="Editar Despacho"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(v)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition"
                              title="Eliminar Despacho"
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
          </div>
        )
      )}

      {/* Modal de Inspección Detallada de Viaje (Historial) */}
      {selectedViajeDetail && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md overflow-hidden animate-in fade-in">
            <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0 bg-white dark:bg-slate-900">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Detalle de Despacho #{selectedViajeDetail.id}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        selectedViajeDetail.estado === "Liquidado"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                      }`}>
                        {selectedViajeDetail.estado}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      Placa: <strong className="text-slate-900 dark:text-white">{selectedViajeDetail.placa}</strong> | MIC: {selectedViajeDetail.mic_dta || "S/N"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedViajeDetail(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Contenido con scroll */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                {/* Datos de Facturación */}
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">Facturación</span>
                    <span className="font-mono text-sm font-black text-amber-900 dark:text-amber-300">
                      {selectedViajeDetail.nro_factura ? `Nº ${selectedViajeDetail.nro_factura}` : "SIN FACTURA ASIGNADA"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">Fecha Factura</span>
                    <span className="text-slate-800 dark:text-slate-200 font-medium">
                      {selectedViajeDetail.fecha_factura ? formatDate(selectedViajeDetail.fecha_factura) : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">Periodo</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {selectedViajeDetail.periodo_mes}
                    </span>
                  </div>
                </div>

                {/* Ruta y Producto */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Ruta y Cliente</span>
                    <div className="font-bold text-slate-900 dark:text-white">{selectedViajeDetail.tramo}</div>
                    <div className="text-slate-500">Cliente: <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedViajeDetail.cliente}</span></div>
                    <div className="text-slate-500">
                      Carga: {formatDate(selectedViajeDetail.fecha_carga)} | Descarga: {formatDate(selectedViajeDetail.fecha_descarga)}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Cisterna y Carga</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{selectedViajeDetail.placa}</span>
                      {selectedViajeDetail.es_apoyo && (
                        <span className="text-[10px] bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                          Apoyo ({selectedViajeDetail.empresa_apoyo_nombre || "Empresa"})
                        </span>
                      )}
                    </div>
                    <div className="text-slate-500">Producto: <span className="font-bold text-amber-600 dark:text-amber-400">{selectedViajeDetail.producto}</span></div>
                    <div className="text-slate-500">Tarifa Pactada: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">Bs. {formatNumber(selectedViajeDetail.tarifa_flete, 2)}</span> ({selectedViajeDetail.tipo_tarifa || "BS_POR_M3"})</div>
                  </div>
                </div>

                {/* Volúmenes y Mermas Contractuales YPFB */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Cálculo Operativo de Volúmenes y Mermas (Norma YPFB)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Vol. Origen:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{formatNumber(selectedViajeDetail.volumen_origen_litros, 0)} L</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Vol. Recepcionado:</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatNumber(selectedViajeDetail.volumen_recepcionado_litros, 0)} L</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Vol. Facturado:</span>
                      <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                        {formatNumber(selectedViajeDetail.volumen_facturado !== null && selectedViajeDetail.volumen_facturado !== undefined ? selectedViajeDetail.volumen_facturado : (selectedViajeDetail.volumen_recepcionado_litros / 1000), 3)}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Merma Real:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{formatNumber(selectedViajeDetail.merma_real_litros, 1)} L</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Tolerancia %:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{selectedViajeDetail.tolerancia_pct}%</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Merma Tolerable:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{formatNumber(selectedViajeDetail.merma_tolerable_litros, 1)} L</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Merma Excedente:</span>
                      <span className={`font-mono font-bold ${selectedViajeDetail.merma_excedente_litros > 0 ? "text-amber-600" : "text-slate-500"}`}>
                        {formatNumber(selectedViajeDetail.merma_excedente_litros, 1)} L
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Desc. Merma YPFB:</span>
                      <span className={`font-mono font-bold ${selectedViajeDetail.merma_descontar_bs > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                        {formatCurrency(selectedViajeDetail.merma_descontar_bs)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Descuentos Adicionales y de Merma */}
                {(() => {
                  let adicList: ItemDescuento[] = [];
                  if (Array.isArray(selectedViajeDetail.descuentos_adicionales)) adicList = selectedViajeDetail.descuentos_adicionales;
                  else if (typeof selectedViajeDetail.descuentos_adicionales === "string") {
                    try { adicList = JSON.parse(selectedViajeDetail.descuentos_adicionales); } catch (e) {}
                  }

                  let mermList: ItemDescuento[] = [];
                  if (Array.isArray(selectedViajeDetail.descuentos_mermas)) mermList = selectedViajeDetail.descuentos_mermas;
                  else if (typeof selectedViajeDetail.descuentos_mermas === "string") {
                    try { mermList = JSON.parse(selectedViajeDetail.descuentos_mermas); } catch (e) {}
                  }

                  if (adicList.length === 0 && mermList.length === 0) return null;

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {adicList.length > 0 && (
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1.5">
                            Descuentos Adicionales ({adicList.length})
                          </span>
                          <div className="space-y-1">
                            {adicList.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-[11px] py-0.5 border-b border-slate-200 dark:border-slate-800 last:border-none">
                                <span className="text-slate-700 dark:text-slate-300">{item.concepto || `Concepto #${idx + 1}`}</span>
                                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">-{formatCurrency(item.monto || 0)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {mermList.length > 0 && (
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1.5">
                            Descuentos de Merma Registrados ({mermList.length})
                          </span>
                          <div className="space-y-1">
                            {mermList.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-[11px] py-0.5 border-b border-slate-200 dark:border-slate-800 last:border-none">
                                <span className="text-slate-700 dark:text-slate-300">{item.concepto || `Merma #${idx + 1}`}</span>
                                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">-{formatCurrency(item.monto || 0)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Resumen Financiero Total */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Total a Pagar en Bob.</span>
                    <span className="text-xs text-slate-400">Volumen Facturado × Tarifa Pactada</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black font-mono text-amber-600 dark:text-amber-400">
                      {formatCurrency(selectedViajeDetail.flete_total_bs)}
                    </span>
                  </div>
                </div>

                {/* Observaciones */}
                {selectedViajeDetail.observaciones && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px]">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Observaciones</span>
                    <p className="text-slate-700 dark:text-slate-300 italic">{selectedViajeDetail.observaciones}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const v = selectedViajeDetail;
                    setSelectedViajeDetail(null);
                    openEditModal(v);
                  }}
                  className="px-4 py-2 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-xl border border-amber-500/30 transition flex items-center gap-1.5"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Editar este Despacho</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedViajeDetail(null)}
                  className="px-5 py-2 text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl hover:opacity-90 transition"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal Importar Masivamente desde Excel (Responsivo sin cortes) */}
      {showImportModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md overflow-hidden animate-in fade-in">
          <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            
            {/* Header Fijo */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Importar Viajes (Excel)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Carga masiva conforme a la plantilla oficial de 17 columnas
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario con Scroll Interno */}
            <form id="import-form" onSubmit={handleImportSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-400">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  <span>Plantilla Oficial de Liquidación (17 Columnas)</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Descárgala antes para completar los despachos con el formato idéntico a la planilla física YPFB.
                </p>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 underline"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Plantilla Oficial (.xlsx)</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase">
                  Selecciona el archivo Excel (.xlsx) *
                </label>
                <input
                  type="file"
                  required
                  accept=".xlsx, .xlsm, .xltx"
                  onChange={(e) => setImportFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-xs text-slate-600 dark:text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-500/10 file:text-amber-600 dark:file:text-amber-400 hover:file:bg-amber-500/20 cursor-pointer border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 bg-slate-50 dark:bg-slate-950"
                />
                {importFile && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Archivo listo: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)</span>
                  </p>
                )}
              </div>
            </form>

            {/* Footer Fijo */}
            <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="import-form"
                disabled={!importFile || importing}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 active:scale-95"
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

          </div>
        </div>
        </ModalPortal>
      )}

      {/* Modal Registrar / Editar Despacho (Responsivo sin cortes y con cálculo automático) */}
      {showModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md overflow-hidden animate-in fade-in">
          <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            
            {/* Header Fijo */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0 bg-white dark:bg-slate-900">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  {editingViaje ? "Editar Despacho / Viaje" : "Registrar Nuevo Despacho"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Fechas, documento, cisterna, tramo, cliente, producto, volúmenes y tarifa
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario con Scroll Interno */}
            <form id="viaje-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              
              {/* Fila 1: Fechas de Carga y Descarga */}
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Fecha de Carga *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.fecha_carga}
                      onChange={(e) => {
                        const val = e.target.value;
                        const newPeriod = determineTripPeriod(val, formData.fecha_descarga);
                        setFormData({ 
                          ...formData, 
                          fecha_carga: val,
                          periodo_mes: newPeriod
                        });
                      }}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Fecha de Descarga *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.fecha_descarga}
                      onChange={(e) => {
                        const val = e.target.value;
                        const newPeriod = determineTripPeriod(formData.fecha_carga, val);
                        setFormData({ 
                          ...formData, 
                          fecha_descarga: val,
                          periodo_mes: newPeriod
                        });
                      }}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Badge Informativo de Asignación Mensual con Holgura */}
                <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-slate-600 dark:text-slate-300 text-[11px]">
                      Mes de Liquidación Asignado:
                    </span>
                    <span className="font-mono font-black text-amber-600 dark:text-amber-400">
                      {formData.periodo_mes}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    Regla de holgura (1-2 días fin de mes)
                  </span>
                </div>
              </div>

              {/* Fila 2: MCI/DTA Nº Y OTROS y Placa */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    MCI/DTA Nº Y OTROS
                  </label>
                  <input
                    type="text"
                    value={formData.mic_dta}
                    onChange={(e) => setFormData({ ...formData, mic_dta: e.target.value.toUpperCase() })}
                    placeholder="ej. 23BO051130T u otro doc."
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono uppercase text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Placa del Camión */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                      Placa del Camión *
                    </label>
                    {formData.placa && (
                      (() => {
                        const isPropia = unidades.some(u => u.placa?.toUpperCase() === formData.placa.toUpperCase());
                        const isApoyo = unidadesApoyo.some(u => u.placa?.toUpperCase() === formData.placa.toUpperCase());
                        if (isPropia) {
                          return (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/25 inline-flex items-center gap-1">
                              <Truck className="w-2.5 h-2.5" />
                              Propia
                            </span>
                          );
                        }
                        if (isApoyo) {
                          return (
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/25 inline-flex items-center gap-1">
                              <Handshake className="w-2.5 h-2.5" />
                              Apoyo {formData.empresa_apoyo_nombre ? `(${formData.empresa_apoyo_nombre})` : ""}
                            </span>
                          );
                        }
                        return (
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/25">
                            ✨ Nueva Placa
                          </span>
                        );
                      })()
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      required
                      list="lista-placas-disponibles"
                      value={formData.placa}
                      onChange={(e) => handlePlacaChange(e.target.value)}
                      placeholder="ej. 4412-DPC (escribe o elige)"
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono font-bold uppercase text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
                    />
                    <datalist id="lista-placas-disponibles">
                      {unidades.map(u => (
                        <option key={`p-${u.id}`} value={u.placa}>
                          {u.placa} (Propia)
                        </option>
                      ))}
                      {unidadesApoyo.map(u => (
                        <option key={`a-${u.id}`} value={u.placa}>
                          {u.placa} (Apoyo)
                        </option>
                      ))}
                    </datalist>
                  </div>

                  {/* Acceso Rápido a Placas Registradas */}
                  {(unidades.length > 0 || unidadesApoyo.length > 0) && (
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-400 font-semibold mr-0.5">Sugerencias:</span>
                      {[...unidades.slice(0, 3), ...unidadesApoyo.slice(0, 2)].map(u => (
                        <button
                          key={u.placa}
                          type="button"
                          onClick={() => handlePlacaChange(u.placa)}
                          className={`text-[10px] px-2 py-0.5 rounded-lg font-mono font-bold transition border ${
                            formData.placa === u.placa
                              ? "bg-amber-500 text-slate-950 border-amber-600 font-black shadow-xs"
                              : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-500 hover:text-amber-500"
                          }`}
                        >
                          {u.placa}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Fila 3: Tramo y Cliente */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                      Tramo de Transporte *
                    </label>
                    <button
                      type="button"
                      onClick={handleCreateNuevoTramo}
                      className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Nuevo Tramo</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    list="tramos-sugeridos"
                    value={formData.tramo}
                    onChange={(e) => setFormData({ ...formData, tramo: e.target.value.toUpperCase() })}
                    placeholder="ej. ARICA - TAMBO QUEMADO - LA PAZ"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs uppercase text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
                  />
                  <datalist id="tramos-sugeridos">
                    {catalogTramos.map((tr) => (
                      <option key={tr} value={tr} />
                    ))}
                  </datalist>
                </div>

                {/* Cliente / Consignatario */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                      Cliente / Consignatario *
                    </label>
                    {formData.cliente && (
                      (() => {
                        const isReg = clientes.some(c => c.nombre?.toUpperCase() === formData.cliente.toUpperCase());
                        if (isReg) {
                          return (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/25">
                              ✓ Registrado
                            </span>
                          );
                        }
                        return (
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/25">
                            ✨ Nuevo Cliente
                          </span>
                        );
                      })()
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      required
                      list="lista-clientes-disponibles"
                      value={formData.cliente}
                      onChange={(e) => setFormData({ ...formData, cliente: e.target.value.toUpperCase() })}
                      placeholder="ej. Y.P.F.B. (escribe o elige)"
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-bold uppercase text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
                    />
                    <datalist id="lista-clientes-disponibles">
                      {clientes.map(c => (
                        <option key={c.id} value={c.nombre}>
                          {c.nombre} {c.nit ? `(NIT: ${c.nit})` : ""}
                        </option>
                      ))}
                    </datalist>
                  </div>

                  {/* Acceso Rápido a Clientes Registrados */}
                  {clientes.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-400 font-semibold mr-0.5">Clientes:</span>
                      {clientes.slice(0, 4).map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, cliente: c.nombre.toUpperCase() })}
                          className={`text-[10px] px-2 py-0.5 rounded-lg font-bold transition border ${
                            formData.cliente.toUpperCase() === c.nombre.toUpperCase()
                              ? "bg-amber-500 text-slate-950 border-amber-600 font-black shadow-xs"
                              : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-500 hover:text-amber-500"
                          }`}
                        >
                          {c.nombre}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Fila 4: Facturación (Nº de Factura y Fecha de Facturación) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Nº de Factura
                  </label>
                  <input
                    type="text"
                    value={formData.nro_factura}
                    onChange={(e) => setFormData({ ...formData, nro_factura: e.target.value })}
                    placeholder="ej. F-001248"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono uppercase text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Fecha de Facturación
                  </label>
                  <input
                    type="date"
                    value={formData.fecha_factura}
                    onChange={(e) => setFormData({ ...formData, fecha_factura: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Fila 5: Producto Transportado (Selector Visual Expandido y Dinámico por Empresa) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                    Producto Transportado *
                  </label>
                  <button
                    type="button"
                    onClick={handleCreateNuevoProducto}
                    className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Nuevo Producto</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {catalogProductos.map((prodName) => {
                    const pUpper = prodName.toUpperCase();
                    let tol = "0.25%";
                    if (pUpper.includes("DIESEL") || pUpper.includes("DIÉSEL") || pUpper === "DO") tol = "0.15%";
                    else if (pUpper.includes("IYA") || pUpper.includes("INSUMOS") || pUpper.includes("ADIT")) tol = "0.20%";
                    else if (pUpper.includes("PLANCHA") || pUpper.includes("SOYA") || pUpper.includes("GIRASOL") || pUpper.includes("ACERO")) tol = "0.00%";

                    const isSelected = formData.producto === prodName;
                    return (
                      <button
                        key={prodName}
                        type="button"
                        onClick={() => setFormData({ ...formData, producto: prodName })}
                        className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center gap-0.5 ${
                          isSelected
                            ? "bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 font-black shadow-sm ring-1 ring-amber-500/30"
                            : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                        }`}
                      >
                        <span className="text-xs font-bold leading-tight truncate max-w-full">{prodName}</span>
                        <span className="text-[10px] font-mono opacity-80">Tolerancia: {tol}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fila 6: Volúmenes, Volumen Facturado y Tarifa */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Volumen Origen (Lt) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={formData.volumen_origen_litros}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFormData({ ...formData, volumen_origen_litros: v === "" ? "" : v });
                    }}
                    onBlur={(e) => {
                      if (e.target.value === "" || isNaN(Number(e.target.value))) {
                        setFormData((prev) => ({ ...prev, volumen_origen_litros: 0 }));
                      }
                    }}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1 whitespace-nowrap">
                    Volumen Recepcionado/Descargado (Lt) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={formData.volumen_recepcionado_litros}
                    onChange={(e) => {
                      const v = e.target.value;
                      const numV = v === "" ? "" : Number(v);
                      setFormData(prev => ({
                        ...prev,
                        volumen_recepcionado_litros: v === "" ? "" : v,
                        volumen_facturado: v === "" ? "" : Math.round(((Number(numV) || 0) / 1000.0) * 1000) / 1000
                      }));
                    }}
                    onBlur={(e) => {
                      if (e.target.value === "" || isNaN(Number(e.target.value))) {
                        setFormData((prev) => ({ ...prev, volumen_recepcionado_litros: 0, volumen_facturado: 0 }));
                      }
                    }}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                      Volumen Facturado *
                    </label>
                  </div>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.volumen_facturado}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFormData({ ...formData, volumen_facturado: v === "" ? "" : v });
                    }}
                    onBlur={(e) => {
                      if (e.target.value === "" || isNaN(Number(e.target.value))) {
                        setFormData((prev) => ({ ...prev, volumen_facturado: 0 }));
                      }
                    }}
                    placeholder="0.000"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-sky-600 dark:text-sky-400 focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">Base: Vol. Fact. × Tarifa</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Tarifa Flete (Bs) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.tarifa_flete}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFormData({ ...formData, tarifa_flete: v === "" ? "" : v });
                    }}
                    onBlur={(e) => {
                      if (e.target.value === "" || isNaN(Number(e.target.value))) {
                        setFormData((prev) => ({ ...prev, tarifa_flete: 0 }));
                      }
                    }}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Fila 7: Listas Dinámicas de Descuentos (Adicionales y Mermas) */}
              <div className="space-y-3 pt-1">
                {/* 1. Descuentos Adicionales */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                        Descuentos Adicionales
                      </span>
                      {liveCalc.total_descuentos_adicionales > 0 && (
                        <span className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                          Total: {formatCurrency(liveCalc.total_descuentos_adicionales)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={addDescuentoAdicional}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 border border-amber-500/30 transition active:scale-95"
                    >
                      <Plus className="w-3 h-3 stroke-[3]" />
                      <span>Adicionar Descuento</span>
                    </button>
                  </div>

                  {formData.descuentos_adicionales.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">
                      Sin descuentos adicionales. Haz clic en "Adicionar Descuento" para agregar conceptos y montos.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {formData.descuentos_adicionales.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
                          <input
                            type="text"
                            placeholder="Concepto del descuento adicional..."
                            value={item.concepto}
                            onChange={(e) => updateDescuentoAdicional(idx, "concepto", e.target.value)}
                            className="flex-1 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
                          />
                          <div className="w-32 relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">Bs.</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={item.monto || ""}
                              onChange={(e) => updateDescuentoAdicional(idx, "monto", parseFloat(e.target.value) || 0)}
                              className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 text-right"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeDescuentoAdicional(idx)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition"
                            title="Eliminar este descuento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Descuentos Mermas */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                        Descuentos Mermas
                      </span>
                      {liveCalc.total_descuentos_mermas > 0 && (
                        <span className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                          Total: {formatCurrency(liveCalc.total_descuentos_mermas)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={addDescuentoMerma}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 border border-amber-500/30 transition active:scale-95"
                    >
                      <Plus className="w-3 h-3 stroke-[3]" />
                      <span>Adicionar Descuento Merma</span>
                    </button>
                  </div>

                  {formData.descuentos_mermas.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">
                      Sin descuentos por merma adicionales. Haz clic en "Adicionar Descuento Merma" para agregar conceptos y montos.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {formData.descuentos_mermas.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
                          <input
                            type="text"
                            placeholder="Concepto específico merma..."
                            value={item.concepto}
                            onChange={(e) => updateDescuentoMerma(idx, "concepto", e.target.value)}
                            className="flex-1 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
                          />
                          <div className="w-32 relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">Bs.</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={item.monto || ""}
                              onChange={(e) => updateDescuentoMerma(idx, "monto", parseFloat(e.target.value) || 0)}
                              className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 text-right"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeDescuentoMerma(idx)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition"
                            title="Eliminar este descuento de merma"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Fila 8: Panel de Cálculos Automáticos Oficiales (Tiempo Real) */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                <span className="font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider text-[10px] block">
                  Cálculos Automáticos YPFB en Tiempo Real:
                </span>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] block uppercase font-bold">Merma Real:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                      {liveCalc.merma_real > 0 ? `+${liveCalc.merma_real}` : liveCalc.merma_real} L
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] block uppercase font-bold">Tolerable ({liveCalc.tolerancia_pct}%):</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                      {liveCalc.merma_tolerable} L
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] block uppercase font-bold">Descuento Merma:</span>
                    <span className={`font-mono font-bold text-xs ${liveCalc.merma_descontar_bs > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {formatCurrency(liveCalc.merma_descontar_bs)}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] block uppercase font-bold">Total a Pagar:</span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs">
                      {formatCurrency(liveCalc.flete_total_bs)}
                    </span>
                  </div>
                </div>
              </div>

            </form>

            {/* Footer Fijo con Botones de Acción */}
            <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 transition active:scale-95"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="viaje-form"
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black rounded-xl shadow-md shadow-amber-500/20 transition active:scale-95 flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5 stroke-[3]" />
                <span>{editingViaje ? "Actualizar Despacho" : "Guardar Despacho"}</span>
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Modal de Confirmación para Guardar Datos Nuevos en Catálogo */}
      <SaveNewCatalogModal
        isOpen={showSaveNewModal}
        placa={pendingSaveData?.placa}
        isNewPlaca={Boolean(pendingSaveData?.isNewPlaca)}
        cliente={pendingSaveData?.cliente}
        isNewCliente={Boolean(pendingSaveData?.isNewCliente)}
        onConfirmSaveCatalog={handleConfirmSaveCatalog}
        onContinueWithoutSaving={executeSaveViaje}
        onCancel={() => setShowSaveNewModal(false)}
        loading={savingCatalog}
      />

    </div>
  );
}
