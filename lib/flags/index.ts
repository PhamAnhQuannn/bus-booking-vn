/**
 * lib/flags — DB-backed feature-flag store + cached read helper (Issue 060).
 * See flags.ts module header for the resolution order, cache, and what is NOT
 * a feature flag (env `*_STUB` toggles, FeeConfig).
 */
export {
  getFlag,
  getFlagValue,
  setFlag,
  envKey,
  __clearFlagCache,
  FLAG_CACHE_TTL_MS,
  type FeatureFlagReader,
  type FeatureFlagWriter,
} from './flags';
export { FLAG_KEYS, type FlagKey } from './keys';
