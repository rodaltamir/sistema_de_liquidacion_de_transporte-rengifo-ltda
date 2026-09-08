"use client";

import { useState, useEffect, use } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { 
  Truck, 
  LayoutDashboard, 
  FileSpreadsheet, 
  Settings, 
  LogOut, 
  Building2, 
  ChevronRight, 
  ShieldCheck, 
  UserCheck, 
  Fuel, 
  Navigation, 
  Layers, 
  Menu, 
  X,
  FileText
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getCurrentUser, clearAuth, User } from "@/lib/auth";

export default function EmpresaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ schema: string }>;
}) {
  const resolvedParams = use(params);
  const schema = resolvedParams.schema;
  const router = useRouter();
  const pathname = usePathname();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [empresa, setEmpresa] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.push("/");
      return;
    }
    setCurrentUser(user);

    apiFetch(`/empresas/${schema}`)
      .then((data) => setEmpresa(data))
      .catch((err) => console.error(err));
  }, [schema, router]);

  const handleLogout = () => {
    clearAuth();
    router.push("/");
  };

  const navLinks = [
    {
      name: "Dashboard",
      href: `/${schema}/dashboard`,
      icon: LayoutDashboard,
    },
    {
      name: "Flota de Camiones",
      href: `/${schema}/flota`,
      icon: Truck,
    },
    {
      name: "Registro de Viajes",
      href: `/${schema}/viajes`,
      icon: Navigation,
    },
    {
      name: "Liquidaciones (Planillas)",
      href: `/${schema}/liquidaciones`,
      icon: FileSpreadsheet,
    },
    {
      name: "Panel de Control / Parámetros",
      href: `/${schema}/configuracion`,
      icon: Settings,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar para desktop */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between hidden md:flex sticky top-0 h-screen z-30">
        <div>
          {/* Header del Sidebar con branding de la Empresa */}
          <div className="p-5 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20 flex-shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <h2 className="text-sm font-black text-white truncate" title={empresa?.name || "Empresa"}>
                  {empresa?.name || "Cargando..."}
                </h2>
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <span>NIT: {empresa?.nit || "S/N"}</span>
                </div>
              </div>
            </div>

            {/* Switcher de Empresa / Volver a Asociaciones */}
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <Link
                href="/seleccionar-empresa"
                className="text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 text-[11px] transition"
              >
                <Layers className="w-3 h-3" />
                <span>Cambiar Empresa</span>
              </Link>
              <Link
                href="/seleccionar-asociacion"
                className="text-slate-400 hover:text-slate-300 flex items-center gap-0.5 text-[11px] transition"
              >
                <span>Asoc.</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Menú de Navegación */}
          <nav className="p-3 space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                    isActive
                      ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span>{link.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer del Sidebar con usuario y logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          {currentUser && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-cyan-400 flex-shrink-0">
                  {currentUser.role === "admin" ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <UserCheck className="w-4 h-4 text-cyan-400" />
                  )}
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold text-white truncate">{currentUser.name}</div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">
                    {currentUser.role === "admin" ? "Administrador" : "Operador"}
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition"
                title="Cerrar Sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Contenedor Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar móvil */}
        <header className="md:hidden bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg bg-slate-800 text-slate-300"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="font-bold text-sm text-white truncate max-w-[180px]">
              {empresa?.name || "Transporte"}
            </div>
          </div>

          <Link
            href="/seleccionar-empresa"
            className="text-xs font-bold text-cyan-400 bg-cyan-950/80 px-2.5 py-1 rounded-lg border border-cyan-800"
          >
            Cambiar
          </Link>
        </header>

        {/* Menú desplegable móvil */}
        {sidebarOpen && (
          <div className="md:hidden bg-slate-900 border-b border-slate-800 p-4 space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                    isActive
                      ? "bg-cyan-600 text-white"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.name}</span>
                </Link>
              );
            })}
            <button
              onClick={handleLogout}
              className="w-full mt-2 flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        )}

        {/* Contenido de la Página */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
