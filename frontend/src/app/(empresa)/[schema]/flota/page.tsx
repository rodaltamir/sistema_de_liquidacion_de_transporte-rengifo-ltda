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
  Layers
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
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-500/10">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Equipos y Flota de Transporte
              </h1>
              <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/25">
                {unidades.length} {unidades.length === 1 ? "Cisterna" : "Cisternas"}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
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

      {/* Tarjetas KPI Simétricas y Balanceadas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        
        {/* Tarjeta 1: Total Flota */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-5 shadow-lg shadow-black/20 transition-all flex flex-col justify-between min-h-[125px] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Flota</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
              <Truck className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-black text-white tracking-tight">
              {unidades.length}
            </div>
          </div>
          <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Unidades registradas</span>
            <span className="font-semibold text-slate-300">{unidades.length} en sistema</span>
          </div>
        </div>

        {/* Tarjeta 2: Capacidad Total */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-sky-500/40 rounded-2xl p-5 shadow-lg shadow-black/20 transition-all flex flex-col justify-between min-h-[125px] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Capacidad Total</span>
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform">
              <Fuel className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-black text-white tracking-tight flex items-baseline gap-1.5">
              <span>{formatLitros(totalCapacidadLitros)}</span>
            </div>
          </div>
          <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Carga volumétrica</span>
            <span className="font-bold text-sky-400">{formatM3(totalCapacidadLitros / 1000)}</span>
          </div>
        </div>

        {/* Tarjeta 3: Disponibles */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-5 shadow-lg shadow-black/20 transition-all flex flex-col justify-between min-h-[125px] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Disponibles</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-black text-emerald-400 tracking-tight">
              {totalActivas}
            </div>
          </div>
          <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Listas para viaje</span>
            <span className="font-semibold text-emerald-400">
              {unidades.length > 0 ? Math.round((totalActivas / unidades.length) * 100) : 0}% de flota
            </span>
          </div>
        </div>

        {/* Tarjeta 4: En Ruta */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-5 shadow-lg shadow-black/20 transition-all flex flex-col justify-between min-h-[125px] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">En Ruta</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
              <Clock className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-black text-indigo-400 tracking-tight">
              {totalRuta}
            </div>
          </div>
          <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Despachos en tránsito</span>
            <span className="font-semibold text-indigo-400">
              {unidades.length > 0 ? Math.round((totalRuta / unidades.length) * 100) : 0}% de flota
            </span>
          </div>
        </div>

      </div>

      {/* Barra de Filtros y Búsqueda Equilibrada */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-xl">
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por placa, conductor, marca o B-SISA..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <span>Estado:</span>
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="Todos" className="bg-slate-900">Todos los Estados</option>
              <option value="Activo" className="bg-slate-900">Activo</option>
              <option value="En Ruta" className="bg-slate-900">En Ruta</option>
              <option value="Mantenimiento" className="bg-slate-900">Mantenimiento</option>
              <option value="Inactivo" className="bg-slate-900">Inactivo</option>
            </select>
          </div>

          {(search || estadoFiltro !== "Todos") && (
            <button
              onClick={() => { setSearch(""); setEstadoFiltro("Todos"); }}
              className="px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
            >
              Restablecer
            </button>
          )}
        </div>
      </div>

      {/* Tabla de Unidades o Estado Vacío Intuitivo */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
            <span className="text-xs font-semibold uppercase tracking-wider">Cargando flota vehicular...</span>
          </div>
        ) : filteredUnidades.length === 0 ? (
          unidades.length === 0 ? (
            /* Guía de Inicio Rápido cuando la flota está vacía */
            <div className="text-center py-16 px-6 max-w-2xl mx-auto flex flex-col items-center">
              <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/25 text-amber-400 flex items-center justify-center mb-5 shadow-xl shadow-amber-500/10">
                <Truck className="w-10 h-10" />
              </div>
              
              <h3 className="text-xl font-bold text-white mb-2">
                Comienza registrando las cisternas de tu flota
              </h3>
              
              <p className="text-xs sm:text-sm text-slate-400 text-center max-w-lg mb-6 leading-relaxed">
                Para habilitar la asignación de viajes, el cálculo automático de fletes en Bs y el control de mermas YPFB (0.35%), debes ingresar los camiones cisternas de la empresa.
              </p>

              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2.5 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs sm:text-sm shadow-xl shadow-amber-500/25 transition transform hover:scale-105 active:scale-95 mb-8"
              >
                <Plus className="w-5 h-5 stroke-[3]" />
                <span>Registrar Primera Cisterna</span>
              </button>

              {/* Tarjetas de características y datos clave */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 w-full text-left">
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div className="text-amber-400 font-bold text-xs flex items-center gap-2 mb-1.5">
                    <Fuel className="w-4 h-4 flex-shrink-0" />
                    <span>Capacidad y Litros</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Registra volumen en litros, m³ y número de compartimentos.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div className="text-emerald-400 font-bold text-xs flex items-center gap-2 mb-1.5">
                    <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                    <span>Documentos Oficiales</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Control de B-SISA, SOAT y calibración Senasac al día.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div className="text-sky-400 font-bold text-xs flex items-center gap-2 mb-1.5">
                    <User className="w-4 h-4 flex-shrink-0" />
                    <span>Chofer Asignado</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Vincula conductor con licencia y teléfono de contacto.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Mensaje cuando no hay resultados de búsqueda */
            <div className="text-center py-16 px-6 text-slate-400 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Search className="w-6 h-6" />
              </div>
              <p className="text-base font-bold text-white">No se encontraron camiones</p>
              <p className="text-xs text-slate-400 mt-1 mb-5">
                No hay resultados para los filtros seleccionados. Intenta con otra placa o término.
              </p>
              <button
                onClick={() => { setSearch(""); setEstadoFiltro("Todos"); }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold rounded-xl transition"
              >
                Limpiar Búsqueda
              </button>
            </div>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-950 border-b border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Placa / Unidad</th>
                  <th className="py-3.5 px-4">Tipo y Marca</th>
                  <th className="py-3.5 px-4 text-right">Capacidad</th>
                  <th className="py-3.5 px-4">Chofer Asignado</th>
                  <th className="py-3.5 px-4">Habilitaciones</th>
                  <th className="py-3.5 px-4 text-center">Estado</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredUnidades.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/50 transition">
                    
                    {/* Placa */}
                    <td className="py-3.5 px-4">
                      <div className="inline-flex items-center gap-2 font-mono font-bold text-white text-sm px-3 py-1 bg-slate-950 rounded-xl border border-slate-800">
                        <Truck className="w-3.5 h-3.5 text-amber-400" />
                        <span>{u.placa}</span>
                      </div>
                    </td>

                    {/* Tipo y Marca */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white text-xs">{u.marca || "Sin Marca"} ({u.modelo_ano || "N/A"})</div>
                      <div className="text-[11px] text-slate-400">{u.tipo_unidad}</div>
                    </td>

                    {/* Capacidad */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="font-mono font-bold text-white text-xs">
                        {formatLitros(u.capacidad_litros)}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {formatM3(u.capacidad_m3)} &bull; {u.num_compartimentos} comp.
                      </div>
                    </td>

                    {/* Chofer */}
                    <td className="py-3.5 px-4">
                      {u.conductor_nombre ? (
                        <div className="text-xs">
                          <div className="font-semibold text-white">{u.conductor_nombre}</div>
                          {u.conductor_telefono && (
                            <div className="text-[11px] text-slate-400">{u.conductor_telefono}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 italic">Sin chofer asignado</span>
                      )}
                    </td>

                    {/* Habilitaciones */}
                    <td className="py-3.5 px-4 text-xs">
                      <div className="space-y-0.5">
                        {u.b_sisa && (
                          <div className="text-[11px] text-slate-300">
                            <span className="text-slate-500">B-SISA:</span> {u.b_sisa}
                          </div>
                        )}
                        {u.soat_numero && (
                          <div className="text-[11px] text-slate-300">
                            <span className="text-slate-500">SOAT:</span> {u.soat_numero}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Estado */}
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold border ${
                        u.estado === "Activo"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : u.estado === "En Ruta"
                          ? "bg-sky-500/15 text-sky-400 border-sky-500/30"
                          : u.estado === "Mantenimiento"
                          ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          u.estado === "Activo" ? "bg-emerald-400" :
                          u.estado === "En Ruta" ? "bg-sky-400" :
                          u.estado === "Mantenimiento" ? "bg-amber-400" : "bg-slate-500"
                        }`} />
                        <span>{u.estado}</span>
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          title="Editar unidad"
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          title="Eliminar unidad"
                          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition"
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

      {/* Modal Crear / Editar Unidad */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 w-full max-w-2xl p-6 sm:p-7 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-5">
              <div>
                <h3 className="text-base font-black text-white">
                  {editingUnidad ? `Editar Cisterna: ${editingUnidad.placa}` : "Nueva Cisterna / Camión"}
                </h3>
                <p className="text-xs text-slate-400">
                  Datos técnicos de la unidad y documentación de transporte
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Sección 1: Datos Técnicos */}
              <div>
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5" />
                  <span>1. Identificación y Capacidades</span>
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Placa *</label>
                    <input
                      type="text"
                      required
                      value={formData.placa}
                      onChange={(e) => setFormData({ ...formData, placa: e.target.value.toUpperCase() })}
                      placeholder="ej. 4412-DPC"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500 uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Marca</label>
                    <input
                      type="text"
                      value={formData.marca}
                      onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                      placeholder="ej. Volvo FH12"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Modelo / Año</label>
                    <input
                      type="text"
                      value={formData.modelo_ano}
                      onChange={(e) => setFormData({ ...formData, modelo_ano: e.target.value })}
                      placeholder="ej. 2020"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Capacidad (Litros)</label>
                    <input
                      type="number"
                      required
                      value={formData.capacidad_litros}
                      onChange={(e) => {
                        const l = Number(e.target.value);
                        setFormData({ ...formData, capacidad_litros: l, capacidad_m3: Number((l / 1000).toFixed(2)) });
                      }}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Capacidad (m³)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={formData.capacidad_m3}
                      onChange={(e) => {
                        const m = Number(e.target.value);
                        setFormData({ ...formData, capacidad_m3: m, capacidad_litros: m * 1000 });
                      }}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Nº Compartimentos</label>
                    <input
                      type="number"
                      value={formData.num_compartimentos}
                      onChange={(e) => setFormData({ ...formData, num_compartimentos: Number(e.target.value) })}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Conductor y Propietario */}
              <div className="pt-2 border-t border-slate-800">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  <span>2. Conductor y Propietario</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Nombre Conductor</label>
                    <input
                      type="text"
                      value={formData.conductor_nombre}
                      onChange={(e) => setFormData({ ...formData, conductor_nombre: e.target.value })}
                      placeholder="ej. CARLOS MAMANI CONDORI"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Teléfono Conductor</label>
                    <input
                      type="text"
                      value={formData.conductor_telefono}
                      onChange={(e) => setFormData({ ...formData, conductor_telefono: e.target.value })}
                      placeholder="ej. 71599882"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 3: Habilitaciones y Documentos */}
              <div className="pt-2 border-t border-slate-800">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>3. Documentación Oficial</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">B-SISA</label>
                    <input
                      type="text"
                      value={formData.b_sisa}
                      onChange={(e) => setFormData({ ...formData, b_sisa: e.target.value })}
                      placeholder="ej. BS-90921"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Nº SOAT</label>
                    <input
                      type="text"
                      value={formData.soat_numero}
                      onChange={(e) => setFormData({ ...formData, soat_numero: e.target.value })}
                      placeholder="ej. 2025-SOAT-4892"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Estado</label>
                    <select
                      value={formData.estado}
                      onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="Activo" className="bg-slate-900">Activo</option>
                      <option value="En Ruta" className="bg-slate-900">En Ruta</option>
                      <option value="Mantenimiento" className="bg-slate-900">Mantenimiento</option>
                      <option value="Inactivo" className="bg-slate-900">Inactivo</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20 transition transform active:scale-95"
                >
                  {editingUnidad ? "Guardar Cambios" : "Registrar Unidad"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
