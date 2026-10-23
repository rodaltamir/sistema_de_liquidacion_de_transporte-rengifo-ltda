export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // Si estamos navegando bajo HTTPS o puerto proxy, usar el mismo origen /api
    if (window.location.protocol === 'https:' || window.location.port === '3443') {
      return `${window.location.origin}/api`;
    }
    const host = window.location.hostname;
    return `${window.location.protocol}//${host}:8001/api`;
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api';
}

export const getApiUrl = getApiBaseUrl;

interface CacheEntry {
  data: any;
  timestamp: number;
}

// Cache en memoria para acelerar la navegación entre módulos (0ms en cambios de pestaña)
const memoryCache = new Map<string, CacheEntry>();

export function clearApiCache(pattern?: string) {
  if (!pattern) {
    memoryCache.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.includes(pattern)) {
      memoryCache.delete(key);
    }
  }
}

export interface ApiFetchOptions extends RequestInit {
  noCache?: boolean;
}

export async function apiFetch(endpoint: string, options: ApiFetchOptions = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {})
  };

  if (typeof FormData !== 'undefined' && options.body instanceof FormData) {
    delete headers['Content-Type'];
  } else if (!headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${getApiBaseUrl()}${cleanEndpoint}`;

  const method = (options.method || 'GET').toUpperCase();
  const isGet = method === 'GET';
  const bypassCache = options.cache === 'no-store' || options.noCache === true;

  // Si se ejecuta una mutación (POST, PUT, DELETE, PATCH), invalidar la caché
  if (!isGet) {
    clearApiCache();
  } else if (!bypassCache) {
    const cached = memoryCache.get(url);
    // Catálogos, empresas y unidades se benefician de 30s de caché en memoria
    if (cached && (Date.now() - cached.timestamp < 30000)) {
      return cached.data;
    }
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errorDetail = 'Error en la solicitud';
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errorDetail;
    } catch {
      errorDetail = await response.text() || errorDetail;
    }
    throw new Error(errorDetail);
  }

  // Si es descarga binaria (Excel, PDF, CSV)
  const contentType = response.headers.get('content-type');
  if (contentType && (
    contentType.includes('application/pdf') || 
    contentType.includes('application/vnd.openxmlformats') ||
    contentType.includes('spreadsheetml') ||
    contentType.includes('application/octet-stream')
  )) {
    const rawBlob = await response.blob();
    return new Blob([rawBlob], { type: contentType.split(';')[0].trim() });
  }

  const jsonResult = await response.json();

  if (isGet && !bypassCache) {
    memoryCache.set(url, {
      data: jsonResult,
      timestamp: Date.now()
    });
  }

  return jsonResult;
}
