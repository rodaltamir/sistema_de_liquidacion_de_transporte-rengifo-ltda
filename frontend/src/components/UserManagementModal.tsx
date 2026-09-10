"use client";

import { useState, useEffect } from "react";
import { Users, Plus, Edit, Trash2, X, ShieldCheck, UserCheck, Check, AlertCircle } from "lucide-react";
import Swal from "sweetalert2";
import { apiFetch } from "@/lib/api";

interface UserItem {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function UserManagementModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    role: "user",
    is_active: true
  });

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/auth/users");
      setUsers(data);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.message,
        background: "#ffffff",
        color: "#0f172a"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormData({
      name: "",
      username: "",
      email: "",
      password: "",
      role: "user",
      is_active: true
    });
    setShowFormModal(true);
  };

  const handleOpenEdit = (user: UserItem) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      username: user.username,
      email: user.email,
      password: "",
      role: user.role,
      is_active: user.is_active
    });
    setShowFormModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        // Actualizar
        const payload: any = {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          is_active: formData.is_active
        };
        if (formData.password.trim()) {
          payload.password = formData.password.trim();
        }
        await apiFetch(`/auth/users/${editingUser.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        Swal.fire({
          icon: "success",
          title: "Usuario actualizado",
          timer: 1300,
          showConfirmButton: false,
          background: "#ffffff",
          color: "#0f172a"
        });
      } else {
        // Crear
        if (!formData.password) {
          Swal.fire({ icon: "warning", title: "Atención", text: "La contraseña es obligatoria al crear un usuario.", background: "#fff", color: "#000" });
          return;
        }
        await apiFetch("/auth/users", {
          method: "POST",
          body: JSON.stringify({
            name: formData.name,
            username: formData.username,
            email: formData.email,
            password: formData.password,
            role: formData.role
          })
        });
        Swal.fire({
          icon: "success",
          title: "Usuario creado",
          timer: 1300,
          showConfirmButton: false,
          background: "#ffffff",
          color: "#0f172a"
        });
      }

      setShowFormModal(false);
      loadUsers();
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al guardar usuario",
        text: err.message,
        background: "#ffffff",
        color: "#0f172a"
      });
    }
  };

  const handleDelete = async (user: UserItem) => {
    const res = await Swal.fire({
      title: "¿Eliminar este usuario?",
      text: `Se eliminará permanentemente la cuenta de "${user.name}" (${user.username}).`,
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
        await apiFetch(`/auth/users/${user.id}`, { method: "DELETE" });
        Swal.fire({
          icon: "success",
          title: "Usuario eliminado",
          timer: 1200,
          showConfirmButton: false,
          background: "#ffffff",
          color: "#0f172a"
        });
        loadUsers();
      } catch (err: any) {
        Swal.fire({
          icon: "error",
          title: "No se pudo eliminar",
          text: err.message,
          background: "#ffffff",
          color: "#0f172a"
        });
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Cabecera */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Gestión de Usuarios del Sistema</h2>
              <p className="text-xs text-slate-500">Administra accesos, roles (Admin / Operador) y credenciales</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Usuario</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabla de Usuarios */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No hay usuarios registrados</div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Nombre / Usuario</th>
                    <th className="py-3 px-4">Correo</th>
                    <th className="py-3 px-4 text-center">Rol</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{u.name}</div>
                        <div className="text-xs text-slate-500 font-mono">@{u.username}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-xs">{u.email}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          u.role === "admin"
                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}>
                          {u.role === "admin" ? <ShieldCheck className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                          {u.role === "admin" ? "Admin" : "Operador"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.is_active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500"
                        }`}>
                          {u.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(u)}
                            title="Editar usuario"
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(u)}
                            title="Eliminar usuario"
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

        {/* Modal Secundario para Crear/Editar Usuario */}
        {showFormModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 animate-in fade-in zoom-in-95">
              <h3 className="text-base font-bold text-slate-900 mb-1">
                {editingUser ? "Editar Usuario" : "Crear Nuevo Usuario"}
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                {editingUser ? "Modifica los datos del usuario seleccionado" : "Registra una cuenta de acceso al sistema"}
              </p>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre Completo</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="ej. Juan Pérez Choque"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre de Usuario (Login)</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingUser}
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="ej. jperez"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="ej. jperez@transporte.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {editingUser ? "Nueva Contraseña (dejar en blanco para no cambiar)" : "Contraseña"}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Rol</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    >
                      <option value="user">Operador (Usuario)</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>

                  {editingUser && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Estado</label>
                      <select
                        value={formData.is_active ? "1" : "0"}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.value === "1" })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                      >
                        <option value="1">Activo</option>
                        <option value="0">Inactivo</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-slate-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFormModal(false)}
                    className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                  >
                    {editingUser ? "Guardar Cambios" : "Crear Usuario"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
