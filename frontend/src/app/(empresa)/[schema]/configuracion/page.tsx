"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { 
  Settings, 
  Save, 
  ShieldCheck, 
  Fuel, 
  DollarSign, 
  FileText, 
  Users, 
  CheckCircle2, 
  Info,
  Scale,
  Building2,
  Sun,
  Moon,
  Laptop,
  Image as ImageIcon,
  Upload,
  Trash2,
  RotateCcw,
  Check,
  AlertCircle,
  Truck,
  Award,
  Phone,
  Mail,
  MapPin,
  FileCheck2
} from "lucide-react";
import Swal from "sweetalert2";
import { apiFetch } from "@/lib/api";
import { useTheme, Theme } from "@/context/ThemeContext";

export default function ConfiguracionPage() {
  const routeParams = useParams();
  const schema = (routeParams?.schema as string) || "";
  const { theme, setTheme, resolvedTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<"empresa" | "parametros" | "tema">("empresa");
  const [loading, setLoading] = useState(true);
  const [savingParametros, setSavingParametros] = useState(false);
  const [savingEmpresa, setSavingEmpresa] = useState(false);

  // Lista de asociaciones disponibles para selector
  const [asociaciones, setAsociaciones] = useState<any[]>([]);

  // Datos Institucionales de la Empresa
  const [empresaData, setEmpresaData] = useState({
    name: "",
    nit: "",
    tipo_empresa: "Sociedad de Responsabilidad Limitada (S.R.L.)",
    representante_legal: "",
    direccion: "",
    telefono: "",
    email: "",
    asociacion_id: null as number | null,
    icon: "Truck",
    logo_base64: ""
  });

  // Errores de validación de empresa
  const [empresaErrors, setEmpresaErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState(false);

  // Parámetros Técnicos y Normativa YPFB
  const [formData, setFormData] = useState({
    tipo_cambio_usd_bob: 6.96,
    merma_tolerancia_diesel_pct: 0.15,
    merma_tolerancia_gasolina_pct: 0.25,
    merma_tolerancia_iya_pct: 0.20,
    merma_tolerancia_crudo_pct: 0.15,
    precio_merma_diesel_litro_bs: 3.72,
    precio_merma_gasolina_litro_bs: 3.74,
    precio_merma_general_bs: 7.45,
    comision_usd_m3: 1.00,
    comision_pct_1: 7.0,
    comision_ypfb_bolgart_pct: 7.0,
    comision_pct_2: 3.0,
    costo_hojas_de_ruta_bs: 240.00,
    costo_gps_bs: 135.00,
    anticipos_otros_pct: 0.0,
    firma_realizado_por: "JAQUELINE LOVERA TIÑINI",
    firma_revisado_por: "JOSE LOVERA TIÑINI / GERENTE GENERAL",
    firma_autorizado_por: "DIRECTORIO",
    firma_cancelado_por: "TOMASA TIÑINI MITA / APOYO",
    leyenda_legal: "Conforme lo establece la Ley 843 en su Art. 4 y de acuerdo a la cláusula contractual de Facturación y Pago, el momento en que finalizará la ejecución o la prestación del Servicio se origina después de realizada la Conciliación (Acta de Conformidad por la Comisión de Recepción) y emitida la planilla de Liquidación."
  });

  useEffect(() => {
    loadAllData();
  }, [schema]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // 1. Cargar parámetros técnicos
      const paramData = await apiFetch(`/tenants/${schema}/parametros/`);
      if (paramData) {
        setFormData({
          tipo_cambio_usd_bob: paramData.tipo_cambio_usd_bob ?? 6.96,
          merma_tolerancia_diesel_pct: paramData.merma_tolerancia_diesel_pct ?? 0.15,
          merma_tolerancia_gasolina_pct: paramData.merma_tolerancia_gasolina_pct ?? 0.25,
          merma_tolerancia_iya_pct: paramData.merma_tolerancia_iya_pct ?? 0.20,
          merma_tolerancia_crudo_pct: paramData.merma_tolerancia_crudo_pct ?? 0.15,
          precio_merma_diesel_litro_bs: paramData.precio_merma_diesel_litro_bs ?? 3.72,
          precio_merma_gasolina_litro_bs: paramData.precio_merma_gasolina_litro_bs ?? 3.74,
          precio_merma_general_bs: paramData.precio_merma_general_bs ?? 7.45,
          comision_usd_m3: paramData.comision_usd_m3 ?? 1.00,
          comision_pct_1: paramData.comision_pct_1 ?? 7.0,
          comision_ypfb_bolgart_pct: paramData.comision_ypfb_bolgart_pct ?? 7.0,
          comision_pct_2: paramData.comision_pct_2 ?? 3.0,
          costo_hojas_de_ruta_bs: paramData.costo_hojas_de_ruta_bs ?? 240.00,
          costo_gps_bs: paramData.costo_gps_bs ?? 135.00,
          anticipos_otros_pct: paramData.anticipos_otros_pct ?? 0.0,
          firma_realizado_por: paramData.firma_realizado_por || "JAQUELINE LOVERA TIÑINI",
          firma_revisado_por: paramData.firma_revisado_por || "JOSE LOVERA TIÑINI / GERENTE GENERAL",
          firma_autorizado_por: paramData.firma_autorizado_por || "DIRECTORIO",
          firma_cancelado_por: paramData.firma_cancelado_por || "TOMASA TIÑINI MITA / APOYO",
          leyenda_legal: paramData.leyenda_legal || ""
        });
      }

      // 2. Cargar datos de la empresa
      const empData = await apiFetch(`/empresas/${schema}`);
      if (empData) {
        setEmpresaData({
          name: empData.name || "",
          nit: empData.nit || "",
          tipo_empresa: empData.tipo_empresa || "Sociedad de Responsabilidad Limitada (S.R.L.)",
          representante_legal: empData.representante_legal || "",
          direccion: empData.direccion || "",
          telefono: empData.telefono || "",
          email: empData.email || "",
          asociacion_id: empData.asociacion_id || null,
          icon: empData.icon || "Truck",
          logo_base64: empData.logo_base64 || ""
        });
      }

      // 3. Cargar lista de asociaciones para el selector
      try {
        const asocs = await apiFetch("/asociaciones/");
        setAsociaciones(asocs || []);
      } catch (e) {
        console.error("Error al cargar asociaciones:", e);
      }

    } catch (err) {
      console.error("Error al cargar configuración:", err);
    } finally {
      setLoading(false);
    }
  };

  // Validación de datos de la empresa (simplificada según requerimientos)
  const validateEmpresa = () => {
    const errs: Record<string, string> = {};

    if (!empresaData.name.trim()) {
      errs.name = "La Razón Social o Nombre de la Empresa es obligatorio.";
    } else if (empresaData.name.trim().length < 3) {
      errs.name = "El nombre debe tener al menos 3 caracteres.";
    }

    if (!empresaData.representante_legal.trim()) {
      errs.representante_legal = "El nombre del Representante Legal o Gerente es obligatorio.";
    }

    setEmpresaErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Guardar datos de la empresa
  const handleSaveEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmpresa()) {
      Swal.fire({
        icon: "warning",
        title: "Campos Incompletos",
        text: "Por favor revisa y corrige los campos resaltados en rojo.",
        background: resolvedTheme === "dark" ? "#0f172a" : "#ffffff",
        color: resolvedTheme === "dark" ? "#f8fafc" : "#0f172a",
        confirmButtonColor: "#f59e0b"
      });
      return;
    }

    setSavingEmpresa(true);
    try {
      await apiFetch(`/empresas/${schema}`, {
        method: "PUT",
        body: JSON.stringify(empresaData)
      });

      // Disparar evento para que el Navbar/Layout actualice nombre y logo en tiempo real
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("empresa-perfil-actualizado"));
      }

      Swal.fire({
        icon: "success",
        title: "Datos de la Empresa Actualizados",
        text: "La información institucional, NIT y logotipos se guardaron correctamente.",
        background: resolvedTheme === "dark" ? "#0f172a" : "#ffffff",
        color: resolvedTheme === "dark" ? "#f8fafc" : "#0f172a",
        confirmButtonColor: "#f59e0b",
        timer: 1800,
        showConfirmButton: false
      });
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al actualizar empresa",
        text: err.message,
        background: resolvedTheme === "dark" ? "#0f172a" : "#ffffff",
        color: resolvedTheme === "dark" ? "#f8fafc" : "#0f172a",
        confirmButtonColor: "#f59e0b"
      });
    } finally {
      setSavingEmpresa(false);
    }
  };

  // Manejador de subida de Logo (Compatible con SVG, PNG, JPG, JPEG, WebP y GIF)
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Resetear valor para permitir volver a seleccionar el mismo archivo si se desea
    e.target.value = "";

    const fileName = file.name.toLowerCase();
    const isSvg = fileName.endsWith(".svg") || file.type.includes("svg") || file.type === "image/svg+xml";
    const isStandardImg = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg|ico)$/i.test(fileName);

    if (!isSvg && !isStandardImg) {
      Swal.fire({
        icon: "error",
        title: "Formato no compatible",
        text: "Por favor selecciona un archivo de imagen válido: SVG (Vectorial), PNG, JPG, JPEG o WebP.",
        background: resolvedTheme === "dark" ? "#0f172a" : "#ffffff",
        color: resolvedTheme === "dark" ? "#f8fafc" : "#0f172a",
        confirmButtonColor: "#f59e0b"
      });
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      Swal.fire({
        icon: "warning",
        title: "Archivo muy pesado",
        text: "El tamaño máximo permitido para el logotipo corporativo es de 3 MB.",
        background: resolvedTheme === "dark" ? "#0f172a" : "#ffffff",
        color: resolvedTheme === "dark" ? "#f8fafc" : "#0f172a",
        confirmButtonColor: "#f59e0b"
      });
      return;
    }

    setLogoUploading(true);
    setLogoError(false);

    try {
      if (isSvg) {
        // 1. Procesamiento especializado para archivos SVG Vectoriales
        const textContent = await file.text();
        
        if (!textContent.includes("<svg") && !textContent.includes("<SVG")) {
          throw new Error("El archivo seleccionado no contiene una estructura SVG válida.");
        }

        // Asegurar que el elemento <svg> tenga el atributo xmlns obligatorio para renderizarse en etiquetas <img>
        let sanitizedSvg = textContent;
        if (!sanitizedSvg.includes('xmlns="http://www.w3.org/2000/svg"')) {
          sanitizedSvg = sanitizedSvg.replace(/<svg\b([^>]*)>/i, '<svg xmlns="http://www.w3.org/2000/svg" $1>');
        }

        // Convertir a Data URL Base64 con soporte UTF-8 completo
        let base64Svg: string;
        try {
          base64Svg = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(sanitizedSvg)));
        } catch {
          base64Svg = "data:image/svg+xml;utf8," + encodeURIComponent(sanitizedSvg);
        }

        // Validar pre-renderizado en un objeto Image en memoria
        const testImg = new Image();
        testImg.onload = () => {
          setEmpresaData(prev => ({ ...prev, logo_base64: base64Svg }));
          setLogoUploading(false);
          setLogoError(false);
        };
        testImg.onerror = () => {
          // Fallback a UTF-8 URI encoding si Base64 estricto falla en el motor del navegador
          const utf8Url = "data:image/svg+xml;utf8," + encodeURIComponent(sanitizedSvg);
          const fallbackImg = new Image();
          fallbackImg.onload = () => {
            setEmpresaData(prev => ({ ...prev, logo_base64: utf8Url }));
            setLogoUploading(false);
            setLogoError(false);
          };
          fallbackImg.onerror = () => {
            setLogoUploading(false);
            setLogoError(true);
            Swal.fire({
              icon: "error",
              title: "Error al interpretar SVG",
              text: "No se pudo renderizar el archivo vectorial SVG. Verifica que el código XML sea válido.",
              background: resolvedTheme === "dark" ? "#0f172a" : "#ffffff",
              color: resolvedTheme === "dark" ? "#f8fafc" : "#0f172a",
              confirmButtonColor: "#f59e0b"
            });
          };
          fallbackImg.src = utf8Url;
        };
        testImg.src = base64Svg;

      } else {
        // 2. Procesamiento para imágenes convencionales (PNG, JPG, JPEG, WebP, GIF)
        const reader = new FileReader();
        reader.onload = () => {
          let resultStr = reader.result as string;

          // Si el navegador no detectó el MIME type correcto y generó data:;base64,
          if (resultStr.startsWith("data:;base64,") || resultStr.startsWith("data:application/octet-stream;base64,")) {
            let mime = "image/png";
            if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) mime = "image/jpeg";
            else if (fileName.endsWith(".webp")) mime = "image/webp";
            else if (fileName.endsWith(".gif")) mime = "image/gif";
            resultStr = resultStr.replace(/^data:[^;]*;base64,/, `data:${mime};base64,`);
          }

          // Pre-validar imagen en memoria
          const testImg = new Image();
          testImg.onload = () => {
            setEmpresaData(prev => ({ ...prev, logo_base64: resultStr }));
            setLogoUploading(false);
            setLogoError(false);
          };
          testImg.onerror = () => {
            setLogoUploading(false);
            setLogoError(true);
            Swal.fire({
              icon: "error",
              title: "Imagen no válida",
              text: "No se pudo decodificar el archivo de imagen. Intenta con un archivo PNG o JPG válido.",
              background: resolvedTheme === "dark" ? "#0f172a" : "#ffffff",
              color: resolvedTheme === "dark" ? "#f8fafc" : "#0f172a",
              confirmButtonColor: "#f59e0b"
            });
          };
          testImg.src = resultStr;
        };
        reader.onerror = () => {
          setLogoUploading(false);
          setLogoError(true);
        };
        reader.readAsDataURL(file);
      }
    } catch (err: any) {
      setLogoUploading(false);
      setLogoError(true);
      Swal.fire({
        icon: "error",
        title: "Error al procesar archivo",
        text: err.message || "Ocurrió un error al leer el archivo seleccionado.",
        background: resolvedTheme === "dark" ? "#0f172a" : "#ffffff",
        color: resolvedTheme === "dark" ? "#f8fafc" : "#0f172a",
        confirmButtonColor: "#f59e0b"
      });
    }
  };

  // Guardar parámetros de liquidación
  const handleSaveParametros = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingParametros(true);
    const sanitizedForm = {
      ...formData,
      merma_tolerancia_diesel_pct: Number(formData.merma_tolerancia_diesel_pct) || 0,
      merma_tolerancia_gasolina_pct: Number(formData.merma_tolerancia_gasolina_pct) || 0,
      merma_tolerancia_iya_pct: Number(formData.merma_tolerancia_iya_pct) || 0,
      precio_merma_general_bs: Number(formData.precio_merma_general_bs) || 0,
      tipo_cambio_usd_bob: Number(formData.tipo_cambio_usd_bob) || 6.96,
      comision_usd_m3: Number(formData.comision_usd_m3) || 0,
      comision_pct_1: Number(formData.comision_pct_1) || 0,
      comision_ypfb_bolgart_pct: Number(formData.comision_ypfb_bolgart_pct) || 0,
      comision_pct_2: Number(formData.comision_pct_2) || 0,
      costo_hojas_de_ruta_bs: Number(formData.costo_hojas_de_ruta_bs) || 0,
      costo_gps_bs: Number(formData.costo_gps_bs) || 0,
    };
    try {
      await apiFetch(`/tenants/${schema}/parametros/`, {
        method: "PUT",
        body: JSON.stringify(sanitizedForm)
      });
      Swal.fire({
        icon: "success",
        title: "Parámetros Guardados",
        text: "Los porcentajes y deducciones se aplicarán a los cálculos de flete y planillas.",
        background: resolvedTheme === "dark" ? "#0f172a" : "#ffffff",
        color: resolvedTheme === "dark" ? "#f8fafc" : "#0f172a",
        confirmButtonColor: "#f59e0b",
        timer: 1800,
        showConfirmButton: false
      });
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al guardar parámetros",
        text: err.message,
        background: resolvedTheme === "dark" ? "#0f172a" : "#ffffff",
        color: resolvedTheme === "dark" ? "#f8fafc" : "#0f172a",
        confirmButtonColor: "#f59e0b"
      });
    } finally {
      setSavingParametros(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-32 gap-3">
        <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
        <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold tracking-wider uppercase">
          Cargando Configuración y Datos...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-7 max-w-6xl mx-auto font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* Banner de Encabezado Ejecutivo */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-lg dark:shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-5 transition-colors duration-200">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/30 flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-500/10">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Configuración del Sistema
              </h1>
              <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                {empresaData.name || schema}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Datos institucionales de la empresa, apariencia visual (modo claro/oscuro) y parámetros técnicos YPFB
            </p>
          </div>
        </div>

        {/* Pestañas de Navegación de Configuración */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("empresa")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition ${
              activeTab === "empresa"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Empresa</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("tema")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition ${
              activeTab === "tema"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Tema y Modo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("parametros")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition ${
              activeTab === "parametros"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Fuel className="w-3.5 h-3.5" />
            <span>Parámetros YPFB</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* PESTAÑA 1: DATOS INSTITUCIONALES DE LA EMPRESA (VALIDADOS) */}
      {/* ======================================================== */}
      {activeTab === "empresa" && (
        <form onSubmit={handleSaveEmpresa} className="space-y-6">
          <div className="bg-white dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 transition-colors duration-200">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Perfil y Datos Institucionales de la Empresa
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Información legal y logotipo que se imprimen en los reportes, planillas oficiales y navbar
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingEmpresa}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black shadow-md shadow-amber-500/20 transition active:scale-95 disabled:opacity-50 self-start sm:self-auto"
              >
                <Save className="w-4 h-4 stroke-[3]" />
                <span>{savingEmpresa ? "Guardando..." : "Guardar Datos de Empresa"}</span>
              </button>
            </div>

            {/* SECCIÓN DE LOGOTIPO DE LA EMPRESA */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-5">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-28 h-28 rounded-2xl bg-white dark:bg-slate-900 border-2 border-dashed border-amber-500/50 hover:border-amber-500 p-2.5 flex items-center justify-center shadow-inner flex-shrink-0 overflow-hidden relative group cursor-pointer transition-all hover:scale-105"
                title="Haz clic para seleccionar o cambiar el logotipo"
              >
                {logoUploading ? (
                  <div className="flex flex-col items-center justify-center gap-1.5 text-amber-500">
                    <div className="w-6 h-6 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Procesando...</span>
                  </div>
                ) : empresaData.logo_base64 && !logoError ? (
                  <>
                    <img 
                      src={empresaData.logo_base64} 
                      alt="Logo Empresa" 
                      className="w-full h-full object-contain"
                      onError={() => setLogoError(true)}
                    />
                    <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold gap-1">
                      <Upload className="w-4 h-4 text-amber-400" />
                      <span>Cambiar</span>
                    </div>
                  </>
                ) : (
                  <>
                    <img 
                      src="/rengifo_logo_icon.svg" 
                      alt="Logo Predeterminado" 
                      className="w-full h-full object-contain opacity-80"
                    />
                    <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold gap-1">
                      <Upload className="w-4 h-4 text-amber-400" />
                      <span>Subir</span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex-1 text-center sm:text-left space-y-2">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Logotipo Corporativo / Membrete
                  </h4>
                  {empresaData.logo_base64 && !logoError && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      <Check className="w-3 h-3 stroke-[3]" />
                      {empresaData.logo_base64.includes("image/svg+xml") ? "SVG Vectorial" : "Imagen Cargada"}
                    </span>
                  )}
                  {logoError && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                      <AlertCircle className="w-3 h-3" />
                      Archivo no compatible o dañado
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Admite archivos vectoriales <b>.SVG</b> y formatos convencionales <b>.PNG</b>, <b>.JPG</b>, <b>.JPEG</b> o <b>.WebP</b> (máx. 3 MB). Se visualiza con alta nitidez en el navbar, sidebar y hojas oficiales.
                </p>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLogoUpload}
                    accept="image/svg+xml,image/png,image/jpeg,image/webp,image/gif,.svg,.png,.jpg,.jpeg,.webp,.gif"
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={logoUploading}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-700 dark:text-slate-300 text-xs font-bold transition shadow-xs active:scale-95 disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{empresaData.logo_base64 ? "Cambiar Logotipo" : "Subir Logotipo"}</span>
                  </button>

                  {empresaData.logo_base64 && (
                    <button
                      type="button"
                      onClick={() => {
                        setEmpresaData(prev => ({ ...prev, logo_base64: "" }));
                        setLogoError(false);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-bold transition active:scale-95"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Restaurar Predeterminado</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* FORMULARIO DE DATOS INSTITUCIONALES (SOLO LO RELEVANTE) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              
              {/* Razón Social / Nombre Comercial */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Nombre Comercial / Razón Social <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={empresaData.name}
                  onChange={(e) => {
                    setEmpresaData({ ...empresaData, name: e.target.value });
                    if (empresaErrors.name) setEmpresaErrors({ ...empresaErrors, name: "" });
                  }}
                  placeholder="Ej. TRANSPORTES INTERNACIONALES RENGIFO LTDA."
                  className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none transition ${
                    empresaErrors.name ? "border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/30" : "border-slate-300 dark:border-slate-800 focus:border-amber-500"
                  }`}
                />
                {empresaErrors.name && (
                  <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{empresaErrors.name}</span>
                  </p>
                )}
              </div>

              {/* Representante Legal */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Representante Legal / Gerente General <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={empresaData.representante_legal}
                  onChange={(e) => {
                    setEmpresaData({ ...empresaData, representante_legal: e.target.value });
                    if (empresaErrors.representante_legal) setEmpresaErrors({ ...empresaErrors, representante_legal: "" });
                  }}
                  placeholder="Ej. JAQUELINE LOVERA TIÑINI"
                  className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none transition ${
                    empresaErrors.representante_legal ? "border-rose-500 focus:border-rose-500" : "border-slate-300 dark:border-slate-800 focus:border-amber-500"
                  }`}
                />
                {empresaErrors.representante_legal && (
                  <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{empresaErrors.representante_legal}</span>
                  </p>
                )}
              </div>

              {/* Asociación Matriz */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Asociación de Transporte a la que pertenece
                </label>
                <select
                  value={empresaData.asociacion_id === null ? "" : empresaData.asociacion_id}
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value, 10) : null;
                    setEmpresaData({ ...empresaData, asociacion_id: val });
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="">Empresa Independiente (Sin Asociación Matriz)</option>
                  {asociaciones.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.sigla || "ASOC"})
                    </option>
                  ))}
                </select>
              </div>

            </div>

            {/* Botón inferior de guardar empresa */}
            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="submit"
                disabled={savingEmpresa}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 flex items-center gap-2 transition active:scale-95 disabled:opacity-50"
              >
                <Save className="w-4 h-4 stroke-[3]" />
                <span>{savingEmpresa ? "Guardando..." : "Guardar Cambios de la Empresa"}</span>
              </button>
            </div>

          </div>
        </form>
      )}

      {/* ======================================================== */}
      {/* PESTAÑA 2: MODO CLARO / OSCURO (APARIENCIA VISUAL)        */}
      {/* ======================================================== */}
      {activeTab === "tema" && (
        <div className="bg-white dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 transition-colors duration-200">
          
          <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
              <Sun className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Apariencia Visual y Tema del Sistema
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Selecciona la apariencia preferida para el panel operativo, hojas de conciliación y navegación
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* Opción 1: MODO OSCURO */}
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`p-5 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between group ${
                theme === "dark"
                  ? "border-amber-500 bg-slate-900 text-white shadow-xl shadow-amber-500/10 ring-2 ring-amber-500/20"
                  : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white hover:border-amber-500/50"
              }`}
            >
              {theme === "dark" && (
                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
              )}

              <div>
                <div className="w-10 h-10 rounded-xl bg-slate-800 text-amber-400 border border-slate-700 flex items-center justify-center mb-3">
                  <Moon className="w-5 h-5" />
                </div>
                <h4 className={`text-sm font-black mb-1 ${theme === "dark" ? "text-white" : "text-slate-900 dark:text-white"}`}>
                  Modo Oscuro (Dark Mode)
                </h4>
                <p className={`text-xs leading-relaxed ${theme === "dark" ? "text-slate-400" : "text-slate-600 dark:text-slate-400"}`}>
                  Interfaz ejecutiva de alto contraste con tonos pizarra profunda y acentos ámbar. Diseñado para trabajo continuo y menor fatiga visual.
                </p>
              </div>

              {/* Wireframe Mockup Oscuro */}
              <div className="mt-4 p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-2 rounded bg-amber-500/80" />
                  <div className="w-4 h-4 rounded bg-slate-800" />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="h-6 rounded bg-slate-900 border border-slate-800" />
                  <div className="h-6 rounded bg-slate-900 border border-slate-800" />
                </div>
              </div>
            </button>

            {/* Opción 2: MODO CLARO */}
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`p-5 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between group ${
                theme === "light"
                  ? "border-amber-500 bg-amber-500/10 text-slate-900 dark:text-white shadow-xl shadow-amber-500/10 ring-2 ring-amber-500/20"
                  : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white hover:border-amber-500/50"
              }`}
            >
              {theme === "light" && (
                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
              )}

              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30 flex items-center justify-center mb-3">
                  <Sun className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white mb-1">
                  Modo Claro (Light Mode)
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Diseño diurno impecable con fondos nítidos y tipografía legible. Ideal para entornos luminosos y visualización impresa.
                </p>
              </div>

              {/* Wireframe Mockup Claro */}
              <div className="mt-4 p-2.5 rounded-xl bg-slate-100 border border-slate-300 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-2 rounded bg-amber-500" />
                  <div className="w-4 h-4 rounded bg-slate-300" />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="h-6 rounded bg-white border border-slate-200" />
                  <div className="h-6 rounded bg-white border border-slate-200" />
                </div>
              </div>
            </button>

            {/* Opción 3: AUTOMÁTICO (SISTEMA) */}
            <button
              type="button"
              onClick={() => setTheme("system")}
              className={`p-5 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between group ${
                theme === "system"
                  ? "border-amber-500 bg-amber-500/10 text-slate-900 dark:text-white shadow-xl shadow-amber-500/10 ring-2 ring-amber-500/20"
                  : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white hover:border-amber-500/50"
              }`}
            >
              {theme === "system" && (
                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
              )}

              <div>
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 flex items-center justify-center mb-3">
                  <Laptop className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white mb-1">
                  Automático (Sistema)
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Sigue automáticamente la configuración de tu sistema operativo Windows o navegador web (día/noche).
                </p>
              </div>

              {/* Wireframe Mockup Híbrido */}
              <div className="mt-4 p-2.5 rounded-xl bg-gradient-to-r from-slate-100 to-slate-950 border border-slate-300 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-2 rounded bg-amber-500" />
                  <div className="w-4 h-4 rounded bg-slate-400/50" />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="h-6 rounded bg-white/80" />
                  <div className="h-6 rounded bg-slate-900" />
                </div>
              </div>
            </button>

          </div>

          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-3">
            <Info className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span>
              <b>Nota:</b> Puedes alternar rápidamente entre modo claro y oscuro en cualquier momento haciendo clic en el icono de sol/luna ubicado en la esquina superior derecha del navbar.
            </span>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* PESTAÑA 3: PARÁMETROS TÉCNICOS Y NORMATIVA YPFB           */}
      {/* ======================================================== */}
      {activeTab === "parametros" && (
        <form onSubmit={handleSaveParametros} className="space-y-6">
          
          {/* BLOQUE 1: SUSTENTO LEGAL Y NORMATIVO */}
          <div className="bg-white dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 transition-colors duration-200">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  1. Marco Legal y Cláusula Contractual de Liquidación
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Régimen tributario y de hidrocarburos del Estado Plurinacional</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-200 leading-relaxed flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <b>Base Legal Aplicable:</b> Los contratos de flete de hidrocarburos con YPFB se rigen bajo la Ley 843 (Art. 4) que establece el momento de perfeccionamiento del hecho generador tras la conciliación de mermas y acta de conformidad. Las deducciones del 7% y BOL-GART responden a fondos de retención de garantía y cobertura logística.
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                Leyenda Legal al Pie de la Planilla
              </label>
              <textarea
                rows={3}
                value={formData.leyenda_legal}
                onChange={(e) => setFormData({ ...formData, leyenda_legal: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 leading-relaxed"
              />
            </div>
          </div>

          {/* BLOQUE 2: TOLERANCIAS DE MERMA Y PRECIOS */}
          <div className="bg-white dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 transition-colors duration-200">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
                <Fuel className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  2. Porcentajes de Tolerancia de Merma y Factores de Descuento
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Límites permisibles de evaporación y transporte por tipo de producto</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                  Tolerancia Diesel (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.merma_tolerancia_diesel_pct}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFormData({ ...formData, merma_tolerancia_diesel_pct: v === "" ? ("" as any) : v });
                  }}
                  onBlur={(e) => {
                    if (e.target.value === "" || isNaN(Number(e.target.value))) {
                      setFormData((prev) => ({ ...prev, merma_tolerancia_diesel_pct: 0 }));
                    }
                  }}
                  placeholder="0.15"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Estándar YPFB: 0.15%</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                  Tolerancia Gasolina (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.merma_tolerancia_gasolina_pct}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFormData({ ...formData, merma_tolerancia_gasolina_pct: v === "" ? ("" as any) : v });
                  }}
                  onBlur={(e) => {
                    if (e.target.value === "" || isNaN(Number(e.target.value))) {
                      setFormData((prev) => ({ ...prev, merma_tolerancia_gasolina_pct: 0 }));
                    }
                  }}
                  placeholder="0.25"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Estándar YPFB: 0.25%</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                  Tolerancia Insumos y Aditivos (IYA %)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.merma_tolerancia_iya_pct}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFormData({ ...formData, merma_tolerancia_iya_pct: v === "" ? ("" as any) : v });
                  }}
                  onBlur={(e) => {
                    if (e.target.value === "" || isNaN(Number(e.target.value))) {
                      setFormData((prev) => ({ ...prev, merma_tolerancia_iya_pct: 0 }));
                    }
                  }}
                  placeholder="0.20"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Estándar: 0.20%</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                  Factor Precio Merma General (Bs/Litro)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.precio_merma_general_bs}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFormData({ ...formData, precio_merma_general_bs: v === "" ? ("" as any) : v });
                  }}
                  onBlur={(e) => {
                    if (e.target.value === "" || isNaN(Number(e.target.value))) {
                      setFormData((prev) => ({ ...prev, precio_merma_general_bs: 0 }));
                    }
                  }}
                  placeholder="7.45"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Valor contractual aplicado en Hoja 2 del PDF (7.45 Bs)</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                  Tipo de Cambio Oficial (USD a BOB)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.tipo_cambio_usd_bob}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFormData({ ...formData, tipo_cambio_usd_bob: v === "" ? ("" as any) : v });
                  }}
                  onBlur={(e) => {
                    if (e.target.value === "" || isNaN(Number(e.target.value))) {
                      setFormData((prev) => ({ ...prev, tipo_cambio_usd_bob: 6.96 }));
                    }
                  }}
                  placeholder="6.96"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">T/C de conversión para tarifas y comisiones (6.96 Bs)</span>
              </div>
            </div>
          </div>

          {/* BLOQUE 3: COMISIONES Y DEDUCCIONES ESTÁNDAR */}
          <div className="bg-white dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 transition-colors duration-200">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  3. Descuentos y Deducciones del Líquido Pagable
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Comisiones porcentuales, retenciones impositivas y costos logísticos</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                  Comisión 1 ($us por m³)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.comision_usd_m3}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFormData({ ...formData, comision_usd_m3: v === "" ? ("" as any) : v });
                  }}
                  onBlur={(e) => {
                    if (e.target.value === "" || isNaN(Number(e.target.value))) {
                      setFormData((prev) => ({ ...prev, comision_usd_m3: 0 }));
                    }
                  }}
                  placeholder="1.00"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Cobro por metro cúbico (1 $us/m3)</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                  Descuento Comisión 7% (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.comision_pct_1}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFormData({ ...formData, comision_pct_1: v === "" ? ("" as any) : v });
                  }}
                  onBlur={(e) => {
                    if (e.target.value === "" || isNaN(Number(e.target.value))) {
                      setFormData((prev) => ({ ...prev, comision_pct_1: 0 }));
                    }
                  }}
                  placeholder="7.00"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Retención Impositiva y Logística</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                  Descuento YPFB BOL-GART 7% (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.comision_ypfb_bolgart_pct}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFormData({ ...formData, comision_ypfb_bolgart_pct: v === "" ? ("" as any) : v });
                  }}
                  onBlur={(e) => {
                    if (e.target.value === "" || isNaN(Number(e.target.value))) {
                      setFormData((prev) => ({ ...prev, comision_ypfb_bolgart_pct: 0 }));
                    }
                  }}
                  placeholder="7.00"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Boleta de Garantía de Transporte</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                  Descuento Comisión 3% (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.comision_pct_2}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFormData({ ...formData, comision_pct_2: v === "" ? ("" as any) : v });
                  }}
                  onBlur={(e) => {
                    if (e.target.value === "" || isNaN(Number(e.target.value))) {
                      setFormData((prev) => ({ ...prev, comision_pct_2: 0 }));
                    }
                  }}
                  placeholder="3.00"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Gestión Operativa</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                  Costo Hojas de Ruta (Bs Fijo)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.costo_hojas_de_ruta_bs}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFormData({ ...formData, costo_hojas_de_ruta_bs: v === "" ? ("" as any) : v });
                  }}
                  onBlur={(e) => {
                    if (e.target.value === "" || isNaN(Number(e.target.value))) {
                      setFormData((prev) => ({ ...prev, costo_hojas_de_ruta_bs: 0 }));
                    }
                  }}
                  placeholder="240.00"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Valorado ANH/Tránsito: 240.00 Bs</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                  Costo GPS / Precintos (Bs Fijo)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.costo_gps_bs}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFormData({ ...formData, costo_gps_bs: v === "" ? ("" as any) : v });
                  }}
                  onBlur={(e) => {
                    if (e.target.value === "" || isNaN(Number(e.target.value))) {
                      setFormData((prev) => ({ ...prev, costo_gps_bs: 0 }));
                    }
                  }}
                  placeholder="135.00"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Monitoreo Satelital: 135.00 Bs</span>
              </div>
            </div>
          </div>

          {/* BLOQUE 4: FIRMAS AUTORIZADAS */}
          <div className="bg-white dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 transition-colors duration-200">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  4. Personas Autorizadas para Firmas de Planilla
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Nombres y cargos que se imprimen en los 4 bloques de firma</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                  1. Realizado Por:
                </label>
                <input
                  type="text"
                  value={formData.firma_realizado_por}
                  onChange={(e) => setFormData({ ...formData, firma_realizado_por: e.target.value })}
                  placeholder="JAQUELINE LOVERA TIÑINI"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                  2. Revisado Por (Gerente General):
                </label>
                <input
                  type="text"
                  value={formData.firma_revisado_por}
                  onChange={(e) => setFormData({ ...formData, firma_revisado_por: e.target.value })}
                  placeholder="JOSE LOVERA TIÑINI / GERENTE GENERAL"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                  3. Autorizado Por:
                </label>
                <input
                  type="text"
                  value={formData.firma_autorizado_por}
                  onChange={(e) => setFormData({ ...formData, firma_autorizado_por: e.target.value })}
                  placeholder="DIRECTORIO"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                  4. Cancelado Por (Apoyo Administrativo):
                </label>
                <input
                  type="text"
                  value={formData.firma_cancelado_por}
                  onChange={(e) => setFormData({ ...formData, firma_cancelado_por: e.target.value })}
                  placeholder="TOMASA TIÑINI MITA / APOYO"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Botón Guardar Parámetros Inferior */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingParametros}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 flex items-center gap-2 transition active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4 stroke-[3]" />
              <span>{savingParametros ? "Guardando..." : "Guardar Todos los Parámetros"}</span>
            </button>
          </div>

        </form>
      )}

    </div>
  );
}
