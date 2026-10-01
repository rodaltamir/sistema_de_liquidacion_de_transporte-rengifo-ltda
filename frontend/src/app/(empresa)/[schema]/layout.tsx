"use client";

import { useState, useEffect } from "react";
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
  Handshake,
  Sun,
  Moon,
  Sparkles,
  Shield,
  Layers,
  Search,
  Check
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getCurrentUser, clearAuth, User } from "@/lib/auth";
import { useTheme } from "@/context/ThemeContext";

export default function EmpresaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const routeParams = useParams();
  const schema = (routeParams?.schema as string) || "";
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme, toggleTheme } = useTheme();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [empresa, setEmpresa] = useState<any>(null);
  const [todasEmpresas, setTodasEmpresas] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [empresaDropdownOpen, setEmpresaDropdownOpen] = useState(false);
  const [empresaSearch, setEmpresaSearch] = useState("");

  const fetchEmpresa = () => {
    if (!schema) return;
    apiFetch(`/empresas/${schema}`)
      .then((data) => setEmpresa(data))
      .catch((err) => console.error("Error al cargar empresa:", err));
  };

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.push("/");
      return;
    }
    setCurrentUser(user);
    fetchEmpresa();

    apiFetch("/empresas/")
      .then((data) => setTodasEmpresas(data))
      .catch((err) => console.error(err));

    // Escuchar eventos de actualización de empresa desde ConfiguracionPage
    const handleEmpresaUpdate = () => {
      fetchEmpresa();
      apiFetch("/empresas/")
        .then((data) => setTodasEmpresas(data))
        .catch((err) => console.error(err));
    };

    window.addEventListener("empresa-perfil-actualizado", handleEmpresaUpdate);
    return () => {
      window.removeEventListener("empresa-perfil-actualizado", handleEmpresaUpdate);
    };
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
      description: "Resumen y métricas ejecutivas"
    },
    {
      name: "Flota Propia",
      href: `/${schema}/flota`,
      icon: Truck,
      description: "Cisternas titulares y tanques"
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
      description: "Conductores y staff logístico"
    },
    {
      name: "Registro de Viajes",
      href: `/${schema}/viajes`,
      icon: Navigation,
      description: "Carga, fletes y mermas contractuales"
    },
    {
      name: "Liquidaciones",
      href: `/${schema}/liquidaciones`,
      icon: FileSpreadsheet,
      description: "Planillas oficiales y exportación"
    },
    {
      name: "Configuración y Datos",
      href: `/${schema}/configuracion`,
      icon: Settings,
      description: "Perfil de empresa, tema y tarifas"
    },
  ];

  const currentSection = navLinks.find(l => pathname === l.href) || { 
    name: "Operaciones", 
    description: "Panel de control general" 
  };

  // Filtrar empresas para el buscador rápido del dropdown
  const filteredEmpresas = todasEmpresas.filter(e => 
    e.name?.toLowerCase().includes(empresaSearch.toLowerCase()) ||
    e.schema_name?.toLowerCase().includes(empresaSearch.toLowerCase()) ||
    e.nit?.includes(empresaSearch)
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex font-sans selection:bg-amber-500 selection:text-slate-950 transition-colors duration-200">
      
      {/* ======================================================== */}
      {/* SIDEBAR PARA DESKTOP                                     */}
      {/* ======================================================== */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between hidden md:flex sticky top-0 h-screen z-30 shadow-lg dark:shadow-xl dark:shadow-black/40 flex-shrink-0 transition-colors duration-200">
        <div className="flex-1 overflow-y-auto">
          
          {/* Header del Sidebar con branding de la Empresa */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 p-1 flex items-center justify-center shadow-xs flex-shrink-0 overflow-hidden">
                {empresa?.logo_base64 ? (
                  <img
                    src={empresa.logo_base64}
                    alt={empresa.name}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/rengifo_logo_icon.svg";
                    }}
                  />
                ) : (
                  <img src="/rengifo_logo_icon.svg" alt="Rengifo" className="w-full h-full object-contain" />
                )}
              </div>
              <div className="overflow-hidden">
                <h2 className="text-xs font-black text-slate-900 dark:text-white truncate" title={empresa?.name || "Empresa"}>
                  {empresa?.name || "Cargando..."}
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                    {empresa?.nit ? `NIT: ${empresa.nit}` : schema}
                  </p>
                </div>
              </div>
            </div>

            {/* Accesos rápidos de navegación entre Asociación y Directorio */}
            <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <Link
                href="/seleccionar-asociacion"
                className="inline-flex items-center gap-1 font-semibold text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition"
                title="Volver al Directorio de Asociaciones y Empresas"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Directorio</span>
              </Link>
              {empresa?.asociacion_id ? (
                <Link
                  href={`/asociacion/${empresa.asociacion_id}`}
                  className="font-bold text-amber-600 dark:text-amber-400 hover:text-amber-500 transition flex items-center gap-1"
                  title="Ver panel de la Asociación Matriz"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Asociación</span>
                </Link>
              ) : (
                <span className="text-[10px] text-slate-400 dark:text-slate-600 uppercase font-semibold">
                  Independiente
                </span>
              )}
            </div>
          </div>

          {/* Menú de Navegación */}
          <nav className="p-3 space-y-1">
            <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Módulos Operativos
            </div>

            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;

              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                    isActive
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-xs border border-amber-500/30 font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70"
                  }`}
                >
                  <div className={`p-1 rounded-lg transition-colors ${
                    isActive 
                      ? "bg-amber-500/20 text-amber-500" 
                      : "text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200"
                  }`}>
                    <Icon className="w-4 h-4 flex-shrink-0" />
                  </div>
                  <div className="truncate flex-1">
                    <span className="block leading-tight">{link.name}</span>
                  </div>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer del Sidebar con Usuario, Switcher de Tema y Logout */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center justify-center flex-shrink-0">
                {currentUser?.name?.charAt(0) || "U"}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {currentUser?.name || "Usuario"}
                </p>
                <p className="text-[10px] text-amber-600 dark:text-amber-400/90 font-medium truncate">
                  {currentUser?.role === "admin" ? "Administrador" : "Operador"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Botón rápido para alternar Modo Claro / Oscuro */}
              <button
                type="button"
                onClick={toggleTheme}
                title={`Cambiar a modo ${resolvedTheme === "dark" ? "claro" : "oscuro"}`}
                className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition"
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-700" />
                )}
              </button>

              {/* Botón Logout */}
              <button
                onClick={handleLogout}
                title="Cerrar Sesión"
                className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ======================================================== */}
      {/* HEADER MÓVIL (TOP BAR EN SMARTPHONES)                    */}
      {/* ======================================================== */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 z-40 shadow-sm dark:shadow-md transition-colors duration-200">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 p-1 flex items-center justify-center flex-shrink-0">
            {empresa?.logo_base64 ? (
              <img
                src={empresa.logo_base64}
                alt="Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/rengifo_logo_icon.svg";
                }}
              />
            ) : (
              <img src="/rengifo_logo_icon.svg" alt="Rengifo" className="w-full h-full object-contain" />
            )}
          </div>
          <div className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-[150px]">
            {empresa?.name || "Empresa"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Switcher de tema móvil */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-amber-500 rounded-xl transition"
            title="Alternar tema claro/oscuro"
          >
            {resolvedTheme === "dark" ? <Sun className="w-4.5 h-4.5 text-amber-400" /> : <Moon className="w-4.5 h-4.5 text-slate-700" />}
          </button>

          <button
            onClick={handleLogout}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-rose-500 rounded-xl transition"
            title="Cerrar sesión"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Drawer móvil */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-full flex flex-col justify-between p-4 shadow-2xl z-10 text-slate-900 dark:text-slate-100">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-3">
                <span className="font-bold text-sm text-slate-900 dark:text-white">Menú de Navegación</span>
                <button onClick={() => setSidebarOpen(false)} className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
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
                        isActive 
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/30" 
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? "text-amber-500" : "text-slate-400"}`} />
                      <span>{link.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
            
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between px-2 py-1 text-xs text-slate-500 dark:text-slate-400">
                <span>Tema Visual:</span>
                <button
                  onClick={toggleTheme}
                  className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1"
                >
                  {resolvedTheme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  <span>{resolvedTheme === "dark" ? "Modo Oscuro" : "Modo Claro"}</span>
                </button>
              </div>

              <Link
                href="/seleccionar-asociacion"
                className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-amber-500 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver al Directorio</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ÁREA DE CONTENIDO Y TOPBAR EJECUTIVA                     */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col min-w-0 md:pt-0 pt-16">
        
        {/* Barra Superior con Migas de Pan, Estado, Selector de Empresa y Tema */}
        <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-5 sm:px-6 py-2.5 flex items-center justify-between gap-4 sticky top-0 z-20 shadow-xs dark:shadow-md dark:shadow-black/30 transition-colors duration-200">
          
          {/* Breadcrumbs Intuitivos */}
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 overflow-hidden">
            <Link 
              href="/seleccionar-asociacion" 
              className="hover:text-amber-600 dark:hover:text-amber-400 transition flex items-center gap-1.5 flex-shrink-0"
              title="Volver a la selección de Asociación o Empresa"
            >
              <div className="w-5 h-5 rounded-md bg-amber-500/10 border border-amber-500/30 p-0.5 flex items-center justify-center">
                <img src="/rengifo_logo_icon.svg" alt="R" className="w-full h-full object-contain" />
              </div>
              <span className="font-semibold text-slate-700 dark:text-slate-300 hover:text-amber-500">Directorio</span>
            </Link>
            
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 flex-shrink-0" />
            
            {empresa?.asociacion_name ? (
              <>
                <Link
                  href={`/asociacion/${empresa.asociacion_id}`}
                  className="hover:text-amber-600 dark:hover:text-amber-400 transition truncate max-w-[150px] font-medium text-slate-600 dark:text-slate-300"
                >
                  {empresa.asociacion_name}
                </Link>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 flex-shrink-0" />
              </>
            ) : (
              <>
                <span className="text-slate-400 dark:text-slate-500 hidden sm:inline">Independiente</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 flex-shrink-0 hidden sm:inline" />
              </>
            )}

            <span className="font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
              {empresa?.name || schema}
            </span>
            
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 flex-shrink-0" />
            
            <span className="text-amber-600 dark:text-amber-400 font-bold px-2.5 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/25">
              {currentSection.name}
            </span>
          </div>

          {/* Controles del Lado Derecho */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            
            {/* Indicador de Estado del Sistema */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium text-slate-500 dark:text-slate-400">Sistema:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">Operativo</span>
            </div>

            {/* Botón de Modo Claro / Modo Oscuro */}
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition"
              title={`Cambiar a modo ${resolvedTheme === "dark" ? "claro" : "oscuro"}`}
            >
              {resolvedTheme === "dark" ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Modo Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-700" />
                  <span className="hidden sm:inline">Modo Oscuro</span>
                </>
              )}
            </button>

            {/* Selector Desplegable de Empresa */}
            {todasEmpresas.length > 1 ? (
              <div className="relative">
                <button
                  onClick={() => setEmpresaDropdownOpen(!empresaDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 transition"
                >
                  <Building2 className="w-3.5 h-3.5 text-amber-500" />
                  <span className="hidden sm:inline">Cambiar Empresa</span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold px-1.5 py-0.2 rounded-full">
                    {todasEmpresas.length}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {empresaDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setEmpresaDropdownOpen(false)} />
                    <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-40 py-2 max-h-80 overflow-y-auto">
                      
                      {/* Cabecera y Buscador del Selector */}
                      <div className="px-3 pb-2 border-b border-slate-200 dark:border-slate-800">
                        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                          Empresas Registradas
                        </div>
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={empresaSearch}
                            onChange={(e) => setEmpresaSearch(e.target.value)}
                            placeholder="Buscar empresa..."
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-2 py-1 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      {/* Lista de Empresas */}
                      <div className="pt-1">
                        {filteredEmpresas.map((e) => {
                          const isCurrent = e.schema_name === schema;
                          return (
                            <button
                              key={e.id}
                              onClick={() => {
                                setEmpresaDropdownOpen(false);
                                router.push(`/${e.schema_name}/dashboard`);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 transition ${
                                isCurrent
                                  ? "bg-amber-500/15 font-bold text-amber-600 dark:text-amber-400"
                                  : "text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              <div className="truncate pr-2">
                                <span className="block truncate font-bold">{e.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {e.nit ? `NIT: ${e.nit}` : e.schema_name}
                                </span>
                              </div>
                              {isCurrent && (
                                <Check className="w-4 h-4 text-amber-500 flex-shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Enlace al Directorio Completo */}
                      <div className="mt-1 pt-1.5 border-t border-slate-200 dark:border-slate-800 px-3">
                        <Link
                          href="/seleccionar-empresa"
                          onClick={() => setEmpresaDropdownOpen(false)}
                          className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline py-1"
                        >
                          <Building2 className="w-3.5 h-3.5" />
                          <span>Ver todas en el Directorio General</span>
                        </Link>
                      </div>

                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link
                href="/seleccionar-empresa"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition"
                title="Ir al Directorio de Empresas"
              >
                <Building2 className="w-3.5 h-3.5 text-amber-500" />
                <span>Empresas</span>
              </Link>
            )}

          </div>

        </div>

        {/* Contenido Principal de las Páginas */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>

    </div>
  );
}
