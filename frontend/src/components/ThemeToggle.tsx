"use client";

import React from "react";
import { Sun, Moon, Laptop } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

interface ThemeToggleProps {
  showLabel?: boolean;
  className?: string;
}

export default function ThemeToggle({ showLabel = false, className = "" }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme, theme, setTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className={`relative inline-flex items-center gap-2 p-2 rounded-xl transition-all duration-200 ${
        resolvedTheme === "dark"
          ? "bg-slate-800/80 hover:bg-slate-800 text-amber-400 border border-slate-700/80 hover:border-amber-500/50 shadow-sm"
          : "bg-white hover:bg-slate-100 text-amber-600 border border-slate-200 hover:border-amber-400/50 shadow-sm"
      } ${className}`}
      title={resolvedTheme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-label="Alternar tema claro y oscuro"
    >
      <div className="relative w-5 h-5 flex items-center justify-center">
        {resolvedTheme === "dark" ? (
          <Sun className="w-4.5 h-4.5 text-amber-400 transition-transform duration-300 hover:rotate-45" />
        ) : (
          <Moon className="w-4.5 h-4.5 text-amber-600 transition-transform duration-300 -rotate-12" />
        )}
      </div>

      {showLabel && (
        <span className="text-xs font-bold tracking-tight text-slate-700 dark:text-slate-300">
          {resolvedTheme === "dark" ? "Modo Claro" : "Modo Oscuro"}
        </span>
      )}
    </button>
  );
}
