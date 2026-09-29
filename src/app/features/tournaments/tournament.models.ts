import type { OrganizationType } from '../../core/auth/auth.models';

export type TournamentStatus =
  | 'DRAFT'
  | 'REGISTRATION_OPEN'
  | 'REGISTRATION_CLOSED'
  | 'IN_PROGRESS'
  | 'INTERRUPTED'
  | 'COMPLETED'
  | 'CANCELLED';

export const TOURNAMENT_STATUSES: TournamentStatus[] = [
  'DRAFT',
  'REGISTRATION_OPEN',
  'REGISTRATION_CLOSED',
  'IN_PROGRESS',
  'INTERRUPTED',
  'COMPLETED',
  'CANCELLED',
];

export type Discipline = 'SINGLES' | 'DOUBLES';
export type EventGender = 'MEN' | 'WOMEN' | 'MIXED' | 'OPEN';
export type Format = 'SINGLE_ELIMINATION' | 'ROUND_ROBIN';
export type FinalSet = 'TIEBREAK' | 'SUPER_TIEBREAK' | 'ADVANTAGE';
export type DrawStatus = 'NOT_GENERATED' | 'DRAFT' | 'PUBLISHED' | 'LOCKED';
export type RegistrationStatus = 'PENDING' | 'APPROVED' | 'WAITLISTED' | 'REJECTED' | 'WITHDRAWN';
export type EntryType = 'DIRECT' | 'QUALIFIER' | 'LUCKY_LOSER' | 'ALTERNATE' | 'WILDCARD';
export type InterruptionReason = 'WEATHER' | 'COURT_ISSUE' | 'ORGANIZATIONAL' | 'EMERGENCY' | 'OTHER';
export type Surface = 'HARD' | 'CLAY' | 'GRASS' | 'INDOOR';
export type Gender = 'MALE' | 'FEMALE';

export const REGISTRATION_STATUSES: RegistrationStatus[] = ['PENDING', 'APPROVED', 'WAITLISTED', 'REJECTED', 'WITHDRAWN'];
export const ENTRY_TYPES: EntryType[] = ['DIRECT', 'QUALIFIER', 'LUCKY_LOSER', 'ALTERNATE', 'WILDCARD'];
export const INTERRUPTION_REASONS: InterruptionReason[] = ['WEATHER', 'COURT_ISSUE', 'ORGANIZATIONAL', 'EMERGENCY', 'OTHER'];

export type EligibilityIssue =
  | 'GENDER'
  | 'GENDER_UNKNOWN'
  | 'AGE_UNKNOWN'
  | 'TOO_YOUNG'
  | 'TOO_OLD'
  | 'CLASSIFICATION_TOO_STRONG'
  | 'CLASSIFICATION_TOO_WEAK'
  | 'MIXED_PAIR';

export type TransitionBlocker =
  | 'NOT_ALLOWED'
  | 'REASON_REQUIRED'
  | 'NO_EVENTS'
  | 'INVALID_DATES'
  | 'DRAWS_NOT_PUBLISHED'
  | 'MATCHES_UNFINISHED';

export interface TableIssue {
  code: 'TARGET_MISSING' | 'TARGET_NOT_HIGHER' | 'QUALIFIERS_WITHOUT_TARGET' | 'TARGET_WITHOUT_QUALIFIERS' | 'WINDOW_INVERTED';
  eventId: string;
}

export interface Classification {
  id: string;
  code: string;
  label: string;
  rank: number;
  series: string;
}

export interface Person {
  id: string;
  firstname: string;
  lastname: string;
}

export interface HostOrganization {
  id: string;
  name: string;
  type: OrganizationType;
}

export interface TournamentListItem {
  id: string;
  name: string;
  status: TournamentStatus;
  startDate: string;
  endDate: string;
  bannerUrl: string | null;
  location: string | null;
  visibility: 'PUBLIC' | 'PRIVATE';
  hostOrganization: HostOrganization | null;
  club: { id: string; name: string } | null;
  eventCount: number;
  entries: { approved: number; pending: number };
}

/** Rules and eligibility of one table, as edited in forms. */
export interface EventInput {
  name: string;
  discipline: Discipline;
  gender: EventGender;
  ageMin: number | null;
  ageMax: number | null;
  minClassificationId: string | null;
  maxClassificationId: string | null;
  format: Format;
  maxEntries: number | null;
  entryFee: number | null;
  seedCount: number;
  bestOf: number;
  gamesPerSet: number;
  finalSet: FinalSet;
  noAd: boolean;
  matchDurationMinutes: number;
  qualifiesIntoEventId: string | null;
  qualifierCount: number;
  tableOrder: number;
}

export type RegistrationCounts = Record<RegistrationStatus, number>;

export interface TournamentEvent extends Omit<EventInput, 'entryFee'> {
  id: string;
  competitionId: string;
  entryFee: string | null;
  drawStatus: DrawStatus;
  minClassification: { id: string; code: string; rank: number } | null;
  maxClassification: { id: string; code: string; rank: number } | null;
  qualifiesIntoEvent: { id: string; name: string } | null;
  entries: RegistrationCounts;
  qualifiersEntered: number;
}

export interface Interruption {
  id: string;
  reason: InterruptionReason;
  note: string | null;
  previousStatus: TournamentStatus;
  startedAt: string;
  resumedAt: string | null;
  startedBy: Person | null;
  resumedBy: Person | null;
  participantsNotified: boolean;
}

export interface TournamentDetail {
  id: string;
  name: string;
  status: TournamentStatus;
  description: string | null;
  category: string | null;
  bannerUrl: string | null;
  location: string | null;
  surface: Surface | null;
  visibility: 'PUBLIC' | 'PRIVATE';
  startDate: string;
  endDate: string;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  publishedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  currency: string;
  createdAt: string;
  hostOrganizationId: string | null;
  hostOrganization: HostOrganization | null;
  club: { id: string; name: string } | null;
  createdBy: Person | null;
  registrationOpenNow: boolean;
  editable: boolean;
  events: TournamentEvent[];
  transitions: { to: TournamentStatus; blockers: TransitionBlocker[] }[];
  interruption: Interruption | null;
  interruptions: Interruption[];
  stats: { entries: RegistrationCounts; players: number; staff: number };
  tableIssues: TableIssue[];
  activity: { id: string; action: string; entityType: string; createdAt: string; reason: string | null; actor: Person | null }[];
}

export interface TournamentInput {
  name?: string;
  clubId?: string | null;
  location?: string | null;
  startDate?: string;
  endDate?: string;
  registrationOpensAt?: string | null;
  registrationClosesAt?: string | null;
  surface?: Surface | null;
  description?: string | null;
  category?: string | null;
  visibility?: 'PUBLIC' | 'PRIVATE';
}

export interface NewTournamentInput extends TournamentInput {
  name: string;
  startDate: string;
  endDate: string;
  hostOrganizationId: string | null;
  events: (Partial<EventInput> & { name: string; ref?: string; qualifiesIntoRef?: string })[];
}

export interface HostOptions {
  independent: boolean;
  organizations: (HostOrganization & { clubId: string | null })[];
}

export interface EntryPlayer {
  id: string;
  firstname: string;
  lastname: string;
  phone: string;
  avatarUrl: string | null;
  gender: Gender | null;
  age: number | null;
  classification: { id: string; code: string } | null;
}

export interface Registration {
  id: string;
  eventId: string;
  status: RegistrationStatus;
  entryType: EntryType;
  seed: number | null;
  registeredAt: string;
  decidedAt: string | null;
  rejectionReason: string | null;
  eligibility: { issues: EligibilityIssue[]; override: string | null } | null;
  decidedBy: Person | null;
  sourceEvent: { id: string; name: string } | null;
  player: EntryPlayer;
  partner: EntryPlayer | null;
  issues: EligibilityIssue[];
}

export interface RegistrationPage {
  items: Registration[];
  total: number;
  page: number;
  pageSize: number;
  counts: RegistrationCounts;
  capacity: number | null;
}

export interface EntryCandidate extends EntryPlayer {
  alreadyEntered: boolean;
  issues: EligibilityIssue[];
}

export interface StaffGrant {
  id: string;
  grantedAt: string;
  role: { id: string; key: string; name: string };
  user: { id: string; firstname: string; lastname: string; email: string; status: string; playerProfile: { avatarUrl: string | null } | null };
  grantedBy: Person | null;
}

export interface StaffView {
  grants: StaffGrant[];
  roles: { id: string; key: string; name: string; description: string }[];
}

export type Decision = 'approve' | 'reject' | 'waitlist' | 'withdraw';

/** Which decisions apply to an entry in each status (mirrors the API). */
export const DECISIONS_FROM: Record<Decision, RegistrationStatus[]> = {
  approve: ['PENDING', 'WAITLISTED'],
  reject: ['PENDING', 'WAITLISTED'],
  waitlist: ['PENDING', 'APPROVED'],
  withdraw: ['PENDING', 'APPROVED', 'WAITLISTED'],
};

/** Entries can change until play starts (mirrors the API). */
export const entriesOpen = (status: TournamentStatus) =>
  status === 'DRAFT' || status === 'REGISTRATION_OPEN' || status === 'REGISTRATION_CLOSED';

export const DEFAULT_EVENT: EventInput = {
  name: '',
  discipline: 'SINGLES',
  gender: 'OPEN',
  ageMin: null,
  ageMax: null,
  minClassificationId: null,
  maxClassificationId: null,
  format: 'SINGLE_ELIMINATION',
  maxEntries: 32,
  entryFee: null,
  seedCount: 0,
  bestOf: 3,
  gamesPerSet: 6,
  finalSet: 'TIEBREAK',
  noAd: false,
  matchDurationMinutes: 90,
  qualifiesIntoEventId: null,
  qualifierCount: 0,
  tableOrder: 0,
};

// Draw -------------------------------------------------------------------

export type SlotKind = 'ENTRY' | 'BYE' | 'QUALIFIER' | 'EMPTY';
export type MatchStatus = 'PENDING' | 'READY' | 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'BYE' | 'POSTPONED';

export interface DrawEntry {
  id: string;
  seed: number | null;
  entryType: EntryType;
  status: RegistrationStatus;
  sourceEvent: { id: string; name: string } | null;
  player: { id: string; firstname: string; lastname: string; avatarUrl: string | null; classification: string | null };
  partner: { id: string; firstname: string; lastname: string; classification: string | null } | null;
}

export interface DrawSlot {
  id: string;
  position: number;
  kind: SlotKind;
  participantId: string | null;
  label: string | null;
  sourceEvent: { id: string; name: string } | null;
  filledAt: string | null;
}

export interface DrawMatch {
  id: string;
  position: number;
  status: MatchStatus;
  participant1Id: string | null;
  participant2Id: string | null;
  winnerId: string | null;
  nextMatchId: string | null;
  nextSlot: number | null;
  scheduledAt: string | null;
}

export interface DrawRound {
  id: string;
  name: string;
  orderIndex: number;
  matches: DrawMatch[];
}

export interface DrawView {
  event: {
    id: string;
    name: string;
    competitionId: string;
    format: Format;
    discipline: Discipline;
    seedCount: number;
    drawStatus: DrawStatus;
    drawSize: number | null;
    drawSeed: string | null;
    drawVersion: number;
    drawGeneratedAt: string | null;
    drawPublishedAt: string | null;
    drawLockedAt: string | null;
  };
  competition: { id: string; name: string; status: TournamentStatus; startDate: string; hostOrganizationId: string | null };
  feeders: { id: string; name: string; qualifierCount: number }[];
  slots: DrawSlot[];
  rounds: DrawRound[];
  entries: Record<string, DrawEntry>;
  unplacedCount: number;
  suggestion: { entries: number; qualifierPlaces: number; seedCount: number; size: number | null };
}

export interface LowerTablePlayer extends DrawEntry {
  roundReached: number | null;
  champion: boolean;
  alreadyInEvent: boolean;
}

export interface DrawCandidates {
  unplaced: DrawEntry[];
  lowerTables: { event: { id: string; name: string; qualifierCount: number }; rounds: number | null; players: LowerTablePlayer[] }[];
}

export interface DrawEntrant {
  participantId?: string;
  userId?: string;
  entryType?: EntryType;
  sourceEventId?: string;
  reason?: string;
  overrideReason?: string;
  version?: number;
}

/** "Final", "Semi-finals"… for round `round` of `rounds` (i18n key + params). */
export function roundLabel(round: number, rounds: number): { key: string; params?: Record<string, number> } {
  const remaining = rounds - round;
  if (remaining === 0) return { key: 'tournaments.draw.rounds.final' };
  if (remaining === 1) return { key: 'tournaments.draw.rounds.semi' };
  if (remaining === 2) return { key: 'tournaments.draw.rounds.quarter' };
  // English counts players ("Round of 16"), French counts matches ("8es de finale").
  const players = 2 ** (remaining + 1);
  return { key: 'tournaments.draw.rounds.roundOf', params: { count: players, matches: players / 2 } };
}

// Matches ------------------------------------------------------------------

export type MatchOutcome = 'PLAYED' | 'RETIRED' | 'WALKOVER';
export type ResultStatus = 'NONE' | 'ENTERED' | 'VALIDATED' | 'DISPUTED';
export const MATCH_STATUSES: MatchStatus[] = ['PENDING', 'READY', 'SCHEDULED', 'LIVE', 'COMPLETED', 'POSTPONED'];

export interface MatchSide {
  id: string;
  seed: number | null;
  entryType: EntryType;
  player: { id: string; firstname: string; lastname: string; avatarUrl: string | null; classification: string | null };
  partner: { id: string; firstname: string; lastname: string } | null;
}

export interface MatchSetRow {
  setNumber: number;
  side1Games: number;
  side2Games: number;
  tiebreak1: number | null;
  tiebreak2: number | null;
  isSuperTiebreak: boolean;
}

export interface TournamentMatch {
  id: string;
  position: number;
  status: MatchStatus;
  outcome: MatchOutcome | null;
  resultStatus: ResultStatus;
  loserSide: 1 | 2 | null;
  scheduledAt: string | null;
  estimatedEndAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  version: number;
  notes: string | null;
  disputeReason: string | null;
  nextMatchId: string | null;
  winnerSide: 1 | 2 | null;
  side1: MatchSide | null;
  side2: MatchSide | null;
  sets: MatchSetRow[];
  score: string;
  court: { id: string; name: string; number: number | null; club: { id: string; name: string } } | null;
  official: { id: string; firstname: string; lastname: string } | null;
  round: { number: number; name: string; rounds: number | null };
  event: { id: string; name: string; discipline: Discipline; bestOf: number; gamesPerSet: number; finalSet: FinalSet; noAd: boolean; matchDurationMinutes: number };
  competition: { id: string; name: string; status: TournamentStatus; hostOrganizationId: string | null };
}

export interface MatchDetail extends TournamentMatch {
  activity: { id: string; action: string; createdAt: string; reason: string | null; actor: { id: string; firstname: string; lastname: string } | null }[];
  placeholders: { position: number; kind: SlotKind; label: string | null }[];
}

export interface ScheduleConflict {
  type: 'COURT' | 'BOOKING' | 'PLAYER' | 'HOURS';
  label: string;
  start: string;
  end: string;
}

export interface ScheduleCourt {
  id: string;
  name: string;
  number: number | null;
  status: string;
  surface: string;
  lighting: boolean;
  club: { id: string; name: string };
  windows: { opensAt: string; closesAt: string }[];
}

export interface ScheduleDay {
  competition: { id: string; name: string };
  date: string;
  days: string[];
  courts: ScheduleCourt[];
  matches: TournamentMatch[];
  otherMatches: { courtId: string; start: string; end: string; label: string }[];
  bookings: { id: string; courtId: string; start: string; end: string; label: string }[];
  unscheduled: TournamentMatch[];
}

export interface CourtOptions {
  usesVenueDefault: boolean;
  courts: { id: string; name: string; number: number | null; status: string; surface: string; club: { id: string; name: string }; chosen: boolean }[];
}

export interface MatchResultInput {
  outcome: MatchOutcome;
  sets: { side1: number; side2: number; tiebreak1?: number | null; tiebreak2?: number | null; superTiebreak?: boolean }[];
  loserSide?: 1 | 2;
  notes?: string;
  reason?: string;
  version: number;
}

/** "Babacar Sy", or "Sy / Ndiaye" for a pair. */
export const sideName = (s: MatchSide | null) =>
  !s ? '' : s.partner ? `${s.player.lastname} / ${s.partner.lastname}` : `${s.player.firstname} ${s.player.lastname}`;
