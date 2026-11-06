"use client";

import { Suspense, useState, useEffect, useMemo, useRef, Fragment } from "react";
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
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ArrowDownUp,
  Building2,
  LayoutGrid,
  Table,
  Receipt,
  Hash,
  Layers,
  ArrowRight,
  Calculator,
  ChevronDown,
  ChevronUp,
  Check,
  SlidersHorizontal
} from "lucide-react";
import Swal from "sweetalert2";
import { apiFetch, getApiUrl } from "@/lib/api";
import { downloadBlob } from "@/lib/download";
import { formatCurrency, formatNumber, formatDate } from "@/lib/format";
import { getSavedState, saveState } from "@/lib/storage";
import DatePeriodFilter, { DateFilterChangeEvent } from "@/components/DatePeriodFilter";
import SaveNewCatalogModal from "@/components/SaveNewCatalogModal";
import ModalPortal from "@/components/ModalPortal";
import ImportExcelModal from "@/components/ImportExcelModal";

interface ItemDescuento {
  concepto: string;
  monto: number;
}

interface ProductoCatalogItem {
  nombre: string;
  tolerancia_pct: number;
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
  comision_usd_m3?: number | null;
  tipo_cambio_bs?: number | null;
  comision_pct_1?: number | null;
  comision_ypfb_bolgart_pct?: number | null;
  comision_pct_2?: number | null;
  costo_hojas_de_ruta_bs?: number | null;
  costo_gps_bs?: number | null;
  anticipos_otros_pct?: number | null;
  parametros_ypfb_json?: any;
}

export function isYpfbClient(clientName?: string | null): boolean {
  if (!clientName) return false;
  const clean = clientName.toUpperCase().replace(/[\.\s\-_]/g, "");
  return clean.includes("YPFB");
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
  const [filterMode, setFilterMode] = useState<"mes" | "semestral" | "anual" | "personalizado" | "historico">("mes");
  const [periodosDisponibles, setPeriodosDisponibles] = useState<any[]>([]);

  // Filtro por Factura(s) correlativas o rango
  const [metodoFiltro, setMetodoFiltro] = useState<"periodo" | "factura">("periodo");
  const [modoFactura, setModoFactura] = useState<"unica" | "rango">("unica");
  const [facturaInput, setFacturaInput] = useState<string>("");
  const [facturaDesdeInput, setFacturaDesdeInput] = useState<string>("");
  const [facturaHastaInput, setFacturaHastaInput] = useState<string>("");
  const [facturasDisponibles, setFacturasDisponibles] = useState<any[]>([]);
  const [searchFacturaChip, setSearchFacturaChip] = useState<string>("");

  const [placaFiltro, setPlacaFiltro] = useState("");
  const [productoFiltro, setProductoFiltro] = useState("TODOS");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sortBy, setSortBy] = useState<"fecha" | "factura" | "placa" | "cliente" | "flete">("fecha");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  // Estados para dropdowns interactivos de Tramo y Cliente
  const [showTramoDropdown, setShowTramoDropdown] = useState(false);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const tramoDropdownRef = useRef<HTMLDivElement>(null);
  const clienteDropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdowns interactivos al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tramoDropdownRef.current && !tramoDropdownRef.current.contains(event.target as Node)) {
        setShowTramoDropdown(false);
      }
      if (clienteDropdownRef.current && !clienteDropdownRef.current.contains(event.target as Node)) {
        setShowClienteDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Sincronización en tiempo real vía StorageEvent para filtros compartidos (Liquidaciones <-> Viajes)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `transporte_${schema}_filtro_compartido` && e.newValue) {
        try {
          const shared = JSON.parse(e.newValue);
          if (shared.source !== "viajes") {
            if (shared.periodo !== undefined) setPeriodo(shared.periodo);
            if (shared.activeFilterLabel !== undefined) setActiveFilterLabel(shared.activeFilterLabel);
            if (shared.dateFilterQuery !== undefined) setDateFilterQuery(shared.dateFilterQuery);
            if (shared.filterMode !== undefined) setFilterMode(shared.filterMode);
            if (shared.metodoFiltro !== undefined) setMetodoFiltro(shared.metodoFiltro);
            if (shared.modoFactura !== undefined) setModoFactura(shared.modoFactura);
            if (shared.facturaInput !== undefined) setFacturaInput(shared.facturaInput);
            if (shared.facturaDesdeInput !== undefined) setFacturaDesdeInput(shared.facturaDesdeInput);
            if (shared.facturaHastaInput !== undefined) setFacturaHastaInput(shared.facturaHastaInput);
            if (shared.placa !== undefined) setPlacaFiltro(shared.placa);
          }
        } catch (err) {}
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [schema]);

  // Paginación de alto rendimiento
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Búsqueda debounced (150ms) para respuesta ultrafluida al escribir
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setCurrentPage(1);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Pestaña Principal: "planilla" o "historial"
  const [activeMainTab, setActiveMainTab] = useState<"planilla" | "historial">("planilla");
  const [tablaModo, setTablaModo] = useState<"compacta" | "extendida">("compacta");
  const [isHydrated, setIsHydrated] = useState(false);

  // Facturas Con Derecho a Crédito Fiscal (IVA 13%)
  const [facturasConDerecho, setFacturasConDerecho] = useState<string[]>([]);

  // Catálogos dinámicos por empresa
  const [catalogProductos, setCatalogProductos] = useState<string[]>([
    "GASOLINA",
    "DIESEL",
    "INSUMOS Y ADITIVOS"
  ]);
  const [catalogProductosDetalle, setCatalogProductosDetalle] = useState<ProductoCatalogItem[]>([
    { nombre: "GASOLINA", tolerancia_pct: 0.25 },
    { nombre: "DIESEL", tolerancia_pct: 0.15 },
    { nombre: "INSUMOS Y ADITIVOS", tolerancia_pct: 0.20 }
  ]);
  const [catalogTramos, setCatalogTramos] = useState<string[]>([
    "ARICA - TAMBO QUEMADO - LA PAZ",
    "IQUIQUE - TAMBO QUEMADO - LA PAZ",
    "MEJILLONES - TAMBO QUEMADO - LA PAZ",
    "YACUIBA - SANTA CRUZ",
    "PISIGA - ORURO"
  ]);

  // Lista combinada y única de tramos (Catálogo + Viajes registrados)
  const availableTramos = useMemo(() => {
    const set = new Set<string>();
    catalogTramos.forEach(t => { if (t && t.trim()) set.add(t.trim().toUpperCase()); });
    viajes.forEach(v => { if (v.tramo && v.tramo.trim()) set.add(v.tramo.trim().toUpperCase()); });
    return Array.from(set).sort();
  }, [catalogTramos, viajes]);

  // Lista combinada y única de clientes (Clientes registrados + Viajes)
  const availableClientes = useMemo(() => {
    const set = new Set<string>();
    clientes.forEach(c => { if (c.nombre && c.nombre.trim()) set.add(c.nombre.trim().toUpperCase()); });
    viajes.forEach(v => { if (v.cliente && v.cliente.trim()) set.add(v.cliente.trim().toUpperCase()); });
    return Array.from(set).sort();
  }, [clientes, viajes]);

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
    volumen_facturado: 33900 as number | string,
    tarifa_flete: 392.00 as number | string,
    tipo_tarifa: "BS_POR_M3",
    precio_merma_litro_bs: 7.450000 as number | string,
    observaciones: "",
    descuentos_adicionales: [] as ItemDescuento[],
    descuentos_mermas: [] as ItemDescuento[],
    comision_usd_m3: 1.00 as number | string,
    tipo_cambio_bs: 6.96 as number | string,
    comision_pct_1: 7.00 as number | string,
    comision_ypfb_bolgart_pct: 7.00 as number | string,
    comision_pct_2: 3.00 as number | string,
    costo_hojas_de_ruta_bs: 0.00 as number | string,
    costo_gps_bs: 0.00 as number | string,
    anticipos_otros_pct: 0.00 as number | string
  });

  // Estados para el Resumen de Deducciones y Pagos (Hoja 2) en Viajes
  const [showAdjustDeductionsModal, setShowAdjustDeductionsModal] = useState(false);
  const [showYpfbBreakdown, setShowYpfbBreakdown] = useState(false);
  const [deductionsOverride, setDeductionsOverride] = useState<Record<string, number | null>>({});
  const [adjustDeductionForm, setAdjustDeductionForm] = useState<Record<string, number | string>>({
    desc_merma_bs: "",
    desc_comision_usd_m3_bs: "",
    desc_comision_7pct_bs: "",
    desc_comision_ypfb_bolgart_7pct_bs: "",
    desc_comision_3pct_bs: "",
    desc_hojas_ruta_bs: "",
    desc_gps_bs: "",
    desc_anticipos_otros_bs: "",
    desc_otros_ajustes_bs: ""
  });

  // Expansión de filas YPFB para visualización de parámetros y mermas en viajes
  const [expandedYpfbRows, setExpandedYpfbRows] = useState<Set<number>>(new Set());

  const toggleExpandYpfbRow = (viajeId: number) => {
    setExpandedYpfbRows((prev) => {
      const next = new Set(prev);
      if (next.has(viajeId)) {
        next.delete(viajeId);
      } else {
        next.add(viajeId);
      }
      return next;
    });
  };

  // Edición rápida e intuitiva de deducciones contractuales YPFB en la tabla inferior
  const [inlineEditingId, setInlineEditingId] = useState<number | null>(null);
  const [savingInlineContractual, setSavingInlineContractual] = useState(false);
  const [inlineEditForm, setInlineEditForm] = useState({
    merma_descontar_bs: "" as number | string,
    precio_merma_litro_bs: "" as number | string,
    comision_usd_m3: "" as number | string,
    tipo_cambio_bs: "" as number | string,
    comision_pct_1: "" as number | string,
    comision_ypfb_bolgart_pct: "" as number | string,
    comision_pct_2: "" as number | string,
    costo_hojas_de_ruta_bs: "" as number | string,
    costo_gps_bs: "" as number | string
  });

  const startInlineEdit = (v: Viaje) => {
    setInlineEditingId(v.id);
    setInlineEditForm({
      merma_descontar_bs: v.merma_descontar_bs !== undefined && v.merma_descontar_bs !== null ? v.merma_descontar_bs : 0.0,
      precio_merma_litro_bs: v.precio_merma_litro_bs !== undefined && v.precio_merma_litro_bs !== null ? v.precio_merma_litro_bs : 7.450000,
      comision_usd_m3: v.comision_usd_m3 !== undefined && v.comision_usd_m3 !== null ? v.comision_usd_m3 : 1.0,
      tipo_cambio_bs: v.tipo_cambio_bs !== undefined && v.tipo_cambio_bs !== null ? v.tipo_cambio_bs : 6.96,
      comision_pct_1: v.comision_pct_1 !== undefined && v.comision_pct_1 !== null ? v.comision_pct_1 : 7.0,
      comision_ypfb_bolgart_pct: v.comision_ypfb_bolgart_pct !== undefined && v.comision_ypfb_bolgart_pct !== null ? v.comision_ypfb_bolgart_pct : 7.0,
      comision_pct_2: v.comision_pct_2 !== undefined && v.comision_pct_2 !== null ? v.comision_pct_2 : 3.0,
      costo_hojas_de_ruta_bs: v.costo_hojas_de_ruta_bs !== undefined && v.costo_hojas_de_ruta_bs !== null ? v.costo_hojas_de_ruta_bs : 0.0,
      costo_gps_bs: v.costo_gps_bs !== undefined && v.costo_gps_bs !== null ? v.costo_gps_bs : 0.0
    });
  };

  const handleSaveInlineContractual = async (v: Viaje) => {
    setSavingInlineContractual(true);
    try {
      const payload = {
        ...v,
        merma_descontar_bs: Number(inlineEditForm.merma_descontar_bs) || 0.0,
        precio_merma_litro_bs: Number(inlineEditForm.precio_merma_litro_bs) || 7.450000,
        comision_usd_m3: Number(inlineEditForm.comision_usd_m3) || 0.0,
        tipo_cambio_bs: Number(inlineEditForm.tipo_cambio_bs) || 6.96,
        comision_pct_1: Number(inlineEditForm.comision_pct_1) || 0.0,
        comision_ypfb_bolgart_pct: Number(inlineEditForm.comision_ypfb_bolgart_pct) || 0.0,
        comision_pct_2: Number(inlineEditForm.comision_pct_2) || 0.0,
        costo_hojas_de_ruta_bs: Number(inlineEditForm.costo_hojas_de_ruta_bs) || 0.0,
        costo_gps_bs: Number(inlineEditForm.costo_gps_bs) || 0.0
      };

      await apiFetch(`/tenants/${schema}/viajes/${v.id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });

      setInlineEditingId(null);
      await loadViajes();
      Swal.fire({
        icon: "success",
        title: "Deducciones Guardadas",
        text: `Parámetros actualizados permanentemente para el viaje ${v.placa}`,
        timer: 1500,
        showConfirmButton: false,
        background: "#0f172a",
        color: "#f8fafc"
      });
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al guardar",
        text: err?.message || "No se pudo actualizar el viaje.",
        background: "#0f172a",
        color: "#f8fafc"
      });
    } finally {
      setSavingInlineContractual(false);
    }
  };

  // Cálculo en vivo dentro del modal
  const [liveCalc, setLiveCalc] = useState({
    merma_real: -100,
    tolerancia_pct: 0.25,
    merma_tolerable: 85,
    merma_excedente: 15,
    merma_descontar_bs: 111.75,
    flete_total_bs: 13288.80,
    total_descuentos_adicionales: 0,
    total_descuentos_mermas: 0,
    total_descuentos_bs: 111.75,
    liquido_pagable_bs: 13177.05
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
    if (metodoFiltro === "factura") {
      let facLabel = "";
      if (modoFactura === "unica") {
        facLabel = facturaInput.trim() ? `Factura N° ${facturaInput.trim()}` : "Todas las Facturas";
      } else {
        facLabel = (facturaDesdeInput.trim() && facturaHastaInput.trim())
          ? `Facturas N° ${facturaDesdeInput.trim()} al ${facturaHastaInput.trim()}`
          : (facturaDesdeInput.trim() ? `Desde Factura N° ${facturaDesdeInput.trim()}` : (facturaHastaInput.trim() ? `Hasta Factura N° ${facturaHastaInput.trim()}` : "Todas las Facturas"));
      }
      setActiveFilterLabel(facLabel);
    }
  }, [metodoFiltro, modoFactura, facturaInput, facturaDesdeInput, facturaHastaInput]);

  useEffect(() => {
    if (schema && isHydrated) {
      loadViajes();
    }
  }, [schema, isHydrated, periodo, dateFilterQuery, placaFiltro, metodoFiltro, modoFactura, facturaInput, facturaDesdeInput, facturaHastaInput]);

  // Memoria Inteligente: persistir configuración y filtros
  useEffect(() => {
    if (!isHydrated || !schema) return;
    saveState(`transporte_${schema}_viajes_memoria`, {
      periodo,
      activeFilterLabel,
      dateFilterQuery,
      filterMode,
      metodoFiltro,
      modoFactura,
      facturaInput,
      facturaDesdeInput,
      facturaHastaInput,
      placaFiltro,
      productoFiltro,
      sortBy,
      sortDir,
      pageSize,
      activeMainTab,
      tablaModo,
      historialFacturadoFilter
    });

    // Guardar en canal compartido bidireccional para sincronizar con Liquidaciones
    saveState(`transporte_${schema}_filtro_compartido`, {
      periodo,
      activeFilterLabel,
      dateFilterQuery,
      filterMode,
      metodoFiltro,
      modoFactura,
      facturaInput,
      facturaDesdeInput,
      facturaHastaInput,
      placa: placaFiltro,
      updatedAt: Date.now(),
      source: "viajes"
    });
  }, [
    isHydrated,
    schema,
    periodo,
    activeFilterLabel,
    dateFilterQuery,
    filterMode,
    metodoFiltro,
    modoFactura,
    facturaInput,
    facturaDesdeInput,
    facturaHastaInput,
    placaFiltro,
    productoFiltro,
    sortBy,
    sortDir,
    pageSize,
    activeMainTab,
    tablaModo,
    historialFacturadoFilter
  ]);

  // Si viene acción de URL para abrir modal de nuevo viaje o seleccionar pestaña
  useEffect(() => {
    if (searchParams.get("action") === "nuevo" && !loading) {
      openCreateModal();
    }
    const tabParam = searchParams.get("tab");
    if (tabParam === "historial" || tabParam === "planilla") {
      setActiveMainTab(tabParam);
    }
  }, [searchParams, loading]);

  // Recálculo dinámico en el formulario modal (estándar físico YPFB y nuevo volumen facturado)
  useEffect(() => {
    const vOri = Number(formData.volumen_origen_litros) || 0;
    const vRec = Number(formData.volumen_recepcionado_litros) || 0;
    // Merma Real: volumen recepcionado - volumen origen (ej. 33900 - 33999 = -99.0 L)
    const mReal = Math.round((vRec - vOri) * 10) / 10;

    let tol = 0.25;
    const prodUpper = (formData.producto || "").toUpperCase().trim();
    const matchedDetalle = catalogProductosDetalle.find(
      p => p.nombre.toUpperCase().trim() === prodUpper
    );
    if (matchedDetalle && matchedDetalle.tolerancia_pct !== undefined && matchedDetalle.tolerancia_pct !== null) {
      tol = Number(matchedDetalle.tolerancia_pct);
    } else if (prodUpper.includes("DIESEL") || prodUpper.includes("DIÉSEL") || prodUpper === "DO") {
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

    const isYpfb = isYpfbClient(formData.cliente);
    // Merma Tolerable en Litros = Volumen Origen * Tolerancia % (solo para cliente YPFB)
    const mTol = isYpfb ? Math.round((vOri * (tol / 100.0)) * 10) / 10 : 0;
    
    // Total Merma Excedente = si la pérdida absoluta excede la tolerable
    const mExc = isYpfb ? Math.max(0, Math.round((Math.abs(mReal) - mTol) * 10) / 10) : 0;
    
    // Descuento por Merma en Bs = Merma Excedente * precio_merma (6 decimales)
    const precioMerma = Number(formData.precio_merma_litro_bs) || 7.450000;
    const mDescBs = isYpfb ? Math.round(mExc * precioMerma * 100) / 100 : 0;

    // Volumen Facturado (Lt) y Operación Principal: (Vol. Facturado en Lt / 1000) × Tarifa (Bs.) = Total a Pagar
    let vFactLt = vRec;
    if (formData.volumen_facturado !== "" && formData.volumen_facturado !== undefined) {
      const parsed = Number(formData.volumen_facturado) || 0;
      vFactLt = parsed < 1000 ? parsed * 1000 : parsed;
    }
    const vFactM3 = vFactLt / 1000.0;

    let fleteBs = 0;
    if (formData.tipo_tarifa === "BS_POR_M3") {
      fleteBs = Math.round(vFactM3 * (Number(formData.tarifa_flete) || 0) * 100) / 100;
    } else if (formData.tipo_tarifa === "USD_POR_M3") {
      fleteBs = Math.round(vFactM3 * (Number(formData.tarifa_flete) || 0) * 6.96 * 100) / 100;
    } else {
      fleteBs = Math.round((Number(formData.tarifa_flete) || 0) * 100) / 100;
    }

    const totDescAdic = (formData.descuentos_adicionales || []).reduce((acc, it) => acc + (Number(it.monto) || 0), 0);
    const totDescMerm = (formData.descuentos_mermas || []).reduce((acc, it) => acc + (Number(it.monto) || 0), 0);
    const totDescTotal = Math.round((mDescBs + totDescAdic + totDescMerm) * 100) / 100;
    const liquidoPagable = Math.round((fleteBs - totDescTotal) * 100) / 100;

    setLiveCalc({
      merma_real: mReal,
      tolerancia_pct: tol,
      merma_tolerable: mTol,
      merma_excedente: mExc,
      merma_descontar_bs: mDescBs,
      flete_total_bs: fleteBs,
      total_descuentos_adicionales: Math.round(totDescAdic * 100) / 100,
      total_descuentos_mermas: Math.round(totDescMerm * 100) / 100,
      total_descuentos_bs: totDescTotal,
      liquido_pagable_bs: liquidoPagable
    });
  }, [
    formData.volumen_origen_litros,
    formData.volumen_recepcionado_litros,
    formData.volumen_facturado,
    formData.producto,
    formData.tarifa_flete,
    formData.tipo_tarifa,
    formData.cliente,
    formData.precio_merma_litro_bs,
    formData.descuentos_adicionales,
    formData.descuentos_mermas,
    catalogProductosDetalle
  ]);

  const loadInitialData = async () => {
    try {
      const [uData, uApoyoData, pData, cData, catData, fData] = await Promise.all([
        apiFetch(`/tenants/${schema}/unidades/`).catch(() => []),
        apiFetch(`/tenants/${schema}/apoyo/unidades/todas`).catch(() => []),
        apiFetch(`/tenants/${schema}/viajes/periodos`).catch(() => []),
        apiFetch(`/tenants/${schema}/clientes/`).catch(() => []),
        apiFetch(`/tenants/${schema}/parametros/catalogos`).catch(() => null),
        apiFetch(`/tenants/${schema}/viajes/facturas-disponibles`).catch(() => [])
      ]);
      setUnidades(Array.isArray(uData) ? uData : []);
      setUnidadesApoyo(Array.isArray(uApoyoData) ? uApoyoData : []);
      setPeriodosDisponibles(Array.isArray(pData) ? pData : []);
      setClientes(Array.isArray(cData) ? cData : []);
      setFacturasDisponibles(Array.isArray(fData) ? fData : []);
      if (catData) {
        if (Array.isArray(catData.productos) && catData.productos.length > 0) {
          setCatalogProductos(catData.productos);
        }
        if (Array.isArray(catData.productos_detalle) && catData.productos_detalle.length > 0) {
          setCatalogProductosDetalle(catData.productos_detalle);
        } else if (Array.isArray(catData.productos)) {
          setCatalogProductosDetalle(catData.productos.map((p: string) => {
            const pUp = p.toUpperCase();
            const tol = pUp.includes("DIESEL") ? 0.15 : (pUp.includes("GASOLINA") ? 0.25 : (pUp.includes("IYA") ? 0.20 : 0.0));
            return { nombre: pUp, tolerancia_pct: tol };
          }));
        }
        if (Array.isArray(catData.tramos) && catData.tramos.length > 0) {
          setCatalogTramos(catData.tramos);
        }
      }
      // Memoria Inteligente y Sincronización Compartida:
      // Primero verificar si existe filtro compartido entre módulos (Liquidaciones <-> Viajes)
      const shared = getSavedState<any>(`transporte_${schema}_filtro_compartido`, null);
      const saved = getSavedState<any>(`transporte_${schema}_viajes_memoria`, null);
      const effectiveFilter = shared || saved;

      if (effectiveFilter) {
        if (effectiveFilter.periodo !== undefined) setPeriodo(effectiveFilter.periodo);
        if (effectiveFilter.activeFilterLabel !== undefined) setActiveFilterLabel(effectiveFilter.activeFilterLabel);
        if (effectiveFilter.dateFilterQuery !== undefined) setDateFilterQuery(effectiveFilter.dateFilterQuery);
        if (effectiveFilter.filterMode !== undefined) setFilterMode(effectiveFilter.filterMode);
        if (effectiveFilter.metodoFiltro !== undefined) setMetodoFiltro(effectiveFilter.metodoFiltro);
        if (effectiveFilter.modoFactura !== undefined) setModoFactura(effectiveFilter.modoFactura);
        if (effectiveFilter.facturaInput !== undefined) setFacturaInput(effectiveFilter.facturaInput);
        if (effectiveFilter.facturaDesdeInput !== undefined) setFacturaDesdeInput(effectiveFilter.facturaDesdeInput);
        if (effectiveFilter.facturaHastaInput !== undefined) setFacturaHastaInput(effectiveFilter.facturaHastaInput);
        if (effectiveFilter.placa !== undefined) setPlacaFiltro(effectiveFilter.placa);
        else if (effectiveFilter.placaFiltro !== undefined) setPlacaFiltro(effectiveFilter.placaFiltro);
        if (saved) {
          if (saved.productoFiltro !== undefined) setProductoFiltro(saved.productoFiltro);
          if (saved.sortBy !== undefined) setSortBy(saved.sortBy);
          if (saved.sortDir !== undefined) setSortDir(saved.sortDir);
          if (saved.pageSize !== undefined) setPageSize(saved.pageSize);
          if (saved.activeMainTab !== undefined) setActiveMainTab(saved.activeMainTab);
          if (saved.tablaModo !== undefined) setTablaModo(saved.tablaModo);
          if (saved.historialFacturadoFilter !== undefined) setHistorialFacturadoFilter(saved.historialFacturadoFilter);
        }
      } else {
        if (Array.isArray(pData) && pData.length > 0 && !periodo) {
          setPeriodo(pData[0].periodo_mes);
        }
      }

      // Restaurar selección de facturas con derecho a crédito fiscal
      const savedConDerecho = getSavedState<string[]>(`transporte_${schema}_viajes_facturas_con_derecho`, []);
      if (Array.isArray(savedConDerecho)) {
        // Asegurar independencia: cargar solo identificadores de fila/grupo
        setFacturasConDerecho(savedConDerecho.filter((k) => typeof k === "string" && k.includes("___")));
      }

      setIsHydrated(true);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleFacturaConDerecho = (groupKey: string, checked: boolean) => {
    if (!groupKey) return;
    setFacturasConDerecho((prev) => {
      let next: string[];
      if (checked) {
        next = prev.includes(groupKey) ? prev : [...prev, groupKey];
      } else {
        next = prev.filter((k) => k !== groupKey);
      }
      if (schema) {
        saveState(`transporte_${schema}_viajes_facturas_con_derecho`, next);
      }
      return next;
    });
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
    const { value: formValues } = await Swal.fire({
      title: "Nuevo Producto de Transporte",
      html: `
        <div style="text-align: left; font-size: 13px; color: #cbd5e1; display: flex; flex-direction: column; gap: 12px; margin-top: 10px;">
          <div>
            <label style="display: block; font-weight: 700; font-size: 11px; text-transform: uppercase; color: #94a3b8; margin-bottom: 4px;">
              Nombre del Producto *
            </label>
            <input id="swal-input-prod-nombre" class="swal2-input" placeholder="ej. CRUDO, ALCOHOL, PLANCHAS DE ACERO..." style="margin: 0; width: 100%; box-sizing: border-box; background: #1e293b; color: #f8fafc; border: 1px solid #334155; border-radius: 8px; font-size: 13px; padding: 10px;" />
          </div>
          <div>
            <label style="display: block; font-weight: 700; font-size: 11px; text-transform: uppercase; color: #94a3b8; margin-bottom: 4px;">
              Tolerancia de Merma (%) *
            </label>
            <input id="swal-input-prod-tol" type="number" step="0.01" min="0" max="100" class="swal2-input" placeholder="ej. 0.20 para 0.20%, 0.00 para cargas secas" value="0.20" style="margin: 0; width: 100%; box-sizing: border-box; background: #1e293b; color: #f8fafc; border: 1px solid #334155; border-radius: 8px; font-size: 13px; padding: 10px;" />
            <span style="font-size: 10px; color: #64748b; margin-top: 2px; display: block;">Rango permitido: 0.00% a 100.00% (ej. 0.15% para Diesel, 0.25% Gasolina)</span>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Guardar Producto",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#f59e0b",
      background: "#0f172a",
      color: "#f8fafc",
      focusConfirm: false,
      preConfirm: () => {
        const nombreInput = document.getElementById("swal-input-prod-nombre") as HTMLInputElement;
        const tolInput = document.getElementById("swal-input-prod-tol") as HTMLInputElement;
        const nombre = nombreInput?.value?.trim() || "";
        const tolStr = tolInput?.value?.trim() || "";

        if (!nombre) {
          Swal.showValidationMessage("Por favor ingrese el nombre del producto.");
          return false;
        }

        const tolNum = parseFloat(tolStr);
        if (isNaN(tolNum) || tolNum < 0 || tolNum > 100) {
          Swal.showValidationMessage("La tolerancia debe ser un valor numérico entre 0.00% y 100.00%.");
          return false;
        }

        return {
          nombre: nombre.toUpperCase(),
          tolerancia_pct: Math.round(tolNum * 100) / 100
        };
      }
    });

    if (formValues) {
      const prodUpper = formValues.nombre;
      const tolVal = formValues.tolerancia_pct;
      try {
        await apiFetch(`/tenants/${schema}/parametros/productos`, {
          method: "POST",
          body: JSON.stringify({ producto: prodUpper, tolerancia_pct: tolVal })
        });
        setCatalogProductos(prev => Array.from(new Set([...prev, prodUpper])));
        setCatalogProductosDetalle(prev => {
          const filtered = prev.filter(p => p.nombre.toUpperCase() !== prodUpper);
          return [...filtered, { nombre: prodUpper, tolerancia_pct: tolVal }];
        });
        setFormData(prev => ({ ...prev, producto: prodUpper }));
        Swal.fire({
          icon: "success",
          title: "Producto registrado",
          text: `El producto ${prodUpper} con tolerancia del ${tolVal}% ha sido guardado exitosamente.`,
          timer: 1800,
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

  const handleEditProducto = async () => {
    const currentProd = formData.producto?.trim() || "";
    if (!currentProd) {
      Swal.fire({
        icon: "info",
        title: "Seleccione un producto",
        text: "Por favor seleccione el producto que desea editar en los botones de abajo.",
        confirmButtonColor: "#f59e0b",
        background: "#0f172a",
        color: "#f8fafc"
      });
      return;
    }

    const currentUpper = currentProd.toUpperCase();
    const matched = catalogProductosDetalle.find(p => p.nombre.toUpperCase() === currentUpper);
    let defaultTol = 0.20;
    if (matched && matched.tolerancia_pct !== undefined && matched.tolerancia_pct !== null) {
      defaultTol = matched.tolerancia_pct;
    } else if (currentUpper.includes("DIESEL") || currentUpper.includes("DIÉSEL") || currentUpper === "DO") {
      defaultTol = 0.15;
    } else if (currentUpper.includes("GASOLINA")) {
      defaultTol = 0.25;
    } else if (currentUpper.includes("IYA") || currentUpper.includes("INSUMOS") || currentUpper.includes("ADIT")) {
      defaultTol = 0.20;
    } else if (currentUpper.includes("PLANCHA") || currentUpper.includes("SOYA") || currentUpper.includes("ACERO") || currentUpper.includes("GIRASOL")) {
      defaultTol = 0.00;
    }

    const { value: formValues } = await Swal.fire({
      title: "Editar Producto de Transporte",
      html: `
        <div style="text-align: left; font-size: 13px; color: #cbd5e1; display: flex; flex-direction: column; gap: 12px; margin-top: 10px;">
          <div>
            <label style="display: block; font-weight: 700; font-size: 11px; text-transform: uppercase; color: #94a3b8; margin-bottom: 4px;">
              Nombre del Producto *
            </label>
            <input id="swal-edit-prod-nombre" class="swal2-input" value="${currentProd}" placeholder="Nombre del producto..." style="margin: 0; width: 100%; box-sizing: border-box; background: #1e293b; color: #f8fafc; border: 1px solid #334155; border-radius: 8px; font-size: 13px; padding: 10px;" />
          </div>
          <div>
            <label style="display: block; font-weight: 700; font-size: 11px; text-transform: uppercase; color: #94a3b8; margin-bottom: 4px;">
              Tolerancia de Merma (%) *
            </label>
            <input id="swal-edit-prod-tol" type="number" step="0.01" min="0" max="100" class="swal2-input" value="${defaultTol}" style="margin: 0; width: 100%; box-sizing: border-box; background: #1e293b; color: #f8fafc; border: 1px solid #334155; border-radius: 8px; font-size: 13px; padding: 10px;" />
            <span style="font-size: 10px; color: #64748b; margin-top: 2px; display: block;">Rango permitido: 0.00% a 100.00%</span>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Actualizar Producto",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#0284c7",
      background: "#0f172a",
      color: "#f8fafc",
      focusConfirm: false,
      preConfirm: () => {
        const nombreInput = document.getElementById("swal-edit-prod-nombre") as HTMLInputElement;
        const tolInput = document.getElementById("swal-edit-prod-tol") as HTMLInputElement;
        const nombre = nombreInput?.value?.trim() || "";
        const tolStr = tolInput?.value?.trim() || "";

        if (!nombre) {
          Swal.showValidationMessage("Por favor ingrese el nombre del producto.");
          return false;
        }

        const tolNum = parseFloat(tolStr);
        if (isNaN(tolNum) || tolNum < 0 || tolNum > 100) {
          Swal.showValidationMessage("La tolerancia debe ser un valor numérico entre 0.00% y 100.00%.");
          return false;
        }

        return {
          nombre: nombre.toUpperCase(),
          tolerancia_pct: Math.round(tolNum * 100) / 100
        };
      }
    });

    if (formValues) {
      const newProdUpper = formValues.nombre;
      const newTolVal = formValues.tolerancia_pct;
      try {
        await apiFetch(`/tenants/${schema}/parametros/productos`, {
          method: "PUT",
          body: JSON.stringify({ 
            producto: newProdUpper, 
            tolerancia_pct: newTolVal,
            nombre_anterior: currentUpper
          })
        });

        setCatalogProductos(prev => {
          const idx = prev.findIndex(p => p.toUpperCase() === currentUpper);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = newProdUpper;
            return Array.from(new Set(next));
          }
          return Array.from(new Set([...prev, newProdUpper]));
        });

        setCatalogProductosDetalle(prev => {
          const filtered = prev.filter(p => p.nombre.toUpperCase() !== currentUpper && p.nombre.toUpperCase() !== newProdUpper);
          return [...filtered, { nombre: newProdUpper, tolerancia_pct: newTolVal }];
        });

        setFormData(prev => ({ ...prev, producto: newProdUpper }));

        Swal.fire({
          icon: "success",
          title: "Producto actualizado",
          text: `El producto ${newProdUpper} (Tolerancia: ${newTolVal}%) se actualizó correctamente.`,
          timer: 1800,
          showConfirmButton: false,
          background: "#0f172a",
          color: "#f8fafc"
        });
      } catch (e: any) {
        Swal.fire({
          icon: "error",
          title: "Error al actualizar",
          text: e.message || "No se pudo actualizar el producto",
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

  const handleSelectFacturaChip = (facNum: string) => {
    if (modoFactura === "unica") {
      setFacturaInput(facNum);
    } else {
      if (!facturaDesdeInput || (facturaDesdeInput && facturaHastaInput)) {
        setFacturaDesdeInput(facNum);
        setFacturaHastaInput("");
      } else {
        const dNum = parseInt(facturaDesdeInput.replace(/\D/g, ""), 10);
        const hNum = parseInt(facNum.replace(/\D/g, ""), 10);
        if (!isNaN(dNum) && !isNaN(hNum)) {
          if (hNum < dNum) {
            setFacturaDesdeInput(facNum);
            setFacturaHastaInput(facturaDesdeInput);
          } else {
            setFacturaHastaInput(facNum);
          }
        } else {
          setFacturaHastaInput(facNum);
        }
      }
    }
  };

  const loadViajes = async () => {
    setLoading(true);
    try {
      let query = "";
      const params: string[] = [];
      if (metodoFiltro === "factura") {
        if (modoFactura === "unica" && facturaInput.trim()) {
          params.push(`nro_factura=${encodeURIComponent(facturaInput.trim())}`);
        } else if (modoFactura === "rango") {
          if (facturaDesdeInput.trim()) {
            params.push(`factura_desde=${encodeURIComponent(facturaDesdeInput.trim())}`);
          }
          if (facturaHastaInput.trim()) {
            params.push(`factura_hasta=${encodeURIComponent(facturaHastaInput.trim())}`);
          }
        }
      } else {
        if (dateFilterQuery) {
          params.push(dateFilterQuery);
        } else if (periodo) {
          params.push(`periodo_mes=${encodeURIComponent(periodo)}`);
        }
      }
      if (placaFiltro) params.push(`placa=${encodeURIComponent(placaFiltro)}`);
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
    setFilterMode(filter.mode);
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
        volumen_facturado: vRec
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
        volumen_facturado: vRec
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
      volumen_facturado: vRec,
      tarifa_flete: 392.00,
      tipo_tarifa: "BS_POR_M3",
      precio_merma_litro_bs: 7.450000,
      observaciones: "",
      descuentos_adicionales: [],
      descuentos_mermas: [],
      comision_usd_m3: 1.00,
      tipo_cambio_bs: 6.96,
      comision_pct_1: 7.00,
      comision_ypfb_bolgart_pct: 7.00,
      comision_pct_2: 3.00,
      costo_hojas_de_ruta_bs: 0.00,
      costo_gps_bs: 0.00,
      anticipos_otros_pct: 0.00
    });
    setShowModal(true);
  };

  const openEditModal = (v: Viaje) => {
    setEditingViaje(v);
    if (v.producto && !catalogProductos.includes(v.producto)) {
      setCatalogProductos(prev => Array.from(new Set([...prev, v.producto])));
    }

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

    const volFact = v.volumen_facturado !== null && v.volumen_facturado !== undefined && Number(v.volumen_facturado) > 0
      ? (Number(v.volumen_facturado) < 1000 ? Math.round(Number(v.volumen_facturado) * 1000) : Number(v.volumen_facturado))
      : (v.volumen_recepcionado_litros || 0);

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
      precio_merma_litro_bs: v.precio_merma_litro_bs !== undefined && v.precio_merma_litro_bs !== null ? v.precio_merma_litro_bs : 7.450000,
      observaciones: v.observaciones || "",
      descuentos_adicionales: parsedAdic,
      descuentos_mermas: parsedMerm,
      comision_usd_m3: v.comision_usd_m3 !== undefined && v.comision_usd_m3 !== null ? v.comision_usd_m3 : 1.00,
      tipo_cambio_bs: v.tipo_cambio_bs !== undefined && v.tipo_cambio_bs !== null ? v.tipo_cambio_bs : 6.96,
      comision_pct_1: v.comision_pct_1 !== undefined && v.comision_pct_1 !== null ? v.comision_pct_1 : 7.00,
      comision_ypfb_bolgart_pct: v.comision_ypfb_bolgart_pct !== undefined && v.comision_ypfb_bolgart_pct !== null ? v.comision_ypfb_bolgart_pct : 7.00,
      comision_pct_2: v.comision_pct_2 !== undefined && v.comision_pct_2 !== null ? v.comision_pct_2 : 3.00,
      costo_hojas_de_ruta_bs: v.costo_hojas_de_ruta_bs !== undefined && v.costo_hojas_de_ruta_bs !== null ? v.costo_hojas_de_ruta_bs : 0.00,
      costo_gps_bs: v.costo_gps_bs !== undefined && v.costo_gps_bs !== null ? v.costo_gps_bs : 0.00,
      anticipos_otros_pct: v.anticipos_otros_pct !== undefined && v.anticipos_otros_pct !== null ? v.anticipos_otros_pct : 0.00
    });
    setShowModal(true);
  };

  const handleDuplicate = (v: Viaje) => {
    setEditingViaje(null); // Es un registro nuevo
    if (v.producto && !catalogProductos.includes(v.producto)) {
      setCatalogProductos(prev => Array.from(new Set([...prev, v.producto])));
    }
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

    const volFact = v.volumen_facturado !== null && v.volumen_facturado !== undefined && Number(v.volumen_facturado) > 0
      ? (Number(v.volumen_facturado) < 1000 ? Math.round(Number(v.volumen_facturado) * 1000) : Number(v.volumen_facturado))
      : (v.volumen_recepcionado_litros || 0);

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
      precio_merma_litro_bs: v.precio_merma_litro_bs !== undefined && v.precio_merma_litro_bs !== null ? v.precio_merma_litro_bs : 7.450000,
      observaciones: v.observaciones || "",
      descuentos_adicionales: parsedAdic,
      descuentos_mermas: parsedMerm,
      comision_usd_m3: v.comision_usd_m3 !== undefined && v.comision_usd_m3 !== null ? v.comision_usd_m3 : 1.00,
      tipo_cambio_bs: v.tipo_cambio_bs !== undefined && v.tipo_cambio_bs !== null ? v.tipo_cambio_bs : 6.96,
      comision_pct_1: v.comision_pct_1 !== undefined && v.comision_pct_1 !== null ? v.comision_pct_1 : 7.00,
      comision_ypfb_bolgart_pct: v.comision_ypfb_bolgart_pct !== undefined && v.comision_ypfb_bolgart_pct !== null ? v.comision_ypfb_bolgart_pct : 7.00,
      comision_pct_2: v.comision_pct_2 !== undefined && v.comision_pct_2 !== null ? v.comision_pct_2 : 3.00,
      costo_hojas_de_ruta_bs: v.costo_hojas_de_ruta_bs !== undefined && v.costo_hojas_de_ruta_bs !== null ? v.costo_hojas_de_ruta_bs : 0.00,
      costo_gps_bs: v.costo_gps_bs !== undefined && v.costo_gps_bs !== null ? v.costo_gps_bs : 0.00,
      anticipos_otros_pct: v.anticipos_otros_pct !== undefined && v.anticipos_otros_pct !== null ? v.anticipos_otros_pct : 0.00
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

      const totDescViaje = (liveCalc.merma_descontar_bs || 0) + (liveCalc.total_descuentos_adicionales || 0) + (liveCalc.total_descuentos_mermas || 0);
      if (totDescViaje > liveCalc.flete_total_bs && liveCalc.flete_total_bs > 0) {
        const confirmDesc = await Swal.fire({
          title: "¿Descuentos mayores al flete?",
          text: `El total de descuentos (${formatCurrency(totDescViaje)}) supera el flete bruto (${formatCurrency(liveCalc.flete_total_bs)}), resultando en un saldo neto de ${formatCurrency(liveCalc.liquido_pagable_bs)}. ¿Deseas registrar este despacho?`,
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

      const vRecNum = Number(formData.volumen_recepcionado_litros) || 0;
      let vFactNum = formData.volumen_facturado !== "" && formData.volumen_facturado !== undefined
        ? Number(formData.volumen_facturado)
        : vRecNum;
      if (vFactNum < 1000) {
        vFactNum = vFactNum * 1000.0;
      }

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
        precio_merma_litro_bs: Number(formData.precio_merma_litro_bs) || 7.450000,
        descuentos_adicionales: formData.descuentos_adicionales,
        descuentos_mermas: formData.descuentos_mermas,
        observaciones: formData.observaciones.trim() || null,
        comision_usd_m3: isYpfbClient(formData.cliente) ? (formData.comision_usd_m3 !== "" ? Number(formData.comision_usd_m3) : 1.0) : 0.0,
        tipo_cambio_bs: isYpfbClient(formData.cliente) ? (formData.tipo_cambio_bs !== "" ? Number(formData.tipo_cambio_bs) : 6.96) : 6.96,
        comision_pct_1: isYpfbClient(formData.cliente) ? (formData.comision_pct_1 !== "" ? Number(formData.comision_pct_1) : 7.0) : 0.0,
        comision_ypfb_bolgart_pct: isYpfbClient(formData.cliente) ? (formData.comision_ypfb_bolgart_pct !== "" ? Number(formData.comision_ypfb_bolgart_pct) : 7.0) : 0.0,
        comision_pct_2: isYpfbClient(formData.cliente) ? (formData.comision_pct_2 !== "" ? Number(formData.comision_pct_2) : 3.0) : 0.0,
        costo_hojas_de_ruta_bs: isYpfbClient(formData.cliente) ? (formData.costo_hojas_de_ruta_bs !== "" ? Number(formData.costo_hojas_de_ruta_bs) : 0.0) : 0.0,
        costo_gps_bs: isYpfbClient(formData.cliente) ? (formData.costo_gps_bs !== "" ? Number(formData.costo_gps_bs) : 0.0) : 0.0,
        anticipos_otros_pct: isYpfbClient(formData.cliente) ? (formData.anticipos_otros_pct !== "" ? Number(formData.anticipos_otros_pct) : 0.0) : 0.0
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
      const filename = `Plantilla_Carga_Viajes_${schema}.xlsx`;
      downloadBlob(blob, filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
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

  // Exportación a Excel con Ordenamiento y Filtros
  const handleExportExcel = async () => {
    if (viajes.length === 0) {
      Swal.fire({
        icon: "info",
        title: "Sin viajes para exportar",
        text: "No hay viajes registrados en el período o filtro actual.",
        background: "#0f172a",
        color: "#f8fafc",
        confirmButtonColor: "#f59e0b"
      });
      return;
    }

    try {
      setIsExportingExcel(true);
      const params: string[] = [];
      if (metodoFiltro === "factura") {
        if (modoFactura === "unica" && facturaInput.trim()) {
          params.push(`nro_factura=${encodeURIComponent(facturaInput.trim())}`);
        } else if (modoFactura === "rango") {
          if (facturaDesdeInput.trim()) {
            params.push(`factura_desde=${encodeURIComponent(facturaDesdeInput.trim())}`);
          }
          if (facturaHastaInput.trim()) {
            params.push(`factura_hasta=${encodeURIComponent(facturaHastaInput.trim())}`);
          }
        }
      } else {
        if (dateFilterQuery) {
          params.push(dateFilterQuery);
        } else if (periodo) {
          params.push(`periodo_mes=${encodeURIComponent(periodo)}`);
        }
      }
      if (placaFiltro) {
        params.push(`placa=${encodeURIComponent(placaFiltro)}`);
      }
      if (productoFiltro && productoFiltro !== "TODOS") {
        params.push(`producto=${encodeURIComponent(productoFiltro)}`);
      }
      if (search) {
        params.push(`search=${encodeURIComponent(search)}`);
      }
      params.push(`order_by=${sortBy}`);
      params.push(`order_dir=${sortDir}`);

      const q = params.length > 0 ? `?${params.join("&")}` : "";
      const blob = await apiFetch(`/tenants/${schema}/viajes/exportar-excel${q}`);
      const safeLabel = (activeFilterLabel || periodo || "Viajes").replace(/\s+/g, "_");
      downloadBlob(
        blob,
        `Despachos_${safeLabel}_${sortBy}_${sortDir}.xlsx`,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      Swal.fire({
        icon: "success",
        title: "Excel Descargado",
        text: `Se descargaron los viajes ordenados por ${sortBy} (${sortDir === "asc" ? "Ascendente" : "Descendente"}).`,
        timer: 1600,
        showConfirmButton: false,
        background: "#0f172a",
        color: "#f8fafc"
      });
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al exportar",
        text: err.message || "No se pudo generar el archivo Excel.",
        confirmButtonColor: "#f59e0b",
        background: "#0f172a",
        color: "#f8fafc"
      });
    } finally {
      setIsExportingExcel(false);
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
        if (res.periodos_detectados.length > 1) {
          handleDateFilterChange({ mode: "historico", label: "Histórico Completo (Todos los Años)" });
        } else {
          setPeriodo(res.periodos_detectados[0]);
        }
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

  // Filtrado de viajes para Planilla optimizado con useMemo
  const filtered = useMemo(() => {
    const list = Array.isArray(viajes) ? viajes : [];
    if (productoFiltro === "TODOS" && !search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((v) => {
      if (productoFiltro !== "TODOS" && v.producto !== productoFiltro) return false;
      if (q) {
        return (
          v.placa.toLowerCase().includes(q) ||
          (v.mic_dta ? v.mic_dta.toLowerCase().includes(q) : false) ||
          (v.nro_factura ? v.nro_factura.toLowerCase().includes(q) : false) ||
          v.tramo.toLowerCase().includes(q) ||
          v.cliente.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [viajes, productoFiltro, search]);

  // Filtrado específico para Historial optimizado con useMemo
  const historialFiltered = useMemo(() => {
    const list = Array.isArray(viajes) ? viajes : [];
    const q = search.trim().toLowerCase();
    return list.filter((v) => {
      if (historialFacturadoFilter === "FACTURADOS" && (!v.nro_factura || !v.nro_factura.trim())) {
        return false;
      }
      if (historialFacturadoFilter === "SIN_FACTURAR" && v.nro_factura && v.nro_factura.trim()) {
        return false;
      }
      if (productoFiltro !== "TODOS" && v.producto !== productoFiltro) {
        return false;
      }
      if (q) {
        return (
          v.placa.toLowerCase().includes(q) ||
          (v.mic_dta ? v.mic_dta.toLowerCase().includes(q) : false) ||
          (v.nro_factura ? v.nro_factura.toLowerCase().includes(q) : false) ||
          v.tramo.toLowerCase().includes(q) ||
          v.cliente.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [viajes, historialFacturadoFilter, productoFiltro, search]);

  // Ordenamiento dinámico de Historial
  const sortedHistorialFiltered = useMemo(() => {
    const list = [...historialFiltered];
    if (sortBy === "fecha") {
      list.sort((a, b) => {
        const dA = a.fecha_carga || a.fecha_factura || "";
        const dB = b.fecha_carga || b.fecha_factura || "";
        const cmp = dA.localeCompare(dB);
        return sortDir === "asc" ? cmp : -cmp;
      });
    } else if (sortBy === "factura") {
      list.sort((a, b) => {
        const fA = (a.nro_factura || "").trim();
        const fB = (b.nro_factura || "").trim();
        if (!fA && fB) return 1;
        if (fA && !fB) return -1;
        const cmp = fA.localeCompare(fB, undefined, { numeric: true, sensitivity: "base" });
        return sortDir === "asc" ? cmp : -cmp;
      });
    } else if (sortBy === "placa") {
      list.sort((a, b) => {
        const cmp = (a.placa || "").localeCompare(b.placa || "");
        return sortDir === "asc" ? cmp : -cmp;
      });
    } else if (sortBy === "cliente") {
      list.sort((a, b) => {
        const cmp = (a.cliente || "").localeCompare(b.cliente || "");
        return sortDir === "asc" ? cmp : -cmp;
      });
    } else if (sortBy === "flete") {
      list.sort((a, b) => {
        const diff = (Number(a.flete_total_bs) || 0) - (Number(b.flete_total_bs) || 0);
        return sortDir === "asc" ? diff : -diff;
      });
    }
    return list;
  }, [historialFiltered, sortBy, sortDir]);

  // Agrupación y Ordenamiento de Planilla optimizada con useMemo
  const planillaGroups = useMemo(() => {
    const groupsMap: { [k: string]: { key: string; tramo: string; producto: string; factura: string; items: Viaje[] } } = {};
    for (const v of filtered) {
      const p = (v.producto || "SIN PRODUCTO").trim().toUpperCase();
      const f = (v.nro_factura || "").trim().toUpperCase() || "S/F";
      const t = (v.tramo || "VARIOS TRAMOS").trim().toUpperCase();
      const key = `${f}___${p}`;
      if (!groupsMap[key]) {
        groupsMap[key] = { key, tramo: t, producto: p, factura: f, items: [] };
      }
      groupsMap[key].items.push(v);
    }

    const groupsList = Object.values(groupsMap).map((g) => {
      g.items.sort((a, b) => {
        if (sortBy === "fecha") {
          const dA = a.fecha_factura || a.fecha_carga || "";
          const dB = b.fecha_factura || b.fecha_carga || "";
          const cmp = dA.localeCompare(dB);
          return sortDir === "asc" ? cmp : -cmp;
        } else if (sortBy === "placa") {
          const cmp = (a.placa || "").localeCompare(b.placa || "");
          return sortDir === "asc" ? cmp : -cmp;
        } else if (sortBy === "cliente") {
          const cmp = (a.cliente || "").localeCompare(b.cliente || "");
          return sortDir === "asc" ? cmp : -cmp;
        }
        const dA = a.fecha_factura || a.fecha_carga || "";
        const dB = b.fecha_factura || b.fecha_carga || "";
        return dA.localeCompare(dB);
      });
      return g;
    });

    groupsList.sort((a, b) => {
      if (sortBy === "factura") {
        const cmp = a.factura.localeCompare(b.factura, undefined, { numeric: true, sensitivity: "base" });
        return sortDir === "asc" ? cmp : -cmp;
      }
      // Priorizar cronológicamente por FECHA DE FACTURA ascendente (ej. enero, febrero, etc.)
      const dateA = a.items.find((x) => x.fecha_factura)?.fecha_factura || a.items[0]?.fecha_carga || "";
      const dateB = b.items.find((x) => x.fecha_factura)?.fecha_factura || b.items[0]?.fecha_carga || "";
      if (dateA && dateB && dateA !== dateB) {
        const cmp = dateA.localeCompare(dateB);
        return sortDir === "asc" ? cmp : -cmp;
      }
      if (dateA && !dateB) return sortDir === "asc" ? -1 : 1;
      if (!dateA && dateB) return sortDir === "asc" ? 1 : -1;
      const fA = a.factura === "S/F" ? "ZZZZZ" : a.factura;
      const fB = b.factura === "S/F" ? "ZZZZZ" : b.factura;
      return fA.localeCompare(fB, undefined, { numeric: true, sensitivity: "base" });
    });

    return groupsList;
  }, [filtered, sortBy, sortDir]);

  // Paginación para Historial y Planilla
  const totalHistorialItems = sortedHistorialFiltered.length;
  const totalHistorialPages = pageSize === 0 ? 1 : Math.ceil(totalHistorialItems / pageSize) || 1;
  const paginatedHistorial = useMemo(() => {
    if (pageSize === 0) return sortedHistorialFiltered;
    const start = (currentPage - 1) * pageSize;
    return sortedHistorialFiltered.slice(start, start + pageSize);
  }, [sortedHistorialFiltered, currentPage, pageSize]);

  const totalPlanillaGroups = planillaGroups.length;
  const totalPlanillaPages = pageSize === 0 ? 1 : Math.ceil(totalPlanillaGroups / pageSize) || 1;
  const paginatedGroups = useMemo(() => {
    if (pageSize === 0) return planillaGroups;
    const start = (currentPage - 1) * pageSize;
    return planillaGroups.slice(start, start + pageSize);
  }, [planillaGroups, currentPage, pageSize]);

  const startGlobalIdx = useMemo(() => {
    if (pageSize === 0 || currentPage <= 1) return 0;
    const prevGroups = planillaGroups.slice(0, (currentPage - 1) * pageSize);
    return prevGroups.reduce((acc, g) => acc + g.items.length, 0);
  }, [planillaGroups, currentPage, pageSize]);

  // Métricas Sumatorias de Planilla calculadas en un solo paso
  const {
    totalDespachado,
    totalRecepcionado,
    totalMermaReal,
    totalDescMermaBs,
    totalVolFacturado,
    totalFleteBs,
    totalFleteMenosMermasBs,
    totalDescAdicBs,
    totalTodosDescuentos,
    totalLiquidoGeneral
  } = useMemo(() => {
    let desp = 0;
    let recep = 0;
    let mReal = 0;
    let dMerma = 0;
    let vFact = 0;
    let flete = 0;
    let dAdic = 0;

    for (const v of filtered) {
      desp += v.volumen_origen_litros || 0;
      recep += v.volumen_recepcionado_litros || 0;
      mReal += v.merma_real_litros || 0;
      dMerma += v.merma_descontar_bs || 0;
      vFact += getVolFactLitros(v);
      flete += v.flete_total_bs || 0;
      dAdic += (v.total_descuentos_adicionales_bs || 0) + (v.total_descuentos_mermas_bs || 0);
    }
    const totDesc = dMerma + dAdic;
    return {
      totalDespachado: desp,
      totalRecepcionado: recep,
      totalMermaReal: mReal,
      totalDescMermaBs: dMerma,
      totalVolFacturado: vFact,
      totalFleteBs: flete,
      totalFleteMenosMermasBs: Math.max(0, flete - dMerma),
      totalDescAdicBs: dAdic,
      totalTodosDescuentos: totDesc,
      totalLiquidoGeneral: flete - totDesc
    };
  }, [filtered]);

  // Detalle y conciliación de Facturas Con Derecho a Crédito Fiscal (IVA 13%)
  const facturasConDerechoDetalle = useMemo(() => {
    const list: Array<{
      key: string;
      factura: string;
      tramo: string;
      fechas: string[];
      flete: number;
      debito: number;
      neto: number;
      itemsCount: number;
      producto: string;
    }> = [];

    for (const group of planillaGroups) {
      const groupKey = group.key || `${group.tramo}___${group.producto}___${group.factura}`;
      const f = (group.factura || "").trim().toUpperCase();
      if (f && f !== "S/F" && facturasConDerecho.includes(groupKey)) {
        const fechas = Array.from(new Set(group.items.map(x => x.fecha_factura).filter(Boolean))) as string[];
        const fleteGrp = group.items.reduce((acc, x) => acc + (Number(x.flete_total_bs) || 0), 0);
        const debito = Math.round(fleteGrp * 0.13 * 100) / 100;
        const neto = fleteGrp - debito;
        list.push({
          key: groupKey,
          factura: f,
          tramo: group.tramo,
          fechas,
          flete: fleteGrp,
          debito,
          neto,
          itemsCount: group.items.length,
          producto: group.producto
        });
      }
    }

    return list;
  }, [planillaGroups, facturasConDerecho]);

  const fiscalStats = useMemo(() => {
    const totVentasBrutas = totalFleteBs;
    const totVbConDerecho = facturasConDerechoDetalle.reduce((acc, x) => acc + x.flete, 0);
    const totDebito13 = Math.round(totVbConDerecho * 0.13 * 100) / 100;
    const totVnConDerecho = totVbConDerecho - totDebito13;
    const totVnSinDerecho = Math.max(0, totVentasBrutas - totVbConDerecho);
    const totVentasNetasGestion = totVentasBrutas - totDebito13;

    return {
      totVentasBrutas,
      totVnSinDerecho,
      totVbConDerecho,
      totDebito13,
      totVnConDerecho,
      totVentasNetasGestion,
      countConDerecho: facturasConDerechoDetalle.length,
    };
  }, [totalFleteBs, facturasConDerechoDetalle]);

  const gestionYearLabel = useMemo(() => {
    const match = (activeFilterLabel || "").match(/\b(202\d)\b/) || (periodo || "").match(/\b(202\d)\b/);
    if (match) return match[1];
    if (filtered.length > 0 && filtered[0].fecha_carga) {
      const y = filtered[0].fecha_carga.slice(0, 4);
      if (y) return y;
    }
    return new Date().getFullYear().toString();
  }, [activeFilterLabel, periodo, filtered]);

  // Deducciones YPFB calculadas para los viajes filtrados (Hoja 2)
  const deduccionesResumen = useMemo(() => {
    const ypfbViajes = filtered.filter(v => isYpfbClient(v.cliente));
    
    // Flete total: flete de todos los viajes filtrados
    const fleteTotalBruto = filtered.reduce((acc, v) => acc + (Number(v.flete_total_bs) || 0), 0);
    
    // Cálculos individuales sobre viajes YPFB
    let calcMerma = 0;
    let calcComisionUsd = 0;
    let calcComision7 = 0;
    let calcBolGart7 = 0;
    let calcComision3 = 0;
    let calcAnticipos = 0;
    let maxHojasRuta = 0;
    let maxGps = 0;

    for (const v of ypfbViajes) {
      const flete = Number(v.flete_total_bs) || 0;
      const volLitros = v.volumen_facturado !== null && v.volumen_facturado !== undefined && Number(v.volumen_facturado) > 0
        ? Number(v.volumen_facturado)
        : (Number(v.volumen_recepcionado_litros) || 0);
      const volM3 = volLitros / 1000.0;

      calcMerma += Number(v.merma_descontar_bs) || 0;
      
      const comUsd = v.comision_usd_m3 !== undefined && v.comision_usd_m3 !== null ? Number(v.comision_usd_m3) : 1.0;
      calcComisionUsd += volM3 * comUsd * 6.96;

      const p1 = v.comision_pct_1 !== undefined && v.comision_pct_1 !== null ? Number(v.comision_pct_1) : 7.0;
      calcComision7 += flete * (p1 / 100.0);

      const pBg = v.comision_ypfb_bolgart_pct !== undefined && v.comision_ypfb_bolgart_pct !== null ? Number(v.comision_ypfb_bolgart_pct) : 7.0;
      calcBolGart7 += flete * (pBg / 100.0);

      const p2 = v.comision_pct_2 !== undefined && v.comision_pct_2 !== null ? Number(v.comision_pct_2) : 3.0;
      calcComision3 += flete * (p2 / 100.0);

      const pAnt = v.anticipos_otros_pct !== undefined && v.anticipos_otros_pct !== null ? Number(v.anticipos_otros_pct) : 0.0;
      calcAnticipos += flete * (pAnt / 100.0);

      const hr = v.costo_hojas_de_ruta_bs !== undefined && v.costo_hojas_de_ruta_bs !== null ? Number(v.costo_hojas_de_ruta_bs) : 0.0;
      if (hr > maxHojasRuta) maxHojasRuta = hr;

      const gps = v.costo_gps_bs !== undefined && v.costo_gps_bs !== null ? Number(v.costo_gps_bs) : 0.0;
      if (gps > maxGps) maxGps = gps;
    }

    if (ypfbViajes.length === 0) {
      maxHojasRuta = 0;
      maxGps = 0;
    }

    // Aplicar overrides si existen
    const descMerma = deductionsOverride.desc_merma_bs !== undefined && deductionsOverride.desc_merma_bs !== null
      ? Number(deductionsOverride.desc_merma_bs)
      : Math.round(calcMerma * 100) / 100;

    const descComisionUsd = deductionsOverride.desc_comision_usd_m3_bs !== undefined && deductionsOverride.desc_comision_usd_m3_bs !== null
      ? Number(deductionsOverride.desc_comision_usd_m3_bs)
      : Math.round(calcComisionUsd * 100) / 100;

    const descComision7 = deductionsOverride.desc_comision_7pct_bs !== undefined && deductionsOverride.desc_comision_7pct_bs !== null
      ? Number(deductionsOverride.desc_comision_7pct_bs)
      : Math.round(calcComision7 * 100) / 100;

    const descBolGart7 = deductionsOverride.desc_comision_ypfb_bolgart_7pct_bs !== undefined && deductionsOverride.desc_comision_ypfb_bolgart_7pct_bs !== null
      ? Number(deductionsOverride.desc_comision_ypfb_bolgart_7pct_bs)
      : Math.round(calcBolGart7 * 100) / 100;

    const descComision3 = deductionsOverride.desc_comision_3pct_bs !== undefined && deductionsOverride.desc_comision_3pct_bs !== null
      ? Number(deductionsOverride.desc_comision_3pct_bs)
      : Math.round(calcComision3 * 100) / 100;

    const descHojasRuta = deductionsOverride.desc_hojas_ruta_bs !== undefined && deductionsOverride.desc_hojas_ruta_bs !== null
      ? Number(deductionsOverride.desc_hojas_ruta_bs)
      : Math.round(maxHojasRuta * 100) / 100;

    const descGps = deductionsOverride.desc_gps_bs !== undefined && deductionsOverride.desc_gps_bs !== null
      ? Number(deductionsOverride.desc_gps_bs)
      : Math.round(maxGps * 100) / 100;

    const descAnticipos = deductionsOverride.desc_anticipos_otros_bs !== undefined && deductionsOverride.desc_anticipos_otros_bs !== null
      ? Number(deductionsOverride.desc_anticipos_otros_bs)
      : Math.round(calcAnticipos * 100) / 100;

    const descOtros = deductionsOverride.desc_otros_ajustes_bs !== undefined && deductionsOverride.desc_otros_ajustes_bs !== null
      ? Number(deductionsOverride.desc_otros_ajustes_bs)
      : 0;

    const totalDescuento = Math.round((descMerma + descComisionUsd + descComision7 + descBolGart7 + descComision3 + descHojasRuta + descGps + descAnticipos + descOtros) * 100) / 100;
    const liquidoPagable = Math.max(0, Math.round((fleteTotalBruto - totalDescuento) * 100) / 100);

    const hasOverrides = Object.values(deductionsOverride).some(v => v !== undefined && v !== null);

    return {
      ypfbCount: ypfbViajes.length,
      ypfbViajes,
      fleteTotalBruto,
      descMerma,
      descComisionUsd,
      descComision7,
      descBolGart7,
      descComision3,
      descHojasRuta,
      descGps,
      descAnticipos,
      descOtros,
      totalDescuento,
      liquidoPagable,
      hasOverrides
    };
  }, [filtered, deductionsOverride]);

  const openAdjustDeductionsModal = () => {
    setAdjustDeductionForm({
      desc_merma_bs: deductionsResumen.descMerma,
      desc_comision_usd_m3_bs: deductionsResumen.descComisionUsd,
      desc_comision_7pct_bs: deductionsResumen.descComision7,
      desc_comision_ypfb_bolgart_7pct_bs: deductionsResumen.descBolGart7,
      desc_comision_3pct_bs: deductionsResumen.descComision3,
      desc_hojas_ruta_bs: deductionsResumen.descHojasRuta,
      desc_gps_bs: deductionsResumen.descGps,
      desc_anticipos_otros_bs: deductionsResumen.descAnticipos,
      desc_otros_ajustes_bs: deductionsResumen.descOtros
    });
    setShowAdjustDeductionsModal(true);
  };

  const handleSaveDeductionsAdjustments = async (e: React.FormEvent) => {
    e.preventDefault();
    const newOverrides: Record<string, number | null> = {
      desc_merma_bs: adjustDeductionForm.desc_merma_bs !== "" ? Number(adjustDeductionForm.desc_merma_bs) : null,
      desc_comision_usd_m3_bs: adjustDeductionForm.desc_comision_usd_m3_bs !== "" ? Number(adjustDeductionForm.desc_comision_usd_m3_bs) : null,
      desc_comision_7pct_bs: adjustDeductionForm.desc_comision_7pct_bs !== "" ? Number(adjustDeductionForm.desc_comision_7pct_bs) : null,
      desc_comision_ypfb_bolgart_7pct_bs: adjustDeductionForm.desc_comision_ypfb_bolgart_7pct_bs !== "" ? Number(adjustDeductionForm.desc_comision_ypfb_bolgart_7pct_bs) : null,
      desc_comision_3pct_bs: adjustDeductionForm.desc_comision_3pct_bs !== "" ? Number(adjustDeductionForm.desc_comision_3pct_bs) : null,
      desc_hojas_ruta_bs: adjustDeductionForm.desc_hojas_ruta_bs !== "" ? Number(adjustDeductionForm.desc_hojas_ruta_bs) : null,
      desc_gps_bs: adjustDeductionForm.desc_gps_bs !== "" ? Number(adjustDeductionForm.desc_gps_bs) : null,
      desc_anticipos_otros_bs: adjustDeductionForm.desc_anticipos_otros_bs !== "" ? Number(adjustDeductionForm.desc_anticipos_otros_bs) : null,
      desc_otros_ajustes_bs: adjustDeductionForm.desc_otros_ajustes_bs !== "" ? Number(adjustDeductionForm.desc_otros_ajustes_bs) : null
    };
    setDeductionsOverride(newOverrides);
    setShowAdjustDeductionsModal(false);

    // Persistir en backend para los viajes YPFB si se actualizaron deducciones
    try {
      if (deduccionesResumen.ypfbViajes.length > 0) {
        const updatePromises = deduccionesResumen.ypfbViajes.map(v => {
          const patch: any = { ...v };
          if (newOverrides.desc_hojas_ruta_bs !== null) patch.costo_hojas_de_ruta_bs = newOverrides.desc_hojas_ruta_bs;
          if (newOverrides.desc_gps_bs !== null) patch.costo_gps_bs = newOverrides.desc_gps_bs;
          return apiFetch(`/tenants/${schema}/viajes/${v.id}`, {
            method: "PUT",
            body: JSON.stringify(patch)
          });
        });
        await Promise.all(updatePromises);
        await loadViajes();
      }
    } catch (err) {
      console.warn("No se pudieron persistir todas las deducciones en viajes:", err);
    }

    Swal.fire({
      icon: "success",
      title: "Deducciones Guardadas y Actualizadas",
      text: "Los descuentos y el líquido pagable han sido guardados y recalculados correctamente.",
      timer: 1600,
      showConfirmButton: false,
      background: "#0f172a",
      color: "#f8fafc"
    });
  };

  const handleResetDeductionsAdjustments = () => {
    setDeductionsOverride({});
    setShowAdjustDeductionsModal(false);
    Swal.fire({
      icon: "info",
      title: "Valores Restablecidos",
      text: "Se restauraron los cálculos matemáticos originales basados en los viajes YPFB.",
      timer: 1500,
      showConfirmButton: false,
      background: "#0f172a",
      color: "#f8fafc"
    });
  };

  // Métricas de Historial
  const histTotalViajes = viajes.length;
  const histFacturados = useMemo(() => viajes.filter(v => v.nro_factura && v.nro_factura.trim()), [viajes]);
  const histSinFactura = useMemo(() => viajes.filter(v => !v.nro_factura || !v.nro_factura.trim()), [viajes]);
  const histMontoFacturadoBs = useMemo(() => histFacturados.reduce((acc, v) => acc + (v.flete_total_bs || 0), 0), [histFacturados]);
  const histMontoSinFacturaBs = useMemo(() => histSinFactura.reduce((acc, v) => acc + (v.flete_total_bs || 0), 0), [histSinFactura]);
  const histMontoMermasBs = useMemo(() => viajes.reduce((acc, v) => acc + (v.merma_descontar_bs || 0), 0), [viajes]);
  const histMontoNetoMermasBs = Math.max(0, histMontoFacturadoBs - histMontoMermasBs);

  // Componente de Paginación Inteligente
  const renderPagination = (totalItems: number, totalPages: number, itemLabel: string = "viajes") => {
    if (totalItems <= 25 && pageSize >= 25) return null;
    const startItem = pageSize === 0 ? 1 : Math.min((currentPage - 1) * pageSize + 1, totalItems);
    const endItem = pageSize === 0 ? totalItems : Math.min(currentPage * pageSize, totalItems);

    return (
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs mt-3 shadow-xs">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <span>Mostrando <b>{totalItems > 0 ? startItem : 0}</b> - <b>{endItem}</b> de <b>{totalItems}</b> {itemLabel}</span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <label className="flex items-center gap-1.5">
            <span>Por página:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-xs font-semibold focus:outline-none focus:border-amber-500 text-slate-900 dark:text-white"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={0}>Todos ({totalItems})</option>
            </select>
          </label>
        </div>

        {pageSize > 0 && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage <= 1}
              className="px-2 py-1 rounded border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition"
              title="Primera página"
            >
              &laquo;
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage <= 1}
              className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition"
              title="Página anterior"
            >
              &lsaquo;
            </button>
            <span className="px-3 py-1 font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded border border-amber-500/20">
              Página {currentPage} de {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages}
              className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition"
              title="Página siguiente"
            >
              &rsaquo;
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage >= totalPages}
              className="px-2 py-1 rounded border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition"
              title="Última página"
            >
              &raquo;
            </button>
          </div>
        )}
      </div>
    );
  };

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
            onClick={handleExportExcel}
            disabled={isExportingExcel || viajes.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold shadow-sm transition active:scale-95"
            title="Exportar viajes filtrados y ordenados a archivo Excel oficial"
          >
            {isExportingExcel ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <FileSpreadsheet className="w-3.5 h-3.5" />
            )}
            <span>Exportar Excel ({viajes.length})</span>
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

      {/* Selector de Método de Filtrado: Fechas vs Facturas */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMetodoFiltro("periodo")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
            metodoFiltro === "periodo"
              ? "bg-amber-500 text-slate-950 shadow-sm"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>📅 Filtrar por Fechas y Períodos</span>
        </button>

        <button
          type="button"
          onClick={() => setMetodoFiltro("factura")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
            metodoFiltro === "factura"
              ? "bg-amber-500 text-slate-950 shadow-sm"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>🧾 Filtrar por Factura(s)</span>
          {facturasDisponibles.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              metodoFiltro === "factura" ? "bg-slate-950/20 text-slate-950 font-black" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
            }`}>
              {facturasDisponibles.length}
            </span>
          )}
        </button>
      </div>

      {/* Condicional: Filtro por Fechas O Filtro por Factura */}
      {metodoFiltro === "periodo" ? (
        <DatePeriodFilter
          currentPeriodoMes={periodo}
          initialMode={filterMode}
          periodosDisponibles={periodosDisponibles}
          onChange={handleDateFilterChange}
        />
      ) : (
        /* Panel interactivo de Facturas */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3.5 animate-fadeIn">
          {/* Fila Superior: Modalidad de Factura y Entradas */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-amber-500" />
                <span>Modo de Filtrado:</span>
              </span>

              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModoFactura("unica")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    modoFactura === "unica"
                      ? "bg-amber-500 text-slate-950 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Hash className="w-3.5 h-3.5" />
                  <span>Factura Única</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModoFactura("rango")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    modoFactura === "rango"
                      ? "bg-amber-500 text-slate-950 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Rango Sucesivo de Facturas</span>
                </button>
              </div>
            </div>

            {/* Inputs de Factura */}
            <div className="flex items-center gap-2 flex-wrap">
              {modoFactura === "unica" ? (
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center">
                    <Receipt className="w-3.5 h-3.5 absolute left-3 text-amber-500 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="N° Factura (ej. 1315)"
                      value={facturaInput}
                      onChange={(e) => setFacturaInput(e.target.value)}
                      className="pl-8 pr-8 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-amber-500 dark:text-white w-48"
                    />
                    {facturaInput && (
                      <button
                        type="button"
                        onClick={() => setFacturaInput("")}
                        className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        title="Limpiar"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {facturaInput && (
                    <button
                      type="button"
                      onClick={() => setFacturaInput("")}
                      className="text-xs px-2.5 py-1.5 text-slate-500 hover:text-rose-500 dark:text-slate-400 transition"
                    >
                      Ver todas
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="Desde Factura (ej. 1310)"
                      value={facturaDesdeInput}
                      onChange={(e) => setFacturaDesdeInput(e.target.value)}
                      className="px-3 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-amber-500 dark:text-white w-36"
                    />
                  </div>

                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />

                  <div className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="Hasta Factura (ej. 1318)"
                      value={facturaHastaInput}
                      onChange={(e) => setFacturaHastaInput(e.target.value)}
                      className="px-3 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-amber-500 dark:text-white w-36"
                    />
                  </div>

                  {(facturaDesdeInput || facturaHastaInput) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFacturaDesdeInput("");
                        setFacturaHastaInput("");
                      }}
                      className="text-xs px-2.5 py-1.5 text-slate-500 hover:text-rose-500 dark:text-slate-400 transition"
                      title="Limpiar rango"
                    >
                      Limpiar rango
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Fila de Facturas Sucesivas (Barra de Facturas Correlativas) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Receipt className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Fila de Facturas Sucesivas
                </span>
                <span className="text-[11px] text-slate-400">
                  (Haz clic en una factura para filtrar al instante)
                </span>
              </div>

              {/* Buscador rápido dentro de la fila de facturas */}
              <div className="relative flex items-center">
                <Search className="w-3 h-3 absolute left-2.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar en fila (ej. 131...)"
                  value={searchFacturaChip}
                  onChange={(e) => setSearchFacturaChip(e.target.value)}
                  className="pl-7 pr-2.5 py-1 text-[11px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-amber-500 dark:text-white w-44"
                />
              </div>
            </div>

            {/* Contenedor con Scroll Horizontal de Facturas */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-2 px-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
              {facturasDisponibles.length === 0 ? (
                <div className="text-xs text-slate-400 py-2 italic flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span>No hay facturas registradas en los despachos importados.</span>
                </div>
              ) : (
                facturasDisponibles
                  .filter((f) => {
                    if (!searchFacturaChip.trim()) return true;
                    return String(f.nro_factura).toLowerCase().includes(searchFacturaChip.trim().toLowerCase());
                  })
                  .slice(0, 100) // Mostrar las primeras 100 consecutivas para fluidez máxima
                  .map((f) => {
                    const isSelected = modoFactura === "unica"
                      ? facturaInput.trim() === f.nro_factura
                      : (facturaDesdeInput.trim() === f.nro_factura || facturaHastaInput.trim() === f.nro_factura);

                    // Comprobar si está dentro del rango sucesivo
                    let isInRange = false;
                    if (modoFactura === "rango" && facturaDesdeInput && facturaHastaInput) {
                      const dNum = parseInt(facturaDesdeInput.replace(/\D/g, ""), 10);
                      const hNum = parseInt(facturaHastaInput.replace(/\D/g, ""), 10);
                      const curNum = parseInt(f.nro_factura.replace(/\D/g, ""), 10);
                      if (!isNaN(dNum) && !isNaN(hNum) && !isNaN(curNum)) {
                        isInRange = curNum >= Math.min(dNum, hNum) && curNum <= Math.max(dNum, hNum);
                      }
                    }

                    return (
                      <button
                        key={`chip-fac-${f.nro_factura}`}
                        type="button"
                        onClick={() => handleSelectFacturaChip(f.nro_factura)}
                        className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition active:scale-95 ${
                          isSelected
                            ? "bg-amber-500 text-slate-950 font-bold border-amber-600 shadow-md scale-105"
                            : isInRange
                            ? "bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-300 font-semibold"
                            : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-500/60 hover:bg-amber-500/5"
                        }`}
                        title={`Factura ${f.nro_factura}: ${f.total_viajes} viajes, ${formatCurrency(f.flete_total)}`}
                      >
                        <span className="font-mono font-bold tracking-tight">#{f.nro_factura}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          isSelected ? "bg-slate-950 text-amber-400 font-bold" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        }`}>
                          {f.total_viajes}v
                        </span>
                      </button>
                    );
                  })
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
              <span>
                💡 {modoFactura === "unica" ? "Haz clic en una factura para cargarla inmediatamente." : "Haz clic en dos facturas para marcar el inicio y fin del rango correlativo."}
              </span>
              {facturasDisponibles.length > 100 && (
                <span className="italic">Mostrando 100 de {facturasDisponibles.length} facturas (usa el buscador para encontrar cualquier número)</span>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Métricas Clave Dinámicas (según pestaña activa) */}
      {activeMainTab === "planilla" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Card 1: Flete Bruto Total & Líquido */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Flete Bruto</span>
              <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                {formatCurrency(totalFleteBs)}
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                {totalTodosDescuentos > 0 
                  ? `Líq: ${formatCurrency(totalLiquidoGeneral)} (-${formatCurrency(totalTodosDescuentos)})`
                  : "Base de liquidación"}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 flex-shrink-0">
              <DollarSign className="w-4.5 h-4.5" />
            </div>
          </div>

          {/* Card 2: Flete Bruto menos Mermas (Dato Nuevo Global) */}
          <div className="bg-white dark:bg-slate-900 border border-blue-500/30 rounded-xl p-3.5 shadow-sm flex items-center justify-between bg-blue-50/10">
            <div>
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">Flete - Mermas</span>
              <div className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 font-mono mt-0.5">
                {formatCurrency(totalFleteMenosMermasBs)}
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                {totalDescMermaBs > 0 ? `Mermas: -${formatCurrency(totalDescMermaBs)}` : "Sin descuento de merma"}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 flex-shrink-0">
              <Calculator className="w-4.5 h-4.5" />
            </div>
          </div>

          {/* Card 3: Vol. Recepcionado */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Vol. Recepcionado</span>
              <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                {formatNumber(totalRecepcionado, 0)} <span className="text-xs font-bold text-slate-400">L</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Vol. Facturado: {formatNumber(totalVolFacturado, 0)} L</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 flex-shrink-0">
              <Fuel className="w-4.5 h-4.5" />
            </div>
          </div>

          {/* Card 4: Descuentos Totales (Mermas + Adicionales) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Descuentos Totales</span>
              <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 font-mono mt-0.5">
                {formatCurrency(totalTodosDescuentos)}
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                Mermas: {formatCurrency(totalDescMermaBs)} | Adic: {formatCurrency(totalDescAdicBs)}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 flex-shrink-0">
              <Scale className="w-4.5 h-4.5" />
            </div>
          </div>

          {/* Card 5: Total Despachos */}
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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

          {/* Historial Card 4: Flete - Mermas (Historial) */}
          <div className="bg-white dark:bg-slate-900 border border-blue-500/30 rounded-xl p-3.5 shadow-sm flex items-center justify-between bg-blue-50/10">
            <div>
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">Flete - Mermas</span>
              <div className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 font-mono mt-0.5">
                {formatCurrency(histMontoNetoMermasBs)}
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                {histMontoMermasBs > 0 ? `Mermas: -${formatCurrency(histMontoMermasBs)}` : "Flete sin descuento merma"}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 flex-shrink-0">
              <Calculator className="w-4.5 h-4.5" />
            </div>
          </div>

          {/* Historial Card 5: Pendiente por Facturar */}
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

          {/* Filtro Dinámico de Productos de la Empresa (Responsivo, sin scroll horizontal) */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
            <Fuel className="w-3.5 h-3.5 text-amber-500" />
            <select
              value={productoFiltro}
              onChange={(e) => setProductoFiltro(e.target.value)}
              className="bg-transparent text-slate-900 dark:text-white font-bold focus:outline-none cursor-pointer text-xs max-w-[180px] sm:max-w-[220px] truncate"
              title="Filtrar por Producto Transportado"
            >
              <option value="TODOS" className="bg-white dark:bg-slate-900">Todos los Productos</option>
              {catalogProductos.map((p) => (
                <option key={p} value={p} className="bg-white dark:bg-slate-900">
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Chips rápidos responsivos con envoltura (wrap) para evitar desborde */}
          <div className="hidden lg:flex flex-wrap items-center bg-slate-100 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold gap-0.5 max-w-md">
            {["TODOS", ...catalogProductos.slice(0, 4)].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProductoFiltro(p)}
                className={`px-2 py-0.5 rounded-md transition text-[11px] whitespace-nowrap ${
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
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={activeMainTab === "historial" ? "Buscar por Nº de Factura, placa, cliente, MIC..." : "Buscar por MIC, tramo, placa o cliente..."}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 transition"
          />
        </div>
      </div>

      {/* Barra de Ordenamiento Intuitivo y Modo de Vista */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
            <ArrowDownUp className="w-3.5 h-3.5 text-amber-500" />
            <span>Ordenar:</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (sortBy === "fecha") {
                  setSortDir(prev => prev === "asc" ? "desc" : "asc");
                } else {
                  setSortBy("fecha");
                  setSortDir("asc");
                }
              }}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition ${
                sortBy === "fecha"
                  ? "bg-amber-500 text-slate-950 border-amber-500 shadow-2xs"
                  : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-400"
              }`}
              title="Ordenar por fecha de carga/despacho (Enero a Diciembre o Diciembre a Enero)"
            >
              <Calendar className="w-3 h-3" />
              <span>Fecha {sortBy === "fecha" ? (sortDir === "asc" ? "↑ (Ene → Dic)" : "↓ (Dic → Ene)") : "(Ene ↔ Dic)"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (sortBy === "factura") {
                  setSortDir(prev => prev === "asc" ? "desc" : "asc");
                } else {
                  setSortBy("factura");
                  setSortDir("asc");
                }
              }}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition ${
                sortBy === "factura"
                  ? "bg-amber-500 text-slate-950 border-amber-500 shadow-2xs"
                  : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-400"
              }`}
              title="Ordenar correlativamente por número de factura"
            >
              <FileText className="w-3 h-3" />
              <span>N° Factura {sortBy === "factura" ? (sortDir === "asc" ? "↑ Menor" : "↓ Mayor") : ""}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (sortBy === "placa") {
                  setSortDir(prev => prev === "asc" ? "desc" : "asc");
                } else {
                  setSortBy("placa");
                  setSortDir("asc");
                }
              }}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition ${
                sortBy === "placa"
                  ? "bg-amber-500 text-slate-950 border-amber-500 shadow-2xs"
                  : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-400"
              }`}
              title="Ordenar alfabéticamente por placa"
            >
              <Truck className="w-3 h-3" />
              <span>Placa {sortBy === "placa" ? (sortDir === "asc" ? "↑ A-Z" : "↓ Z-A") : ""}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (sortBy === "cliente") {
                  setSortDir(prev => prev === "asc" ? "desc" : "asc");
                } else {
                  setSortBy("cliente");
                  setSortDir("asc");
                }
              }}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition ${
                sortBy === "cliente"
                  ? "bg-amber-500 text-slate-950 border-amber-500 shadow-2xs"
                  : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-400"
              }`}
              title="Ordenar por cliente del servicio"
            >
              <Building2 className="w-3 h-3" />
              <span>Cliente {sortBy === "cliente" ? (sortDir === "asc" ? "↑ A-Z" : "↓ Z-A") : ""}</span>
            </button>
          </div>
        </div>

        {/* Selector de Modo de Vista & Indicador Fiscal */}
        {activeMainTab === "planilla" && (
          <div className="flex items-center gap-2 flex-wrap">
            {facturasConDerechoDetalle.length > 0 && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-yellow-100 dark:bg-yellow-950/70 border border-yellow-300 dark:border-yellow-700/60 text-yellow-950 dark:text-yellow-200 text-xs font-bold shadow-2xs">
                <span>Con Derecho (13% IVA):</span>
                <span className="font-mono font-black">{facturasConDerechoDetalle.length} fact.</span>
                <span className="text-rose-700 dark:text-rose-400 font-mono font-black">
                  (-Bs. {formatNumber(fiscalStats.totDebito13, 2)})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFacturasConDerecho([]);
                    if (schema) saveState(`transporte_${schema}_viajes_facturas_con_derecho`, []);
                  }}
                  className="ml-1 text-[10px] text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 font-bold underline cursor-pointer"
                  title="Quitar derecho a crédito fiscal a todas las facturas"
                >
                  Limpiar
                </button>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-300 text-xs font-bold">
              <Table className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Planilla Oficial Unificada (14 Cols)</span>
            </div>
          </div>
        )}
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
                {periodo ? `Aún no has registrado viajes en el periodo ${periodo}` : "No hay viajes que coincidan con el filtro actual"}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto mb-6 leading-relaxed">
                Ingresa los despachos y recepciones de combustible. El sistema calculará en tiempo real el flete bruto en Bs, los subtotales agrupados por tramo y las mermas contractuales YPFB.
              </p>
              {periodosDisponibles.length > 0 && (
                <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold mb-2.5">
                    Hay {periodosDisponibles.reduce((acc: number, p: any) => acc + (p.total_viajes || 0), 0)} viajes registrados en otros periodos o años.
                  </p>
                  <button
                    onClick={() => handleDateFilterChange({ mode: "historico", label: "Histórico Completo (Todos los Años)" })}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-md transition transform hover:scale-105"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Ver Histórico Completo ({periodosDisponibles.reduce((acc: number, p: any) => acc + (p.total_viajes || 0), 0)} viajes)</span>
                  </button>
                </div>
              )}
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
                onClick={() => { setSearchInput(""); setSearch(""); setPlacaFiltro(""); setProductoFiltro("TODOS"); }}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition"
              >
                Restablecer Filtros
              </button>
            </div>
          )
        ) : (
          <div className="bg-white dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm dark:shadow-xl overflow-hidden">
            {/* TABLA OFICIAL UNIFICADA: 14 COLUMNAS ESTANDARIZADAS CON LIQUIDACIONES */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-black uppercase text-[10px]">
                    <th className="py-2.5 px-1 text-center w-9">Nº</th>
                    <th className="py-2.5 px-1.5 text-center whitespace-nowrap">FECHA DE CARGA</th>
                    <th className="py-2.5 px-1.5 text-center whitespace-nowrap">FECHA DE DESCARGA</th>
                    <th className="py-2.5 px-1.5 text-center whitespace-nowrap">MCI/DTA (MIC)</th>
                    <th className="py-2.5 px-1.5 text-center">PLACA</th>
                    <th className="py-2.5 px-2 text-left">TRAMO</th>
                    <th className="py-2.5 px-1.5 text-center">CLIENTE</th>
                    <th className="py-2.5 px-1.5 text-center">PRODUCTO</th>
                    <th className="py-2.5 px-1.5 text-center whitespace-nowrap">N° FACTURA</th>
                    <th className="py-2.5 px-1.5 text-center whitespace-nowrap">FECHA FACTURA</th>
                    <th className="py-2.5 px-2 text-right whitespace-nowrap">VOLUMEN FACTURADO</th>
                    <th className="py-2.5 px-1.5 text-right whitespace-nowrap">TARIFA BS.</th>
                    <th className="py-2.5 px-2 text-right whitespace-nowrap">TOTAL FLETE BS.</th>
                    <th className="py-2.5 px-1.5 text-center w-20">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {(() => {
                    let globalIdx = startGlobalIdx;

                    return paginatedGroups.map((group, gIdx) => {
                      const grpVolOrig = group.items.reduce((acc, x) => acc + (Number(x.volumen_origen_litros) || 0), 0);
                      const grpVolRec = group.items.reduce((acc, x) => acc + (Number(x.volumen_recepcionado_litros) || 0), 0);
                      const grpMermaReal = group.items.reduce((acc, x) => acc + (Number(x.merma_real_litros) || 0), 0);
                      const grpMermaExc = group.items.reduce((acc, x) => acc + (Number(x.merma_excedente_litros) || 0), 0);
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
                            const totDesc = (v.merma_descontar_bs || 0) + (v.total_descuentos_adicionales_bs || 0) + (v.total_descuentos_mermas_bs || 0);
                            const isYpfb = isYpfbClient(v.cliente);
                            const isExpanded = expandedYpfbRows.has(v.id);

                            return (
                              <Fragment key={v.id}>
                              <tr className={`hover:bg-amber-50/40 dark:hover:bg-slate-800/50 transition ${isExpanded ? "bg-amber-500/5 dark:bg-amber-950/20" : ""}`}>
                                {/* Nº */}
                                <td className="py-2.5 px-1 text-center font-bold text-slate-700 dark:text-slate-300 text-[11px] whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-1">
                                    <span>{globalIdx}</span>
                                    {isYpfb && (
                                      <button
                                        type="button"
                                        onClick={() => toggleExpandYpfbRow(v.id)}
                                        className={`p-0.5 rounded text-[9px] font-bold transition cursor-pointer ${
                                          isExpanded
                                            ? "bg-amber-500 text-slate-950 font-black shadow-xs"
                                            : "bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/30"
                                        }`}
                                        title={isExpanded ? "Ocultar desglose YPFB" : "Ver parámetros y desglose YPFB"}
                                      >
                                        {isExpanded ? <ChevronUp className="w-3 h-3 stroke-[3]" /> : <ChevronDown className="w-3 h-3 stroke-[3]" />}
                                      </button>
                                    )}
                                  </div>
                                </td>

                                {/* FECHA DE CARGA */}
                                <td className="py-2.5 px-1.5 text-center text-slate-500 dark:text-slate-400 font-mono text-[10.5px] whitespace-nowrap">
                                  {formatDate(v.fecha_carga)}
                                </td>

                                {/* FECHA DE DESCARGA */}
                                <td className="py-2.5 px-1.5 text-center text-slate-500 dark:text-slate-400 font-mono text-[10.5px] whitespace-nowrap">
                                  {formatDate(v.fecha_descarga)}
                                </td>

                                {/* MCI/DTA (MIC) */}
                                <td className="py-2.5 px-1.5 text-center font-mono font-bold text-slate-800 dark:text-slate-200 text-xs whitespace-nowrap">
                                  {v.mic_dta || "-"}
                                </td>

                                {/* PLACA */}
                                <td className="py-2.5 px-1.5 text-center whitespace-nowrap">
                                  <div className="font-mono font-bold text-amber-700 dark:text-amber-400 text-xs">
                                    {v.placa}
                                  </div>
                                  {v.es_apoyo && (
                                    <div className="text-[9px] text-amber-600 dark:text-amber-400 font-semibold flex items-center justify-center gap-0.5 mt-0.5" title={v.empresa_apoyo_nombre || "Empresa de Apoyo"}>
                                      <Handshake className="w-2.5 h-2.5 text-amber-500" />
                                      <span className="truncate max-w-[80px]">{v.empresa_apoyo_nombre || "Apoyo"}</span>
                                    </div>
                                  )}
                                </td>

                                {/* TRAMO */}
                                <td className="py-2.5 px-2 text-slate-700 dark:text-slate-300 text-[11px] uppercase truncate max-w-[180px]" title={v.tramo}>
                                  {v.tramo}
                                </td>

                                {/* CLIENTE */}
                                <td className="py-2.5 px-1.5 text-center whitespace-nowrap">
                                  <span className="inline-block px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 uppercase truncate max-w-[120px]" title={v.cliente || "YPFB"}>
                                    {v.cliente || "YPFB"}
                                  </span>
                                </td>

                                {/* PRODUCTO */}
                                <td className="py-2.5 px-1.5 text-center whitespace-nowrap">
                                  <span className={`inline-block px-2 py-0.5 rounded text-[9.5px] font-bold border truncate max-w-[110px] ${
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
                                  }`} title={v.producto}>
                                    {v.producto}
                                  </span>
                                </td>

                                {/* N° FACTURA */}
                                <td className="py-2.5 px-1.5 text-center whitespace-nowrap">
                                  {v.nro_factura && v.nro_factura.trim() ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-mono font-bold">
                                      {v.nro_factura}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 font-mono">S/F</span>
                                  )}
                                </td>

                                {/* FECHA FACTURA */}
                                <td className="py-2.5 px-1.5 text-center text-slate-500 dark:text-slate-400 font-mono text-[10px] whitespace-nowrap">
                                  {v.fecha_factura ? formatDate(v.fecha_factura) : "-"}
                                </td>

                                {/* VOLUMEN FACTURADO */}
                                <td className="py-2.5 px-2 text-right font-mono font-bold text-sky-700 dark:text-sky-400 text-xs whitespace-nowrap">
                                  {formatNumber(getVolFactLitros(v), 0)} L
                                </td>

                                {/* TARIFA BS. */}
                                <td className="py-2.5 px-1.5 text-right font-mono text-slate-700 dark:text-slate-300 text-xs whitespace-nowrap">
                                  {formatNumber(v.tarifa_flete, 2)}
                                </td>

                                {/* TOTAL FLETE BS. */}
                                <td className="py-2.5 px-2 text-right font-mono whitespace-nowrap">
                                  <div className="font-black text-amber-700 dark:text-amber-400 text-xs">
                                    {formatCurrency(v.flete_total_bs)}
                                  </div>
                                  {totDesc > 0 && (
                                    <div className="text-[9px] text-emerald-700 dark:text-emerald-400 font-bold">
                                      Líq: {formatCurrency(v.flete_total_bs - totDesc)}
                                    </div>
                                  )}
                                </td>

                                {/* ACCIONES */}
                                <td className="py-2.5 px-1.5 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-0.5">
                                    <button
                                      onClick={() => handleDuplicate(v)}
                                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition"
                                      title="Duplicar Despacho"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => openEditModal(v)}
                                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
                                      title="Editar Despacho"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDelete(v)}
                                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition"
                                      title="Eliminar Despacho"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {/* Sub-fila Desplegable Exclusiva para Viajes YPFB */}
                              {isExpanded && isYpfb && (
                                <tr className="bg-amber-500/10 dark:bg-amber-950/30 border-b-2 border-amber-500/40 no-print animate-in fade-in text-xs">
                                  <td colSpan={14} className="p-3">
                                    <div className="bg-white dark:bg-slate-900 border border-amber-500/30 rounded-xl p-3 shadow-md space-y-2">
                                      <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                                        <div className="flex items-center gap-2">
                                          <span className="w-5 h-5 rounded-md bg-amber-500 text-slate-950 font-black flex items-center justify-center text-[10px]">
                                            Y
                                          </span>
                                          <span className="font-black text-amber-800 dark:text-amber-300 text-xs uppercase tracking-wide">
                                            Desglose Operativo y Parámetros Contractuales YPFB (Despacho #{globalIdx} - Placa: {v.placa})
                                          </span>
                                        </div>
                                        <span className="text-[10px] font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/25">
                                          Cliente Oficial YPFB
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 text-center">
                                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                                          <span className="text-[9px] text-slate-500 uppercase font-bold block">Vol. Despachado 15.56°:</span>
                                          <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">{formatNumber(v.volumen_origen_litros, 0)} L</span>
                                        </div>
                                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                                          <span className="text-[9px] text-slate-500 uppercase font-bold block">Vol. Recepcionado 15.56°:</span>
                                          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-xs">{formatNumber(v.volumen_recepcionado_litros, 0)} L</span>
                                        </div>
                                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                                          <span className="text-[9px] text-slate-500 uppercase font-bold block">Diferencia Desp - Recep:</span>
                                          <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                                            {formatNumber(Number(v.volumen_recepcionado_litros || 0) - Number(v.volumen_origen_litros || 0), 1)} L
                                          </span>
                                        </div>
                                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                                          <span className="text-[9px] text-slate-500 uppercase font-bold block">Merma Tolerable:</span>
                                          <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                                            {formatNumber(v.merma_tolerable_litros, 1)} L ({v.tolerancia_pct}%)
                                          </span>
                                        </div>
                                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                                          <span className="text-[9px] text-slate-500 uppercase font-bold block">Merma Excedente:</span>
                                          <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-xs">
                                            {formatNumber(v.merma_excedente_litros, 1)} L
                                          </span>
                                        </div>
                                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                                          <span className="text-[9px] text-slate-500 uppercase font-bold block">Precio Merma + IVA:</span>
                                          <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                                            Bs. {formatNumber(v.precio_merma_litro_bs || 7.45, 6)}
                                          </span>
                                        </div>
                                        <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-500/30">
                                          <span className="text-[9px] text-rose-700 dark:text-rose-400 uppercase font-black block">Merma a Descontar:</span>
                                          <span className="font-mono font-black text-rose-700 dark:text-rose-400 text-xs">
                                            {formatCurrency(v.merma_descontar_bs || 0)}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Parámetros de Comisión y Deducción aplicables al Viaje */}
                                      <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center gap-3 text-[10px] text-slate-600 dark:text-slate-300">
                                        <span className="font-black text-slate-800 dark:text-slate-200 uppercase">Deducciones YPFB configuradas en viaje:</span>
                                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono">
                                          T.C. Dólar: <strong>Bs. {v.tipo_cambio_bs !== undefined && v.tipo_cambio_bs !== null ? v.tipo_cambio_bs : "6.96"}</strong>
                                        </span>
                                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono">
                                          Comisión 1: <strong>{v.comision_usd_m3 !== undefined && v.comision_usd_m3 !== null ? v.comision_usd_m3 : "1.00"} $us/m³</strong>
                                        </span>
                                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono">
                                          Comisión 7%: <strong>{v.comision_pct_1 !== undefined && v.comision_pct_1 !== null ? v.comision_pct_1 : "7.00"}%</strong>
                                        </span>
                                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono">
                                          BOL-GART 7%: <strong>{v.comision_ypfb_bolgart_pct !== undefined && v.comision_ypfb_bolgart_pct !== null ? v.comision_ypfb_bolgart_pct : "7.00"}%</strong>
                                        </span>
                                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono">
                                          Comisión 3%: <strong>{v.comision_pct_2 !== undefined && v.comision_pct_2 !== null ? v.comision_pct_2 : "3.00"}%</strong>
                                        </span>
                                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono">
                                          Hojas de Ruta: <strong>Bs. {v.costo_hojas_de_ruta_bs !== undefined && v.costo_hojas_de_ruta_bs !== null ? v.costo_hojas_de_ruta_bs : "0.00"}</strong>
                                        </span>
                                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono">
                                          GPS: <strong>Bs. {v.costo_gps_bs !== undefined && v.costo_gps_bs !== null ? v.costo_gps_bs : "0.00"}</strong>
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                              </Fragment>
                            );
                          })}

                          {/* FILA ESPECIAL: Subtotal del Grupo con Facturación */}
                          {(() => {
                            const groupKey = group.key || `${group.factura}___${group.producto}`;
                            const facClean = (group.factura || "").trim().toUpperCase();
                            const isConDerecho = Boolean(groupKey && facClean !== "S/F" && facturasConDerecho.includes(groupKey));
                            const debito13 = isConDerecho ? Math.round(grpFlete * 0.13 * 100) / 100 : 0;
                            const vnNeto87 = isConDerecho ? grpFlete - debito13 : grpFlete;

                            return (
                              <tr className={`border-y-2 text-[10.5px] transition ${
                                isConDerecho
                                  ? "bg-amber-200/60 dark:bg-amber-950/70 border-amber-400 dark:border-amber-600 font-bold"
                                  : "bg-amber-100/70 dark:bg-amber-950/40 font-bold border-amber-300 dark:border-amber-700"
                              }`}>
                                <td colSpan={10} className="py-2 px-2.5 text-left border-x border-amber-300 dark:border-amber-700">
                                  <div className="flex items-center justify-between flex-wrap gap-1.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-black text-amber-900 dark:text-amber-300 uppercase mr-1">TOTAL {group.producto}</span>
                                      <span className="text-slate-700 dark:text-slate-300 font-medium">| FAC: <strong className="font-mono text-slate-900 dark:text-white">{facLabel}</strong></span>
                                      {fechaLabel !== "-" && (
                                        <span className="text-slate-700 dark:text-slate-300 font-medium ml-1">| FECHA FACTURA: <strong className="text-slate-900 dark:text-white">{fechaLabel}</strong></span>
                                      )}
                                    </div>

                                    {/* Checkbox Con Factura Con Derecho */}
                                    {facClean && facClean !== "S/F" && (
                                      <label className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border transition cursor-pointer select-none text-[10px] ${
                                        isConDerecho
                                          ? "bg-amber-500 text-slate-950 border-amber-600 font-black shadow-xs ring-1 ring-amber-400"
                                          : "bg-white/95 dark:bg-slate-900/90 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-400 font-bold"
                                      }`}>
                                        <input
                                          type="checkbox"
                                          checked={isConDerecho}
                                          onChange={(e) => toggleFacturaConDerecho(groupKey, e.target.checked)}
                                          className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600"
                                        />
                                        <span>Con Factura Con Derecho</span>
                                        {isConDerecho && (
                                          <span className="px-1.5 py-0.2 rounded bg-slate-950/20 text-slate-950 font-mono font-black ml-0.5">
                                            (13% Débito: -{formatCurrency(debito13)})
                                          </span>
                                        )}
                                      </label>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2 px-2 text-right font-mono border-x border-amber-300 dark:border-amber-700 font-black text-sky-800 dark:text-sky-300 text-xs whitespace-nowrap">
                                  {formatNumber(grpVolFact, 0)} L
                                </td>
                                <td className="py-2 px-1.5 text-right font-mono border-x border-amber-300 dark:border-amber-700 text-slate-700 dark:text-slate-300 text-xs whitespace-nowrap">
                                  {formatNumber(grpTarifa, 2)}
                                </td>
                                <td className="py-2 px-2 text-right font-mono border-x border-amber-300 dark:border-amber-700 whitespace-nowrap">
                                  <div className="font-black text-amber-900 dark:text-amber-400 text-xs">{formatCurrency(grpFlete)}</div>
                                  {isConDerecho && (
                                    <div className="text-[9.5px] text-rose-700 dark:text-rose-400 font-bold">
                                      Neto 87%: {formatCurrency(vnNeto87)}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2 px-1 border-x border-amber-300 dark:border-amber-700"></td>
                              </tr>
                            );
                          })()}
                        </Fragment>
                      );
                    });
                  })()}

                  {/* Fila de Totales Generales de Planilla */}
                  <tr className="bg-slate-100 dark:bg-slate-800/90 font-black text-slate-900 dark:text-white border-t-2 border-b border-slate-300 dark:border-slate-700 text-xs">
                    <td colSpan={10} className="py-2.5 px-3 text-right uppercase border-x border-slate-300 dark:border-slate-700 text-[11px]">
                      TOTAL GENERAL ({filtered.length} DESPACHOS):
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono border-x border-slate-300 dark:border-slate-700 whitespace-nowrap">
                      <div className="font-black text-sky-700 dark:text-sky-400 text-xs">{formatNumber(totalVolFacturado, 0)} L</div>
                    </td>
                    <td className="py-2.5 px-1.5 border-x border-slate-300 dark:border-slate-700"></td>
                    <td className="py-2.5 px-2 text-right font-mono border-x border-slate-300 dark:border-slate-700 whitespace-nowrap">
                      <div className="font-black text-amber-600 dark:text-amber-400 text-sm">{formatCurrency(totalFleteBs)}</div>
                      {totalTodosDescuentos > 0 && (
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Líq: {formatCurrency(totalLiquidoGeneral)}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-1 border-x border-slate-300 dark:border-slate-700"></td>
                  </tr>

                  {/* ============================================================== */}
                  {/* BLOQUE DE CONCILIACIÓN FISCAL (IVA 13%)                         */}
                  {/* ============================================================== */}
                  
                  {/* TOTAL VENTAS BRUTAS */}
                  <tr className="bg-emerald-100/90 dark:bg-emerald-950/70 font-black text-slate-900 dark:text-white border-t-2 border-emerald-400 dark:border-emerald-600 text-xs">
                    <td colSpan={12} className="py-2 px-3 text-right uppercase border-x border-slate-300 dark:border-slate-700 font-black italic">
                      TOTAL VENTAS BRUTAS:
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-sm font-black border-x border-slate-300 dark:border-slate-700 text-emerald-900 dark:text-emerald-300 bg-emerald-200/70 dark:bg-emerald-900/50 whitespace-nowrap">
                      {formatCurrency(fiscalStats.totVentasBrutas)}
                    </td>
                    <td className="py-2 px-1 border-x border-slate-300 dark:border-slate-700"></td>
                  </tr>

                  {/* V.N. SIN DERECHO */}
                  <tr className="bg-slate-50 dark:bg-slate-900/80 font-bold text-slate-700 dark:text-slate-300 text-xs border-b border-slate-200 dark:border-slate-800">
                    <td colSpan={12} className="py-1.5 px-3 text-right italic uppercase">
                      V.N. SIN DERECHO:
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold border-x border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {formatCurrency(fiscalStats.totVnSinDerecho)}
                    </td>
                    <td className="py-1.5 px-1 border-x border-slate-200 dark:border-slate-800"></td>
                  </tr>

                  {/* V.B. CON DERECHO */}
                  <tr className="bg-amber-50/70 dark:bg-amber-950/40 font-bold text-amber-900 dark:text-amber-300 text-xs border-b border-slate-200 dark:border-slate-800">
                    <td colSpan={12} className="py-1.5 px-3 text-right italic uppercase">
                      V.B. CON DERECHO {fiscalStats.countConDerecho > 0 ? `(${fiscalStats.countConDerecho} facturas)` : "(0 facturas seleccionadas)"}:
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold border-x border-slate-200 dark:border-slate-800 text-amber-800 dark:text-amber-400 whitespace-nowrap">
                      {formatCurrency(fiscalStats.totVbConDerecho)}
                    </td>
                    <td className="py-1.5 px-1 border-x border-slate-200 dark:border-slate-800"></td>
                  </tr>

                  {/* Sub-filas por cada Factura con Derecho seleccionada */}
                  {facturasConDerechoDetalle.map((fac) => (
                    <tr key={`unified-${fac.key}`} className="bg-amber-100/40 dark:bg-amber-950/30 text-[11px] text-slate-700 dark:text-slate-300 border-b border-amber-200/50 dark:border-amber-900/30">
                      <td colSpan={12} className="py-1 px-4 text-right">
                        <span className="font-bold text-amber-900 dark:text-amber-300 mr-2">• Factura {fac.factura}</span>
                        <span className="text-slate-700 dark:text-slate-300 font-semibold mr-2">[{fac.producto}]</span>
                        <span className="text-slate-500 mr-2">({fac.fechas.length > 0 ? fac.fechas.map(f => formatDate(f)).join(", ") : "-"})</span>
                        <span className="text-slate-600 dark:text-slate-400 font-mono">Flete Bruto: {formatCurrency(fac.flete)}</span>
                        <span className="font-bold text-rose-600 dark:text-rose-400 ml-2">→ Débito Fiscal IVA 13%:</span>
                      </td>
                      <td className="py-1 px-2 text-right font-mono font-bold text-rose-700 dark:text-rose-400 border-x border-slate-200 dark:border-slate-800 whitespace-nowrap">
                        -{formatCurrency(fac.debito)}
                      </td>
                      <td className="py-1 px-1 border-x border-slate-200 dark:border-slate-800"></td>
                    </tr>
                  ))}

                  {/* DEBITO (13%) */}
                  <tr className="bg-rose-50/70 dark:bg-rose-950/40 font-bold text-rose-900 dark:text-rose-300 text-xs border-b border-slate-200 dark:border-slate-800">
                    <td colSpan={12} className="py-1.5 px-3 text-right italic uppercase font-black">
                      DEBITO:
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-black border-x border-slate-200 dark:border-slate-800 text-rose-600 dark:text-rose-400 whitespace-nowrap">
                      {fiscalStats.totDebito13 > 0 ? `-${formatCurrency(fiscalStats.totDebito13)}` : "Bs. 0,00"}
                    </td>
                    <td className="py-1.5 px-1 border-x border-slate-200 dark:border-slate-800"></td>
                  </tr>

                  {/* V.N. CON DERECHO (87%) */}
                  <tr className="bg-slate-50 dark:bg-slate-900/80 font-bold text-slate-700 dark:text-slate-300 text-xs border-b border-slate-200 dark:border-slate-800">
                    <td colSpan={12} className="py-1.5 px-3 text-right italic uppercase">
                      V.N. CON DERECHO:
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold border-x border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {formatCurrency(fiscalStats.totVnConDerecho)}
                    </td>
                    <td className="py-1.5 px-1 border-x border-slate-200 dark:border-slate-800"></td>
                  </tr>

                  {/* VENTAS NETAS GESTION (Fondo Amarillo Brillante según Captura) */}
                  <tr className="bg-yellow-300 dark:bg-yellow-400 font-black text-slate-950 border-t-2 border-b-2 border-yellow-500 text-sm">
                    <td colSpan={12} className="py-2.5 px-3 text-right uppercase font-black tracking-wide text-slate-950">
                      VENTAS NETAS GESTION {gestionYearLabel}:
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-base font-black border-x border-yellow-500 text-slate-950 bg-yellow-400 dark:bg-yellow-300 whitespace-nowrap">
                      {formatCurrency(fiscalStats.totVentasNetasGestion)}
                    </td>
                    <td className="py-2.5 px-1 border-x border-yellow-500 bg-yellow-400 dark:bg-yellow-300"></td>
                  </tr>
                </tbody>
              </table>
            </div>
{renderPagination(totalPlanillaGroups, totalPlanillaPages, `grupos (${filtered.length} despachos)`)}

            {/* ============================================================== */}
            {/* RESUMEN DE DEDUCCIONES Y PAGOS (HOJA 2 / YPFB CONTRACTUAL)      */}
            {/* ============================================================== */}
            <div className="mt-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-xl">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-amber-600 dark:text-amber-400 font-black tracking-wide text-sm sm:text-base uppercase">
                      LIQUIDACION DE FLETES
                    </h2>
                    {deduccionesResumen.hasOverrides && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                        Ajustado Manualmente
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">
                    MES: <span className="text-slate-900 dark:text-white font-mono">{periodo || "GESTIÓN " + gestionYearLabel}</span>
                    <span className="mx-2">•</span>
                    PLACA: <span className="text-slate-900 dark:text-white font-mono">{placaFiltro || "TODAS"}</span>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <div className="text-sm font-black text-slate-900 dark:text-white uppercase">
                    {schema.replace(/^empresa_/, '').replace(/_/g, ' ').toUpperCase() || "EMPRESA DE TRANSPORTE"}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">
                    Resumen de Deducciones y Pagos
                  </div>
                  <div className="mt-2.5 flex items-center justify-start sm:justify-end gap-2">
                    <button
                      onClick={openAdjustDeductionsModal}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-sm"
                      title="Ajustar o corregir montos de deducción"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>Ajustar / Editar Deducciones</span>
                    </button>
                    {deduccionesResumen.ypfbCount > 0 && (
                      <button
                        onClick={() => setShowYpfbBreakdown(!showYpfbBreakdown)}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition border border-slate-200 dark:border-slate-700"
                      >
                        {showYpfbBreakdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        <span>{showYpfbBreakdown ? "Ocultar Desglose" : `Ver Desglose (${deduccionesResumen.ypfbCount} YPFB)`}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Tabla Central de Deducciones (Idéntica a Hoja 2 de Liquidaciones) */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden mb-6 shadow-sm dark:shadow-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-200 font-black text-[11px] uppercase border-b border-slate-200 dark:border-slate-800">
                      <th className="py-3 px-4">DESCRIPCION</th>
                      <th className="py-3 px-4 text-right">TOTAL Bs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-[12px]">
                    <tr className="bg-amber-50 dark:bg-amber-500/15 font-black text-amber-900 dark:text-amber-300">
                      <td className="py-3 px-4 uppercase">FLETE TOTAL</td>
                      <td className="py-3 px-4 text-right font-mono text-sm font-black text-amber-700 dark:text-amber-400">
                        {formatNumber(deduccionesResumen.fleteTotalBruto, 2)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">Descuento por Merma</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-900 dark:text-white">{formatNumber(deduccionesResumen.descMerma, 2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">Descuento de Comision 1 $us p/m3</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-900 dark:text-white">{formatNumber(deduccionesResumen.descComisionUsd, 2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">Descuento de Comision 7%</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-900 dark:text-white">{formatNumber(deduccionesResumen.descComision7, 2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">Descuento YPFB BOL-GART 7%</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-900 dark:text-white">{formatNumber(deduccionesResumen.descBolGart7, 2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">Descuento de Comision 3%</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-900 dark:text-white">{formatNumber(deduccionesResumen.descComision3, 2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">Hojas de Ruta</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-900 dark:text-white">{formatNumber(deduccionesResumen.descHojasRuta, 2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">GPS</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-900 dark:text-white">{formatNumber(deduccionesResumen.descGps, 2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">Anticipos y Otros 7%</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-900 dark:text-white">{formatNumber(deduccionesResumen.descAnticipos, 2)}</td>
                    </tr>
                    {deduccionesResumen.descOtros !== 0 && (
                      <tr>
                        <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">Otros Ajustes / Descuentos</td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-900 dark:text-white">{formatNumber(deduccionesResumen.descOtros, 2)}</td>
                      </tr>
                    )}

                    {/* Total Descuento */}
                    <tr className="bg-rose-50 dark:bg-rose-500/15 font-bold text-rose-900 dark:text-rose-300 border-t-2 border-slate-200 dark:border-slate-700">
                      <td className="py-3 px-4 uppercase font-black">TOTAL DESCUENTO</td>
                      <td className="py-3 px-4 text-right font-mono text-sm text-rose-700 dark:text-rose-400 font-black">
                        {formatNumber(deduccionesResumen.totalDescuento, 2)}
                      </td>
                    </tr>

                    {/* Líquido Pagable */}
                    <tr className="bg-emerald-50 dark:bg-emerald-500/20 font-black text-emerald-950 dark:text-emerald-300 border-t-2 border-emerald-500">
                      <td className="py-3.5 px-4 uppercase text-sm">LIQUIDO PAGABLE</td>
                      <td className="py-3.5 px-4 text-right font-mono text-base font-black text-emerald-700 dark:text-emerald-400">
                        {formatNumber(deduccionesResumen.liquidoPagable, 2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Subtabla desplegable: Desglose por viaje YPFB */}
              {showYpfbBreakdown && deduccionesResumen.ypfbCount > 0 && (
                <div className="mb-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase mb-3 flex items-center justify-between">
                    <span>Desglose Contractual por Despacho YPFB ({deduccionesResumen.ypfbCount} viajes)</span>
                    <span className="text-[10px] text-slate-500 font-normal">Haga clic en Editar para modificar parámetros de un viaje específico</span>
                  </div>
                  <div className="overflow-x-auto max-h-72 overflow-y-auto">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-slate-200/70 dark:bg-slate-900 font-bold text-slate-700 dark:text-slate-300 uppercase">
                          <th className="py-2 px-2">Placa</th>
                          <th className="py-2 px-2">Fecha</th>
                          <th className="py-2 px-2">Producto</th>
                          <th className="py-2 px-2 text-right">Flete (Bs)</th>
                          <th className="py-2 px-2 text-right">Merma (Bs)</th>
                          <th className="py-2 px-2 text-right">T.C. ($us)</th>
                          <th className="py-2 px-2 text-right">Com 1 $us</th>
                          <th className="py-2 px-2 text-right">Com 7%</th>
                          <th className="py-2 px-2 text-right">Bol-Gart</th>
                          <th className="py-2 px-2 text-right">Com 3%</th>
                          <th className="py-2 px-2 text-right">Hojas Ruta</th>
                          <th className="py-2 px-2 text-right">GPS</th>
                          <th className="py-2 px-2 text-center w-24">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800 font-mono">
                        {deduccionesResumen.ypfbViajes.map((v) => {
                          const vFact = (v.volumen_facturado || v.volumen_recepcionado_litros || 0) / 1000;
                          const isRowEditing = inlineEditingId === v.id;
                          const tc = isRowEditing ? (Number(inlineEditForm.tipo_cambio_bs) || 6.96) : (v.tipo_cambio_bs ?? 6.96);
                          const comUsdBs = isRowEditing
                            ? vFact * (Number(inlineEditForm.comision_usd_m3) || 0) * tc
                            : vFact * (v.comision_usd_m3 ?? 1.0) * tc;
                          const flete = Number(v.flete_total_bs) || 0;
                          const com7Bs = isRowEditing
                            ? flete * ((Number(inlineEditForm.comision_pct_1) || 0) / 100)
                            : flete * ((v.comision_pct_1 ?? 7.0) / 100);
                          const bolGartBs = isRowEditing
                            ? flete * ((Number(inlineEditForm.comision_ypfb_bolgart_pct) || 0) / 100)
                            : flete * ((v.comision_ypfb_bolgart_pct ?? 7.0) / 100);
                          const com3Bs = isRowEditing
                            ? flete * ((Number(inlineEditForm.comision_pct_2) || 0) / 100)
                            : flete * ((v.comision_pct_2 ?? 3.0) / 100);

                          if (isRowEditing) {
                            return (
                              <tr key={v.id} className="bg-amber-500/10 dark:bg-amber-950/30 border-y-2 border-amber-500/40">
                                <td className="py-1.5 px-2 font-bold font-sans text-slate-900 dark:text-white">{v.placa}</td>
                                <td className="py-1.5 px-2 font-sans text-slate-600 dark:text-slate-400">{v.fecha_carga}</td>
                                <td className="py-1.5 px-2 font-sans text-slate-700 dark:text-slate-300">{v.producto}</td>
                                <td className="py-1.5 px-2 text-right text-slate-900 dark:text-white font-bold">{formatNumber(flete, 2)}</td>
                                
                                {/* Merma Bs editable */}
                                <td className="py-1 px-1.5 text-right">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={inlineEditForm.merma_descontar_bs}
                                    onChange={(e) => setInlineEditForm({ ...inlineEditForm, merma_descontar_bs: e.target.value })}
                                    className="w-16 px-1 py-0.5 text-right bg-white dark:bg-slate-900 border border-amber-500 rounded text-rose-600 dark:text-rose-400 font-bold text-[11px] focus:outline-none"
                                    title="Merma Bs. a descontar"
                                  />
                                </td>

                                {/* TC editable */}
                                <td className="py-1 px-1.5 text-right">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={inlineEditForm.tipo_cambio_bs}
                                    onChange={(e) => setInlineEditForm({ ...inlineEditForm, tipo_cambio_bs: e.target.value })}
                                    className="w-14 px-1 py-0.5 text-right bg-white dark:bg-slate-900 border border-amber-500 rounded text-slate-900 dark:text-white text-[11px] focus:outline-none"
                                    title="Tipo de Cambio (Bs/$us)"
                                  />
                                </td>

                                {/* Com 1 $us editable */}
                                <td className="py-1 px-1.5 text-right">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={inlineEditForm.comision_usd_m3}
                                    onChange={(e) => setInlineEditForm({ ...inlineEditForm, comision_usd_m3: e.target.value })}
                                    className="w-12 px-1 py-0.5 text-right bg-white dark:bg-slate-900 border border-amber-500 rounded text-slate-900 dark:text-white text-[11px] focus:outline-none"
                                    title="Comisión 1 ($us/m³)"
                                  />
                                </td>

                                {/* Com 7% editable */}
                                <td className="py-1 px-1.5 text-right">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={inlineEditForm.comision_pct_1}
                                    onChange={(e) => setInlineEditForm({ ...inlineEditForm, comision_pct_1: e.target.value })}
                                    className="w-12 px-1 py-0.5 text-right bg-white dark:bg-slate-900 border border-amber-500 rounded text-slate-900 dark:text-white text-[11px] focus:outline-none"
                                    title="Comisión 1 (% Retención)"
                                  />
                                </td>

                                {/* Bol-Gart editable */}
                                <td className="py-1 px-1.5 text-right">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={inlineEditForm.comision_ypfb_bolgart_pct}
                                    onChange={(e) => setInlineEditForm({ ...inlineEditForm, comision_ypfb_bolgart_pct: e.target.value })}
                                    className="w-12 px-1 py-0.5 text-right bg-white dark:bg-slate-900 border border-amber-500 rounded text-slate-900 dark:text-white text-[11px] focus:outline-none"
                                    title="BOL-GART (%)"
                                  />
                                </td>

                                {/* Com 3% editable */}
                                <td className="py-1 px-1.5 text-right">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={inlineEditForm.comision_pct_2}
                                    onChange={(e) => setInlineEditForm({ ...inlineEditForm, comision_pct_2: e.target.value })}
                                    className="w-12 px-1 py-0.5 text-right bg-white dark:bg-slate-900 border border-amber-500 rounded text-slate-900 dark:text-white text-[11px] focus:outline-none"
                                    title="Comisión 2 (% Gestión)"
                                  />
                                </td>

                                {/* Hojas de Ruta editable */}
                                <td className="py-1 px-1.5 text-right">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={inlineEditForm.costo_hojas_de_ruta_bs}
                                    onChange={(e) => setInlineEditForm({ ...inlineEditForm, costo_hojas_de_ruta_bs: e.target.value })}
                                    className="w-14 px-1 py-0.5 text-right bg-white dark:bg-slate-900 border border-amber-500 rounded text-slate-900 dark:text-white text-[11px] focus:outline-none"
                                    title="Hojas de Ruta (Bs)"
                                  />
                                </td>

                                {/* GPS editable */}
                                <td className="py-1 px-1.5 text-right">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={inlineEditForm.costo_gps_bs}
                                    onChange={(e) => setInlineEditForm({ ...inlineEditForm, costo_gps_bs: e.target.value })}
                                    className="w-14 px-1 py-0.5 text-right bg-white dark:bg-slate-900 border border-amber-500 rounded text-slate-900 dark:text-white text-[11px] focus:outline-none"
                                    title="GPS (Bs)"
                                  />
                                </td>

                                <td className="py-1.5 px-2 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      disabled={savingInlineContractual}
                                      onClick={() => handleSaveInlineContractual(v)}
                                      className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-sans font-black text-[10px] rounded-lg transition shadow-xs cursor-pointer"
                                    >
                                      {savingInlineContractual ? "..." : "Guardar"}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={savingInlineContractual}
                                      onClick={() => setInlineEditingId(null)}
                                      className="px-1.5 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 font-sans font-bold text-[10px] rounded-lg transition cursor-pointer"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr key={v.id} className="hover:bg-slate-100 dark:hover:bg-slate-900/60 transition">
                              <td className="py-1.5 px-2 font-bold font-sans text-slate-900 dark:text-white">{v.placa}</td>
                              <td className="py-1.5 px-2 font-sans text-slate-600 dark:text-slate-400">{v.fecha_carga}</td>
                              <td className="py-1.5 px-2 font-sans text-slate-700 dark:text-slate-300">{v.producto}</td>
                              <td className="py-1.5 px-2 text-right text-slate-900 dark:text-white">{formatNumber(flete, 2)}</td>
                              <td className="py-1.5 px-2 text-right text-rose-600 dark:text-rose-400">{formatNumber(v.merma_descontar_bs || 0, 2)}</td>
                              <td className="py-1.5 px-2 text-right text-slate-700 dark:text-slate-300" title="Tipo de Cambio Bs/$us">{formatNumber(v.tipo_cambio_bs ?? 6.96, 2)}</td>
                              <td className="py-1.5 px-2 text-right text-slate-700 dark:text-slate-300" title={`${v.comision_usd_m3 ?? 1.0} $us/m³`}>{formatNumber(comUsdBs, 2)}</td>
                              <td className="py-1.5 px-2 text-right text-slate-700 dark:text-slate-300" title={`${v.comision_pct_1 ?? 7.0}%`}>{formatNumber(com7Bs, 2)}</td>
                              <td className="py-1.5 px-2 text-right text-slate-700 dark:text-slate-300" title={`${v.comision_ypfb_bolgart_pct ?? 7.0}%`}>{formatNumber(bolGartBs, 2)}</td>
                              <td className="py-1.5 px-2 text-right text-slate-700 dark:text-slate-300" title={`${v.comision_pct_2 ?? 3.0}%`}>{formatNumber(com3Bs, 2)}</td>
                              <td className="py-1.5 px-2 text-right text-slate-700 dark:text-slate-300">{formatNumber(v.costo_hojas_de_ruta_bs || 0, 2)}</td>
                              <td className="py-1.5 px-2 text-right text-slate-700 dark:text-slate-300">{formatNumber(v.costo_gps_bs || 0, 2)}</td>
                              <td className="py-1.5 px-2 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => startInlineEdit(v)}
                                  className="px-2 py-0.5 bg-amber-500/15 hover:bg-amber-500/30 text-amber-700 dark:text-amber-400 font-sans font-black text-[10px] rounded-lg transition border border-amber-500/25 cursor-pointer"
                                >
                                  Editar
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Bloque de Firmas Página 3 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-center text-xs">
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-3 bg-slate-50 dark:bg-slate-950/60">
                  <div className="font-bold text-[10px] uppercase text-slate-500 dark:text-slate-400 mb-6">REALIZADO POR:</div>
                  <div className="font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-800 pt-1 text-[11px]">JAQUELINE LOVERA TIÑINI</div>
                </div>
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-3 bg-slate-50 dark:bg-slate-950/60">
                  <div className="font-bold text-[10px] uppercase text-slate-500 dark:text-slate-400 mb-6">REVISADO POR:</div>
                  <div className="font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-800 pt-1 text-[11px]">JOSE LOVERA TIÑINI / GERENTE GENERAL</div>
                </div>
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-3 bg-slate-50 dark:bg-slate-950/60">
                  <div className="font-bold text-[10px] uppercase text-slate-500 dark:text-slate-400 mb-6">AUTORIZADO POR:</div>
                  <div className="font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-800 pt-1 text-[11px]">DIRECTORIO</div>
                </div>
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-3 bg-slate-50 dark:bg-slate-950/60">
                  <div className="font-bold text-[10px] uppercase text-slate-500 dark:text-slate-400 mb-6">CANCELADO POR:</div>
                  <div className="font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-800 pt-1 text-[11px]">TOMASA TIÑINI MITA / APOYO</div>
                </div>
              </div>
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
                  {paginatedHistorial.map((v) => {
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
                          {formatNumber(getVolFactLitros(v), 0)} L
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
            {renderPagination(totalHistorialItems, totalHistorialPages, "viajes")}
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
                        {formatNumber(getVolFactM3(selectedViajeDetail) * 1000, 0)} L ({formatNumber(getVolFactM3(selectedViajeDetail), 2)} m³)
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
                {(() => {
                  const mDesc = Number(selectedViajeDetail.merma_descontar_bs) || 0;
                  const adicDesc = (Number(selectedViajeDetail.total_descuentos_adicionales_bs) || 0) + (Number(selectedViajeDetail.total_descuentos_mermas_bs) || 0);
                  const totDesc = mDesc + adicDesc;
                  const liquido = (Number(selectedViajeDetail.flete_total_bs) || 0) - totDesc;
                  return (
                    <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Resumen de Liquidación</span>
                        <span className="text-xs text-slate-400">
                          {totDesc > 0 ? "Flete Bruto Base - Descuentos Aplicados = Total Líquido" : "Volumen Facturado × Tarifa Pactada"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 sm:gap-4 sm:text-right">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">Flete Bruto:</span>
                          <span className="text-base font-black font-mono text-amber-600 dark:text-amber-400">
                            {formatCurrency(selectedViajeDetail.flete_total_bs)}
                          </span>
                        </div>
                        {totDesc > 0 && (
                          <div>
                            <span className="text-[10px] text-rose-500 block uppercase font-medium">Descuentos:</span>
                            <span className="text-base font-black font-mono text-rose-600 dark:text-rose-400">
                              -{formatCurrency(totDesc)}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block uppercase">Total a Pagar (Líquido):</span>
                          <span className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(liquido)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

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

      {/* Modal Inteligente de Importación Excel (compatible con Driver S.R.L. y Oficial) */}
      <ImportExcelModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        schema={schema}
        onSuccess={(result) => {
          if (result?.periodos_detectados && result.periodos_detectados.length > 0) {
            if (result.periodos_detectados.length === 1) {
              setPeriodo(result.periodos_detectados[0]);
              setDateFilterQuery("");
              setActiveFilterLabel(`Período ${result.periodos_detectados[0]}`);
            } else {
              setPeriodo("");
              setDateFilterQuery("");
              setActiveFilterLabel("Histórico General (Todos los Periodos)");
            }
          }
          loadPeriodos();
          loadViajes();
        }}
      />

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
                          periodo_mes: formData.periodo_mes || newPeriod
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
                          periodo_mes: formData.periodo_mes || newPeriod
                        });
                      }}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 cursor-pointer"
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

              {/* Fila 3: Tramo y Cliente con Dropdowns Interactivos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Tramo de Transporte con Dropdown Interactivo */}
                <div ref={tramoDropdownRef} className="relative">
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
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={formData.tramo}
                      onFocus={() => setShowTramoDropdown(true)}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setFormData({ ...formData, tramo: val });
                        setShowTramoDropdown(true);
                      }}
                      placeholder="ej. ARICA - TAMBO QUEMADO - LA PAZ"
                      className="w-full pl-3.5 pr-9 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs uppercase font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 transition shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTramoDropdown(!showTramoDropdown)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition"
                      title="Mostrar lista de tramos"
                    >
                      {showTramoDropdown ? (
                        <ChevronUp className="w-4 h-4 text-amber-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    {/* Menú Flotante de Selección de Tramo */}
                    {showTramoDropdown && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900/95 dark:bg-slate-900/98 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                        {(() => {
                          const query = (formData.tramo || "").trim().toUpperCase();
                          const filtered = availableTramos.filter(t => !query || t.includes(query));
                          return (
                            <div className="p-1.5 space-y-0.5">
                              {filtered.length > 0 ? (
                                filtered.map((t) => {
                                  const isSelected = formData.tramo.toUpperCase() === t;
                                  return (
                                    <button
                                      key={t}
                                      type="button"
                                      onClick={() => {
                                        setFormData({ ...formData, tramo: t });
                                        setShowTramoDropdown(false);
                                      }}
                                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition ${
                                        isSelected
                                          ? "bg-amber-500 text-slate-950 font-black shadow-sm"
                                          : "text-slate-200 hover:bg-slate-800 hover:text-white"
                                      }`}
                                    >
                                      <span className="truncate">{t}</span>
                                      {isSelected && <Check className="w-3.5 h-3.5 text-slate-950 flex-shrink-0 ml-2 stroke-[3]" />}
                                    </button>
                                  );
                                })
                              ) : (
                                <div className="p-2.5 text-center text-xs text-slate-400">
                                  <span>No hay tramos que coincidan con la búsqueda.</span>
                                </div>
                              )}
                              {query && !availableTramos.includes(query) && (
                                <button
                                  type="button"
                                  onClick={() => setShowTramoDropdown(false)}
                                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 flex items-center gap-1.5 transition mt-1"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Usar tramo personalizado: "{query}"</span>
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Cliente / Consignatario con Dropdown Interactivo */}
                <div ref={clienteDropdownRef} className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                      Cliente / Consignatario *
                    </label>
                    {formData.cliente && (
                      (() => {
                        const isReg = availableClientes.some(c => c.toUpperCase() === formData.cliente.toUpperCase());
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
                      value={formData.cliente}
                      onFocus={() => setShowClienteDropdown(true)}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setFormData({ ...formData, cliente: val });
                        setShowClienteDropdown(true);
                      }}
                      placeholder="ej. YPFB o ACEROSPAURITO S.R.L."
                      className="w-full pl-3.5 pr-9 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-bold uppercase text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 transition shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowClienteDropdown(!showClienteDropdown)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition"
                      title="Mostrar lista de clientes"
                    >
                      {showClienteDropdown ? (
                        <ChevronUp className="w-4 h-4 text-amber-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    {/* Menú Flotante de Selección de Cliente */}
                    {showClienteDropdown && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900/95 dark:bg-slate-900/98 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                        {(() => {
                          const query = (formData.cliente || "").trim().toUpperCase();
                          const filtered = availableClientes.filter(c => !query || c.includes(query));
                          return (
                            <div className="p-1.5 space-y-0.5">
                              {filtered.length > 0 ? (
                                filtered.map((c) => {
                                  const isSelected = formData.cliente.toUpperCase() === c;
                                  return (
                                    <button
                                      key={c}
                                      type="button"
                                      onClick={() => {
                                        setFormData({ ...formData, cliente: c });
                                        setShowClienteDropdown(false);
                                      }}
                                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between transition ${
                                        isSelected
                                          ? "bg-amber-500 text-slate-950 font-black shadow-sm"
                                          : "text-slate-200 hover:bg-slate-800 hover:text-white"
                                      }`}
                                    >
                                      <span className="truncate">{c}</span>
                                      {isSelected && <Check className="w-3.5 h-3.5 text-slate-950 flex-shrink-0 ml-2 stroke-[3]" />}
                                    </button>
                                  );
                                })
                              ) : (
                                <div className="p-2.5 text-center text-xs text-slate-400">
                                  <span>No hay clientes que coincidan con la búsqueda.</span>
                                </div>
                              )}
                              {query && !availableClientes.includes(query) && (
                                <button
                                  type="button"
                                  onClick={() => setShowClienteDropdown(false)}
                                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 flex items-center gap-1.5 transition mt-1"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Usar cliente nuevo: "{query}"</span>
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Acceso Rápido a Clientes Registrados */}
                  {availableClientes.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-400 font-semibold mr-0.5">Clientes:</span>
                      {availableClientes.slice(0, 4).map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setFormData({ ...formData, cliente: c })}
                          className={`text-[10px] px-2 py-0.5 rounded-lg font-bold transition border ${
                            formData.cliente.toUpperCase() === c
                              ? "bg-amber-500 text-slate-950 border-amber-600 font-black shadow-xs"
                              : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-500 hover:text-amber-500"
                          }`}
                        >
                          {c}
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
                  <div className="flex items-center gap-2">
                    {formData.producto && (
                      <button
                        type="button"
                        onClick={handleEditProducto}
                        className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:text-sky-500 hover:underline flex items-center gap-1 bg-sky-500/10 px-2 py-0.5 rounded-lg border border-sky-500/20 transition cursor-pointer"
                        title={`Editar producto seleccionado (${formData.producto}) y su tolerancia`}
                      >
                        <Edit className="w-3 h-3" />
                        <span>Editar Producto</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleCreateNuevoProducto}
                      className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-500 hover:underline flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 transition cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Nuevo Producto</span>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {catalogProductos.map((prodName) => {
                    const pUpper = prodName.toUpperCase().trim();
                    const det = catalogProductosDetalle.find(d => d.nombre.toUpperCase().trim() === pUpper);
                    let tolStr = "0.25%";
                    if (det && det.tolerancia_pct !== undefined && det.tolerancia_pct !== null) {
                      tolStr = `${det.tolerancia_pct}%`;
                    } else if (pUpper.includes("DIESEL") || pUpper.includes("DIÉSEL") || pUpper === "DO") {
                      tolStr = "0.15%";
                    } else if (pUpper.includes("IYA") || pUpper.includes("INSUMOS") || pUpper.includes("ADIT")) {
                      tolStr = "0.20%";
                    } else if (pUpper.includes("PLANCHA") || pUpper.includes("SOYA") || pUpper.includes("GIRASOL") || pUpper.includes("ACERO")) {
                      tolStr = "0.00%";
                    }

                    const isSelected = formData.producto === prodName;
                    return (
                      <button
                        key={prodName}
                        type="button"
                        onClick={() => setFormData({ ...formData, producto: prodName })}
                        className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                          isSelected
                            ? "bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 font-black shadow-sm ring-1 ring-amber-500/30"
                            : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                        }`}
                      >
                        <span className="text-xs font-bold leading-tight truncate max-w-full">{prodName}</span>
                        <span className="text-[10px] font-mono opacity-80">Tolerancia: {tolStr}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fila 6: Volúmenes, Volumen Facturado y Tarifa (Diseño Responsivo de 2 Columnas) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
                      const v = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        volumen_recepcionado_litros: v === "" ? "" : v,
                        volumen_facturado: v === "" ? "" : v
                      }));
                    }}
                    onBlur={(e) => {
                      if (e.target.value === "" || isNaN(Number(e.target.value))) {
                        setFormData((prev) => ({ ...prev, volumen_recepcionado_litros: 0, volumen_facturado: 0 }));
                      }
                    }}
                    placeholder="0"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase leading-snug">
                      Volumen Facturado (Lt) *
                    </label>
                  </div>
                  <input
                    type="number"
                    step="1"
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
                    placeholder="ej. 33900"
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
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Sección Exclusiva: Parámetros y Deducciones Contractuales YPFB */}
              {isYpfbClient(formData.cliente) && (
                <div className="p-4 bg-amber-500/5 dark:bg-amber-950/20 border-2 border-amber-500/30 rounded-2xl space-y-3 animate-in fade-in transition-all">
                  <div className="flex items-center justify-between border-b border-amber-500/20 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black text-xs">
                        YPFB
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                          Parámetros y Comisiones Contractuales YPFB
                        </h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          Configuración de descuentos de combustible y deducciones de liquidación para este viaje
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                      Exclusivo YPFB
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                        Comisión 1 ($us/m³)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.comision_usd_m3}
                        onChange={(e) => setFormData({ ...formData, comision_usd_m3: e.target.value })}
                        onBlur={(e) => {
                          if (e.target.value === "" || isNaN(Number(e.target.value))) {
                            setFormData((prev) => ({ ...prev, comision_usd_m3: 1.00 }));
                          }
                        }}
                        placeholder="1.00"
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                      />
                      <span className="text-[9px] text-slate-400 block mt-0.5">1 $us/m³</span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                        Comisión 7% (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.comision_pct_1}
                        onChange={(e) => setFormData({ ...formData, comision_pct_1: e.target.value })}
                        onBlur={(e) => {
                          if (e.target.value === "" || isNaN(Number(e.target.value))) {
                            setFormData((prev) => ({ ...prev, comision_pct_1: 7.00 }));
                          }
                        }}
                        placeholder="7.00"
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                      />
                      <span className="text-[9px] text-slate-400 block mt-0.5">Retención 7%</span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                        BOL-GART 7% (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.comision_ypfb_bolgart_pct}
                        onChange={(e) => setFormData({ ...formData, comision_ypfb_bolgart_pct: e.target.value })}
                        onBlur={(e) => {
                          if (e.target.value === "" || isNaN(Number(e.target.value))) {
                            setFormData((prev) => ({ ...prev, comision_ypfb_bolgart_pct: 7.00 }));
                          }
                        }}
                        placeholder="7.00"
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                      />
                      <span className="text-[9px] text-slate-400 block mt-0.5">Boleta Garantía 7%</span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                        Comisión 3% (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.comision_pct_2}
                        onChange={(e) => setFormData({ ...formData, comision_pct_2: e.target.value })}
                        onBlur={(e) => {
                          if (e.target.value === "" || isNaN(Number(e.target.value))) {
                            setFormData((prev) => ({ ...prev, comision_pct_2: 3.00 }));
                          }
                        }}
                        placeholder="3.00"
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                      />
                      <span className="text-[9px] text-slate-400 block mt-0.5">Gestión 3%</span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                        Hojas de Ruta (Bs.)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.costo_hojas_de_ruta_bs}
                        onChange={(e) => setFormData({ ...formData, costo_hojas_de_ruta_bs: e.target.value })}
                        onBlur={(e) => {
                          if (e.target.value === "" || isNaN(Number(e.target.value))) {
                            setFormData((prev) => ({ ...prev, costo_hojas_de_ruta_bs: 0.00 }));
                          }
                        }}
                        placeholder="0.00"
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                      />
                      <span className="text-[9px] text-slate-400 block mt-0.5">0.00 Bs fijo</span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                        GPS / Precintos (Bs.)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.costo_gps_bs}
                        onChange={(e) => setFormData({ ...formData, costo_gps_bs: e.target.value })}
                        onBlur={(e) => {
                          if (e.target.value === "" || isNaN(Number(e.target.value))) {
                            setFormData((prev) => ({ ...prev, costo_gps_bs: 0.00 }));
                          }
                        }}
                        placeholder="0.00"
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                      />
                      <span className="text-[9px] text-slate-400 block mt-0.5">0.00 Bs fijo</span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                        Precio Merma + IVA
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        value={formData.precio_merma_litro_bs}
                        onChange={(e) => setFormData({ ...formData, precio_merma_litro_bs: e.target.value })}
                        onBlur={(e) => {
                          if (e.target.value === "" || isNaN(Number(e.target.value))) {
                            setFormData((prev) => ({ ...prev, precio_merma_litro_bs: 7.450000 }));
                          }
                        }}
                        placeholder="7.450000"
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                      />
                      <span className="text-[9px] text-slate-400 block mt-0.5">6 decimales (ej. 7.450000 Bs/L)</span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                        Anticipos y Otros (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.anticipos_otros_pct}
                        onChange={(e) => setFormData({ ...formData, anticipos_otros_pct: e.target.value })}
                        onBlur={(e) => {
                          if (e.target.value === "" || isNaN(Number(e.target.value))) {
                            setFormData((prev) => ({ ...prev, anticipos_otros_pct: 0.00 }));
                          }
                        }}
                        placeholder="0.00"
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                      />
                      <span className="text-[9px] text-slate-400 block mt-0.5">0.00% opcional</span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                        T.C. Dólar (Bs/$us)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.tipo_cambio_bs}
                        onChange={(e) => setFormData({ ...formData, tipo_cambio_bs: e.target.value })}
                        onBlur={(e) => {
                          if (e.target.value === "" || isNaN(Number(e.target.value))) {
                            setFormData((prev) => ({ ...prev, tipo_cambio_bs: 6.96 }));
                          }
                        }}
                        placeholder="6.96"
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                      />
                      <span className="text-[9px] text-slate-400 block mt-0.5">6.96 Bs/$us</span>
                    </div>
                  </div>
                </div>
              )}

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
                  {isYpfbClient(formData.cliente) ? "Cálculos Automáticos YPFB en Tiempo Real:" : "Cálculos de Flete en Tiempo Real (Carga Seca / No YPFB - Sin Mermas ni Deducciones Contractuales):"}
                </span>
                
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] block uppercase font-bold">Merma Real:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                      {isYpfbClient(formData.cliente) ? (liveCalc.merma_real > 0 ? `+${liveCalc.merma_real}` : `${liveCalc.merma_real}`) : "0"} L
                    </span>
                    <span className="text-[9px] text-slate-400 block">
                      {isYpfbClient(formData.cliente) ? `Tol: ${liveCalc.merma_tolerable} L (${liveCalc.tolerancia_pct}%)` : "No aplica (0.0%)"}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] block uppercase font-bold">Desc. Merma (Carga):</span>
                    <span className={`font-mono font-bold text-xs ${liveCalc.merma_descontar_bs > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {isYpfbClient(formData.cliente) ? formatCurrency(liveCalc.merma_descontar_bs) : "Bs. 0,00"}
                    </span>
                    <span className="text-[9px] text-slate-400 block">
                      {isYpfbClient(formData.cliente) ? `Exc: ${liveCalc.merma_excedente} L` : "Sin merma"}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] block uppercase font-bold">Flete Bruto:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                      {formatCurrency(liveCalc.flete_total_bs)}
                    </span>
                    <span className="text-[9px] text-slate-400 block">Base Facturada</span>
                  </div>

                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] block uppercase font-bold">Total Descuentos:</span>
                    <span className={`font-mono font-bold text-xs ${liveCalc.total_descuentos_bs > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-400"}`}>
                      {liveCalc.total_descuentos_bs > 0 ? `-${formatCurrency(liveCalc.total_descuentos_bs)}` : "Bs. 0,00"}
                    </span>
                    {(liveCalc.total_descuentos_adicionales > 0 || liveCalc.total_descuentos_mermas > 0) && (
                      <span className="text-[9px] text-slate-400 block">Inc. adicionales</span>
                    )}
                  </div>

                  <div className="p-2 rounded-xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 col-span-2 sm:col-span-1">
                    <span className="text-amber-800 dark:text-amber-400 text-[10px] block uppercase font-black">Total a Pagar (Neto):</span>
                    <span className="font-mono font-black text-amber-700 dark:text-amber-400 text-sm">
                      {formatCurrency(liveCalc.liquido_pagable_bs)}
                    </span>
                    <span className="text-[9px] text-amber-600/80 dark:text-amber-400/80 block">Líquido Despacho</span>
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

      {/* Modal para Ajustar Deducciones en Viajes */}
      {showAdjustDeductionsModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md overflow-hidden animate-in fade-in">
            <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                    <SlidersHorizontal className="w-4 h-4" />
                  </div>
                  <span>Ajustar Montos de Deducción (Hoja 2)</span>
                </h3>
                <button
                  onClick={() => setShowAdjustDeductionsModal(false)}
                  className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded-lg transition"
                >
                  ✕
                </button>
              </div>

              <form id="adjust-deductions-form" onSubmit={handleSaveDeductionsAdjustments} className="p-6 space-y-3.5 flex-1 overflow-y-auto text-xs">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                  Modifique directamente los valores consolidados de deducción para este conjunto de viajes o período.
                </p>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Descuento Merma (Bs)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={adjustDeductionForm.desc_merma_bs}
                      onChange={(e) => setAdjustDeductionForm({ ...adjustDeductionForm, desc_merma_bs: e.target.value })}
                      placeholder="0.00"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Comisión 1 $us p/m3 (Bs)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={adjustDeductionForm.desc_comision_usd_m3_bs}
                      onChange={(e) => setAdjustDeductionForm({ ...adjustDeductionForm, desc_comision_usd_m3_bs: e.target.value })}
                      placeholder="0.00"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Comisión 7% (Bs)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={adjustDeductionForm.desc_comision_7pct_bs}
                      onChange={(e) => setAdjustDeductionForm({ ...adjustDeductionForm, desc_comision_7pct_bs: e.target.value })}
                      placeholder="0.00"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">YPFB BOL-GART 7% (Bs)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={adjustDeductionForm.desc_comision_ypfb_bolgart_7pct_bs}
                      onChange={(e) => setAdjustDeductionForm({ ...adjustDeductionForm, desc_comision_ypfb_bolgart_7pct_bs: e.target.value })}
                      placeholder="0.00"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Comisión 3% (Bs)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={adjustDeductionForm.desc_comision_3pct_bs}
                      onChange={(e) => setAdjustDeductionForm({ ...adjustDeductionForm, desc_comision_3pct_bs: e.target.value })}
                      placeholder="0.00"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Hojas de Ruta (Bs)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={adjustDeductionForm.desc_hojas_ruta_bs}
                      onChange={(e) => setAdjustDeductionForm({ ...adjustDeductionForm, desc_hojas_ruta_bs: e.target.value })}
                      placeholder="0.00"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">GPS (Bs)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={adjustDeductionForm.desc_gps_bs}
                      onChange={(e) => setAdjustDeductionForm({ ...adjustDeductionForm, desc_gps_bs: e.target.value })}
                      placeholder="0.00"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Anticipos y Otros (Bs)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={adjustDeductionForm.desc_anticipos_otros_bs}
                      onChange={(e) => setAdjustDeductionForm({ ...adjustDeductionForm, desc_anticipos_otros_bs: e.target.value })}
                      placeholder="0.00"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Otros Ajustes / Descuentos (Bs)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustDeductionForm.desc_otros_ajustes_bs}
                    onChange={(e) => setAdjustDeductionForm({ ...adjustDeductionForm, desc_otros_ajustes_bs: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
              </form>

              <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex justify-between items-center flex-shrink-0">
                <button
                  type="button"
                  onClick={handleResetDeductionsAdjustments}
                  className="px-3 py-2 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 text-xs font-bold transition"
                >
                  Restablecer Originales
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAdjustDeductionsModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-bold transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    form="adjust-deductions-form"
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black transition shadow-sm"
                  >
                    Guardar Ajustes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

    </div>
  );
}
