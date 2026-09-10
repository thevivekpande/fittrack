export const MOBILE_APP_URL = 'https://fittrack-three-bice.vercel.app/';

// The QR contains only an app URL. Browser state and URL query parameters never
// leave the current browser through this feature.
function parseHttpUrl(value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url;
  } catch { return null; }
}

export function isLoopbackHostname(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  return host === 'localhost' || host.endsWith('.localhost') || host === '::1'
    || host === '0:0:0:0:0:0:0:1' || /^::ffff:127(?:\.\d{1,3}){3}$/.test(host)
    || /^::ffff:7f[\da-f]{2}:[\da-f]{1,4}$/.test(host) || /^127(?:\.\d{1,3}){3}$/.test(host);
}

export function requiresNetworkDiscovery(hostname) {
  return isLoopbackHostname(hostname) || ['0.0.0.0', '::', '[::]'].includes(hostname);
}

function ipv4Parts(value) {
  if (typeof value !== 'string' || !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) return null;
  const parts = value.split('.').map(Number);
  return parts.every((part) => part >= 0 && part <= 255) ? parts : null;
}

export function isUsableNetworkIPv4(value) {
  const parts = ipv4Parts(value);
  return Boolean(parts && parts[0] > 0 && parts[0] < 224 && parts[0] !== 127
    && !(parts[0] === 169 && parts[1] === 254));
}

export function isPrivateIPv4(value) {
  const parts = ipv4Parts(value);
  return Boolean(parts && (parts[0] === 10 || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)));
}

// Called by Vite with its actual listening socket, rather than a requested port
// that may have changed because another process was already using it.
export function getNetworkAccess({ interfaces = {}, boundAddress, port, protocol = 'http:' } = {}) {
  const loopbackOnly = !boundAddress || isLoopbackHostname(boundAddress);
  if (loopbackOnly || !Number.isInteger(port) || port < 1 || port > 65535
    || !['http:', 'https:'].includes(protocol)) return { urls: [], loopbackOnly: true };
  const wildcard = boundAddress === '0.0.0.0' || boundAddress === '::';
  const addresses = [...new Set(Object.values(interfaces).flat().filter((entry) => entry
    && !entry.internal && (entry.family === 'IPv4' || entry.family === 4)
    && isUsableNetworkIPv4(entry.address)
    && (wildcard || entry.address === boundAddress)).map((entry) => entry.address))];
  addresses.sort((a, b) => Number(isPrivateIPv4(b)) - Number(isPrivateIPv4(a))
    || a.localeCompare(b, undefined, { numeric: true }));
  return { urls: addresses.map((address) => `${protocol}//${address}:${port}`), loopbackOnly: false };
}

export function getMobileAccessUrls(pageUrl, networkInfo) {
  const page = parseHttpUrl(pageUrl);
  if (!page) return [];
  if (!requiresNetworkDiscovery(page.hostname)) {
    // Do not share an unspecified, multicast, or link-local numeric address.
    if (ipv4Parts(page.hostname) && !isUsableNetworkIPv4(page.hostname)) return [];
    return [`${page.origin}${page.pathname}`];
  }
  if (!networkInfo || networkInfo.loopbackOnly !== false || !Array.isArray(networkInfo.urls)) return [];
  return [...new Set(networkInfo.urls.flatMap((value) => {
    const target = parseHttpUrl(value);
    // Discovery may only substitute a numeric local network host. An unexpected
    // endpoint response cannot turn this panel into a QR for an external site.
    if (!target || !isUsableNetworkIPv4(target.hostname) || target.protocol !== page.protocol
      || target.port !== page.port || target.pathname !== '/' || target.search || target.hash) return [];
    return [`${target.origin}${page.pathname}`];
  }))];
}
