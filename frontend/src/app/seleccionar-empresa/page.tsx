"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  Truck, 
  Building2, 
  Plus, 
  Search, 
  ArrowRight, 
  ArrowLeft, 
  Edit, 
  Trash2, 
  LogOut, 
  Phone,
  MapPin,
  Mail,
  X,
  Filter,
  Fuel,
  DollarSign,
  Layers,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  User as UserIcon,
  ChevronDown
} from "lucide-react";
import Swal from "sweetalert2";
import { apiFetch } from "@/lib/api";
import { getCurrentUser, clearAuth, User } from "@/lib/auth";
import { formatNumber } from "@/lib/format";

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

interface Asociacion {
  id: number;
  name: string;
  sigla: string | null;
}

export default function SeleccionarEmpresaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
        <span className="text-slate-400 text-xs font-semibold tracking-wider uppercase">Cargando Directorio...</span>
      </div>
    }>
      <SeleccionarEmpresaContent />
    </Suspense>
  );
}

function SeleccionarEmpresaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const asocParam = searchParams.get("asoc_id");
  const indepParam = searchParams.get("independientes");

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [asociaciones, setAsociaciones] = useState<Asociacion[]>([]);
  const [globalStats, setGlobalStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"todas" | "asociadas" | "independientes">(
    indepParam === "true" ? "independientes" : asocParam ? "asociadas" : "todas"
  );

  const [showModal, setShowModal] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const [showRepDetails, setShowRepDetails] = useState(false);

  const [formData, setFormData] = useState({
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
    loadData();
  }, [router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [empData, asocData, statsData] = await Promise.all([
        apiFetch("/empresas/"),
        apiFetch("/asociaciones/"),
        apiFetch("/empresas/resumen-global").catch(() => null)
      ]);
      setEmpresas(empData);
      setAsociaciones(asocData);
      setGlobalStats(statsData);
    } catch (err: any) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Error al cargar datos",
        text: err.message,
        background: "#0f172a",
        color: "#f8fafc",
        confirmButtonColor: "#f59e0b"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingEmpresa(null);
    setFormData({
      name: "",
      nit: "",
      asociacion_id: asocParam ? Number(asocParam) : "",
      representante_legal: "",
      direccion: "",
      telefono: "",
      email: ""
    });
    setShowRepDetails(false);
    setShowModal(true);
  };

  const handleOpenEdit = (emp: Empresa, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEmpresa(emp);
    setFormData({
      name: emp.name,
      nit: emp.nit || "",
      asociacion_id: emp.asociacion_id !== null ? emp.asociacion_id : "",
      representante_legal: emp.representante_legal || "",
      direccion: emp.direccion || "",
      telefono: emp.telefono || "",
      email: emp.email || ""
    });
    setShowRepDetails(Boolean(emp.representante_legal || emp.nit || emp.telefono));
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: formData.name.trim(),
        nit: formData.nit.trim() || null,
        asociacion_id: formData.asociacion_id !== "" ? Number(formData.asociacion_id) : null,
        representante_legal: formData.representante_legal.trim() || null,
        direccion: formData.direccion.trim() || null,
        telefono: formData.telefono.trim() || null,
        email: formData.email.trim() || null
      };

      if (editingEmpresa) {
        await apiFetch(`/empresas/${editingEmpresa.schema_name}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        Swal.fire({
          icon: "success",
          title: "Empresa actualizada",
          timer: 1400,
          showConfirmButton: false,
          background: "#0f172a",
          color: "#f8fafc"
        });
      } else {
        await apiFetch("/empresas/", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        Swal.fire({
          icon: "success",
          title: "Empresa registrada con éxito",
          text: "Se ha aprovisionado su esquema seguro en la base de datos.",
          timer: 1600,
          showConfirmButton: false,
          background: "#0f172a",
          color: "#f8fafc"
        });
      }

      setShowModal(false);
      loadData();
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al guardar empresa",
        text: err.message,
        background: "#0f172a",
        color: "#f8fafc",
        confirmButtonColor: "#f59e0b"
      });
    }
  };

  const handleDelete = async (emp: Empresa, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await Swal.fire({
      title: `¿Eliminar "${emp.name}"?`,
      text: `Se eliminarán permanentemente todos los camiones, viajes y liquidaciones del esquema ${emp.schema_name}.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar empresa",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#e11d48",
      cancelButtonColor: "#334155",
      background: "#0f172a",
      color: "#f8fafc"
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
          color: "#f8fafc"
        });
        loadData();
      } catch (err: any) {
        Swal.fire({
          icon: "error",
          title: "Error al eliminar",
          text: err.message,
          background: "#0f172a",
          color: "#f8fafc",
          confirmButtonColor: "#f59e0b"
        });
      }
    }
  };

  const handleLogout = () => {
    clearAuth();
    router.push("/");
  };

  const filteredEmpresas = empresas.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.nit && e.nit.includes(search)) ||
      (e.representante_legal && e.representante_legal.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterType === "independientes") {
      return e.asociacion_id === null;
    }
    if (filterType === "asociadas") {
      return e.asociacion_id !== null;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* Barra de Navegación Superior */}
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 shadow-lg shadow-black/20">
        <div className="max-w-[1700px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 h-20 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3.5">
            <Link
              href="/seleccionar-asociacion"
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white transition group"
              title="Volver a Asociaciones"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
            </Link>

            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 p-2 flex items-center justify-center shadow-inner flex-shrink-0">
              <img src="/rengifo_logo_icon.svg" alt="Rengifo" className="w-full h-full object-contain" />
            </div>

            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white leading-tight">
                Rengifo Ltda. &bull; Directorio de Empresas
              </h1>
              <p className="text-xs text-slate-400">
                Selecciona la empresa de transporte para entrar a su panel operativo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-white">{currentUser?.name}</div>
                <div className="text-[11px] text-amber-400 font-medium">
                  {currentUser?.role === "admin" ? "Administrador General" : "Operador"}
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="Cerrar Sesión"
                className="p-2.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-xl transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* Contenido Principal con ancho completo */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-8 space-y-8">
        
        {/* ============================================================== */}
        {/* MINI DASHBOARD DE EMPRESAS */}
        {/* ============================================================== */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 transition-all shadow-lg shadow-black/20 flex flex-col justify-between min-h-[125px] group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Empresas Totales</span>
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Truck className="w-4.5 h-4.5" />
                </div>
              </div>
              <div className="my-2.5">
                <div className="text-3xl font-black text-white tracking-tight">
                  {empresas.length}
                </div>
              </div>
              <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>Operadores activos</span>
                <span className="font-semibold text-amber-400">{empresas.length} empresas</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-sky-500/40 transition-all shadow-lg shadow-black/20 flex flex-col justify-between min-h-[125px] group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Afiliadas a Asoc.</span>
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Building2 className="w-4.5 h-4.5" />
                </div>
              </div>
              <div className="my-2.5">
                <div className="text-3xl font-black text-white tracking-tight">
                  {empresas.filter(e => e.asociacion_id !== null).length}
                </div>
              </div>
              <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>En consorcio</span>
                <span className="font-semibold text-sky-400">Socias gremiales</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 transition-all shadow-lg shadow-black/20 flex flex-col justify-between min-h-[125px] group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Independientes</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-4.5 h-4.5" />
                </div>
              </div>
              <div className="my-2.5">
                <div className="text-3xl font-black text-emerald-400 tracking-tight">
                  {empresas.filter(e => e.asociacion_id === null).length}
                </div>
              </div>
              <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>Liquidación directa</span>
                <span className="font-semibold text-emerald-400">Autónomas</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/40 transition-all shadow-lg shadow-black/20 flex flex-col justify-between min-h-[125px] group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Flota de Cisternas</span>
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Layers className="w-4.5 h-4.5" />
                </div>
              </div>
              <div className="my-2.5">
                <div className="text-3xl font-black text-white tracking-tight">
                  {globalStats?.total_camiones ?? 0}
                </div>
              </div>
              <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>Parque vehicular</span>
                <span className="font-semibold text-indigo-400">{globalStats?.total_camiones ?? 0} unidades</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 transition-all shadow-lg shadow-black/20 flex flex-col justify-between min-h-[125px] group sm:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Fletes Globales</span>
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <DollarSign className="w-4.5 h-4.5" />
                </div>
              </div>
              <div className="my-2.5">
                <div className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight font-mono">
                  {globalStats ? `Bs ${formatNumber(globalStats.total_fletes_bs, 2)}` : "Bs 0.00"}
                </div>
              </div>
              <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>Total facturado</span>
                <span className="font-semibold text-amber-400">{globalStats ? `${globalStats.total_viajes} viajes` : "Sin viajes"}</span>
              </div>
            </div>

          </div>
        </section>

        {/* ============================================================== */}
        {/* BARRA DE BÚSQUEDA Y FILTROS */}
        {/* ============================================================== */}
        <section className="space-y-6">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            
            {/* Pestañas de Filtro */}
            <div className="inline-flex p-1.5 bg-slate-900 rounded-2xl border border-slate-800 text-xs font-bold">
              <button
                onClick={() => setFilterType("todas")}
                className={`px-4 py-2 rounded-xl transition-all ${
                  filterType === "todas"
                    ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Todas ({empresas.length})
              </button>
              <button
                onClick={() => setFilterType("asociadas")}
                className={`px-4 py-2 rounded-xl transition-all ${
                  filterType === "asociadas"
                    ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Afiliadas ({empresas.filter(e => e.asociacion_id !== null).length})
              </button>
              <button
                onClick={() => setFilterType("independientes")}
                className={`px-4 py-2 rounded-xl transition-all ${
                  filterType === "independientes"
                    ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Independientes ({empresas.filter(e => e.asociacion_id === null).length})
              </button>
            </div>

            {/* Buscador y Botón Nuevo */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:w-80">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar empresa, NIT o representante..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
                />
              </div>

              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 px-4.5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-xl text-xs font-bold shadow-lg shadow-amber-500/20 transition transform active:scale-95 flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Empresa</span>
              </button>
            </div>

          </div>

          {/* Listado en Cuadrícula de Empresas */}
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
              <span className="text-xs font-semibold uppercase tracking-wider">Cargando empresas de transporte...</span>
            </div>
          ) : filteredEmpresas.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/60 rounded-3xl border border-slate-800 p-8 shadow-2xl max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
                <Truck className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">No se encontraron empresas</h3>
              <p className="text-xs text-slate-400 mt-1.5 max-w-sm mx-auto leading-relaxed">
                {filterType === "independientes"
                  ? "No hay empresas registradas como independientes en este momento."
                  : "No se encontraron coincidencias para los filtros aplicados."}
              </p>
              <button
                onClick={handleOpenCreate}
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-xl text-xs font-bold shadow-lg shadow-amber-500/20 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Empresa Ahora</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEmpresas.map((emp) => (
                <div
                  key={emp.id}
                  onClick={() => router.push(`/${emp.schema_name}/dashboard`)}
                  className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 shadow-xl hover:shadow-2xl hover:shadow-black/50 transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    {/* Encabezado de la Tarjeta */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center font-bold text-lg group-hover:scale-105 transition-transform">
                        <Truck className="w-6 h-6" />
                      </div>
                      
                      <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleOpenEdit(emp, e)}
                          title="Editar empresa"
                          className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-xl transition"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(emp, e)}
                          title="Eliminar empresa"
                          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Nombre y Badge de Afiliación */}
                    <h3 className="text-lg font-black text-white group-hover:text-amber-400 transition line-clamp-2">
                      {emp.name}
                    </h3>
                    
                    <div className="mt-2.5">
                      {emp.asociacion_name ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-semibold">
                          <Building2 className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[220px]">{emp.asociacion_name}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Empresa Independiente</span>
                        </span>
                      )}
                    </div>

                    {/* Detalles de contacto y fiscales */}
                    <div className="mt-4 space-y-2 text-xs text-slate-400 border-t border-slate-800/80 pt-3">
                      {emp.nit && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">NIT:</span>
                          <span className="font-mono font-bold text-slate-200">{emp.nit}</span>
                        </div>
                      )}
                      {emp.representante_legal && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Rep. Legal:</span>
                          <span className="text-slate-300 font-medium truncate max-w-[200px]">{emp.representante_legal}</span>
                        </div>
                      )}
                      {emp.telefono && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Teléfono:</span>
                          <span className="text-slate-300">{emp.telefono}</span>
                        </div>
                      )}
                      {emp.direccion && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Oficina:</span>
                          <span className="text-slate-300 truncate max-w-[200px]">{emp.direccion}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pie con botón de acceso */}
                  <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-mono text-slate-500 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
                      {emp.schema_name}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 group-hover:text-amber-300 group-hover:translate-x-1 transition-all">
                      <span>Entrar al Sistema</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>

                </div>
              ))}
            </div>
          )}
        </section>

      </main>

      {/* ============================================================== */}
      {/* MODAL CREAR / EDITAR EMPRESA (TEMA OSCURO RENGIFO) */}
      {/* ============================================================== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 w-full max-w-lg p-6 sm:p-7 max-h-[92vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    {editingEmpresa ? "Editar Empresa" : "Nueva Empresa de Transporte"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editingEmpresa ? "Modifica los datos de la empresa de transporte" : "Aprovisiona un esquema PostgreSQL dedicado"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Razón Social de la Empresa *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ej. EMPRESA DE TRANSPORTES BRITANIC S.R.L."
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Asociación Afiliada
                </label>
                <select
                  value={formData.asociacion_id}
                  onChange={(e) => setFormData({ ...formData, asociacion_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
                >
                  <option value="">Empresa Independiente</option>
                  {asociaciones.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} {a.sigla ? `(${a.sigla})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sección Opcional Desplegable: Datos del Representante */}
              <div className="pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowRepDetails(!showRepDetails)}
                  className="flex items-center justify-between w-full py-2 px-1 text-xs font-bold text-slate-400 hover:text-amber-400 transition group"
                >
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-amber-500" />
                    <span>Datos del Representante (Opcional)</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-transform duration-200 ${showRepDetails ? "rotate-180 text-amber-400" : ""}`} />
                </button>

                {showRepDetails && (
                  <div className="mt-2.5 space-y-3 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 animate-in fade-in">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Nombre del Representante Legal
                      </label>
                      <input
                        type="text"
                        value={formData.representante_legal}
                        onChange={(e) => setFormData({ ...formData, representante_legal: e.target.value })}
                        placeholder="ej. JOSE LOVERA TIÑINI"
                        className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          C.I. / NIT
                        </label>
                        <input
                          type="text"
                          value={formData.nit}
                          onChange={(e) => setFormData({ ...formData, nit: e.target.value })}
                          placeholder="ej. 2049182039"
                          className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Teléfono / Celular
                        </label>
                        <input
                          type="text"
                          value={formData.telefono}
                          onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                          placeholder="ej. 77299100"
                          className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4.5 py-2.5 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20 transition transform active:scale-95"
                >
                  {editingEmpresa ? "Guardar Cambios" : "Crear Empresa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
