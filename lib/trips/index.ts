// trips domain public API barrel (SYS20 rule 3).

// generateFromTemplate.ts (cron worker entrypoint)
export { generateTripsFromTemplates } from './generateFromTemplate';

// cancelTrip.ts
export { cancelTrip } from './cancelTrip';

// completeTripCore.ts
export { completeTripCore } from './completeTripCore';

// createTrip.ts
export { createTrip } from './createTrip';

// errors.ts
export { TripServiceError } from './errors';

// generateFromTemplate.ts
export { createTemplate, getTemplate, listTemplates, patchTemplate } from './generateFromTemplate';

// getTrip.ts
export { getTrip, listTrips } from './getTrip';

// getTripDetails.ts
export { getTripDetails } from './getTripDetails';

// listUpcomingForOperator.ts
export { listUpcomingForOperator, ListUpcomingParamsSchema } from './listUpcomingForOperator';

// markCompleted.ts
export { markCompleted } from './markCompleted';

// markDeparted.ts
export { markDeparted } from './markDeparted';

// reassignBus.ts
export { reassignBus } from './reassignBus';

// salesToggle.ts
export { salesToggle } from './salesToggle';

// setTripPickupAreas.ts
export { setTripPickupAreas, type TripPickupAreaItem } from './setTripPickupAreas';

// searchTrips.ts
export { searchTrips, SEARCH_PAGE_LIMIT } from './searchTrips';
export type { TripResult } from './searchTrips';

// toTripDto.ts
export { toTripDto } from './toTripDto';

// tripDto.ts
export type { TripDto, TemplateDto } from './tripDto';

// tripRef.ts
export { tripRef } from './tripRef';
