"use client";

import { Suspense, useState, useEffect, use } from "react";
import { 
  Users, 
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
  Filter
} from "lucide-react";
import Swal from "sweetalert2";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";

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

export default function PersonalPage({ params }: { params: Promise<{ schema: string }> }) {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>}>
      <PersonalContent params={params} />
    </Suspense>
  );
}

function PersonalContent({ params }: { params: Promise<{ schema: string }> }) {
  const resolvedParams = use(params);
  const schema = resolvedParams.schema;

  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cargoFiltro, setCargoFiltro] = useState("Todos");
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");

  const [showModal, setShowModal] = useState(false);
  const [editingEmpleado, setEditingEmpleado] = useState<Empleado | null>(null);

  const [formData, setFormData] = useState({
    nombres: "",
    apellidos: "",
    ci: "",
    telefono: "",
    email: "",
    cargo: "Chofer / Conductor",
    licencia_conducir: "",
    categoria_licencia: "Categoría C",
    vencimiento_licencia: "",
    fecha_ingreso: "",
    salario_base: "" as string | number,
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
      const [empData, unidData] = await Promise.all([
        apiFetch(`/tenants/${schema}/empleados/`),
        apiFetch(`/tenants/${schema}/unidades/`).catch(() => [])
      ]);
      setEmpleados(empData);
      setUnidades(unidData);
    } catch (err: any) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Error al cargar personal",
        text: err.message,
        background: "#ffffff",
        color: "#0f172a"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingEmpleado(null);
    setFormData({
      nombres: "",
      apellidos: "",
      ci: "",
      telefono: "",
      email: "",
      cargo: "Chofer / Conductor",
      licencia_conducir: "",
      categoria_licencia: "Categoría C",
      vencimiento_licencia: "",
      fecha_ingreso: new Date().toISOString().split("T")[0],
      salario_base: "3500",
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
    setFormData({
      nombres: emp.nombres,
      apellidos: emp.apellidos,
      ci: emp.ci,
      telefono: emp.telefono || "",
      email: emp.email || "",
      cargo: emp.cargo || "Chofer / Conductor",
      licencia_conducir: emp.licencia_conducir || "",
      categoria_licencia: emp.categoria_licencia || "Categoría C",
      vencimiento_licencia: emp.vencimiento_licencia || "",
      fecha_ingreso: emp.fecha_ingreso || "",
      salario_base: emp.salario_base || 0,
      estado: emp.estado || "Activo",
      unidad_asignada_placa: emp.unidad_asignada_placa || "",
      direccion: emp.direccion || "",
      contacto_emergencia: emp.contacto_emergencia || "",
      notas: emp.notas || ""
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        nombres: formData.nombres.trim(),
        apellidos: formData.apellidos.trim(),
        ci: formData.ci.trim(),
        telefono: formData.telefono.trim() || null,
        email: formData.email.trim() || null,
        cargo: formData.cargo,
        licencia_conducir: formData.licencia_conducir.trim() || null,
        categoria_licencia: formData.categoria_licencia || null,
        vencimiento_licencia: formData.vencimiento_licencia || null,
        fecha_ingreso: formData.fecha_ingreso || null,
        salario_base: formData.salario_base !== "" ? Number(formData.salario_base) : 0,
        estado: formData.estado,
        unidad_asignada_placa: formData.unidad_asignada_placa.trim() || null,
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
          title: "Personal actualizado",
          timer: 1200,
          showConfirmButton: false,
          background: "#ffffff",
          color: "#0f172a"
        });
      } else {
        await apiFetch(`/tenants/${schema}/empleados/`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
        Swal.fire({
          icon: "success",
          title: "Empleado registrado",
          timer: 1200,
          showConfirmButton: false,
          background: "#ffffff",
          color: "#0f172a"
        });
      }

      setShowModal(false);
      loadData();
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al guardar personal",
        text: err.message,
        background: "#ffffff",
        color: "#0f172a"
      });
    }
  };

  const handleDelete = async (emp: Empleado) => {
    const res = await Swal.fire({
      title: `¿Eliminar a ${emp.nombres} ${emp.apellidos}?`,
      text: `Se eliminará el registro de este empleado (${emp.cargo}) del sistema.`,
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
        await apiFetch(`/tenants/${schema}/empleados/${emp.id}`, { method: "DELETE" });
        Swal.fire({
          icon: "success",
          title: "Empleado eliminado",
          timer: 1200,
          showConfirmButton: false,
          background: "#ffffff",
          color: "#0f172a"
        });
        loadData();
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
    <div className="space-y-6">
      
      {/* Encabezado y Acción Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Personal y Choferes
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestión de conductores de cisterna, mecánicos y personal administrativo
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Empleado / Chofer</span>
        </button>
      </div>

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Personal</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{totalPersonal}</div>
          <span className="text-[11px] text-slate-400">Registrados en la empresa</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Choferes / Conductores</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-indigo-700 mt-2">{choferesCount}</div>
          <span className="text-[11px] text-slate-400">Habilitados para cisternas</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">En Ruta</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2">{enRutaCount}</div>
          <span className="text-[11px] text-slate-400">Viajes en tránsito</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Disponibles / Activos</span>
            <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{activosCount}</div>
          <span className="text-[11px] text-slate-400">En base operativa</span>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, CI, licencia o placa asignada..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={cargoFiltro}
            onChange={(e) => setCargoFiltro(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
          >
            <option value="Todos">Todos los Cargos</option>
            <option value="Chofer / Conductor">Chofer / Conductor</option>
            <option value="Mecánico / Apoyo">Mecánico / Apoyo</option>
            <option value="Despachador">Despachador</option>
            <option value="Gerente / Supervisor">Gerente / Supervisor</option>
            <option value="Administración">Administración</option>
          </select>

          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
          >
            <option value="Todos">Todos los Estados</option>
            <option value="Activo">Activo</option>
            <option value="En Ruta">En Ruta</option>
            <option value="Descanso">Descanso</option>
            <option value="Inactivo">Inactivo</option>
          </select>
        </div>
      </div>

      {/* Tabla de Empleados */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
            <span className="text-xs">Cargando personal...</span>
          </div>
        ) : filteredEmpleados.length === 0 ? (
          <div className="text-center py-12 p-4 text-slate-500">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No se encontraron empleados</p>
            <p className="text-xs text-slate-400 mt-1">Registra tu primer chofer o empleado con el botón superior.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Empleado</th>
                  <th className="py-3 px-4">Cargo</th>
                  <th className="py-3 px-4">Licencia de Conducir</th>
                  <th className="py-3 px-4">Unidad Asignada</th>
                  <th className="py-3 px-4">Contacto</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmpleados.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                    
                    {/* Nombre y CI */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">
                        {emp.nombres} {emp.apellidos}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        CI: {emp.ci}
                      </div>
                    </td>

                    {/* Cargo */}
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                        {emp.cargo}
                      </span>
                    </td>

                    {/* Licencia */}
                    <td className="py-3.5 px-4">
                      {emp.licencia_conducir ? (
                        <div className="text-xs">
                          <div className="font-semibold text-slate-800 font-mono">
                            {emp.licencia_conducir}
                          </div>
                          <div className="text-[11px] text-slate-500">
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
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-mono text-xs font-semibold border border-blue-200">
                          <Truck className="w-3.5 h-3.5" />
                          <span>{emp.unidad_asignada_placa}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Sin asignar</span>
                      )}
                    </td>

                    {/* Contacto */}
                    <td className="py-3.5 px-4 text-xs text-slate-600">
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
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        emp.estado === "Activo"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : emp.estado === "En Ruta"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : emp.estado === "Descanso"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          emp.estado === "Activo" ? "bg-emerald-500" :
                          emp.estado === "En Ruta" ? "bg-blue-500" :
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
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(emp)}
                          title="Eliminar empleado"
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

      {/* Modal Crear / Editar Empleado */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingEmpleado ? "Editar Empleado / Chofer" : "Nuevo Empleado / Chofer"}
                </h3>
                <p className="text-xs text-slate-500">
                  {editingEmpleado ? "Modifica los datos del personal operativo o administrativo" : "Registra un nuevo miembro del equipo"}
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
              
              {/* Sección 1: Datos Personales */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  <span>1. Datos Personales</span>
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nombres *</label>
                    <input
                      type="text"
                      required
                      value={formData.nombres}
                      onChange={(e) => setFormData({ ...formData, nombres: e.target.value })}
                      placeholder="ej. Jaqueline"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Apellidos *</label>
                    <input
                      type="text"
                      required
                      value={formData.apellidos}
                      onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
                      placeholder="ej. Lovera Tiñini"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Cédula de Identidad (CI) *</label>
                    <input
                      type="text"
                      required
                      value={formData.ci}
                      onChange={(e) => setFormData({ ...formData, ci: e.target.value })}
                      placeholder="ej. 4892819 LP"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono / Celular</label>
                    <input
                      type="text"
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      placeholder="ej. 77299101"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Correo Electrónico</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="ej. jaqueline@transporte.bo"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Dirección de Domicilio</label>
                  <input
                    type="text"
                    value={formData.direccion}
                    onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                    placeholder="ej. Av. Litoral #850, El Alto, La Paz"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Sección 2: Cargo y Situación Laboral */}
              <div className="pt-3 border-t border-slate-200">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                  <span>2. Cargo y Situación Laboral</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Cargo *</label>
                    <select
                      value={formData.cargo}
                      onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    >
                      <option value="Chofer / Conductor">Chofer / Conductor</option>
                      <option value="Mecánico / Apoyo">Mecánico / Apoyo</option>
                      <option value="Despachador">Despachador</option>
                      <option value="Gerente / Supervisor">Gerente / Supervisor</option>
                      <option value="Administración">Administración</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Estado</label>
                    <select
                      value={formData.estado}
                      onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    >
                      <option value="Activo">Activo</option>
                      <option value="En Ruta">En Ruta</option>
                      <option value="Descanso">Descanso</option>
                      <option value="Inactivo">Inactivo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Salario Base (Bs)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.salario_base}
                      onChange={(e) => setFormData({ ...formData, salario_base: e.target.value })}
                      placeholder="ej. 3500.00"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 3: Datos de Chofer y Licencia */}
              <div className="pt-3 border-t border-slate-200">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                  <span>3. Habilitación de Conducción y Unidad Asignada</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nº Licencia de Conducir</label>
                    <input
                      type="text"
                      value={formData.licencia_conducir}
                      onChange={(e) => setFormData({ ...formData, licencia_conducir: e.target.value })}
                      placeholder="ej. 4892819-C"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Categoría</label>
                    <select
                      value={formData.categoria_licencia}
                      onChange={(e) => setFormData({ ...formData, categoria_licencia: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    >
                      <option value="Categoría C">Categoría C (Pesados)</option>
                      <option value="Categoría T">Categoría T (Tractocamión / Especial)</option>
                      <option value="Categoría B">Categoría B (Medianos)</option>
                      <option value="Profesional">Profesional Internacional</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Vencimiento Licencia</label>
                    <input
                      type="date"
                      value={formData.vencimiento_licencia}
                      onChange={(e) => setFormData({ ...formData, vencimiento_licencia: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Unidad / Placa Asignada</label>
                    <select
                      value={formData.unidad_asignada_placa}
                      onChange={(e) => setFormData({ ...formData, unidad_asignada_placa: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    >
                      <option value="">Sin Camión Asignado</option>
                      {unidades.map((u) => (
                        <option key={u.id} value={u.placa}>
                          {u.placa}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Contacto de Emergencia</label>
                    <input
                      type="text"
                      value={formData.contacto_emergencia}
                      onChange={(e) => setFormData({ ...formData, contacto_emergencia: e.target.value })}
                      placeholder="ej. Esposa: 71928300"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
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
                  {editingEmpleado ? "Guardar Cambios" : "Registrar Personal"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
