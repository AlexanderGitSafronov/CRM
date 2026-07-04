/**
 * Базовая защита от SSRF для admin-задаваемых webhook URL (Rashod/AdTrack test).
 * Пропускаем только http/https на публичные хосты; блокируем loopback,
 * приватные и link-local диапазоны, cloud-metadata (169.254.169.254) и
 * очевидные внутренние имена. От DNS-rebinding не защищает (остаточный риск),
 * но закрывает прямое обращение к внутренним сервисам и метаданным.
 */

const PRIVATE_V4 = [
  /^127\./,            // loopback
  /^10\./,             // private
  /^192\.168\./,       // private
  /^169\.254\./,       // link-local (incl. cloud metadata 169.254.169.254)
  /^0\./,              // this-network
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT 100.64/10
];

function isPrivateV4(host: string): boolean {
  if (PRIVATE_V4.some((re) => re.test(host))) return true;
  // 172.16.0.0 – 172.31.255.255
  const m = /^172\.(\d{1,3})\./.exec(host);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

export function assertSafeExternalUrl(raw: string): { ok: true } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: 'Невалідний URL' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: 'Дозволені лише http(s) URL' };
  }
  const host = url.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '[::1]' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.startsWith('fc') || host.startsWith('fd') || // IPv6 ULA
    host.startsWith('fe80') // IPv6 link-local
  ) {
    return { ok: false, error: 'Внутрішні адреси заборонені' };
  }
  // IPv4-литерал в приватном диапазоне
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) && isPrivateV4(host)) {
    return { ok: false, error: 'Приватні IP-адреси заборонені' };
  }
  return { ok: true };
}
