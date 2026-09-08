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
  ExternalLink
} from "lucide-react";
import Swal from "sweetalert2";
import { apiFetch } from "@/lib/api";
import { getCurrentUser, clearAuth, isAdmin, User } from "@/lib/auth";

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
  const [showModal, setShowModal] = useState(false);
  const [editingAsoc, setEditingAsoc] = useState<Asociacion | null>(null);

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
        background: "#0f172a",
        color: "#fff"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    router.push("/");
  };

  const openCreateModal = () => {
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

  const openEditModal = (asoc: Asociacion, e: React.MouseEvent) => {
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

  const handleDelete = async (asoc: Asociacion, e: React.MouseEvent) => {
    e.stopPropagation();
    const result = await Swal.fire({
      title: `¿Eliminar ${asoc.name}?`,
      text: "Las empresas miembro quedarán como empresas independientes sin asociación.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#334155",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      background: "#0f172a",
      color: "#fff"
    });

    if (result.isConfirmed) {
      try {
        await apiFetch(`/asociaciones/${asoc.id}`, { method: "DELETE" });
        Swal.fire({
          icon: "success",
          title: "Asociación eliminada",
          background: "#0f172a",
          color: "#fff",
          timer: 1500,
          showConfirmButton: false
        });
        loadAsociaciones();
      } catch (err: any) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: err.message,
          background: "#0f172a",
          color: "#fff"
        });
      }
    }
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
          background: "#0f172a",
          color: "#fff",
          timer: 1500,
          showConfirmButton: false
        });
      } else {
        await apiFetch("/asociaciones/", {
          method: "POST",
          body: JSON.stringify(formData)
        });
        Swal.fire({
          icon: "success",
          title: "Asociación creada exitosamente",
          background: "#0f172a",
          color: "#fff",
          timer: 1500,
          showConfirmButton: false
        });
      }
      setShowModal(false);
      loadAsociaciones();
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al guardar",
        text: err.message,
        background: "#0f172a",
        color: "#fff"
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-slate-900/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                Rengifo Transporte
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Multitenant
                </span>
              </h1>
              <p className="text-xs text-slate-400">Selección de Asociación o Empresa Independiente</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {currentUser && (
              <div className="hidden sm:flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700">
                {currentUser.role === "admin" ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                ) : (
                  <UserCheck className="w-4 h-4 text-cyan-400" />
                )}
                <div className="text-xs">
                  <div className="font-bold text-white">{currentUser.name}</div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">
                    {currentUser.role === "admin" ? "Administrador" : "Usuario"}
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-red-500/20 hover:text-red-300 border border-slate-700 hover:border-red-500/30 text-slate-300 transition"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Banner de acceso directo a empresas independientes */}
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-blue-900/40 via-cyan-950/40 to-slate-900 border border-cyan-500/30 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 flex-shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                ¿Tu empresa no pertenece a una asociación?
                <span className="text-xs font-normal text-cyan-300 bg-cyan-900/60 px-2 py-0.5 rounded-md">
                  Empresas Independientes
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                Muchas empresas operan de forma autónoma. Puedes saltar directamente al listado general de empresas de transporte.
              </p>
            </div>
          </div>
          <Link
            href="/seleccionar-empresa"
            className="w-full md:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition flex-shrink-0 group"
          >
            <span>Ver Empresas de Transporte</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Encabezado de Asociaciones */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Building2 className="w-6 h-6 text-cyan-400" />
              Asociaciones de Transporte
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Selecciona una asociación para acceder a sus empresas afiliadas y a la liquidación general consolidada.
            </p>
          </div>

          {currentUser?.role === "admin" && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-600/20 transition self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Asociación</span>
            </button>
          )}
        </div>

        {/* Grid de Asociaciones */}
        {loading ? (
          <div className="flex justify-center items-center py-24">
            <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          </div>
        ) : asociaciones.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center max-w-md mx-auto">
            <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">No hay asociaciones registradas</h3>
            <p className="text-sm text-slate-400 mb-6">
              Puedes crear una nueva asociación o ingresar directamente a las empresas independientes.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {currentUser?.role === "admin" && (
                <button
                  onClick={openCreateModal}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
                >
                  Crear Asociación
                </button>
              )}
              <Link
                href="/seleccionar-empresa"
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold transition"
              >
                Ir a Empresas
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {asociaciones.map((asoc) => (
              <div
                key={asoc.id}
                className="bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 rounded-2xl p-6 shadow-xl hover:shadow-cyan-500/10 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-cyan-950 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-black text-lg shadow-inner">
                      {asoc.sigla ? asoc.sigla.slice(0, 2).toUpperCase() : asoc.name.slice(0, 2).toUpperCase()}
                    </div>

                    {currentUser?.role === "admin" && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => openEditModal(asoc, e)}
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition"
                          title="Editar Asociación"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(asoc, e)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition"
                          title="Eliminar Asociación"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition line-clamp-2">
                    {asoc.name}
                  </h3>
                  {asoc.sigla && (
                    <div className="text-xs font-semibold text-cyan-400 mt-0.5">
                      {asoc.sigla}
                    </div>
                  )}

                  <div className="mt-4 space-y-2 text-xs text-slate-400">
                    {asoc.nit && (
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                        <span className="text-slate-500">NIT:</span>
                        <span className="font-mono text-slate-300 font-semibold">{asoc.nit}</span>
                      </div>
                    )}
                    {asoc.representante_legal && (
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                        <span className="text-slate-500">Representante:</span>
                        <span className="text-slate-300 truncate max-w-[170px]">{asoc.representante_legal}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-slate-500">Empresas Afiliadas:</span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 font-bold border border-blue-800">
                        {asoc.empresas?.length || 0} empresas
                      </span>
                    </div>
                  </div>
                </div>

                {/* Acciones principales */}
                <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col gap-2">
                  <Link
                    href={`/asociacion/${asoc.id}`}
                    className="w-full py-2.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-md shadow-cyan-600/20"
                  >
                    <span>Entrar y Ver Empresas</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <Link
                    href={`/asociacion/${asoc.id}?tab=liquidacion`}
                    className="w-full py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-cyan-300 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Liquidación General (PDF Pág 1)</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal Crear / Editar Asociación */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-cyan-400" />
                {editingAsoc ? "Editar Asociación" : "Registrar Nueva Asociación"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                  Nombre de la Asociación *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ej. ASOC. ANDINA ASOCIADOS"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Sigla / Alias
                  </label>
                  <input
                    type="text"
                    value={formData.sigla}
                    onChange={(e) => setFormData({ ...formData, sigla: e.target.value })}
                    placeholder="ej. ANDINA ASOC."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    NIT
                  </label>
                  <input
                    type="text"
                    value={formData.nit}
                    onChange={(e) => setFormData({ ...formData, nit: e.target.value })}
                    placeholder="1029384756"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                  Representante Legal
                </label>
                <input
                  type="text"
                  value={formData.representante_legal}
                  onChange={(e) => setFormData({ ...formData, representante_legal: e.target.value })}
                  placeholder="ej. Lic. Rolando Choque Gutiérrez"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Teléfono / Celular
                  </label>
                  <input
                    type="text"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    placeholder="71500000"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contacto@asociacion.bo"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                  Dirección
                </label>
                <input
                  type="text"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  placeholder="Av. 6 de Marzo, El Alto, La Paz"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-bold shadow-lg shadow-cyan-500/20 transition"
                >
                  {editingAsoc ? "Guardar Cambios" : "Crear Asociación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
