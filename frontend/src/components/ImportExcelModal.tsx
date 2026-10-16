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

export interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  schema?: string;
  globalMode?: boolean;
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
  }) => void;
}

export interface PreviewRecord {
  fila: number;
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
  is_duplicate_system: boolean;
  is_duplicate_file: boolean;
  duplicate_reason?: string;
  status: "VALIDO" | "DUPLICADO";
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
  summary: {
    total_viajes: number;
    viajes_nuevos: number;
    viajes_duplicados: number;
    total_volumen_litros: number;
    total_volumen_m3: number;
    total_flete_bs: number;
    periodos_detectados: string[];
    total_placas_unicas: number;
  };
}

export default function ImportExcelModal({
  isOpen,
  onClose,
  schema,
  globalMode = false,
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

  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  
  // Registros interactivos editables
  const [editableRecords, setEditableRecords] = useState<PreviewRecord[]>([]);
  const [overwriteDuplicates, setOverwriteDuplicates] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);
  const [tableFilter, setTableFilter] = useState<"all" | "selected" | "duplicates" | "missing_placa">("all");
  const [tableSearch, setTableSearch] = useState("");

  // Opciones de Destino para Modo Global
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

  // Cargar asociaciones y empresas si está en globalMode
  useEffect(() => {
    if (isOpen && globalMode) {
      Promise.all([
        apiFetch("/asociaciones/").catch(() => []),
        apiFetch("/empresas/").catch(() => [])
      ]).then(([asocData, empData]) => {
        setAsociaciones(Array.isArray(asocData) ? asocData : []);
        const validEmps = Array.isArray(empData) ? empData : [];
        setEmpresas(validEmps);
        if (validEmps.length > 0 && !selectedExistingSchema) {
          setSelectedExistingSchema(validEmps[0].schema_name);
        }
      });
    }
  }, [isOpen, globalMode]);

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
    } else {
      if (initialAsociacionId) {
        setNewEmpresaAsocId(initialAsociacionId);
        setCreatingNewAsoc(false);
      } else if (initialAsociacionName) {
        setCreatingNewAsoc(true);
        setNewAsocNombre(initialAsociacionName);
        if (initialAsociacionSigla) {
          setNewAsocSigla(initialAsociacionSigla);
        }
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

      if (field === "placa") {
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

      r.isEdited = true;
      next[index] = r;
      return next;
    });
  };

  const toggleAllRecords = (included: boolean) => {
    setEditableRecords(prev => prev.map(r => ({ ...r, included })));
  };

  const excludeDuplicates = () => {
    setEditableRecords(prev => prev.map(r => ({
      ...r,
      included: !(r.is_duplicate_system || r.is_duplicate_file)
    })));
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
    let missingPlacas = 0;
    let dupCount = 0;
    const periodos = new Set<string>();

    includedRecords.forEach(r => {
      totalVol += (r.volumen_facturado || 0);
      totalFlete += (r.flete_total_bs || 0);
      const cleanP = (r.placa || "").trim().toUpperCase();
      if (!cleanP || cleanP === "SIN PLACA" || cleanP === "FALTA PLACA" || cleanP === "TOTAL") {
        missingPlacas++;
      } else {
        placas.add(cleanP);
      }
      if (r.is_duplicate_system || r.is_duplicate_file) {
        dupCount++;
      }
      if (r.periodo_mes) {
        periodos.add(r.periodo_mes);
      }
    });

    return {
      totalViajes,
      totalVolumenLitros: Math.round(totalVol * 10) / 10,
      totalVolumenM3: Math.round((totalVol / 1000.0) * 1000) / 1000,
      totalFleteBs: Math.round(totalFlete * 100) / 100,
      totalPlacas: placas.size,
      missingPlacas,
      dupCount,
      periodos: Array.from(periodos).sort()
    };
  }, [includedRecords]);

  // Filtro de la tabla
  const filteredRecords = useMemo(() => {
    return editableRecords.filter((r, idx) => {
      // Filtro de pestaña
      if (tableFilter === "selected" && !r.included) return false;
      if (tableFilter === "duplicates" && !(r.is_duplicate_system || r.is_duplicate_file)) return false;
      if (tableFilter === "missing_placa") {
        const p = (r.placa || "").trim().toUpperCase();
        if (p && p !== "SIN PLACA" && p !== "FALTA PLACA" && p !== "TOTAL") return false;
      }

      // Buscador
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase().trim();
        const pMatch = r.placa?.toLowerCase().includes(q);
        const tMatch = r.tramo?.toLowerCase().includes(q);
        const fMatch = r.nro_factura?.toLowerCase().includes(q);
        const mMatch = r.mic_dta?.toLowerCase().includes(q);
        if (!pMatch && !tMatch && !fMatch && !mMatch) return false;
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

    if (dynamicSummary.missingPlacas > 0) {
      const missingPrompt = await Swal.fire({
        icon: "warning",
        title: "Despachos sin Placa Detectados",
        html: `Hay <b>${dynamicSummary.missingPlacas}</b> despacho(s) marcados que no tienen una placa válida asignada.<br/><br/><span class="text-xs text-slate-400">Puedes escribir la placa directamente en la tabla o desmarcarlos. Si continúas, las filas sin placa serán omitidas.</span>`,
        showCancelButton: true,
        confirmButtonText: "Continuar de todos modos",
        cancelButtonText: "Volver y corregir",
        confirmButtonColor: "#f59e0b",
        cancelButtonColor: "#334155",
        background: "#0f172a",
        color: "#f8fafc"
      });
      if (!missingPrompt.isConfirmed) return;
    }

    // Si está en globalMode y elige crear nueva empresa, validar nombre
    let targetEmpresaDisplay = "";
    if (globalMode) {
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
        targetEmpresaDisplay = newEmpresaName.trim();
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
        targetEmpresaDisplay = found.name;
      }
    }

    let confirmHtml = `
      <div class="text-left text-xs space-y-2 text-slate-300">
        <p>Se importarán <b>${dynamicSummary.totalViajes}</b> despachos con un flete total de <b>${formatCurrency(dynamicSummary.totalFleteBs)}</b>.</p>
        ${globalMode ? `<p class="text-amber-400 font-semibold">• Destino: ${importMode === 'create_new' ? `Crear Empresa '${targetEmpresaDisplay}'` : `Empresa existente '${targetEmpresaDisplay}'`}</p>` : ''}
        <p>• Cisternas identificadas: <b>${dynamicSummary.totalPlacas}</b></p>
        <p>• Períodos: <b>${dynamicSummary.periodos.join(", ") || "General"}</b></p>
        ${dynamicSummary.dupCount > 0 ? (
          overwriteDuplicates
            ? `<p class="text-amber-400">• ${dynamicSummary.dupCount} viajes existentes serán actualizados.</p>`
            : `<p class="text-sky-400">• ${dynamicSummary.dupCount} viajes ya registrados serán omitidos.</p>`
        ) : ''}
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
      formPayload.append("overwrite_duplicates", overwriteDuplicates ? "true" : "false");
      formPayload.append("edited_records_json", JSON.stringify(includedRecords));

      let res: any;

      if (globalMode) {
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
      const finalName = res.empresa_name || targetEmpresaDisplay;

      const successModal = await Swal.fire({
        icon: "success",
        title: "¡Importación Exitosa!",
        html: `
          <div class="space-y-3 text-left text-xs text-slate-300">
            <p class="font-bold text-sm text-emerald-400">${res.message || "Despachos registrados correctamente."}</p>
            <div class="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
              ${finalName ? `<div>• <b>Empresa:</b> <span class="text-amber-400">${finalName}</span></div>` : ''}
              <div>• <b>Viajes Nuevos:</b> ${res.total_importados}</div>
              <div>• <b>Viajes Actualizados:</b> ${res.total_actualizados}</div>
              <div>• <b>Duplicados Omitidos:</b> ${res.total_omitidos}</div>
              <div>• <b>Períodos:</b> ${res.periodos_detectados?.join(", ") || "General"}</div>
            </div>
          </div>
        `,
        showCancelButton: Boolean(finalSchema),
        confirmButtonText: finalSchema ? "Ir al Historial de Viajes" : "Entendido",
        cancelButtonText: "Permanecer aquí",
        confirmButtonColor: "#10b981",
        cancelButtonColor: "#334155",
        background: "#0f172a",
        color: "#f8fafc"
      });

      onSuccess({
        total_importados: res.total_importados,
        total_actualizados: res.total_actualizados,
        total_omitidos: res.total_omitidos,
        periodos_detectados: res.periodos_detectados || [],
        target_schema: finalSchema,
        empresa_name: finalName
      });

      onClose();

      if (successModal.isConfirmed && finalSchema) {
        router.push(`/${finalSchema}/historial`);
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
                  Analizando estructura, conciliando volúmenes y detectando duplicados...
                </p>
                <p className="text-xs text-slate-500">
                  Lectura en flujo ultra-rápida sin sobrecarga de memoria.
                </p>
              </div>
            )}

            {/* ZONA 2: CONFIGURACIÓN DE DESTINO (EN MODO GLOBAL) */}
            {previewData && !isLoadingPreview && globalMode && (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-amber-500/30 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                    <Building2 className="w-4 h-4" />
                    <span>Paso 1: Destino de la Importación</span>
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
                {globalMode && (
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

                  {/* Acción 4: Duplicados */}
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/80 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-purple-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Control de Duplicidad</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      {overwriteDuplicates 
                        ? `Actualizar datos de los ${dynamicSummary.dupCount} viajes repetidos.`
                        : `Omitir automáticamente los ${dynamicSummary.dupCount} viajes ya registrados.`
                      }
                    </p>
                  </div>
                </div>

                {/* Control de Duplicados & Alerta de Faltantes */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-800">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs">
                    <input
                      type="checkbox"
                      checked={overwriteDuplicates}
                      onChange={(e) => setOverwriteDuplicates(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-amber-500 w-4 h-4"
                    />
                    <span className="text-slate-200 font-semibold">
                      Sobrescribir datos de viajes duplicados (si ya figuran en la base de datos)
                    </span>
                  </label>

                  {dynamicSummary.missingPlacas > 0 && (
                    <span className="text-xs text-amber-400 font-bold flex items-center gap-1.5 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {dynamicSummary.missingPlacas} despachos sin placa (puedes editarlos en la tabla)
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
                  <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 overflow-x-auto text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setTableFilter("all")}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        tableFilter === "all" ? "bg-amber-500 text-slate-950 shadow-xs" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Todos ({editableRecords.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableFilter("selected")}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        tableFilter === "selected" ? "bg-emerald-500 text-slate-950 shadow-xs" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Listos ({dynamicSummary.totalViajes})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableFilter("duplicates")}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        tableFilter === "duplicates" ? "bg-amber-500 text-slate-950 shadow-xs" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Duplicados ({dynamicSummary.dupCount})
                    </button>
                    {dynamicSummary.missingPlacas > 0 && (
                      <button
                        type="button"
                        onClick={() => setTableFilter("missing_placa")}
                        className={`px-3 py-1.5 rounded-lg transition ${
                          tableFilter === "missing_placa" ? "bg-rose-500 text-white shadow-xs" : "text-rose-400 hover:text-rose-300"
                        }`}
                      >
                        Sin Placa ({dynamicSummary.missingPlacas})
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
                    {dynamicSummary.dupCount > 0 && (
                      <button
                        type="button"
                        onClick={excludeDuplicates}
                        className="px-2.5 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[11px] font-semibold transition"
                      >
                        Excluir Duplicados
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
                          <td colSpan={11} className="py-8 text-center text-slate-500 text-xs">
                            No hay despachos para mostrar con el filtro actual.
                          </td>
                        </tr>
                      ) : (
                        filteredRecords.map((r) => {
                          const originalIdx = editableRecords.findIndex(x => x.fila === r.fila);
                          const isDup = r.is_duplicate_system || r.is_duplicate_file;
                          const cleanP = (r.placa || "").trim().toUpperCase();
                          const isMissingPlaca = !cleanP || cleanP === "SIN PLACA" || cleanP === "FALTA PLACA" || cleanP === "TOTAL";

                          return (
                            <tr
                              key={r.fila}
                              className={`transition ${
                                !r.included
                                  ? "opacity-40 bg-slate-950/40"
                                  : isDup
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
                                        ? "border-rose-500 text-rose-300 placeholder-rose-500/50 bg-rose-500/10"
                                        : r.isEdited
                                        ? "border-emerald-500 text-emerald-300"
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
                                {isDup ? (
                                  <span
                                    className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                    title={r.duplicate_reason || "Ya existe en el sistema"}
                                  >
                                    Duplicado
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    Válido
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
