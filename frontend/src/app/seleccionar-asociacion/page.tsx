"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Building2, 
  Plus, 
  ArrowRight, 
  Truck, 
  FileSpreadsheet, 
  Edit, 
  Trash2, 
  LogOut, 
  ShieldCheck, 
  Users, 
  Search, 
  Phone, 
  MapPin, 
  Mail, 
  X, 
  Sparkles, 
  Navigation, 
  Layers, 
  ChevronRight, 
  Fuel, 
  Scale, 
  TrendingUp,
  CircleDollarSign,
  Briefcase,
  User as UserIcon,
  ChevronDown
} from "lucide-react";
import Swal from "sweetalert2";
import { apiFetch } from "@/lib/api";
import { getCurrentUser, clearAuth, isAdmin, User } from "@/lib/auth";
import UserManagementModal from "@/components/UserManagementModal";
import ThemeToggle from "@/components/ThemeToggle";

interface Asociacion {
  id: number;
  name: string;
  sigla: string | null;
  nit: string | null;
  representante_legal: string | null;
  telefono: string | null;
  direccion: string | null;
  email: string | null;
  empresas: Array<{ id: number; name: string; schema_name: string }>;
}

interface Empresa {
  id: number;
  name: string;
  schema_name: string;
  nit: string | null;
  tipo_empresa?: string | null;
  asociacion_id: number | null;
  asociacion_name: string | null;
  representante_legal: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  icon: string | null;
}

interface ResumenGlobal {
  total_empresas: number;
  total_asociaciones: number;
  empresas_independientes: number;
  empresas_asociadas: number;
  total_camiones: number;
  total_viajes: number;
  total_volumen_litros: number;
  total_volumen_m3: number;
  total_fletes_bs: number;
  total_liquidaciones: number;
}

export default function SeleccionarAsociacionPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [asociaciones, setAsociaciones] = useState<Asociacion[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [resumen, setResumen] = useState<ResumenGlobal>({
    total_empresas: 0,
    total_asociaciones: 0,
    empresas_independientes: 0,
    empresas_asociadas: 0,
    total_camiones: 0,
    total_viajes: 0,
    total_volumen_litros: 0,
    total_volumen_m3: 0,
    total_fletes_bs: 0,
    total_liquidaciones: 0
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"todas" | "asociaciones" | "empresas">("todas");
  
  // Modales
  const [showAsocModal, setShowAsocModal] = useState(false);
  const [editingAsoc, setEditingAsoc] = useState<Asociacion | null>(null);
  
  const [showEmpresaModal, setShowEmpresaModal] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  
  const [showAsocRepDetails, setShowAsocRepDetails] = useState(false);
  const [showEmpRepDetails, setShowEmpRepDetails] = useState(false);
  
  const [showUserModal, setShowUserModal] = useState(false);

  // Formulario Asociación
  const [asocForm, setAsocForm] = useState({
    name: "",
    sigla: "",
    nit: "",
    representante_legal: "",
    telefono: "",
    direccion: "",
    email: ""
  });

  // Formulario Empresa
  const [empresaForm, setEmpresaForm] = useState({
    name: "",
    tipo_empresa: "Sociedad",
    nit: "",
    asociacion_id: "" as string | number,
    representante_legal: "",
    direccion: "",
    telefono: "",
    email: ""
  });

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.push("/");
      return;
    }
    setCurrentUser(user);
    loadAllData();
  }, [router]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [asocData, empData, resumenData] = await Promise.all([
        apiFetch("/asociaciones/"),
        apiFetch("/empresas/"),
        apiFetch("/empresas/resumen-global").catch(() => null)
      ]);
      setAsociaciones(asocData || []);
      setEmpresas(empData || []);
      if (resumenData) {
        setResumen(resumenData);
      }
    } catch (err: any) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Error al cargar datos",
        text: err.message,
        background: "#0f172a",
        color: "#ffffff"
      });
    } finally {
      setLoading(false);
    }
  };

  // --- Manejadores Asociación ---
  const handleOpenCreateAsoc = () => {
    setEditingAsoc(null);
    setAsocForm({
      name: "",
      sigla: "",
      nit: "",
      representante_legal: "",
      telefono: "",
      direccion: "",
      email: ""
    });
    setShowAsocRepDetails(false);
    setShowAsocModal(true);
  };

  const handleOpenEditAsoc = (asoc: Asociacion, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAsoc(asoc);
    setAsocForm({
      name: asoc.name,
      sigla: asoc.sigla || "",
      nit: asoc.nit || "",
      representante_legal: asoc.representante_legal || "",
      telefono: asoc.telefono || "",
      direccion: asoc.direccion || "",
      email: asoc.email || ""
    });
    setShowAsocRepDetails(Boolean(asoc.representante_legal || asoc.nit || asoc.telefono));
    setShowAsocModal(true);
  };

  const handleSubmitAsoc = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: asocForm.name.trim(),
        sigla: asocForm.sigla.trim() || null,
        nit: asocForm.nit.trim() || null,
        representante_legal: asocForm.representante_legal.trim() || null,
        telefono: asocForm.telefono.trim() || null,
        direccion: asocForm.direccion.trim() || null,
        email: asocForm.email.trim() || null
      };

      if (editingAsoc) {
        await apiFetch(`/asociaciones/${editingAsoc.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        Swal.fire({
          icon: "success",
          title: "Asociación actualizada",
          timer: 1200,
          showConfirmButton: false,
          background: "#0f172a",
          color: "#ffffff"
        });
      } else {
        await apiFetch("/asociaciones/", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        Swal.fire({
          icon: "success",
          title: "Asociación creada",
          timer: 1200,
          showConfirmButton: false,
          background: "#0f172a",
          color: "#ffffff"
        });
      }
      setShowAsocModal(false);
      loadAllData();
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al guardar asociación",
        text: err.message,
        background: "#0f172a",
        color: "#ffffff"
      });
    }
  };

  const handleDeleteAsoc = async (asoc: Asociacion, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await Swal.fire({
      title: `¿Eliminar "${asoc.name}"?`,
      text: "Las empresas que pertenecen a esta asociación quedarán como empresas independientes.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar asociación",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#334155",
      background: "#0f172a",
      color: "#ffffff"
    });

    if (res.isConfirmed) {
      try {
        await apiFetch(`/asociaciones/${asoc.id}`, { method: "DELETE" });
        Swal.fire({
          icon: "success",
          title: "Asociación eliminada",
          timer: 1200,
          showConfirmButton: false,
          background: "#0f172a",
          color: "#ffffff"
        });
        loadAllData();
      } catch (err: any) {
        Swal.fire({
          icon: "error",
          title: "Error al eliminar",
          text: err.message,
          background: "#0f172a",
          color: "#ffffff"
        });
      }
    }
  };

  // --- Manejadores Empresa ---
  const handleOpenCreateEmpresa = (asocId?: number) => {
    setEditingEmpresa(null);
    setEmpresaForm({
      name: "",
      tipo_empresa: "Sociedad",
      nit: "",
      asociacion_id: asocId || "",
      representante_legal: "",
      direccion: "",
      telefono: "",
      email: ""
    });
    setShowEmpRepDetails(false);
    setShowEmpresaModal(true);
  };

  const handleOpenEditEmpresa = (emp: Empresa, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEmpresa(emp);
    setEmpresaForm({
      name: emp.name,
      tipo_empresa: emp.tipo_empresa || "Sociedad",
      nit: emp.nit || "",
      asociacion_id: emp.asociacion_id !== null ? emp.asociacion_id : "",
      representante_legal: emp.representante_legal || "",
      direccion: emp.direccion || "",
      telefono: emp.telefono || "",
      email: emp.email || ""
    });
    setShowEmpRepDetails(Boolean(emp.representante_legal || emp.nit || emp.telefono));
    setShowEmpresaModal(true);
  };

  const handleSubmitEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: empresaForm.name.trim(),
        tipo_empresa: empresaForm.tipo_empresa,
        nit: empresaForm.nit.trim() || null,
        asociacion_id: empresaForm.asociacion_id !== "" ? Number(empresaForm.asociacion_id) : null,
        representante_legal: empresaForm.representante_legal.trim() || null,
        direccion: empresaForm.direccion.trim() || null,
        telefono: empresaForm.telefono.trim() || null,
        email: empresaForm.email.trim() || null
      };

      if (editingEmpresa) {
        await apiFetch(`/empresas/${editingEmpresa.schema_name}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        Swal.fire({
          icon: "success",
          title: "Empresa actualizada",
          timer: 1200,
          showConfirmButton: false,
          background: "#0f172a",
          color: "#ffffff"
        });
      } else {
        await apiFetch("/empresas/", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        Swal.fire({
          icon: "success",
          title: "¡Empresa creada con éxito!",
          text: "Su base de datos dedicada y parámetros técnicos han sido aprovisionados.",
          timer: 1400,
          showConfirmButton: false,
          background: "#0f172a",
          color: "#ffffff"
        });
      }
      setShowEmpresaModal(false);
      loadAllData();
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al guardar empresa",
        text: err.message,
        background: "#0f172a",
        color: "#ffffff"
      });
    }
  };

  const handleDeleteEmpresa = async (emp: Empresa, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await Swal.fire({
      title: `¿Eliminar "${emp.name}"?`,
      text: "Se eliminarán sus camiones, viajes y liquidaciones de forma permanente.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar empresa",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#334155",
      background: "#0f172a",
      color: "#ffffff"
    });

    if (res.isConfirmed) {
      try {
        await apiFetch(`/empresas/${emp.schema_name}`, { method: "DELETE" });
        Swal.fire({
          icon: "success",
          title: "Empresa eliminada",
          timer: 1200,
          showConfirmButton: false,
          background: "#0f172a",
          color: "#ffffff"
        });
        loadAllData();
      } catch (err: any) {
        Swal.fire({
          icon: "error",
          title: "Error al eliminar",
          text: err.message,
          background: "#0f172a",
          color: "#ffffff"
        });
      }
    }
  };

  const handleLogout = () => {
    clearAuth();
    router.push("/");
  };

  // Filtrado de búsquedas
  const filteredAsocs = asociaciones.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.sigla && a.sigla.toLowerCase().includes(search.toLowerCase())) ||
    (a.nit && a.nit.includes(search))
  );

  const filteredEmpresas = empresas.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.nit && e.nit.includes(search)) ||
    (e.asociacion_name && e.asociacion_name.toLowerCase().includes(search.toLowerCase()))
  );

  const isEmptySystem = asociaciones.length === 0 && empresas.length === 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950 transition-colors duration-200">
      
      {/* Luces sutiles de fondo */}
      <div className="fixed top-0 left-1/3 -translate-x-1/2 w-[700px] h-[350px] bg-amber-500/5 dark:bg-amber-500/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 translate-x-1/2 w-[600px] h-[300px] bg-blue-500/5 dark:bg-blue-600/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Barra Superior de Navegación (Pantalla Completa) */}
      <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-xs dark:shadow-md">
        <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 h-16 flex items-center justify-between gap-4">
          
          {/* Logo y Título Corporativo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 p-1.5 flex items-center justify-center shadow-md shadow-amber-500/10 flex-shrink-0">
              <img src="/rengifo_logo_icon.svg" alt="Rengifo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight flex items-center gap-2">
                <span>Rengifo Ltda. &bull; Directorio y Liquidaciones</span>
                <span className="hidden sm:inline-block text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/25">
                  Transporte &amp; Hidrocarburos
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Selección de Empresa de Transporte, Flota y Asociaciones
              </p>
            </div>
          </div>

          {/* Menú de Usuario & Controles */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Botón Gestión de Usuarios para Administradores */}
            {isAdmin(currentUser) && (
              <button
                onClick={() => setShowUserModal(true)}
                title="Gestión de Usuarios"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition"
              >
                <Users className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline">Usuarios</span>
              </button>
            )}

            {/* Alternador Global de Tema (Claro / Oscuro) */}
            <ThemeToggle />

            {/* Perfil de Usuario */}
            <div className="flex items-center gap-2.5 pl-1 border-l border-slate-200 dark:border-slate-800">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center justify-center flex-shrink-0">
                {currentUser?.name?.charAt(0) || "U"}
              </div>
              <div className="text-left hidden md:block">
                <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                  {currentUser?.name || "Administrador"}
                </div>
                <div className="text-[10px] text-amber-600 dark:text-amber-400/90 font-medium leading-tight">
                  {currentUser?.role === "admin" ? "Administrador General" : "Usuario Operador"}
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="Cerrar Sesión"
                className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-xl transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* Contenido Principal (Ancho Completo y Fluido) */}
      <main className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-8 flex-1 space-y-7 relative z-10">
        
        {/* MINI DASHBOARD EJECUTIVO (3 TARJETAS SIMÉTRICAS) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Tarjeta 1: Empresas */}
          <div className="p-6 rounded-2xl bg-white dark:bg-gradient-to-b dark:from-slate-900/90 dark:to-slate-950/90 border border-slate-200 dark:border-slate-800/90 hover:border-amber-500/40 transition-all shadow-sm dark:shadow-xl shadow-black/5 dark:shadow-black/30 flex flex-col justify-between min-h-[135px] group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Empresas de Transporte</span>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform shadow-inner">
                <Truck className="w-5 h-5" />
              </div>
            </div>
            <div className="my-2">
              <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {resumen.total_empresas}
              </div>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> {resumen.empresas_independientes} Independientes</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">{resumen.empresas_asociadas} Asociadas</span>
            </div>
          </div>

          {/* Tarjeta 2: Asociaciones */}
          <div className="p-6 rounded-2xl bg-white dark:bg-gradient-to-b dark:from-slate-900/90 dark:to-slate-950/90 border border-slate-200 dark:border-slate-800/90 hover:border-blue-500/40 transition-all shadow-sm dark:shadow-xl shadow-black/5 dark:shadow-black/30 flex flex-col justify-between min-h-[135px] group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Asociaciones & Cámaras</span>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform shadow-inner">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
            <div className="my-2">
              <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {resumen.total_asociaciones}
              </div>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Entidades gremiales</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">{resumen.total_asociaciones} Activas</span>
            </div>
          </div>

          {/* Tarjeta 3: Flota Total Cisternas */}
          <div className="p-6 rounded-2xl bg-white dark:bg-gradient-to-b dark:from-slate-900/90 dark:to-slate-950/90 border border-slate-200 dark:border-slate-800/90 hover:border-emerald-500/40 transition-all shadow-sm dark:shadow-xl shadow-black/5 dark:shadow-black/30 flex flex-col justify-between min-h-[135px] group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Flota de Cisternas</span>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform shadow-inner">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="my-2">
              <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {resumen.total_camiones}
              </div>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Unidades vehiculares</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{resumen.total_camiones} Registradas</span>
            </div>
          </div>

        </section>

        {/* Guía en Blanco si no hay empresas ni asociaciones */}
        {isEmptySystem && !loading && (
          <div className="p-8 bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-white rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden">
            <div className="relative z-10 max-w-4xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold mb-4">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Base de Datos Limpia • Lista para Datos Reales</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                ¡Bienvenido al Sistema de Liquidación de Transporte Rengifo!
              </h2>
              <p className="mt-2 text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                Comienza registrando tu primera empresa o asociación de transporte para habilitar su base de datos dedicada y cargar viajes.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-6">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
                  <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center mb-2">1</div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Crea tu Empresa</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Registra tu empresa o asociación de transporte.</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
                  <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center mb-2">2</div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Registra tus Camiones</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Añade placas, cisternas y conductores.</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
                  <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center mb-2">3</div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Carga de Viajes</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Importa desde Excel masivamente o registra manual.</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
                  <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center mb-2">4</div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Exporta Planillas</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Genera en 1 clic tus reportes Excel y PDF oficiales.</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-6">
                <button
                  onClick={() => handleOpenCreateEmpresa()}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Registrar Primera Empresa de Transporte</span>
                </button>
                <button
                  onClick={handleOpenCreateAsoc}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-white font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition flex items-center gap-2"
                >
                  <Building2 className="w-4 h-4" />
                  <span>Registrar Asociación / Sindicato</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* BUSCADOR PROMINENTE Y HERRAMIENTAS DE NAVEGACIÓN */}
        <div className="bg-white dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800/90 rounded-2xl p-5 shadow-sm dark:shadow-xl shadow-black/5 dark:shadow-black/30 space-y-4">
          
          {/* Fila 1: Buscador Principal de Gran Visibilidad */}
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="w-5 h-5 text-amber-500" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar empresa de transporte, asociación, sigla, NIT o representante legal..."
              className="w-full pl-12 pr-12 py-3.5 bg-slate-50 dark:bg-slate-950/90 border border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm rounded-xl focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition shadow-inner"
            />
            {search ? (
              <button
                onClick={() => setSearch("")}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
                title="Limpiar búsqueda"
              >
                <X className="w-5 h-5" />
              </button>
            ) : null}
          </div>

          {/* Fila 2: Filtros por Categoría y Botones de Creación */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            
            {/* Pestañas de Filtro Segmentadas */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-950/80 p-1 rounded-xl border border-slate-200 dark:border-slate-800/80 self-start sm:self-auto overflow-x-auto max-w-full">
              <button
                onClick={() => setActiveTab("todas")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
                  activeTab === "todas" ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>Todas</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${activeTab === "todas" ? "bg-slate-950/20 text-slate-950" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}>
                  {asociaciones.length + empresas.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("asociaciones")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
                  activeTab === "asociaciones" ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Asociaciones</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${activeTab === "asociaciones" ? "bg-slate-950/20 text-slate-950" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}>
                  {asociaciones.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("empresas")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
                  activeTab === "empresas" ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Empresas</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${activeTab === "empresas" ? "bg-slate-950/20 text-slate-950" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}>
                  {empresas.length}
                </span>
              </button>
            </div>

            {/* Acciones de Creación Primaria */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => handleOpenCreateEmpresa()}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Nueva Empresa</span>
              </button>
              <button
                onClick={handleOpenCreateAsoc}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/90 dark:hover:bg-slate-800 text-slate-800 dark:text-white font-bold text-xs rounded-xl border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 transition flex items-center justify-center gap-2"
              >
                <Building2 className="w-4 h-4 text-amber-500" />
                <span>Nueva Asociación</span>
              </button>
            </div>

          </div>

        </div>

        {/* SECCIÓN 1: ASOCIACIONES DE TRANSPORTE */}
        {(activeTab === "todas" || activeTab === "asociaciones") && filteredAsocs.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Asociaciones y Cámaras de Transporte
                </h3>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {filteredAsocs.length} {filteredAsocs.length === 1 ? "asociación" : "asociaciones"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5">
              {filteredAsocs.map((asoc) => (
                <div
                  key={asoc.id}
                  onClick={() => router.push(`/asociacion/${asoc.id}`)}
                  className="p-6 rounded-2xl bg-white dark:bg-gradient-to-b dark:from-slate-900/90 dark:to-slate-950/90 hover:from-slate-50 dark:hover:from-slate-850/90 border border-slate-200 dark:border-slate-800/90 hover:border-blue-500/50 shadow-sm dark:shadow-xl shadow-black/5 dark:shadow-black/40 hover:shadow-xl dark:hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 cursor-pointer flex flex-col justify-between group"
                >
                  <div className="space-y-4">
                    {/* Header de la tarjeta */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-sm flex-shrink-0 group-hover:scale-105 transition-transform shadow-inner">
                          {asoc.sigla ? asoc.sigla.slice(0, 3) : <Building2 className="w-6 h-6" />}
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400/90 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20 inline-block">
                            Asociación Gremial
                          </span>
                          <h4 className="text-base font-extrabold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors leading-snug line-clamp-1 mt-0.5">
                            {asoc.name}
                          </h4>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleOpenEditAsoc(asoc, e)}
                          title="Editar Asociación"
                          className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-lg transition"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteAsoc(asoc, e)}
                          title="Eliminar Asociación"
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata limpia y estilizada */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-850/80 space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                        <span>Empresas afiliadas:</span>
                        <span className="font-bold text-slate-800 dark:text-white bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          {asoc.empresas?.length || 0} afiliadas
                        </span>
                      </div>
                      {asoc.representante_legal ? (
                        <div className="flex items-center gap-2 truncate pt-1 border-t border-slate-200 dark:border-slate-900">
                          <UserIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                          <span className="text-slate-700 dark:text-slate-300 truncate font-medium">{asoc.representante_legal}</span>
                        </div>
                      ) : null}
                      {asoc.telefono ? (
                        <div className="flex items-center gap-2 pt-0.5">
                          <Phone className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                          <span className="text-slate-700 dark:text-slate-300 font-medium">{asoc.telefono}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Botón de Entrada */}
                  <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="w-full py-2.5 px-4 rounded-xl bg-blue-500/10 hover:bg-blue-600 text-blue-700 dark:text-blue-400 hover:text-white border border-blue-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs group-hover:shadow-blue-500/20">
                      <span>Ver Planilla Consolidada</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECCIÓN 2: EMPRESAS DE TRANSPORTE */}
        {(activeTab === "todas" || activeTab === "empresas") && filteredEmpresas.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Empresas de Transporte (Afiliadas e Independientes)
                </h3>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {filteredEmpresas.length} {filteredEmpresas.length === 1 ? "empresa" : "empresas"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5">
              {filteredEmpresas.map((emp) => (
                <div
                  key={emp.id}
                  onClick={() => router.push(`/${emp.schema_name}/dashboard`)}
                  className="p-6 rounded-2xl bg-white dark:bg-gradient-to-b dark:from-slate-900/90 dark:to-slate-950/90 hover:from-slate-50 dark:hover:from-slate-850/90 border border-slate-200 dark:border-slate-800/90 hover:border-amber-500/50 shadow-sm dark:shadow-xl shadow-black/5 dark:shadow-black/40 hover:shadow-xl dark:hover:shadow-2xl hover:shadow-amber-500/10 transition-all duration-300 cursor-pointer flex flex-col justify-between group"
                >
                  <div className="space-y-4">
                    {/* Header de la tarjeta */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform shadow-inner">
                          <Truck className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            {emp.tipo_empresa === "Unipersonal" ? (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 inline-flex items-center gap-1">
                                <UserIcon className="w-2.5 h-2.5" />
                                Unipersonal
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20 inline-flex items-center gap-1">
                                <Building2 className="w-2.5 h-2.5" />
                                Sociedad
                              </span>
                            )}
                            {emp.asociacion_name ? (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 inline-flex items-center gap-1">
                                <Building2 className="w-2.5 h-2.5" />
                                Asoc: {emp.asociacion_name}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 inline-flex items-center gap-1">
                                <ShieldCheck className="w-2.5 h-2.5" />
                                Independiente
                              </span>
                            )}
                          </div>
                          <h4 className="text-base font-extrabold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors leading-snug line-clamp-1 mt-0.5">
                            {emp.name}
                          </h4>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleOpenEditEmpresa(emp, e)}
                          title="Editar Empresa"
                          className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-lg transition"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteEmpresa(emp, e)}
                          title="Eliminar Empresa"
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata limpia y estilizada */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-850/80 space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                        <span>Esquema BD:</span>
                        <span className="font-mono text-amber-700 dark:text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                          {emp.schema_name}
                        </span>
                      </div>
                      {emp.representante_legal ? (
                        <div className="flex items-center gap-2 truncate pt-1 border-t border-slate-200 dark:border-slate-900">
                          <UserIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                          <span className="text-slate-700 dark:text-slate-300 truncate font-medium">{emp.representante_legal}</span>
                        </div>
                      ) : null}
                      {emp.telefono ? (
                        <div className="flex items-center gap-2 pt-0.5">
                          <Phone className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                          <span className="text-slate-700 dark:text-slate-300 font-medium">{emp.telefono}</span>
                        </div>
                      ) : null}
                      {!emp.representante_legal && !emp.telefono ? (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 italic pt-1 border-t border-slate-200 dark:border-slate-900 flex items-center gap-1.5">
                          <span>Base de datos activa y lista para viajes</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Botón de Entrada */}
                  <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="w-full py-2.5 px-4 rounded-xl bg-amber-500/10 hover:bg-amber-500 text-amber-700 dark:text-amber-400 hover:text-slate-950 border border-amber-500/30 font-black text-xs flex items-center justify-center gap-2 transition-all shadow-xs group-hover:shadow-amber-500/20">
                      <span>Ingresar a Operaciones</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sin resultados tras filtrar */}
        {!isEmptySystem && !loading && (filteredAsocs.length === 0 && filteredEmpresas.length === 0) && (
          <div className="text-center py-16 bg-white dark:bg-slate-900/60 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-xs">
            <Search className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No se encontraron resultados</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              No hay asociaciones ni empresas que coincidan con &quot;{search}&quot;.
            </p>
            <button
              onClick={() => setSearch("")}
              className="mt-4 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-xl text-xs font-semibold"
            >
              Limpiar búsqueda
            </button>
          </div>
        )}

      </main>

      {/* Modal Crear / Editar Asociación */}
      {showAsocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingAsoc ? "Editar Asociación" : "Nueva Asociación de Transporte"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Consolida empresas para la planilla oficial YPFB (Página 1)
                </p>
              </div>
              <button
                onClick={() => setShowAsocModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAsoc} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Nombre Completo de la Asociación *
                </label>
                <input
                  type="text"
                  required
                  value={asocForm.name}
                  onChange={(e) => setAsocForm({ ...asocForm, name: e.target.value })}
                  placeholder="ej. ASOCIACIÓN DE TRANSPORTISTAS ANDINA ASOCIADOS"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  autoFocus
                />
              </div>

              {/* Sección Opcional Desplegable: Datos del Representante */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowAsocRepDetails(!showAsocRepDetails)}
                  className="flex items-center justify-between w-full py-2 px-1 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition group"
                >
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-amber-500" />
                    <span>Datos del Representante (Opcional)</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 group-hover:text-amber-500 transition-transform duration-200 ${showAsocRepDetails ? "rotate-180 text-amber-500" : ""}`} />
                </button>

                {showAsocRepDetails && (
                  <div className="mt-2.5 space-y-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 animate-in fade-in">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                        Nombre del Representante
                      </label>
                      <input
                        type="text"
                        value={asocForm.representante_legal}
                        onChange={(e) => setAsocForm({ ...asocForm, representante_legal: e.target.value })}
                        placeholder="ej. Lic. Roberto Gómez"
                        className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                          C.I. / Documento
                        </label>
                        <input
                          type="text"
                          value={asocForm.nit}
                          onChange={(e) => setAsocForm({ ...asocForm, nit: e.target.value })}
                          placeholder="ej. 4839201 LP"
                          className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                          Teléfono / Celular
                        </label>
                        <input
                          type="text"
                          value={asocForm.telefono}
                          onChange={(e) => setAsocForm({ ...asocForm, telefono: e.target.value })}
                          placeholder="ej. 77012345"
                          className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAsocModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/20 transition"
                >
                  {editingAsoc ? "Guardar Cambios" : "Crear Asociación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Crear / Editar Empresa */}
      {showEmpresaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingEmpresa ? "Editar Empresa" : "Nueva Empresa de Transporte"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Crea un esquema PostgreSQL dedicado para gestionar sus viajes y fletes
                </p>
              </div>
              <button
                onClick={() => setShowEmpresaModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEmpresa} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Razón Social / Nombre Comercial *
                </label>
                <input
                  type="text"
                  required
                  value={empresaForm.name}
                  onChange={(e) => setEmpresaForm({ ...empresaForm, name: e.target.value })}
                  placeholder="ej. TRANSPORTE RENGIFO LTDA."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  autoFocus
                />
              </div>

              {/* Selector de Tipo de Empresa */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Tipo Jurídico de Empresa *
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEmpresaForm({ ...empresaForm, tipo_empresa: "Sociedad" })}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
                      empresaForm.tipo_empresa === "Sociedad"
                        ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-extrabold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Sociedad / Empresa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmpresaForm({ ...empresaForm, tipo_empresa: "Unipersonal" })}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
                      empresaForm.tipo_empresa === "Unipersonal"
                        ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-extrabold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <UserIcon className="w-3.5 h-3.5" />
                    <span>Unipersonal</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Asociación Gremial
                </label>
                <select
                  value={empresaForm.asociacion_id}
                  onChange={(e) => setEmpresaForm({ ...empresaForm, asociacion_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
                >
                  <option value="">(Empresa Independiente)</option>
                  {asociaciones.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.sigla ? `${a.sigla} - ${a.name}` : a.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sección Opcional Desplegable: Datos del Representante */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowEmpRepDetails(!showEmpRepDetails)}
                  className="flex items-center justify-between w-full py-2 px-1 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition group"
                >
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-amber-500" />
                    <span>Datos del Representante (Opcional)</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 group-hover:text-amber-500 transition-transform duration-200 ${showEmpRepDetails ? "rotate-180 text-amber-500" : ""}`} />
                </button>

                {showEmpRepDetails && (
                  <div className="mt-2.5 space-y-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 animate-in fade-in">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                        Nombre del Representante / Gerente
                      </label>
                      <input
                        type="text"
                        value={empresaForm.representante_legal}
                        onChange={(e) => setEmpresaForm({ ...empresaForm, representante_legal: e.target.value })}
                        placeholder="ej. Jhonny Rengifo"
                        className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                          C.I. / NIT
                        </label>
                        <input
                          type="text"
                          value={empresaForm.nit}
                          onChange={(e) => setEmpresaForm({ ...empresaForm, nit: e.target.value })}
                          placeholder="ej. 1613186"
                          className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                          Teléfono / Celular
                        </label>
                        <input
                          type="text"
                          value={empresaForm.telefono}
                          onChange={(e) => setEmpresaForm({ ...empresaForm, telefono: e.target.value })}
                          placeholder="ej. 62294912"
                          className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowEmpresaModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/20 transition"
                >
                  {editingEmpresa ? "Guardar Cambios" : "Crear Empresa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Gestión de Usuarios */}
      <UserManagementModal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
      />

    </div>
  );
}
