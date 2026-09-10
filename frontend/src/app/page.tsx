"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Truck, ShieldCheck, UserCheck, Lock, ArrowRight, Fuel, AlertCircle, Building2 } from "lucide-react";
import Swal from "sweetalert2";
import { apiFetch } from "@/lib/api";
import { setAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });

      setAuth(data.access_token, data.user);

      Swal.fire({
        icon: "success",
        title: `¡Bienvenido, ${data.user.name}!`,
        text: `Accediendo como rol: ${data.user.role === "admin" ? "Administrador" : "Usuario Operador"}`,
        timer: 1400,
        showConfirmButton: false,
        background: "#ffffff",
        color: "#0f172a",
        customClass: {
          popup: "rounded-2xl border border-slate-200 shadow-xl"
        }
      });

      setTimeout(() => {
        router.push("/seleccionar-asociacion");
      }, 1100);

    } catch (err: any) {
      setError(err.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const setQuickCredentials = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen bg-slate-100/90 flex flex-col justify-center items-center px-4 py-12 relative">
      {/* Tarjeta Central */}
      <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-2xl shadow-xl p-8 z-10">
        
        {/* Encabezado con Icono */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-600/20 mb-3.5">
            <Truck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Liquidación de Transporte
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Sistema Multi-tenant de Fletes, Mermas y Pagos
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-2.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold">
            <Fuel className="w-3.5 h-3.5" />
            <span>Hidrocarburos & Carga General</span>
          </div>
        </div>

        {/* Mensaje de Error */}
        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3 text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Usuario
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ej. admin o usuario"
                className="w-full pl-3.5 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-sm font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-3.5 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-sm font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/30 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Ingresar al Sistema</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Accesos Rápidos de Prueba */}
        <div className="mt-8 pt-6 border-t border-slate-200">
          <p className="text-xs text-center text-slate-500 mb-3 font-semibold uppercase tracking-wider">
            Cuentas de Acceso Rápido:
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setQuickCredentials("admin", "admin123")}
              className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50/80 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 text-xs font-semibold transition-all group"
            >
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Admin</span>
            </button>

            <button
              type="button"
              onClick={() => setQuickCredentials("usuario", "user123")}
              className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50/80 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-700 text-xs font-semibold transition-all group"
            >
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span>Operador</span>
            </button>
          </div>
        </div>

      </div>

      {/* Pie de página */}
      <div className="mt-8 text-center text-xs text-slate-500">
        Conforme a la Ley 843 Art. 4 & Contratos YPFB Transporte &copy; 2026
      </div>
    </div>
  );
}
