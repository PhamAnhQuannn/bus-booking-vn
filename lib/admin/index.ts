// admin domain public API barrel (SYS20 rule 3).

export { AdminServiceError } from './errors';
export {
  createOperatorAccount,
  type CreateOperatorAccountInput,
  type CreateOperatorAccountResult,
} from './createOperatorAccount';
export { getActionQueue } from './getActionQueue';
export { getApprovalQueue, type ApprovalQueueOperator } from './getApprovalQueue';
export { getAuditLog, auditLogToCsv, type AuditLogRow } from './getAuditLog';
export {
  getCharterDispatchQueue,
  getApprovedOperatorsForAssign,
  type CharterDispatchItem,
} from './getCharterDispatchQueue';
export { getFailureAlerts } from './getFailureAlerts';
export { getLedgerView } from './getLedgerView';
export { getOpenReports, getModeratedItems } from './getModerationQueue';
export { getOperatorDetail } from './getOperatorDetail';
export { getPayoutQueue, type PayoutQueueRow } from './getPayoutQueue';
export { getCustomerDetail } from './getUserDetail';
export { inviteAdmin } from './inviteAdmin';
export { listAdmins, type AdminRow } from './listAdmins';
export { listAllOperators } from './listAllOperators';
export { resolveReport, setRouteModeration, setTripModeration } from './moderation';
export { resetAdminTotp } from './resetAdminTotp';
export { revokeAdmin } from './revokeAdmin';
export { searchUsers, type UserKind, type UserStatus } from './searchUsers';
export { setAdminRole } from './setAdminRole';
export { suspendCustomer, reinstateCustomer } from './suspendCustomer';
