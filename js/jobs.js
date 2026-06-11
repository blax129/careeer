import {
  ACCOMMODATION_LABEL,
  isVisibleJob,
  normalizeJob,
} from "./job-filters.js";
import { fetchPostings } from "./fetch-postings.js";
import { initFooter } from "./footer.js";
import {
  getRemainingSlots,
  loadFilledCounts,
  onSlotsUpdated,
  renderSlotsMarkup,
} from "./position-slots.js";

const ENTITY_LOGOS = {
  "FIFA Museum":
    "https://res.cloudinary.com/infuse-group/image/upload/v1705943002/FIFA/4df0bcc1c885f817eeaeb39eca18e3d7.png",
  "Mauritius Football Association":
    "https://res.cloudinary.com/infuse-group/image/upload/v1745315941/FIFA/Mauritius_FA.png",
  FIFA: "https://res.cloudinary.com/infuse-group/image/upload/v1705943002/FIFA/7b7a1a4ba5fcd89f495b18793cd9c211.png",
  "FIFA World Cup 2026":
    "https://res.cloudinary.com/infuse-group/image/upload/v1705952843/FIFA/Rectangle_1823_1.png",
  "Royal Belgian Football Association":
    "https://res.cloudinary.com/infuse-group/image/upload/v1714376559/FIFA/logo_1.png",
  CAF: "https://res.cloudinary.com/infuse-group/image/upload/v1712170417/FIFA/Inside_CAF.png",
  "Zimbabwe Football Association":
    "https://res.cloudinary.com/infuse-group/image/upload/v1761681682/Untitled_1_ef2e83.png",
  "Oceania Football Confederation":
    "https://res.cloudinary.com/pinpointhq/image/upload/v1725371064/misc/lxsuxzndw2pjtuluqq7l.png",
  "Fédération Malagasy de Football":
    "https://res.cloudinary.com/infuse-group/image/upload/v1732186278/image_243_kh80jc.png",
  "FIFA Women's World Cup 2027":
    "https://res.cloudinary.com/infuse-group/image/upload/v1772442227/FIFA/fifa-women-logo.png",
  "Guyana Football Federation":
    "https://res.cloudinary.com/infuse-group/image/upload/v1738322905/FIFA/Guyana_Logo.png",
  "Dominican Republic Football Association":
    "https://res.cloudinary.com/infuse-group/image/upload/v1760552138/LOGOS_DE_LA_FEDERACIO%CC%81N_EN_ALTA-04_1_1_fe3vyh.png",
  "Turks & Caicos Islands Football Association":
    "https://res.cloudinary.com/infuse-group/image/upload/v1763467515/FIFA/turks-caicos-fa.png",
  "The Fédération Rwandaise de Football Association (FERWAFA)":
    "https://res.cloudinary.com/infuse-group/image/upload/v1768906834/FIFA/file.png",
  "Football Australia":
    "https://res.cloudinary.com/infuse-group/image/upload/v1776337606/FIFA/image_248_1.png",
};

const state = {
  allJobs: [],
  filteredJobs: [],
  search: "",
  entity: "",
  location: "",
  department: "",
};

const elements = {
  jobsList: document.getElementById("jobs-list"),
  search: document.getElementById("jobs-search"),
  entityFilter: document.getElementById("filter-entity"),
  locationFilter: document.getElementById("filter-location"),
  departmentFilter: document.getElementById("filter-department"),
};

function populateFilter(select, items, allLabel) {
  if (!select) return;

  const sorted = [...items].sort((a, b) => a.label.localeCompare(b.label));
  select.innerHTML = `<option value="">${allLabel}</option>`;

  for (const item of sorted) {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    select.appendChild(option);
  }
}

function buildFilterOptions(jobs) {
  const entities = new Map();
  const locations = new Map();
  const departments = new Map();

  for (const job of jobs) {
    if (job.entityId && job.entityName) {
      entities.set(job.entityId, job.entityName);
    }
    if (job.locationId && job.locationName) {
      locations.set(job.locationId, job.locationName);
    }
    if (job.departmentId && job.departmentName) {
      departments.set(job.departmentId, job.departmentName);
    }
  }

  populateFilter(
    elements.entityFilter,
    [...entities.entries()].map(([value, label]) => ({ value, label })),
    "All Entities",
  );
  populateFilter(
    elements.locationFilter,
    [...locations.entries()].map(([value, label]) => ({ value, label })),
    "All Locations",
  );
  populateFilter(
    elements.departmentFilter,
    [...departments.entries()].map(([value, label]) => ({ value, label })),
    "All Departments",
  );
}

function renderEntityLogo(entityName) {
  const logoUrl = ENTITY_LOGOS[entityName];

  if (logoUrl) {
    return `<img class="job-card__logo-image" src="${escapeAttr(logoUrl)}" alt="" loading="lazy">`;
  }

  return `<span class="job-card__logo-fallback" aria-hidden="true">${escapeHtml(entityName.slice(0, 1))}</span>`;
}

function citySlug(cityName) {
  return cityName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function groupJobsByCity(jobs) {
  const groups = new Map();

  for (const job of jobs) {
    const city = job.locationName.trim();
    if (!groups.has(city)) {
      groups.set(city, []);
    }
    groups.get(city).push(job);
  }

  return [...groups.entries()]
    .sort(([cityA], [cityB]) => cityA.localeCompare(cityB))
    .map(([city, cityJobs]) => ({
      city,
      slug: citySlug(city),
      jobs: cityJobs.sort((a, b) => a.title.localeCompare(b.title)),
    }));
}

function renderJobCard(job) {
  return `
    <a class="job-card" href="./job.html?id=${encodeURIComponent(job.id)}">
      <div class="job-card__logo">${renderEntityLogo(job.entityName)}</div>
      <div class="job-card__content">
        <h3 class="job-card__title">${escapeHtml(job.title)}</h3>
        <p class="job-card__location">${escapeHtml(job.locationDisplay)}</p>
        <p class="job-card__accommodation">${escapeHtml(ACCOMMODATION_LABEL)}</p>
        <p class="job-card__contract">${escapeHtml(job.contractLabel)}</p>
        ${renderSlotsMarkup(job.slotsRemaining ?? getRemainingSlots(job.id))}
        <p class="job-card__pay">${escapeHtml(job.payLabel)}</p>
        <p class="job-card__pay-detail">${escapeHtml(job.payDetail)}</p>
      </div>
    </a>
  `;
}

function applyFilters() {
  const query = state.search.trim().toLowerCase();

  state.filteredJobs = state.allJobs.filter((job) => {
    if (state.entity && job.entityId !== state.entity) return false;
    if (state.location && job.locationId !== state.location) return false;
    if (state.department && job.departmentId !== state.department) return false;

    if (!query) return true;

    const haystack = [
      job.title,
      job.entityName,
      job.locationName,
      job.locationDisplay,
      job.locationCity,
      job.locationProvince,
      job.departmentName,
      job.employmentType,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });

  renderJobs();
}

function renderJobs() {
  if (!elements.jobsList) return;

  const cityGroups = groupJobsByCity(state.filteredJobs);

  if (cityGroups.length === 0) {
    elements.jobsList.innerHTML =
      '<p class="jobs-empty">There are currently no opportunities based on your filters. Please try again, or register your interest.</p>';
    return;
  }

  const cityNav = cityGroups
    .map(
      ({ city, slug, jobs }) => `
        <a class="jobs-city-nav__link" href="#city-${escapeAttr(slug)}">
          <span class="jobs-city-nav__city">${escapeHtml(city)}</span>
          <span class="jobs-city-nav__count">${jobs.length} position${jobs.length === 1 ? "" : "s"}</span>
        </a>
      `,
    )
    .join("");

  const citySections = cityGroups
    .map(
      ({ city, slug, jobs }) => `
        <section class="jobs-city-section" id="city-${escapeAttr(slug)}" aria-labelledby="city-heading-${escapeAttr(slug)}">
          <div class="jobs-city-section__header">
            <h2 class="jobs-city-section__title" id="city-heading-${escapeAttr(slug)}">${escapeHtml(city)}</h2>
            <p class="jobs-city-section__count">${jobs.length} position${jobs.length === 1 ? "" : "s"}</p>
          </div>
          <div class="jobs-city-section__list">
            ${jobs.map((job) => renderJobCard(job)).join("")}
          </div>
        </section>
      `,
    )
    .join("");

  elements.jobsList.innerHTML = `
    <div class="jobs-city-nav-wrap">
      <div class="jobs-city-nav__intro">
        <h2 class="jobs-city-nav__title">Browse by city</h2>
        <p class="jobs-city-nav__hint">Select a host city to view available roles.</p>
      </div>
      <nav class="jobs-city-nav" aria-label="Browse positions by city">${cityNav}</nav>
    </div>
    <div class="jobs-by-city">${citySections}</div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function refreshJobSlotCounts() {
  state.allJobs = state.allJobs.map((job) => ({
    ...job,
    slotsRemaining: getRemainingSlots(job.id),
  }));
  applyFilters();
}

async function loadJobs() {
  if (!elements.jobsList) return;

  try {
    await loadFilledCounts();
    const payload = await fetchPostings();
    state.allJobs = payload.data.map(normalizeJob).filter(isVisibleJob).map((job) => ({
      ...job,
      slotsRemaining: getRemainingSlots(job.id),
    }));
    buildFilterOptions(state.allJobs);
    applyFilters();
    onSlotsUpdated(() => refreshJobSlotCounts());
  } catch (error) {
    elements.jobsList.innerHTML =
      '<p class="jobs-empty">Unable to load positions. Please try again later.</p>';
    console.error(error);
  }
}

function initJobsControls() {
  elements.search?.addEventListener("input", (event) => {
    state.search = event.target.value;
    applyFilters();
  });

  elements.entityFilter?.addEventListener("change", (event) => {
    state.entity = event.target.value;
    applyFilters();
  });

  elements.locationFilter?.addEventListener("change", (event) => {
    state.location = event.target.value;
    applyFilters();
  });

  elements.departmentFilter?.addEventListener("change", (event) => {
    state.department = event.target.value;
    applyFilters();
  });
}

initJobsControls();
initFooter();
loadJobs();
