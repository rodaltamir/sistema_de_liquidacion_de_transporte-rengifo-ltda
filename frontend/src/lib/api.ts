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

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
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

  return response.json();
}
