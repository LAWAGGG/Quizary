import 'expo-blob';
export const getBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL || "";
  return envUrl.replace(/\/+$/, "");
};

export function getApiUrl(path) {
  const base = getBaseUrl();
  let cleanPath = path.startsWith("/") ? path : `/${path}`;

  if (base.endsWith("/api")) {
    if (cleanPath.startsWith("/api/")) {
      cleanPath = cleanPath.replace(/^\/api/, "");
    }
    return `${base}${cleanPath}`;
  }

  if (!cleanPath.startsWith("/api/")) {
    cleanPath = `/api${cleanPath}`;
  }
  return `${base}${cleanPath}`;
}

export function extractErrorMessage(data, fallback = "Terjadi kesalahan pada server") {
  if (!data) return fallback;
  if (typeof data === "string") return data;

  if (Array.isArray(data.errors) && data.errors.length > 0) {
    const messages = data.errors
      .map((err) => {
        if (typeof err === "string") return err;
        if (typeof err === "object" && err !== null) {
          const vals = Object.values(err).filter(Boolean);
          return vals.join(": ");
        }
        return String(err);
      })
      .filter(Boolean);

    if (messages.length > 0) {
      return messages.join("\n");
    }
  }

  if (data.message && typeof data.message === "string") {
    return data.message;
  }

  if (data.detail) {
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) {
      return data.detail.map((d) => d.msg || JSON.stringify(d)).join("\n");
    }
  }

  return fallback;
}

export function parseWibDate(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr.getTime();
  if (typeof dateStr === "number") return dateStr;
  if (typeof dateStr !== "string") return null;

  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Standard ISO string with T or Z
  if (trimmed.includes("T") || trimmed.includes("Z")) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d.getTime();
  }

  // YYYY-MM-DD HH:mm:ss or DD-MM-YYYY HH:mm:ss
  const parts = trimmed.split(/[\s:-]+/).map(Number);
  if (parts.length < 3 || parts.some(isNaN)) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d.getTime();
  }

  let year = 0, month = 0, day = 0, hours = 0, minutes = 0, seconds = 0;
  if (parts[0] > 1000) {
    // YYYY-MM-DD HH:mm:ss
    [year, month, day, hours = 0, minutes = 0, seconds = 0] = parts;
  } else if (parts[2] > 1000) {
    // DD-MM-YYYY HH:mm:ss
    [day, month, year, hours = 0, minutes = 0, seconds = 0] = parts;
  } else {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d.getTime();
  }

  // Treat as WIB (UTC+7)
  const utcTime = Date.UTC(year, month - 1, day, hours - 7, minutes, seconds);
  return utcTime;
}

export function isSubmissionExpired(item) {
  if (!item || typeof item !== "object") return false;
  const status = item.status || "";
  if (status === "submitted" || status === "auto_submitted" || status === "cheating") {
    return true;
  }
  if (!item.expired_at) return false;
  const expiredTime = parseWibDate(item.expired_at);
  if (!expiredTime) return false;
  return Date.now() >= expiredTime;
}
