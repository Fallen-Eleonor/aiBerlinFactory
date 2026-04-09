const STORAGE_KEY = "startup-os-client-id";

function generateClientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `startup-os-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

export function getClientId() {
  if (typeof window === "undefined") {
    return "public-demo";
  }

  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const created = generateClientId();
  window.localStorage.setItem(STORAGE_KEY, created);
  return created;
}
