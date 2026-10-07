"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Truck, Handshake, Users } from "lucide-react";

interface DirectoryNavProps {
  schema: string;
  counts?: {
    propia?: number;
    apoyo?: number;
    clientes?: number;
  };
}

export default function DirectoryNav({ schema, counts }: DirectoryNavProps) {
  const pathname = usePathname();

  const tabs = [
    {
      name: "Flota Propia",
      href: `/${schema}/flota`,
      icon: Truck,
      count: counts?.propia,
      badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
    },
    {
      name: "Flota de Apoyo",
      href: `/${schema}/apoyo`,
      icon: Handshake,
      count: counts?.apoyo,
      badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
    },
    {
      name: "Clientes",
      href: `/${schema}/clientes`,
      icon: Users,
      count: counts?.clientes,
      badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
    }
  ];

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl mb-6 backdrop-blur-sm shadow-xs overflow-x-auto scrollbar-none">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = pathname === tab.href;

        return (
          <Link
            key={tab.name}
            href={tab.href}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex-1 sm:flex-initial justify-center sm:justify-start ${
              isActive
                ? "bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm border border-slate-200/80 dark:border-slate-700 font-extrabold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/40"
            }`}
          >
            <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-amber-500" : "text-slate-400"}`} />
            <span>{tab.name}</span>
            {tab.count !== undefined && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-mono font-bold ${
                isActive 
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" 
                  : "bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300/40 dark:border-slate-700"
              }`}>
                {tab.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
