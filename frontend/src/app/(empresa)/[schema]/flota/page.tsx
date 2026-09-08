"use client";

import { useState, useEffect, use } from "react";
import { 
  Truck, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  ShieldAlert, 
  Fuel, 
  User, 
  FileText,
  Clock
} from "lucide-react";
import Swal from "sweetalert2";
import { apiFetch } from "@/lib/api";
import { formatLitros, formatM3, formatDate } from "@/lib/format";

interface Unidad {
  id: number;
  placa: string;
  marca: string | null;
  modelo_ano: string | null;
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
  const resolvedParams = use(params);
  const schema = resolvedParams.schema;

  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");

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
    try {
      const data = await apiFetch(`/tenants/${schema}/unidades/`);
      setUnidades(data);
    } catch (err: any) {
      console.error(err);
      Swal.fire({ icon: "error", title: "Error", text: err.message, background: "#0f172a", color: "#fff" });
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingUnidad(null);
    setFormData({
      placa: "",
      marca: "Volvo FH",
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

  const openEditModal = (u: Unidad) => {
    setEditingUnidad(u);
    setFormData({
      placa: u.placa,
      marca: u.marca || "",
      modelo_ano: u.modelo_ano || "",
      color: (u as any).color || "",
      tipo_unidad: u.tipo_unidad || "Tractocamión Cisterna Combustible",
      capacidad_litros: u.capacidad_litros || 34000,
      capacidad_m3: u.capacidad_m3 || 34,
      num_compartimentos: u.num_compartimentos || 4,
      conductor_nombre: u.conductor_nombre || "",
      conductor_ci: u.conductor_ci || "",
      conductor_telefono: u.conductor_telefono || "",
      conductor_licencia: u.conductor_licencia || "",
      propietario_nombre: u.propietario_nombre || "",
      propietario_ci: u.propietario_ci || "",
      propietario_telefono: u.propietario_telefono || "",
      soat_numero: u.soat_numero || "",
      soat_vencimiento: u.soat_vencimiento || "",
      b_sisa: u.b_sisa || "",
      cert_calibracion_senasac: u.cert_calibracion_senasac || "",
      inspeccion_tecnica: u.inspeccion_tecnica || "",
      estado: u.estado || "Activo",
      notas: u.notas || ""
    });
    setShowModal(true);
  };

  const handleDelete = async (u: Unidad) => {
    const result = await Swal.fire({
      title: `¿Eliminar camión ${u.placa}?`,
      text: "Se eliminarán sus datos técnicos registrados.",
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
        await apiFetch(`/tenants/${schema}/unidades/${u.id}`, { method: "DELETE" });
        Swal.fire({ icon: "success", title: "Unidad eliminada", background: "#0f172a", color: "#fff", timer: 1500, showConfirmButton: false });
        loadUnidades();
      } catch (err: any) {
        Swal.fire({ icon: "error", title: "Error", text: err.message, background: "#0f172a", color: "#fff" });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        capacidad_litros: parseFloat(formData.capacidad_litros.toString()),
        capacidad_m3: parseFloat(formData.capacidad_m3.toString()),
        num_compartimentos: parseInt(formData.num_compartimentos.toString()),
        soat_vencimiento: formData.soat_vencimiento || null
      };

      if (editingUnidad) {
        await apiFetch(`/tenants/${schema}/unidades/${editingUnidad.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        Swal.fire({ icon: "success", title: "Unidad actualizada", background: "#0f172a", color: "#fff", timer: 1500, showConfirmButton: false });
      } else {
        await apiFetch(`/tenants/${schema}/unidades/`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
        Swal.fire({ icon: "success", title: "Unidad registrada", background: "#0f172a", color: "#fff", timer: 1500, showConfirmButton: false });
      }
      setShowModal(false);
      loadUnidades();
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "Error al guardar", text: err.message, background: "#0f172a", color: "#fff" });
    }
  };

  const filtered = unidades.filter((u) => {
    if (estadoFiltro && u.estado !== estadoFiltro) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchPlaca = u.placa.toLowerCase().includes(q);
      const matchCond = u.conductor_nombre ? u.conductor_nombre.toLowerCase().includes(q) : false;
      const matchProp = u.propietario_nombre ? u.propietario_nombre.toLowerCase().includes(q) : false;
      return matchPlaca || matchCond || matchProp;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Truck className="w-7 h-7 text-cyan-400" />
            <span>Flota de Transporte y Unidades Cisterna</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Registro de camiones cisterna, capacidades, choferes, propietarios y documentación YPFB
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Nuevo Camión</span>
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por placa, conductor o propietario..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="w-full sm:w-auto bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="">Todos los Estados</option>
            <option value="Activo">Activo</option>
            <option value="En Ruta">En Ruta</option>
            <option value="Mantenimiento">Mantenimiento</option>
          </select>
        </div>
      </div>

      {/* Tabla de Flota */}
      {loading ? (
        <div className="flex justify-center items-center py-24">
          <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center max-w-md mx-auto">
          <Truck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">No hay camiones registrados</h3>
          <p className="text-sm text-slate-400 mb-6">Registra tu primera unidad para comenzar a cargar fletes.</p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition"
          >
            Registrar Camión
          </button>
        </div>
      ) : (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-800/80 border-b border-slate-700/80 text-slate-300 font-bold uppercase text-[10px]">
                  <th className="py-3 px-4">Placa</th>
                  <th className="py-3 px-4">Vehículo</th>
                  <th className="py-3 px-4">Capacidad</th>
                  <th className="py-3 px-4">Conductor</th>
                  <th className="py-3 px-4">Propietario</th>
                  <th className="py-3 px-4">SOAT / B-SISA</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-mono font-black text-white text-sm">
                      {u.placa}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-200">{u.marca || "Tractocamión"}</div>
                      <div className="text-[11px] text-slate-400">{u.modelo_ano ? `Año ${u.modelo_ano}` : u.tipo_unidad}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold font-mono text-cyan-400">{formatLitros(u.capacidad_litros)}</div>
                      <div className="text-[10px] text-slate-400">{u.num_compartimentos} compartimentos ({formatM3(u.capacidad_m3)})</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-200">{u.conductor_nombre || "Sin asignar"}</div>
                      {u.conductor_ci && <div className="text-[10px] text-slate-400">CI: {u.conductor_ci}</div>}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-300">{u.propietario_nombre || "Empresa"}</div>
                      {u.propietario_telefono && <div className="text-[10px] text-slate-400">Telf: {u.propietario_telefono}</div>}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-[11px] text-slate-300">
                        SOAT: <span className="font-mono text-white">{u.soat_numero || "Vigente"}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        B-SISA: <span className="font-mono">{u.b_sisa || "Registrado"}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        u.estado === "Activo"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                          : u.estado === "En Ruta"
                          ? "bg-blue-950 text-blue-400 border border-blue-800"
                          : "bg-amber-950 text-amber-400 border border-amber-800"
                      }`}>
                        {u.estado}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEditModal(u)}
                          className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-cyan-300 transition"
                          title="Editar Unidad"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition"
                          title="Eliminar Unidad"
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
        </div>
      )}

      {/* Modal Crear / Editar Unidad */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-cyan-400" />
                {editingUnidad ? `Editar Unidad ${editingUnidad.placa}` : "Registrar Nueva Unidad Cisterna"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2 border-b border-slate-800 pb-1">
                1. Datos Técnicos del Vehículo
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Placa del Camión *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.placa}
                    onChange={(e) => setFormData({ ...formData, placa: e.target.value.toUpperCase() })}
                    placeholder="4412-DPC"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono font-bold text-sm focus:outline-none focus:border-cyan-500 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Marca
                  </label>
                  <input
                    type="text"
                    value={formData.marca}
                    onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                    placeholder="Volvo FH12 / Scania"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Año / Modelo
                  </label>
                  <input
                    type="text"
                    value={formData.modelo_ano}
                    onChange={(e) => setFormData({ ...formData, modelo_ano: e.target.value })}
                    placeholder="2019"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Capacidad (Litros)
                  </label>
                  <input
                    type="number"
                    value={formData.capacidad_litros}
                    onChange={(e) => {
                      const lts = parseFloat(e.target.value) || 0;
                      setFormData({ 
                        ...formData, 
                        capacidad_litros: lts,
                        capacidad_m3: lts / 1000 
                      });
                    }}
                    placeholder="34000"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Capacidad (m³)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.capacidad_m3}
                    onChange={(e) => setFormData({ ...formData, capacidad_m3: parseFloat(e.target.value) || 0 })}
                    placeholder="34.000"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Nº Compartimentos
                  </label>
                  <input
                    type="number"
                    value={formData.num_compartimentos}
                    onChange={(e) => setFormData({ ...formData, num_compartimentos: parseInt(e.target.value) || 4 })}
                    placeholder="4"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider mt-6 mb-2 border-b border-slate-800 pb-1">
                2. Conductor y Propietario
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Nombre del Conductor
                  </label>
                  <input
                    type="text"
                    value={formData.conductor_nombre}
                    onChange={(e) => setFormData({ ...formData, conductor_nombre: e.target.value })}
                    placeholder="Jaqueline Lovera Tiñini"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    CI Conductor / Licencia
                  </label>
                  <input
                    type="text"
                    value={formData.conductor_ci}
                    onChange={(e) => setFormData({ ...formData, conductor_ci: e.target.value })}
                    placeholder="4892819 LP"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Propietario de la Unidad
                  </label>
                  <input
                    type="text"
                    value={formData.propietario_nombre}
                    onChange={(e) => setFormData({ ...formData, propietario_nombre: e.target.value })}
                    placeholder="Jose Lovera Tiñini"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Teléfono Propietario / Chofer
                  </label>
                  <input
                    type="text"
                    value={formData.propietario_telefono}
                    onChange={(e) => setFormData({ ...formData, propietario_telefono: e.target.value })}
                    placeholder="77299100"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider mt-6 mb-2 border-b border-slate-800 pb-1">
                3. Documentación y Estado
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Nº SOAT
                  </label>
                  <input
                    type="text"
                    value={formData.soat_numero}
                    onChange={(e) => setFormData({ ...formData, soat_numero: e.target.value })}
                    placeholder="SOAT-2026-991"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Nº Tarjeta B-SISA
                  </label>
                  <input
                    type="text"
                    value={formData.b_sisa}
                    onChange={(e) => setFormData({ ...formData, b_sisa: e.target.value })}
                    placeholder="B-SISA-88129"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Estado
                  </label>
                  <select
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Activo">Activo</option>
                    <option value="En Ruta">En Ruta</option>
                    <option value="Mantenimiento">Mantenimiento</option>
                  </select>
                </div>
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
