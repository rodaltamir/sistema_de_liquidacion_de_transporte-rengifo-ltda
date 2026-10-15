"use client";

import { Suspense, useState, useEffect, Fragment } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Navigation, 
  Search, 
  Edit, 
  Trash2, 
  Calendar, 
  Truck, 
  AlertTriangle, 
  CheckCircle2, 
  DollarSign,
  Copy,
  Download,
  X,
  FileCheck,
  Info,
  Scale,
  Handshake,
  History,
  Eye,
  Tag,
  FileText,
  Filter,
  Layers,
  Plus,
  FileSpreadsheet
} from "lucide-react";
import Swal from "sweetalert2";
import { apiFetch, getApiUrl } from "@/lib/api";
import { formatCurrency, formatNumber, formatDate } from "@/lib/format";
import DatePeriodFilter, { DateFilterChangeEvent } from "@/components/DatePeriodFilter";
import ModalPortal from "@/components/ModalPortal";
import SaveNewCatalogModal from "@/components/SaveNewCatalogModal";
import ImportExcelModal from "@/components/ImportExcelModal";

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
  descuentos_adicionales_json?: ItemDescuento[] | string | null;
  descuentos_mermas_json?: ItemDescuento[] | string | null;
  total_descuentos_adicionales_bs?: number;
  total_descuentos_mermas_bs?: number;
  flete_neto_pagable_bs?: number;
}

interface Unidad {
  id: number;
  placa: string;
  marca?: string;
  modelo?: string;
  capacidad_litros?: number;
}

interface UnidadApoyo {
  id: number;
  placa: string;
  empresa_id: number;
  empresa_nombre?: string;
}

interface Cliente {
  id: number;
  nombre: string;
  nit?: string;
}

// Validador de asignación a un único mes según fecha de carga (origen del despacho)
function determineTripPeriod(fechaCargaStr: string, fechaDescargaStr?: string): string {
  if (!fechaCargaStr) {
    if (fechaDescargaStr) return fechaDescargaStr.slice(0, 7);
    return new Date().toISOString().slice(0, 7);
  }
  return fechaCargaStr.slice(0, 7);
}

// Helper de volumen facturado en Litros (ej. 33.900 L, 33.910 L)
function getVolFactLitros(v: any): number {
  const raw = Number(v?.volumen_facturado);
  if (raw && raw > 0) {
    return raw < 1000 ? raw * 1000 : raw;
  }
  return Number(v?.volumen_recepcionado_litros) || 0;
}

function getVolFactM3(v: any): number {
  return getVolFactLitros(v) / 1000.0;
}

function HistorialViajesContent() {
  const routeParams = useParams();
  const schema = (routeParams?.schema as string) || "";
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [unidadesApoyo, setUnidadesApoyo] = useState<UnidadApoyo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);

  // Catálogos dinámicos
  const [catalogProductos, setCatalogProductos] = useState<string[]>([
    "GASOLINA",
    "DIESEL",
    "INSUMOS Y ADITIVOS"
  ]);
  const [catalogTramos, setCatalogTramos] = useState<string[]>([]);

  // Filtros
  const [search, setSearch] = useState("");
  const [facturadoFilter, setFacturadoFilter] = useState<"TODOS" | "FACTURADOS" | "SIN_FACTURAR">("TODOS");
  const [productoFiltro, setProductoFiltro] = useState<string>("TODOS");
  const [placaFiltro, setPlacaFiltro] = useState<string>("");
  const [tramoFiltro, setTramoFiltro] = useState<string>("");
  const [viewMode, setViewMode] = useState<"agrupado" | "plana">("agrupado");
  const [dateFilterQuery, setDateFilterQuery] = useState("");
  const [activeFilterLabel, setActiveFilterLabel] = useState("");

  // Modal de Detalle
  const [selectedViajeDetail, setSelectedViajeDetail] = useState<Viaje | null>(null);

  // Modal de Edición
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingViaje, setEditingViaje] = useState<Viaje | null>(null);
  const [formData, setFormData] = useState({
    mic_dta: "",
    nro_factura: "",
    fecha_factura: "",
    placa: "",
    tramo: "",
    cliente: "",
    producto: "GASOLINA",
    fecha_carga: "",
    fecha_descarga: "",
    periodo_mes: "",
    volumen_origen_litros: 0 as number | string,
    volumen_recepcionado_litros: 0 as number | string,
    volumen_facturado: 0 as number | string,
    tarifa_flete: 0 as number | string,
    observaciones: "",
    es_apoyo: false,
    empresa_apoyo_id: null as number | null,
    empresa_apoyo_nombre: "",
    descuentos_adicionales: [] as ItemDescuento[],
    descuentos_mermas: [] as ItemDescuento[]
  });

  // Modal para agregar catálogo nuevo
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogType, setCatalogType] = useState<"producto" | "tramo">("producto");

  // Carga inicial
  useEffect(() => {
    if (!schema) return;
    loadCatalogos();
    loadAuxiliares();
  }, [schema]);

  // Recarga al cambiar periodo
  useEffect(() => {
    if (!schema) return;
    loadViajes();
  }, [schema, dateFilterQuery]);

  const loadCatalogos = async () => {
    try {
      const res = await apiFetch(`/tenants/${schema}/parametros/catalogos`);
      if (res) {
        if (Array.isArray(res.productos) && res.productos.length > 0) {
          setCatalogProductos(res.productos);
        }
        if (Array.isArray(res.tramos) && res.tramos.length > 0) {
          setCatalogTramos(res.tramos);
        }
      }
    } catch (e) {
      console.warn("No se pudieron cargar catálogos dinámicos:", e);
    }
  };

  const loadAuxiliares = async () => {
    try {
      const [uData, aData, cData] = await Promise.all([
        apiFetch(`/tenants/${schema}/unidades/`).catch(() => []),
        apiFetch(`/tenants/${schema}/apoyo/unidades/todas`).catch(() => []),
        apiFetch(`/tenants/${schema}/clientes/`).catch(() => [])
      ]);
      setUnidades(Array.isArray(uData) ? uData : []);
      setUnidadesApoyo(Array.isArray(aData) ? aData : []);
      setClientes(Array.isArray(cData) ? cData : []);
    } catch (err) {
      console.error("Error al cargar auxiliares:", err);
    }
  };

  const loadViajes = async () => {
    setLoading(true);
    try {
      const url = dateFilterQuery
        ? `/tenants/${schema}/viajes/?${dateFilterQuery}&limit=1000`
        : `/tenants/${schema}/viajes/?limit=1000`;
      const data = await apiFetch(url);
      setViajes(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Error al cargar viajes:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDateFilterChange = (filter: DateFilterChangeEvent) => {
    setActiveFilterLabel(filter.label);
    let q = "";
    if (filter.mode === "mes" && filter.periodo_mes) {
      q = `periodo_mes=${filter.periodo_mes}`;
    } else if (filter.mode === "semestral" && filter.fecha_desde && filter.fecha_hasta) {
      q = `fecha_desde=${filter.fecha_desde}&fecha_hasta=${filter.fecha_hasta}`;
    } else if (filter.mode === "anual" && filter.anio) {
      q = `anio=${filter.anio}`;
    } else if (filter.mode === "personalizado" && filter.fecha_desde && filter.fecha_hasta) {
      q = `fecha_desde=${filter.fecha_desde}&fecha_hasta=${filter.fecha_hasta}`;
    } else if (filter.mode === "historico") {
      q = "";
    }
    setDateFilterQuery(q);
  };

  // Filtrado de viajes
  const filteredViajes = viajes.filter((v) => {
    const s = search.trim().toLowerCase();
    const matchSearch = 
      !s ||
      (v.nro_factura && v.nro_factura.toLowerCase().includes(s)) ||
      (v.placa && v.placa.toLowerCase().includes(s)) ||
      (v.mic_dta && v.mic_dta.toLowerCase().includes(s)) ||
      (v.tramo && v.tramo.toLowerCase().includes(s)) ||
      (v.cliente && v.cliente.toLowerCase().includes(s)) ||
      (v.producto && v.producto.toLowerCase().includes(s));

    if (!matchSearch) return false;

    if (facturadoFilter === "FACTURADOS") {
      if (!v.nro_factura || v.nro_factura.trim() === "" || v.nro_factura === "-") return false;
    } else if (facturadoFilter === "SIN_FACTURAR") {
      if (v.nro_factura && v.nro_factura.trim() !== "" && v.nro_factura !== "-") return false;
    }

    if (productoFiltro !== "TODOS" && v.producto?.toUpperCase() !== productoFiltro.toUpperCase()) {
      return false;
    }

    if (placaFiltro && v.placa?.toUpperCase() !== placaFiltro.toUpperCase()) {
      return false;
    }

    if (tramoFiltro && v.tramo?.toUpperCase() !== tramoFiltro.toUpperCase()) {
      return false;
    }

    return true;
  });

  // Métricas de Historial
  const totalViajes = filteredViajes.length;
  const facturadosList = filteredViajes.filter(v => v.nro_factura && v.nro_factura.trim() !== "" && v.nro_factura !== "-");
  const sinFacturaList = filteredViajes.filter(v => !v.nro_factura || v.nro_factura.trim() === "" || v.nro_factura === "-");
  
  const montoTotalFleteBs = filteredViajes.reduce((acc, v) => acc + (Number(v.flete_total_bs) || 0), 0);
  const totalMermasBs = filteredViajes.reduce((acc, v) => acc + (Number(v.merma_descontar_bs) || 0), 0);
  const totalDescAdicBs = filteredViajes.reduce((acc, v) => acc + (Number(v.total_descuentos_adicionales_bs) || 0) + (Number(v.total_descuentos_mermas_bs) || 0), 0);
  const totalDescuentosBs = totalMermasBs + totalDescAdicBs;
  const montoLiquidoBs = montoTotalFleteBs - totalDescuentosBs;

  const montoTotalFacturadoBs = facturadosList.reduce((acc, v) => acc + (Number(v.flete_total_bs) || 0), 0);
  const montoSinFacturaBs = sinFacturaList.reduce((acc, v) => acc + (Number(v.flete_total_bs) || 0), 0);

  const totalVolumenFacturadoLt = filteredViajes.reduce((acc, v) => acc + getVolFactLitros(v), 0);
  const totalVolumenFacturadoM3 = totalVolumenFacturadoLt / 1000.0;

  // Agrupación por (Tramo, Producto, Nro Factura)
  const groupsMap: { [k: string]: { tramo: string; producto: string; factura: string; items: Viaje[] } } = {};
  for (const v of filteredViajes) {
    const t = (v.tramo || "SIN TRAMO").trim().toUpperCase();
    const p = (v.producto || "SIN PRODUCTO").trim().toUpperCase();
    const f = (v.nro_factura || "").trim().toUpperCase() || "S/F";
    const key = `${t}___${p}___${f}`;
    if (!groupsMap[key]) {
      groupsMap[key] = { tramo: t, producto: p, factura: f, items: [] };
    }
    groupsMap[key].items.push(v);
  }

  const groups = Object.values(groupsMap).map((g) => {
    g.items.sort((a, b) => (a.fecha_carga || "").localeCompare(b.fecha_carga || ""));
    return g;
  });

  // Ordenar grupos cronológicamente por la fecha más antigua de sus viajes
  groups.sort((a, b) => {
    const dateA = a.items[0]?.fecha_carga || "";
    const dateB = b.items[0]?.fecha_carga || "";
    return dateA.localeCompare(dateB);
  });

  // Acciones: Editar
  const openEditModal = (v: Viaje) => {
    let adic: ItemDescuento[] = [];
    let merm: ItemDescuento[] = [];
    try {
      if (v.descuentos_adicionales_json) {
        adic = typeof v.descuentos_adicionales_json === "string" 
          ? JSON.parse(v.descuentos_adicionales_json) 
          : v.descuentos_adicionales_json;
      }
      if (v.descuentos_mermas_json) {
        merm = typeof v.descuentos_mermas_json === "string" 
          ? JSON.parse(v.descuentos_mermas_json) 
          : v.descuentos_mermas_json;
      }
    } catch (e) {
      console.warn("Error parsing descuentos:", e);
    }

    setEditingViaje(v);
    setFormData({
      mic_dta: v.mic_dta || "",
      nro_factura: v.nro_factura || "",
      fecha_factura: v.fecha_factura || "",
      placa: v.placa,
      tramo: v.tramo,
      cliente: v.cliente,
      producto: v.producto,
      fecha_carga: v.fecha_carga,
      fecha_descarga: v.fecha_descarga,
      periodo_mes: v.periodo_mes,
      volumen_origen_litros: v.volumen_origen_litros,
      volumen_recepcionado_litros: v.volumen_recepcionado_litros,
      volumen_facturado: v.volumen_facturado !== null && v.volumen_facturado !== undefined && Number(v.volumen_facturado) > 0
        ? (Number(v.volumen_facturado) < 1000 ? Math.round(Number(v.volumen_facturado) * 1000) : Number(v.volumen_facturado))
        : (v.volumen_recepcionado_litros || 0),
      tarifa_flete: v.tarifa_flete,
      observaciones: v.observaciones || "",
      es_apoyo: Boolean(v.es_apoyo),
      empresa_apoyo_id: v.empresa_apoyo_id || null,
      empresa_apoyo_nombre: v.empresa_apoyo_nombre || "",
      descuentos_adicionales: Array.isArray(adic) ? adic : [],
      descuentos_mermas: Array.isArray(merm) ? merm : []
    });
    setShowEditModal(true);
  };

  // Helpers para manejo de descuentos en modal de edición
  const addDescuentoAdicional = () => {
    setFormData(prev => ({
      ...prev,
      descuentos_adicionales: [...prev.descuentos_adicionales, { concepto: "", monto: 0 }]
    }));
  };

  const removeDescuentoAdicional = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      descuentos_adicionales: prev.descuentos_adicionales.filter((_, i) => i !== idx)
    }));
  };

  const updateDescuentoAdicional = (idx: number, field: "concepto" | "monto", val: any) => {
    setFormData(prev => {
      const copy = [...prev.descuentos_adicionales];
      copy[idx] = { ...copy[idx], [field]: val };
      return { ...prev, descuentos_adicionales: copy };
    });
  };

  const addDescuentoMerma = () => {
    setFormData(prev => ({
      ...prev,
      descuentos_mermas: [...prev.descuentos_mermas, { concepto: "", monto: 0 }]
    }));
  };

  const removeDescuentoMerma = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      descuentos_mermas: prev.descuentos_mermas.filter((_, i) => i !== idx)
    }));
  };

  const updateDescuentoMerma = (idx: number, field: "concepto" | "monto", val: any) => {
    setFormData(prev => {
      const copy = [...prev.descuentos_mermas];
      copy[idx] = { ...copy[idx], [field]: val };
      return { ...prev, descuentos_mermas: copy };
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingViaje) return;

    try {
      // Validaciones de descuentos adicionales
      for (let i = 0; i < formData.descuentos_adicionales.length; i++) {
        const item = formData.descuentos_adicionales[i];
        if (!item.concepto || !item.concepto.trim()) {
          Swal.fire({
            icon: "warning",
            title: "Descuento Incompleto",
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

      // Validaciones de descuentos por merma
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

      const totDescViaje = (liveCalc.mermaDescontarBs || 0) + (liveCalc.totAdic || 0) + (liveCalc.totMerm || 0);
      if (totDescViaje > liveCalc.fleteTotalBs && liveCalc.fleteTotalBs > 0) {
        const confirmDesc = await Swal.fire({
          title: "¿Descuentos mayores al flete?",
          text: `El total de descuentos (${formatCurrency(totDescViaje)}) supera el flete bruto (${formatCurrency(liveCalc.fleteTotalBs)}), resultando en un saldo neto de ${formatCurrency(liveCalc.netoPagable)}. ¿Deseas guardar los cambios?`,
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Sí, guardar despacho",
          cancelButtonText: "Revisar descuentos",
          confirmButtonColor: "#f59e0b",
          cancelButtonColor: "#334155",
          background: "#0f172a",
          color: "#f8fafc"
        });
        if (!confirmDesc.isConfirmed) return;
      }

      const vOrig = Number(formData.volumen_origen_litros) || 0;
      const vRec = Number(formData.volumen_recepcionado_litros) || 0;
      let vFact = formData.volumen_facturado !== "" && formData.volumen_facturado !== undefined
        ? Number(formData.volumen_facturado)
        : vRec;
      if (vFact < 1000) {
        vFact = vFact * 1000.0;
      }
      const tar = Number(formData.tarifa_flete) || 0;

      const payload = {
        ...formData,
        volumen_origen_litros: vOrig,
        volumen_recepcionado_litros: vRec,
        volumen_facturado: vFact,
        tarifa_flete: tar,
        descuentos_adicionales: formData.descuentos_adicionales,
        descuentos_mermas: formData.descuentos_mermas
      };

      await apiFetch(`/tenants/${schema}/viajes/${editingViaje.id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });

      Swal.fire({
        icon: "success",
        title: "¡Despacho Actualizado!",
        text: `El despacho de ${formData.placa} se actualizó y re-agrupó con éxito.`,
        timer: 1500,
        showConfirmButton: false,
        background: "#0f172a",
        color: "#f8fafc"
      });

      setShowEditModal(false);
      setEditingViaje(null);
      loadViajes();
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al actualizar",
        text: err.message,
        background: "#0f172a",
        color: "#f8fafc",
        confirmButtonColor: "#f59e0b"
      });
    }
  };

  const handleDelete = async (v: Viaje) => {
    const res = await Swal.fire({
      title: "¿Eliminar Despacho?",
      text: `Se eliminará el viaje de ${v.placa} (${v.tramo}) del historial permanentemente.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#e11d48",
      cancelButtonColor: "#475569",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      background: "#0f172a",
      color: "#f8fafc"
    });

    if (res.isConfirmed) {
      try {
        await apiFetch(`/tenants/${schema}/viajes/${v.id}`, { method: "DELETE" });
        setViajes(prev => prev.filter(item => item.id !== v.id));
        Swal.fire({
          icon: "success",
          title: "Eliminado",
          text: "El viaje fue eliminado del sistema.",
          timer: 1200,
          showConfirmButton: false,
          background: "#0f172a",
          color: "#f8fafc"
        });
      } catch (err: any) {
        Swal.fire({
          icon: "error",
          title: "Error al eliminar",
          text: err.message,
          background: "#0f172a",
          color: "#f8fafc"
        });
      }
    }
  };

  const handleDuplicate = async (v: Viaje) => {
    try {
      const payload = {
        mic_dta: v.mic_dta,
        nro_factura: v.nro_factura,
        fecha_factura: v.fecha_factura,
        placa: v.placa,
        tramo: v.tramo,
        cliente: v.cliente,
        producto: v.producto,
        fecha_carga: v.fecha_carga,
        fecha_descarga: v.fecha_descarga,
        periodo_mes: v.periodo_mes,
        volumen_origen_litros: v.volumen_origen_litros,
        volumen_recepcionado_litros: v.volumen_recepcionado_litros,
        volumen_facturado: v.volumen_facturado,
        tarifa_flete: v.tarifa_flete,
        observaciones: `Copia de viaje #${v.id}`,
        es_apoyo: v.es_apoyo,
        empresa_apoyo_id: v.empresa_apoyo_id,
        empresa_apoyo_nombre: v.empresa_apoyo_nombre
      };

      await apiFetch(`/tenants/${schema}/viajes/`, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      Swal.fire({
        icon: "success",
        title: "¡Despacho Duplicado!",
        text: `Se creó una copia del viaje para ${v.placa}.`,
        timer: 1400,
        showConfirmButton: false,
        background: "#0f172a",
        color: "#f8fafc"
      });

      loadViajes();
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al duplicar",
        text: err.message,
        background: "#0f172a",
        color: "#f8fafc"
      });
    }
  };

  // Cálculo en vivo para el modal de edición
  const liveCalc = (() => {
    const vOrig = Number(formData.volumen_origen_litros) || 0;
    const vRec = Number(formData.volumen_recepcionado_litros) || 0;
    let vFactLt = vRec;
    if (formData.volumen_facturado !== "" && formData.volumen_facturado !== undefined) {
      const parsed = Number(formData.volumen_facturado) || 0;
      vFactLt = parsed < 1000 ? parsed * 1000 : parsed;
    }
    const tar = Number(formData.tarifa_flete) || 0;

    const diff = vRec - vOrig;
    const faltante = diff < 0 ? Math.abs(diff) : 0;

    let tolPct = 0.0025;
    const pUpper = (formData.producto || "").toUpperCase();
    if (pUpper.includes("DIESEL") || pUpper.includes("DIÉSEL") || pUpper === "DO") tolPct = 0.0015;
    else if (pUpper.includes("IYA") || pUpper.includes("INSUMOS") || pUpper.includes("ADIT")) tolPct = 0.0020;
    else if (pUpper.includes("PLANCHA") || pUpper.includes("SOYA") || pUpper.includes("GIRASOL") || pUpper.includes("ACERO")) tolPct = 0.0000;

    const mermaTolLitros = Math.round(vOrig * tolPct);
    const mermaExcLitros = Math.max(0, faltante - mermaTolLitros);
    const mermaDescontarBs = mermaExcLitros * 7.45;

    // Operación principal: (Volumen Facturado en Lt / 1000) * Tarifa = Total Flete a Pagar
    const fleteTotalBs = Math.round((vFactLt / 1000.0) * tar * 100) / 100;

    const totAdic = formData.descuentos_adicionales.reduce((acc, d) => acc + (Number(d.monto) || 0), 0);
    const totMerm = formData.descuentos_mermas.reduce((acc, d) => acc + (Number(d.monto) || 0), 0);
    const totalDescuentos = Math.round((mermaDescontarBs + totAdic + totMerm) * 100) / 100;
    const netoPagable = Math.round((fleteTotalBs - totalDescuentos) * 100) / 100;

    return {
      faltante,
      mermaTolLitros,
      mermaExcLitros,
      mermaDescontarBs,
      fleteTotalBs,
      totAdic,
      totMerm,
      totalDescuentos,
      netoPagable
    };
  })();

  return (
    <div className="space-y-6">
      
      {/* Encabezado Principal */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-500 flex items-center justify-center flex-shrink-0 shadow-inner">
            <History className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Historial de Viajes y Auditoría
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                Oficial
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Búsqueda por Nº de Factura, auditoría de despachos, verificación de tolerancias y re-agrupación automática.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => router.push(`/${schema}/viajes`)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-xs transition flex items-center gap-1.5"
          >
            <Navigation className="w-3.5 h-3.5 text-amber-500" />
            <span>Registro Operativo</span>
          </button>
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black text-xs rounded-xl shadow-md transition active:scale-95 flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>Importar Plantilla Excel</span>
          </button>
          <button
            type="button"
            onClick={() => router.push(`/${schema}/liquidaciones`)}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-md transition active:scale-95 flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Ver Planillas</span>
          </button>
        </div>
      </div>

      {/* Selector de Rango de Fechas Integrado */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        <DatePeriodFilter onChange={handleDateFilterChange} initialMode="mes" />
      </div>

      {/* Tarjetas de Métricas Ejecutivas del Historial */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Despachos */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Total Despachos
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
              {totalViajes}
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Registrados en el filtro</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 flex-shrink-0">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        {/* Viajes Facturados */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Viajes Facturados
            </span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
              {facturadosList.length}
            </div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              {formatCurrency(montoTotalFacturadoBs)} facturado
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 flex-shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Sin Facturar / Pendientes */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Sin Facturar (Pendientes)
            </span>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono mt-0.5">
              {sinFacturaList.length}
            </div>
            <span className="text-[10px] text-rose-500 font-medium">
              {formatCurrency(montoSinFacturaBs)} pendiente
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Volumen Facturado Acumulado */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Volumen Facturado Total
            </span>
            <div className="text-2xl font-black text-sky-600 dark:text-sky-400 font-mono mt-0.5">
              {formatNumber(totalVolumenFacturadoLt, 0)} L
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Lt conciliados ({formatNumber(totalVolumenFacturadoM3, 2)} m³)</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-500 flex-shrink-0">
            <Scale className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Barra de Filtros, Búsqueda por Factura y Selector de Vista */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Buscador Potente con Resaltado de Factura */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por Nº de Factura (ej. F-001248), Placa, Cliente, MIC/DTA, Tramo..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtro de Estado de Facturación */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFacturadoFilter("TODOS")}
              className={`px-3 py-1.5 rounded-lg transition text-xs font-bold ${
                facturadoFilter === "TODOS"
                  ? "bg-amber-500 text-slate-950 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Todos ({totalViajes})
            </button>
            <button
              type="button"
              onClick={() => setFacturadoFilter("FACTURADOS")}
              className={`px-3 py-1.5 rounded-lg transition text-xs font-bold flex items-center gap-1 ${
                facturadoFilter === "FACTURADOS"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-emerald-500"
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Solo Facturados ({facturadosList.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setFacturadoFilter("SIN_FACTURAR")}
              className={`px-3 py-1.5 rounded-lg transition text-xs font-bold flex items-center gap-1 ${
                facturadoFilter === "SIN_FACTURAR"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-rose-500"
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Sin Facturar ({sinFacturaList.length})</span>
            </button>
          </div>

          {/* Selector de Modo de Vista */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode("agrupado")}
              className={`px-3 py-1.5 rounded-lg transition text-xs font-bold flex items-center gap-1.5 ${
                viewMode === "agrupado"
                  ? "bg-amber-500 text-slate-950 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Vista por Factura</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("plana")}
              className={`px-3 py-1.5 rounded-lg transition text-xs font-bold flex items-center gap-1.5 ${
                viewMode === "plana"
                  ? "bg-amber-500 text-slate-950 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Tabla Plana</span>
            </button>
          </div>
        </div>

        {/* Filtros Secundarios: Producto y Placa */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            <span>Filtros rápidos:</span>
          </span>

          {/* Filtro de Placas */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
            <Truck className="w-3 h-3 text-amber-500" />
            <select
              value={placaFiltro}
              onChange={(e) => setPlacaFiltro(e.target.value)}
              className="bg-transparent text-slate-900 dark:text-white font-bold focus:outline-none cursor-pointer text-[11px]"
            >
              <option value="" className="bg-white dark:bg-slate-900">Todas las Placas</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.placa} className="bg-white dark:bg-slate-900">
                  {u.placa} (Propia)
                </option>
              ))}
              {unidadesApoyo.map((u) => (
                <option key={`ap-${u.id}`} value={u.placa} className="bg-white dark:bg-slate-900">
                  {u.placa} (Apoyo)
                </option>
              ))}
            </select>
          </div>

          {/* Filtro de Productos */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold overflow-x-auto max-w-full">
            {["TODOS", ...catalogProductos].map((p) => (
              <button
                key={p}
                onClick={() => setProductoFiltro(p)}
                className={`px-2 py-0.5 rounded-md transition text-[10.5px] font-bold whitespace-nowrap ${
                  productoFiltro === p
                    ? "bg-amber-500 text-slate-950 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {(search || facturadoFilter !== "TODOS" || productoFiltro !== "TODOS" || placaFiltro) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setFacturadoFilter("TODOS");
                setProductoFiltro("TODOS");
                setPlacaFiltro("");
              }}
              className="text-[11px] font-bold text-rose-500 hover:underline ml-auto"
            >
              Limpiar todos los filtros
            </button>
          )}
        </div>
      </div>

      {/* Contenido de la Tabla (Agrupada o Plana) */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <div className="animate-spin w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full mx-auto mb-3" />
          <span className="text-xs font-bold">Cargando despachos del historial...</span>
        </div>
      ) : filteredViajes.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 mx-auto mb-3">
            <Search className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            No se encontraron viajes con los criterios seleccionados
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-4">
            Intenta borrar los términos de búsqueda o cambiar el período de fechas en el filtro superior.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setFacturadoFilter("TODOS");
              setProductoFiltro("TODOS");
              setPlacaFiltro("");
            }}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow transition"
          >
            Restablecer Filtros
          </button>
        </div>
      ) : viewMode === "agrupado" ? (
        /* VISTA AGRUPADA OFICIAL (TRAMO -> PRODUCTO -> FACTURA) CON FILA ESPECIAL DE SUBTOTAL */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 text-[10px] uppercase font-black text-center border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2.5 px-2">Nº</th>
                  <th className="py-2.5 px-2">F. Carga</th>
                  <th className="py-2.5 px-2">F. Descarga</th>
                  <th className="py-2.5 px-2">MCI/DTA Y OTROS</th>
                  <th className="py-2.5 px-2">Placa</th>
                  <th className="py-2.5 px-2.5 text-left">Tramo</th>
                  <th className="py-2.5 px-2">Cliente</th>
                  <th className="py-2.5 px-2">Producto</th>
                  <th className="py-2.5 px-2 text-right">Vol. Origen</th>
                  <th className="py-2.5 px-2 text-right">Vol. Rec./Desc.</th>
                  <th className="py-2.5 px-1.5 text-right">Merma T/Tr</th>
                  <th className="py-2.5 px-1.5 text-right">Merma Exc.</th>
                  <th className="py-2.5 px-1.5 text-center">Tolerable</th>
                  <th className="py-2.5 px-2 text-right">Desc. Merma</th>
                  <th className="py-2.5 px-2 text-right">Vol. Facturado</th>
                  <th className="py-2.5 px-2 text-right">Tarifa</th>
                  <th className="py-2.5 px-2.5 text-right">Total Flete</th>
                  <th className="py-2.5 px-2 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {(() => {
                  let globalIdx = 0;
                  return groups.map((group, gIdx) => {
                    const grpVolOrig = group.items.reduce((acc, x) => acc + (Number(x.volumen_origen_litros) || 0), 0);
                    const grpVolRec = group.items.reduce((acc, x) => acc + (Number(x.volumen_recepcionado_litros) || 0), 0);
                    const grpMermaReal = group.items.reduce((acc, x) => acc + (Number(x.merma_real_litros) || 0), 0);
                    const grpMermaExc = group.items.reduce((acc, x) => acc + (Number(x.merma_excedente_litros) || 0), 0);
                    const grpMermaTol = group.items.reduce((acc, x) => acc + (Number(x.merma_tolerable_litros) || 0), 0);
                    const grpMDesc = group.items.reduce((acc, x) => acc + (Number(x.merma_descontar_bs) || 0), 0);
                    const grpDescAdic = group.items.reduce((acc, x) => acc + (Number(x.total_descuentos_adicionales_bs) || 0) + (Number(x.total_descuentos_mermas_bs) || 0), 0);
                    const grpTotDesc = grpMDesc + grpDescAdic;
                    const grpVolFact = group.items.reduce((acc, x) => acc + getVolFactLitros(x), 0);
                    const grpFlete = group.items.reduce((acc, x) => acc + (Number(x.flete_total_bs) || 0), 0);
                    const grpLiquido = grpFlete - grpTotDesc;
                    const grpTarifa = group.items[0]?.tarifa_flete || 0;

                    const facLabel = group.factura === "S/F" ? "S/F" : group.factura;
                    const fechasFac = Array.from(new Set(group.items.map(x => x.fecha_factura).filter(Boolean)));
                    const fechaLabel = fechasFac.length > 0 ? fechasFac.map(f => formatDate(f)).join(", ") : "-";

                    return (
                      <Fragment key={`grp-${gIdx}`}>
                        {group.items.map((v) => {
                          globalIdx++;
                          return (
                            <tr
                              key={v.id}
                              className="hover:bg-amber-500/5 transition text-[11px] bg-white dark:bg-slate-900/60"
                            >
                              <td className="py-2 px-2 text-center font-bold text-slate-500 dark:text-slate-400">{globalIdx}</td>
                              <td className="py-2 px-2 text-center text-slate-600 dark:text-slate-300 font-mono">{formatDate(v.fecha_carga)}</td>
                              <td className="py-2 px-2 text-center text-slate-600 dark:text-slate-300 font-mono">{formatDate(v.fecha_descarga)}</td>
                              <td className="py-2 px-2 text-center font-mono font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">{v.mic_dta || "-"}</td>
                              <td className="py-2 px-2 text-center">
                                <span className="font-mono font-bold text-slate-900 dark:text-white">{v.placa}</span>
                                {v.es_apoyo && (
                                  <div className="text-[9px] text-amber-600 dark:text-amber-400 flex items-center justify-center gap-0.5">
                                    <Handshake className="w-2.5 h-2.5" />
                                    <span>Apoyo</span>
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-2.5 text-slate-700 dark:text-slate-300 truncate max-w-[150px]" title={v.tramo}>
                                {v.tramo}
                              </td>
                              <td className="py-2 px-2 text-center font-bold text-slate-700 dark:text-slate-300">{v.cliente || "YPFB"}</td>
                              <td className="py-2 px-2 text-center">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                                  {v.producto}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-slate-700 dark:text-slate-300">{formatNumber(v.volumen_origen_litros, 0)} L</td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">{formatNumber(v.volumen_recepcionado_litros, 0)} L</td>
                              <td className="py-2 px-1.5 text-right font-mono text-slate-700 dark:text-slate-300">
                                {v.merma_real_litros > 0 ? `-${formatNumber(v.merma_real_litros, 1)}` : formatNumber(v.merma_real_litros, 1)} L
                              </td>
                              <td className="py-2 px-1.5 text-right font-mono text-slate-700 dark:text-slate-300">{formatNumber(v.merma_excedente_litros, 1)} L</td>
                              <td className="py-2 px-1.5 text-center font-mono text-slate-500 dark:text-slate-400">{v.merma_tolerable_litros !== null && v.merma_tolerable_litros !== undefined ? Number(v.merma_tolerable_litros).toFixed(0) : "0"} L</td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-rose-600 dark:text-rose-400">{formatCurrency(v.merma_descontar_bs)}</td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-sky-700 dark:text-sky-400">
                                {formatNumber(getVolFactLitros(v), 0)} L
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-slate-700 dark:text-slate-300">{formatNumber(v.tarifa_flete, 2)}</td>
                              <td className="py-2 px-2.5 text-right font-mono font-black text-amber-700 dark:text-amber-400 whitespace-nowrap">
                                <div>{formatCurrency(v.flete_total_bs)}</div>
                                {(() => {
                                  const totDesc = (Number(v.merma_descontar_bs) || 0) + (Number(v.total_descuentos_adicionales_bs) || 0) + (Number(v.total_descuentos_mermas_bs) || 0);
                                  if (totDesc <= 0) return null;
                                  return (
                                    <div className="text-[9px] font-normal leading-tight mt-0.5">
                                      <div className="text-rose-600 dark:text-rose-400">Desc: -{formatCurrency(totDesc)}</div>
                                      <div className="text-emerald-700 dark:text-emerald-400 font-bold">Líq: {formatCurrency(v.flete_total_bs - totDesc)}</div>
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="py-2 px-2 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedViajeDetail(v)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                    title="Inspeccionar detalle y liquidación"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(v)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                    title="Editar despacho"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDuplicate(v)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                    title="Duplicar despacho"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(v)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                    title="Eliminar despacho"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}

                        {/* FILA ESPECIAL: Subtotal de la Factura y Producto */}
                        <tr className="bg-amber-100/75 dark:bg-amber-950/45 font-bold border-y-2 border-amber-300 dark:border-amber-700 text-[10.5px]">
                          <td colSpan={8} className="py-2.5 px-3 text-left border-x border-amber-300 dark:border-amber-700">
                            <span className="font-black text-amber-900 dark:text-amber-300 uppercase mr-2">TOTAL {group.producto}</span>
                            <span className="text-slate-700 dark:text-slate-300 font-medium">| FACTURA: <strong className="font-mono text-slate-900 dark:text-white">{facLabel}</strong></span>
                            <span className="text-slate-700 dark:text-slate-300 font-medium ml-2">| FECHA FACTURA: <strong className="text-slate-900 dark:text-white">{fechaLabel}</strong></span>
                          </td>
                          <td className="py-2 px-2 text-right font-mono border-x border-amber-300 dark:border-amber-700 font-bold text-slate-900 dark:text-white">{formatNumber(grpVolOrig, 0)}</td>
                          <td className="py-2 px-2 text-right font-mono border-x border-amber-300 dark:border-amber-700 font-bold text-emerald-800 dark:text-emerald-300">{formatNumber(grpVolRec, 0)}</td>
                          <td className="py-2 px-1.5 text-right font-mono border-x border-amber-300 dark:border-amber-700 font-bold text-slate-700 dark:text-slate-300">-{formatNumber(Math.abs(grpMermaReal), 1)}</td>
                          <td className="py-2 px-1.5 border-x border-amber-300 dark:border-amber-700"></td>
                          <td className="py-2 px-1.5 border-x border-amber-300 dark:border-amber-700"></td>
                          <td className="py-2 px-2 text-right font-mono border-x border-amber-300 dark:border-amber-700 font-bold text-rose-700 dark:text-rose-400">{formatCurrency(grpMDesc)}</td>
                          <td className="py-2 px-2 text-right font-mono border-x border-amber-300 dark:border-amber-700 font-black text-sky-800 dark:text-sky-300">{formatNumber(grpVolFact, 0)} L</td>
                          <td className="py-2 px-2 text-right font-mono border-x border-amber-300 dark:border-amber-700 text-slate-700 dark:text-slate-300">{formatNumber(grpTarifa, 2)}</td>
                          <td className="py-2 px-2.5 text-right font-mono border-x border-amber-300 dark:border-amber-700 font-black text-amber-900 dark:text-amber-400 whitespace-nowrap">
                            <div>{formatCurrency(grpFlete)}</div>
                            {grpTotDesc > 0 && (
                              <div className="text-[9px] font-normal leading-tight mt-0.5">
                                <div className="text-rose-700 dark:text-rose-400">Desc: -{formatCurrency(grpTotDesc)}</div>
                                <div className="text-emerald-800 dark:text-emerald-300 font-bold">Líq: {formatCurrency(grpLiquido)}</div>
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2 border-x border-amber-300 dark:border-amber-700"></td>
                        </tr>
                      </Fragment>
                    );
                  });
                })()}

                {/* FILA DE TOTALES GENERALES DEL HISTORIAL */}
                <tr className="bg-slate-100 dark:bg-slate-800/90 font-black text-slate-900 dark:text-white border-t-2 border-b border-slate-300 dark:border-slate-700 text-xs">
                  <td colSpan={8} className="py-3 px-3 text-right uppercase tracking-wider">
                    TOTAL GENERAL DEL HISTORIAL:
                  </td>
                  <td className="py-3 px-2 text-right font-mono">
                    {formatNumber(filteredViajes.reduce((acc, x) => acc + (Number(x.volumen_origen_litros) || 0), 0), 0)} L
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-emerald-600 dark:text-emerald-400">
                    {formatNumber(filteredViajes.reduce((acc, x) => acc + (Number(x.volumen_recepcionado_litros) || 0), 0), 0)} L
                  </td>
                  <td className="py-3 px-1.5 text-right font-mono">
                    -{formatNumber(Math.abs(filteredViajes.reduce((acc, x) => acc + (Number(x.merma_real_litros) || 0), 0)), 1)} L
                  </td>
                  <td className="py-3 px-1.5 text-right font-mono"></td>
                  <td className="py-3 px-1.5 text-center font-mono"></td>
                  <td className="py-3 px-2 text-right font-mono text-rose-600 dark:text-rose-400">
                    {formatCurrency(totalMermasBs)}
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-sky-600 dark:text-sky-400">
                    {formatNumber(totalVolumenFacturadoLt, 0)} L
                  </td>
                  <td className="py-3 px-2 text-right font-mono"></td>
                  <td className="py-3 px-2.5 text-right font-mono text-amber-600 dark:text-amber-400 text-sm whitespace-nowrap">
                    <div>{formatCurrency(montoTotalFleteBs)}</div>
                    {totalDescuentosBs > 0 && (
                      <div className="text-[10px] font-bold leading-tight mt-0.5">
                        <div className="text-rose-600 dark:text-rose-400">Desc: -{formatCurrency(totalDescuentosBs)}</div>
                        <div className="text-emerald-600 dark:text-emerald-400">Líq: {formatCurrency(montoLiquidoBs)}</div>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-2"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VISTA DE TABLA PLANA */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 text-[10px] uppercase font-black border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-3">Nº</th>
                  <th className="py-3 px-3">Factura</th>
                  <th className="py-3 px-3">F. Factura</th>
                  <th className="py-3 px-3">Placa</th>
                  <th className="py-3 px-3">F. Carga</th>
                  <th className="py-3 px-3">Tramo</th>
                  <th className="py-3 px-3">Producto</th>
                  <th className="py-3 px-3 text-right">Vol. Facturado</th>
                  <th className="py-3 px-3 text-right">Tarifa</th>
                  <th className="py-3 px-3 text-right">Total Flete</th>
                  <th className="py-3 px-3 text-right">Desc. Merma</th>
                  <th className="py-3 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredViajes.map((v, idx) => {
                  const hasFactura = v.nro_factura && v.nro_factura.trim() !== "" && v.nro_factura !== "-";
                  const vFactLt = getVolFactLitros(v);

                  return (
                    <tr key={v.id} className="hover:bg-amber-500/5 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-500">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        {hasFactura ? (
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            {v.nro_factura}
                          </span>
                        ) : (
                          <span className="font-mono font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                            Sin Factura
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                        {v.fecha_factura ? formatDate(v.fecha_factura) : "-"}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                        {v.placa}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                        {formatDate(v.fecha_carga)}
                      </td>
                      <td className="py-2.5 px-3 truncate max-w-[180px]" title={v.tramo}>
                        {v.tramo}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                        {v.producto}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-600 dark:text-sky-400">
                        {formatNumber(vFactLt, 0)} L
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                        {formatNumber(v.tarifa_flete, 2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-amber-600 dark:text-amber-400">
                        {formatCurrency(v.flete_total_bs)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                        {formatCurrency(v.merma_descontar_bs)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedViajeDetail(v)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title="Ver detalle"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(v)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title="Editar despacho"
                          >
                            <Edit className="w-3.5 h-3.5" />
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
      )}

      {/* MODAL 1: INSPECCIÓN DETALLADA DEL VIAJE */}
      {selectedViajeDetail && (
        <ModalPortal>
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
            <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
              
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wide">
                      Detalle de Liquidación del Viaje #{selectedViajeDetail.id}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Placa <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{selectedViajeDetail.placa}</span> | {selectedViajeDetail.producto}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedViajeDetail(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-5 text-xs">
                
                {/* Facturación y Fechas */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Nº de Factura</span>
                    <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                      {selectedViajeDetail.nro_factura || "S/F"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Fecha Factura</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      {selectedViajeDetail.fecha_factura ? formatDate(selectedViajeDetail.fecha_factura) : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Fecha Carga</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      {formatDate(selectedViajeDetail.fecha_carga)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Fecha Descarga</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      {formatDate(selectedViajeDetail.fecha_descarga)}
                    </span>
                  </div>
                </div>

                {/* Ruta y Documento */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Tramo</span>
                    <span className="font-bold text-slate-900 dark:text-white">{selectedViajeDetail.tramo}</span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">MCI / DTA Y OTROS</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{selectedViajeDetail.mic_dta || "-"}</span>
                  </div>
                </div>

                {/* Volúmenes y Mermas YPFB */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider block">
                    Cálculo Oficial de Flete y Tolerancia de Merma
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Volumen Origen</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                        {formatNumber(selectedViajeDetail.volumen_origen_litros, 0)} Lt
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Volumen Rec. / Descargado</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        {formatNumber(selectedViajeDetail.volumen_recepcionado_litros, 0)} Lt
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Volumen Facturado</span>
                      <span className="font-mono font-black text-sky-600 dark:text-sky-400 text-sm">
                        {formatNumber(getVolFactLitros(selectedViajeDetail), 0)} Lt
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Merma Real (Faltante)</span>
                      <span className="font-mono font-bold text-rose-500">
                        {formatNumber(selectedViajeDetail.merma_real_litros, 1)} Lt
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Tolerancia Permisible</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                        {selectedViajeDetail.merma_tolerable_litros !== null && selectedViajeDetail.merma_tolerable_litros !== undefined ? Number(selectedViajeDetail.merma_tolerable_litros).toFixed(0) : "0"} Lt
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Descuento Merma YPFB</span>
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
                        {formatCurrency(selectedViajeDetail.merma_descontar_bs)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Descuentos Adicionales y de Merma */}
                {(() => {
                  let adicList: ItemDescuento[] = [];
                  if (Array.isArray(selectedViajeDetail.descuentos_adicionales_json)) adicList = selectedViajeDetail.descuentos_adicionales_json;
                  else if (typeof selectedViajeDetail.descuentos_adicionales_json === "string") {
                    try { adicList = JSON.parse(selectedViajeDetail.descuentos_adicionales_json); } catch (e) {}
                  }

                  let mermList: ItemDescuento[] = [];
                  if (Array.isArray(selectedViajeDetail.descuentos_mermas_json)) mermList = selectedViajeDetail.descuentos_mermas_json;
                  else if (typeof selectedViajeDetail.descuentos_mermas_json === "string") {
                    try { mermList = JSON.parse(selectedViajeDetail.descuentos_mermas_json); } catch (e) {}
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

                {/* Resumen Financiero Completo */}
                {(() => {
                  const mDesc = Number(selectedViajeDetail.merma_descontar_bs) || 0;
                  const adicDesc = (Number(selectedViajeDetail.total_descuentos_adicionales_bs) || 0) + (Number(selectedViajeDetail.total_descuentos_mermas_bs) || 0);
                  const totDesc = mDesc + adicDesc;
                  const liquido = (Number(selectedViajeDetail.flete_total_bs) || 0) - totDesc;

                  return (
                    <div className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/25 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase block">
                          Resumen de Liquidación
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {totDesc > 0 ? "Flete Bruto Base - Descuentos Aplicados = Total Líquido" : `Vol. Facturado × Tarifa (Bs. ${selectedViajeDetail.tarifa_flete})`}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 sm:gap-4 sm:text-right">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">Flete Bruto:</span>
                          <span className="text-base font-black text-amber-600 dark:text-amber-400 font-mono">
                            {formatCurrency(selectedViajeDetail.flete_total_bs)}
                          </span>
                        </div>
                        {totDesc > 0 && (
                          <div>
                            <span className="text-[10px] text-rose-500 block uppercase font-medium">Descuentos:</span>
                            <span className="text-base font-black text-rose-600 dark:text-rose-400 font-mono">
                              -{formatCurrency(totDesc)}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block uppercase">Total a Pagar (Líquido):</span>
                          <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                            {formatCurrency(liquido)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-950">
                <button
                  type="button"
                  onClick={() => {
                    const v = selectedViajeDetail;
                    setSelectedViajeDetail(null);
                    openEditModal(v);
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow transition"
                >
                  Editar Despacho
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedViajeDetail(null)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL 2: EDITAR DESPACHO (RESPONSIVO CON 2 COLUMNAS) */}
      {showEditModal && editingViaje && (
        <ModalPortal>
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
            <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
              
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Editar Despacho #{editingViaje.id}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Actualiza factura, fechas, producto, volúmenes y descuentos
                  </p>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveEdit} className="p-6 overflow-y-auto space-y-4">
                
                {/* Fechas de Carga y Descarga */}
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
                          setFormData(prev => ({
                            ...prev,
                            fecha_carga: val,
                            periodo_mes: prev.periodo_mes || determineTripPeriod(val, prev.fecha_descarga)
                          }));
                        }}
                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
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
                          setFormData(prev => ({
                            ...prev,
                            fecha_descarga: val,
                            periodo_mes: prev.periodo_mes || determineTripPeriod(prev.fecha_carga, val)
                          }));
                        }}
                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Asignación de Periodo (Editable para digitalización de planillas históricas) */}
                  <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-slate-600 dark:text-slate-300 text-[11px] font-medium">
                        Mes Asignado (Liquidación):
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="month"
                        value={formData.periodo_mes}
                        onChange={(e) => setFormData({ ...formData, periodo_mes: e.target.value })}
                        className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-amber-500/40 rounded-lg text-xs font-mono font-black text-amber-600 dark:text-amber-400 focus:outline-none focus:border-amber-500 cursor-pointer"
                        title="Puedes cambiar el mes de liquidación si es necesario para digitalización"
                      />
                    </div>
                  </div>
                </div>

                {/* Facturación: Nº Factura y Fecha Factura */}
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
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono uppercase text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
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
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* MCI/DTA y Placa */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      MCI/DTA Nº Y OTROS
                    </label>
                    <input
                      type="text"
                      value={formData.mic_dta}
                      onChange={(e) => setFormData({ ...formData, mic_dta: e.target.value.toUpperCase() })}
                      placeholder="ej. 23BO051130T"
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono uppercase text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Placa *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.placa}
                      onChange={(e) => setFormData({ ...formData, placa: e.target.value.toUpperCase() })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono font-bold uppercase text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Tramo y Cliente */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Tramo *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.tramo}
                      onChange={(e) => setFormData({ ...formData, tramo: e.target.value.toUpperCase() })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs uppercase text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Cliente *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.cliente}
                      onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs uppercase text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Producto */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                    Producto Transportado *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {catalogProductos.map((p) => {
                      const isSel = formData.producto === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setFormData({ ...formData, producto: p })}
                          className={`p-2 rounded-xl border text-center transition font-bold text-xs ${
                            isSel 
                              ? "bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500" 
                              : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Volúmenes y Tarifa (Grid Responsivo de 2 Columnas Sin Colisión) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Volumen Origen (Lt) *
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={formData.volumen_origen_litros}
                      onChange={(e) => setFormData({ ...formData, volumen_origen_litros: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1 leading-snug">
                      Volumen Recepcionado/Descargado (Lt) *
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={formData.volumen_recepcionado_litros}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({
                          ...formData,
                          volumen_recepcionado_litros: val,
                          volumen_facturado: val
                        });
                      }}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1 leading-snug">
                      Volumen Facturado (Lt) *
                    </label>
                    <input
                      type="number"
                      step="1"
                      placeholder="ej. 33900"
                      value={formData.volumen_facturado}
                      onChange={(e) => setFormData({ ...formData, volumen_facturado: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-sky-600 dark:text-sky-400 focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-[10px] text-slate-400 block mt-0.5">Operación: (Vol. Facturado en Lt / 1000) × Tarifa (Bs./m³) = Total a Pagar</span>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Tarifa Flete (Bs) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.tarifa_flete}
                      onChange={(e) => setFormData({ ...formData, tarifa_flete: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Descuentos Adicionales y Mermas (Editables) */}
                <div className="space-y-3 pt-1">
                  {/* 1. Descuentos Adicionales */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                          Descuentos Adicionales
                        </span>
                        {liveCalc.totAdic > 0 && (
                          <span className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                            Total: {formatCurrency(liveCalc.totAdic)}
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
                        Sin descuentos adicionales. Haz clic en "Adicionar Descuento" para registrar conceptos y montos.
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
                        {liveCalc.totMerm > 0 && (
                          <span className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                            Total: {formatCurrency(liveCalc.totMerm)}
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
                        Sin descuentos por merma adicionales. Haz clic en "Adicionar Descuento Merma" para registrar conceptos y montos.
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

                {/* Panel de Cálculos Automáticos Oficiales (Tiempo Real) */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                  <span className="font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider text-[10px] block">
                    Cálculos Automáticos YPFB en Tiempo Real:
                  </span>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80">
                      <span className="text-slate-500 dark:text-slate-400 text-[10px] block uppercase font-bold">Merma Real:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                        {liveCalc.faltante > 0 ? `-${liveCalc.faltante}` : liveCalc.faltante} L
                      </span>
                      <span className="text-[9px] text-slate-400 block">Tol: {liveCalc.mermaTolLitros} L</span>
                    </div>

                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80">
                      <span className="text-slate-500 dark:text-slate-400 text-[10px] block uppercase font-bold">Desc. Merma (Carga):</span>
                      <span className={`font-mono font-bold text-xs ${liveCalc.mermaDescontarBs > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {formatCurrency(liveCalc.mermaDescontarBs)}
                      </span>
                      <span className="text-[9px] text-slate-400 block">Exc: {liveCalc.mermaExcLitros} L</span>
                    </div>

                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80">
                      <span className="text-slate-500 dark:text-slate-400 text-[10px] block uppercase font-bold">Flete Bruto:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                        {formatCurrency(liveCalc.fleteTotalBs)}
                      </span>
                      <span className="text-[9px] text-slate-400 block">Base Facturada</span>
                    </div>

                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80">
                      <span className="text-slate-500 dark:text-slate-400 text-[10px] block uppercase font-bold">Total Descuentos:</span>
                      <span className={`font-mono font-bold text-xs ${liveCalc.totalDescuentos > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-400"}`}>
                        {liveCalc.totalDescuentos > 0 ? `-${formatCurrency(liveCalc.totalDescuentos)}` : "Bs. 0,00"}
                      </span>
                      {(liveCalc.totAdic > 0 || liveCalc.totMerm > 0) && (
                        <span className="text-[9px] text-slate-400 block">Inc. adicionales</span>
                      )}
                    </div>

                    <div className="p-2 rounded-xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 col-span-2 sm:col-span-1">
                      <span className="text-amber-800 dark:text-amber-400 text-[10px] block uppercase font-black">Total a Pagar (Neto):</span>
                      <span className="font-mono font-black text-amber-700 dark:text-amber-400 text-sm">
                        {formatCurrency(liveCalc.netoPagable)}
                      </span>
                      <span className="text-[9px] text-amber-600/80 dark:text-amber-400/80 block">Líquido Despacho</span>
                    </div>
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-md transition active:scale-95"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal de Importación Inteligente Excel */}
      <ImportExcelModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        schema={schema}
        onSuccess={() => {
          loadViajes();
        }}
      />

    </div>
  );
}

export default function HistorialViajesPage() {
  return (
    <Suspense fallback={
      <div className="p-12 text-center text-slate-400">
        <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full mx-auto mb-3" />
        <span className="text-xs font-bold">Cargando Historial...</span>
      </div>
    }>
      <HistorialViajesContent />
    </Suspense>
  );
}
