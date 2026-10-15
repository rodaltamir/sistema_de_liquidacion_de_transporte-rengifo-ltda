"use client";

import React, { useState, useRef, useEffect } from "react";
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
  Scale
} from "lucide-react";
import Swal from "sweetalert2";
import ModalPortal from "@/components/ModalPortal";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatNumber, formatDate } from "@/lib/format";
import { downloadBlob } from "@/lib/download";

interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  schema: string;
  onSuccess: (result: {
    total_importados: number;
    total_actualizados: number;
    total_omitidos: number;
    periodos_detectados: string[];
  }) => void;
}

interface PreviewRecord {
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
  onSuccess
}: ImportExcelModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [overwriteDuplicates, setOverwriteDuplicates] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setSheets([]);
      setSelectedSheet("");
      setPreviewData(null);
      setIsLoadingPreview(false);
      setIsImporting(false);
      setShowSkipped(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

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

    try {
      // 1. Obtener información de hojas si aún no se tienen o cambió de archivo
      let targetSheet = sheetOverride;
      if (!targetSheet) {
        const infoPayload = new FormData();
        infoPayload.append("file", selectedFile);
        const infoRes = await apiFetch(`/tenants/${schema}/viajes/excel-info`, {
          method: "POST",
          body: infoPayload
        });
        if (infoRes?.sheets && infoRes.sheets.length > 0) {
          setSheets(infoRes.sheets);
          // Preferir hojas más recientes si existen tipo V-2026 o la última
          const reversed = [...infoRes.sheets].reverse();
          const preferred = reversed.find((s: string) => s.includes("2026")) ||
                          reversed.find((s: string) => s.includes("2025")) ||
                          infoRes.default_sheet;
          targetSheet = preferred || infoRes.sheets[0];
          setSelectedSheet(targetSheet);
        }
      }

      // 2. Obtener previsualización analizada
      const previewPayload = new FormData();
      previewPayload.append("file", selectedFile);
      if (targetSheet) {
        previewPayload.append("sheet_name", targetSheet);
      }

      const res = await apiFetch(`/tenants/${schema}/viajes/preview-excel`, {
        method: "POST",
        body: previewPayload
      });

      setPreviewData(res);
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
      const blob = await apiFetch(`/tenants/${schema}/viajes/plantilla-excel`);
      const filename = `Plantilla_Oficial_Viajes_${schema}.xlsx`;
      downloadBlob(blob, filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
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

  // Confirmar Importación Definitiva a la Base de Datos
  const handleConfirmImport = async () => {
    if (!file) return;

    if (!previewData || previewData.total_valid_rows === 0) {
      Swal.fire({
        icon: "warning",
        title: "Sin registros válidos",
        text: "No hay despachos válidos para importar en la hoja seleccionada.",
        background: "#0f172a",
        color: "#f8fafc",
        confirmButtonColor: "#f59e0b"
      });
      return;
    }

    const dupCount = previewData.summary.viajes_duplicados;
    let confirmMsg = `Se importarán <b>${previewData.summary.total_viajes}</b> despachos a la base de datos.<br/>`;
    if (dupCount > 0) {
      if (overwriteDuplicates) {
        confirmMsg += `<span class="text-amber-400 font-semibold text-xs">Atención: ${dupCount} despachos existentes serán actualizados con los datos del Excel.</span>`;
      } else {
        confirmMsg += `<span class="text-sky-400 font-semibold text-xs">${dupCount} despachos ya existentes serán omitidos automáticamente para evitar duplicaciones.</span>`;
      }
    }

    const confirmRes = await Swal.fire({
      title: "¿Confirmar Importación?",
      html: confirmMsg,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, importar ahora",
      cancelButtonText: "Revisar más",
      confirmButtonColor: "#f59e0b",
      cancelButtonColor: "#334155",
      background: "#0f172a",
      color: "#f8fafc"
    });

    if (!confirmRes.isConfirmed) return;

    setIsImporting(true);
    try {
      const formPayload = new FormData();
      formPayload.append("file", file);
      if (selectedSheet) {
        formPayload.append("sheet_name", selectedSheet);
      }
      formPayload.append("overwrite_duplicates", overwriteDuplicates ? "true" : "false");

      const res = await apiFetch(`/tenants/${schema}/viajes/importar-excel`, {
        method: "POST",
        body: formPayload
      });

      await Swal.fire({
        icon: "success",
        title: "¡Importación Exitosa!",
        html: `
          <div class="space-y-2 text-left text-xs text-slate-300">
            <p class="font-bold text-sm text-emerald-400">${res.message}</p>
            <div class="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1">
              <div>• <b>Viajes Nuevos Importados:</b> ${res.total_importados}</div>
              <div>• <b>Viajes Actualizados:</b> ${res.total_actualizados}</div>
              <div>• <b>Duplicados Omitidos:</b> ${res.total_omitidos}</div>
              <div>• <b>Períodos Afectados:</b> ${res.periodos_detectados?.join(", ") || "N/A"}</div>
            </div>
          </div>
        `,
        background: "#0f172a",
        color: "#f8fafc",
        confirmButtonColor: "#f59e0b"
      });

      onSuccess({
        total_importados: res.total_importados,
        total_actualizados: res.total_actualizados,
        total_omitidos: res.total_omitidos,
        periodos_detectados: res.periodos_detectados || []
      });
      onClose();
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al registrar viajes",
        text: err.message || "Ocurrió un error al guardar los viajes en la base de datos.",
        background: "#0f172a",
        color: "#f8fafc",
        confirmButtonColor: "#f59e0b"
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
          
          {/* Header del Modal */}
          <div className="px-6 py-4.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 sticky top-0 z-10 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-emerald-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-white uppercase tracking-tight">
                    Importación Inteligente de Despachos
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Soporta Driver S.R.L. & Base
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Carga tus plantillas Excel con detección automática de columnas, mermas, placas y períodos.
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
                <Download className="w-3.5 h-3.5 text-amber-400" />
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
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            
            {/* Zona 1: Subir Archivo y Dropzone */}
            {!file ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? "border-amber-500 bg-amber-500/10 scale-[0.99]"
                    : "border-slate-700 hover:border-amber-500/50 hover:bg-slate-800/40 bg-slate-900/40"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xlsm, .xltx"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <h4 className="text-base font-bold text-white mb-1">
                  Arrastra tu archivo Excel aquí o haz clic para examinar
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                  Compatible con el formato oficial de liquidación, <b>DRIVER S.R.L VENTAS.xlsx</b> y <b>PLANTILLA DE IMPORTACIÓN.xlsx</b>.
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
                      <CheckCircle2 className="w-3 h-3" /> Archivo cargado y validado
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {/* Selector de Hojas */}
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
                <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
                <p className="text-sm font-semibold text-slate-300">
                  Analizando estructura, conciliando volúmenes y detectando duplicados...
                </p>
                <p className="text-xs text-slate-500">
                  Esto toma solo un instante gracias al procesamiento optimizado de datos.
                </p>
              </div>
            )}

            {/* Zona 2: Métricas Ejecutivas del Archivo Parseado */}
            {previewData && !isLoadingPreview && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  
                  {/* Viajes Válidos */}
                  <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-3.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Despachos Listos
                    </span>
                    <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
                      {previewData.summary.total_viajes}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {previewData.summary.viajes_nuevos} nuevos • {previewData.summary.total_placas_unicas} cisternas
                    </span>
                  </div>

                  {/* Duplicados detectados */}
                  <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-3.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Duplicados Detectados
                    </span>
                    <div className={`text-xl font-black font-mono mt-0.5 ${
                      previewData.summary.viajes_duplicados > 0 ? "text-amber-400" : "text-slate-400"
                    }`}>
                      {previewData.summary.viajes_duplicados}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {previewData.summary.viajes_duplicados > 0 ? "Ya registrados en sistema" : "Sin duplicados"}
                    </span>
                  </div>

                  {/* Volumen Total Facturado */}
                  <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-3.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Volumen Conciliado
                    </span>
                    <div className="text-xl font-black text-sky-400 font-mono mt-0.5">
                      {formatNumber(previewData.summary.total_volumen_litros, 0)} L
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {formatNumber(previewData.summary.total_volumen_m3, 2)} m³
                    </span>
                  </div>

                  {/* Flete Total Estimado */}
                  <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-3.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Flete Total Calculado
                    </span>
                    <div className="text-xl font-black text-amber-400 font-mono mt-0.5">
                      {formatCurrency(previewData.summary.total_flete_bs)}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Períodos: {previewData.summary.periodos_detectados.join(", ") || "General"}
                    </span>
                  </div>
                </div>

                {/* Switch de control de duplicados */}
                {previewData.summary.viajes_duplicados > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-amber-300">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>
                        Se detectaron <b>{previewData.summary.viajes_duplicados}</b> despachos que ya figuran en la base de datos (por MIC/DTA o placa y fecha).
                      </span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={overwriteDuplicates}
                        onChange={(e) => setOverwriteDuplicates(e.target.checked)}
                        className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-amber-500"
                      />
                      <span className="text-slate-200 font-semibold">
                        Sobrescribir datos de existentes
                      </span>
                    </label>
                  </div>
                )}

                {/* Filas Omitidas / Resúmenes */}
                {previewData.total_skipped_rows > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowSkipped(!showSkipped)}
                      className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 font-medium transition"
                    >
                      <Info className="w-3.5 h-3.5 text-sky-400" />
                      <span>
                        Se omitieron {previewData.total_skipped_rows} filas de subtotales o sin placa asignada
                      </span>
                      {showSkipped ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {showSkipped && (
                      <div className="mt-2 p-3 bg-slate-950/70 border border-slate-800 rounded-xl max-h-36 overflow-y-auto space-y-1 text-[11px] text-slate-400">
                        {previewData.skipped_details.map((sk, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="text-slate-500 font-mono">Fila {sk.fila}:</span>
                            <span>{sk.motivo}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Zona 3: Tabla de Previsualización */}
                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                  <div className="px-4 py-2.5 bg-slate-900/70 border-b border-slate-800 flex items-center justify-between text-xs font-bold text-slate-300">
                    <span className="flex items-center gap-2">
                      <Truck className="w-3.5 h-3.5 text-amber-400" />
                      Vista previa de despachos a incorporar (Primeros {previewData.records.length} registros)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Total: {previewData.total_valid_rows} filas
                    </span>
                  </div>

                  <div className="overflow-x-auto max-h-80">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-slate-900/90 text-slate-400 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3 text-center">#</th>
                          <th className="py-2.5 px-3">Placa</th>
                          <th className="py-2.5 px-3">Tramo</th>
                          <th className="py-2.5 px-3">Cliente</th>
                          <th className="py-2.5 px-3">Producto</th>
                          <th className="py-2.5 px-3">Fechas</th>
                          <th className="py-2.5 px-3 text-right">Vol. Facturado</th>
                          <th className="py-2.5 px-3 text-right">Tarifa</th>
                          <th className="py-2.5 px-3 text-right">Flete Total</th>
                          <th className="py-2.5 px-3">Factura / MIC</th>
                          <th className="py-2.5 px-3 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-medium">
                        {previewData.records.map((r, idx) => {
                          const isDup = r.is_duplicate_system || r.is_duplicate_file;
                          return (
                            <tr
                              key={idx}
                              className={`hover:bg-slate-800/40 transition ${
                                isDup ? "bg-amber-500/[0.03]" : ""
                              }`}
                            >
                              <td className="py-2 px-3 text-center text-slate-500 font-mono">
                                {r.fila}
                              </td>
                              <td className="py-2 px-3 font-mono font-bold text-amber-300 whitespace-nowrap">
                                {r.placa}
                              </td>
                              <td className="py-2 px-3 text-slate-300 max-w-[180px] truncate" title={r.tramo}>
                                {r.tramo}
                              </td>
                              <td className="py-2 px-3 text-slate-400 max-w-[140px] truncate" title={r.cliente}>
                                {r.cliente}
                              </td>
                              <td className="py-2 px-3 text-slate-300">
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                                  {r.producto}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-slate-400 whitespace-nowrap font-mono text-[10px]">
                                {r.fecha_carga} → {r.fecha_descarga}
                              </td>
                              <td className="py-2 px-3 text-right whitespace-nowrap font-mono text-sky-400">
                                <div className="font-bold">{formatNumber(r.volumen_facturado, 0)} L</div>
                                <div className="text-[10px] text-slate-500">({formatNumber(r.volumen_facturado_m3, 3)} m³)</div>
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-300 whitespace-nowrap">
                                {formatNumber(r.tarifa_flete, 2)} Bs/m³
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                                {formatCurrency(r.flete_total_bs)}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                {r.nro_factura && (
                                  <span className="font-mono text-amber-300 font-semibold block">
                                    FAC: {r.nro_factura}
                                  </span>
                                )}
                                {r.mic_dta ? (
                                  <span className="font-mono text-slate-400 text-[10px]">
                                    MIC: {r.mic_dta}
                                  </span>
                                ) : (
                                  !r.nro_factura && <span className="text-slate-600">-</span>
                                )}
                              </td>
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
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer con Acciones */}
          <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between gap-3 sticky bottom-0 z-10 backdrop-blur-md">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-semibold text-xs transition"
              disabled={isImporting}
            >
              Cancelar
            </button>

            <div className="flex items-center gap-3">
              {previewData && (
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={isImporting || previewData.total_valid_rows === 0}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Registrando despachos en el sistema...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirmar e Importar {previewData.summary.total_viajes} Despachos</span>
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
