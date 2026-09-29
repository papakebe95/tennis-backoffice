// Shapes of the club membership, payment and booking API.
import type { UserStatus } from '../../core/auth/auth.models';
import type { AuditEntry } from '../admin/admin.models';

export type MemberStatus = 'ACTIVE' | 'SUSPENDED' | 'LEFT';
export type MembershipPaymentStatus = 'PAID' | 'PARTIALLY_PAID' | 'PENDING' | 'OVERDUE' | 'EXPIRED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
export type PaymentPurpose = 'MEMBERSHIP' | 'TOURNAMENT_ENTRY' | 'BOOKING' | 'COACHING' | 'OTHER';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';
export type Level = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';

export interface Plan {
  id: string;
  clubId: string;
  name: string;
  description: string | null;
  durationMonths: number;
  price: string;
  currency: string;
  active: boolean;
  _count?: { memberships: number };
}

export interface Period {
  id: string;
  startsAt: string;
  expiresAt: string;
  priceDue: string;
  currency: string;
  amountPaid: string;
  fullyPaid: boolean;
  plan: { id: string; name: string } | null;
}

export interface Payment {
  id: string;
  reference: string;
  purpose: PaymentPurpose;
  status: PaymentStatus;
  amount: string;
  currency: string;
  methodKey: string;
  externalReference: string | null;
  payerName: string | null;
  paidAt: string | null;
  notes: string | null;
  refundedAt: string | null;
  refundReason: string | null;
  createdAt: string;
  membershipId: string | null;
  bookingId: string | null;
  organization: { id: string; name: string };
  method: { key: string; label: string };
  payer: { id: string; firstname: string; lastname: string; msisdn: string } | null;
  recordedBy: { id: string; firstname: string; lastname: string } | null;
  booking: { id: string; startTime: string; court: { name: string } } | null;
}

export interface Member {
  id: string;
  membershipNumber: string;
  status: MemberStatus;
  statusReason: string | null;
  notes: string | null;
  joinedAt: string;
  user: {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
    msisdn: string;
    playerProfile: { level: Level; ntrpRating: number | null; avatarUrl: string | null } | null;
  };
  currentMembership: Period | null;
  paymentStatus: MembershipPaymentStatus | null;
  remainingDue: number;
}

export interface MemberDetail extends Member {
  clubId: string;
  periods: (Period & { paymentStatus: MembershipPaymentStatus; remainingDue: number; payments: Payment[] })[];
  bookings: { id: string; startTime: string; endTime: string; status: BookingStatus; price: string | null; paid: number; court: { name: string } }[];
  matches: {
    id: string;
    playedAt: string;
    matchType: string;
    status: string;
    winnerId: string | null;
    player2Name: string | null;
    club: { name: string } | null;
    player1: { id: string; firstname: string; lastname: string };
    player2: { id: string; firstname: string; lastname: string } | null;
    sets: { player1Games: number; player2Games: number }[];
  }[];
}

export interface Candidate {
  id: string;
  firstname: string;
  lastname: string;
  phone: string;
  alreadyMember: boolean;
  playerProfile: { level: Level; avatarUrl: string | null } | null;
}

export interface PaymentMethod {
  key: string;
  label: string;
}

export interface ClubBooking {
  id: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  price: string | null;
  lookingForPartner: boolean;
  cancelledAt: string | null;
  cancelReason: string | null;
  court: { id: string; name: string; number: number | null };
  user: { id: string; firstname: string; lastname: string; msisdn: string };
  paid: number;
  fullyPaid: boolean;
}

export interface ClubDashboard {
  club: { id: string; name: string };
  pendingActions: { key: string; count: number; route: string }[];
  members: { total: number; active: number; expired: number; graceDays: number };
  payments: { unpaidCount: number; outstanding: number; revenueThisMonth: number; currency: string };
  courts: { available: number; maintenance: number; disabled: number };
  bookings: {
    today: number;
    next7Days: number;
    todayList: { id: string; startTime: string; endTime: string; court: { name: string }; user: { firstname: string; lastname: string } }[];
  };
  tournaments: { upcoming: number; ongoing: number };
  series: { revenueByMonth: { month: string; amount: number }[]; newMembers: { week: string; count: number }[] };
  recentActivity: Pick<AuditEntry, 'id' | 'action' | 'entityType' | 'entityId' | 'createdAt' | 'actor'>[];
}

export interface FederationPlayer {
  id: string;
  firstname: string;
  lastname: string;
  msisdn: string;
  status: UserStatus;
  createdAt: string;
  playerProfile: { level: Level; ntrpRating: number | null; avatarUrl: string | null } | null;
  clubMemberships: { membershipNumber: string; joinedAt: string; club: { id: string; name: string }; currentMembership: { expiresAt: string } | null }[];
}
