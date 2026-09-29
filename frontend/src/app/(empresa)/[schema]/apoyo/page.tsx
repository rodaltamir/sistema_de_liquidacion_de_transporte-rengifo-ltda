"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Handshake, 
  Truck, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Phone, 
  Building2, 
  CheckCircle2, 
  Navigation, 
  AlertCircle, 
  User as UserIcon, 
  X, 
  ChevronDown, 
  Layers, 
  Fuel, 
  ArrowRight,
  ShieldCheck,
  FileText
} from "lucide-react";
import Swal from "sweetalert2";
import { apiFetch } from "@/lib/api";
import { formatNumber } from "@/lib/format";

interface UnidadApoyo {
  id: number;
  empresa_apoyo_id: number;
  empresa_apoyo_nombre?: string;
  placa: string;
  conductor_nombre: string | null;
  conductor_telefono: string | null;
  conductor_ci: string | null;
  capacidad_litros: number;
  capacidad_m3: number;
  num_compartimentos: number;
  estado: string; // "Disponible", "En Ruta", "Mantenimiento", "Inactivo"
  notas: string | null;
  created_at: string;
}

interface EmpresaApoyo {
  id: number;
  nombre: string;
  representante: string | null;
  telefono: string | null;
  ci_nit: string | null;
  direccion: string | null;
  notas: string | null;
  is_active: boolean;
  created_at: string;
  unidades: UnidadApoyo[];
  total_unidades: number;
}

interface ApoyoStats {
  total_empresas: number;
  total_unidades: number;
  unidades_disponibles: number;
  unidades_en_ruta: number;
}

export default function ApoyoPage() {
  const routeParams = useParams();
  const schema = (routeParams?.schema as string) || "";
  const router = useRouter();

  const [empresas, setEmpresas] = useState<EmpresaApoyo[]>([]);
  const [stats, setStats] = useState<ApoyoStats>({
    total_empresas: 0,
    total_unidades: 0,
    unidades_disponibles: 0,
    unidades_en_ruta: 0
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("TODOS");

  // Modales
  const [showEmpresaModal, setShowEmpresaModal] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<EmpresaApoyo | null>(null);
  const [showEmpresaDetails, setShowEmpresaDetails] = useState(false);
  const [empresaFormData, setEmpresaFormData] = useState({
    nombre: "",
    representante: "",
    telefono: "",
    ci_nit: "",
    direccion: "",
    notas: ""
  });

  const [showUnidadModal, setShowUnidadModal] = useState(false);
  const [editingUnidad, setEditingUnidad] = useState<UnidadApoyo | null>(null);
  const [showUnidadDetails, setShowUnidadDetails] = useState(false);
  const [unidadFormData, setUnidadFormData] = useState({
    empresa_apoyo_id: "" as string | number,
    placa: "",
    conductor_nombre: "",
    conductor_telefono: "",
    conductor_ci: "",
    capacidad_litros: 34000,
    capacidad_m3: 34.0,
    num_compartimentos: 4,
    estado: "Disponible",
    notas: ""
  });

  useEffect(() => {
    loadData();
  }, [schema]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [empresasData, statsData] = await Promise.all([
        apiFetch(`/tenants/${schema}/apoyo/`),
        apiFetch(`/tenants/${schema}/apoyo/stats`).catch(() => ({
          total_empresas: 0,
          total_unidades: 0,
          unidades_disponibles: 0,
          unidades_en_ruta: 0
        }))
      ]);
      setEmpresas(empresasData || []);
      setStats(statsData);
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

  // --- Manejo Modal Empresa de Apoyo ---
  const handleOpenCreateEmpresa = () => {
    setEditingEmpresa(null);
    setEmpresaFormData({
      nombre: "",
      representante: "",
      telefono: "",
      ci_nit: "",
      direccion: "",
      notas: ""
    });
    setShowEmpresaDetails(false);
    setShowEmpresaModal(true);
  };

  const handleOpenEditEmpresa = (emp: EmpresaApoyo) => {
    setEditingEmpresa(emp);
    setEmpresaFormData({
      nombre: emp.nombre,
      representante: emp.representante || "",
      telefono: emp.telefono || "",
      ci_nit: emp.ci_nit || "",
      direccion: emp.direccion || "",
      notas: emp.notas || ""
    });
    setShowEmpresaDetails(Boolean(emp.ci_nit || emp.direccion || emp.notas));
    setShowEmpresaModal(true);
  };

  const handleSubmitEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        nombre: empresaFormData.nombre.trim(),
        representante: empresaFormData.representante.trim() || null,
        telefono: empresaFormData.telefono.trim() || null,
        ci_nit: empresaFormData.ci_nit.trim() || null,
        direccion: empresaFormData.direccion.trim() || null,
        notas: empresaFormData.notas.trim() || null
      };

      if (editingEmpresa) {
        await apiFetch(`/tenants/${schema}/apoyo/${editingEmpresa.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        Swal.fire({
          icon: "success",
          title: "Empresa de apoyo actualizada",
          timer: 1400,
          showConfirmButton: false,
          background: "#0f172a",
          color: "#f8fafc"
        });
      } else {
        await apiFetch(`/tenants/${schema}/apoyo/`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
        Swal.fire({
          icon: "success",
          title: "Empresa de apoyo registrada",
          text: "Ahora puedes registrar sus cisternas y camiones de apoyo.",
          timer: 1700,
          showConfirmButton: false,
          background: "#0f172a",
          color: "#f8fafc"
        });
      }
      setShowEmpresaModal(false);
      loadData();
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al guardar empresa de apoyo",
        text: err.message,
        background: "#0f172a",
        color: "#f8fafc",
        confirmButtonColor: "#f59e0b"
      });
    }
  };

  const handleDeleteEmpresa = async (emp: EmpresaApoyo) => {
    const res = await Swal.fire({
      title: `¿Eliminar "${emp.nombre}"?`,
      text: `Se eliminarán también sus ${emp.unidades.length} camiones de apoyo asociados. Esta acción no se puede deshacer.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar empresa y camiones",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#334155",
      background: "#0f172a",
      color: "#f8fafc"
    });

    if (res.isConfirmed) {
      try {
        await apiFetch(`/tenants/${schema}/apoyo/${emp.id}`, { method: "DELETE" });
        Swal.fire({
          icon: "success",
          title: "Empresa de apoyo eliminada",
          timer: 1300,
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

  // --- Manejo Modal Camión de Apoyo ---
  const handleOpenCreateUnidad = (empresaId?: number) => {
    setEditingUnidad(null);
    setUnidadFormData({
      empresa_apoyo_id: empresaId || (empresas.length > 0 ? empresas[0].id : ""),
      placa: "",
      conductor_nombre: "",
      conductor_telefono: "",
      conductor_ci: "",
      capacidad_litros: 34000,
      capacidad_m3: 34.0,
      num_compartimentos: 4,
      estado: "Disponible",
      notas: ""
    });
    setShowUnidadDetails(false);
    setShowUnidadModal(true);
  };

  const handleOpenEditUnidad = (unidad: UnidadApoyo) => {
    setEditingUnidad(unidad);
    setUnidadFormData({
      empresa_apoyo_id: unidad.empresa_apoyo_id,
      placa: unidad.placa,
      conductor_nombre: unidad.conductor_nombre || "",
      conductor_telefono: unidad.conductor_telefono || "",
      conductor_ci: unidad.conductor_ci || "",
      capacidad_litros: unidad.capacidad_litros || 34000,
      capacidad_m3: unidad.capacidad_m3 || 34.0,
      num_compartimentos: unidad.num_compartimentos || 4,
      estado: unidad.estado || "Disponible",
      notas: unidad.notas || ""
    });
    setShowUnidadDetails(Boolean(unidad.conductor_ci || unidad.notas || (unidad.capacidad_litros !== 34000)));
    setShowUnidadModal(true);
  };

  const handleSubmitUnidad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unidadFormData.empresa_apoyo_id) {
      Swal.fire({
        icon: "warning",
        title: "Selecciona una empresa",
        text: "Debes asignar el camión a una empresa de apoyo.",
        background: "#0f172a",
        color: "#f8fafc",
        confirmButtonColor: "#f59e0b"
      });
      return;
    }

    try {
      const litros = Number(unidadFormData.capacidad_litros) || 34000;
      const m3 = Number(unidadFormData.capacidad_m3) || (litros / 1000.0);

      const payload = {
        placa: unidadFormData.placa.trim().toUpperCase(),
        conductor_nombre: unidadFormData.conductor_nombre.trim() || null,
        conductor_telefono: unidadFormData.conductor_telefono.trim() || null,
        conductor_ci: unidadFormData.conductor_ci.trim() || null,
        capacidad_litros: litros,
        capacidad_m3: m3,
        num_compartimentos: Number(unidadFormData.num_compartimentos) || 4,
        estado: unidadFormData.estado,
        notas: unidadFormData.notas.trim() || null
      };

      if (editingUnidad) {
        await apiFetch(`/tenants/${schema}/apoyo/unidades/${editingUnidad.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        Swal.fire({
          icon: "success",
          title: "Camión de apoyo actualizado",
          timer: 1300,
          showConfirmButton: false,
          background: "#0f172a",
          color: "#f8fafc"
        });
      } else {
        await apiFetch(`/tenants/${schema}/apoyo/${unidadFormData.empresa_apoyo_id}/unidades`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
        Swal.fire({
          icon: "success",
          title: "Camión de apoyo registrado",
          timer: 1300,
          showConfirmButton: false,
          background: "#0f172a",
          color: "#f8fafc"
        });
      }
      setShowUnidadModal(false);
      loadData();
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al guardar camión de apoyo",
        text: err.message,
        background: "#0f172a",
        color: "#f8fafc",
        confirmButtonColor: "#f59e0b"
      });
    }
  };

  const handleDeleteUnidad = async (unidad: UnidadApoyo) => {
    const res = await Swal.fire({
      title: `¿Eliminar cisterna ${unidad.placa}?`,
      text: "El camión de apoyo será removido de la lista de auxilio.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar camión",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#334155",
      background: "#0f172a",
      color: "#f8fafc"
    });

    if (res.isConfirmed) {
      try {
        await apiFetch(`/tenants/${schema}/apoyo/unidades/${unidad.id}`, { method: "DELETE" });
        Swal.fire({
          icon: "success",
          title: "Camión eliminado",
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

  const handleToggleEstadoUnidad = async (unidad: UnidadApoyo) => {
    const nuevoEstado = unidad.estado === "Disponible" ? "En Ruta" : "Disponible";
    try {
      await apiFetch(`/tenants/${schema}/apoyo/unidades/${unidad.id}`, {
        method: "PUT",
        body: JSON.stringify({ estado: nuevoEstado })
      });
      loadData();
    } catch (err: any) {
      console.error(err);
    }
  };

  // Filtrado de empresas y sus unidades
  const filteredEmpresas = empresas.filter((emp) => {
    const query = search.toLowerCase();
    const matchEmpresa = emp.nombre.toLowerCase().includes(query) ||
      (emp.representante && emp.representante.toLowerCase().includes(query)) ||
      (emp.telefono && emp.telefono.toLowerCase().includes(query));

    const matchUnidad = emp.unidades.some((u) => 
      u.placa.toLowerCase().includes(query) ||
      (u.conductor_nombre && u.conductor_nombre.toLowerCase().includes(query))
    );

    const matchesSearch = matchEmpresa || matchUnidad;

    if (filterEstado === "TODOS") return matchesSearch;
    return matchesSearch && emp.unidades.some((u) => u.estado.toUpperCase() === filterEstado);
  });

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      
      {/* ============================================================== */}
      {/* ENCABEZADO PRINCIPAL DE LA VISTA */}
      {/* ============================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5 transition-colors">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-500 flex items-center justify-center shadow-inner">
              <Handshake className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Empresas y Flota de Apoyo
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Flota externa y aliados transportistas para cubrir sobredemanda de viajes e incrementar ingresos
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleOpenCreateEmpresa}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl text-xs font-black shadow-lg shadow-amber-500/20 transition transform active:scale-95"
          >
            <Building2 className="w-4 h-4 stroke-[2.5]" />
            <span>Nueva Empresa de Apoyo</span>
          </button>

          {empresas.length > 0 && (
            <button
              onClick={() => handleOpenCreateUnidad()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:border-amber-500/60 rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Truck className="w-4 h-4 stroke-[2.5]" />
              <span>+ Asignar Camión</span>
            </button>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* MINI DASHBOARD SIMÉTRICO (4 TARJETAS) */}
      {/* ============================================================== */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Tarjeta 1: Empresas de Apoyo */}
        <div className="p-5 rounded-2xl bg-white dark:bg-gradient-to-b dark:from-slate-900/90 dark:to-slate-950/90 border border-slate-200 dark:border-slate-800 hover:border-amber-500/40 transition-all shadow-md dark:shadow-xl flex flex-col justify-between min-h-[125px] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Aliados de Apoyo</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform shadow-inner">
              <Handshake className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-1.5">
            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {stats.total_empresas}
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Empresas subcontratadas</span>
            <span className="font-semibold text-amber-600 dark:text-amber-400">Red activa</span>
          </div>
        </div>

        {/* Tarjeta 2: Flota de Apoyo Total */}
        <div className="p-5 rounded-2xl bg-white dark:bg-gradient-to-b dark:from-slate-900/90 dark:to-slate-950/90 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/40 transition-all shadow-md dark:shadow-xl flex flex-col justify-between min-h-[125px] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Camiones de Apoyo</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform shadow-inner">
              <Truck className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-1.5">
            <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">
              {stats.total_unidades}
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Parque vehicular externo</span>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">{stats.total_unidades} cisternas</span>
          </div>
        </div>

        {/* Tarjeta 3: Unidades Disponibles */}
        <div className="p-5 rounded-2xl bg-white dark:bg-gradient-to-b dark:from-slate-900/90 dark:to-slate-950/90 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 transition-all shadow-md dark:shadow-xl flex flex-col justify-between min-h-[125px] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Disponibles Inmediatas</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform shadow-inner">
              <CheckCircle2 className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-1.5">
            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
              {stats.unidades_disponibles}
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Listas para viaje</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Sin flete activo</span>
          </div>
        </div>

        {/* Tarjeta 4: Unidades en Ruta */}
        <div className="p-5 rounded-2xl bg-white dark:bg-gradient-to-b dark:from-slate-900/90 dark:to-slate-950/90 border border-slate-200 dark:border-slate-800 hover:border-sky-500/40 transition-all shadow-md dark:shadow-xl flex flex-col justify-between min-h-[125px] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">En Tránsito / Ruta</span>
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-600 dark:text-sky-400 flex items-center justify-center group-hover:scale-105 transition-transform shadow-inner">
              <Navigation className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-1.5">
            <div className="text-3xl font-black text-sky-600 dark:text-sky-400 tracking-tight">
              {stats.unidades_en_ruta}
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Con flete en curso</span>
            <span className="font-semibold text-sky-600 dark:text-sky-400">Operando</span>
          </div>
        </div>

      </section>

      {/* ============================================================== */}
      {/* BARRA DE HERRAMIENTAS Y BÚSQUEDA */}
      {/* ============================================================== */}
      <section className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-md dark:shadow-xl space-y-3 transition-colors">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          
          {/* Buscador */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-amber-500" />
            </div>
            <input
              type="text"
              placeholder="Buscar por empresa aliada, placa de cisterna o conductor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm rounded-xl focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition shadow-inner"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filtro por Estado */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 flex-shrink-0">
            {["TODOS", "DISPONIBLE", "EN RUTA"].map((est) => (
              <button
                key={est}
                onClick={() => setFilterEstado(est)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  filterEstado === est
                    ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {est === "TODOS" ? "Todos los Camiones" : est === "DISPONIBLE" ? "Disponibles" : "En Ruta"}
              </button>
            ))}
          </div>

        </div>
      </section>

      {/* ============================================================== */}
      {/* LISTADO DE EMPRESAS DE APOYO Y SUS CAMIONES */}
      {/* ============================================================== */}
      <section className="space-y-5">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
            <span className="text-xs font-semibold uppercase tracking-wider">Cargando empresas y flota de apoyo...</span>
          </div>
        ) : filteredEmpresas.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900/60 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm dark:shadow-2xl max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto mb-4">
              <Handshake className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {empresas.length === 0 ? "No hay empresas de apoyo registradas" : "Sin resultados"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-sm mx-auto leading-relaxed">
              {empresas.length === 0 
                ? "Registra una empresa de apoyo para añadir camiones externos y atender más viajes cuando tu flota titular esté ocupada."
                : "No se encontraron empresas o camiones de apoyo que coincidan con la búsqueda."}
            </p>
            {empresas.length === 0 && (
              <button
                onClick={handleOpenCreateEmpresa}
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl text-xs font-black shadow-lg shadow-amber-500/20 transition"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Registrar Primera Empresa de Apoyo</span>
              </button>
            )}
          </div>
        ) : (
          filteredEmpresas.map((emp) => (
            <div 
              key={emp.id}
              className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/90 rounded-2xl overflow-hidden shadow-sm dark:shadow-xl transition-all hover:border-slate-300 dark:hover:border-slate-750"
            >
              {/* Encabezado de la Empresa de Apoyo */}
              <div className="p-5 bg-slate-50 dark:bg-gradient-to-r dark:from-slate-900 dark:to-slate-950 border-b border-slate-200 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
                
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 shadow-inner">
                    <Handshake className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 inline-flex items-center gap-1">
                        <Building2 className="w-2.5 h-2.5" />
                        Empresa de Apoyo
                      </span>
                      {emp.ci_nit && (
                        <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 bg-slate-200/80 dark:bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-700/60">
                          NIT/CI: {emp.ci_nit}
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                        {emp.unidades.length} {emp.unidades.length === 1 ? "cisterna" : "cisternas"}
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                      {emp.nombre}
                    </h3>

                    {/* Metadatos de contacto */}
                    <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                      {emp.representante && (
                        <div className="flex items-center gap-1.5">
                          <UserIcon className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-slate-700 dark:text-slate-300 font-medium">{emp.representante}</span>
                        </div>
                      )}
                      {emp.telefono && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-slate-700 dark:text-slate-300 font-medium">{emp.telefono}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Acciones de la Empresa */}
                <div className="flex items-center gap-2 self-end md:self-center flex-shrink-0">
                  <button
                    onClick={() => handleOpenCreateUnidad(emp.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500 text-amber-700 dark:text-amber-400 hover:text-slate-950 border border-amber-500/30 rounded-lg text-xs font-bold transition shadow-sm"
                    title="Añadir camión a esta empresa"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Añadir Camión</span>
                  </button>

                  <button
                    onClick={() => handleOpenEditEmpresa(emp)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                    title="Editar datos de empresa de apoyo"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteEmpresa(emp)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                    title="Eliminar empresa de apoyo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

              </div>

              {/* Sub-tabla de Camiones de Apoyo */}
              <div className="p-4 sm:p-5">
                {emp.unidades.length === 0 ? (
                  <div className="py-6 text-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-850 border-dashed text-xs">
                    <span>Esta empresa de apoyo no tiene camiones registrados todavía. </span>
                    <button
                      onClick={() => handleOpenCreateUnidad(emp.id)}
                      className="text-amber-600 dark:text-amber-400 hover:underline font-bold ml-1 inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Registrar cisterna ahora
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          <th className="pb-3 px-3">Placa / Cisterna</th>
                          <th className="pb-3 px-3">Conductor Asignado</th>
                          <th className="pb-3 px-3">Teléfono Chofer</th>
                          <th className="pb-3 px-3 text-right">Capacidad</th>
                          <th className="pb-3 px-3 text-center">Estado Operativo</th>
                          <th className="pb-3 px-3 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                        {emp.unidades.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/40 transition-colors group">
                            
                            {/* Placa */}
                            <td className="py-3 px-3">
                              <div className="inline-flex items-center gap-2">
                                <span className="font-mono font-black text-xs text-amber-600 dark:text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-md tracking-wider shadow-inner">
                                  {u.placa}
                                </span>
                              </div>
                            </td>

                            {/* Conductor */}
                            <td className="py-3 px-3 text-slate-900 dark:text-white font-medium">
                              {u.conductor_nombre ? (
                                <div className="flex items-center gap-1.5">
                                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{u.conductor_nombre}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">No asignado</span>
                              )}
                            </td>

                            {/* Teléfono Chofer */}
                            <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                              {u.conductor_telefono ? (
                                <div className="flex items-center gap-1.5 font-mono text-slate-700 dark:text-slate-300">
                                  <Phone className="w-3 h-3 text-amber-500" />
                                  <span>{u.conductor_telefono}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-600">—</span>
                              )}
                            </td>

                            {/* Capacidad */}
                            <td className="py-3 px-3 text-right font-mono text-slate-800 dark:text-slate-200">
                              <span className="font-bold">{formatNumber(u.capacidad_litros, 0)} L</span>
                              <span className="text-slate-500 text-[11px] block">({formatNumber(u.capacidad_m3, 1)} m³)</span>
                            </td>

                            {/* Estado Operativo */}
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => handleToggleEstadoUnidad(u)}
                                title="Clic para alternar estado"
                                className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1.5 transition cursor-pointer hover:opacity-80 ${
                                  u.estado === "Disponible"
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25"
                                    : u.estado === "En Ruta"
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25"
                                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25"
                                }`}
                              >
                                {u.estado === "Disponible" ? (
                                  <CheckCircle2 className="w-3 h-3" />
                                ) : (
                                  <Navigation className="w-3 h-3" />
                                )}
                                <span>{u.estado}</span>
                              </button>
                            </td>

                            {/* Acciones */}
                            <td className="py-3 px-3 text-right">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  onClick={() => handleOpenEditUnidad(u)}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                                  title="Editar camión"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteUnidad(u)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                                  title="Eliminar camión"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>

                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          ))
        )}
      </section>

      {/* ============================================================== */}
      {/* MODAL CREAR / EDITAR EMPRESA DE APOYO */}
      {/* ============================================================== */}
      {showEmpresaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-6 sm:p-7 max-h-[92vh] overflow-y-auto text-slate-900 dark:text-white transition-colors">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-500">
                  <Handshake className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {editingEmpresa ? "Editar Empresa de Apoyo" : "Nueva Empresa de Apoyo"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {editingEmpresa ? "Modifica los datos del aliado transportista" : "Registra un transportista aliado para auxilio de fletes"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEmpresaModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEmpresa} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Nombre de la Empresa de Apoyo / Aliado *
                </label>
                <input
                  type="text"
                  required
                  value={empresaFormData.nombre}
                  onChange={(e) => setEmpresaFormData({ ...empresaFormData, nombre: e.target.value })}
                  placeholder="ej. TRANSPORTES SAN CRISTÓBAL"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Representante / Contacto
                  </label>
                  <input
                    type="text"
                    value={empresaFormData.representante}
                    onChange={(e) => setEmpresaFormData({ ...empresaFormData, representante: e.target.value })}
                    placeholder="ej. Carlos Mendoza"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Teléfono / Celular
                  </label>
                  <input
                    type="text"
                    value={empresaFormData.telefono}
                    onChange={(e) => setEmpresaFormData({ ...empresaFormData, telefono: e.target.value })}
                    placeholder="ej. 77201928"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Acordeón Opcional */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowEmpresaDetails(!showEmpresaDetails)}
                  className="flex items-center justify-between w-full py-2 px-1 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition group"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-500" />
                    <span>Datos Adicionales (NIT, Dirección, Notas)</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-amber-500 transition-transform duration-200 ${showEmpresaDetails ? "rotate-180 text-amber-500" : ""}`} />
                </button>

                {showEmpresaDetails && (
                  <div className="mt-2.5 space-y-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 animate-in fade-in">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                        C.I. o NIT del Aliado
                      </label>
                      <input
                        type="text"
                        value={empresaFormData.ci_nit}
                        onChange={(e) => setEmpresaFormData({ ...empresaFormData, ci_nit: e.target.value })}
                        placeholder="ej. 394819201"
                        className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                        Dirección / Base de Operaciones
                      </label>
                      <input
                        type="text"
                        value={empresaFormData.direccion}
                        onChange={(e) => setEmpresaFormData({ ...empresaFormData, direccion: e.target.value })}
                        placeholder="ej. Av. Petrolera Km 4, Cochabamba"
                        className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                        Notas / Condiciones de Auxilio
                      </label>
                      <textarea
                        rows={2}
                        value={empresaFormData.notas}
                        onChange={(e) => setEmpresaFormData({ ...empresaFormData, notas: e.target.value })}
                        placeholder="ej. Disponible para tramos La Paz - Santa Cruz..."
                        className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEmpresaModal(false)}
                  className="px-4.5 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20 transition transform active:scale-95"
                >
                  {editingEmpresa ? "Guardar Cambios" : "Registrar Empresa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL CREAR / EDITAR CAMIÓN DE APOYO */}
      {/* ============================================================== */}
      {showUnidadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-6 sm:p-7 max-h-[92vh] overflow-y-auto text-slate-900 dark:text-white transition-colors">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-500">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {editingUnidad ? "Editar Camión de Apoyo" : "Asignar Camión de Apoyo"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Cisterna externa habilitada para fletes en auxilio
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUnidadModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitUnidad} className="space-y-4">
              
              {/* Selector de Empresa de Apoyo */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Empresa de Apoyo Aliada *
                </label>
                <select
                  required
                  value={unidadFormData.empresa_apoyo_id}
                  onChange={(e) => setUnidadFormData({ ...unidadFormData, empresa_apoyo_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
                >
                  <option value="">Seleccione una empresa de apoyo...</option>
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre} {e.representante ? `(${e.representante})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Placa y Estado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Placa / Cisterna *
                  </label>
                  <input
                    type="text"
                    required
                    value={unidadFormData.placa}
                    onChange={(e) => setUnidadFormData({ ...unidadFormData, placa: e.target.value.toUpperCase() })}
                    placeholder="ej. 3844-XZY"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white uppercase placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Estado Operativo
                  </label>
                  <select
                    value={unidadFormData.estado}
                    onChange={(e) => setUnidadFormData({ ...unidadFormData, estado: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="Disponible">Disponible (Listo)</option>
                    <option value="En Ruta">En Ruta (En tránsito)</option>
                    <option value="Mantenimiento">Mantenimiento</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </div>
              </div>

              {/* Conductor y Teléfono */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Nombre del Conductor
                  </label>
                  <input
                    type="text"
                    value={unidadFormData.conductor_nombre}
                    onChange={(e) => setUnidadFormData({ ...unidadFormData, conductor_nombre: e.target.value })}
                    placeholder="ej. Juan Choque"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Teléfono del Conductor
                  </label>
                  <input
                    type="text"
                    value={unidadFormData.conductor_telefono}
                    onChange={(e) => setUnidadFormData({ ...unidadFormData, conductor_telefono: e.target.value })}
                    placeholder="ej. 71928300"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Acordeón Opcional: Capacidad y CI */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowUnidadDetails(!showUnidadDetails)}
                  className="flex items-center justify-between w-full py-2 px-1 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition group"
                >
                  <div className="flex items-center gap-2">
                    <Fuel className="w-4 h-4 text-amber-500" />
                    <span>Capacidad y Detalles Técnicos (Opcional)</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-amber-500 transition-transform duration-200 ${showUnidadDetails ? "rotate-180 text-amber-500" : ""}`} />
                </button>

                {showUnidadDetails && (
                  <div className="mt-2.5 space-y-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 animate-in fade-in">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                          Capacidad (Litros)
                        </label>
                        <input
                          type="number"
                          value={unidadFormData.capacidad_litros}
                          onChange={(e) => {
                            const l = parseFloat(e.target.value) || 0;
                            setUnidadFormData({
                              ...unidadFormData,
                              capacidad_litros: l,
                              capacidad_m3: +(l / 1000.0).toFixed(2)
                            });
                          }}
                          className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                          Capacidad (m³)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={unidadFormData.capacidad_m3}
                          onChange={(e) => {
                            const m3 = parseFloat(e.target.value) || 0;
                            setUnidadFormData({
                              ...unidadFormData,
                              capacidad_m3: m3,
                              capacidad_litros: +(m3 * 1000.0).toFixed(0)
                            });
                          }}
                          className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                          C.I. Conductor
                        </label>
                        <input
                          type="text"
                          value={unidadFormData.conductor_ci}
                          onChange={(e) => setUnidadFormData({ ...unidadFormData, conductor_ci: e.target.value })}
                          placeholder="ej. 8271920"
                          className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                          Compartimentos
                        </label>
                        <input
                          type="number"
                          value={unidadFormData.num_compartimentos}
                          onChange={(e) => setUnidadFormData({ ...unidadFormData, num_compartimentos: parseInt(e.target.value) || 4 })}
                          className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowUnidadModal(false)}
                  className="px-4.5 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20 transition transform active:scale-95"
                >
                  {editingUnidad ? "Guardar Cambios" : "Asignar Camión"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
