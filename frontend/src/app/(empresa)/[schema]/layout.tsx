"use client";

import { useState, useEffect, use } from "react";
import { useRouter, usePathname, useParams } from "next/navigation";
import Link from "next/link";
import { 
  Truck, 
  LayoutDashboard, 
  FileSpreadsheet, 
  Settings, 
  LogOut, 
  Building2, 
  ChevronRight, 
  Navigation, 
  Users, 
  Menu, 
  X,
  ArrowLeft,
  ChevronDown,
  ExternalLink,
  Handshake
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getCurrentUser, clearAuth, User } from "@/lib/auth";

export default function EmpresaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const routeParams = useParams();
  const schema = (routeParams?.schema as string) || "";
  const router = useRouter();
  const pathname = usePathname();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [empresa, setEmpresa] = useState<any>(null);
  const [todasEmpresas, setTodasEmpresas] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [empresaDropdownOpen, setEmpresaDropdownOpen] = useState(false);

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

    apiFetch("/empresas/")
      .then((data) => setTodasEmpresas(data))
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
      description: "Resumen y métricas"
    },
    {
      name: "Flota Propia",
      href: `/${schema}/flota`,
      icon: Truck,
      description: "Cisternas titulares"
    },
    {
      name: "Flota de Apoyo",
      href: `/${schema}/apoyo`,
      icon: Handshake,
      description: "Empresas aliadas y auxilio"
    },
    {
      name: "Personal y Choferes",
      href: `/${schema}/personal`,
      icon: Users,
      description: "Conductores y staff"
    },
    {
      name: "Registro de Viajes",
      href: `/${schema}/viajes`,
      icon: Navigation,
      description: "Carga, fletes y mermas"
    },
    {
      name: "Liquidaciones",
      href: `/${schema}/liquidaciones`,
      icon: FileSpreadsheet,
      description: "Planillas oficiales y exportación"
    },
    {
      name: "Configuración y Tarifas",
      href: `/${schema}/configuracion`,
      icon: Settings,
      description: "Factores y parámetros técnicos"
    },
  ];

  const currentSection = navLinks.find(l => pathname === l.href) || { name: "Operaciones", description: "" };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* Sidebar para desktop */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between hidden md:flex sticky top-0 h-screen z-30 shadow-xl shadow-black/40 flex-shrink-0">
        <div>
          {/* Header del Sidebar con branding de la Empresa */}
          <div className="p-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 p-1.5 flex items-center justify-center shadow-xs flex-shrink-0">
                <img src="/rengifo_logo_icon.svg" alt="Rengifo" className="w-full h-full object-contain" />
              </div>
              <div className="overflow-hidden">
                <h2 className="text-xs font-bold text-white truncate" title={empresa?.name || "Empresa"}>
                  {empresa?.name || "Cargando..."}
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <p className="text-[10px] font-mono text-slate-400 truncate">
                    {schema}
                  </p>
                </div>
              </div>
            </div>

            {/* Selector rápido para cambiar de empresa */}
            <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs">
              <Link
                href="/seleccionar-asociacion"
                className="inline-flex items-center gap-1 font-semibold text-slate-400 hover:text-amber-400 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Directorio</span>
              </Link>
              {empresa?.asociacion_id && (
                <Link
                  href={`/asociacion/${empresa.asociacion_id}`}
                  className="font-semibold text-amber-400 hover:text-amber-300 transition flex items-center gap-0.5"
                  title="Ver panel de la Asociación"
                >
                  <Building2 className="w-3 h-3" />
                  <span>Asociación</span>
                </Link>
              )}
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
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-amber-500/15 text-amber-400 shadow-xs border border-amber-500/30 font-bold"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/70"
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-amber-400" : "text-slate-500"}`} />
                  <div className="truncate">
                    <span>{link.name}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer del Sidebar con usuario y logout */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center flex-shrink-0">
                {currentUser?.name?.charAt(0) || "U"}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white truncate">
                  {currentUser?.name}
                </p>
                <p className="text-[10px] text-amber-400/90 truncate">
                  {currentUser?.role === "admin" ? "Administrador" : "Operador"}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Cerrar Sesión"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Header móvil */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-40 shadow-md">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 p-1 flex items-center justify-center flex-shrink-0">
            <img src="/rengifo_logo_icon.svg" alt="Rengifo" className="w-full h-full object-contain" />
          </div>
          <div className="font-bold text-sm text-white truncate max-w-[180px]">
            {empresa?.name || "Empresa"}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Sidebar móvil (Drawer) */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-64 bg-slate-900 border-r border-slate-800 h-full flex flex-col justify-between p-4 shadow-2xl z-10 text-slate-100">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <span className="font-bold text-sm text-white">Menú de Navegación</span>
                <button onClick={() => setSidebarOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="space-y-1">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.name}
                      href={link.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                        isActive ? "bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? "text-amber-400" : "text-slate-500"}`} />
                      <span>{link.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="pt-3 border-t border-slate-800">
              <Link
                href="/seleccionar-asociacion"
                className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-amber-400 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver al Directorio</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Área de Contenido con Barra Superior de Migas de Pan y Selector de Empresa */}
      <div className="flex-1 flex flex-col min-w-0 md:pt-0 pt-16">
        
        {/* Barra Superior con Migas de Pan */}
        <div className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-3 flex items-center justify-between gap-4 sticky top-0 z-20 shadow-md shadow-black/30">
          <div className="flex items-center gap-2 text-xs text-slate-400 overflow-hidden">
            <Link href="/seleccionar-asociacion" className="hover:text-amber-400 transition flex items-center gap-1.5 flex-shrink-0">
              <div className="w-5 h-5 rounded-md bg-amber-500/10 border border-amber-500/30 p-0.5 flex items-center justify-center">
                <img src="/rengifo_logo_icon.svg" alt="R" className="w-full h-full object-contain" />
              </div>
              <span className="font-semibold text-slate-300 hover:text-white">Directorio</span>
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
            
            {empresa?.asociacion_name ? (
              <>
                <Link
                  href={`/asociacion/${empresa.asociacion_id}`}
                  className="hover:text-amber-400 transition truncate max-w-[150px] font-medium text-slate-300"
                >
                  {empresa.asociacion_name}
                </Link>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
              </>
            ) : (
              <>
                <span className="text-slate-500">Independiente</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
              </>
            )}

            <span className="font-bold text-white truncate max-w-[200px]">
              {empresa?.name || schema}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
            
            <span className="text-amber-400 font-bold px-2.5 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/25">
              {currentSection.name}
            </span>
          </div>

          {/* Controles del lado derecho: Estado y Selector de Empresa */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-medium text-slate-400">Sistema:</span>
              <span className="font-bold text-emerald-400">En Línea</span>
            </div>

            {todasEmpresas.length > 1 ? (
              <div className="relative">
                <button
                  onClick={() => setEmpresaDropdownOpen(!empresaDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-semibold text-slate-200 transition"
                >
                  <Building2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Cambiar Empresa ({todasEmpresas.length})</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {empresaDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setEmpresaDropdownOpen(false)} />
                    <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-40 py-1.5 max-h-60 overflow-y-auto">
                      <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800">
                        Empresas Disponibles
                      </div>
                      {todasEmpresas.map((e) => (
                        <button
                          key={e.id}
                          onClick={() => {
                            setEmpresaDropdownOpen(false);
                            router.push(`/${e.schema_name}/dashboard`);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-800 transition ${
                            e.schema_name === schema ? "bg-amber-500/15 font-bold text-amber-400" : "text-slate-300"
                          }`}
                        >
                          <span className="truncate pr-2">{e.name}</span>
                          {e.schema_name === schema && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link
                href="/seleccionar-empresa"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition"
                title="Ir al Directorio de Empresas"
              >
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Empresas</span>
              </Link>
            )}
          </div>
        </div>

        <main className="flex-1 p-5 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>

    </div>
  );
}
