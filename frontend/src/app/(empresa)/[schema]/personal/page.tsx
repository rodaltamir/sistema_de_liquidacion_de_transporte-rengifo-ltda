"use client";

import { Suspense, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { 
  Users, 
  User,
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Phone, 
  Mail, 
  Truck, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  CreditCard, 
  Briefcase, 
  Calendar, 
  Filter,
  ChevronDown
} from "lucide-react";
import Swal from "sweetalert2";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { useTheme } from "@/context/ThemeContext";

interface Empleado {
  id: number;
  nombres: string;
  apellidos: string;
  ci: string;
  telefono: string | null;
  email: string | null;
  cargo: string;
  licencia_conducir: string | null;
  categoria_licencia: string | null;
  vencimiento_licencia: string | null;
  fecha_ingreso: string | null;
  salario_base: number;
  estado: string;
  unidad_asignada_placa: string | null;
  direccion: string | null;
  contacto_emergencia: string | null;
  notas: string | null;
}

interface Unidad {
  id: number;
  placa: string;
}

export default function PersonalPage() {
  return (
    <Suspense fallback={
      <div className="p-8 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
        <span className="text-slate-400 text-xs font-semibold tracking-wider uppercase">Cargando Personal...</span>
      </div>
    }>
      <PersonalContent />
    </Suspense>
  );
}

function PersonalContent() {
  const routeParams = useParams();
  const schema = (routeParams?.schema as string) || "";

  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cargoFiltro, setCargoFiltro] = useState("Todos");
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");

  const { resolvedTheme } = useTheme();

  const [showModal, setShowModal] = useState(false);
  const [editingEmpleado, setEditingEmpleado] = useState<Empleado | null>(null);
  const [showMoreFields, setShowMoreFields] = useState(false);

  const [formData, setFormData] = useState({
    nombres: "",
    apellidos: "",
    ci: "",
    telefono: "",
    email: "",
    cargo: "Chofer / Conductor",
    licencia_conducir: "",
    categoria_licencia: "Cat. C (Profesional)",
    vencimiento_licencia: "",
    fecha_ingreso: new Date().toISOString().split("T")[0],
    salario_base: 0,
    estado: "Activo",
    unidad_asignada_placa: "",
    direccion: "",
    contacto_emergencia: "",
    notas: ""
  });

  useEffect(() => {
    loadData();
  }, [schema]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [empData, uniData] = await Promise.all([
        apiFetch(`/tenants/${schema}/empleados/`),
        apiFetch(`/tenants/${schema}/unidades/`)
      ]);
      setEmpleados(empData);
      setUnidades(uniData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingEmpleado(null);
    setShowMoreFields(false);
    setFormData({
      nombres: "",
      apellidos: "",
      ci: "",
      telefono: "",
      email: "",
      cargo: "Chofer / Conductor",
      licencia_conducir: "",
      categoria_licencia: "Cat. C (Profesional)",
      vencimiento_licencia: "",
      fecha_ingreso: new Date().toISOString().split("T")[0],
      salario_base: 0,
      estado: "Activo",
      unidad_asignada_placa: "",
      direccion: "",
      contacto_emergencia: "",
      notas: ""
    });
    setShowModal(true);
  };

  const handleOpenEdit = (emp: Empleado) => {
    setEditingEmpleado(emp);
    const hasExtra = Boolean(
      emp.licencia_conducir ||
      emp.email ||
      emp.direccion ||
      emp.contacto_emergencia ||
      (emp.salario_base && emp.salario_base > 0) ||
      emp.notas ||
      (emp.vencimiento_licencia && emp.vencimiento_licencia !== "")
    );
    setShowMoreFields(hasExtra);
    setFormData({
      nombres: emp.nombres,
      apellidos: emp.apellidos,
      ci: emp.ci,
      telefono: emp.telefono || "",
      email: emp.email || "",
      cargo: emp.cargo,
      licencia_conducir: emp.licencia_conducir || "",
      categoria_licencia: emp.categoria_licencia || "Cat. C (Profesional)",
      vencimiento_licencia: emp.vencimiento_licencia ? emp.vencimiento_licencia.split("T")[0] : "",
      fecha_ingreso: emp.fecha_ingreso ? emp.fecha_ingreso.split("T")[0] : "",
      salario_base: emp.salario_base || 0,
      estado: emp.estado,
      unidad_asignada_placa: emp.unidad_asignada_placa || "",
      direccion: emp.direccion || "",
      contacto_emergencia: emp.contacto_emergencia || "",
      notas: emp.notas || ""
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isDark = resolvedTheme === "dark";
    try {
      const payload = {
        ...formData,
        nombres: formData.nombres.trim(),
        apellidos: formData.apellidos.trim(),
        ci: formData.ci.trim().toUpperCase(),
        telefono: formData.telefono.trim() || null,
        email: formData.email.trim() || null,
        licencia_conducir: formData.licencia_conducir.trim() || null,
        categoria_licencia: formData.categoria_licencia.trim() || null,
        vencimiento_licencia: formData.vencimiento_licencia || null,
        fecha_ingreso: formData.fecha_ingreso || null,
        salario_base: Number(formData.salario_base) || 0,
        unidad_asignada_placa: formData.unidad_asignada_placa || null,
        direccion: formData.direccion.trim() || null,
        contacto_emergencia: formData.contacto_emergencia.trim() || null,
        notas: formData.notas.trim() || null
      };

      if (editingEmpleado) {
        await apiFetch(`/tenants/${schema}/empleados/${editingEmpleado.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        Swal.fire({
          icon: "success",
          title: "Empleado actualizado",
          timer: 1400,
          showConfirmButton: false,
          background: isDark ? "#0f172a" : "#ffffff",
          color: isDark ? "#f8fafc" : "#0f172a"
        });
      } else {
        await apiFetch(`/tenants/${schema}/empleados/`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
        Swal.fire({
          icon: "success",
          title: "Empleado registrado",
          timer: 1400,
          showConfirmButton: false,
          background: isDark ? "#0f172a" : "#ffffff",
          color: isDark ? "#f8fafc" : "#0f172a"
        });
      }

      setShowModal(false);
      loadData();
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al guardar personal",
        text: err.message,
        background: isDark ? "#0f172a" : "#ffffff",
        color: isDark ? "#f8fafc" : "#0f172a",
        confirmButtonColor: "#f59e0b"
      });
    }
  };

  const handleDelete = async (emp: Empleado) => {
    const isDark = resolvedTheme === "dark";
    const res = await Swal.fire({
      title: `¿Eliminar a ${emp.nombres} ${emp.apellidos}?`,
      text: `Se eliminará el registro de este empleado (${emp.cargo}) del sistema.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#e11d48",
      cancelButtonColor: isDark ? "#334155" : "#94a3b8",
      background: isDark ? "#0f172a" : "#ffffff",
      color: isDark ? "#f8fafc" : "#0f172a"
    });

    if (res.isConfirmed) {
      try {
        await apiFetch(`/tenants/${schema}/empleados/${emp.id}`, { method: "DELETE" });
        Swal.fire({
          icon: "success",
          title: "Empleado eliminado",
          timer: 1400,
          showConfirmButton: false,
          background: isDark ? "#0f172a" : "#ffffff",
          color: isDark ? "#f8fafc" : "#0f172a"
        });
        loadData();
      } catch (err: any) {
        Swal.fire({
          icon: "error",
          title: "Error al eliminar",
          text: err.message,
          background: isDark ? "#0f172a" : "#ffffff",
          color: isDark ? "#f8fafc" : "#0f172a",
          confirmButtonColor: "#f59e0b"
        });
      }
    }
  };

  const filteredEmpleados = empleados.filter((e) => {
    const matchesSearch =
      `${e.nombres} ${e.apellidos}`.toLowerCase().includes(search.toLowerCase()) ||
      e.ci.toLowerCase().includes(search.toLowerCase()) ||
      (e.licencia_conducir && e.licencia_conducir.toLowerCase().includes(search.toLowerCase())) ||
      (e.unidad_asignada_placa && e.unidad_asignada_placa.toLowerCase().includes(search.toLowerCase()));

    const matchesCargo = cargoFiltro === "Todos" || e.cargo === cargoFiltro;
    const matchesEstado = estadoFiltro === "Todos" || e.estado === estadoFiltro;

    return matchesSearch && matchesCargo && matchesEstado;
  });

  // Estadísticas rápidas
  const totalPersonal = empleados.length;
  const choferesCount = empleados.filter(e => e.cargo.toLowerCase().includes("chofer") || e.cargo.toLowerCase().includes("conductor")).length;
  const activosCount = empleados.filter(e => e.estado === "Activo").length;
  const enRutaCount = empleados.filter(e => e.estado === "En Ruta").length;

  return (
    <div className="space-y-6 sm:space-y-7 font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* Encabezado y Acción Principal (Tarjeta Banner Ejecutiva) */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-md dark:shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-5 transition-colors">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-500/10">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Personal y Conductores de Cisterna
              </h1>
              <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                {totalPersonal} {totalPersonal === 1 ? "Empleado" : "Empleados"}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Gestión de conductores habilitados para hidrocarburos, licencias categoría C, mecánicos y staff
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition transform active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Nuevo Empleado / Chofer</span>
          </button>
        </div>
      </div>

      {/* Tarjetas KPI Simétricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        
        {/* Total Personal */}
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-amber-500/40 rounded-2xl p-5 shadow-md dark:shadow-xl transition-all flex flex-col justify-between min-h-[125px] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Personal</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
              <Users className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {totalPersonal}
            </div>
          </div>
          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Plantilla activa</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">{totalPersonal} registrados</span>
          </div>
        </div>

        {/* Conductores */}
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-sky-500/40 rounded-2xl p-5 shadow-md dark:shadow-xl transition-all flex flex-col justify-between min-h-[125px] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Conductores</span>
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400 group-hover:scale-105 transition-transform">
              <Truck className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {choferesCount}
            </div>
          </div>
          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Habilitados cisterna</span>
            <span className="font-bold text-sky-600 dark:text-sky-400">Licencia Categoría C</span>
          </div>
        </div>

        {/* En Ruta */}
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/40 rounded-2xl p-5 shadow-md dark:shadow-xl transition-all flex flex-col justify-between min-h-[125px] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">En Ruta</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
              <Briefcase className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">
              {enRutaCount}
            </div>
          </div>
          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Despachos en tránsito</span>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              {choferesCount > 0 ? Math.round((enRutaCount / choferesCount) * 100) : 0}% conductores
            </span>
          </div>
        </div>

        {/* Disponibles */}
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 rounded-2xl p-5 shadow-md dark:shadow-xl transition-all flex flex-col justify-between min-h-[125px] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Disponibles</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
              {activosCount}
            </div>
          </div>
          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Listos en base</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {totalPersonal > 0 ? Math.round((activosCount / totalPersonal) * 100) : 0}% plantilla
            </span>
          </div>
        </div>

      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-md dark:shadow-xl transition-colors">
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, CI, licencia o placa asignada..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition shadow-inner"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={cargoFiltro}
            onChange={(e) => setCargoFiltro(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="Todos" className="bg-white dark:bg-slate-900">Todos los Cargos</option>
            <option value="Chofer / Conductor" className="bg-white dark:bg-slate-900">Chofer / Conductor</option>
            <option value="Mecánico / Apoyo" className="bg-white dark:bg-slate-900">Mecánico / Apoyo</option>
            <option value="Despachador" className="bg-white dark:bg-slate-900">Despachador</option>
            <option value="Gerente / Supervisor" className="bg-white dark:bg-slate-900">Gerente / Supervisor</option>
            <option value="Administración" className="bg-white dark:bg-slate-900">Administración</option>
          </select>

          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="Todos" className="bg-white dark:bg-slate-900">Todos los Estados</option>
            <option value="Activo" className="bg-white dark:bg-slate-900">Activo</option>
            <option value="En Ruta" className="bg-white dark:bg-slate-900">En Ruta</option>
            <option value="Descanso" className="bg-white dark:bg-slate-900">Descanso</option>
            <option value="Inactivo" className="bg-white dark:bg-slate-900">Inactivo</option>
          </select>

          {(search || cargoFiltro !== "Todos" || estadoFiltro !== "Todos") && (
            <button
              onClick={() => { setSearch(""); setCargoFiltro("Todos"); setEstadoFiltro("Todos"); }}
              className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            >
              Restablecer
            </button>
          )}
        </div>
      </div>

      {/* Tabla de Empleados o Estado Vacío Intuitivo */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-md dark:shadow-xl transition-colors">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
            <span className="text-xs font-semibold uppercase tracking-wider">Cargando personal...</span>
          </div>
        ) : filteredEmpleados.length === 0 ? (
          empleados.length === 0 ? (
            /* Guía de Inicio Rápido de Personal */
            <div className="text-center py-16 px-6 max-w-2xl mx-auto flex flex-col items-center">
              <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/25 text-amber-500 flex items-center justify-center mb-5 shadow-xl shadow-amber-500/10">
                <Users className="w-10 h-10" />
              </div>
              
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Aún no has registrado choferes o personal
              </h3>
              
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 text-center max-w-lg mb-6 leading-relaxed">
                Registra los conductores autorizados de cisternas para vincularlos automáticamente a los viajes, camiones y liquidaciones de flete.
              </p>

              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2.5 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs sm:text-sm shadow-xl shadow-amber-500/25 transition transform hover:scale-105 active:scale-95 mb-8"
              >
                <Plus className="w-5 h-5 stroke-[3]" />
                <span>Registrar Primer Conductor</span>
              </button>

              {/* Tarjetas de Guía */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 w-full text-left">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                  <div className="text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center gap-2 mb-1.5">
                    <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                    <span>Licencia Categoría C</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    Vigencia de licencia para transporte pesado y de combustible.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                  <div className="text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-2 mb-1.5">
                    <Truck className="w-4 h-4 flex-shrink-0" />
                    <span>Asignación de Cisterna</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    Vinculación a la placa del tractocamión habitual.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                  <div className="text-sky-600 dark:text-sky-400 font-bold text-xs flex items-center gap-2 mb-1.5">
                    <User className="w-4 h-4 flex-shrink-0" />
                    <span>Contacto y Emergencia</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    Teléfono directo, número de cédula y datos del chofer.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 px-6 text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Search className="w-6 h-6" />
              </div>
              <p className="text-base font-bold text-slate-900 dark:text-white">Sin resultados de personal</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-5">
                No hay empleados que coincidan con la búsqueda o cargo seleccionado.
              </p>
              <button
                onClick={() => { setSearch(""); setCargoFiltro("Todos"); setEstadoFiltro("Todos"); }}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition"
              >
                Limpiar Filtros
              </button>
            </div>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Empleado</th>
                  <th className="py-3.5 px-4">Cargo</th>
                  <th className="py-3.5 px-4">Licencia de Conducir</th>
                  <th className="py-3.5 px-4">Unidad Asignada</th>
                  <th className="py-3.5 px-4">Contacto</th>
                  <th className="py-3.5 px-4 text-center">Estado</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredEmpleados.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                    
                    {/* Nombre y CI */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {emp.nombres} {emp.apellidos}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        CI: {emp.ci}
                      </div>
                    </td>

                    {/* Cargo */}
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-xs font-medium">
                        {emp.cargo}
                      </span>
                    </td>

                    {/* Licencia */}
                    <td className="py-3.5 px-4">
                      {emp.licencia_conducir ? (
                        <div className="text-xs">
                          <div className="font-semibold text-amber-600 dark:text-amber-400 font-mono">
                            {emp.licencia_conducir}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {emp.categoria_licencia || "Cat. C"} 
                            {emp.vencimiento_licencia && ` • Vence: ${formatDate(emp.vencimiento_licencia)}`}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No aplica</span>
                      )}
                    </td>

                    {/* Unidad Asignada */}
                    <td className="py-3.5 px-4">
                      {emp.unidad_asignada_placa ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 font-mono text-xs font-bold border border-amber-500/30">
                          <Truck className="w-3.5 h-3.5" />
                          <span>{emp.unidad_asignada_placa}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Sin asignar</span>
                      )}
                    </td>

                    {/* Contacto */}
                    <td className="py-3.5 px-4 text-xs text-slate-700 dark:text-slate-300">
                      {emp.telefono && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{emp.telefono}</span>
                        </div>
                      )}
                      {emp.email && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span className="truncate max-w-[150px]">{emp.email}</span>
                        </div>
                      )}
                    </td>

                    {/* Estado */}
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold border ${
                        emp.estado === "Activo"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          : emp.estado === "En Ruta"
                          ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30"
                          : emp.estado === "Descanso"
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          emp.estado === "Activo" ? "bg-emerald-500" :
                          emp.estado === "En Ruta" ? "bg-sky-500" :
                          emp.estado === "Descanso" ? "bg-amber-500" : "bg-slate-400"
                        }`} />
                        <span>{emp.estado}</span>
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(emp)}
                          title="Editar empleado"
                          className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(emp)}
                          title="Eliminar empleado"
                          className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-xl transition"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Modal Crear / Editar Empleado (UI Adaptable a Modo Claro y Oscuro + Flujo Simplificado) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl p-6 sm:p-7 max-h-[92vh] overflow-y-auto text-slate-900 dark:text-white transition-colors duration-200">
            
            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {editingEmpleado ? "Editar Empleado / Chofer" : "Nuevo Empleado / Chofer"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {editingEmpleado 
                      ? "Modifica los datos del personal operativo o administrativo" 
                      : "Registro ágil y esencial. Puedes guardar ahora o añadir más datos opcionales."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* BLOQUE PRINCIPAL: DATOS ESENCIALES Y RÁPIDOS */}
              <div className="space-y-3.5">
                
                {/* Nombres y Apellidos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nombres <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.nombres}
                      onChange={(e) => setFormData({ ...formData, nombres: e.target.value })}
                      placeholder="ej. Carlos"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:bg-white dark:focus:bg-slate-950 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Apellidos <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.apellidos}
                      onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
                      placeholder="ej. Mamani Condori"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:bg-white dark:focus:bg-slate-950 transition"
                    />
                  </div>
                </div>

                {/* CI y Teléfono */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Cédula de Identidad (CI) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <CreditCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={formData.ci}
                        onChange={(e) => setFormData({ ...formData, ci: e.target.value })}
                        placeholder="ej. 4892819 LP"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:bg-white dark:focus:bg-slate-950 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Teléfono Móvil <span className="text-slate-400 dark:text-slate-500 font-normal">(Opcional)</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={formData.telefono}
                        onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                        placeholder="ej. 77299100"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:bg-white dark:focus:bg-slate-950 transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Cargo, Cisterna Asignada y Estado */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Cargo / Puesto <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.cargo}
                      onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="Chofer / Conductor" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Chofer / Conductor</option>
                      <option value="Mecánico / Apoyo" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Mecánico / Apoyo</option>
                      <option value="Despachador" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Despachador</option>
                      <option value="Gerente / Supervisor" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Gerente / Supervisor</option>
                      <option value="Administración" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Administración</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Cisterna Asignada
                    </label>
                    <select
                      value={formData.unidad_asignada_placa}
                      onChange={(e) => setFormData({ ...formData, unidad_asignada_placa: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Sin asignar (rotativo)</option>
                      {unidades.map((u) => (
                        <option key={u.id} value={u.placa} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                          {u.placa}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Estado Operativo
                    </label>
                    <select
                      value={formData.estado}
                      onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="Activo" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Activo / Disponible</option>
                      <option value="En Ruta" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">En Ruta</option>
                      <option value="Descanso" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Descanso</option>
                      <option value="Inactivo" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Inactivo</option>
                    </select>
                  </div>
                </div>

              </div>

              {/* SECCIÓN COLAPSABLE OPCIONAL: AÑADIR MÁS DATOS */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowMoreFields(!showMoreFields)}
                  className="w-full py-2.5 px-4 bg-slate-100/80 dark:bg-slate-950/60 hover:bg-slate-200/80 dark:hover:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 transition flex items-center justify-between shadow-sm group"
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
                    <span>
                      {showMoreFields 
                        ? "− Ocultar datos adicionales" 
                        : "+ Añadir más datos (Licencia de conducir, correo, dirección...)"}
                    </span>
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 group-hover:text-amber-500 transition-transform duration-200 ${showMoreFields ? "rotate-180 text-amber-500" : ""}`} />
                </button>

                {showMoreFields && (
                  <div className="mt-3.5 p-4 sm:p-5 bg-slate-50/70 dark:bg-slate-950/80 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in duration-200">
                    
                    {/* Subsección: Licencia de Conducir (Para Conductores) */}
                    <div>
                      <h4 className="text-[11px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Licencia de Conducir (Para Choferes)</span>
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Nº Licencia
                          </label>
                          <input
                            type="text"
                            value={formData.licencia_conducir}
                            onChange={(e) => setFormData({ ...formData, licencia_conducir: e.target.value })}
                            placeholder="ej. 4892819"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Categoría
                          </label>
                          <input
                            type="text"
                            value={formData.categoria_licencia}
                            onChange={(e) => setFormData({ ...formData, categoria_licencia: e.target.value })}
                            placeholder="ej. Cat. C (Profesional)"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Vencimiento
                          </label>
                          <input
                            type="date"
                            value={formData.vencimiento_licencia}
                            onChange={(e) => setFormData({ ...formData, vencimiento_licencia: e.target.value })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Subsección: Contacto y Domicilio */}
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                      <h4 className="text-[11px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" />
                        <span>Contacto y Domicilio</span>
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Correo Electrónico
                          </label>
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="ej. chofer@empresa.bo"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Contacto de Emergencia
                          </label>
                          <input
                            type="text"
                            value={formData.contacto_emergencia}
                            onChange={(e) => setFormData({ ...formData, contacto_emergencia: e.target.value })}
                            placeholder="ej. María (Esposa) - 71500000"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Dirección / Domicilio
                          </label>
                          <input
                            type="text"
                            value={formData.direccion}
                            onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                            placeholder="ej. Av. 6 de Marzo Nro 1234, El Alto - La Paz"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Subsección: Datos Laborales y Notas */}
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                      <h4 className="text-[11px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5" />
                        <span>Datos Laborales y Notas</span>
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Fecha de Ingreso
                          </label>
                          <input
                            type="date"
                            value={formData.fecha_ingreso}
                            onChange={(e) => setFormData({ ...formData, fecha_ingreso: e.target.value })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Salario Base (Bs)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.salario_base || ""}
                            onChange={(e) => setFormData({ ...formData, salario_base: parseFloat(e.target.value) || 0 })}
                            placeholder="0.00"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Notas u Observaciones
                          </label>
                          <textarea
                            rows={2}
                            value={formData.notas}
                            onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                            placeholder="Cursos de manejo defensivo, certificación de transporte de carga peligrosa, etc."
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                          />
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>

              {/* Botones de Acción */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/20 transition transform active:scale-95 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                  <span>{editingEmpleado ? "Guardar Cambios" : "Registrar Empleado"}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
