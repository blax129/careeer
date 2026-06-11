/**
 * Maps job posting titles to partner Apps Script role keys (must match exactly).
 * Used when queueing the delayed payment email ~4 hours after apply.
 */

const ROLE_RULES = [
  { key: "catering_coordinator", pattern: /catering coordinator/i },
  { key: "fan_ops_venue", pattern: /fifa fan operations venue coordinator/i },
  { key: "fan_ops_gate", pattern: /fifa fan operations gate supervisor/i },
  { key: "fb_coordinator", pattern: /food\s*&\s*beverage coordinator/i },
  { key: "guest_ops_outer", pattern: /guest operations outer area coordinator/i },
  { key: "security_exterior", pattern: /manager,\s*stadium exterior security/i },
  { key: "crowd_management", pattern: /specialist,\s*stadium crowd management/i },
  { key: "hospitality_security", pattern: /specialist,\s*stadium hospitality security/i },
  { key: "pitch_security", pattern: /specialist,\s*stadium pitch/i },
  { key: "psa_vsa", pattern: /specialist,\s*stadium psa\/vsa/i },
  { key: "team_services_venue", pattern: /team services venue officer/i },
  { key: "vip_lounge_mgr", pattern: /vip lounge manager/i },
  { key: "vip_hotel_mgr", pattern: /v\.?\s*i\.?\s*p\.?\s*hotel manager/i },
  { key: "deputy_workforce_mgr", pattern: /deputy workforce manager/i },
  { key: "youth_coordinator", pattern: /youth program coordinator/i },
  { key: "team_hotel_coord", pattern: /team hotel coordinator/i },
  { key: "commercial_fan_exp", pattern: /commercial stadium fan experience management/i },
  { key: "guest_relations", pattern: /guest relations/i },
  { key: "airport_supervisor", pattern: /airport supervisor/i },
  { key: "medical_care_navigator", pattern: /medical care navigator/i },
  { key: "live_stream_tech", pattern: /live\s*&\s*vod stream operations technician/i },
  { key: "warehouse_mgr", pattern: /manager,\s*warehouse/i },
  { key: "venue_hotel_mgr", pattern: /venue hotel manager/i },
  { key: "venue_ops_mgr", pattern: /venue operations manager/i },
  { key: "commercial_ops_specialist", pattern: /specialist,\s*commercial operations/i },
  {
    key: "biz_ops_finance",
    pattern: /specialist,\s*business operations(?:\s*-\s*|\s+)finance/i,
  },
  { key: "tournament_ops", pattern: /tournament operations event roles/i },
];

const DEFAULT_ROLE_KEY = "tournament_ops";

export function getRoleKeyFromTitle(title) {
  const normalized = String(title || "").trim();

  for (const rule of ROLE_RULES) {
    if (rule.pattern.test(normalized)) {
      return rule.key;
    }
  }

  return DEFAULT_ROLE_KEY;
}

export function getRoleKey(posting) {
  return getRoleKeyFromTitle(posting?.title);
}
