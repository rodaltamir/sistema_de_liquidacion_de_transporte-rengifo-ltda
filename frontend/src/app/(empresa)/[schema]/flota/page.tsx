"use client";

import { Suspense, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { 
  Truck, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Fuel, 
  User, 
  FileText,
  Clock,
  X,
  ShieldCheck,
  Calendar,
  Layers,
  ChevronDown,
  Phone,
  CreditCard
} from "lucide-react";
import Swal from "sweetalert2";
import { apiFetch } from "@/lib/api";
import { formatLitros, formatM3, formatDate } from "@/lib/format";

interface Unidad {
  id: number;
  placa: string;
  marca: string | null;
  modelo_ano: string | null;
  color: string | null;
  tipo_unidad: string | null;
  capacidad_litros: number;
  capacidad_m3: number;
  num_compartimentos: number;
  conductor_nombre: string | null;
  conductor_ci: string | null;
  conductor_telefono: string | null;
  conductor_licencia: string | null;
  propietario_nombre: string | null;
  propietario_ci: string | null;
  propietario_telefono: string | null;
  soat_numero: string | null;
  soat_vencimiento: string | null;
  b_sisa: string | null;
  cert_calibracion_senasac: string | null;
  inspeccion_tecnica: string | null;
  estado: string;
  notas: string | null;
}

export default function FlotaPage() {
  return (
    <Suspense fallback={
      <div className="p-8 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
        <span className="text-slate-400 text-xs font-semibold tracking-wider uppercase">Cargando Flota...</span>
      </div>
    }>
      <FlotaContent />
    </Suspense>
  );
}

function FlotaContent() {
  const routeParams = useParams();
  const schema = (routeParams?.schema as string) || "";

  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");

  const [showModal, setShowModal] = useState(false);
  const [editingUnidad, setEditingUnidad] = useState<Unidad | null>(null);
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  const [formData, setFormData] = useState({
    placa: "",
    marca: "",
    modelo_ano: "",
    color: "",
    tipo_unidad: "Tractocamión Cisterna Combustible",
    capacidad_litros: 34000,
    capacidad_m3: 34,
    num_compartimentos: 4,
    conductor_nombre: "",
    conductor_ci: "",
    conductor_telefono: "",
    conductor_licencia: "",
    propietario_nombre: "",
    propietario_ci: "",
    propietario_telefono: "",
    soat_numero: "",
    soat_vencimiento: "",
    b_sisa: "",
    cert_calibracion_senasac: "",
    inspeccion_tecnica: "",
    estado: "Activo",
    notas: ""
  });

  useEffect(() => {
    loadUnidades();
  }, [schema]);

  const loadUnidades = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/tenants/${schema}/unidades/`);
      setUnidades(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingUnidad(null);
    setShowOptionalFields(false);
    setFormData({
      placa: "",
      marca: "",
      modelo_ano: "",
      color: "",
      tipo_unidad: "Tractocamión Cisterna Combustible",
      capacidad_litros: 34000,
      capacidad_m3: 34,
      num_compartimentos: 4,
      conductor_nombre: "",
      conductor_ci: "",
      conductor_telefono: "",
      conductor_licencia: "",
      propietario_nombre: "",
      propietario_ci: "",
      propietario_telefono: "",
      soat_numero: "",
      soat_vencimiento: "",
      b_sisa: "",
      cert_calibracion_senasac: "",
      inspeccion_tecnica: "",
      estado: "Activo",
      notas: ""
    });
    setShowModal(true);
  };

  const handleOpenEdit = (unidad: Unidad) => {
    setEditingUnidad(unidad);
    setShowOptionalFields(Boolean(unidad.marca || unidad.b_sisa || unidad.soat_numero));
    setFormData({
      placa: unidad.placa,
      marca: unidad.marca || "",
      modelo_ano: unidad.modelo_ano || "",
      color: unidad.color || "",
      tipo_unidad: unidad.tipo_unidad || "Tractocamión Cisterna Combustible",
      capacidad_litros: unidad.capacidad_litros,
      capacidad_m3: unidad.capacidad_m3,
      num_compartimentos: unidad.num_compartimentos,
      conductor_nombre: unidad.conductor_nombre || "",
      conductor_ci: unidad.conductor_ci || "",
      conductor_telefono: unidad.conductor_telefono || "",
      conductor_licencia: unidad.conductor_licencia || "",
      propietario_nombre: unidad.propietario_nombre || "",
      propietario_ci: unidad.propietario_ci || "",
      propietario_telefono: unidad.propietario_telefono || "",
      soat_numero: unidad.soat_numero || "",
      soat_vencimiento: unidad.soat_vencimiento ? unidad.soat_vencimiento.split("T")[0] : "",
      b_sisa: unidad.b_sisa || "",
      cert_calibracion_senasac: unidad.cert_calibracion_senasac || "",
      inspeccion_tecnica: unidad.inspeccion_tecnica || "",
      estado: unidad.estado,
      notas: unidad.notas || ""
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        placa: formData.placa.trim().toUpperCase(),
        capacidad_litros: Number(formData.capacidad_litros),
        capacidad_m3: Number(formData.capacidad_m3),
        num_compartimentos: Number(formData.num_compartimentos),
        soat_vencimiento: formData.soat_vencimiento || null
      };

      if (editingUnidad) {
        await apiFetch(`/tenants/${schema}/unidades/${editingUnidad.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        Swal.fire({
          icon: "success",
          title: "Unidad actualizada",
          timer: 1200,
          showConfirmButton: false,
          background: "#0f172a",
          color: "#f8fafc"
        });
      } else {
        await apiFetch(`/tenants/${schema}/unidades/`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
        Swal.fire({
          icon: "success",
          title: "Unidad registrada con éxito",
          timer: 1200,
          showConfirmButton: false,
          background: "#0f172a",
          color: "#f8fafc"
        });
      }

      setShowModal(false);
      loadUnidades();
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al guardar",
        text: err.message,
        background: "#0f172a",
        color: "#f8fafc",
        confirmButtonColor: "#f59e0b"
      });
    }
  };

  const handleDelete = async (unidad: Unidad) => {
    const res = await Swal.fire({
      title: `¿Eliminar cisterna ${unidad.placa}?`,
      text: "Esta acción eliminará el camión del registro de la empresa.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#e11d48",
      cancelButtonColor: "#334155",
      background: "#0f172a",
      color: "#f8fafc"
    });

    if (res.isConfirmed) {
      try {
        await apiFetch(`/tenants/${schema}/unidades/${unidad.id}`, { method: "DELETE" });
        Swal.fire({
          icon: "success",
          title: "Unidad eliminada",
          timer: 1200,
          showConfirmButton: false,
          background: "#0f172a",
          color: "#f8fafc"
        });
        loadUnidades();
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

  const filteredUnidades = unidades.filter((u) => {
    const matchesSearch =
      u.placa.toLowerCase().includes(search.toLowerCase()) ||
      (u.marca && u.marca.toLowerCase().includes(search.toLowerCase())) ||
      (u.conductor_nombre && u.conductor_nombre.toLowerCase().includes(search.toLowerCase())) ||
      (u.b_sisa && u.b_sisa.toLowerCase().includes(search.toLowerCase()));

    const matchesEstado = estadoFiltro === "Todos" || u.estado === estadoFiltro;

    return matchesSearch && matchesEstado;
  });

  const totalCapacidadLitros = unidades.reduce((acc, u) => acc + (u.capacidad_litros || 0), 0);
  const totalActivas = unidades.filter((u) => u.estado === "Activo").length;
  const totalRuta = unidades.filter((u) => u.estado === "En Ruta").length;

  return (
    <div className="space-y-6 sm:space-y-7 font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* Encabezado y Acción Principal (Tarjeta Banner Ejecutiva) */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-md dark:shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-5 transition-colors">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-500/10">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Equipos y Flota de Transporte
              </h1>
              <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                {unidades.length} {unidades.length === 1 ? "Cisterna" : "Cisternas"}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Control técnico de tractocamiones, cisternas de combustible, calibración y choferes asignados
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition transform active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Nueva Cisterna / Camión</span>
          </button>
        </div>
      </div>

      {/* Tarjetas KPI Simétricas y Balanceadas (3 Tarjetas) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Tarjeta 1: Total Flota */}
        <div className="bg-white dark:bg-gradient-to-b dark:from-slate-900/90 dark:to-slate-950/90 border border-slate-200 dark:border-slate-800/90 hover:border-amber-500/40 rounded-2xl p-5 shadow-md dark:shadow-xl transition-all flex flex-col justify-between min-h-[130px] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Flota</span>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform shadow-inner">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {unidades.length}
            </div>
          </div>
          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Cisternas registradas</span>
            <span className="font-semibold text-amber-600 dark:text-amber-400">{unidades.length} unidades</span>
          </div>
        </div>

        {/* Tarjeta 2: Disponibles */}
        <div className="bg-white dark:bg-gradient-to-b dark:from-slate-900/90 dark:to-slate-950/90 border border-slate-200 dark:border-slate-800/90 hover:border-emerald-500/40 rounded-2xl p-5 shadow-md dark:shadow-xl transition-all flex flex-col justify-between min-h-[130px] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Disponibles</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform shadow-inner">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
              {totalActivas}
            </div>
          </div>
          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Listas para viaje</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {unidades.length > 0 ? Math.round((totalActivas / unidades.length) * 100) : 0}% de flota
            </span>
          </div>
        </div>

        {/* Tarjeta 3: En Ruta */}
        <div className="bg-white dark:bg-gradient-to-b dark:from-slate-900/90 dark:to-slate-950/90 border border-slate-200 dark:border-slate-800/90 hover:border-indigo-500/40 rounded-2xl p-5 shadow-md dark:shadow-xl transition-all flex flex-col justify-between min-h-[130px] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">En Ruta</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform shadow-inner">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">
              {totalRuta}
            </div>
          </div>
          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Despachos en tránsito</span>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              {unidades.length > 0 ? Math.round((totalRuta / unidades.length) * 100) : 0}% de flota
            </span>
          </div>
        </div>

      </div>

      {/* Barra de Filtros y Búsqueda Equilibrada */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-md dark:shadow-xl transition-colors">
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por placa, conductor, marca o B-SISA..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition shadow-inner"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Estado:</span>
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="Todos" className="bg-white dark:bg-slate-900">Todos los Estados</option>
              <option value="Activo" className="bg-white dark:bg-slate-900">Activo</option>
              <option value="En Ruta" className="bg-white dark:bg-slate-900">En Ruta</option>
              <option value="Mantenimiento" className="bg-white dark:bg-slate-900">Mantenimiento</option>
              <option value="Inactivo" className="bg-white dark:bg-slate-900">Inactivo</option>
            </select>
          </div>

          {(search || estadoFiltro !== "Todos") && (
            <button
              onClick={() => { setSearch(""); setEstadoFiltro("Todos"); }}
              className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            >
              Restablecer
            </button>
          )}
        </div>
      </div>

      {/* Tabla de Unidades o Estado Vacío Intuitivo */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-md dark:shadow-xl transition-colors">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
            <span className="text-xs font-semibold uppercase tracking-wider">Cargando flota vehicular...</span>
          </div>
        ) : filteredUnidades.length === 0 ? (
          unidades.length === 0 ? (
            /* Guía de Inicio Rápido cuando la flota está vacía */
            <div className="text-center py-16 px-6 max-w-xl mx-auto flex flex-col items-center">
              <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/25 text-amber-500 flex items-center justify-center mb-4 shadow-xl shadow-amber-500/10">
                <Truck className="w-8 h-8" />
              </div>
              
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                Registra tus unidades de transporte
              </h3>
              
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 text-center max-w-md mb-6 leading-relaxed">
                Ingresa la placa y los datos del conductor para comenzar a cargar despachos, asignar viajes y calcular fletes.
              </p>

              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs sm:text-sm shadow-xl shadow-amber-500/25 transition transform hover:scale-105 active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Registrar Primer Camión</span>
              </button>
            </div>
          ) : (
            /* Mensaje cuando no hay resultados de búsqueda */
            <div className="text-center py-16 px-6 text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Search className="w-6 h-6" />
              </div>
              <p className="text-base font-bold text-slate-900 dark:text-white">No se encontraron camiones</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-5">
                No hay resultados para los filtros seleccionados. Intenta con otra placa o término.
              </p>
              <button
                onClick={() => { setSearch(""); setEstadoFiltro("Todos"); }}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition"
              >
                Limpiar Búsqueda
              </button>
            </div>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-5">Placa / Cisterna</th>
                  <th className="py-3.5 px-5">Conductor Asignado</th>
                  <th className="py-3.5 px-5">Capacidad Estándar</th>
                  <th className="py-3.5 px-5 text-center">Estado Operativo</th>
                  <th className="py-3.5 px-5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredUnidades.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/60 transition group">
                    
                    {/* Placa */}
                    <td className="py-4 px-5">
                      <div className="inline-flex items-center gap-2.5 font-mono font-black text-slate-900 dark:text-white text-sm px-3.5 py-1.5 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner group-hover:border-amber-500/40 transition">
                        <Truck className="w-4 h-4 text-amber-500" />
                        <span>{u.placa}</span>
                      </div>
                      {u.marca && (
                        <div className="text-[11px] text-slate-500 mt-1 pl-1">
                          {u.marca} {u.modelo_ano ? `(${u.modelo_ano})` : ""}
                        </div>
                      )}
                    </td>

                    {/* Conductor Asignado */}
                    <td className="py-4 px-5">
                      {u.conductor_nombre ? (
                        <div className="space-y-1">
                          <div className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                            <span>{u.conductor_nombre}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                            {u.conductor_telefono && (
                              <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{u.conductor_telefono}</span>
                              </span>
                            )}
                            {u.conductor_ci && (
                              <span className="text-slate-400 dark:text-slate-500 font-mono">CI: {u.conductor_ci}</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Sin conductor asignado</span>
                      )}
                    </td>

                    {/* Capacidad */}
                    <td className="py-4 px-5">
                      <div className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                        {formatLitros(u.capacidad_litros || 34000)}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {formatM3((u.capacidad_litros || 34000) / 1000)}
                      </div>
                    </td>

                    {/* Estado */}
                    <td className="py-4 px-5 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                        u.estado === "Activo"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          : u.estado === "En Ruta"
                          ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30"
                          : u.estado === "Mantenimiento"
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          u.estado === "Activo" ? "bg-emerald-500" :
                          u.estado === "En Ruta" ? "bg-sky-500" :
                          u.estado === "Mantenimiento" ? "bg-amber-500" : "bg-slate-400"
                        }`} />
                        <span>{u.estado}</span>
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="py-4 px-5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          title="Editar unidad"
                          className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          title="Eliminar unidad"
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

      {/* Modal Crear / Editar Unidad (Formulario Simplificado) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-6 sm:p-7 max-h-[92vh] overflow-y-auto text-slate-900 dark:text-white transition-colors">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-5">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {editingUnidad ? `Editar Cisterna: ${editingUnidad.placa}` : "Nueva Cisterna / Camión"}
                </h3>
                <p className="text-xs text-slate-400">
                  Ingresa la placa del vehículo y los datos del conductor
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Sección Principal y Esencial */}
              <div className="space-y-3.5">
                
                {/* Placa */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Placa del Camión / Cisterna *
                  </label>
                  <div className="relative">
                    <Truck className="w-4 h-4 text-amber-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={formData.placa}
                      onChange={(e) => setFormData({ ...formData, placa: e.target.value.toUpperCase() })}
                      placeholder="ej. 4412-DCP"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-sm font-mono font-black text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 uppercase tracking-wider"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Identificador único vehicular según RUAT</p>
                </div>

                {/* Conductor y Teléfono */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nombre del Conductor
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={formData.conductor_nombre}
                        onChange={(e) => setFormData({ ...formData, conductor_nombre: e.target.value })}
                        placeholder="ej. CARLOS MAMANI CONDORI"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Teléfono del Conductor
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={formData.conductor_telefono}
                        onChange={(e) => setFormData({ ...formData, conductor_telefono: e.target.value })}
                        placeholder="ej. 71599882"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>

                {/* C.I. Conductor */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    C.I. del Conductor (Opcional)
                  </label>
                  <div className="relative">
                    <CreditCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={formData.conductor_ci}
                      onChange={(e) => setFormData({ ...formData, conductor_ci: e.target.value })}
                      placeholder="ej. 6842109 LP"
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

              </div>

              {/* Sección Opcional Colapsable para Especificaciones Técnicas */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowOptionalFields(!showOptionalFields)}
                  className="w-full py-2.5 px-3 bg-slate-50 dark:bg-slate-950/60 hover:bg-slate-100 dark:hover:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-xl text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    <span>{showOptionalFields ? "− Ocultar datos técnicos opcionales" : "+ Datos técnicos o documentación adicional (Opcional)"}</span>
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showOptionalFields ? "rotate-180" : ""}`} />
                </button>

                {showOptionalFields && (
                  <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-950/80 rounded-2xl border border-slate-200 dark:border-slate-800/80 space-y-3.5 animate-in fade-in">
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Capacidad (Litros)</label>
                        <input
                          type="number"
                          value={formData.capacidad_litros}
                          onChange={(e) => {
                            const l = Number(e.target.value);
                            setFormData({ ...formData, capacidad_litros: l, capacidad_m3: Number((l / 1000).toFixed(2)) });
                          }}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Capacidad (m³)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={formData.capacidad_m3}
                          onChange={(e) => {
                            const m = Number(e.target.value);
                            setFormData({ ...formData, capacidad_m3: m, capacidad_litros: m * 1000 });
                          }}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Marca del Camión</label>
                        <input
                          type="text"
                          value={formData.marca}
                          onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                          placeholder="ej. Volvo FH12 / Scania"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Modelo / Año</label>
                        <input
                          type="text"
                          value={formData.modelo_ano}
                          onChange={(e) => setFormData({ ...formData, modelo_ano: e.target.value })}
                          placeholder="ej. 2021"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">B-SISA</label>
                        <input
                          type="text"
                          value={formData.b_sisa}
                          onChange={(e) => setFormData({ ...formData, b_sisa: e.target.value })}
                          placeholder="ej. BS-90921"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">SOAT</label>
                        <input
                          type="text"
                          value={formData.soat_numero}
                          onChange={(e) => setFormData({ ...formData, soat_numero: e.target.value })}
                          placeholder="ej. 2025-SOAT-4892"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Estado</label>
                        <select
                          value={formData.estado}
                          onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                        >
                          <option value="Activo">Activo</option>
                          <option value="En Ruta">En Ruta</option>
                          <option value="Mantenimiento">Mantenimiento</option>
                          <option value="Inactivo">Inactivo</option>
                        </select>
                      </div>
                    </div>

                  </div>
                )}
              </div>

              {/* Botones de acción */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/20 transition transform active:scale-95 flex items-center gap-1.5"
                >
                  <Truck className="w-4 h-4" />
                  <span>{editingUnidad ? "Guardar Cambios" : "Registrar Unidad"}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
