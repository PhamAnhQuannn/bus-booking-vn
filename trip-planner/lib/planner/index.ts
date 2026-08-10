// Public barrel for the planner domain. Cross-domain callers (app/, components/) MUST import from
// here (`@/trip-planner/lib/planner`), never deep — SYS20 rule 3 (boundaries/entry-point).
// Intra-domain code keeps deep-importing its own modules.
export * from "./types";
export * from "./plan";
export * from "./fromParams";
export * from "./parseIntent";
export * from "./cities";
export * from "./itineraryDto";
export * from "./slots"; // máy trạng thái slot tất định (client-safe) — chip điền slot không cần Gemini
export { getStore, CityDataUnavailableError, fetchTile } from "./store"; // server-only: nạp KB + proxy tile R2 — caller await
