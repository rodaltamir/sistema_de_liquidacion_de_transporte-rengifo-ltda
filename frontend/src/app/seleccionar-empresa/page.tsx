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
  Filter
} from "lucide-react";
import Swal from "sweetalert2";
import { apiFetch } from "@/lib/api";
import { getCurrentUser, clearAuth, User } from "@/lib/auth";

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
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>}>
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"todas" | "asociadas" | "independientes">(
    indepParam === "true" ? "independientes" : asocParam ? "asociadas" : "todas"
  );

  const [showModal, setShowModal] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);

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
      const [empData, asocData] = await Promise.all([
        apiFetch("/empresas/"),
        apiFetch("/asociaciones/")
      ]);
      setEmpresas(empData);
      setAsociaciones(asocData);
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
          title: "Empresa registrada con éxito",
          text: "Se ha aprovisionado su esquema seguro en la base de datos.",
          timer: 1500,
          showConfirmButton: false,
          background: "#ffffff",
          color: "#0f172a"
        });
      }

      setShowModal(false);
      loadData();
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

  const handleDelete = async (emp: Empresa, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await Swal.fire({
      title: `¿Eliminar "${emp.name}"?`,
      text: `Se eliminarán permanentemente todos los camiones, viajes y liquidaciones del esquema ${emp.schema_name}.`,
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
        loadData();
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
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      
      {/* Barra de Navegación Superior */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <Link
              href="/seleccionar-asociacion"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title="Volver a Asociaciones"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">
                Empresas de Transporte
              </h1>
              <p className="text-xs text-slate-500">
                Selecciona la empresa para entrar al espacio de trabajo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
              <div className="text-right hidden sm:block">
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        
        {/* Barra de Búsqueda y Filtros */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-6">
          
          {/* Pestañas de Filtro */}
          <div className="inline-flex p-1 bg-slate-200/80 rounded-xl text-xs font-semibold text-slate-600">
            <button
              onClick={() => setFilterType("todas")}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                filterType === "todas" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"
              }`}
            >
              Todas ({empresas.length})
            </button>
            <button
              onClick={() => setFilterType("asociadas")}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                filterType === "asociadas" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"
              }`}
            >
              Afiliadas a Asociación ({empresas.filter(e => e.asociacion_id !== null).length})
            </button>
            <button
              onClick={() => setFilterType("independientes")}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                filterType === "independientes" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"
              }`}
            >
              Independientes ({empresas.filter(e => e.asociacion_id === null).length})
            </button>
          </div>

          {/* Buscador y Botón Nuevo */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar empresa, NIT o representante..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>

            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Empresa</span>
            </button>
          </div>

        </div>

        {/* Listado en Cuadrícula de Empresas */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
            <span className="text-xs font-medium">Cargando empresas de transporte...</span>
          </div>
        ) : filteredEmpresas.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8 shadow-xs">
            <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-700">No se encontraron empresas</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {filterType === "independientes"
                ? "No hay empresas registradas como independientes."
                : "No hay empresas que coincidan con la búsqueda."}
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Nueva Empresa</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEmpresas.map((emp) => (
              <div
                key={emp.id}
                onClick={() => router.push(`/${emp.schema_name}/dashboard`)}
                className="bg-white border border-slate-200 hover:border-blue-400/80 rounded-2xl p-6 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  {/* Encabezado */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="p-2.5 rounded-xl bg-slate-100 group-hover:bg-blue-50 text-slate-700 group-hover:text-blue-600 transition-colors">
                      <Truck className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleOpenEdit(emp, e)}
                        title="Editar empresa"
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(emp, e)}
                        title="Eliminar empresa"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Nombre y Badge de Afiliación */}
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors line-clamp-2">
                    {emp.name}
                  </h3>
                  
                  <div className="mt-2">
                    {emp.asociacion_name ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium">
                        <Building2 className="w-3 h-3" />
                        <span className="truncate max-w-[200px]">{emp.asociacion_name}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                        Empresa Independiente
                      </span>
                    )}
                  </div>

                  {/* Detalles de contacto y fiscales */}
                  <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                    {emp.nit && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-medium">NIT:</span>
                        <span className="font-mono font-medium text-slate-800">{emp.nit}</span>
                      </div>
                    )}
                    {emp.representante_legal && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-medium">Rep:</span>
                        <span className="truncate">{emp.representante_legal}</span>
                      </div>
                    )}
                    {emp.telefono && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{emp.telefono}</span>
                      </div>
                    )}
                    {emp.direccion && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{emp.direccion}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pie con botón de acceso */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-400">
                    {emp.schema_name}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                    <span>Entrar al Sistema</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>

              </div>
            ))}
          </div>
        )}

      </main>

      {/* Modal Crear / Editar Empresa */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingEmpresa ? "Editar Empresa" : "Nueva Empresa de Transporte"}
                </h3>
                <p className="text-xs text-slate-500">
                  {editingEmpresa ? "Modifica los datos de la empresa" : "Crea un nuevo esquema PostgreSQL dedicado"}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Razón Social de la Empresa *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ej. EMPRESA DE TRANSPORTES BRITANIC S.R.L."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">NIT</label>
                  <input
                    type="text"
                    value={formData.nit}
                    onChange={(e) => setFormData({ ...formData, nit: e.target.value })}
                    placeholder="ej. 2049182039"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Asociación Afiliada
                  </label>
                  <select
                    value={formData.asociacion_id}
                    onChange={(e) => setFormData({ ...formData, asociacion_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  >
                    <option value="">Empresa Independiente (Sin Asoc.)</option>
                    {asociaciones.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} {a.sigla ? `(${a.sigla})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Representante Legal</label>
                <input
                  type="text"
                  value={formData.representante_legal}
                  onChange={(e) => setFormData({ ...formData, representante_legal: e.target.value })}
                  placeholder="ej. JOSE LOVERA TIÑINI"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    placeholder="ej. 77299100"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="ej. contacto@empresa.bo"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dirección / Oficina</label>
                <input
                  type="text"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  placeholder="ej. Av. Litoral Nº 850, El Alto, La Paz"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div className="mt-5 pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
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
