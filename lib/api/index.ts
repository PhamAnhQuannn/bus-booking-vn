// api domain public API barrel (SYS20 rule 3).

export { listBookingsApi } from './bookingsClient';
export {
  listBusesApi,
  getBusApi,
  createBusApi,
  deactivateBusApi,
  patchCapacityApi,
  addMaintenanceApi,
  deleteMaintenanceApi,
  type MaintenanceWindow,
} from './busesClient';
export { createHoldRequest } from './holdsClient';
export { retryPayoutApi } from './reportsClient';
export {
  listRoutesApi,
  createRouteApi,
  patchRouteApi,
  deactivateRouteApi,
  getRoutePickupAreasApi,
  setRoutePickupAreasApi,
  type RouteItem,
} from './routesClient';
export {
  listPickupAreasApi,
  createPickupAreaApi,
  updatePickupAreaApi,
  deactivatePickupAreaApi,
  type PickupAreaItem,
} from './pickupAreasClient';
export {
  listStaffApi,
  createStaffApi,
  renameStaffApi,
  disableStaffApi,
  assignServiceApi,
} from './staffClient';
export {
  listTripsApi,
  createTripApi,
  cancelTripApi,
  salesToggleApi,
  departTripApi,
  completeTripApi,
  reassignBusApi,
  setTripPickupAreasApi,
  createTemplateApi,
  patchTemplateApi,
} from './tripsClient';
