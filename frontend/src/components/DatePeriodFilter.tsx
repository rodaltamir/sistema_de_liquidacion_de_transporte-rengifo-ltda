"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Filter, 
  CalendarRange, 
  Layers, 
  Check, 
  RotateCcw,
  Sparkles,
  ArrowRight,
  TrendingUp
} from "lucide-react";

export type FilterMode = "mes" | "semestral" | "anual" | "personalizado" | "historico";

export interface PeriodoInfo {
  periodo_mes: string;
  total_viajes?: number;
  total_volumen_litros?: number;
  total_flete_bs?: number;
}

export interface DateFilterChangeEvent {
  mode: FilterMode;
  periodo_mes?: string; // "YYYY-MM"
  anio?: number;
  semestre?: 1 | 2;
  fecha_desde?: string; // "YYYY-MM-DD"
  fecha_hasta?: string; // "YYYY-MM-DD"
  label: string;
}

interface DatePeriodFilterProps {
  currentPeriodoMes?: string;
  initialMode?: FilterMode;
  periodosDisponibles?: (string | PeriodoInfo)[];
  onChange: (filter: DateFilterChangeEvent) => void;
  className?: string;
  compact?: boolean;
}

const MESES_NOMBRES = [
  { num: "01", corto: "Ene", largo: "Enero" },
  { num: "02", corto: "Feb", largo: "Febrero" },
  { num: "03", corto: "Mar", largo: "Marzo" },
  { num: "04", corto: "Abr", largo: "Abril" },
  { num: "05", corto: "May", largo: "Mayo" },
  { num: "06", corto: "Jun", largo: "Junio" },
  { num: "07", corto: "Jul", largo: "Julio" },
  { num: "08", corto: "Ago", largo: "Agosto" },
  { num: "09", corto: "Sep", largo: "Septiembre" },
  { num: "10", corto: "Oct", largo: "Octubre" },
  { num: "11", corto: "Nov", largo: "Noviembre" },
  { num: "12", corto: "Dic", largo: "Diciembre" },
];

export default function DatePeriodFilter({
  currentPeriodoMes,
  initialMode = "mes",
  periodosDisponibles = [],
  onChange,
  className = "",
  compact = false
}: DatePeriodFilterProps) {
  // Mes actual del calendario real
  const now = new Date();
  const currentRealYear = now.getFullYear();
  const currentRealMonth = String(now.getMonth() + 1).padStart(2, "0");
  const currentRealPeriod = `${currentRealYear}-${currentRealMonth}`;

  // Parsear estado inicial
  const initialYear = currentPeriodoMes 
    ? parseInt(currentPeriodoMes.split("-")[0], 10) 
    : currentRealYear;
  const initialMonth = currentPeriodoMes 
    ? currentPeriodoMes.split("-")[1] 
    : currentRealMonth;

  const [mode, setMode] = useState<FilterMode>(initialMode);
  const [selectedYear, setSelectedYear] = useState<number>(initialYear);
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth);
  const [selectedSemester, setSelectedSemester] = useState<1 | 2>(parseInt(initialMonth, 10) <= 6 ? 1 : 2);
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [isExpanded, setIsExpanded] = useState<boolean>(!compact);

  // Mapear periodos con datos a un mapa rápido para consulta O(1)
  const periodosDataMap = useMemo(() => {
    const map = new Map<string, PeriodoInfo>();
    periodosDisponibles.forEach((item) => {
      if (typeof item === "string") {
        map.set(item, { periodo_mes: item });
      } else if (item && item.periodo_mes) {
        map.set(item.periodo_mes, item);
      }
    });
    return map;
  }, [periodosDisponibles]);

  // Si currentPeriodoMes cambia externamente
  useEffect(() => {
    if (currentPeriodoMes && currentPeriodoMes.includes("-")) {
      const [y, m] = currentPeriodoMes.split("-");
      const yNum = parseInt(y, 10);
      if (!isNaN(yNum)) setSelectedYear(yNum);
      if (m) {
        setSelectedMonth(m);
        setSelectedSemester(parseInt(m, 10) <= 6 ? 1 : 2);
      }
    }
  }, [currentPeriodoMes]);

  // Manejar selección de mes
  const handleSelectMonth = (monthNum: string) => {
    setSelectedMonth(monthNum);
    setMode("mes");
    const periodo = `${selectedYear}-${monthNum}`;
    const mesObj = MESES_NOMBRES.find(m => m.num === monthNum);
    const label = `${mesObj?.largo || monthNum} ${selectedYear}`;
    onChange({
      mode: "mes",
      periodo_mes: periodo,
      anio: selectedYear,
      label
    });
  };

  // Manejar selección semestral
  const handleSelectSemestral = (sem: 1 | 2, yr: number = selectedYear) => {
    setSelectedSemester(sem);
    setMode("semestral");
    const fDesde = sem === 1 ? `${yr}-01-01` : `${yr}-07-01`;
    const fHasta = sem === 1 ? `${yr}-06-30` : `${yr}-12-31`;
    const label = `${sem === 1 ? "1er" : "2do"} Semestre ${yr} (${sem === 1 ? "Ene - Jun" : "Jul - Dic"})`;
    onChange({
      mode: "semestral",
      anio: yr,
      semestre: sem,
      fecha_desde: fDesde,
      fecha_hasta: fHasta,
      label
    });
  };

  // Manejar navegación de año
  const handlePrevYear = () => {
    const newYear = selectedYear - 1;
    setSelectedYear(newYear);
    if (mode === "mes") {
      const periodo = `${newYear}-${selectedMonth}`;
      const mesObj = MESES_NOMBRES.find(m => m.num === selectedMonth);
      onChange({
        mode: "mes",
        periodo_mes: periodo,
        anio: newYear,
        label: `${mesObj?.largo || selectedMonth} ${newYear}`
      });
    } else if (mode === "semestral") {
      handleSelectSemestral(selectedSemester, newYear);
    } else if (mode === "anual") {
      onChange({
        mode: "anual",
        anio: newYear,
        fecha_desde: `${newYear}-01-01`,
        fecha_hasta: `${newYear}-12-31`,
        label: `Año ${newYear} Completo`
      });
    }
  };

  const handleNextYear = () => {
    const newYear = selectedYear + 1;
    setSelectedYear(newYear);
    if (mode === "mes") {
      const periodo = `${newYear}-${selectedMonth}`;
      const mesObj = MESES_NOMBRES.find(m => m.num === selectedMonth);
      onChange({
        mode: "mes",
        periodo_mes: periodo,
        anio: newYear,
        label: `${mesObj?.largo || selectedMonth} ${newYear}`
      });
    } else if (mode === "semestral") {
      handleSelectSemestral(selectedSemester, newYear);
    } else if (mode === "anual") {
      onChange({
        mode: "anual",
        anio: newYear,
        fecha_desde: `${newYear}-01-01`,
        fecha_hasta: `${newYear}-12-31`,
        label: `Año ${newYear} Completo`
      });
    }
  };

  // Cambiar a modo Anual
  const handleSelectAnual = (yr: number = selectedYear) => {
    setMode("anual");
    onChange({
      mode: "anual",
      anio: yr,
      fecha_desde: `${yr}-01-01`,
      fecha_hasta: `${yr}-12-31`,
      label: `Año ${yr} Completo`
    });
  };

  // Aplicar rango personalizado
  const handleApplyCustom = () => {
    if (!customFrom || !customTo) return;
    setMode("personalizado");
    onChange({
      mode: "personalizado",
      fecha_desde: customFrom,
      fecha_hasta: customTo,
      label: `${customFrom} al ${customTo}`
    });
  };

  // Preajustes rápidos para personalizado
  const handleQuickPreset = (preset: string) => {
    const today = new Date();
    const toISO = (d: Date) => d.toISOString().split("T")[0];

    let fromD = new Date();
    let toD = new Date();

    if (preset === "7d") {
      fromD.setDate(today.getDate() - 7);
    } else if (preset === "30d") {
      fromD.setDate(today.getDate() - 30);
    } else if (preset === "este_mes") {
      fromD = new Date(today.getFullYear(), today.getMonth(), 1);
      toD = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (preset === "mes_anterior") {
      fromD = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      toD = new Date(today.getFullYear(), today.getMonth(), 0);
    } else if (preset === "trimestre") {
      const currentQuarter = Math.floor(today.getMonth() / 3);
      fromD = new Date(today.getFullYear(), currentQuarter * 3, 1);
      toD = new Date(today.getFullYear(), (currentQuarter + 1) * 3, 0);
    } else if (preset === "ytd") {
      fromD = new Date(today.getFullYear(), 0, 1);
    }

    const fromStr = toISO(fromD);
    const toStr = toISO(toD);
    setCustomFrom(fromStr);
    setCustomTo(toStr);
    setMode("personalizado");

    onChange({
      mode: "personalizado",
      fecha_desde: fromStr,
      fecha_hasta: toStr,
      label: `${fromStr} al ${toStr}`
    });
  };

  // Histórico completo
  const handleSelectHistorico = () => {
    setMode("historico");
    onChange({
      mode: "historico",
      label: "Histórico General (Todos los Periodos)"
    });
  };

  // Ir rápidamente al mes actual
  const handleGoToCurrentMonth = () => {
    setSelectedYear(currentRealYear);
    handleSelectMonth(currentRealMonth);
  };

  // Etiqueta del filtro activo actual
  const activeFilterBadge = useMemo(() => {
    if (mode === "mes") {
      const m = MESES_NOMBRES.find(item => item.num === selectedMonth);
      return `${m?.largo || selectedMonth} ${selectedYear}`;
    }
    if (mode === "semestral") return `${selectedSemester === 1 ? "1er" : "2do"} Semestre ${selectedYear}`;
    if (mode === "anual") return `Gestión Anual ${selectedYear}`;
    if (mode === "personalizado") return customFrom && customTo ? `${customFrom} al ${customTo}` : "Rango Personalizado";
    if (mode === "historico") return "Histórico General";
    return "";
  }, [mode, selectedMonth, selectedYear, selectedSemester, customFrom, customTo]);

  // Contar cuántos meses del año tienen datos
  const activeMonthsInYear = useMemo(() => {
    return MESES_NOMBRES.filter(m => periodosDataMap.has(`${selectedYear}-${m.num}`)).length;
  }, [selectedYear, periodosDataMap]);

  return (
    <div className={`bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl transition-all overflow-hidden ${className}`}>
      
      {/* Barra superior de pestañas y modos */}
      <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-950/40">
        
        {/* Selector de Modos de Filtro */}
        <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-950 p-1 rounded-xl border border-slate-300 dark:border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => {
              setMode("mes");
              handleSelectMonth(selectedMonth);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition text-xs ${
              mode === "mes"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Mensual</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSemestral(selectedSemester)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition text-xs ${
              mode === "semestral"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <CalendarRange className="w-3.5 h-3.5" />
            <span>Semestral</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectAnual()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition text-xs ${
              mode === "anual"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Anual</span>
          </button>

          <button
            type="button"
            onClick={() => setMode("personalizado")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition text-xs ${
              mode === "personalizado"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <CalendarRange className="w-3.5 h-3.5" />
            <span>Personalizado</span>
          </button>

          <button
            type="button"
            onClick={handleSelectHistorico}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition text-xs ${
              mode === "historico"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
            title="Ver todos los registros históricos acumulados"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Todo</span>
          </button>
        </div>

        {/* Indicador del Filtro Activo y Botón Rápido "Mes Actual" */}
        <div className="flex items-center gap-2">
          {/* Botón Mes Actual */}
          <button
            type="button"
            onClick={handleGoToCurrentMonth}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition ${
              mode === "mes" && selectedYear === currentRealYear && selectedMonth === currentRealMonth
                ? "bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-500/50"
            }`}
            title="Ir al mes en curso actual"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Mes Actual</span>
          </button>

          {/* Badge del Filtro Activo */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold text-xs">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>{activeFilterBadge}</span>
          </div>
        </div>

      </div>

      {/* CUERPO SEGÚN EL MODO SELECCIONADO */}
      <div className="p-4 sm:p-5">

        {/* ======================================================== */}
        {/* MODO 1: MENSUAL (VISUALIZADOR DE MESES Y TIMELINE)        */}
        {/* ======================================================== */}
        {mode === "mes" && (
          <div className="space-y-4">
            
            {/* Cabecera del Navegador de Año y Estadísticas */}
            <div className="flex items-center justify-between">
              
              {/* Controles de Año */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevYear}
                  className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                  title="Año anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="font-mono text-sm font-black text-slate-900 dark:text-white">
                    {selectedYear}
                  </span>
                  {selectedYear === currentRealYear && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400">
                      Año en Curso
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleNextYear}
                  className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                  title="Año siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Conteo de Actividad en el Año */}
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>Meses con despachos:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                  {activeMonthsInYear} de 12
                </span>
              </div>

            </div>

            {/* VISUALIZADOR DE MESES (12 PÍLDORAS / TARJETAS INTERACTIVAS) */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
              {MESES_NOMBRES.map((mes) => {
                const periodoKey = `${selectedYear}-${mes.num}`;
                const isSelected = selectedMonth === mes.num;
                const isCurrentRealMonth = selectedYear === currentRealYear && mes.num === currentRealMonth;
                const dataInfo = periodosDataMap.get(periodoKey);
                const hasData = !!dataInfo;
                const viajesCount = dataInfo?.total_viajes;

                return (
                  <button
                    key={mes.num}
                    type="button"
                    onClick={() => handleSelectMonth(mes.num)}
                    className={`relative p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-between min-h-[68px] group ${
                      isSelected
                        ? "bg-amber-500/15 border-amber-500 shadow-md shadow-amber-500/20 font-bold"
                        : hasData
                          ? "bg-slate-50 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 hover:border-amber-500/60"
                          : "bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-400"
                    }`}
                  >
                    {/* Badge indicador de mes actual en curso */}
                    {isCurrentRealMonth && (
                      <span className="absolute -top-1.5 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" title="Mes en curso actual" />
                    )}

                    <span className={`text-xs font-bold uppercase tracking-wider ${
                      isSelected 
                        ? "text-amber-600 dark:text-amber-400" 
                        : hasData 
                          ? "text-slate-900 dark:text-slate-200" 
                          : "text-slate-400 dark:text-slate-500"
                    }`}>
                      {mes.corto}
                    </span>

                    {/* Indicador de viajes o estado */}
                    <div className="mt-1 flex flex-col items-center">
                      {hasData ? (
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                          isSelected
                            ? "bg-amber-500 text-slate-950 font-black"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold"
                        }`}>
                          {viajesCount ? `${viajesCount} op` : "Activo"}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 dark:text-slate-600">
                          -
                        </span>
                      )}
                    </div>

                    {/* Línea decorativa inferior */}
                    {isSelected && (
                      <div className="w-6 h-0.5 bg-amber-500 rounded-full mt-1" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Sub-barra informativa del mes seleccionado */}
            {periodosDataMap.get(`${selectedYear}-${selectedMonth}`) && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-wrap items-center justify-between text-xs text-amber-700 dark:text-amber-300">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-500" />
                  <span>
                    <b>{MESES_NOMBRES.find(m => m.num === selectedMonth)?.largo} {selectedYear}:</b> Operaciones registradas y conciliadas en este periodo.
                  </span>
                </div>
                {periodosDataMap.get(`${selectedYear}-${selectedMonth}`)?.total_viajes && (
                  <span className="font-mono font-bold">
                    {periodosDataMap.get(`${selectedYear}-${selectedMonth}`)?.total_viajes} Despachos
                  </span>
                )}
              </div>
            )}

          </div>
        )}

        {/* ======================================================== */}
        {/* MODO SEMESTRAL (1er y 2do SEMESTRE DEL AÑO)              */}
        {/* ======================================================== */}
        {mode === "semestral" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <CalendarRange className="w-4 h-4 text-amber-500" />
                  <span>Consolidado Semestral: Gestión {selectedYear}</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Filtro oficial de auditoría por semestres para la gestión {selectedYear}.
                </p>
              </div>

              {/* Selector de Año */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevYear}
                  className="p-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  title="Año anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-sm font-black text-slate-900 dark:text-white">
                  {selectedYear}
                </div>

                <button
                  type="button"
                  onClick={handleNextYear}
                  className="p-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  title="Año siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tarjetas de Semestres */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 1er Semestre */}
              <button
                type="button"
                onClick={() => handleSelectSemestral(1)}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  selectedSemester === 1
                    ? "bg-amber-500/15 border-amber-500 shadow-lg shadow-amber-500/10 ring-2 ring-amber-500/40"
                    : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-amber-500/50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${selectedSemester === 1 ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-600"}`} />
                    <h5 className="font-black text-sm text-slate-900 dark:text-white">
                      1er Semestre ({selectedYear})
                    </h5>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                    01/01/{selectedYear} al 30/06/{selectedYear}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Comprende todas las operaciones de Enero, Febrero, Marzo, Abril, Mayo y Junio.
                </p>
              </button>

              {/* 2do Semestre */}
              <button
                type="button"
                onClick={() => handleSelectSemestral(2)}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  selectedSemester === 2
                    ? "bg-amber-500/15 border-amber-500 shadow-lg shadow-amber-500/10 ring-2 ring-amber-500/40"
                    : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-amber-500/50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${selectedSemester === 2 ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-600"}`} />
                    <h5 className="font-black text-sm text-slate-900 dark:text-white">
                      2do Semestre ({selectedYear})
                    </h5>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                    01/07/{selectedYear} al 31/12/{selectedYear}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Comprende todas las operaciones de Julio, Agosto, Septiembre, Octubre, Noviembre y Diciembre.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODO 3: ANUAL (RESUMEN POR AÑO COMPLETO)                  */}
        {/* ======================================================== */}
        {mode === "anual" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span>Consolidado Anual: Gestión {selectedYear}</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Muestra todas las operaciones, fletes y liquidaciones realizadas entre el 01/01/{selectedYear} y el 31/12/{selectedYear}.
                </p>
              </div>

              {/* Selector de Año Rápido */}
              <div className="flex items-center gap-2">
                {[selectedYear - 2, selectedYear - 1, selectedYear, selectedYear + 1].map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => {
                      setSelectedYear(yr);
                      onChange({
                        mode: "anual",
                        anio: yr,
                        fecha_desde: `${yr}-01-01`,
                        fecha_hasta: `${yr}-12-31`,
                        label: `Año ${yr} Completo`
                      });
                    }}
                    className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition ${
                      selectedYear === yr
                        ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-amber-500/50"
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODO 3: PERSONALIZADO (RANGO DESDE / HASTA Y PRESETS)     */}
        {/* ======================================================== */}
        {mode === "personalizado" && (
          <div className="space-y-4">
            
            {/* Accesos rápidos a rangos comunes */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1">Preajustes:</span>
              {[
                { key: "7d", label: "Últimos 7 días" },
                { key: "30d", label: "Últimos 30 días" },
                { key: "este_mes", label: "Este Mes" },
                { key: "mes_anterior", label: "Mes Anterior" },
                { key: "trimestre", label: "Este Trimestre" },
                { key: "ytd", label: "Año a la fecha (YTD)" },
              ].map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => handleQuickPreset(preset.key)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-amber-500/20 hover:text-amber-500 dark:hover:text-amber-400 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Inputs de Fecha Desde y Fecha Hasta */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Fecha Desde
                </label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Fecha Hasta
                </label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleApplyCustom}
                  disabled={!customFrom || !customTo}
                  className="flex-1 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Aplicar Filtro</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCustomFrom("");
                    setCustomTo("");
                    handleGoToCurrentMonth();
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-rose-500 text-xs transition"
                  title="Limpiar rango y volver al mes actual"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* MODO 4: HISTÓRICO COMPLETO                                */}
        {/* ======================================================== */}
        {mode === "historico" && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-500">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">
                  Auditoría Histórica General
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  Visualizando todos los registros de viajes y planillas sin filtro de fecha.
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoToCurrentMonth}
              className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold text-xs hover:bg-amber-500/25 transition"
            >
              Volver al Mes Actual
            </button>
          </div>
        )}

      </div>

    </div>
  );
}
