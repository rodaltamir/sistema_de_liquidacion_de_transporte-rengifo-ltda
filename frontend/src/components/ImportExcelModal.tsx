"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  Layers,
  ArrowRight,
  RefreshCw,
  Download,
  Info,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Check,
  Calendar,
  DollarSign,
  Truck,
  Scale,
  Building2,
  Edit3,
  Search,
  Filter,
  CheckSquare,
  Square,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ArrowDownUp,
  FileText
} from "lucide-react";
import Swal from "sweetalert2";
import ModalPortal from "@/components/ModalPortal";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatNumber, formatDate } from "@/lib/format";
import { downloadBlob } from "@/lib/download";
import { useTheme } from "@/context/ThemeContext";

export interface EmpresaDetectada {
  nombre: string;
  tipo_sugerido?: "empresa";
  action: "reutilizar" | "crear";
  empresa_id?: number | null;
  schema_name: string;
  already_in_asociacion: boolean;
  total_viajes: number;
  viajes_listos?: number;
  viajes_incompletos?: number;
  total_volumen_litros: number;
  total_volumen_m3: number;
  total_flete_bs: number;
  cisternas_count: number;
}

export interface ClienteDetectado {
  nombre: string;
  tipo_sugerido: "cliente";
  action: string;
  total_viajes: number;
  total_volumen_m3: number;
  total_volumen_litros: number;
  total_flete_bs: number;
}

export interface FacturaConciliacion {
  nro_factura: string;
  fecha_factura?: string | null;
  cliente: string;
  empresa: string;
  total_viajes: number;
  total_volumen_m3: number;
  total_importe_bs: number;
  subtotal_excel_bs: number;
  diferencia_bs: number;
  cuadra: boolean;
  tiene_subtotal_fila: boolean;
}

export interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  schema?: string;
  globalMode?: boolean;
  defaultImportType?: "empresa" | "asociacion";
  initialAsociacionId?: number | null;
  initialAsociacionName?: string;
  initialAsociacionSigla?: string;
  initialFile?: File | null;
  initialEmpresaName?: string;
  onSuccess: (result: {
    total_importados: number;
    total_actualizados: number;
    total_omitidos: number;
    periodos_detectados: string[];
    target_schema?: string;
    empresa_name?: string;
    asociacion_name?: string;
  }) => void;
}

export interface PreviewRecord {
  fila: number;
  hoja?: string;
  fila_hoja?: number;
  empresa?: string;
  placa: string;
  tramo: string;
  cliente: string;
  entidad_origen?: string;
  tipo_entidad?: "empresa" | "cliente";
  es_apoyo?: boolean;
  empresa_apoyo_nombre?: string | null;
  producto: string;
  fecha_carga: string;
  fecha_descarga: string;
  fecha_factura?: string | null;
  nro_factura?: string | null;
  mic_dta?: string | null;
  contrato?: string | null;
  volumen_origen_litros: number;
  volumen_recepcionado_litros: number;
  volumen_facturado: number;
  volumen_facturado_m3: number;
  tarifa_flete: number;
  tipo_tarifa: string;
  flete_total_bs: number;
  periodo_mes: string;
  is_incompleto?: boolean;
  incompleto_reason?: string;
  status: "LISTO" | "INCOMPLETO";
  included?: boolean;
  isEdited?: boolean;
}

interface SkippedDetail {
  fila: number;
  hoja?: string;
  motivo: string;
}

interface PreviewResponse {
  success: boolean;
  sheets: string[];
  selected_sheet: string;
  hojas_procesadas?: Array<{
    hoja: string;
    viajes: number;
    anio?: number | null;
  }>;
  total_hojas?: number;
  header_row: number;
  total_valid_rows: number;
  total_skipped_rows: number;
  records: PreviewRecord[];
  skipped_details: SkippedDetail[];
  suggested_company_name?: string;
  is_multi_empresa?: boolean;
  empresas_detectadas?: EmpresaDetectada[];
  clientes_detectados?: ClienteDetectado[];
  facturas_conciliacion?: FacturaConciliacion[];
  summary: {
    total_viajes: number;
    viajes_listos: number;
    viajes_incompletos: number;
    total_volumen_litros: number;
    total_volumen_m3: number;
    total_flete_bs: number;
    periodos_detectados: string[];
    total_placas_unicas: number;
    total_empresas_detectadas?: number;
    total_clientes_detectados?: number;
    total_facturas_detectadas?: number;
    facturas_cuadran_100?: boolean;
    total_hojas_procesadas?: number;
  };
}

export default function ImportExcelModal({
  isOpen,
  onClose,
  schema,
  globalMode = false,
  defaultImportType = "empresa",
  initialAsociacionId = null,
  initialAsociacionName = "",
  initialAsociacionSigla = "",
  initialFile = null,
  initialEmpresaName = "",
  onSuccess
}: ImportExcelModalProps) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const swalBg = isDark ? "#0f172a" : "#ffffff";
  const swalColor = isDark ? "#f8fafc" : "#0f172a";
  const swalCancelColor = isDark ? "#334155" : "#94a3b8";

  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tipo de importación: "empresa" (Individual) o "asociacion" (Multi-Empresa)
  const [importType, setImportType] = useState<"empresa" | "asociacion">(
    initialAsociacionId ? "asociacion" : defaultImportType
  );

  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  
  // Sub-pestaña activa en la revisión (Viajes, Facturas o Entidades)
  const [activeReviewTab, setActiveReviewTab] = useState<"records" | "facturas" | "entidades">("records");

  // Clasificación de entidades de Columna A ("empresa" o "cliente")
  const [entidadesClasificacion, setEntidadesClasificacion] = useState<Record<string, "empresa" | "cliente">>({});

  // Registros interactivos editables
  const [editableRecords, setEditableRecords] = useState<PreviewRecord[]>([]);
  const [showSkipped, setShowSkipped] = useState(false);
  const [tableFilter, setTableFilter] = useState<"all" | "ready" | "incomplete">("all");
  const [tableSearch, setTableSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<"fila" | "fecha" | "factura" | "placa" | "cliente" | "flete">("fila");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Opciones de Destino para Modo Global / Empresa Individual
  const [importMode, setImportMode] = useState<"create_new" | "use_existing">("create_new");
  const [newEmpresaName, setNewEmpresaName] = useState(initialEmpresaName || "");
  const [newEmpresaTipo, setNewEmpresaTipo] = useState("Sociedad");
  const [newEmpresaNit, setNewEmpresaNit] = useState("");
  const [newEmpresaAsocId, setNewEmpresaAsocId] = useState<string | number>(initialAsociacionId || "");
  const [selectedExistingSchema, setSelectedExistingSchema] = useState("");

  // Creación de nueva asociación en caliente
  const [creatingNewAsoc, setCreatingNewAsoc] = useState(Boolean(initialAsociacionName));
  const [newAsocNombre, setNewAsocNombre] = useState(initialAsociacionName || "");
  const [newAsocSigla, setNewAsocSigla] = useState(initialAsociacionSigla || "");
  
  // Listas de empresas y asociaciones para selector global
  const [asociaciones, setAsociaciones] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);

  // Cargar asociaciones y empresas si está en globalMode o modo asociacion
  useEffect(() => {
    if (isOpen) {
      Promise.all([
        apiFetch("/asociaciones/").catch(() => []),
        apiFetch("/empresas/").catch(() => [])
      ]).then(([asocData, empData]) => {
        const validAsocs = Array.isArray(asocData) ? asocData : [];
        setAsociaciones(validAsocs);
        const validEmps = Array.isArray(empData) ? empData : [];
        setEmpresas(validEmps);
        if (validEmps.length > 0 && !selectedExistingSchema) {
          setSelectedExistingSchema(validEmps[0].schema_name);
        }
        if (initialAsociacionId) {
          setNewEmpresaAsocId(initialAsociacionId);
        } else if (validAsocs.length > 0 && !newEmpresaAsocId) {
          setNewEmpresaAsocId(validAsocs[0].id);
        }
      });
    }
  }, [isOpen, initialAsociacionId]);

  // Reset state o inicializar con props al abrir/cerrar
  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setSheets([]);
      setSelectedSheet("");
      setPreviewData(null);
      setEditableRecords([]);
      setEntidadesClasificacion({});
      setActiveReviewTab("records");
      setIsLoadingPreview(false);
      setIsImporting(false);
      setShowSkipped(false);
      setTableFilter("all");
      setTableSearch("");
      setSortColumn("fila");
      setSortDirection("asc");
      setNewEmpresaName("");
      setNewEmpresaNit("");
      setCreatingNewAsoc(false);
      setNewAsocNombre("");
      setNewAsocSigla("");
      setImportType(initialAsociacionId ? "asociacion" : defaultImportType);
    } else {
      if (initialAsociacionId) {
        setImportType("asociacion");
        setNewEmpresaAsocId(initialAsociacionId);
        setCreatingNewAsoc(false);
      } else if (initialAsociacionName) {
        setImportType("asociacion");
        setCreatingNewAsoc(true);
        setNewAsocNombre(initialAsociacionName);
        if (initialAsociacionSigla) {
          setNewAsocSigla(initialAsociacionSigla);
        }
      } else if (defaultImportType) {
        setImportType(defaultImportType);
      }
      if (initialEmpresaName) {
        setNewEmpresaName(initialEmpresaName);
      }
      if (initialFile) {
        processFile(initialFile);
      }
    }
  }, [isOpen, initialAsociacionId, initialEmpresaName, initialAsociacionName, initialAsociacionSigla, initialFile]);

  // Manejo de carga y análisis del archivo Excel
  const processFile = async (selectedFile: File, sheetOverride?: string) => {
    if (!selectedFile.name.endsWith(".xlsx") && !selectedFile.name.endsWith(".xlsm") && !selectedFile.name.endsWith(".xltx")) {
      Swal.fire({
        icon: "warning",
        title: "Formato no válido",
        text: "Por favor selecciona un archivo con formato Excel (.xlsx o .xlsm).",
        background: swalBg,
        color: swalColor,
        confirmButtonColor: "#f59e0b"
      });
      return;
    }

    setFile(selectedFile);
    setIsLoadingPreview(true);
    setPreviewData(null);
    setEditableRecords([]);

    try {
      let targetSheet = sheetOverride;
      
      // 1. Obtener información de hojas
      if (!targetSheet) {
        const infoPayload = new FormData();
        infoPayload.append("file", selectedFile);
        
        const infoEndpoint = globalMode 
          ? "/empresas/excel-info" 
          : `/tenants/${schema}/viajes/excel-info`;

        const infoRes = await apiFetch(infoEndpoint, {
          method: "POST",
          body: infoPayload
        });

        if (infoRes?.sheets && infoRes.sheets.length > 0) {
          setSheets(infoRes.sheets);
          // Si el archivo contiene múltiples hojas (ej. 2024, 2025, 2026), consolidar todas por defecto
          targetSheet = infoRes.default_sheet || (infoRes.sheets.length > 1 ? "__ALL__" : infoRes.sheets[0]);
          setSelectedSheet(targetSheet);
        }

        if (globalMode && infoRes?.suggested_company_name && !newEmpresaName) {
          setNewEmpresaName(infoRes.suggested_company_name);
        }
      }

      // 2. Previsualización de despachos
      const previewPayload = new FormData();
      previewPayload.append("file", selectedFile);
      if (targetSheet) {
        previewPayload.append("sheet_name", targetSheet);
      }
      if (globalMode && importMode === "use_existing" && selectedExistingSchema) {
        previewPayload.append("target_schema", selectedExistingSchema);
      }

      const previewEndpoint = globalMode
        ? "/empresas/preview-excel"
        : `/tenants/${schema}/viajes/preview-excel`;

      const res = await apiFetch(previewEndpoint, {
        method: "POST",
        body: previewPayload
      });

      setPreviewData(res);
      if (res?.records) {
        const mapped = res.records.map((r: PreviewRecord) => ({
          ...r,
          included: true,
          isEdited: false
        }));
        setEditableRecords(mapped);
      }

      // Inicializar clasificación de entidades
      const initialEntidades: Record<string, "empresa" | "cliente"> = {};
      if (res?.empresas_detectadas) {
        res.empresas_detectadas.forEach((e: any) => {
          initialEntidades[e.nombre] = "empresa";
        });
      }
      if (res?.clientes_detectados) {
        res.clientes_detectados.forEach((c: any) => {
          initialEntidades[c.nombre] = "cliente";
        });
      }
      setEntidadesClasificacion(initialEntidades);

      if (globalMode && res?.suggested_company_name && !newEmpresaName) {
        setNewEmpresaName(res.suggested_company_name);
      }
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al procesar Excel",
        text: err.message || "No se pudo interpretar la estructura del archivo.",
        background: swalBg,
        color: swalColor,
        confirmButtonColor: "#f59e0b"
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleSheetChange = (newSheet: string) => {
    setSelectedSheet(newSheet);
    if (file) {
      processFile(file, newSheet);
    }
  };

  const downloadBaseTemplate = async () => {
    try {
      const endpoint = schema 
        ? `/tenants/${schema}/viajes/plantilla-excel`
        : `/asociaciones/plantilla-excel`;
      const blob = await apiFetch(endpoint).catch(async () => {
        // Fallback a primera empresa o general
        if (empresas.length > 0) {
          return await apiFetch(`/tenants/${empresas[0].schema_name}/viajes/plantilla-excel`);
        }
        throw new Error("No hay empresas disponibles para descargar la plantilla base.");
      });
      downloadBlob(blob, "Plantilla_Oficial_Viajes_Rengifo.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al descargar",
        text: err.message,
        background: swalBg,
        color: swalColor
      });
    }
  };

  // Alternar clasificación de una entidad detectada entre Empresa o Cliente
  const handleToggleEntityClassification = (entidadNombre: string, nuevoTipo: "empresa" | "cliente") => {
    setEntidadesClasificacion(prev => ({
      ...prev,
      [entidadNombre]: nuevoTipo
    }));

    setEditableRecords(prev => prev.map(rec => {
      const orig = rec.entidad_origen || rec.empresa || rec.cliente;
      if (orig && orig.toUpperCase().trim() === entidadNombre.toUpperCase().trim()) {
        if (nuevoTipo === "cliente") {
          return {
            ...rec,
            tipo_entidad: "cliente",
            cliente: entidadNombre,
            empresa: initialEmpresaName || schema || "EMPRESA PRINCIPAL",
            isEdited: true
          };
        } else {
          return {
            ...rec,
            tipo_entidad: "empresa",
            empresa: entidadNombre,
            cliente: rec.cliente && rec.cliente !== entidadNombre ? rec.cliente : "YPFB",
            isEdited: true
          };
        }
      }
      return rec;
    }));
  };

  // Edición interactiva de registros en tabla
  const handleRecordFieldChange = (index: number, field: keyof PreviewRecord, val: any) => {
    setEditableRecords(prev => {
      const next = [...prev];
      const r = { ...next[index] };

      if (field === "empresa") {
        r.empresa = String(val).toUpperCase();
      } else if (field === "placa") {
        r.placa = String(val).toUpperCase().trim();
      } else if (field === "tramo") {
        r.tramo = String(val).toUpperCase();
      } else if (field === "cliente") {
        r.cliente = String(val).toUpperCase();
      } else if (field === "producto") {
        r.producto = String(val).toUpperCase();
      } else if (field === "nro_factura") {
        r.nro_factura = val ? String(val).trim() : null;
      } else if (field === "volumen_facturado") {
        const numVal = parseFloat(val) || 0;
        r.volumen_facturado = numVal;
        r.volumen_facturado_m3 = Math.round((numVal / 1000.0) * 1000) / 1000;
        r.flete_total_bs = Math.round(((numVal / 1000.0) * r.tarifa_flete) * 100) / 100;
      } else if (field === "tarifa_flete") {
        const numTarifa = parseFloat(val) || 0;
        r.tarifa_flete = numTarifa;
        r.flete_total_bs = Math.round(((r.volumen_facturado / 1000.0) * numTarifa) * 100) / 100;
      } else if (field === "included") {
        r.included = Boolean(val);
      }

      // Reevaluación inmediata de completitud en caliente
      const cleanP = (r.placa || "").trim().toUpperCase().replace(/\s+/g, "");
      const isSinPlaca = cleanP === "SINPLACA" || cleanP === "SIN_PLACA" || cleanP === "S/P" || cleanP === "SIN PLACA";
      const isMissingPlaca = !cleanP || ["FALTAPLACA", "TOTAL", "SUBTOTAL", "NONE"].includes(cleanP);
      const isMissingVolAndFlete = (r.volumen_facturado || 0) <= 0 && (r.flete_total_bs || 0) <= 0;
      const isMissingTramo = !r.tramo || r.tramo.trim() === "";

      if (isMissingPlaca) {
        r.is_incompleto = true;
        r.incompleto_reason = "Falta placa del camión";
        r.status = "INCOMPLETO";
      } else if (isMissingVolAndFlete) {
        r.is_incompleto = true;
        r.incompleto_reason = "Volumen e Importe en 0";
        r.status = "INCOMPLETO";
      } else if (isMissingTramo) {
        r.is_incompleto = true;
        r.incompleto_reason = "Falta especificar tramo";
        r.status = "INCOMPLETO";
      } else {
        r.is_incompleto = false;
        r.incompleto_reason = undefined;
        r.status = "LISTO";
      }

      r.isEdited = true;
      next[index] = r;
      return next;
    });
  };

  const toggleAllRecords = (included: boolean) => {
    setEditableRecords(prev => prev.map(r => ({ ...r, included })));
  };

  const selectOnlyReady = () => {
    setEditableRecords(prev => prev.map(r => {
      const cleanP = (r.placa || "").trim().toUpperCase().replace(/\s+/g, "");
      const isSinPlaca = cleanP === "SINPLACA" || cleanP === "SIN_PLACA" || cleanP === "S/P" || cleanP === "SIN PLACA";
      const isMissingPlaca = !cleanP || ["FALTAPLACA", "TOTAL", "SUBTOTAL", "NONE"].includes(cleanP);
      const isMissingVolAndFlete = (r.volumen_facturado || 0) <= 0 && (r.flete_total_bs || 0) <= 0;
      const isMissingTramo = !r.tramo || r.tramo.trim() === "";
      const isIncomplete = r.is_incompleto || r.status === "INCOMPLETO" || isMissingPlaca || isMissingVolAndFlete || isMissingTramo;
      return {
        ...r,
        included: !isIncomplete
      };
    }));
  };

  // Cálculos dinámicos de métricas sobre despachos incluidos
  const includedRecords = useMemo(() => {
    return editableRecords.filter(r => r.included !== false);
  }, [editableRecords]);

  const dynamicSummary = useMemo(() => {
    const totalViajes = includedRecords.length;
    let totalVol = 0;
    let totalFlete = 0;
    const placas = new Set<string>();
    let incompletosCount = 0;
    let listosCount = 0;
    let missingPlacas = 0;
    const periodos = new Set<string>();

    includedRecords.forEach(r => {
      totalVol += (r.volumen_facturado || 0);
      totalFlete += (r.flete_total_bs || 0);
      const cleanP = (r.placa || "").trim().toUpperCase().replace(/\s+/g, "");
      const isSinPlaca = cleanP === "SINPLACA" || cleanP === "SIN_PLACA" || cleanP === "S/P" || cleanP === "SIN PLACA";
      const isMissingP = !cleanP || ["FALTAPLACA", "TOTAL", "SUBTOTAL", "NONE"].includes(cleanP);
      const isMissingVolAndFlete = (r.volumen_facturado || 0) <= 0 && (r.flete_total_bs || 0) <= 0;
      const isMissingTramo = !r.tramo || r.tramo.trim() === "";

      if (isMissingP) {
        missingPlacas++;
      } else if (!isSinPlaca) {
        placas.add(cleanP);
      }

      if (r.is_incompleto || r.status === "INCOMPLETO" || isMissingP || isMissingVolAndFlete || isMissingTramo) {
        incompletosCount++;
      } else {
        listosCount++;
      }

      if (r.periodo_mes) {
        periodos.add(r.periodo_mes);
      }
    });

    return {
      totalViajes,
      listosCount,
      incompletosCount,
      totalVolumenLitros: Math.round(totalVol * 10) / 10,
      totalVolumenM3: Math.round((totalVol / 1000.0) * 1000) / 1000,
      totalFleteBs: Math.round(totalFlete * 100) / 100,
      totalPlacas: placas.size,
      missingPlacas,
      periodos: Array.from(periodos).sort()
    };
  }, [includedRecords]);

  // Agrupación dinámica de empresas sobre los registros incluidos
  const dynamicEmpresasSummary = useMemo(() => {
    const map = new Map<string, {
      nombre: string;
      totalViajes: number;
      totalVol: number;
      totalFlete: number;
      placas: Set<string>;
    }>();

    includedRecords.forEach(r => {
      const empName = (r.empresa || "").trim().toUpperCase() || (importType === "empresa" ? (newEmpresaName || "EMPRESA PRINCIPAL") : "EMPRESA ASOCIADA");
      if (!map.has(empName)) {
        map.set(empName, {
          nombre: empName,
          totalViajes: 0,
          totalVol: 0,
          totalFlete: 0,
          placas: new Set<string>()
        });
      }
      const item = map.get(empName)!;
      item.totalViajes += 1;
      item.totalVol += (r.volumen_facturado || 0);
      item.totalFlete += (r.flete_total_bs || 0);
      if (r.placa) {
        item.placas.add(r.placa.trim().toUpperCase());
      }
    });

    return Array.from(map.values()).map(item => {
      const detected = previewData?.empresas_detectadas?.find(d => d.nombre.toUpperCase() === item.nombre.toUpperCase());
      const existingEmp = empresas.find(e => e.name.toUpperCase() === item.nombre.toUpperCase());
      const isExisting = Boolean(detected?.action === "reutilizar" || existingEmp);
      
      return {
        nombre: item.nombre,
        action: isExisting ? ("reutilizar" as const) : ("crear" as const),
        totalViajes: item.totalViajes,
        totalVolumenLitros: Math.round(item.totalVol * 10) / 10,
        totalVolumenM3: Math.round((item.totalVol / 1000.0) * 1000) / 1000,
        totalFleteBs: Math.round(item.totalFlete * 100) / 100,
        totalPlacas: item.placas.size
      };
    });
  }, [includedRecords, previewData, empresas, importType, newEmpresaName]);

  // Filtro y ordenamiento de la tabla
  const filteredRecords = useMemo(() => {
    const list = editableRecords.filter((r) => {
      const cleanP = (r.placa || "").trim().toUpperCase().replace(/\s+/g, "");
      const isSinPlaca = cleanP === "SINPLACA" || cleanP === "SIN_PLACA" || cleanP === "S/P" || cleanP === "SIN PLACA";
      const isMissingP = !cleanP || ["FALTAPLACA", "TOTAL", "SUBTOTAL", "NONE"].includes(cleanP);
      const isMissingVolAndFlete = (r.volumen_facturado || 0) <= 0 && (r.flete_total_bs || 0) <= 0;
      const isMissingTramo = !r.tramo || r.tramo.trim() === "";
      const isIncomplete = r.is_incompleto || r.status === "INCOMPLETO" || isMissingP || isMissingVolAndFlete || isMissingTramo;

      if (tableFilter === "ready" && isIncomplete) return false;
      if (tableFilter === "incomplete" && !isIncomplete) return false;

      // Buscador
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase().trim();
        const empMatch = r.empresa?.toLowerCase().includes(q);
        const pMatch = r.placa?.toLowerCase().includes(q);
        const tMatch = r.tramo?.toLowerCase().includes(q);
        const fMatch = r.nro_factura?.toLowerCase().includes(q);
        const mMatch = r.mic_dta?.toLowerCase().includes(q);
        const cMatch = r.cliente?.toLowerCase().includes(q);
        const prodMatch = r.producto?.toLowerCase().includes(q);
        if (!empMatch && !pMatch && !tMatch && !fMatch && !mMatch && !cMatch && !prodMatch) return false;
      }

      return true;
    });

    // Ordenamiento dinámico
    if (sortColumn === "fila") {
      list.sort((a, b) => sortDirection === "asc" ? a.fila - b.fila : b.fila - a.fila);
    } else if (sortColumn === "fecha") {
      list.sort((a, b) => {
        const dateA = a.fecha_carga || a.fecha_factura || a.fecha_descarga || "";
        const dateB = b.fecha_carga || b.fecha_factura || b.fecha_descarga || "";
        const cmp = dateA.localeCompare(dateB);
        return sortDirection === "asc" ? cmp : -cmp;
      });
    } else if (sortColumn === "factura") {
      list.sort((a, b) => {
        const facA = (a.nro_factura || "").trim();
        const facB = (b.nro_factura || "").trim();
        if (!facA && facB) return 1;
        if (facA && !facB) return -1;
        const cmp = facA.localeCompare(facB, undefined, { numeric: true, sensitivity: "base" });
        return sortDirection === "asc" ? cmp : -cmp;
      });
    } else if (sortColumn === "placa") {
      list.sort((a, b) => {
        const cmp = (a.placa || "").localeCompare(b.placa || "");
        return sortDirection === "asc" ? cmp : -cmp;
      });
    } else if (sortColumn === "cliente") {
      list.sort((a, b) => {
        const cmp = (a.cliente || "").localeCompare(b.cliente || "");
        return sortDirection === "asc" ? cmp : -cmp;
      });
    } else if (sortColumn === "flete") {
      list.sort((a, b) => {
        const diff = (a.flete_total_bs || 0) - (b.flete_total_bs || 0);
        return sortDirection === "asc" ? diff : -diff;
      });
    }

    return list;
  }, [editableRecords, tableFilter, tableSearch, sortColumn, sortDirection]);

  const handleSortToggle = (col: "fila" | "fecha" | "factura" | "placa" | "cliente" | "flete") => {
    if (sortColumn === col) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };

  // Confirmar Importación Definitiva a la Base de Datos
  const handleConfirmImport = async () => {
    if (includedRecords.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "Sin despachos seleccionados",
        text: "Debes marcar al menos un despacho para realizar la importación.",
        background: swalBg,
        color: swalColor,
        confirmButtonColor: "#f59e0b"
      });
      return;
    }

    if (dynamicSummary.incompletosCount > 0) {
      const incompletePrompt = await Swal.fire({
        icon: "warning",
        title: "Despachos Incompletos Detectados",
        html: `Hay <b>${dynamicSummary.incompletosCount}</b> despacho(s) marcados con datos incompletos (como falta de placa o volumen).<br/><br/><span class="text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}">Puedes completar la placa o volumen directamente en la tabla antes de importar. Las filas sin placa válida no se registrarán.</span>`,
        showCancelButton: true,
        confirmButtonText: "Importar de todos modos",
        cancelButtonText: "Volver y completar datos",
        confirmButtonColor: "#f59e0b",
        cancelButtonColor: swalCancelColor,
        background: swalBg,
        color: swalColor
      });
      if (!incompletePrompt.isConfirmed) return;
    }

    let targetDisplay = "";
    if (importType === "asociacion") {
      if (creatingNewAsoc) {
        if (!newAsocNombre.trim()) {
          Swal.fire({
            icon: "warning",
            title: "Nombre de Asociación requerido",
            text: "Por favor ingresa el nombre de la Asociación a crear.",
            confirmButtonColor: "#f59e0b",
            background: swalBg,
            color: swalColor
          });
          return;
        }
        targetDisplay = `Asociación '${newAsocNombre.trim()}' (Nueva)`;
      } else {
        const foundAsoc = asociaciones.find(a => String(a.id) === String(newEmpresaAsocId));
        if (!foundAsoc && !initialAsociacionId) {
          Swal.fire({
            icon: "warning",
            title: "Selecciona una Asociación",
            text: "Debes elegir una Asociación para vincular las empresas y despachos.",
            confirmButtonColor: "#f59e0b",
            background: swalBg,
            color: swalColor
          });
          return;
        }
        targetDisplay = `Asociación '${foundAsoc?.name || initialAsociacionName || "Asociación Seleccionada"}'`;
      }
    } else if (globalMode) {
      if (importMode === "create_new") {
        if (!newEmpresaName.trim()) {
          Swal.fire({
            icon: "warning",
            title: "Nombre de empresa requerido",
            text: "Por favor ingresa la Razón Social de la empresa a crear.",
            confirmButtonColor: "#f59e0b",
            background: swalBg,
            color: swalColor
          });
          return;
        }
        targetDisplay = `Crear Empresa '${newEmpresaName.trim()}'`;
      } else {
        const found = empresas.find(e => e.schema_name === selectedExistingSchema);
        if (!found) {
          Swal.fire({
            icon: "warning",
            title: "Selecciona una empresa",
            text: "Debes elegir una empresa de transporte existente.",
            confirmButtonColor: "#f59e0b",
            background: swalBg,
            color: swalColor
          });
          return;
        }
        targetDisplay = `Empresa existente '${found.name}'`;
      }
    }

    const totalNuevas = dynamicEmpresasSummary.filter(e => e.action === "crear").length;
    const totalReutilizadas = dynamicEmpresasSummary.filter(e => e.action === "reutilizar").length;

    let confirmHtml = `
      <div class="text-left text-xs space-y-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}">
        <p>Se importarán <b>${dynamicSummary.totalViajes}</b> despachos con un flete total de <b>${formatCurrency(dynamicSummary.totalFleteBs)}</b>.</p>
        <p class="${isDark ? 'text-amber-400' : 'text-amber-600'} font-semibold">• Modalidad: ${importType === "asociacion" ? "🏛️ Asociación (Multi-Empresa)" : "🏢 Empresa Individual"}</p>
        <p class="${isDark ? 'text-sky-400' : 'text-sky-600'} font-semibold">• Destino: ${targetDisplay || (schema ? `Empresa '${schema}'` : 'Directorio')}</p>
        ${importType === "asociacion" ? `
          <div class="p-2.5 ${isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'} rounded-xl border space-y-1 text-[11px]">
            <p class="${isDark ? 'text-white' : 'text-slate-900'} font-bold">• Empresas detectadas: <b>${dynamicEmpresasSummary.length}</b></p>
            <p class="${isDark ? 'text-emerald-400' : 'text-emerald-600'}">• Reutilizar empresas existentes: <b>${totalReutilizadas}</b></p>
            <p class="${isDark ? 'text-sky-400' : 'text-sky-600'}">• Crear nuevas empresas en la asociación: <b>${totalNuevas}</b></p>
          </div>
        ` : ''}
        <p>• Cisternas identificadas: <b>${dynamicSummary.totalPlacas}</b></p>
        <p>• Despachos listos: <b class="${isDark ? 'text-emerald-400' : 'text-emerald-600'}">${dynamicSummary.listosCount}</b></p>
        ${dynamicSummary.incompletosCount > 0 ? `<p class="${isDark ? 'text-amber-400' : 'text-amber-600'}">• Despachos incompletos: <b>${dynamicSummary.incompletosCount}</b></p>` : ''}
        <p>• Períodos: <b>${dynamicSummary.periodos.join(", ") || "General"}</b></p>
      </div>
    `;

    const confirmRes = await Swal.fire({
      title: "¿Confirmar e Importar al Sistema?",
      html: confirmHtml,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, ejecutar importación",
      cancelButtonText: "Seguir revisando",
      confirmButtonColor: "#10b981",
      cancelButtonColor: swalCancelColor,
      background: swalBg,
      color: swalColor
    });

    if (!confirmRes.isConfirmed) return;

    setIsImporting(true);
    try {
      const formPayload = new FormData();
      formPayload.append("edited_records_json", JSON.stringify(includedRecords));
      formPayload.append("entidades_clasificacion_json", JSON.stringify(entidadesClasificacion));

      let res: any;

      if (importType === "asociacion") {
        formPayload.append("mode", "asociacion");
        if (creatingNewAsoc && newAsocNombre.trim()) {
          formPayload.append("nueva_asociacion_nombre", newAsocNombre.trim());
          if (newAsocSigla.trim()) {
            formPayload.append("nueva_asociacion_sigla", newAsocSigla.trim().toUpperCase());
          }
        } else if (newEmpresaAsocId && newEmpresaAsocId !== "__create_new__") {
          formPayload.append("asociacion_id", String(newEmpresaAsocId));
        } else if (initialAsociacionId) {
          formPayload.append("asociacion_id", String(initialAsociacionId));
        }

        res = await apiFetch("/empresas/importar-con-empresa", {
          method: "POST",
          body: formPayload
        });
      } else if (globalMode) {
        formPayload.append("mode", importMode);
        if (importMode === "create_new") {
          formPayload.append("empresa_name", newEmpresaName.trim());
          formPayload.append("tipo_empresa", newEmpresaTipo);
          if (newEmpresaNit.trim()) formPayload.append("nit", newEmpresaNit.trim());
          if (creatingNewAsoc && newAsocNombre.trim()) {
            formPayload.append("nueva_asociacion_nombre", newAsocNombre.trim());
            if (newAsocSigla.trim()) {
              formPayload.append("nueva_asociacion_sigla", newAsocSigla.trim().toUpperCase());
            }
          } else if (newEmpresaAsocId && newEmpresaAsocId !== "__create_new__") {
            formPayload.append("asociacion_id", String(newEmpresaAsocId));
          }
        } else {
          formPayload.append("target_schema", selectedExistingSchema);
        }

        res = await apiFetch("/empresas/importar-con-empresa", {
          method: "POST",
          body: formPayload
        });
      } else {
        res = await apiFetch(`/tenants/${schema}/viajes/importar-excel`, {
          method: "POST",
          body: formPayload
        });
      }

      const finalSchema = res.target_schema || schema;
      const finalName = res.empresa_name || targetDisplay;

      let successDetailHtml = `
        <div class="space-y-3 text-left text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}">
          <p class="font-bold text-sm ${isDark ? 'text-emerald-400' : 'text-emerald-600'}">${res.message || "Despachos registrados correctamente en el sistema."}</p>
          <div class="p-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'} rounded-xl border space-y-1.5">
            ${res.asociacion_name ? `<div>• <b>Asociación:</b> <span class="${isDark ? 'text-amber-400' : 'text-amber-600'}">${res.asociacion_name}</span></div>` : ''}
            ${res.total_empresas_procesadas ? `<div>• <b>Empresas Procesadas:</b> ${res.total_empresas_procesadas} (${res.empresas_creadas || 0} creadas, ${res.empresas_reutilizadas || 0} reutilizadas)</div>` : ''}
            <div>• <b>Viajes Importados:</b> ${res.total_importados || res.total_viajes_importados || dynamicSummary.totalViajes}</div>
            <div>• <b>Cisternas Involucradas:</b> ${dynamicSummary.totalPlacas}</div>
            <div>• <b>Flete Total:</b> ${formatCurrency(dynamicSummary.totalFleteBs)}</div>
            <div>• <b>Períodos:</b> ${res.periodos_detectados?.join(", ") || "General"}</div>
          </div>
          ${Array.isArray(res.empresas_detalle) && res.empresas_detalle.length > 0 ? `
            <div class="max-h-40 overflow-y-auto space-y-1 pr-1">
              <span class="text-[10px] uppercase font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}">Desglose por Empresa:</span>
              ${res.empresas_detalle.map((ed: any) => `
                <div class="p-1.5 ${isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-white border-slate-200'} rounded-lg border flex items-center justify-between text-[11px]">
                  <span class="font-semibold ${isDark ? 'text-white' : 'text-slate-900'} truncate max-w-[180px]">${ed.empresa_name}</span>
                  <div class="flex items-center gap-2">
                    <span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${ed.accion === 'creada' ? (isDark ? 'bg-sky-500/20 text-sky-400' : 'bg-sky-100 text-sky-700 border border-sky-200') : (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700 border border-emerald-200')}">${ed.accion === 'creada' ? 'Nueva' : 'Reutilizada'}</span>
                    <span class="${isDark ? 'text-amber-400' : 'text-amber-600'} font-bold">${ed.total_viajes} viajes</span>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;

      const successModal = await Swal.fire({
        icon: "success",
        title: "¡Importación Exitosa!",
        html: successDetailHtml,
        showCancelButton: Boolean(finalSchema || res.asociacion_id),
        confirmButtonText: res.asociacion_id ? "Ver Asociación" : (finalSchema ? "Ir al Historial de Viajes" : "Entendido"),
        cancelButtonText: "Permanecer aquí",
        confirmButtonColor: "#10b981",
        cancelButtonColor: swalCancelColor,
        background: swalBg,
        color: swalColor
      });

      onSuccess({
        total_importados: res.total_importados || res.total_viajes_importados || dynamicSummary.totalViajes,
        total_actualizados: res.total_actualizados || res.total_viajes_actualizados || 0,
        total_omitidos: res.total_omitidos || 0,
        periodos_detectados: res.periodos_detectados || [],
        target_schema: finalSchema,
        empresa_name: finalName,
        asociacion_name: res.asociacion_name
      });

      onClose();

      if (successModal.isConfirmed) {
        if (res.asociacion_id) {
          router.push(`/asociacion/${res.asociacion_id}`);
        } else if (finalSchema) {
          router.push(`/${finalSchema}/historial`);
        }
      }
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al importar datos",
        text: err.message || "Ocurrió un error al guardar los viajes en la base de datos.",
        background: swalBg,
        color: swalColor,
        confirmButtonColor: "#f59e0b"
      });
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 dark:bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden text-slate-800 dark:text-slate-100">
          
          {/* Header del Modal */}
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white/95 dark:bg-slate-900/80 sticky top-0 z-20 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500/10 to-amber-500/10 dark:from-emerald-500/20 dark:to-amber-500/20 border border-emerald-500/20 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    Importación y Conciliación Inteligente de Despachos
                  </h3>
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                    {globalMode ? "Directorio Global" : `Empresa: ${schema}`}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Inspección, confirmación de acciones, edición en línea y conciliación de volúmenes y fletes.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={downloadBaseTemplate}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-semibold transition"
                title="Descargar plantilla Excel oficial limpia"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Plantilla Base</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Cuerpo del Modal con Scroll */}
          <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
            
            {/* Stepper Visual de 3 Pasos */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 text-xs font-semibold">
              <div className={`flex items-center gap-2 ${file ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-amber-600 dark:text-amber-400 font-bold"}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${file ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/40" : "bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-500/40"}`}>
                  {file ? "✓" : "1"}
                </span>
                <span>1. Archivo y Hojas</span>
              </div>
              <div className="w-8 h-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
              <div className={`flex items-center gap-2 ${previewData ? "text-emerald-600 dark:text-emerald-400 font-bold" : file ? "text-amber-600 dark:text-amber-400 font-bold" : "text-slate-400 dark:text-slate-500"}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${previewData ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/40" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700"}`}>
                  {previewData ? "✓" : "2"}
                </span>
                <span>2. Modalidad y Destino</span>
              </div>
              <div className="w-8 h-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
              <div className={`flex items-center gap-2 ${previewData ? "text-sky-600 dark:text-sky-400 font-bold" : "text-slate-400 dark:text-slate-500"}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${previewData ? "bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 border border-sky-300 dark:border-sky-500/40" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700"}`}>
                  3
                </span>
                <span>3. Revisión de Despachos</span>
              </div>
            </div>

            {/* Zona 1: Subir Archivo y Dropzone */}
            {!file ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? "border-emerald-500 bg-emerald-500/10 scale-[0.99]"
                    : "border-slate-300 dark:border-slate-700 hover:border-emerald-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/40 bg-slate-50/50 dark:bg-slate-900/40"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xlsm, .xltx"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                  Arrastra tu archivo Excel aquí o haz clic para examinar
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-4">
                  Compatible con <b>DRIVER S.R.L VENTAS.xlsx</b>, <b>PLANTILLA DE IMPORTACIÓN.xlsx</b> y formato oficial de 19/20 columnas.
                </p>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Formatos soportados: .xlsx, .xlsm
                </span>
              </div>
            ) : (
              /* Archivo Seleccionado + Selector de Hoja */
              <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{file.name}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                        ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                      </span>
                    </div>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Archivo analizado correctamente
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {sheets.length > 1 && (
                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-2.5 py-1.5 shadow-xs">
                      <Layers className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Hojas:</span>
                      <select
                        value={selectedSheet}
                        onChange={(e) => handleSheetChange(e.target.value)}
                        className="bg-transparent text-xs font-bold text-slate-800 dark:text-white focus:outline-none cursor-pointer"
                        disabled={isLoadingPreview || isImporting}
                      >
                        <option value="__ALL__" className="bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 font-bold">
                          📑 Todas las Hojas ({sheets.length} consolidadas)
                        </option>
                        {sheets.map((s) => (
                          <option key={s} value={s} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white">
                            📄 Hoja: {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setPreviewData(null);
                      setEditableRecords([]);
                      setSheets([]);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-rose-500/50 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-semibold transition"
                    disabled={isImporting}
                  >
                    Cambiar archivo
                  </button>
                </div>
              </div>
            )}

            {/* Desglose de Hojas Procesadas si hay más de 1 */}
            {previewData?.hojas_procesadas && previewData.hojas_procesadas.length > 1 && (
              <div className="p-3 bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/25 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-500 dark:text-sky-400 flex-shrink-0" />
                  <span className="text-slate-800 dark:text-slate-200 font-bold">Hojas y Años Consolidados:</span>
                  <span className="text-sky-700 dark:text-sky-300 font-mono font-bold">
                    {previewData.hojas_procesadas.length} hojas procesadas
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {previewData.hojas_procesadas.map((h, idx) => (
                    <span key={idx} className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900/90 border border-sky-200 dark:border-sky-500/30 text-sky-800 dark:text-sky-200 text-[11px] font-medium flex items-center gap-1.5 shadow-xs">
                      <span className="font-bold text-slate-900 dark:text-white">{h.hoja}</span>
                      <span className="text-sky-600 dark:text-sky-400 font-black">({h.viajes} despachos)</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Spinner de Análisis */}
            {isLoadingPreview && (
              <div className="py-12 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-emerald-500 dark:text-emerald-400 animate-spin mx-auto" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Analizando estructura, conciliando volúmenes y verificando calidad de datos...
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Lectura en flujo ultra-rápida sin sobrecarga de memoria.
                </p>
              </div>
            )}

            {/* PASO 2: MODALIDAD Y DESTINO DE IMPORTACIÓN */}
            {previewData && !isLoadingPreview && (
              <div className="space-y-4">
                {/* Selector de Modalidad de Importación */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-inner">
                  <button
                    type="button"
                    onClick={() => setImportType("empresa")}
                    className={`flex-1 flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl font-bold text-xs transition ${
                      importType === "empresa"
                        ? "bg-amber-500 text-white dark:text-slate-950 shadow-md font-black"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/80 dark:hover:bg-slate-900/50"
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>Importación por Empresa (Individual)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportType("asociacion")}
                    className={`flex-1 flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl font-bold text-xs transition ${
                      importType === "asociacion"
                        ? "bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 shadow-md font-black"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/80 dark:hover:bg-slate-900/50"
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    <span>Importación por Asociación (Multi-Empresa)</span>
                    {previewData?.is_multi_empresa && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 font-black uppercase">
                        {previewData.empresas_detectadas?.length || dynamicEmpresasSummary.length} Detectadas
                      </span>
                    )}
                  </button>
                </div>

                {/* Subzona A: Destino Modo Asociación (Multi-Empresa) */}
                {importType === "asociacion" ? (
                  <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50/50 via-slate-50 to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 border border-emerald-200 dark:border-emerald-500/30 shadow-lg space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs sm:text-sm">
                        <Layers className="w-4 h-4" />
                        <span>Asociación de Destino (Multi-Empresa)</span>
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Cada empresa se creará o reutilizará automáticamente bajo esta asociación gremial.
                      </span>
                    </div>

                    {/* Selector / Creación de Asociación */}
                    <div className="p-3 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          Asociación Matriz:
                        </label>
                        {!creatingNewAsoc ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCreatingNewAsoc(true);
                              setNewEmpresaAsocId("__create_new__");
                            }}
                            className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-bold flex items-center gap-1"
                          >
                            + Registrar Nueva Asociación
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setCreatingNewAsoc(false);
                              setNewEmpresaAsocId(asociaciones[0]?.id || "");
                            }}
                            className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 font-semibold"
                          >
                            Cancelar y elegir existente
                          </button>
                        )}
                      </div>

                      {creatingNewAsoc ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                          <div>
                            <input
                              type="text"
                              value={newAsocNombre}
                              onChange={(e) => setNewAsocNombre(e.target.value)}
                              placeholder="Nombre de la Nueva Asociación..."
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-emerald-300 dark:border-emerald-500/50 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <input
                              type="text"
                              value={newAsocSigla}
                              onChange={(e) => setNewAsocSigla(e.target.value)}
                              placeholder="Sigla (Opcional, ej: ATO)..."
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-emerald-300 dark:border-emerald-500/50 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 uppercase"
                            />
                          </div>
                        </div>
                      ) : (
                        <select
                          value={newEmpresaAsocId}
                          onChange={(e) => {
                            if (e.target.value === "__create_new__") {
                              setCreatingNewAsoc(true);
                              setNewEmpresaAsocId("__create_new__");
                            } else {
                              setNewEmpresaAsocId(e.target.value);
                            }
                          }}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-emerald-500"
                        >
                          {asociaciones.length === 0 ? (
                            <option value="">No hay asociaciones registradas (Registra una nueva)</option>
                          ) : (
                            asociaciones.map((a: any) => (
                              <option key={a.id} value={a.id}>
                                {a.sigla ? `[${a.sigla}] ` : ""}{a.name}
                              </option>
                            ))
                          )}
                          <option value="__create_new__" className="text-emerald-600 dark:text-emerald-400 font-bold">+ Registrar Nueva Asociación</option>
                        </select>
                      )}
                    </div>

                    {/* Empresas detectadas en formato compacto */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          Empresas detectadas en la planilla ({dynamicEmpresasSummary.length}):
                        </span>
                        <div className="flex items-center gap-2 text-[10px] font-bold">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                            {dynamicEmpresasSummary.filter(e => e.action === "reutilizar").length} Reutilizar
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30">
                            {dynamicEmpresasSummary.filter(e => e.action === "crear").length} Se crearán
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
                        {dynamicEmpresasSummary.map((emp, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl flex flex-col justify-between text-xs space-y-1 shadow-xs"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-slate-900 dark:text-white truncate text-[11px]" title={emp.nombre}>
                                {emp.nombre}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase flex-shrink-0 ${
                                emp.action === "reutilizar"
                                  ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30"
                                  : "bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30"
                              }`}>
                                {emp.action === "reutilizar" ? "Existente" : "+ Crear"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-900">
                              <span><b>{emp.totalViajes}</b> viajes</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{formatCurrency(emp.totalFleteBs)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Subzona B: Destino Modo Empresa Individual (Modo Global) */
                  globalMode && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-50/50 via-slate-50 to-amber-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 border border-amber-200 dark:border-amber-500/30 shadow-lg space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs sm:text-sm">
                          <Building2 className="w-4 h-4" />
                          <span>Destino de la Empresa Individual</span>
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Define dónde se almacenarán los despachos y unidades
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div
                          onClick={() => setImportMode("create_new")}
                          className={`p-3 rounded-xl border cursor-pointer transition ${
                            importMode === "create_new"
                              ? "border-amber-500 bg-amber-500/10 shadow-xs"
                              : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <input
                              type="radio"
                              checked={importMode === "create_new"}
                              onChange={() => setImportMode("create_new")}
                              className="text-amber-500 focus:ring-amber-500 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                            />
                            <span className="text-xs font-bold text-slate-900 dark:text-white">Crear Nueva Empresa Automáticamente</span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 pl-5">
                            Se registrará en el directorio y se inicializará su esquema en la base de datos.
                          </p>
                        </div>

                        <div
                          onClick={() => setImportMode("use_existing")}
                          className={`p-3 rounded-xl border cursor-pointer transition ${
                            importMode === "use_existing"
                              ? "border-emerald-500 bg-emerald-500/10 shadow-xs"
                              : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <input
                              type="radio"
                              checked={importMode === "use_existing"}
                              onChange={() => setImportMode("use_existing")}
                              className="text-emerald-500 focus:ring-emerald-500 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                            />
                            <span className="text-xs font-bold text-slate-900 dark:text-white">Asignar a Empresa Existente</span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 pl-5">
                            Incorpora estos viajes dentro de una empresa ya registrada en el sistema.
                          </p>
                        </div>
                      </div>

                      {importMode === "create_new" ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 border-t border-slate-200 dark:border-slate-800/80">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                              Razón Social *
                            </label>
                            <input
                              type="text"
                              value={newEmpresaName}
                              onChange={(e) => setNewEmpresaName(e.target.value)}
                              placeholder="Ej: DRIVER S.R.L."
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                              NIT (Opcional)
                            </label>
                            <input
                              type="text"
                              value={newEmpresaNit}
                              onChange={(e) => setNewEmpresaNit(e.target.value)}
                              placeholder="Ej: 1028495021"
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                Asociación / Gremio
                              </label>
                              {!creatingNewAsoc && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCreatingNewAsoc(true);
                                    setNewEmpresaAsocId("__create_new__");
                                  }}
                                  className="text-[10px] text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-bold"
                                >
                                  + Nueva Asoc.
                                </button>
                              )}
                            </div>
                            <select
                              value={newEmpresaAsocId}
                              onChange={(e) => {
                                if (e.target.value === "__create_new__") {
                                  setCreatingNewAsoc(true);
                                  setNewEmpresaAsocId("__create_new__");
                                } else {
                                  setNewEmpresaAsocId(e.target.value);
                                }
                              }}
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                            >
                              <option value="">Empresa Independiente</option>
                              <option value="__create_new__" className="text-amber-600 dark:text-amber-400 font-bold">+ Crear Nueva Asociación</option>
                              {asociaciones.map((a: any) => (
                                <option key={a.id} value={a.id}>
                                  {a.sigla ? `[${a.sigla}] ` : ""}{a.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-1 border-t border-slate-200 dark:border-slate-800/80">
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Selecciona la Empresa de Destino *
                          </label>
                          <select
                            value={selectedExistingSchema}
                            onChange={(e) => setSelectedExistingSchema(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                          >
                            {empresas.length === 0 ? (
                              <option value="">No hay empresas registradas</option>
                            ) : (
                              empresas.map((emp: any) => (
                                <option key={emp.id} value={emp.schema_name}>
                                  {emp.name} ({emp.schema_name})
                                </option>
                              ))
                            )}
                          </select>
                        </div>
                      )}
                    </div>
                  )
                )}

                {/* PASO 3: RESUMEN DE MÉTRICAS CLAVE (KPI STRIP) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 p-3 bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl">
                  {/* KPI 1: Despachos */}
                  <div className="p-2.5 bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 rounded-xl space-y-0.5 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase">
                      <span>Despachos</span>
                      <Layers className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                    </div>
                    <div className="text-lg font-black text-slate-900 dark:text-white">
                      {dynamicSummary.totalViajes}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">{dynamicSummary.listosCount} listos</span>
                      {dynamicSummary.incompletosCount > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 font-bold">• {dynamicSummary.incompletosCount} incompletos</span>
                      )}
                    </div>
                  </div>

                  {/* KPI 2: Destino */}
                  <div className="p-2.5 bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 rounded-xl space-y-0.5 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase">
                      <span>Destino</span>
                      {importType === "asociacion" ? <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Truck className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />}
                    </div>
                    <div className="text-xs font-black text-slate-900 dark:text-white truncate" title={importType === "asociacion" ? (creatingNewAsoc ? newAsocNombre : "Asociación") : (importMode === "create_new" ? newEmpresaName : selectedExistingSchema)}>
                      {importType === "asociacion" 
                        ? (creatingNewAsoc ? (newAsocNombre || "Nueva Asociación") : (asociaciones.find(a => String(a.id) === String(newEmpresaAsocId))?.name || initialAsociacionName || "Asociación"))
                        : (globalMode ? (importMode === "create_new" ? (newEmpresaName || "Nueva Empresa") : (empresas.find(e => e.schema_name === selectedExistingSchema)?.name || selectedExistingSchema)) : (schema || "Empresa Actual"))}
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                      {importType === "asociacion" ? `${dynamicEmpresasSummary.length} empresas vinculadas` : (importMode === "create_new" ? "Se creará automáticamente" : "Empresa existente")}
                    </span>
                  </div>

                  {/* KPI 3: Cisternas */}
                  <div className="p-2.5 bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 rounded-xl space-y-0.5 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase">
                      <span>Cisternas</span>
                      <Truck className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                    </div>
                    <div className="text-lg font-black text-slate-900 dark:text-white">
                      {dynamicSummary.totalPlacas}
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                      Placas únicas detectadas
                    </span>
                  </div>

                  {/* KPI 4: Volumen */}
                  <div className="p-2.5 bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 rounded-xl space-y-0.5 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase">
                      <span>Volumen Facturado</span>
                      <Scale className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                    </div>
                    <div className="text-base font-black text-sky-600 dark:text-sky-400 font-mono">
                      {formatNumber(dynamicSummary.totalVolumenLitros)} L
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">
                      {formatNumber(dynamicSummary.totalVolumenM3, 3)} m³
                    </span>
                  </div>

                  {/* KPI 5: Flete Total */}
                  <div className="p-2.5 bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 rounded-xl space-y-0.5 col-span-2 sm:col-span-1 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase">
                      <span>Flete Total</span>
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono truncate">
                      {formatCurrency(dynamicSummary.totalFleteBs)}
                    </div>
                    <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 block truncate">
                      {dynamicSummary.periodos.join(", ") || "Período general"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ZONA 4: TABLA DE PREVISUALIZACIÓN, CONCILIACIÓN Y CLASIFICACIÓN */}
            {previewData && !isLoadingPreview && (
              <div className="space-y-3">
                {/* Selector de sub-vistas */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-1.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-inner">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveReviewTab("records")}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                        activeReviewTab === "records"
                          ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-black border border-slate-200 dark:border-slate-700"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Layers className="w-4 h-4 text-emerald-500" />
                      <span>Despachos y Viajes ({editableRecords.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveReviewTab("facturas")}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                        activeReviewTab === "facturas"
                          ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-black border border-slate-200 dark:border-slate-700"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <FileSpreadsheet className="w-4 h-4 text-amber-500" />
                      <span>Conciliación de Facturas ({previewData.facturas_conciliacion?.length || 0})</span>
                      {previewData.summary?.facturas_cuadran_100 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                          ✓ 100% Cuadra
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveReviewTab("entidades")}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                        activeReviewTab === "entidades"
                          ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-black border border-slate-200 dark:border-slate-700"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Building2 className="w-4 h-4 text-sky-500" />
                      <span>Empresas y Clientes (Columna A)</span>
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-500/30">
                        {(previewData.empresas_detectadas?.length || 0) + (previewData.clientes_detectados?.length || 0)}
                      </span>
                    </button>
                  </div>
                </div>

                {/* SUBVISTA 1: TABLA DE DESPACHOS Y VIAJES */}
                {activeReviewTab === "records" && (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/60 space-y-3 p-3 sm:p-4 shadow-xs">
                    {/* Cabecera de la tabla y controles de filtro */}
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                      {/* Pestañas de estado */}
                      <div className="flex items-center bg-slate-100 dark:bg-slate-900/90 p-1 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto text-xs font-bold gap-1 shadow-xs">
                        <button
                          type="button"
                          onClick={() => setTableFilter("all")}
                          className={`px-3 py-1.5 rounded-lg transition ${
                            tableFilter === "all" ? "bg-amber-500 text-slate-950 shadow-xs font-black" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                          }`}
                        >
                          Todos ({editableRecords.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setTableFilter("ready")}
                          className={`px-3 py-1.5 rounded-lg transition ${
                            tableFilter === "ready" ? "bg-emerald-500 text-slate-950 shadow-xs font-black" : "text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                          }`}
                        >
                          Listos ({dynamicSummary.listosCount})
                        </button>
                        {dynamicSummary.incompletosCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setTableFilter("incomplete")}
                            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                              tableFilter === "incomplete" ? "bg-amber-500 text-slate-950 shadow-xs font-black" : "text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
                            }`}
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Incompletos ({dynamicSummary.incompletosCount})
                          </button>
                        )}
                      </div>

                      {/* Acciones Rápidas y Buscador en tabla */}
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="relative flex-1 sm:w-56">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={tableSearch}
                            onChange={(e) => setTableSearch(e.target.value)}
                            placeholder="Buscar placa, cliente, tramo o factura..."
                            className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 shadow-xs"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleAllRecords(true)}
                          className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold transition shadow-xs"
                        >
                          Marcar Todos
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleAllRecords(false)}
                          className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-semibold transition shadow-xs"
                        >
                          Desmarcar Todos
                        </button>
                        {dynamicSummary.incompletosCount > 0 && (
                          <button
                            type="button"
                            onClick={selectOnlyReady}
                            className="px-2.5 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold transition shadow-xs"
                            title="Seleccionar solo los despachos con todos los datos completos"
                          >
                            Solo Listos
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Barra de Métodos de Ordenamiento Intuitivo */}
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] shadow-2xs">
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-bold">
                        <ArrowDownUp className="w-3.5 h-3.5 text-amber-500" />
                        <span>Ordenar Previsualización:</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* Fecha */}
                        <button
                          type="button"
                          onClick={() => handleSortToggle("fecha")}
                          className={`px-2.5 py-1 rounded-lg border font-bold flex items-center gap-1 transition ${
                            sortColumn === "fecha"
                              ? "bg-amber-500 text-slate-950 border-amber-500 shadow-2xs"
                              : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-400"
                          }`}
                          title="Ordenar por fecha de carga/despacho (Enero a Diciembre o viceversa)"
                        >
                          <Calendar className="w-3 h-3" />
                          <span>Fecha {sortColumn === "fecha" ? (sortDirection === "asc" ? "↑ (Ene → Dic)" : "↓ (Dic → Ene)") : "(Ene ↔ Dic)"}</span>
                        </button>

                        {/* N° Factura */}
                        <button
                          type="button"
                          onClick={() => handleSortToggle("factura")}
                          className={`px-2.5 py-1 rounded-lg border font-bold flex items-center gap-1 transition ${
                            sortColumn === "factura"
                              ? "bg-amber-500 text-slate-950 border-amber-500 shadow-2xs"
                              : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-400"
                          }`}
                          title="Ordenar correlativamente por número de factura"
                        >
                          <FileText className="w-3 h-3" />
                          <span>N° Factura {sortColumn === "factura" ? (sortDirection === "asc" ? "↑ (Menor → Mayor)" : "↓ (Mayor → Menor)") : ""}</span>
                        </button>

                        {/* Placa */}
                        <button
                          type="button"
                          onClick={() => handleSortToggle("placa")}
                          className={`px-2.5 py-1 rounded-lg border font-bold flex items-center gap-1 transition ${
                            sortColumn === "placa"
                              ? "bg-amber-500 text-slate-950 border-amber-500 shadow-2xs"
                              : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-400"
                          }`}
                          title="Ordenar alfabéticamente por placa"
                        >
                          <Truck className="w-3 h-3" />
                          <span>Placa {sortColumn === "placa" ? (sortDirection === "asc" ? "↑ (A → Z)" : "↓ (Z → A)") : ""}</span>
                        </button>

                        {/* Cliente */}
                        <button
                          type="button"
                          onClick={() => handleSortToggle("cliente")}
                          className={`px-2.5 py-1 rounded-lg border font-bold flex items-center gap-1 transition ${
                            sortColumn === "cliente"
                              ? "bg-amber-500 text-slate-950 border-amber-500 shadow-2xs"
                              : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-400"
                          }`}
                          title="Ordenar alfabéticamente por cliente receptor"
                        >
                          <Building2 className="w-3 h-3" />
                          <span>Cliente {sortColumn === "cliente" ? (sortDirection === "asc" ? "↑ (A → Z)" : "↓ (Z → A)") : ""}</span>
                        </button>

                        {/* Restablecer orden original */}
                        {sortColumn !== "fila" && (
                          <button
                            type="button"
                            onClick={() => {
                              setSortColumn("fila");
                              setSortDirection("asc");
                            }}
                            className="px-2 py-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition flex items-center gap-1"
                            title="Restablecer al orden original de filas del archivo Excel"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Orden Original</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Tabla Interactiva Responsive */}
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto max-h-96 shadow-xs">
                      <table className="w-full text-[11px] text-left border-collapse">
                        <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3 text-center w-10">
                              <input
                                type="checkbox"
                                checked={includedRecords.length === editableRecords.length && editableRecords.length > 0}
                                onChange={(e) => toggleAllRecords(e.target.checked)}
                                className="rounded bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-emerald-600 dark:text-emerald-500 cursor-pointer"
                              />
                            </th>
                            <th onClick={() => handleSortToggle("fila")} className="py-2.5 px-2 text-center w-12 cursor-pointer hover:text-amber-500 transition select-none" title="Ordenar por fila original">
                              <div className="flex items-center justify-center gap-1">
                                <span>#</span>
                                {sortColumn === "fila" && (sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-amber-500" /> : <ArrowDown className="w-3 h-3 text-amber-500" />)}
                              </div>
                            </th>
                            {(importType === "asociacion" || editableRecords.some(x => x.empresa)) && (
                              <th className="py-2.5 px-3 min-w-[150px] text-emerald-600 dark:text-emerald-400">Empresa (Editable)</th>
                            )}
                            <th onClick={() => handleSortToggle("placa")} className="py-2.5 px-3 min-w-[130px] cursor-pointer hover:text-amber-500 transition select-none" title="Clic para ordenar por Placa">
                              <div className="flex items-center gap-1">
                                <span>Placa (Editable)</span>
                                {sortColumn === "placa" ? (sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-amber-500" /> : <ArrowDown className="w-3 h-3 text-amber-500" />) : <ArrowUpDown className="w-2.5 h-2.5 text-slate-400" />}
                              </div>
                            </th>
                            <th onClick={() => handleSortToggle("cliente")} className="py-2.5 px-3 min-w-[150px] text-sky-600 dark:text-sky-400 cursor-pointer hover:text-amber-500 transition select-none" title="Clic para ordenar por Cliente">
                              <div className="flex items-center gap-1">
                                <span>Cliente (Editable)</span>
                                {sortColumn === "cliente" ? (sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-amber-500" /> : <ArrowDown className="w-3 h-3 text-amber-500" />) : <ArrowUpDown className="w-2.5 h-2.5 text-slate-400" />}
                              </div>
                            </th>
                            <th className="py-2.5 px-3 min-w-[160px]">Tramo</th>
                            <th className="py-2.5 px-3 min-w-[120px]">Producto</th>
                            <th onClick={() => handleSortToggle("fecha")} className="py-2.5 px-3 whitespace-nowrap cursor-pointer hover:text-amber-500 transition select-none" title="Clic para ordenar por Fechas (Ene a Dic)">
                              <div className="flex items-center gap-1">
                                <span>Fechas</span>
                                {sortColumn === "fecha" ? (sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-amber-500" /> : <ArrowDown className="w-3 h-3 text-amber-500" />) : <ArrowUpDown className="w-2.5 h-2.5 text-slate-400" />}
                              </div>
                            </th>
                            <th className="py-2.5 px-3 text-right min-w-[120px]">Volumen (L / m³)</th>
                            <th className="py-2.5 px-3 text-right min-w-[110px]">Tarifa (Bs/m³)</th>
                            <th onClick={() => handleSortToggle("flete")} className="py-2.5 px-3 text-right cursor-pointer hover:text-amber-500 transition select-none" title="Clic para ordenar por Flete Total">
                              <div className="flex items-center justify-end gap-1">
                                <span>Flete Total (Bs)</span>
                                {sortColumn === "flete" ? (sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-amber-500" /> : <ArrowDown className="w-3 h-3 text-amber-500" />) : <ArrowUpDown className="w-2.5 h-2.5 text-slate-400" />}
                              </div>
                            </th>
                            <th onClick={() => handleSortToggle("factura")} className="py-2.5 px-3 min-w-[130px] cursor-pointer hover:text-amber-500 transition select-none" title="Clic para ordenar por N° de Factura">
                              <div className="flex items-center gap-1">
                                <span>Factura / MIC</span>
                                {sortColumn === "factura" ? (sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-amber-500" /> : <ArrowDown className="w-3 h-3 text-amber-500" />) : <ArrowUpDown className="w-2.5 h-2.5 text-slate-400" />}
                              </div>
                            </th>
                            <th className="py-2.5 px-3 text-center">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium bg-white dark:bg-slate-950/40">
                          {filteredRecords.length === 0 ? (
                            <tr>
                              <td colSpan={(importType === "asociacion" || editableRecords.some(x => x.empresa)) ? 13 : 12} className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                                No hay despachos para mostrar con el filtro actual.
                              </td>
                            </tr>
                          ) : (
                            filteredRecords.map((r) => {
                              const originalIdx = editableRecords.findIndex(x => x.fila === r.fila);
                              const cleanP = (r.placa || "").trim().toUpperCase().replace(/\s+/g, "");
                              const isSinPlaca = cleanP === "SINPLACA" || cleanP === "SIN_PLACA" || cleanP === "S/P" || cleanP === "SIN PLACA";
                              const isMissingPlaca = !cleanP || ["FALTAPLACA", "TOTAL", "SUBTOTAL", "NONE"].includes(cleanP);
                              const isMissingVolAndFlete = (r.volumen_facturado || 0) <= 0 && (r.flete_total_bs || 0) <= 0;
                              const isMissingTramo = !r.tramo || r.tramo.trim() === "";
                              const isIncomplete = r.is_incompleto || r.status === "INCOMPLETO" || isMissingPlaca || isMissingVolAndFlete || isMissingTramo;

                              return (
                                <tr
                                  key={r.fila}
                                  className={`transition ${
                                    !r.included
                                      ? "opacity-40 bg-slate-100/50 dark:bg-slate-950/40"
                                      : isIncomplete
                                      ? "bg-amber-500/[0.06] hover:bg-amber-500/[0.12] dark:bg-amber-500/[0.04] dark:hover:bg-amber-500/[0.08]"
                                      : "hover:bg-slate-50 dark:hover:bg-slate-800/30"
                                  }`}
                                >
                                  {/* Checkbox de Inclusión */}
                                  <td className="py-2 px-3 text-center">
                                    <input
                                      type="checkbox"
                                      checked={r.included !== false}
                                      onChange={(e) => handleRecordFieldChange(originalIdx, "included", e.target.checked)}
                                      className="rounded bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-emerald-600 dark:text-emerald-500 cursor-pointer"
                                    />
                                  </td>

                                  {/* Fila */}
                                  <td className="py-2 px-2 text-center text-slate-400 dark:text-slate-500 font-mono">
                                    <div className="font-bold">{r.fila}</div>
                                    {r.hoja && (
                                      <span className="inline-block text-[8px] px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-sky-700 dark:text-sky-300 border border-slate-200 dark:border-slate-700 font-mono mt-0.5 whitespace-nowrap max-w-[80px] truncate" title={`Hoja original: ${r.hoja}`}>
                                        {r.hoja}
                                      </span>
                                    )}
                                  </td>

                                  {/* Empresa Editable */}
                                  {(importType === "asociacion" || editableRecords.some(x => x.empresa)) && (
                                    <td className="py-1.5 px-2 min-w-[150px]">
                                      <input
                                        type="text"
                                        value={r.empresa || ""}
                                        onChange={(e) => handleRecordFieldChange(originalIdx, "empresa", e.target.value)}
                                        placeholder="Empresa..."
                                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] uppercase focus:outline-none focus:border-emerald-500 truncate"
                                        title={r.empresa}
                                      />
                                    </td>
                                  )}

                                  {/* Placa Editable */}
                                  <td className="py-1.5 px-2 min-w-[120px]">
                                    <div className="relative">
                                      <input
                                        type="text"
                                        value={r.placa || ""}
                                        onChange={(e) => handleRecordFieldChange(originalIdx, "placa", e.target.value)}
                                        placeholder="Placa..."
                                        className={`w-full px-2 py-1 bg-white dark:bg-slate-900 border rounded-lg font-mono font-bold text-xs uppercase focus:outline-none transition ${
                                          isMissingPlaca
                                            ? "border-rose-400 dark:border-rose-500 text-rose-600 dark:text-rose-300 placeholder-rose-400/50 bg-rose-50 dark:bg-rose-500/10 focus:border-rose-500"
                                            : isSinPlaca
                                            ? "border-sky-300 dark:border-sky-500/40 text-sky-700 dark:text-sky-300 bg-sky-50/50 dark:bg-sky-500/10 focus:border-sky-500"
                                            : r.isEdited
                                            ? "border-emerald-400 dark:border-emerald-500 text-emerald-700 dark:text-emerald-300 focus:border-emerald-500"
                                            : "border-slate-200 dark:border-slate-700 text-amber-600 dark:text-amber-300 focus:border-amber-500"
                                        }`}
                                      />
                                      {isSinPlaca && (
                                        <span className="block text-[9px] text-sky-600 dark:text-sky-400 font-bold mt-0.5">
                                          📦 Carga Gral / Sin Placa
                                        </span>
                                      )}
                                      {isMissingPlaca && (
                                        <span className="block text-[9px] text-rose-600 dark:text-rose-400 font-bold mt-0.5">
                                          Falta Placa
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  {/* Cliente Editable */}
                                  <td className="py-1.5 px-2 min-w-[140px]">
                                    <input
                                      type="text"
                                      value={r.cliente || ""}
                                      onChange={(e) => handleRecordFieldChange(originalIdx, "cliente", e.target.value)}
                                      placeholder="Cliente (ej: YPFB)..."
                                      className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg text-sky-700 dark:text-sky-300 font-semibold text-[11px] uppercase focus:outline-none focus:border-sky-500 truncate"
                                      title={r.cliente}
                                    />
                                  </td>

                                  {/* Tramo Editable */}
                                  <td className="py-1.5 px-2">
                                    <input
                                      type="text"
                                      value={r.tramo || ""}
                                      onChange={(e) => handleRecordFieldChange(originalIdx, "tramo", e.target.value)}
                                      className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg text-slate-800 dark:text-slate-200 text-[11px] focus:outline-none focus:border-amber-500 truncate"
                                      title={r.tramo}
                                    />
                                  </td>

                                  {/* Producto Editable */}
                                  <td className="py-1.5 px-2 min-w-[120px]">
                                    <input
                                      type="text"
                                      value={r.producto || ""}
                                      onChange={(e) => handleRecordFieldChange(originalIdx, "producto", e.target.value)}
                                      placeholder="Producto..."
                                      className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg text-slate-800 dark:text-slate-200 text-[11px] font-bold uppercase focus:outline-none focus:border-amber-500 truncate"
                                      title={r.producto}
                                    />
                                  </td>

                                  {/* Fechas */}
                                  <td className="py-2 px-3 whitespace-nowrap font-mono text-[10px] text-slate-500 dark:text-slate-400">
                                    {r.fecha_carga} → {r.fecha_descarga}
                                  </td>

                                  {/* Volumen Facturado Editable (Litros) */}
                                  <td className="py-1.5 px-2 text-right">
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={r.volumen_facturado || ""}
                                      onChange={(e) => handleRecordFieldChange(originalIdx, "volumen_facturado", e.target.value)}
                                      className="w-24 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg text-right font-mono font-bold text-sky-600 dark:text-sky-400 text-xs focus:outline-none focus:border-sky-500"
                                    />
                                    <span className="block text-[9px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                                      {formatNumber(r.volumen_facturado_m3, 3)} m³
                                    </span>
                                  </td>

                                  {/* Tarifa Editable */}
                                  <td className="py-1.5 px-2 text-right">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={r.tarifa_flete || ""}
                                      onChange={(e) => handleRecordFieldChange(originalIdx, "tarifa_flete", e.target.value)}
                                      className="w-20 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg text-right font-mono text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:border-amber-500"
                                    />
                                  </td>

                                  {/* Flete Total Calculado */}
                                  <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                    {formatCurrency(r.flete_total_bs)}
                                  </td>

                                  {/* Factura / MIC Editable */}
                                  <td className="py-1.5 px-2 whitespace-nowrap">
                                    <input
                                      type="text"
                                      value={r.nro_factura || ""}
                                      onChange={(e) => handleRecordFieldChange(originalIdx, "nro_factura", e.target.value)}
                                      placeholder="FAC Nro..."
                                      className="w-24 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg text-amber-600 dark:text-amber-300 font-mono text-[10px] focus:outline-none focus:border-amber-500"
                                    />
                                    {r.mic_dta && (
                                      <span className="block font-mono text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
                                        MIC: {r.mic_dta}
                                      </span>
                                    )}
                                  </td>

                                  {/* Estado */}
                                  <td className="py-2 px-3 text-center whitespace-nowrap">
                                    {isIncomplete ? (
                                      <div className="flex flex-col items-center">
                                        <span
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30"
                                          title={r.incompleto_reason || (isMissingPlaca ? "Falta placa del camión" : isMissingVolAndFlete ? "Volumen e importe en 0" : "Datos incompletos")}
                                        >
                                          <AlertTriangle className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                                          Incompleto
                                        </span>
                                        <span className="text-[9px] text-amber-600/90 dark:text-amber-400/80 mt-0.5 font-medium">
                                          {r.incompleto_reason || (isMissingPlaca ? "Falta Placa" : isMissingVolAndFlete ? "Volumen 0" : "Dato faltante")}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                        Listo
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* SUBVISTA 2: CONCILIACIÓN DE FACTURAS */}
                {activeReviewTab === "facturas" && (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-950 p-4 space-y-4 shadow-xs">
                    {/* Banner de Conciliación */}
                    {previewData.summary?.facturas_cuadran_100 ? (
                      <div className="p-3.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-emerald-900 dark:text-emerald-300 uppercase tracking-tight">
                            Cuadre Matemático 100% Verificado
                          </h4>
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                            Las <b>{previewData.facturas_conciliacion?.length || 0}</b> facturas de la planilla coinciden exactamente (0.00 Bs de diferencia) entre la sumatoria de sus despachos individuales y las filas de subtotales del Excel.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-amber-900 dark:text-amber-300 uppercase tracking-tight">
                            Atención: Diferencias Detectadas en Subtotales
                          </h4>
                          <p className="text-[11px] text-amber-700 dark:text-amber-400">
                            Algunas facturas presentan discrepancias entre la suma de despachos y el subtotal de la fila del Excel. Revisa el detalle a continuación:
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Tabla de Facturas Conciliadas */}
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto max-h-96">
                      <table className="w-full text-[11px] text-left border-collapse">
                        <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">N° Factura</th>
                            <th className="py-2.5 px-3">Fecha Factura</th>
                            <th className="py-2.5 px-3">Cliente Receptor</th>
                            <th className="py-2.5 px-3">Empresa / Transportista</th>
                            <th className="py-2.5 px-3 text-center">Despachos</th>
                            <th className="py-2.5 px-3 text-right">Volumen (m³)</th>
                            <th className="py-2.5 px-3 text-right">Suma Viajes (Bs)</th>
                            <th className="py-2.5 px-3 text-right">Subtotal en Excel (Bs)</th>
                            <th className="py-2.5 px-3 text-right">Diferencia</th>
                            <th className="py-2.5 px-3 text-center">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                          {(!previewData.facturas_conciliacion || previewData.facturas_conciliacion.length === 0) ? (
                            <tr>
                              <td colSpan={10} className="py-8 text-center text-slate-400 text-xs">
                                No se identificaron números de factura en la planilla para conciliar.
                              </td>
                            </tr>
                          ) : (
                            previewData.facturas_conciliacion.map((fac, idx) => (
                              <tr
                                key={idx}
                                className={`transition ${
                                  fac.cuadra
                                    ? "hover:bg-slate-50 dark:hover:bg-slate-900/50"
                                    : "bg-amber-500/[0.08] hover:bg-amber-500/[0.14]"
                                }`}
                              >
                                <td className="py-2 px-3 font-mono font-bold text-amber-600 dark:text-amber-400">
                                  {fac.nro_factura}
                                </td>
                                <td className="py-2 px-3 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                                  {fac.fecha_factura || "—"}
                                </td>
                                <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white truncate max-w-[160px]" title={fac.cliente}>
                                  {fac.cliente || "YPFB"}
                                </td>
                                <td className="py-2 px-3 text-emerald-600 dark:text-emerald-400 font-medium truncate max-w-[160px]" title={fac.empresa}>
                                  {fac.empresa || "—"}
                                </td>
                                <td className="py-2 px-3 text-center font-bold">
                                  {fac.total_viajes}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-sky-600 dark:text-sky-400 font-bold">
                                  {formatNumber(fac.total_volumen_m3, 3)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                  {formatCurrency(fac.total_importe_bs)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                                  {formatCurrency(fac.subtotal_excel_bs)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono">
                                  {fac.diferencia_bs === 0 ? (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">0.00 Bs</span>
                                  ) : (
                                    <span className="text-amber-600 dark:text-amber-400 font-black">
                                      {formatCurrency(fac.diferencia_bs)}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  {fac.cuadra ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                      Cuadra 100%
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
                                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                                      Diferencia
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* SUBVISTA 3: CLASIFICACIÓN DE ENTIDADES (EMPRESA VS CLIENTE) */}
                {activeReviewTab === "entidades" && (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-950 p-4 space-y-4 shadow-xs">
                    {/* Explicación */}
                    <div className="p-3.5 bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 rounded-xl space-y-1">
                      <div className="flex items-center gap-2 text-sky-800 dark:text-sky-300 font-bold text-xs">
                        <Building2 className="w-4 h-4 text-sky-500" />
                        <span>Clasificación Inteligente de la Columna A (Empresa de Transporte / Cliente)</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        La planilla original suele contener tanto <b>Empresas de Transporte</b> (operadores/transportistas) como <b>Clientes</b> (empresas a quienes se les brindó el servicio de flete, ej: YPFB, Industrias de Aceite S.A.). Aquí puedes confirmar o cambiar el rol de cada entidad antes de importar:
                      </p>
                    </div>

                    {/* Grid de Entidades Detectadas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                      {/* Lista unificada de todas las entidades encontradas */}
                      {(() => {
                        const allEntities: Array<{
                          nombre: string;
                          tipo_original: "empresa" | "cliente";
                          total_viajes: number;
                          total_volumen_m3: number;
                          total_flete_bs: number;
                        }> = [];

                        if (previewData.empresas_detectadas) {
                          previewData.empresas_detectadas.forEach(e => {
                            allEntities.push({
                              nombre: e.nombre,
                              tipo_original: "empresa",
                              total_viajes: e.total_viajes,
                              total_volumen_m3: e.total_volumen_m3,
                              total_flete_bs: e.total_flete_bs
                            });
                          });
                        }
                        if (previewData.clientes_detectados) {
                          previewData.clientes_detectados.forEach(c => {
                            if (!allEntities.some(x => x.nombre.toUpperCase() === c.nombre.toUpperCase())) {
                              allEntities.push({
                                nombre: c.nombre,
                                tipo_original: "cliente",
                                total_viajes: c.total_viajes,
                                total_volumen_m3: c.total_volumen_m3,
                                total_flete_bs: c.total_flete_bs
                              });
                            }
                          });
                        }

                        if (allEntities.length === 0) {
                          return (
                            <div className="col-span-2 py-8 text-center text-slate-400 text-xs">
                              No se encontraron entidades diferenciadas en la Columna A.
                            </div>
                          );
                        }

                        return allEntities.map((ent, idx) => {
                          const currentTipo = entidadesClasificacion[ent.nombre] || ent.tipo_original;
                          return (
                            <div
                              key={idx}
                              className={`p-3.5 rounded-2xl border transition space-y-2.5 ${
                                currentTipo === "cliente"
                                  ? "bg-sky-500/[0.04] border-sky-300 dark:border-sky-500/40"
                                  : "bg-emerald-500/[0.04] border-emerald-300 dark:border-emerald-500/40"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h5 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                    {ent.nombre}
                                  </h5>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                                    <span><b>{ent.total_viajes}</b> viajes</span>
                                    <span>•</span>
                                    <span><b>{formatNumber(ent.total_volumen_m3, 3)}</b> m³</span>
                                    <span>•</span>
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">{formatCurrency(ent.total_flete_bs)}</span>
                                  </div>
                                </div>

                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                  currentTipo === "cliente"
                                    ? "bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-500/30"
                                    : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30"
                                }`}>
                                  {currentTipo === "cliente" ? "🤝 Cliente" : "🏢 Empresa"}
                                </span>
                              </div>

                              {/* Selector Toggle de Rol */}
                              <div className="flex items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                                <button
                                  type="button"
                                  onClick={() => handleToggleEntityClassification(ent.nombre, "empresa")}
                                  className={`flex-1 py-1.5 px-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition ${
                                    currentTipo === "empresa"
                                      ? "bg-emerald-600 text-white shadow-xs font-black"
                                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                  }`}
                                >
                                  <Building2 className="w-3.5 h-3.5" />
                                  <span>Empresa Transporte</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleToggleEntityClassification(ent.nombre, "cliente")}
                                  className={`flex-1 py-1.5 px-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition ${
                                    currentTipo === "cliente"
                                      ? "bg-sky-600 text-white shadow-xs font-black"
                                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                  }`}
                                >
                                  <Truck className="w-3.5 h-3.5" />
                                  <span>Cliente del Servicio</span>
                                </button>
                              </div>

                              <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                                {currentTipo === "cliente"
                                  ? "Se registrará en el catálogo de clientes del sistema y se asignará como receptor en los despachos."
                                  : "Se registrará o asociará como empresa transportista operadora para la liquidación."}
                              </p>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer con Acciones */}
          <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sticky bottom-0 z-20 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition"
                disabled={isImporting}
              >
                Cancelar
              </button>
              
              {editableRecords.length > 0 && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  <b>{dynamicSummary.totalViajes}</b> de <b>{editableRecords.length}</b> despachos seleccionados
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {previewData && (
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={isImporting || dynamicSummary.totalViajes === 0}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Registrando despachos en el sistema...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>
                        Confirmar e Importar {dynamicSummary.totalViajes} Despachos
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </ModalPortal>
  );
}
