"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { 
  Users, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Building2, 
  Phone, 
  FileText, 
  MapPin, 
  X, 
  Save, 
  Check, 
  AlertCircle,
  Briefcase
} from "lucide-react";
import Swal from "sweetalert2";
import { apiFetch } from "@/lib/api";
import { useTheme } from "@/context/ThemeContext";

interface Cliente {
  id: number;
  nombre: string;
  nit: string | null;
  telefono: string | null;
  direccion: string | null;
  is_active: boolean;
  created_at?: string;
}

export default function ClientesPage() {
  const routeParams = useParams();
  const schema = (routeParams?.schema as string) || "";
  const { resolvedTheme } = useTheme();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    nombre: "",
    nit: "",
    telefono: "",
    direccion: ""
  });
  const [errorNombre, setErrorNombre] = useState("");

  useEffect(() => {
    loadClientes();
  }, [schema]);

  const loadClientes = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/tenants/${schema}/clientes/`);
      setClientes(data || []);
    } catch (err) {
      console.error("Error al cargar clientes:", err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingCliente(null);
    setFormData({
      nombre: "",
      nit: "",
      telefono: "",
      direccion: ""
    });
    setErrorNombre("");
    setShowModal(true);
  };

  const openEditModal = (c: Cliente) => {
    setEditingCliente(c);
    setFormData({
      nombre: c.nombre || "",
      nit: c.nit || "",
      telefono: c.telefono || "",
      direccion: c.direccion || ""
    });
    setErrorNombre("");
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      setErrorNombre("El nombre o razón social del cliente es obligatorio.");
      return;
    }

    setSubmitting(true);
    try {
      if (editingCliente) {
        await apiFetch(`/tenants/${schema}/clientes/${editingCliente.id}`, {
          method: "PUT",
          body: JSON.stringify(formData)
        });
        Swal.fire({
          icon: "success",
          title: "Cliente Actualizado",
          text: `Los datos de '${formData.nombre}' se guardaron correctamente.`,
          background: resolvedTheme === "dark" ? "#0f172a" : "#ffffff",
          color: resolvedTheme === "dark" ? "#f8fafc" : "#0f172a",
          confirmButtonColor: "#f59e0b",
          timer: 1600,
          showConfirmButton: false
        });
      } else {
        await apiFetch(`/tenants/${schema}/clientes/`, {
          method: "POST",
          body: JSON.stringify(formData)
        });
        Swal.fire({
          icon: "success",
          title: "Cliente Registrado",
          text: `'${formData.nombre}' ya está disponible para el registro de viajes.`,
          background: resolvedTheme === "dark" ? "#0f172a" : "#ffffff",
          color: resolvedTheme === "dark" ? "#f8fafc" : "#0f172a",
          confirmButtonColor: "#f59e0b",
          timer: 1600,
          showConfirmButton: false
        });
      }

      setShowModal(false);
      loadClientes();
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al guardar cliente",
        text: err.message || "No se pudo procesar la solicitud.",
        background: resolvedTheme === "dark" ? "#0f172a" : "#ffffff",
        color: resolvedTheme === "dark" ? "#f8fafc" : "#0f172a",
        confirmButtonColor: "#f59e0b"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (c: Cliente) => {
    const result = await Swal.fire({
      title: "¿Eliminar Cliente?",
      text: `¿Estás seguro de eliminar a '${c.nombre}' del directorio?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      background: resolvedTheme === "dark" ? "#0f172a" : "#ffffff",
      color: resolvedTheme === "dark" ? "#f8fafc" : "#0f172a",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b"
    });

    if (result.isConfirmed) {
      try {
        await apiFetch(`/tenants/${schema}/clientes/${c.id}`, {
          method: "DELETE"
        });
        Swal.fire({
          icon: "success",
          title: "Cliente Eliminado",
          timer: 1400,
          showConfirmButton: false,
          background: resolvedTheme === "dark" ? "#0f172a" : "#ffffff",
          color: resolvedTheme === "dark" ? "#f8fafc" : "#0f172a"
        });
        loadClientes();
      } catch (err: any) {
        Swal.fire({
          icon: "error",
          title: "Error al eliminar",
          text: err.message,
          background: resolvedTheme === "dark" ? "#0f172a" : "#ffffff",
          color: resolvedTheme === "dark" ? "#f8fafc" : "#0f172a"
        });
      }
    }
  };

  const filtered = clientes.filter((c) => {
    const s = search.toLowerCase();
    return (
      c.nombre?.toLowerCase().includes(s) ||
      c.nit?.toLowerCase().includes(s) ||
      c.telefono?.toLowerCase().includes(s) ||
      c.direccion?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* Banner de Encabezado Ejecutivo */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-lg dark:shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-colors duration-200">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/30 flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-500/10">
            <Building2 className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
              Directorio de Clientes
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Gestión simple de clientes y consignatarios para agilizar el registro de viajes
            </p>
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs sm:text-sm font-black shadow-md shadow-amber-500/20 transition active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Nuevo Cliente</span>
        </button>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-md transition-colors duration-200">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
          <span>Total registrados:</span>
          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono font-black">
            {clientes.length}
          </span>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, NIT o teléfono..."
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 transition"
          />
        </div>
      </div>

      {/* Lista de Clientes */}
      {loading ? (
        <div className="flex flex-col justify-center items-center py-24 gap-3 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
          <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
            Cargando clientes...
          </span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center max-w-md mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
            {search ? "No se encontraron clientes" : "Sin clientes registrados"}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
            {search
              ? "Prueba buscando con otro término o borra el filtro de búsqueda."
              : "Registra los clientes habituales para seleccionarlos con un clic en tus viajes."}
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-md shadow-amber-500/20 transition active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Registrar Cliente</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-amber-500/40 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-amber-500 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-500/10 transition-colors">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase leading-tight line-clamp-1">
                        {c.nombre}
                      </h3>
                      <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
                        {c.nit ? `NIT: ${c.nit}` : "NIT no especificado"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 py-3 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{c.telefono || "Sin teléfono registrado"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{c.direccion || "Sin dirección física"}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2">
                <button
                  onClick={() => openEditModal(c)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-700 dark:text-slate-300 text-xs font-bold transition active:scale-95"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
                <button
                  onClick={() => handleDelete(c)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition active:scale-95"
                  title="Eliminar cliente"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL RESPONSIVO: REGISTRAR / EDITAR CLIENTE (NO CUTOFFS) */}
      {/* ========================================================= */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-hidden animate-in fade-in">
          <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            
            {/* Header Fijo */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    {editingCliente ? "Editar Cliente" : "Registrar Nuevo Cliente"}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Información básica para identificación y selección en viajes
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario con Scroll Interno */}
            <form id="cliente-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Nombre o Razón Social */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Nombre o Razón Social <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => {
                    setFormData({ ...formData, nombre: e.target.value.toUpperCase() });
                    if (errorNombre) setErrorNombre("");
                  }}
                  placeholder="Ej. Y.P.F.B. o REPSOL BOLIVIA"
                  className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-bold uppercase focus:outline-none transition ${
                    errorNombre ? "border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/30" : "border-slate-300 dark:border-slate-800 focus:border-amber-500"
                  }`}
                  autoFocus
                />
                {errorNombre && (
                  <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{errorNombre}</span>
                  </p>
                )}
              </div>

              {/* NIT */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  NIT (Opcional)
                </label>
                <input
                  type="text"
                  value={formData.nit}
                  onChange={(e) => setFormData({ ...formData, nit: e.target.value })}
                  placeholder="Ej. 1020269020"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Teléfono / Celular de Contacto (Opcional)
                </label>
                <input
                  type="text"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  placeholder="Ej. +591 2 2841234 / 71500000"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Dirección */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Dirección o Ciudad (Opcional)
                </label>
                <input
                  type="text"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  placeholder="Ej. La Paz, Planta Senkata"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </form>

            {/* Footer Fijo con Botones de Acción */}
            <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition active:scale-95"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="cliente-form"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black shadow-md shadow-amber-500/20 transition active:scale-95 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5 stroke-[3]" />
                <span>{submitting ? "Guardando..." : editingCliente ? "Actualizar Cliente" : "Guardar Cliente"}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
