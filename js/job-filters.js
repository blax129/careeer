import { resolveJobPay } from "./job-pay.js";

export const ACCOMMODATION_LABEL =
  "Accommodation can be provided on request";

export const EXCLUDED_JOB_TITLES = new Set([
  "Manager, Airport - Guadalajara - Match Day Only",
]);

export const US_LOCATIONS = new Set([
  "Atlanta",
  "Boston",
  "Columbus",
  "Dallas",
  "Houston",
  "Kansas City",
  "Los Angeles",
  "Miami",
  "New York/New Jersey",
  "Philadelphia",
  "San Francisco",
  "Seattle",
]);

export function isExcludedJob(job) {
  return EXCLUDED_JOB_TITLES.has(job.title.trim());
}

export function isUSJob(job) {
  return US_LOCATIONS.has(job.locationName.trim());
}

export function isVisibleJob(job) {
  return !isExcludedJob(job) && isUSJob(job);
}

const REGIONAL_AREA_BY_HOST_CITY = {
  Atlanta: "Georgia area",
  Boston: "Greater Boston Area",
  Columbus: "Greater Columbus Area",
  Dallas: "Dallas-Fort Worth area",
  Houston: "Greater Houston Area",
  "Kansas City": "Greater Kansas City Area",
  "Los Angeles": "Greater Los Angeles Area",
  Miami: "Greater Miami Area",
  "New York/New Jersey": "Greater New York/New Jersey Area",
  Philadelphia: "Greater Philadelphia Area",
  "San Francisco": "San Francisco Bay Area",
  Seattle: "Greater Seattle Area",
};

const WORKSITE_BY_HOST_CITY = {
  Atlanta: {
    name: "Mercedes-Benz Stadium",
    address: "1 AMB Drive NW, Atlanta, GA 30313",
  },
  Boston: {
    name: "Gillette Stadium",
    address: "1 Patriot Place, Foxborough, MA 02035",
  },
  Columbus: {
    name: "Lower.com Field",
    address: "96 Columbus Crew Way, Columbus, OH 43215",
  },
  Dallas: {
    name: "AT&T Stadium",
    address: "1 AT&T Way, Arlington, TX 76011",
  },
  Houston: {
    name: "NRG Stadium",
    address: "8820 Kirby Drive, Houston, TX 77054",
  },
  "Kansas City": {
    name: "GEHA Field at Arrowhead Stadium",
    address: "1 Arrowhead Drive, Kansas City, MO 64129",
  },
  "Los Angeles": {
    name: "SoFi Stadium",
    address: "1001 S Stadium Drive, Inglewood, CA 90301",
  },
  Miami: {
    name: "Hard Rock Stadium",
    address: "347 Don Shula Drive, Miami Gardens, FL 33056",
  },
  "New York/New Jersey": {
    name: "MetLife Stadium",
    address: "1 MetLife Stadium Drive, East Rutherford, NJ 07073",
  },
  Philadelphia: {
    name: "Lincoln Financial Field",
    address: "1020 Pattison Avenue, Philadelphia, PA 19148",
  },
  "San Francisco": {
    name: "Levi's Stadium",
    address: "4900 Marie P De Guadalupe Way, Santa Clara, CA 95054",
  },
  Seattle: {
    name: "Lumen Field",
    address: "800 Occidental Avenue S, Seattle, WA 98134",
  },
};

function getHostCityKey(location = {}) {
  return String(location.name || location.city || "").trim().replace(/\s+/g, " ");
}

function getWorksite(location = {}) {
  const hostCity = getHostCityKey(location);
  return hostCity ? WORKSITE_BY_HOST_CITY[hostCity] || null : null;
}

export function getWorksiteDisplay(location = {}) {
  const worksite = getWorksite(location);
  if (!worksite) return null;

  return `${worksite.name}, ${worksite.address}`;
}

export function getWorkAreaProximityQuestion(location = {}) {
  const worksite = getWorksite(location);
  const hostCity = getHostCityKey(location);

  if (worksite) {
    return `Do you already live close to ${worksite.name}, ${worksite.address}, or will you need accommodation?`;
  }

  const label = getRegionalAreaLabel(location);
  return `Do you already live close to the ${label}, or will you need accommodation?`;
}

export function getRegionalAreaLabel(location = {}) {
  const hostCity = getHostCityKey(location);
  const province = String(location.province || "").trim();

  if (hostCity && REGIONAL_AREA_BY_HOST_CITY[hostCity]) {
    return REGIONAL_AREA_BY_HOST_CITY[hostCity];
  }

  if (province) {
    return `${province} area`;
  }

  if (hostCity) {
    return `Greater ${hostCity} Area`;
  }

  return "local host city area";
}

export function getRegionalAreaQuestion(location = {}) {
  return `Are you currently based in the ${getRegionalAreaLabel(location)}?`;
}

function normalizePart(value) {
  return String(value || "").trim();
}

function normalizeKey(value) {
  return normalizePart(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function formatJobLocation(location = {}) {
  const hostCity = normalizePart(location.name);
  const worksite = getWorksite(location);

  if (worksite) {
    const display = `${worksite.name}, ${worksite.address}`;
    return hostCity ? `${display} (${hostCity} host city)` : display;
  }

  const city = normalizePart(location.city);
  const province = normalizePart(location.province);
  const postalCode = normalizePart(location.postal_code);

  let primary = "";

  if (city && province) {
    primary = postalCode ? `${city}, ${province} ${postalCode}` : `${city}, ${province}`;
  } else if (city) {
    primary = city;
  } else if (hostCity) {
    primary = hostCity;
  } else if (province) {
    primary = province;
  }

  if (hostCity && city && normalizeKey(hostCity) !== normalizeKey(city)) {
    return `${primary} (${hostCity} host city)`;
  }

  return primary || hostCity || "United States";
}

export function normalizeJob(posting) {
  const job = posting.job || {};
  const location = posting.location || {};
  const department = job.department || {};
  const entity = job.structure_custom_group_one || {};
  const pay = resolveJobPay(posting);

  return {
    id: posting.id,
    title: posting.title,
    url: posting.url,
    locationId: location.id || "",
    locationName: location.name || location.city || "",
    locationDisplay: formatJobLocation(location),
    locationCity: normalizePart(location.city),
    locationProvince: normalizePart(location.province),
    departmentId: department.id || "",
    departmentName: department.name || "",
    entityId: entity.id || "",
    entityName: entity.name || "",
    employmentType: posting.employment_type_text || posting.employment_type || "",
    payLabel: pay.payLabel,
    payDetail: pay.payDetail,
    payNote: pay.payNote,
    weeklyLabel: pay.weeklyLabel,
    contractLabel: pay.contractLabel,
    payDisclosed: pay.payDisclosed,
    isMatchDay: pay.isMatchDay,
  };
}
