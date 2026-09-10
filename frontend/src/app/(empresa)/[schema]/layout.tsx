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
  Fuel,
  ShieldCheck,
  UserCheck
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
      name: "Flota y Camiones",
      href: `/${schema}/flota`,
      icon: Truck,
    },
    {
      name: "Personal y Choferes",
      href: `/${schema}/personal`,
      icon: Users,
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
      name: "Configuración y Tarifas",
      href: `/${schema}/configuracion`,
      icon: Settings,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex">
      
      {/* Sidebar para desktop */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between hidden md:flex sticky top-0 h-screen z-30 shadow-xs">
        <div>
          {/* Header del Sidebar con branding de la Empresa */}
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm flex-shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <h2 className="text-sm font-bold text-slate-900 truncate" title={empresa?.name || "Empresa"}>
                  {empresa?.name || "Cargando..."}
                </h2>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <p className="text-[11px] font-mono text-slate-400 truncate">
                    {schema}
                  </p>
                </div>
              </div>
            </div>

            {/* Selector para cambiar de empresa o asociación */}
            <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <Link
                href="/seleccionar-empresa"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Cambiar Empresa</span>
              </Link>
              {empresa?.asociacion_id && (
                <Link
                  href={`/asociacion/${empresa.asociacion_id}`}
                  className="text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors"
                  title="Ver Asociación"
                >
                  Asociación
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
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? "bg-blue-50 text-blue-700 font-semibold shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                  <span>{link.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer del Sidebar con usuario y logout */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
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

      {/* Header móvil y menú desplegable */}
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
                <span className="font-bold text-sm text-slate-900">Menú de Opciones</span>
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
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
                        isActive ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-600 hover:bg-slate-100"
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
                href="/seleccionar-empresa"
                className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-blue-600"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Cambiar de Empresa</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Área de Contenido de la Empresa */}
      <div className="flex-1 flex flex-col min-w-0 md:pt-0 pt-16">
        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

    </div>
  );
}
