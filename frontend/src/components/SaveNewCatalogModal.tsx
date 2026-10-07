"use client";

import React from "react";
import { Sparkles, Truck, Users, Check, ArrowRight, X, AlertCircle } from "lucide-react";
import ModalPortal from "@/components/ModalPortal";

interface SaveNewCatalogModalProps {
  isOpen: boolean;
  placa?: string;
  isNewPlaca: boolean;
  cliente?: string;
  isNewCliente: boolean;
  onConfirmSaveCatalog: () => void;
  onContinueWithoutSaving: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function SaveNewCatalogModal({
  isOpen,
  placa,
  isNewPlaca,
  cliente,
  isNewCliente,
  onConfirmSaveCatalog,
  onContinueWithoutSaving,
  onCancel,
  loading = false,
}: SaveNewCatalogModalProps) {
  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-150">
        <div 
          className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl transition-all duration-200"
          role="dialog"
          aria-modal="true"
        >
        {/* Botón cerrar esquina */}
        <button
          onClick={onCancel}
          disabled={loading}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
          title="Cerrar y volver a editar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cabecera con Ícono Amigable */}
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Sparkles className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
              ¿Guardar en el Catálogo?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Detectamos datos nuevos que no están registrados
            </p>
          </div>
        </div>

        {/* Resumen de elementos nuevos detectados */}
        <div className="space-y-2.5 my-5">
          {isNewPlaca && (
            <div className="flex items-center justify-between p-3 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">
                    Nueva Cisterna / Placa
                  </span>
                  <span className="font-mono font-black text-slate-900 dark:text-white text-xs">
                    {placa}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                Nuevo
              </span>
            </div>
          )}

          {isNewCliente && (
            <div className="flex items-center justify-between p-3 bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 rounded-2xl text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">
                    Nuevo Cliente
                  </span>
                  <span className="font-black text-slate-900 dark:text-white text-xs">
                    {cliente}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                Nuevo
              </span>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
          ¿Deseas guardar estos registros permanentemente en el directorio para que aparezcan en futuros despachos y liquidaciones?
        </p>

        {/* Acciones principales */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onConfirmSaveCatalog}
            disabled={loading}
            className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition active:scale-[0.99]"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-slate-950/20 border-t-slate-950 rounded-full animate-spin" />
            ) : (
              <Check className="w-4 h-4 stroke-[3]" />
            )}
            <span>Sí, Guardar en Catálogo y Registrar</span>
          </button>

          <button
            type="button"
            onClick={onContinueWithoutSaving}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl border border-slate-300/60 dark:border-slate-700 flex items-center justify-center gap-2 transition"
          >
            <span>Solo para este Viaje (Sin Guardar)</span>
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="w-full py-2 text-center text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            Cancelar y corregir datos
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
