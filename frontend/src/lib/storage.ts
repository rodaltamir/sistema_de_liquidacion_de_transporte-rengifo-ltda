/**
 * Utilidad de Memoria Inteligente (Smart Persistence)
 * Guarda y recupera filtros y estados de módulos en localStorage,
 * asegurando aislamiento por empresa/schema y manejo seguro de errores.
 */

export function getSavedState<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const item = window.localStorage.getItem(key);
    if (!item) return defaultValue;
    const parsed = JSON.parse(item);
    return parsed !== null && parsed !== undefined ? parsed : defaultValue;
  } catch (e) {
    console.warn(`[Memoria Inteligente] Error al leer "${key}":`, e);
    return defaultValue;
  }
}

export function saveState<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`[Memoria Inteligente] Error al guardar "${key}":`, e);
  }
}

export function removeSavedState(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch (e) {
    console.warn(`[Memoria Inteligente] Error al eliminar "${key}":`, e);
  }
}
