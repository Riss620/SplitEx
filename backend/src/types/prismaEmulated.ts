export enum Role {
  Admin = 'Admin',
  Member = 'Member',
}

export enum SplitType {
  EQUAL = 'EQUAL',
  EXACT = 'EXACT',
  PERCENTAGE = 'PERCENTAGE',
  WEIGHTED = 'WEIGHTED',
}

export enum SettlementStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  APPROVED = 'APPROVED',
}

export enum ImportStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum AnomalyAction {
  PENDING = 'PENDING',
  MERGED = 'MERGED',
  IGNORED = 'IGNORED',
  KEPT_BOTH = 'KEPT_BOTH',
  RESOLVED = 'RESOLVED',
}
