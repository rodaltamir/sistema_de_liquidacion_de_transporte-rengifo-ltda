"use client";

import { Suspense, useState, useEffect, use } from "react";
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

export default function FlotaPage({ params }: { params: Promise<{ schema: string }> }) {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>}>
      <FlotaContent params={params} />
    </Suspense>
  );
}

function FlotaContent({ params }: { params: Promise<{ schema: string }> }) {
  const resolvedParams = use(params);
  const schema = resolvedParams.schema;

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
    } catch (err: any) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Error al cargar flota",
        text: err.message,
        background: "#ffffff",
        color: "#0f172a"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingUnidad(null);
    setFormData({
      placa: "",
      marca: "Volvo",
      modelo_ano: "2020",
      color: "Blanco",
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
      capacidad_litros: unidad.capacidad_litros || 34000,
      capacidad_m3: unidad.capacidad_m3 || 34,
      num_compartimentos: unidad.num_compartimentos || 4,
      conductor_nombre: unidad.conductor_nombre || "",
      conductor_ci: unidad.conductor_ci || "",
      conductor_telefono: unidad.conductor_telefono || "",
      conductor_licencia: unidad.conductor_licencia || "",
      propietario_nombre: unidad.propietario_nombre || "",
      propietario_ci: unidad.propietario_ci || "",
      propietario_telefono: unidad.propietario_telefono || "",
      soat_numero: unidad.soat_numero || "",
      soat_vencimiento: unidad.soat_vencimiento || "",
      b_sisa: unidad.b_sisa || "",
      cert_calibracion_senasac: unidad.cert_calibracion_senasac || "",
      inspeccion_tecnica: unidad.inspeccion_tecnica || "",
      estado: unidad.estado || "Activo",
      notas: unidad.notas || ""
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        ...formData,
        placa: formData.placa.toUpperCase().trim(),
        capacidad_litros: Number(formData.capacidad_litros),
        capacidad_m3: Number(formData.capacidad_m3),
        num_compartimentos: Number(formData.num_compartimentos)
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
          background: "#ffffff",
          color: "#0f172a"
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
          background: "#ffffff",
          color: "#0f172a"
        });
      }

      setShowModal(false);
      loadUnidades();
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al guardar",
        text: err.message,
        background: "#ffffff",
        color: "#0f172a"
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
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      background: "#ffffff",
      color: "#0f172a"
    });

    if (res.isConfirmed) {
      try {
        await apiFetch(`/tenants/${schema}/unidades/${unidad.id}`, { method: "DELETE" });
        Swal.fire({
          icon: "success",
          title: "Unidad eliminada",
          timer: 1200,
          showConfirmButton: false,
          background: "#ffffff",
          color: "#0f172a"
        });
        loadUnidades();
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
    <div className="space-y-6">
      
      {/* Encabezado y Acción Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Equipos y Flota de Transporte
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro técnico de tractocamiones, cisternas de combustible y documentación
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Cisterna / Camión</span>
        </button>
      </div>

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Flota</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{unidades.length}</div>
          <span className="text-[11px] text-slate-400">Unidades registradas</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Capacidad Total</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Fuel className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-indigo-700 mt-2">
            {formatLitros(totalCapacidadLitros)}
          </div>
          <span className="text-[11px] text-slate-400">
            {formatM3(totalCapacidadLitros / 1000)} de carga líquida
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Activas / Disponibles</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2">{totalActivas}</div>
          <span className="text-[11px] text-slate-400">Listas para asignación</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">En Ruta</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-blue-700 mt-2">{totalRuta}</div>
          <span className="text-[11px] text-slate-400">Despachos en tránsito</span>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por placa, conductor, marca o B-SISA..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
          >
            <option value="Todos">Todos los Estados</option>
            <option value="Activo">Activo</option>
            <option value="En Ruta">En Ruta</option>
            <option value="Mantenimiento">Mantenimiento</option>
            <option value="Inactivo">Inactivo</option>
          </select>
        </div>
      </div>

      {/* Tabla de Unidades */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
            <span className="text-xs">Cargando flota...</span>
          </div>
        ) : filteredUnidades.length === 0 ? (
          <div className="text-center py-12 p-4 text-slate-500">
            <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No se encontraron camiones o cisternas</p>
            <p className="text-xs text-slate-400 mt-1">Registra tu primer camión con el botón superior.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Placa / Unidad</th>
                  <th className="py-3 px-4">Tipo y Marca</th>
                  <th className="py-3 px-4 text-right">Capacidad</th>
                  <th className="py-3 px-4">Chofer Asignado</th>
                  <th className="py-3 px-4">Habilitaciones</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUnidades.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    
                    {/* Placa */}
                    <td className="py-3.5 px-4">
                      <div className="inline-flex items-center gap-2 font-mono font-bold text-slate-900 text-sm px-2.5 py-1 bg-slate-100 rounded-lg border border-slate-200">
                        <Truck className="w-3.5 h-3.5 text-blue-600" />
                        <span>{u.placa}</span>
                      </div>
                    </td>

                    {/* Tipo y Marca */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 text-xs">{u.marca || "Sin Marca"} ({u.modelo_ano || "N/A"})</div>
                      <div className="text-[11px] text-slate-500">{u.tipo_unidad}</div>
                    </td>

                    {/* Capacidad */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="font-mono font-bold text-slate-900 text-xs">
                        {formatLitros(u.capacidad_litros)}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {formatM3(u.capacidad_m3)} • {u.num_compartimentos} comp.
                      </div>
                    </td>

                    {/* Chofer */}
                    <td className="py-3.5 px-4">
                      {u.conductor_nombre ? (
                        <div className="text-xs">
                          <div className="font-semibold text-slate-800">{u.conductor_nombre}</div>
                          {u.conductor_telefono && (
                            <div className="text-[11px] text-slate-500">{u.conductor_telefono}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Sin chofer</span>
                      )}
                    </td>

                    {/* Habilitaciones */}
                    <td className="py-3.5 px-4 text-xs">
                      <div className="space-y-0.5">
                        {u.b_sisa && (
                          <div className="text-[11px] text-slate-600">
                            <span className="text-slate-400">B-SISA:</span> {u.b_sisa}
                          </div>
                        )}
                        {u.soat_numero && (
                          <div className="text-[11px] text-slate-600">
                            <span className="text-slate-400">SOAT:</span> {u.soat_numero}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Estado */}
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        u.estado === "Activo"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : u.estado === "En Ruta"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : u.estado === "Mantenimiento"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          u.estado === "Activo" ? "bg-emerald-500" :
                          u.estado === "En Ruta" ? "bg-blue-500" :
                          u.estado === "Mantenimiento" ? "bg-amber-500" : "bg-slate-400"
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
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          title="Eliminar unidad"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingUnidad ? `Editar Cisterna: ${editingUnidad.placa}` : "Nueva Cisterna / Camión"}
                </h3>
                <p className="text-xs text-slate-500">
                  Datos técnicos de la unidad y documentación de transporte
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Sección 1: Datos Técnicos */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-blue-600" />
                  <span>1. Identificación y Capacidades</span>
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Placa *</label>
                    <input
                      type="text"
                      required
                      value={formData.placa}
                      onChange={(e) => setFormData({ ...formData, placa: e.target.value.toUpperCase() })}
                      placeholder="ej. 4412-DPC"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Marca</label>
                    <input
                      type="text"
                      value={formData.marca}
                      onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                      placeholder="ej. Volvo FH12"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Modelo / Año</label>
                    <input
                      type="text"
                      value={formData.modelo_ano}
                      onChange={(e) => setFormData({ ...formData, modelo_ano: e.target.value })}
                      placeholder="ej. 2020"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Capacidad (Litros)</label>
                    <input
                      type="number"
                      required
                      value={formData.capacidad_litros}
                      onChange={(e) => {
                        const l = Number(e.target.value);
                        setFormData({ ...formData, capacidad_litros: l, capacidad_m3: Number((l / 1000).toFixed(2)) });
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Capacidad (m³)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.capacidad_m3}
                      onChange={(e) => setFormData({ ...formData, capacidad_m3: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nº Compartimentos</label>
                    <input
                      type="number"
                      value={formData.num_compartimentos}
                      onChange={(e) => setFormData({ ...formData, num_compartimentos: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Chofer y Propietario */}
              <div className="pt-3 border-t border-slate-200">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  <span>2. Chofer Asignado y Propietario</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre Conductor / Chofer</label>
                    <input
                      type="text"
                      value={formData.conductor_nombre}
                      onChange={(e) => setFormData({ ...formData, conductor_nombre: e.target.value })}
                      placeholder="ej. Jaqueline Lovera Tiñini"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">CI Chofer</label>
                    <input
                      type="text"
                      value={formData.conductor_ci}
                      onChange={(e) => setFormData({ ...formData, conductor_ci: e.target.value })}
                      placeholder="ej. 4892819 LP"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre Propietario</label>
                    <input
                      type="text"
                      value={formData.propietario_nombre}
                      onChange={(e) => setFormData({ ...formData, propietario_nombre: e.target.value })}
                      placeholder="ej. Jose Lovera Tiñini"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">CI Propietario</label>
                    <input
                      type="text"
                      value={formData.propietario_ci}
                      onChange={(e) => setFormData({ ...formData, propietario_ci: e.target.value })}
                      placeholder="ej. 3928190 LP"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 3: Habilitaciones y Estado */}
              <div className="pt-3 border-t border-slate-200">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>3. Documentación y Estado</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nº B-SISA</label>
                    <input
                      type="text"
                      value={formData.b_sisa}
                      onChange={(e) => setFormData({ ...formData, b_sisa: e.target.value })}
                      placeholder="ej. B-SISA-88129"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nº SOAT</label>
                    <input
                      type="text"
                      value={formData.soat_numero}
                      onChange={(e) => setFormData({ ...formData, soat_numero: e.target.value })}
                      placeholder="ej. SOAT-2026-9921"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Estado de la Unidad</label>
                    <select
                      value={formData.estado}
                      onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    >
                      <option value="Activo">Activo (Disponible)</option>
                      <option value="En Ruta">En Ruta</option>
                      <option value="Mantenimiento">Mantenimiento</option>
                      <option value="Inactivo">Inactivo</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Botones */}
              <div className="mt-6 pt-4 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
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
