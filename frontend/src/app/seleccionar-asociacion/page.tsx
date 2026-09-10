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
  UserCheck, 
  Users, 
  Layers, 
  Sparkles,
  ExternalLink,
  Search,
  Phone,
  MapPin,
  Mail,
  X
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

export default function SeleccionarAsociacionPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [asociaciones, setAsociaciones] = useState<Asociacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  const [showModal, setShowModal] = useState(false);
  const [editingAsoc, setEditingAsoc] = useState<Asociacion | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    sigla: "",
    nit: "",
    representante_legal: "",
    telefono: "",
    direccion: "",
    email: ""
  });

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.push("/");
      return;
    }
    setCurrentUser(user);
    loadAsociaciones();
  }, [router]);

  const loadAsociaciones = async () => {
    try {
      const data = await apiFetch("/asociaciones/");
      setAsociaciones(data);
    } catch (err: any) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Error al cargar asociaciones",
        text: err.message,
        background: "#ffffff",
        color: "#0f172a"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingAsoc(null);
    setFormData({
      name: "",
      sigla: "",
      nit: "",
      representante_legal: "",
      telefono: "",
      direccion: "",
      email: ""
    });
    setShowModal(true);
  };

  const handleOpenEdit = (asoc: Asociacion, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAsoc(asoc);
    setFormData({
      name: asoc.name,
      sigla: asoc.sigla || "",
      nit: asoc.nit || "",
      representante_legal: asoc.representante_legal || "",
      telefono: asoc.telefono || "",
      direccion: asoc.direccion || "",
      email: asoc.email || ""
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAsoc) {
        await apiFetch(`/asociaciones/${editingAsoc.id}`, {
          method: "PUT",
          body: JSON.stringify(formData)
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
          body: JSON.stringify(formData)
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
      setShowModal(false);
      loadAsociaciones();
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

  const handleDelete = async (asoc: Asociacion, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await Swal.fire({
      title: `¿Eliminar "${asoc.name}"?`,
      text: "Las empresas asociadas pasarán a ser independientes sin perder sus datos.",
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
        loadAsociaciones();
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

  const filteredAsociaciones = asociaciones.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.sigla && a.sigla.toLowerCase().includes(search.toLowerCase())) ||
    (a.nit && a.nit.includes(search))
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      
      {/* Barra de Navegación Superior */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">
                Asociaciones de Transporte
              </h1>
              <p className="text-xs text-slate-500">
                Directorio y Liquidación Consolidada
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Botón Gestión de Usuarios (Solo Admin) */}
            {currentUser && isAdmin(currentUser) && (
              <button
                onClick={() => setShowUserModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
              >
                <Users className="w-4 h-4 text-slate-600" />
                <span className="hidden sm:inline">Usuarios del Sistema</span>
              </button>
            )}

            {/* Usuario Actual */}
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
        
        {/* Banner de Salto a Empresas Independientes */}
        <div className="mb-8 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-white text-blue-600 rounded-xl shadow-xs border border-blue-100">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                ¿Tu empresa trabaja de forma independiente?
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Si tu empresa de transporte no está afiliada a ninguna asociación, puedes ingresar directamente al directorio general.
              </p>
            </div>
          </div>
          <Link
            href="/seleccionar-empresa?independientes=true"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex-shrink-0"
          >
            <span>Ir a Empresas Independientes</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Barra de Acciones y Búsqueda */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar asociación por nombre, sigla o NIT..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Asociación</span>
          </button>
        </div>

        {/* Listado de Asociaciones */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
            <span className="text-xs font-medium">Cargando asociaciones...</span>
          </div>
        ) : filteredAsociaciones.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8 shadow-xs">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-700">No se encontraron asociaciones</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Crea una nueva asociación o accede directamente a las empresas independientes.
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Primera Asociación</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAsociaciones.map((asoc) => (
              <div
                key={asoc.id}
                onClick={() => router.push(`/asociacion/${asoc.id}`)}
                className="bg-white border border-slate-200 hover:border-blue-400/80 rounded-2xl p-6 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  {/* Encabezado Tarjeta */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="p-2.5 rounded-xl bg-slate-100 group-hover:bg-blue-50 text-slate-700 group-hover:text-blue-600 transition-colors">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleOpenEdit(asoc, e)}
                        title="Editar asociación"
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(asoc, e)}
                        title="Eliminar asociación"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Nombre y Sigla */}
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors line-clamp-2">
                    {asoc.name}
                  </h3>
                  {asoc.sigla && (
                    <span className="inline-block mt-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-semibold">
                      {asoc.sigla}
                    </span>
                  )}

                  {/* Detalles */}
                  <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                    {asoc.nit && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-medium">NIT:</span>
                        <span className="font-mono font-medium text-slate-800">{asoc.nit}</span>
                      </div>
                    )}
                    {asoc.representante_legal && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-medium">Rep:</span>
                        <span className="truncate">{asoc.representante_legal}</span>
                      </div>
                    )}
                    {asoc.telefono && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{asoc.telefono}</span>
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

                {/* Pie de tarjeta con Empresas y botón */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <Truck className="w-4 h-4 text-blue-600" />
                    <span>{asoc.empresas?.length || 0} empresas afiliadas</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                    <span>Ver Panel</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>

              </div>
            ))}
          </div>
        )}

      </main>

      {/* Modal Crear / Editar Asociación */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingAsoc ? "Editar Asociación" : "Nueva Asociación de Transporte"}
                </h3>
                <p className="text-xs text-slate-500">
                  Registra los datos institucionales para la planilla consolidada (Pág. 1)
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
                  Nombre Completo de la Asociación *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ej. ASOC. ANDINA ASOCIADOS DE TRANSPORTE"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sigla / Abreviatura</label>
                  <input
                    type="text"
                    value={formData.sigla}
                    onChange={(e) => setFormData({ ...formData, sigla: e.target.value })}
                    placeholder="ej. ANDINA ASOC."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">NIT</label>
                  <input
                    type="text"
                    value={formData.nit}
                    onChange={(e) => setFormData({ ...formData, nit: e.target.value })}
                    placeholder="ej. 1029384756"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Representante Legal</label>
                <input
                  type="text"
                  value={formData.representante_legal}
                  onChange={(e) => setFormData({ ...formData, representante_legal: e.target.value })}
                  placeholder="ej. Lic. Rolando Choque Gutiérrez"
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
                    placeholder="ej. 22819000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="ej. contacto@asociacion.bo"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dirección / Sede</label>
                <input
                  type="text"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  placeholder="ej. Av. 6 de Marzo Km 5, El Alto, La Paz"
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
                  {editingAsoc ? "Guardar Cambios" : "Crear Asociación"}
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
