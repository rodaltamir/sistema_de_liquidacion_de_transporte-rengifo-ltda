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
  Layers, 
  ShieldCheck, 
  UserCheck, 
  CheckCircle2, 
  Fuel, 
  LogOut 
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
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" /></div>}>
      <SeleccionarEmpresaContent />
    </Suspense>
  );
}

function SeleccionarEmpresaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const asocParam = searchParams.get("asoc_id");

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [asociaciones, setAsociaciones] = useState<Asociacion[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterType, setFilterType] = useState<"todas" | "independientes" | "asociadas">(
    asocParam ? "asociadas" : "todas"
  );
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    nit: "",
    asociacion_id: asocParam ? parseInt(asocParam) : (null as number | null),
    representante_legal: "",
    direccion: "",
    telefono: "",
    email: "",
    icon: "Truck"
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
    setEditingEmpresa(null);
    setFormData({
      name: "",
      nit: "",
      asociacion_id: asocParam ? parseInt(asocParam) : null,
      representante_legal: "",
      direccion: "",
      telefono: "",
      email: "",
      icon: "Truck"
    });
    setShowModal(true);
  };

  const openEditModal = (emp: Empresa, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEmpresa(emp);
    setFormData({
      name: emp.name,
      nit: emp.nit || "",
      asociacion_id: emp.asociacion_id,
      representante_legal: emp.representante_legal || "",
      direccion: emp.direccion || "",
      telefono: emp.telefono || "",
      email: emp.email || "",
      icon: emp.icon || "Truck"
    });
    setShowModal(true);
  };

  const handleDelete = async (emp: Empresa, e: React.MouseEvent) => {
    e.stopPropagation();
    const result = await Swal.fire({
      title: `¿Eliminar ${emp.name}?`,
      text: "Esta acción eliminará el esquema de base de datos y todos los viajes y liquidaciones asociadas.",
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
        await apiFetch(`/empresas/${emp.schema_name}`, { method: "DELETE" });
        Swal.fire({
          icon: "success",
          title: "Empresa eliminada",
          background: "#0f172a",
          color: "#fff",
          timer: 1500,
          showConfirmButton: false
        });
        loadData();
      } catch (err: any) {
        Swal.fire({ icon: "error", title: "Error", text: err.message, background: "#0f172a", color: "#fff" });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEmpresa) {
        await apiFetch(`/empresas/${editingEmpresa.schema_name}`, {
          method: "PUT",
          body: JSON.stringify(formData)
        });
        Swal.fire({
          icon: "success",
          title: "Empresa actualizada",
          background: "#0f172a",
          color: "#fff",
          timer: 1500,
          showConfirmButton: false
        });
      } else {
        await apiFetch("/empresas/", {
          method: "POST",
          body: JSON.stringify(formData)
        });
        Swal.fire({
          icon: "success",
          title: "Empresa creada exitosamente",
          text: "Se inicializó su esquema PostgreSQL aislado.",
          background: "#0f172a",
          color: "#fff",
          timer: 1800,
          showConfirmButton: false
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
        color: "#fff"
      });
    }
  };

  const filteredEmpresas = empresas.filter((emp) => {
    // Filtro por tipo
    if (filterType === "independientes" && emp.asociacion_id !== null) return false;
    if (filterType === "asociadas" && emp.asociacion_id === null) return false;

    // Filtro por búsqueda
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = emp.name.toLowerCase().includes(q);
      const matchNit = emp.nit ? emp.nit.toLowerCase().includes(q) : false;
      const matchRep = emp.representante_legal ? emp.representante_legal.toLowerCase().includes(q) : false;
      return matchName || matchNit || matchRep;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-slate-900/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/seleccionar-asociacion"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Volver a Asociaciones"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                Empresas de Transporte
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Tenants
                </span>
              </h1>
              <p className="text-xs text-slate-400">Selecciona o registra una empresa para entrar a su sistema</p>
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
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-red-500/20 hover:text-red-300 border border-slate-700 text-slate-300 transition"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Controles de Búsqueda y Filtros */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
          
          {/* Barra de Búsqueda */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, NIT o representante..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Filtros de Pestaña */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
            <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setFilterType("todas")}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  filterType === "todas" ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Todas ({empresas.length})
              </button>
              <button
                onClick={() => setFilterType("independientes")}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  filterType === "independientes" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Independientes
              </button>
              <button
                onClick={() => setFilterType("asociadas")}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  filterType === "asociadas" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Asociadas
              </button>
            </div>

            {currentUser?.role === "admin" && (
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/20 transition flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Empresa</span>
              </button>
            )}
          </div>
        </div>

        {/* Grid de Empresas */}
        {loading ? (
          <div className="flex justify-center items-center py-24">
            <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          </div>
        ) : filteredEmpresas.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center max-w-md mx-auto">
            <Truck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">No se encontraron empresas</h3>
            <p className="text-sm text-slate-400 mb-6">
              Prueba cambiando los filtros de búsqueda o registra una nueva empresa de transporte.
            </p>
            {currentUser?.role === "admin" && (
              <button
                onClick={openCreateModal}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition"
              >
                Registrar Empresa
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEmpresas.map((emp) => (
              <div
                key={emp.id}
                className="bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 rounded-2xl p-6 shadow-xl hover:shadow-cyan-500/10 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-lg shadow-inner">
                      <Truck className="w-6 h-6" />
                    </div>

                    <div className="flex items-center gap-1.5">
                      {emp.asociacion_id ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800">
                          {emp.asociacion_name || "Asociada"}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                          Independiente
                        </span>
                      )}

                      {currentUser?.role === "admin" && (
                        <div className="flex items-center ml-1">
                          <button
                            onClick={(e) => openEditModal(emp, e)}
                            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition"
                            title="Editar Empresa"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(emp, e)}
                            className="p-1 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition"
                            title="Eliminar Empresa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition line-clamp-2">
                    {emp.name}
                  </h3>
                  <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                    Esquema DB: <span className="text-slate-400">{emp.schema_name}</span>
                  </div>

                  <div className="mt-4 space-y-1.5 text-xs text-slate-400">
                    {emp.nit && (
                      <div className="flex justify-between border-b border-slate-800 pb-1">
                        <span className="text-slate-500">NIT:</span>
                        <span className="font-mono text-slate-300">{emp.nit}</span>
                      </div>
                    )}
                    {emp.representante_legal && (
                      <div className="flex justify-between border-b border-slate-800 pb-1">
                        <span className="text-slate-500">Representante:</span>
                        <span className="text-slate-300 truncate max-w-[170px]">{emp.representante_legal}</span>
                      </div>
                    )}
                    {emp.telefono && (
                      <div className="flex justify-between border-b border-slate-800 pb-1">
                        <span className="text-slate-500">Teléfono:</span>
                        <span className="text-slate-300">{emp.telefono}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-0.5">
                      <span className="text-slate-500">Estado:</span>
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Habilitado YPFB
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800">
                  <Link
                    href={`/${emp.schema_name}/dashboard`}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-cyan-500/20"
                  >
                    <span>Ingresar al Panel de la Empresa</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

      {/* Modal Crear / Editar Empresa */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-cyan-400" />
                {editingEmpresa ? "Editar Empresa de Transporte" : "Registrar Empresa de Transporte"}
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
                  Razón Social de la Empresa *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder='ej. CHAXMANA TRANSPORT Ltda.'
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    NIT
                  </label>
                  <input
                    type="text"
                    value={formData.nit}
                    onChange={(e) => setFormData({ ...formData, nit: e.target.value })}
                    placeholder="2049182039"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Asociación (Opcional)
                  </label>
                  <select
                    value={formData.asociacion_id || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      asociacion_id: e.target.value ? parseInt(e.target.value) : null
                    })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">-- Independiente (Sin Asociación) --</option>
                    {asociaciones.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.sigla || a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                  Representante Legal / Gerente General
                </label>
                <input
                  type="text"
                  value={formData.representante_legal}
                  onChange={(e) => setFormData({ ...formData, representante_legal: e.target.value })}
                  placeholder="ej. JOSE LOVERA TIÑINI"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    placeholder="77299100"
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
                    placeholder="administracion@empresa.bo"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                  Dirección Operativa
                </label>
                <input
                  type="text"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  placeholder="Av. Litoral Nº 850, El Alto, La Paz"
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
