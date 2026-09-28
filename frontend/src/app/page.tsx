"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Fuel, 
  Scale, 
  FileSpreadsheet, 
  ShieldCheck, 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Truck
} from "lucide-react";
import Swal from "sweetalert2";
import { apiFetch } from "@/lib/api";
import { setAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();

  // Modo: "login" o "register"
  const [mode, setMode] = useState<"login" | "register">("login");

  // Campos Login
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Campos Registro
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Manejo de Iniciar Sesión
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ 
          username: username.trim(), 
          password 
        })
      });

      setAuth(data.access_token, data.user);

      Swal.fire({
        icon: "success",
        title: `¡Bienvenido, ${data.user.name}!`,
        text: `Acceso concedido como ${data.user.role === "admin" ? "Administrador" : "Usuario Operador"}`,
        timer: 1300,
        showConfirmButton: false,
        background: "#ffffff",
        color: "#0f172a",
        customClass: {
          popup: "rounded-2xl border border-slate-200 shadow-2xl"
        }
      });

      setTimeout(() => {
        router.push("/seleccionar-asociacion");
      }, 900);

    } catch (err: any) {
      setError(err.message || "Credenciales incorrectas. Verifique su usuario y contraseña.");
    } finally {
      setLoading(false);
    }
  };

  // Manejo de Registro
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (regPassword !== regConfirmPassword) {
      setError("Las contraseñas no coinciden. Por favor verifíquelas.");
      return;
    }

    if (regPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);

    try {
      const data = await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: regName.trim(),
          username: regUsername.trim() || regEmail.trim(),
          email: regEmail.trim(),
          password: regPassword,
          role: "user"
        })
      });

      setAuth(data.access_token, data.user);

      Swal.fire({
        icon: "success",
        title: "¡Cuenta creada exitosamente!",
        text: `Bienvenido, ${data.user.name}. Ingresando al panel...`,
        timer: 1400,
        showConfirmButton: false,
        background: "#ffffff",
        color: "#0f172a",
        customClass: {
          popup: "rounded-2xl border border-slate-200 shadow-2xl"
        }
      });

      setTimeout(() => {
        router.push("/seleccionar-asociacion");
      }, 1000);

    } catch (err: any) {
      setError(err.message || "Error al registrar la cuenta. Puede que el correo o usuario ya existan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden font-sans">
      
      {/* Efectos de fondo sutiles */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

      {/* Contenedor Centrado */}
      <div className="w-full max-w-5xl relative z-10 my-auto">
        
        {/* Tarjeta Split 50 / 50 perfectamente simétrica */}
        <div className="w-full bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl shadow-black/80 overflow-hidden grid grid-cols-1 lg:grid-cols-2">
          
          {/* Columna Izquierda: Identidad y Valor Corporativo */}
          <div className="p-8 sm:p-10 lg:p-11 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800/80 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950">
            
            {/* Cabecera Izquierda */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 p-2 flex items-center justify-center shadow-md shadow-amber-500/10 flex-shrink-0">
                  <img 
                    src="/rengifo_logo_icon.svg" 
                    alt="Rengifo Emblem" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-amber-500 block">
                    SISTEMA OFICIAL
                  </span>
                  <h2 className="text-white font-extrabold text-sm leading-tight tracking-tight">
                    Rengifo Ltda.
                  </h2>
                </div>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                Liquidación de Fletes &amp; Hidrocarburos
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-3 leading-relaxed">
                Plataforma multi-tenant de transporte nacional e internacional para empresas asociadas e independientes en Bolivia.
              </p>

              {/* 3 Bloques de Características Simétricos */}
              <div className="mt-8 space-y-3.5">
                <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-800/50 border border-slate-800 text-slate-300">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Fuel className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Control de Mermas
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      Tolerancia contractual YPFB al 0.35% y cálculo automático de mermas excedentes.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-800/50 border border-slate-800 text-slate-300">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Scale className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Liquidación por Cisterna
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      Conciliación viaje a viaje con fletes en Bs, deducciones y líquido pagable.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-800/50 border border-slate-800 text-slate-300">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Reportes Oficiales
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      Exportación en Excel y PDF con 4 firmas de auditoría y Ley 843 Art. 4.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Badges al pie de columna izquierda */}
            <div className="pt-6 border-t border-slate-800/80 mt-8 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span className="px-3 py-1 rounded-xl bg-slate-800/80 border border-slate-700/60 font-semibold text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                Auditoría Conforme
              </span>
              <span className="px-3 py-1 rounded-xl bg-slate-800/80 border border-slate-700/60 font-semibold text-slate-300">
                Contratos YPFB &copy; 2026
              </span>
            </div>
          </div>

          {/* Columna Derecha: Formulario de Acceso / Registro */}
          <div className="p-8 sm:p-10 lg:p-11 flex flex-col justify-between bg-slate-900/60">
            
            <div>
              {/* Logo Corporativo Horizontal con marco estilizado y proporción perfecta */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center px-5 py-2.5 rounded-2xl bg-white/95 border border-slate-200/80 shadow-md shadow-black/20 mb-3">
                  <img 
                    src="/logo_rengifo_estandar.png" 
                    alt="Rengifo Ltda." 
                    className="h-10 sm:h-11 w-auto max-w-[220px] object-contain"
                  />
                </div>
                
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {mode === "login" ? "Acceso al Sistema" : "Crear Nueva Cuenta"}
                </h2>
                <p className="text-slate-400 text-xs sm:text-sm mt-1">
                  {mode === "login" 
                    ? "Ingrese sus credenciales autorizadas para gestionar liquidaciones" 
                    : "Complete sus datos para habilitar su acceso de operador"}
                </p>
              </div>

              {/* Notificación de Error */}
              {error && (
                <div className="mb-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Selector de Pestaña Modo Login / Registro */}
              <div className="flex rounded-xl bg-slate-800/90 p-1 mb-5 border border-slate-700/60">
                <button
                  type="button"
                  onClick={() => { setMode("login"); setError(""); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    mode === "login"
                      ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Iniciar Sesión
                </button>
                <button
                  type="button"
                  onClick={() => { setMode("register"); setError(""); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    mode === "register"
                      ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Registrarse
                </button>
              </div>

              {/* FORMULARIO LOGIN */}
              {mode === "login" && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Usuario o Correo Electrónico
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="ej. audirengifo.ltda@gmail.com"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-xs sm:text-sm font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Contraseña
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-xs sm:text-sm font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-amber-400 transition"
                        title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/20 hover:shadow-xl hover:shadow-amber-500/30 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-slate-950/40 border-t-slate-950 rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Ingresar al Sistema</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* FORMULARIO REGISTRO */}
              {mode === "register" && (
                <form onSubmit={handleRegister} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                      Nombre Completo
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="ej. Juan Rengifo"
                        className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-xs font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                        Correo Electrónico
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Mail className="w-3.5 h-3.5" />
                        </div>
                        <input
                          type="email"
                          required
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          placeholder="usuario@ejemplo.com"
                          className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-xs font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                        Usuario
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <input
                          type="text"
                          required
                          value={regUsername}
                          onChange={(e) => setRegUsername(e.target.value)}
                          placeholder="ej. jrengifo"
                          className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-xs font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                      Contraseña
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showRegPassword ? "text" : "password"}
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full pl-10 pr-10 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-xs font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        tabIndex={-1}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-amber-400 transition"
                      >
                        {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                      Confirmar Contraseña
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showRegPassword ? "text" : "password"}
                        required
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        placeholder="Repita su contraseña"
                        className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-xs font-medium"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-slate-950/40 border-t-slate-950 rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Registrar Cuenta y Entrar</span>
                        <CheckCircle2 className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Alternar modo al pie del formulario */}
            <div className="pt-4 mt-4 border-t border-slate-800/60 text-center">
              {mode === "login" ? (
                <p className="text-xs text-slate-400">
                  ¿No tienes una cuenta aún?{" "}
                  <button
                    type="button"
                    onClick={() => { setMode("register"); setError(""); }}
                    className="text-amber-400 font-bold hover:underline ml-1"
                  >
                    Regístrate aquí
                  </button>
                </p>
              ) : (
                <p className="text-xs text-slate-400">
                  ¿Ya tienes cuenta registrada?{" "}
                  <button
                    type="button"
                    onClick={() => { setMode("login"); setError(""); }}
                    className="text-amber-400 font-bold hover:underline ml-1"
                  >
                    Inicia sesión aquí
                  </button>
                </p>
              )}
            </div>

          </div>

        </div>

        {/* Pie de página perfectamente centrado debajo de la tarjeta */}
        <div className="mt-5 text-center text-xs text-slate-500">
          Transporte Rengifo Ltda. &bull; Hidrocarburos &amp; Carga General &bull; Bolivia &copy; 2026
        </div>

      </div>

    </div>
  );
}
