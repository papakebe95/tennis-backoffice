export interface AppNotification {
  id: string;
  type: 'BOOKING' | 'TOURNAMENT' | 'MATCH' | 'MARKETPLACE' | 'SYSTEM';
  title: string;
  body: string;
  data: { route?: string } | null;
  read: boolean;
  createdAt: string;
}

export interface Announcement {
  id: string;
  audience: 'TOURNAMENT_ENTRANTS' | 'CLUB_MEMBERS' | 'FEDERATION_PLAYERS';
  title: string;
  body: string;
  recipientCount: number;
  createdAt: string;
  event: { id: string; name: string } | null;
  sentBy: { id: string; firstname: string; lastname: string } | null;
}

export type AnnouncementTarget =
  | { kind: 'tournament'; id: string }
  | { kind: 'club'; id: string }
  | { kind: 'federation'; id: string };

export type ColumnType = 'text' | 'number' | 'money' | 'percent' | 'date';

export interface Report {
  type: string;
  title: string;
  generatedAt: string;
  period: { from: string; to: string } | null;
  columns: { key: string; label: string; type: ColumnType }[];
  rows: Record<string, string | number | null>[];
  totals: Record<string, number> | null;
  chart: { label: string; type: ColumnType; points: { label: string; value: number }[] } | null;
}

export type ReportScope = 'club' | 'tournament' | 'federation';

export const REPORT_TYPES: Record<ReportScope, string[]> = {
  club: ['revenue', 'members', 'occupancy'],
  tournament: ['entries', 'results'],
  federation: ['clubs', 'players'],
};

export interface RankingRow {
  rank: number;
  userId: string;
  firstname: string;
  lastname: string;
  avatarUrl: string | null;
  gender: 'MALE' | 'FEMALE' | null;
  classification: string | null;
  clubs: string[];
  points: number;
  wins: number;
  losses: number;
  form: ('WIN' | 'LOSS')[];
}
