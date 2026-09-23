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
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Navigation,
  Layers,
  ChevronRight,
  Info
} from "lucide-react";
import Swal from "sweetalert2";
import { apiFetch } from "@/lib/api";
import { getCurrentUser, clearAuth, isAdmin, User } from "@/lib/auth";
import UserManagementModal from "@/components/UserManagementModal";

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
  asociacion_id: number | null;
  asociacion_name: string | null;
  representante_legal: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  icon: string | null;
}

export default function SeleccionarAsociacionPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [asociaciones, setAsociaciones] = useState<Asociacion[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"todas" | "asociaciones" | "empresas">("todas");
  
  // Modales
  const [showAsocModal, setShowAsocModal] = useState(false);
  const [editingAsoc, setEditingAsoc] = useState<Asociacion | null>(null);
  
  const [showEmpresaModal, setShowEmpresaModal] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  
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
      const [asocData, empData] = await Promise.all([
        apiFetch("/asociaciones/"),
        apiFetch("/empresas/")
      ]);
      setAsociaciones(asocData);
      setEmpresas(empData);
    } catch (err: any) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Error al cargar datos",
        text: err.message,
        background: "#ffffff",
        color: "#0f172a"
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
    setShowAsocModal(true);
  };

  const handleSubmitAsoc = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAsoc) {
        await apiFetch(`/asociaciones/${editingAsoc.id}`, {
          method: "PUT",
          body: JSON.stringify(asocForm)
        });
        Swal.fire({
          icon: "success",
          title: "Asociación actualizada",
          timer: 1200,
          showConfirmButton: false,
          background: "#ffffff",
          color: "#0f172a"
        });
      } else {
        await apiFetch("/asociaciones/", {
          method: "POST",
          body: JSON.stringify(asocForm)
        });
        Swal.fire({
          icon: "success",
          title: "Asociación creada exitosamente",
          timer: 1200,
          showConfirmButton: false,
          background: "#ffffff",
          color: "#0f172a"
        });
      }
      setShowAsocModal(false);
      loadAllData();
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al guardar asociación",
        text: err.message,
        background: "#ffffff",
        color: "#0f172a"
      });
    }
  };

  const handleDeleteAsoc = async (asoc: Asociacion, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await Swal.fire({
      title: `¿Eliminar "${asoc.name}"?`,
      text: "Las empresas afiliadas pasarán a ser independientes sin perder sus viajes ni camiones.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      background: "#ffffff",
      color: "#0f172a"
    });

    if (res.isConfirmed) {
      try {
        await apiFetch(`/asociaciones/${asoc.id}`, { method: "DELETE" });
        Swal.fire({
          icon: "success",
          title: "Asociación eliminada",
          timer: 1200,
          showConfirmButton: false,
          background: "#ffffff",
          color: "#0f172a"
        });
        loadAllData();
      } catch (err: any) {
        Swal.fire({
          icon: "error",
          title: "Error al eliminar",
          text: err.message,
          background: "#ffffff",
          color: "#0f172a"
        });
      }
    }
  };

  // --- Manejadores Empresa ---
  const handleOpenCreateEmpresa = (asocId?: number) => {
    setEditingEmpresa(null);
    setEmpresaForm({
      name: "",
      nit: "",
      asociacion_id: asocId || "",
      representante_legal: "",
      direccion: "",
      telefono: "",
      email: ""
    });
    setShowEmpresaModal(true);
  };

  const handleOpenEditEmpresa = (emp: Empresa, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEmpresa(emp);
    setEmpresaForm({
      name: emp.name,
      nit: emp.nit || "",
      asociacion_id: emp.asociacion_id !== null ? emp.asociacion_id : "",
      representante_legal: emp.representante_legal || "",
      direccion: emp.direccion || "",
      telefono: emp.telefono || "",
      email: emp.email || ""
    });
    setShowEmpresaModal(true);
  };

  const handleSubmitEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: empresaForm.name.trim(),
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
          background: "#ffffff",
          color: "#0f172a"
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
          background: "#ffffff",
          color: "#0f172a"
        });
      }
      setShowEmpresaModal(false);
      loadAllData();
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al guardar empresa",
        text: err.message,
        background: "#ffffff",
        color: "#0f172a"
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
      cancelButtonColor: "#64748b",
      background: "#ffffff",
      color: "#0f172a"
    });

    if (res.isConfirmed) {
      try {
        await apiFetch(`/empresas/${emp.schema_name}`, { method: "DELETE" });
        Swal.fire({
          icon: "success",
          title: "Empresa eliminada",
          timer: 1200,
          showConfirmButton: false,
          background: "#ffffff",
          color: "#0f172a"
        });
        loadAllData();
      } catch (err: any) {
        Swal.fire({
          icon: "error",
          title: "Error al eliminar",
          text: err.message,
          background: "#ffffff",
          color: "#0f172a"
        });
      }
    }
  };

  const handleResetDatabase = async () => {
    const res = await Swal.fire({
      title: "¿Limpiar todos los datos?",
      text: "Esta acción dejará la base de datos totalmente en blanco para que puedas ingresar tus datos reales desde cero. Se conservarán los usuarios del sistema.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, limpiar base de datos",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#e11d48",
      cancelButtonColor: "#64748b",
      background: "#ffffff",
      color: "#0f172a"
    });

    if (res.isConfirmed) {
      try {
        await apiFetch("/auth/reset-database", { method: "POST" });
        Swal.fire({
          icon: "success",
          title: "Base de datos limpia",
          text: "El sistema está listo para registrar tus empresas y viajes reales.",
          background: "#ffffff",
          color: "#0f172a"
        });
        loadAllData();
      } catch (err: any) {
        Swal.fire({
          icon: "error",
          title: "Error al limpiar",
          text: err.message,
          background: "#ffffff",
          color: "#0f172a"
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
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      
      {/* Barra Superior de Navegación */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight flex items-center gap-2">
                <span>Sistema de Liquidación de Pagos</span>
                <span className="hidden sm:inline-block text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                  Transporte & Hidrocarburos
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Selección de Espacio de Trabajo y Directorio Operativo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Gestión de Usuarios */}
            {currentUser && isAdmin(currentUser) && (
              <>
                <button
                  onClick={() => setShowUserModal(true)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                  title="Administrar usuarios y permisos"
                >
                  <Users className="w-4 h-4 text-slate-600" />
                  <span>Usuarios</span>
                </button>

                <button
                  onClick={handleResetDatabase}
                  className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition"
                  title="Reiniciar y limpiar todos los datos"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Limpiar Datos</span>
                </button>
              </>
            )}

            {/* Usuario Actual & Salir */}
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
              <div className="text-right hidden md:block">
                <div className="text-xs font-bold text-slate-900">{currentUser?.name}</div>
                <div className="text-[11px] text-slate-500 font-medium">
                  {currentUser?.role === "admin" ? "Administrador General" : "Operador"}
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="Cerrar Sesión"
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* Contenido Principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        
        {/* Banner de Inicio / Estado Limpio */}
        {isEmptySystem && !loading && (
          <div className="p-8 bg-gradient-to-br from-blue-900 via-slate-900 to-indigo-950 text-white rounded-3xl shadow-xl relative overflow-hidden">
            <div className="relative z-10 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-semibold mb-4">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Base de Datos Limpia • Lista para Operar</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                ¡Bienvenido a tu Sistema de Liquidación de Transporte!
              </h2>
              <p className="mt-2 text-slate-300 text-sm leading-relaxed">
                El sistema ha sido configurado en limpio para que ingreses tu información real desde cero. Sigue estos sencillos pasos:
              </p>

              {/* Guía en 4 pasos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-6">
                <div className="bg-white/10 backdrop-blur-xs p-4 rounded-2xl border border-white/10">
                  <div className="w-7 h-7 rounded-lg bg-blue-500 text-white font-bold text-xs flex items-center justify-center mb-2">1</div>
                  <h4 className="text-xs font-bold text-white">Crea tu Empresa</h4>
                  <p className="text-[11px] text-slate-300 mt-1">Registra tu empresa o asociación de transporte.</p>
                </div>
                <div className="bg-white/10 backdrop-blur-xs p-4 rounded-2xl border border-white/10">
                  <div className="w-7 h-7 rounded-lg bg-blue-500 text-white font-bold text-xs flex items-center justify-center mb-2">2</div>
                  <h4 className="text-xs font-bold text-white">Registra tus Camiones</h4>
                  <p className="text-[11px] text-slate-300 mt-1">Añade placas, cisternas y conductores.</p>
                </div>
                <div className="bg-white/10 backdrop-blur-xs p-4 rounded-2xl border border-white/10">
                  <div className="w-7 h-7 rounded-lg bg-blue-500 text-white font-bold text-xs flex items-center justify-center mb-2">3</div>
                  <h4 className="text-xs font-bold text-white">Carga de Viajes</h4>
                  <p className="text-[11px] text-slate-300 mt-1">Importa desde Excel masivamente o registra manual.</p>
                </div>
                <div className="bg-white/10 backdrop-blur-xs p-4 rounded-2xl border border-white/10">
                  <div className="w-7 h-7 rounded-lg bg-blue-500 text-white font-bold text-xs flex items-center justify-center mb-2">4</div>
                  <h4 className="text-xs font-bold text-white">Exporta Planillas</h4>
                  <p className="text-[11px] text-slate-300 mt-1">Genera en 1 clic tus reportes Excel y PDF oficiales.</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-6">
                <button
                  onClick={() => handleOpenCreateEmpresa()}
                  className="px-5 py-2.5 bg-blue-500 hover:bg-blue-400 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Registrar Primera Empresa de Transporte</span>
                </button>
                <button
                  onClick={handleOpenCreateAsoc}
                  className="px-5 py-2.5 bg-white/20 hover:bg-white/30 text-white font-bold text-xs rounded-xl transition flex items-center gap-2"
                >
                  <Building2 className="w-4 h-4" />
                  <span>Registrar Asociación / Sindicato</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Barra de Controles y Búsqueda */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          
          {/* Segmented Control / Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 self-start sm:self-auto">
            <button
              onClick={() => setActiveTab("todas")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === "todas" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Todas ({asociaciones.length + empresas.length})
            </button>
            <button
              onClick={() => setActiveTab("asociaciones")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "asociaciones" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Asociaciones ({asociaciones.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("empresas")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "empresas" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Truck className="w-3.5 h-3.5 text-blue-600" />
              <span>Empresas ({empresas.length})</span>
            </button>
          </div>

          {/* Buscador */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por empresa, asociación, NIT o sigla..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          {/* Botones de Creación Rápida */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenCreateEmpresa()}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Empresa</span>
            </button>

            <button
              onClick={handleOpenCreateAsoc}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition"
            >
              <Building2 className="w-4 h-4" />
              <span>Nueva Asociación</span>
            </button>
          </div>

        </div>

        {/* Loader */}
        {loading && (
          <div className="py-24 flex flex-col items-center justify-center text-slate-400">
            <div className="w-9 h-9 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
            <span className="text-xs font-medium">Cargando directorio operativo...</span>
          </div>
        )}

        {/* SECCIÓN 1: ASOCIACIONES DE TRANSPORTE */}
        {!loading && (activeTab === "todas" || activeTab === "asociaciones") && filteredAsocs.length > 0 && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>Asociaciones y Federaciones de Transporte</span>
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {filteredAsocs.length} {filteredAsocs.length === 1 ? "asociación" : "asociaciones"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredAsocs.map((asoc) => (
                <div
                  key={asoc.id}
                  onClick={() => router.push(`/asociacion/${asoc.id}`)}
                  className="bg-white border border-slate-200 hover:border-blue-400 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    {/* Header Card */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="p-2.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleOpenEditAsoc(asoc, e)}
                          title="Editar asociación"
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteAsoc(asoc, e)}
                          title="Eliminar asociación"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h4 className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition line-clamp-2">
                      {asoc.name}
                    </h4>
                    {asoc.sigla && (
                      <span className="inline-block mt-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
                        {asoc.sigla}
                      </span>
                    )}

                    <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                      {asoc.nit && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-medium">NIT:</span>
                          <span className="font-mono font-medium text-slate-800">{asoc.nit}</span>
                        </div>
                      )}
                      {asoc.representante_legal && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-medium">Representante:</span>
                          <span className="truncate">{asoc.representante_legal}</span>
                        </div>
                      )}
                      {asoc.direccion && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate">{asoc.direccion}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-blue-600" />
                      <span>{asoc.empresas?.length || 0} empresas afiliadas</span>
                    </span>
                    <span className="text-xs font-bold text-blue-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      <span>Panel Oficial</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECCIÓN 2: EMPRESAS DE TRANSPORTE DIRECTAS / INDEPENDIENTES */}
        {!loading && (activeTab === "todas" || activeTab === "empresas") && filteredEmpresas.length > 0 && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-600" />
                <span>Empresas de Transporte (Afiliadas e Independientes)</span>
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {filteredEmpresas.length} {filteredEmpresas.length === 1 ? "empresa" : "empresas"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredEmpresas.map((emp) => (
                <div
                  key={emp.id}
                  onClick={() => router.push(`/${emp.schema_name}/dashboard`)}
                  className="bg-white border border-slate-200 hover:border-emerald-400 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    {/* Header Card */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleOpenEditEmpresa(emp, e)}
                          title="Editar empresa"
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteEmpresa(emp, e)}
                          title="Eliminar empresa"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h4 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition line-clamp-2">
                      {emp.name}
                    </h4>

                    {emp.asociacion_name ? (
                      <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-semibold border border-blue-200">
                        <Building2 className="w-3 h-3" />
                        <span className="truncate max-w-[200px]">{emp.asociacion_name}</span>
                      </span>
                    ) : (
                      <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-semibold border border-slate-200">
                        Empresa Independiente
                      </span>
                    )}

                    <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                      {emp.nit && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-medium">NIT:</span>
                          <span className="font-mono font-medium text-slate-800">{emp.nit}</span>
                        </div>
                      )}
                      {emp.representante_legal && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-medium">Gerente:</span>
                          <span className="truncate">{emp.representante_legal}</span>
                        </div>
                      )}
                      {emp.telefono && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{emp.telefono}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-slate-400">
                      {emp.schema_name}
                    </span>
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      <span>Ingresar a Operaciones</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* Modal Crear / Editar Asociación */}
      {showAsocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingAsoc ? "Editar Asociación" : "Nueva Asociación de Transporte"}
                </h3>
                <p className="text-xs text-slate-500">
                  Consolida empresas para la planilla oficial YPFB (Página 1)
                </p>
              </div>
              <button
                onClick={() => setShowAsocModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAsoc} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre Completo de la Asociación *
                </label>
                <input
                  type="text"
                  required
                  value={asocForm.name}
                  onChange={(e) => setAsocForm({ ...asocForm, name: e.target.value })}
                  placeholder="ej. ASOCIACIÓN DE TRANSPORTISTAS DEL ORIENTE"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sigla / Abreviatura</label>
                  <input
                    type="text"
                    value={asocForm.sigla}
                    onChange={(e) => setAsocForm({ ...asocForm, sigla: e.target.value })}
                    placeholder="ej. ASOC. ORIENTE"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">NIT</label>
                  <input
                    type="text"
                    value={asocForm.nit}
                    onChange={(e) => setAsocForm({ ...asocForm, nit: e.target.value })}
                    placeholder="ej. 1029384756"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Representante Legal</label>
                <input
                  type="text"
                  value={asocForm.representante_legal}
                  onChange={(e) => setAsocForm({ ...asocForm, representante_legal: e.target.value })}
                  placeholder="ej. Lic. Roberto Gómez"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={asocForm.telefono}
                    onChange={(e) => setAsocForm({ ...asocForm, telefono: e.target.value })}
                    placeholder="ej. 77012345"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={asocForm.email}
                    onChange={(e) => setAsocForm({ ...asocForm, email: e.target.value })}
                    placeholder="ej. contacto@asociacion.bo"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dirección / Sede</label>
                <input
                  type="text"
                  value={asocForm.direccion}
                  onChange={(e) => setAsocForm({ ...asocForm, direccion: e.target.value })}
                  placeholder="ej. Av. 6 de Marzo Km 5, La Paz"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div className="mt-5 pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAsocModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingEmpresa ? "Editar Empresa" : "Nueva Empresa de Transporte"}
                </h3>
                <p className="text-xs text-slate-500">
                  Aprovisiona un espacio dedicado con flota, viajes y liquidaciones propias
                </p>
              </div>
              <button
                onClick={() => setShowEmpresaModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEmpresa} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Razón Social / Nombre de la Empresa *
                </label>
                <input
                  type="text"
                  required
                  value={empresaForm.name}
                  onChange={(e) => setEmpresaForm({ ...empresaForm, name: e.target.value })}
                  placeholder='ej. "TRANSPORTES RENGIFO LTDA."'
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">NIT</label>
                  <input
                    type="text"
                    value={empresaForm.nit}
                    onChange={(e) => setEmpresaForm({ ...empresaForm, nit: e.target.value })}
                    placeholder="ej. 1024567890"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Asociación (Opcional)</label>
                  <select
                    value={empresaForm.asociacion_id}
                    onChange={(e) => setEmpresaForm({ ...empresaForm, asociacion_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
                  >
                    <option value="">Ninguna (Independiente)</option>
                    {asociaciones.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} {a.sigla ? `(${a.sigla})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Representante Legal / Gerente</label>
                <input
                  type="text"
                  value={empresaForm.representante_legal}
                  onChange={(e) => setEmpresaForm({ ...empresaForm, representante_legal: e.target.value })}
                  placeholder="ej. Ing. Carlos Rengifo"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={empresaForm.telefono}
                    onChange={(e) => setEmpresaForm({ ...empresaForm, telefono: e.target.value })}
                    placeholder="ej. 71500000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={empresaForm.email}
                    onChange={(e) => setEmpresaForm({ ...empresaForm, email: e.target.value })}
                    placeholder="ej. contacto@transporte.bo"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dirección / Garaje</label>
                <input
                  type="text"
                  value={empresaForm.direccion}
                  onChange={(e) => setEmpresaForm({ ...empresaForm, direccion: e.target.value })}
                  placeholder="ej. Zona Industrial El Alto, Calle 4"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div className="mt-5 pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmpresaModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition"
                >
                  {editingEmpresa ? "Guardar Cambios" : "Crear Empresa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Gestión de Usuarios */}
      <UserManagementModal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
      />

    </div>
  );
}
