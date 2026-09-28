// Shapes returned by /admin/organizations, /admin/federations, /admin/clubs
// and /admin/courts (see tennis-backend/src/admin/organizations).
import type { OrganizationType, UserStatus } from '../../core/auth/auth.models';

export type OrganizationStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
export type AffiliationStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'ENDED';
export type CourtStatus = 'AVAILABLE' | 'MAINTENANCE' | 'DISABLED';
export type Surface = 'HARD' | 'CLAY' | 'GRASS' | 'INDOOR';
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** { mon: ["07:00-22:00"], …, sun: [] } — empty day = closed. */
export type WeeklyHours = Record<Weekday, string[]>;

export interface SocialLinks {
  facebook?: string | null;
  instagram?: string | null;
  x?: string | null;
  youtube?: string | null;
  tiktok?: string | null;
  whatsapp?: string | null;
}

export interface OrganizationListItem {
  id: string;
  type: OrganizationType;
  name: string;
  status: OrganizationStatus;
  logoUrl: string | null;
  createdAt: string;
  club: { id: string; city: string; courts: number } | null;
  federations: { id: string; name: string; status: AffiliationStatus }[];
  administrators: number;
  affiliatedClubs: number;
}

export interface Affiliation {
  id: string;
  status: AffiliationStatus;
  requestedAt: string;
  validatedAt: string | null;
  endedAt?: string | null;
  reason: string | null;
}

export interface OrganizationDetail {
  id: string;
  type: OrganizationType;
  name: string;
  slug: string;
  status: OrganizationStatus;
  logoUrl: string | null;
  description: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  socialLinks: SocialLinks | null;
  countryId: string | null;
  country: { id: string; name: string } | null;
  createdAt: string;
  club: { id: string; city: { id: string; name: string }; courts: number; bookings: number } | null;
  memberships: (Affiliation & { parent: { id: string; name: string; type: OrganizationType } })[];
  administrators: {
    id: string;
    grantedAt: string;
    role: { key: string; name: string };
    user: { id: string; firstname: string; lastname: string; msisdn: string; status: UserStatus };
  }[];
  affiliatedClubs: number;
}

export interface AffiliatedClub extends Affiliation {
  club: {
    id: string;
    name: string;
    status: OrganizationStatus;
    logoUrl: string | null;
    email: string | null;
    phone: string | null;
    clubId: string | null;
    city: string | null;
    courts: number;
  };
}

export interface ClubProfile {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  photos: string[];
  address: string;
  cityId: string;
  city: string;
  countryId: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  socialLinks: SocialLinks | null;
  openingHours: WeeklyHours | null;
  amenities: string[];
  status: OrganizationStatus;
  affiliations: (Affiliation & { parent: { id: string; name: string; logoUrl: string | null } })[];
  courtsCount: number;
}

export interface CourtWindow {
  weekday: number;
  opensAt: string;
  closesAt: string;
}

export interface Court {
  id: string;
  name: string;
  number: number | null;
  surface: Surface;
  indoor: boolean;
  lighting: boolean;
  status: CourtStatus;
  archivedAt: string | null;
  pricePerHour: string | null;
  photos: string[];
  createdAt: string;
  availability: CourtWindow[];
  upcomingBookings?: number;
  affectedBookings?: number;
}
