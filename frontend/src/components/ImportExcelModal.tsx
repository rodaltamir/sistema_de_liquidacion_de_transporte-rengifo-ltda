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
  Square
} from "lucide-react";
import Swal from "sweetalert2";
import ModalPortal from "@/components/ModalPortal";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatNumber, formatDate } from "@/lib/format";
import { downloadBlob } from "@/lib/download";

export interface EmpresaDetectada {
  nombre: string;
  action: "reutilizar" | "crear";
  empresa_id?: number | null;
  schema_name: string;
  already_in_asociacion: boolean;
  total_viajes: number;
  viajes_listos: number;
  viajes_incompletos: number;
  total_volumen_litros: number;
  total_volumen_m3: number;
  total_flete_bs: number;
  cisternas_count: number;
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
  empresa?: string;
  placa: string;
  tramo: string;
  cliente: string;
  producto: string;
  fecha_carga: string;
  fecha_descarga: string;
  fecha_factura?: string | null;
  nro_factura?: string | null;
  mic_dta?: string | null;
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
  motivo: string;
}

interface PreviewResponse {
  success: boolean;
  sheets: string[];
  selected_sheet: string;
  header_row: number;
  total_valid_rows: number;
  total_skipped_rows: number;
  records: PreviewRecord[];
  skipped_details: SkippedDetail[];
  suggested_company_name?: string;
  is_multi_empresa?: boolean;
  empresas_detectadas?: EmpresaDetectada[];
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
  
  // Registros interactivos editables
  const [editableRecords, setEditableRecords] = useState<PreviewRecord[]>([]);
  const [showSkipped, setShowSkipped] = useState(false);
  const [tableFilter, setTableFilter] = useState<"all" | "ready" | "incomplete">("all");
  const [tableSearch, setTableSearch] = useState("");

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
      setIsLoadingPreview(false);
      setIsImporting(false);
      setShowSkipped(false);
      setTableFilter("all");
      setTableSearch("");
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
        background: "#0f172a",
        color: "#f8fafc",
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
          const reversed = [...infoRes.sheets].reverse();
          const preferred = reversed.find((s: string) => s.includes("2026")) ||
                          reversed.find((s: string) => s.includes("2025")) ||
                          infoRes.default_sheet;
          targetSheet = preferred || infoRes.sheets[0];
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

      if (globalMode && res?.suggested_company_name && !newEmpresaName) {
        setNewEmpresaName(res.suggested_company_name);
      }
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al procesar Excel",
        text: err.message || "No se pudo interpretar la estructura del archivo.",
        background: "#0f172a",
        color: "#f8fafc",
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
        background: "#0f172a",
        color: "#f8fafc"
      });
    }
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
      const isMissingPlaca = !cleanP || ["SINPLACA", "FALTAPLACA", "TOTAL", "SUBTOTAL", "NONE"].includes(cleanP);
      const isMissingVol = (r.volumen_facturado || 0) <= 0;
      const isMissingTramo = !r.tramo || r.tramo.trim() === "";

      if (isMissingPlaca) {
        r.is_incompleto = true;
        r.incompleto_reason = "Falta placa del camión";
        r.status = "INCOMPLETO";
      } else if (isMissingVol) {
        r.is_incompleto = true;
        r.incompleto_reason = "Volumen debe ser mayor a 0";
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
      const isMissingPlaca = !cleanP || ["SINPLACA", "FALTAPLACA", "TOTAL", "SUBTOTAL", "NONE"].includes(cleanP);
      const isMissingVol = (r.volumen_facturado || 0) <= 0;
      const isIncomplete = r.is_incompleto || r.status === "INCOMPLETO" || isMissingPlaca || isMissingVol;
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
      const isMissingP = !cleanP || ["SINPLACA", "FALTAPLACA", "TOTAL", "SUBTOTAL", "NONE"].includes(cleanP);
      const isMissingVol = (r.volumen_facturado || 0) <= 0;

      if (isMissingP) {
        missingPlacas++;
      } else {
        placas.add(cleanP);
      }

      if (r.is_incompleto || r.status === "INCOMPLETO" || isMissingP || isMissingVol) {
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

  // Filtro de la tabla
  const filteredRecords = useMemo(() => {
    return editableRecords.filter((r) => {
      const cleanP = (r.placa || "").trim().toUpperCase().replace(/\s+/g, "");
      const isMissingP = !cleanP || ["SINPLACA", "FALTAPLACA", "TOTAL", "SUBTOTAL", "NONE"].includes(cleanP);
      const isMissingVol = (r.volumen_facturado || 0) <= 0;
      const isIncomplete = r.is_incompleto || r.status === "INCOMPLETO" || isMissingP || isMissingVol;

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
  }, [editableRecords, tableFilter, tableSearch]);

  // Confirmar Importación Definitiva a la Base de Datos
  const handleConfirmImport = async () => {
    if (includedRecords.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "Sin despachos seleccionados",
        text: "Debes marcar al menos un despacho para realizar la importación.",
        background: "#0f172a",
        color: "#f8fafc",
        confirmButtonColor: "#f59e0b"
      });
      return;
    }

    if (dynamicSummary.incompletosCount > 0) {
      const incompletePrompt = await Swal.fire({
        icon: "warning",
        title: "Despachos Incompletos Detectados",
        html: `Hay <b>${dynamicSummary.incompletosCount}</b> despacho(s) marcados con datos incompletos (como falta de placa o volumen).<br/><br/><span class="text-xs text-slate-400">Puedes completar la placa o volumen directamente en la tabla antes de importar. Las filas sin placa válida no se registrarán.</span>`,
        showCancelButton: true,
        confirmButtonText: "Importar de todos modos",
        cancelButtonText: "Volver y completar datos",
        confirmButtonColor: "#f59e0b",
        cancelButtonColor: "#334155",
        background: "#0f172a",
        color: "#f8fafc"
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
            confirmButtonColor: "#f59e0b"
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
            confirmButtonColor: "#f59e0b"
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
            confirmButtonColor: "#f59e0b"
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
            confirmButtonColor: "#f59e0b"
          });
          return;
        }
        targetDisplay = `Empresa existente '${found.name}'`;
      }
    }

    const totalNuevas = dynamicEmpresasSummary.filter(e => e.action === "crear").length;
    const totalReutilizadas = dynamicEmpresasSummary.filter(e => e.action === "reutilizar").length;

    let confirmHtml = `
      <div class="text-left text-xs space-y-2 text-slate-300">
        <p>Se importarán <b>${dynamicSummary.totalViajes}</b> despachos con un flete total de <b>${formatCurrency(dynamicSummary.totalFleteBs)}</b>.</p>
        <p class="text-amber-400 font-semibold">• Modalidad: ${importType === "asociacion" ? "🏛️ Asociación (Multi-Empresa)" : "🏢 Empresa Individual"}</p>
        <p class="text-sky-400 font-semibold">• Destino: ${targetDisplay || (schema ? `Empresa '${schema}'` : 'Directorio')}</p>
        ${importType === "asociacion" ? `
          <div class="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1 text-[11px]">
            <p class="text-white font-bold">• Empresas detectadas: <b>${dynamicEmpresasSummary.length}</b></p>
            <p class="text-emerald-400">• Reutilizar empresas existentes: <b>${totalReutilizadas}</b></p>
            <p class="text-sky-400">• Crear nuevas empresas en la asociación: <b>${totalNuevas}</b></p>
          </div>
        ` : ''}
        <p>• Cisternas identificadas: <b>${dynamicSummary.totalPlacas}</b></p>
        <p>• Despachos listos: <b class="text-emerald-400">${dynamicSummary.listosCount}</b></p>
        ${dynamicSummary.incompletosCount > 0 ? `<p class="text-amber-400">• Despachos incompletos: <b>${dynamicSummary.incompletosCount}</b></p>` : ''}
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
      cancelButtonColor: "#334155",
      background: "#0f172a",
      color: "#f8fafc"
    });

    if (!confirmRes.isConfirmed) return;

    setIsImporting(true);
    try {
      const formPayload = new FormData();
      formPayload.append("edited_records_json", JSON.stringify(includedRecords));

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
        <div class="space-y-3 text-left text-xs text-slate-300">
          <p class="font-bold text-sm text-emerald-400">${res.message || "Despachos registrados correctamente en el sistema."}</p>
          <div class="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1.5">
            ${res.asociacion_name ? `<div>• <b>Asociación:</b> <span class="text-amber-400">${res.asociacion_name}</span></div>` : ''}
            ${res.total_empresas_procesadas ? `<div>• <b>Empresas Procesadas:</b> ${res.total_empresas_procesadas} (${res.empresas_creadas || 0} creadas, ${res.empresas_reutilizadas || 0} reutilizadas)</div>` : ''}
            <div>• <b>Viajes Importados:</b> ${res.total_importados || res.total_viajes_importados || dynamicSummary.totalViajes}</div>
            <div>• <b>Cisternas Involucradas:</b> ${dynamicSummary.totalPlacas}</div>
            <div>• <b>Flete Total:</b> ${formatCurrency(dynamicSummary.totalFleteBs)}</div>
            <div>• <b>Períodos:</b> ${res.periodos_detectados?.join(", ") || "General"}</div>
          </div>
          ${Array.isArray(res.empresas_detalle) && res.empresas_detalle.length > 0 ? `
            <div class="max-h-40 overflow-y-auto space-y-1 pr-1">
              <span class="text-[10px] uppercase font-bold text-slate-400">Desglose por Empresa:</span>
              ${res.empresas_detalle.map((ed: any) => `
                <div class="p-1.5 bg-slate-950/70 rounded-lg border border-slate-800 flex items-center justify-between text-[11px]">
                  <span class="font-semibold text-white truncate max-w-[180px]">${ed.empresa_name}</span>
                  <div class="flex items-center gap-2">
                    <span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${ed.accion === 'creada' ? 'bg-sky-500/20 text-sky-400' : 'bg-emerald-500/20 text-emerald-400'}">${ed.accion === 'creada' ? 'Nueva' : 'Reutilizada'}</span>
                    <span class="text-amber-400 font-bold">${ed.total_viajes} viajes</span>
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
        cancelButtonColor: "#334155",
        background: "#0f172a",
        color: "#f8fafc"
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
        background: "#0f172a",
        color: "#f8fafc",
        confirmButtonColor: "#f59e0b"
      });
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
          
          {/* Header del Modal */}
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 sticky top-0 z-20 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-amber-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-tight">
                    Importación y Conciliación Inteligente de Despachos
                  </h3>
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {globalMode ? "Directorio Global" : `Empresa: ${schema}`}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Inspección, confirmación de acciones, edición en línea y conciliación de volúmenes y fletes.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={downloadBaseTemplate}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-800/60 text-slate-300 hover:text-white text-xs font-semibold transition"
                title="Descargar plantilla Excel oficial limpia"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Plantilla Base</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Cuerpo del Modal con Scroll */}
          <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
            
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
                    : "border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800/40 bg-slate-900/40"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xlsm, .xltx"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <h4 className="text-base font-bold text-white mb-1">
                  Arrastra tu archivo Excel aquí o haz clic para examinar
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                  Compatible con <b>DRIVER S.R.L VENTAS.xlsx</b>, <b>PLANTILLA DE IMPORTACIÓN.xlsx</b> y formato oficial de 19/20 columnas.
                </p>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  Formatos soportados: .xlsx, .xlsm
                </span>
              </div>
            ) : (
              /* Archivo Seleccionado + Selector de Hoja */
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400 flex-shrink-0">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{file.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                      </span>
                    </div>
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Archivo analizado correctamente
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {sheets.length > 1 && (
                    <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5">
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[11px] text-slate-400 font-semibold">Hoja:</span>
                      <select
                        value={selectedSheet}
                        onChange={(e) => handleSheetChange(e.target.value)}
                        className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
                        disabled={isLoadingPreview || isImporting}
                      >
                        {sheets.map((s) => (
                          <option key={s} value={s} className="bg-slate-900 text-white">
                            {s}
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
                    className="px-3 py-1.5 rounded-xl border border-slate-700 hover:border-rose-500/50 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 text-xs font-semibold transition"
                    disabled={isImporting}
                  >
                    Cambiar archivo
                  </button>
                </div>
              </div>
            )}

            {/* Spinner de Análisis */}
            {isLoadingPreview && (
              <div className="py-12 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
                <p className="text-sm font-semibold text-slate-300">
                  Analizando estructura, conciliando volúmenes y verificando calidad de datos...
                </p>
                <p className="text-xs text-slate-500">
                  Lectura en flujo ultra-rápida sin sobrecarga de memoria.
                </p>
              </div>
            )}

            {/* ZONA 2: SELECTOR DE MODALIDAD Y CONFIGURACIÓN DE DESTINO */}
            {previewData && !isLoadingPreview && (
              <div className="space-y-4">
                {/* Selector de Modalidad de Importación */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-1.5 bg-slate-950 border border-slate-800 rounded-2xl shadow-inner">
                  <button
                    type="button"
                    onClick={() => setImportType("empresa")}
                    className={`flex-1 flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl font-bold text-xs transition ${
                      importType === "empresa"
                        ? "bg-amber-500 text-slate-950 shadow-md font-black"
                        : "text-slate-400 hover:text-white hover:bg-slate-900/50"
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
                        ? "bg-emerald-500 text-slate-950 shadow-md font-black"
                        : "text-slate-400 hover:text-white hover:bg-slate-900/50"
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    <span>Importación por Asociación (Multi-Empresa)</span>
                    {previewData?.is_multi_empresa && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-900 text-emerald-300 border border-emerald-500/30 font-black uppercase">
                        Detectado ({previewData.empresas_detectadas?.length || dynamicEmpresasSummary.length})
                      </span>
                    )}
                  </button>
                </div>

                {/* Subzona A: Modo Asociación (Multi-Empresa) */}
                {importType === "asociacion" ? (
                  <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-emerald-500/30 shadow-lg space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                        <Layers className="w-4 h-4" />
                        <span>Destino de la Asociación Multi-Empresa</span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Cada empresa se creará o reutilizará automáticamente bajo esta asociación.
                      </span>
                    </div>

                    {/* Selector o Creación de Asociación */}
                    <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-200">
                          Asociación de Transporte de Destino:
                        </label>
                        {!creatingNewAsoc ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCreatingNewAsoc(true);
                              setNewEmpresaAsocId("__create_new__");
                            }}
                            className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
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
                            className="text-[11px] text-slate-400 hover:text-rose-400 font-semibold"
                          >
                            Cancelar y elegir existente
                          </button>
                        )}
                      </div>

                      {creatingNewAsoc ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                              Nombre de la Nueva Asociación *
                            </label>
                            <input
                              type="text"
                              value={newAsocNombre}
                              onChange={(e) => setNewAsocNombre(e.target.value)}
                              placeholder="Ej: ASOCIACIÓN DE TRANSPORTE ORIENTE..."
                              className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/50 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-400"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                              Sigla / Abreviatura (Opcional)
                            </label>
                            <input
                              type="text"
                              value={newAsocSigla}
                              onChange={(e) => setNewAsocSigla(e.target.value)}
                              placeholder="Ej: ATO..."
                              className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/50 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-400 uppercase"
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
                          className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-emerald-500"
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
                          <option value="__create_new__" className="text-emerald-400 font-bold">+ Registrar Nueva Asociación</option>
                        </select>
                      )}
                    </div>

                    {/* Tarjeta de Empresas Detectadas en la Planilla */}
                    <div className="space-y-2.5 pt-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-black text-white uppercase tracking-tight">
                            Empresas Detectadas en la Planilla ({dynamicEmpresasSummary.length})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            {dynamicEmpresasSummary.filter(e => e.action === "reutilizar").length} Reutilizar
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30">
                            {dynamicEmpresasSummary.filter(e => e.action === "crear").length} Se crearán
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                        {dynamicEmpresasSummary.map((emp, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl space-y-1.5 transition"
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <span className="text-xs font-bold text-white truncate" title={emp.nombre}>
                                {emp.nombre}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold flex-shrink-0 ${
                                emp.action === "reutilizar"
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                  : "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                              }`}>
                                {emp.action === "reutilizar" ? "Reutilizar" : "Crear Empresa"}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900">
                              <span><b>{emp.totalViajes}</b> viajes</span>
                              <span><b>{formatNumber(emp.totalVolumenLitros)}</b> L</span>
                              <span className="text-emerald-400 font-mono font-bold">{formatCurrency(emp.totalFleteBs)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-400 italic">
                        * Al confirmar la importación, el sistema creará automáticamente los esquemas para las empresas nuevas y registrará cada viaje en su empresa correspondiente.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Subzona B: Modo Empresa Individual (Modo Global) */
                  globalMode && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-amber-500/30 shadow-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                          <Building2 className="w-4 h-4" />
                          <span>Paso 1: Destino de la Empresa Individual</span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          Define dónde se almacenarán los viajes y camiones
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Opción A: Crear Nueva Empresa */}
                        <div
                          onClick={() => setImportMode("create_new")}
                          className={`p-3.5 rounded-xl border cursor-pointer transition ${
                            importMode === "create_new"
                              ? "border-amber-500 bg-amber-500/10 shadow-sm"
                              : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="radio"
                              checked={importMode === "create_new"}
                              onChange={() => setImportMode("create_new")}
                              className="text-amber-500 focus:ring-amber-500 bg-slate-950"
                            />
                            <span className="text-xs font-bold text-white">Crear Nueva Empresa Automáticamente</span>
                          </div>
                          <p className="text-[11px] text-slate-400 pl-5 leading-relaxed">
                            Se registrará en el directorio y se inicializará su esquema dedicado en la base de datos.
                          </p>
                        </div>

                        {/* Opción B: Asignar a Empresa Existente */}
                        <div
                          onClick={() => setImportMode("use_existing")}
                          className={`p-3.5 rounded-xl border cursor-pointer transition ${
                            importMode === "use_existing"
                              ? "border-emerald-500 bg-emerald-500/10 shadow-sm"
                              : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="radio"
                              checked={importMode === "use_existing"}
                              onChange={() => setImportMode("use_existing")}
                              className="text-emerald-500 focus:ring-emerald-500 bg-slate-950"
                            />
                            <span className="text-xs font-bold text-white">Asignar a Empresa Existente</span>
                          </div>
                          <p className="text-[11px] text-slate-400 pl-5 leading-relaxed">
                            Incorpora estos viajes dentro de una empresa ya registrada en el sistema.
                          </p>
                        </div>
                      </div>

                      {/* Campos según modo seleccionado */}
                      {importMode === "create_new" ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-300 mb-1">
                              Razón Social de la Nueva Empresa *
                            </label>
                            <input
                              type="text"
                              value={newEmpresaName}
                              onChange={(e) => setNewEmpresaName(e.target.value)}
                              placeholder="Ej: DRIVER S.R.L."
                              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-300 mb-1">
                              NIT (Opcional)
                            </label>
                            <input
                              type="text"
                              value={newEmpresaNit}
                              onChange={(e) => setNewEmpresaNit(e.target.value)}
                              placeholder="Ej: 1028495021"
                              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-[11px] font-bold text-slate-300">
                                Asociación / Gremio
                              </label>
                              {!creatingNewAsoc && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCreatingNewAsoc(true);
                                    setNewEmpresaAsocId("__create_new__");
                                  }}
                                  className="text-[10px] text-amber-400 hover:text-amber-300 font-bold"
                                >
                                  + Nueva Asociación
                                </button>
                              )}
                            </div>

                            {creatingNewAsoc ? (
                              <div className="space-y-1.5 p-2.5 bg-slate-900 border border-amber-500/30 rounded-xl">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-amber-400 font-bold">Registrar Nueva Asociación:</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCreatingNewAsoc(false);
                                      setNewEmpresaAsocId("");
                                    }}
                                    className="text-[10px] text-slate-400 hover:text-rose-400"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  value={newAsocNombre}
                                  onChange={(e) => setNewAsocNombre(e.target.value)}
                                  placeholder="Nombre Asociación (ej. ASOCIACIÓN ORIENTE)..."
                                  className="w-full px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
                                />
                                <input
                                  type="text"
                                  value={newAsocSigla}
                                  onChange={(e) => setNewAsocSigla(e.target.value)}
                                  placeholder="Sigla (ej: ATPO)..."
                                  className="w-full px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
                                />
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
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                              >
                                <option value="">Empresa Independiente</option>
                                <option value="__create_new__" className="text-amber-400 font-bold">+ Crear Nueva Asociación</option>
                                {asociaciones.map((a: any) => (
                                  <option key={a.id} value={a.id}>
                                    {a.sigla ? `[${a.sigla}] ` : ""}{a.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-slate-800/80">
                          <label className="block text-[11px] font-bold text-slate-300 mb-1">
                            Selecciona la Empresa de Destino *
                          </label>
                          <select
                            value={selectedExistingSchema}
                            onChange={(e) => setSelectedExistingSchema(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
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
              </div>
            )}

            {/* ZONA 3: TARJETA CONFIRMACIÓN DE ACCIONES A REALIZAR */}
            {previewData && !isLoadingPreview && (
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>Acciones que se ejecutarán en el Sistema</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Conciliación Automática
                  </span>
                </div>

                {/* Resumen Destino en el Sistema */}
                {importType === "asociacion" ? (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span className="text-slate-300">Asociación Destino:</span>
                      <strong className="text-emerald-400 font-black">
                        {creatingNewAsoc ? (newAsocNombre || "Nueva Asociación") : (asociaciones.find(a => String(a.id) === String(newEmpresaAsocId))?.name || initialAsociacionName || "Asociación")}
                      </strong>
                    </div>

                    <div className="flex items-center gap-2 text-slate-300 text-[11px]">
                      <span className="text-slate-400">Distribución:</span>
                      <strong className="text-white">
                        {dynamicEmpresasSummary.length} empresas ({dynamicEmpresasSummary.filter(e => e.action === 'crear').length} a crear, {dynamicEmpresasSummary.filter(e => e.action === 'reutilizar').length} a reutilizar)
                      </strong>
                    </div>
                  </div>
                ) : globalMode && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span className="text-slate-300">Empresa Destino:</span>
                      <strong className="text-amber-400 font-black">
                        {importMode === "create_new" ? (newEmpresaName || "Nueva Empresa") : (empresas.find(e => e.schema_name === selectedExistingSchema)?.name || selectedExistingSchema)}
                      </strong>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                        {importMode === "create_new" ? "Se creará automáticamente" : "Empresa existente"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-300 text-[11px]">
                      <span className="text-slate-400">Asociación:</span>
                      <strong className="text-white">
                        {creatingNewAsoc ? (newAsocNombre || "Nueva Asociación") : (asociaciones.find(a => String(a.id) === String(newEmpresaAsocId))?.name || "(Empresa Independiente)")}
                      </strong>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  {/* Acción 1: Flota */}
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/80 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-amber-400">
                      <Truck className="w-4 h-4" />
                      <span>Flota de Camiones</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Se detectaron <b>{dynamicSummary.totalPlacas} cisternas únicas</b>. Las unidades que no existan serán creadas automáticamente en estado Activo.
                    </p>
                  </div>

                  {/* Acción 2: Despachos */}
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/80 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-sky-400">
                      <Scale className="w-4 h-4" />
                      <span>Volúmenes y Fletes</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Se registrarán <b>{dynamicSummary.totalViajes} despachos</b> con <b>{formatNumber(dynamicSummary.totalVolumenLitros)} L</b> conciliados y <b>{formatCurrency(dynamicSummary.totalFleteBs)}</b> de flete.
                    </p>
                  </div>

                  {/* Acción 3: Períodos */}
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/80 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-emerald-400">
                      <Calendar className="w-4 h-4" />
                      <span>Períodos Contables</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Clasificación mensual en <b>{dynamicSummary.periodos.join(", ") || "General"}</b> para liquidaciones de flete oficiales.
                    </p>
                  </div>

                  {/* Acción 4: Validación de Calidad */}
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/80 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-emerald-400">
                      {dynamicSummary.incompletosCount === 0 ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                      )}
                      <span>Validación de Calidad</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      {dynamicSummary.incompletosCount === 0
                        ? "100% de datos completos. Todos los despachos cuentan con placa, volumen y tramo listos para facturar."
                        : `${dynamicSummary.incompletosCount} despacho(s) con datos incompletos. Puedes completarlos directamente en la tabla antes de importar.`
                      }
                    </p>
                  </div>
                </div>

                {/* Barra Informativa de Integridad de Datos */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-800 text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Info className="w-4 h-4 text-sky-400 flex-shrink-0" />
                    <span>
                      Todos los despachos del archivo serán importados. Puedes editar cualquier celda haciendo clic sobre ella.
                    </span>
                  </div>

                  {dynamicSummary.incompletosCount > 0 ? (
                    <span className="text-xs text-amber-400 font-bold flex items-center gap-1.5 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {dynamicSummary.incompletosCount} despacho(s) incompletos detectados
                    </span>
                  ) : (
                    <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Todos los datos completos y listos
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* ZONA 4: TABLA DE PREVISUALIZACIÓN Y EDICIÓN EN LÍNEA */}
            {previewData && !isLoadingPreview && (
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/60 space-y-3 p-3 sm:p-4">
                
                {/* Cabecera de la tabla y controles de filtro */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                  {/* Pestañas de estado */}
                  <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 overflow-x-auto text-xs font-bold gap-1">
                    <button
                      type="button"
                      onClick={() => setTableFilter("all")}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        tableFilter === "all" ? "bg-amber-500 text-slate-950 shadow-xs font-black" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Todos ({editableRecords.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableFilter("ready")}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        tableFilter === "ready" ? "bg-emerald-500 text-slate-950 shadow-xs font-black" : "text-emerald-400 hover:text-emerald-300"
                      }`}
                    >
                      Listos ({dynamicSummary.listosCount})
                    </button>
                    {dynamicSummary.incompletosCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setTableFilter("incomplete")}
                        className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                          tableFilter === "incomplete" ? "bg-amber-500 text-slate-950 shadow-xs font-black" : "text-amber-400 hover:text-amber-300"
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
                        placeholder="Buscar placa, tramo o factura..."
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleAllRecords(true)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-semibold transition"
                    >
                      Marcar Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleAllRecords(false)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-400 text-[11px] font-semibold transition"
                    >
                      Desmarcar Todos
                    </button>
                    {dynamicSummary.incompletosCount > 0 && (
                      <button
                        type="button"
                        onClick={selectOnlyReady}
                        className="px-2.5 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold transition"
                        title="Seleccionar solo los despachos con todos los datos completos"
                      >
                        Solo Listos
                      </button>
                    )}
                  </div>
                </div>

                {/* Tabla Interactiva Responsive */}
                <div className="border border-slate-800 rounded-xl overflow-x-auto max-h-96">
                  <table className="w-full text-[11px] text-left border-collapse">
                    <thead className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-10">
                          <input
                            type="checkbox"
                            checked={includedRecords.length === editableRecords.length && editableRecords.length > 0}
                            onChange={(e) => toggleAllRecords(e.target.checked)}
                            className="rounded bg-slate-950 border-slate-700 text-emerald-500"
                          />
                        </th>
                        <th className="py-2.5 px-2 text-center w-12">#</th>
                        {(importType === "asociacion" || editableRecords.some(x => x.empresa)) && (
                          <th className="py-2.5 px-3 min-w-[160px] text-emerald-400">Empresa (Editable)</th>
                        )}
                        <th className="py-2.5 px-3 min-w-[130px]">Placa (Editable)</th>
                        <th className="py-2.5 px-3 min-w-[180px]">Tramo</th>
                        <th className="py-2.5 px-3 min-w-[130px]">Producto / Cliente</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Fechas</th>
                        <th className="py-2.5 px-3 text-right min-w-[120px]">Volumen (L)</th>
                        <th className="py-2.5 px-3 text-right min-w-[110px]">Tarifa (Bs/m³)</th>
                        <th className="py-2.5 px-3 text-right">Flete Total (Bs)</th>
                        <th className="py-2.5 px-3 min-w-[130px]">Factura / MIC</th>
                        <th className="py-2.5 px-3 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {filteredRecords.length === 0 ? (
                        <tr>
                          <td colSpan={(importType === "asociacion" || editableRecords.some(x => x.empresa)) ? 12 : 11} className="py-8 text-center text-slate-500 text-xs">
                            No hay despachos para mostrar con el filtro actual.
                          </td>
                        </tr>
                      ) : (
                        filteredRecords.map((r) => {
                          const originalIdx = editableRecords.findIndex(x => x.fila === r.fila);
                          const cleanP = (r.placa || "").trim().toUpperCase().replace(/\s+/g, "");
                          const isMissingPlaca = !cleanP || ["SINPLACA", "FALTAPLACA", "TOTAL", "SUBTOTAL", "NONE"].includes(cleanP);
                          const isMissingVol = (r.volumen_facturado || 0) <= 0;
                          const isMissingTramo = !r.tramo || r.tramo.trim() === "";
                          const isIncomplete = r.is_incompleto || r.status === "INCOMPLETO" || isMissingPlaca || isMissingVol || isMissingTramo;

                          return (
                            <tr
                              key={r.fila}
                              className={`transition ${
                                !r.included
                                  ? "opacity-40 bg-slate-950/40"
                                  : isIncomplete
                                  ? "bg-amber-500/[0.04] hover:bg-amber-500/[0.08]"
                                  : "hover:bg-slate-800/30"
                              }`}
                            >
                              {/* Checkbox de Inclusión */}
                              <td className="py-2 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={r.included !== false}
                                  onChange={(e) => handleRecordFieldChange(originalIdx, "included", e.target.checked)}
                                  className="rounded bg-slate-950 border-slate-700 text-emerald-500 cursor-pointer"
                                />
                              </td>

                              {/* Fila */}
                              <td className="py-2 px-2 text-center text-slate-500 font-mono">
                                {r.fila}
                              </td>

                              {/* Empresa Editable */}
                              {(importType === "asociacion" || editableRecords.some(x => x.empresa)) && (
                                <td className="py-1.5 px-2 min-w-[150px]">
                                  <input
                                    type="text"
                                    value={r.empresa || ""}
                                    onChange={(e) => handleRecordFieldChange(originalIdx, "empresa", e.target.value)}
                                    placeholder="Empresa..."
                                    className="w-full px-2 py-1 bg-slate-900 border border-slate-700/80 rounded-lg text-emerald-300 font-semibold text-[11px] uppercase focus:outline-none focus:border-emerald-500 truncate"
                                    title={r.empresa}
                                  />
                                </td>
                              )}

                              {/* Placa Editable */}
                              <td className="py-1.5 px-2">
                                <div className="relative">
                                  <input
                                    type="text"
                                    value={r.placa || ""}
                                    onChange={(e) => handleRecordFieldChange(originalIdx, "placa", e.target.value)}
                                    placeholder="Placa..."
                                    className={`w-full px-2 py-1 bg-slate-900 border rounded-lg font-mono font-bold text-xs uppercase focus:outline-none transition ${
                                      isMissingPlaca
                                        ? "border-rose-500 text-rose-300 placeholder-rose-500/50 bg-rose-500/10 focus:border-rose-400"
                                        : r.isEdited
                                        ? "border-emerald-500 text-emerald-300 focus:border-emerald-400"
                                        : "border-slate-700 text-amber-300 focus:border-amber-400"
                                    }`}
                                  />
                                  {isMissingPlaca && (
                                    <span className="block text-[9px] text-rose-400 font-bold mt-0.5">
                                      Falta Placa
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Tramo Editable */}
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={r.tramo || ""}
                                  onChange={(e) => handleRecordFieldChange(originalIdx, "tramo", e.target.value)}
                                  className="w-full px-2 py-1 bg-slate-900 border border-slate-700/80 rounded-lg text-slate-200 text-[11px] focus:outline-none focus:border-amber-500 truncate"
                                  title={r.tramo}
                                />
                              </td>

                              {/* Producto / Cliente Editable */}
                              <td className="py-1.5 px-2 min-w-[130px]">
                                <input
                                  type="text"
                                  value={r.producto || ""}
                                  onChange={(e) => handleRecordFieldChange(originalIdx, "producto", e.target.value)}
                                  placeholder="Producto..."
                                  className="w-full px-2 py-0.5 bg-slate-900 border border-slate-700/80 rounded-lg text-slate-200 text-[10px] font-bold uppercase focus:outline-none focus:border-amber-500 truncate"
                                />
                                {r.cliente && (
                                  <span className="block text-[9px] text-slate-400 font-normal truncate mt-0.5" title={r.cliente}>
                                    {r.cliente}
                                  </span>
                                )}
                              </td>

                              {/* Fechas */}
                              <td className="py-2 px-3 whitespace-nowrap font-mono text-[10px] text-slate-400">
                                {r.fecha_carga} → {r.fecha_descarga}
                              </td>

                              {/* Volumen Facturado Editable (Litros) */}
                              <td className="py-1.5 px-2 text-right">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={r.volumen_facturado || ""}
                                  onChange={(e) => handleRecordFieldChange(originalIdx, "volumen_facturado", e.target.value)}
                                  className="w-24 px-2 py-1 bg-slate-900 border border-slate-700/80 rounded-lg text-right font-mono font-bold text-sky-400 text-xs focus:outline-none focus:border-sky-400"
                                />
                                <span className="block text-[9px] text-slate-500 font-mono mt-0.5">
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
                                  className="w-20 px-2 py-1 bg-slate-900 border border-slate-700/80 rounded-lg text-right font-mono text-slate-200 text-xs focus:outline-none focus:border-amber-400"
                                />
                              </td>

                              {/* Flete Total Calculado */}
                              <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                                {formatCurrency(r.flete_total_bs)}
                              </td>

                              {/* Factura / MIC Editable */}
                              <td className="py-1.5 px-2 whitespace-nowrap">
                                <input
                                  type="text"
                                  value={r.nro_factura || ""}
                                  onChange={(e) => handleRecordFieldChange(originalIdx, "nro_factura", e.target.value)}
                                  placeholder="FAC Nro..."
                                  className="w-24 px-2 py-1 bg-slate-900 border border-slate-700/80 rounded-lg text-amber-300 font-mono text-[10px] focus:outline-none focus:border-amber-400"
                                />
                                {r.mic_dta && (
                                  <span className="block font-mono text-[9px] text-slate-500 mt-0.5">
                                    MIC: {r.mic_dta}
                                  </span>
                                )}
                              </td>

                              {/* Estado */}
                              <td className="py-2 px-3 text-center whitespace-nowrap">
                                {isIncomplete ? (
                                  <div className="flex flex-col items-center">
                                    <span
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                      title={r.incompleto_reason || (isMissingPlaca ? "Falta placa del camión" : isMissingVol ? "Volumen en 0" : "Datos incompletos")}
                                    >
                                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                                      Incompleto
                                    </span>
                                    <span className="text-[9px] text-amber-400/80 mt-0.5 font-medium">
                                      {r.incompleto_reason || (isMissingPlaca ? "Falta Placa" : isMissingVol ? "Volumen 0" : "Dato faltante")}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
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
          </div>

          {/* Footer con Acciones */}
          <div className="px-5 py-4 border-t border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sticky bottom-0 z-20 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-semibold text-xs transition"
                disabled={isImporting}
              >
                Cancelar
              </button>
              
              {editableRecords.length > 0 && (
                <span className="text-xs text-slate-400">
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
