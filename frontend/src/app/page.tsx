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
        timer: 1500,
        showConfirmButton: false,
        background: "#0f172a",
        color: "#fff",
      });

      setTimeout(() => {
        router.push("/seleccionar-asociacion");
      }, 1200);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden">
      {/* Luces de fondo decorativas */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Tarjeta Central */}
      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl p-8 z-10">
        
        {/* Encabezado con Icono */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25 mb-4">
            <Truck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Liquidación de Transporte
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Sistema Multi-tenant de Fletes, Mermas y Pagos
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-2.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-semibold">
            <Fuel className="w-3.5 h-3.5" />
            <span>Hidrocarburos & Carga General</span>
          </div>
        </div>

        {/* Mensaje de Error */}
        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-300 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Usuario
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ej. admin o usuario"
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Iniciar Sesión</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        {/* Acceso Rápido para Pruebas */}
        <div className="mt-8 pt-6 border-t border-slate-800">
          <p className="text-xs font-medium text-slate-400 text-center mb-3">
            Accesos Rápidos de Demostración:
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setQuickCredentials("admin", "admin123")}
              className="px-3 py-2 bg-slate-800/70 hover:bg-slate-700/80 border border-slate-700 rounded-lg text-left transition flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-200">Admin</div>
                <div className="text-[10px] text-slate-400">admin / admin123</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setQuickCredentials("usuario", "user123")}
              className="px-3 py-2 bg-slate-800/70 hover:bg-slate-700/80 border border-slate-700 rounded-lg text-left transition flex items-center gap-2"
            >
              <UserCheck className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-200">Operador</div>
                <div className="text-[10px] text-slate-400">usuario / user123</div>
              </div>
            </button>
          </div>
        </div>

      </div>

      {/* Pie institucional */}
      <div className="mt-8 text-center text-xs text-slate-500">
        Rengifo Ltda • Módulo de Liquidaciones de Transporte Hidrocarburos Ley 843
      </div>
    </div>
  );
}
