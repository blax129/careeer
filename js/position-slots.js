const STORAGE_FILLED_KEY = "fifa-wc26-slot-fills";
const STORAGE_APPLIED_KEY = "fifa-wc26-applied-jobs";
const SLOTS_API_URL = String(import.meta.env?.VITE_SLOTS_API_URL || "").trim();

const filledCache = new Map();
let filledCacheLoaded = false;
let filledCachePromise = null;

function hashJobId(jobId) {
  const value = String(jobId);
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export function getTotalSlots(jobId) {
  const hash = hashJobId(jobId);
  return 72 + (hash % 79);
}

function readLocalFilledCounts() {
  try {
    const raw = localStorage.getItem(STORAGE_FILLED_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalFilledCounts(counts) {
  localStorage.setItem(STORAGE_FILLED_KEY, JSON.stringify(counts));
}

function getLocalFilledCount(jobId) {
  const counts = readLocalFilledCounts();
  return Number(counts[String(jobId)] || 0);
}

function setLocalFilledCount(jobId, filled) {
  const counts = readLocalFilledCounts();
  counts[String(jobId)] = Math.max(0, Number(filled) || 0);
  writeLocalFilledCounts(counts);
}

function hasAppliedToJob(jobId) {
  try {
    const raw = localStorage.getItem(STORAGE_APPLIED_KEY);
    if (!raw) return false;

    const applied = JSON.parse(raw);
    return Array.isArray(applied) && applied.includes(String(jobId));
  } catch {
    return false;
  }
}

function markAppliedToJob(jobId) {
  const applied = new Set();

  try {
    const raw = localStorage.getItem(STORAGE_APPLIED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((id) => applied.add(String(id)));
      }
    }
  } catch {
    // Ignore invalid storage.
  }

  applied.add(String(jobId));
  localStorage.setItem(STORAGE_APPLIED_KEY, JSON.stringify([...applied]));
}

async function fetchRemoteFilledCounts() {
  if (!SLOTS_API_URL) {
    return readLocalFilledCounts();
  }

  const url = new URL(SLOTS_API_URL);
  url.searchParams.set("all", "1");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Slots API HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (!payload || typeof payload !== "object") {
    return {};
  }

  return payload;
}

export async function loadFilledCounts() {
  if (filledCacheLoaded) {
    return filledCache;
  }

  if (!filledCachePromise) {
    filledCachePromise = (async () => {
      const localCounts = readLocalFilledCounts();

      try {
        const remoteCounts = await fetchRemoteFilledCounts();

        for (const [jobId, filled] of Object.entries(remoteCounts)) {
          const remoteValue = Number(filled) || 0;
          const localValue = Number(localCounts[jobId] || 0);
          const merged = Math.max(remoteValue, localValue);
          filledCache.set(String(jobId), merged);
        }
      } catch (error) {
        console.warn("Using local position counts:", error);

        for (const [jobId, filled] of Object.entries(localCounts)) {
          filledCache.set(String(jobId), Number(filled) || 0);
        }
      }

      for (const [jobId, filled] of Object.entries(localCounts)) {
        if (!filledCache.has(String(jobId))) {
          filledCache.set(String(jobId), Number(filled) || 0);
        }
      }

      filledCacheLoaded = true;
      return filledCache;
    })();
  }

  return filledCachePromise;
}

export function getFilledCount(jobId) {
  const cached = filledCache.get(String(jobId));
  if (cached != null) {
    return cached;
  }

  return getLocalFilledCount(jobId);
}

export function getRemainingSlots(jobId) {
  const total = getTotalSlots(jobId);
  const filled = getFilledCount(jobId);
  return Math.max(0, total - filled);
}

export function formatSlotsLabel(remaining) {
  if (remaining <= 0) {
    return "No positions left";
  }

  if (remaining === 1) {
    return "1 position left";
  }

  return `${remaining} positions left`;
}

export function renderSlotsMarkup(remaining, className = "position-slots") {
  const label = formatSlotsLabel(remaining);
  const modifier =
    remaining <= 0
      ? `${className}--filled`
      : remaining <= 10
        ? `${className}--urgent`
        : `${className}--available`;

  return `<p class="${className} ${modifier}">${label}</p>`;
}

async function incrementRemoteFilledCount(jobId) {
  if (!SLOTS_API_URL) {
    return getLocalFilledCount(jobId) + 1;
  }

  const response = await fetch(SLOTS_API_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ jobId: String(jobId) }),
  });

  if (!response.ok) {
    throw new Error(`Slots API HTTP ${response.status}`);
  }

  const payload = await response.json();
  return Number(payload?.filled || 0);
}

export async function recordApprovedApplication(jobId) {
  const id = String(jobId);

  if (hasAppliedToJob(id)) {
    return getRemainingSlots(id);
  }

  const nextLocal = getLocalFilledCount(id) + 1;
  setLocalFilledCount(id, nextLocal);
  filledCache.set(id, nextLocal);
  markAppliedToJob(id);

  try {
    const remoteFilled = await incrementRemoteFilledCount(id);
    if (remoteFilled > 0) {
      setLocalFilledCount(id, remoteFilled);
      filledCache.set(id, remoteFilled);
    }
  } catch (error) {
    console.warn("Could not sync position count:", error);
  }

  window.dispatchEvent(
    new CustomEvent("fifa-slots-updated", {
      detail: { jobId: id, remaining: getRemainingSlots(id) },
    }),
  );

  return getRemainingSlots(id);
}

export function onSlotsUpdated(callback) {
  const handler = (event) => callback(event.detail);

  window.addEventListener("fifa-slots-updated", handler);
  window.addEventListener("storage", () => {
    filledCacheLoaded = false;
    filledCachePromise = null;
    loadFilledCounts().then(() => callback());
  });

  return () => {
    window.removeEventListener("fifa-slots-updated", handler);
  };
}
