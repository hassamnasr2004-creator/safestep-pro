export type EditionId = 'batman' | 'spiderman' | 'space' | 'ice';

export type AlertType =
  | 'DISTANCE_BREACH'
  | 'EXIT_GATE_ALERT'
  | 'LEFT_BEHIND_ALERT'
  | 'TAMPER_LOCK_ALERT';

export type AlertSeverity = 'warning' | 'critical';

export interface Point {
  x: number;
  y: number;
}

export interface ActiveAlert {
  type: AlertType;
  title: string;
  message: string;
  severity: AlertSeverity;
  triggeredAt: number;
  gateName?: string;
  zoneName?: string;
}

export interface BandSession {
  bandId: string;
  childName: string;
  editionId: EditionId;
  returnPin: string;
  status: 'active' | 'ended';
  issuedAt: number;
  endedAt?: number;
  safeRadius: number; // meters (10 - 35)
  battery: number; // 0 - 100
  claspLocked: boolean;
  tamperActive: boolean;
  leftBehindActive: boolean;
  parentPos: Point;
  childPos: Point;
  trail: Point[];
  stepCount: number;
  currentZone: string;
  distanceMeters: number;
  nearestGateName: string | null;
  nearestGateMeters: number;
  activeAlerts: ActiveAlert[];
  lastAlertTimestamp: number;
  lastRecoveredAt: number;
  recoveredMessage: string;
  updatedAt: number;
  mallName: string;
}

export interface SafeStepStore {
  bands: Record<string, BandSession>;
  activeBandId: string | null;
  nextSerial: number;
  mallName: string;
  publicBaseUrl: string;
}

export type MainTab = 'booth' | 'phone' | 'qr' | 'jury';

export type ScenarioId =
  | 'safe_walk_kids'
  | 'breach_radius'
  | 'return_to_parent'
  | 'approach_exit'
  | 'left_behind'
  | 'tamper_attempt';

export type SyncStatus = 'connecting' | 'connected' | 'reconnecting';
