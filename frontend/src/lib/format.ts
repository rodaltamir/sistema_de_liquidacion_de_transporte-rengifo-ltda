export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return 'Bs. 0.00';
  return 'Bs. ' + amount.toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatNumber(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined || isNaN(val)) return '0.00';
  return val.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatLitros(litros: number | null | undefined): string {
  if (litros === null || litros === undefined || isNaN(litros)) return '0 L';
  return `${litros.toLocaleString('es-BO', { maximumFractionDigits: 1 })} Lts`;
}

export function formatM3(m3: number | null | undefined): string {
  if (m3 === null || m3 === undefined || isNaN(m3)) return '0.000 m³';
  return `${m3.toLocaleString('es-BO', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} m³`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const [year, month, day] = dateStr.split('-');
    if (day && month && year) {
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}
