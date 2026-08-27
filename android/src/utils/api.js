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
  if (!dateStr || typeof dateStr !== "string") return null;
  const parts = dateStr.trim().split(" ");
  if (parts.length !== 2) return null;
  const [datePart, timePart] = parts;
  const dateSplit = datePart.split("-").map(Number);
  const timeSplit = timePart.split(":").map(Number);
  if (dateSplit.length !== 3 || timeSplit.length !== 3) return null;

  const [day, month, year] = dateSplit;
  const [hours, minutes, seconds] = timeSplit;
  if (!day || !month || !year) return null;
  
  const isoString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}+07:00`;
  const timestamp = new Date(isoString).getTime();
  return isNaN(timestamp) ? null : timestamp;
}
