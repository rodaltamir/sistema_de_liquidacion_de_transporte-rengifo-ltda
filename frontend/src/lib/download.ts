/**
 * Utilidad robusta para descarga de archivos en el navegador (Excel, PDF, Plantillas)
 * 
 * Resuelve problemas en Chromium/Chrome con Blob URLs:
 * 1. Asigna el tipo MIME explícito (evita advertencias de payload binario no seguro).
 * 2. Previene el error de cancelación/revocación prematura (URL.revokeObjectURL inmediato).
 * 3. Proporciona descarga limpia y compatible con contextos HTTP y HTTPS.
 */
export function downloadBlob(blob: Blob, filename: string, mimeType?: string): void {
  try {
    // 1. Determinar tipo MIME explícito
    let detectedType = mimeType || blob.type;
    if (!detectedType || detectedType === "application/octet-stream") {
      if (filename.endsWith(".xlsx")) {
        detectedType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      } else if (filename.endsWith(".pdf")) {
        detectedType = "application/pdf";
      } else if (filename.endsWith(".csv")) {
        detectedType = "text/csv";
      } else {
        detectedType = "application/octet-stream";
      }
    }

    // 2. Crear Blob seguro con su tipo MIME definido
    const safeBlob = blob.type === detectedType ? blob : new Blob([blob], { type: detectedType });

    // 3. Crear Object URL para la descarga
    const url = window.URL.createObjectURL(safeBlob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = filename;

    // 4. Agregar al DOM, disparar click
    document.body.appendChild(a);
    a.click();

    // 5. Revocar el Object URL tras un tiempo prudente (30 segundos)
    // Esto asegura que el subsistema de descargas de Chrome termine de escribir el archivo
    // sin que se encuentre con una URL revocada prematuramente en conexiones HTTP.
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
      if (a.parentNode) {
        a.parentNode.removeChild(a);
      }
    }, 30000);
  } catch (err) {
    console.error("Error al procesar la descarga:", err);
    throw err;
  }
}
