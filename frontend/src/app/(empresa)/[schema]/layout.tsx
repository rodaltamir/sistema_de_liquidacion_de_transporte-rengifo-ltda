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
  Navigation, 
  Users, 
  Menu, 
  X,
  ArrowLeft,
  ChevronDown,
  ExternalLink
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
      name: "Flota y Camiones",
      href: `/${schema}/flota`,
      icon: Truck,
      description: "Unidades y cisternas"
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
    <div className="min-h-screen bg-slate-50 text-slate-800 flex font-sans">
      
      {/* Sidebar para desktop */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between hidden md:flex sticky top-0 h-screen z-30 shadow-xs flex-shrink-0">
        <div>
          {/* Header del Sidebar con branding de la Empresa */}
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm flex-shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <h2 className="text-xs font-bold text-slate-900 truncate" title={empresa?.name || "Empresa"}>
                  {empresa?.name || "Cargando..."}
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <p className="text-[10px] font-mono text-slate-400 truncate">
                    {schema}
                  </p>
                </div>
              </div>
            </div>

            {/* Selector rápido para cambiar de empresa */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
              <Link
                href="/seleccionar-asociacion"
                className="inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-blue-600 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Directorio</span>
              </Link>
              {empresa?.asociacion_id && (
                <Link
                  href={`/asociacion/${empresa.asociacion_id}`}
                  className="font-semibold text-blue-600 hover:text-blue-800 transition flex items-center gap-0.5"
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
                      ? "bg-blue-50 text-blue-700 shadow-xs border border-blue-100 font-bold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                  <div className="truncate">
                    <span>{link.name}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer del Sidebar con usuario y logout */}
        <div className="p-3.5 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                {currentUser?.name?.charAt(0) || "U"}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {currentUser?.name}
                </p>
                <p className="text-[10px] text-slate-500 truncate">
                  {currentUser?.role === "admin" ? "Administrador" : "Operador"}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Cerrar Sesión"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Header móvil */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-40 shadow-xs">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="font-bold text-sm text-slate-900 truncate max-w-[200px]">
            {empresa?.name || "Empresa"}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 text-slate-500 hover:text-rose-600"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Sidebar móvil (Drawer) */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-64 bg-white h-full flex flex-col justify-between p-4 shadow-xl z-10">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <span className="font-bold text-sm text-slate-900">Menú de Navegación</span>
                <button onClick={() => setSidebarOpen(false)}>
                  <X className="w-5 h-5 text-slate-400" />
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
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold ${
                        isActive ? "bg-blue-50 text-blue-700 font-bold" : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{link.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="pt-3 border-t border-slate-100">
              <Link
                href="/seleccionar-asociacion"
                className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-blue-600"
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
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between gap-4 sticky top-0 z-20 shadow-2xs">
          <div className="flex items-center gap-2 text-xs text-slate-500 overflow-hidden">
            <Link href="/seleccionar-asociacion" className="hover:text-blue-600 transition flex items-center gap-1 flex-shrink-0">
              <Truck className="w-3.5 h-3.5 text-blue-600" />
              <span className="font-semibold">Inicio</span>
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            
            {empresa?.asociacion_name ? (
              <>
                <Link
                  href={`/asociacion/${empresa.asociacion_id}`}
                  className="hover:text-blue-600 transition truncate max-w-[150px] font-medium"
                >
                  {empresa.asociacion_name}
                </Link>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              </>
            ) : (
              <>
                <span className="text-slate-400">Independiente</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              </>
            )}

            <span className="font-bold text-slate-800 truncate max-w-[200px]">
              {empresa?.name || schema}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            
            <span className="text-blue-700 font-bold px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100">
              {currentSection.name}
            </span>
          </div>

          {/* Selector desplegable de empresas */}
          {todasEmpresas.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setEmpresaDropdownOpen(!empresaDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition"
              >
                <span>Cambiar Empresa ({todasEmpresas.length})</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {empresaDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setEmpresaDropdownOpen(false)} />
                  <div className="absolute right-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-40 py-1 max-h-60 overflow-y-auto">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      Empresas Disponibles
                    </div>
                    {todasEmpresas.map((e) => (
                      <button
                        key={e.id}
                        onClick={() => {
                          setEmpresaDropdownOpen(false);
                          router.push(`/${e.schema_name}/dashboard`);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-blue-50 transition ${
                          e.schema_name === schema ? "bg-blue-50/80 font-bold text-blue-700" : "text-slate-700"
                        }`}
                      >
                        <span className="truncate pr-2">{e.name}</span>
                        {e.schema_name === schema && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <main className="flex-1 p-5 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

    </div>
  );
}
