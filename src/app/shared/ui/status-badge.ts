import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';

export type Tone = 'success' | 'info' | 'warning' | 'danger' | 'neutral' | 'accent';

/**
 * One table for every status enum in the app: its label key prefix and the
 * tone of each value. New enums are added here, never styled ad hoc.
 */
const STATUS_KINDS = {
  user: {
    labels: 'status.user',
    tones: { PENDING: 'warning', ACTIVE: 'success', SUSPENDED: 'danger', DISABLED: 'neutral', REJECTED: 'danger' },
  },
  organization: {
    labels: 'status.organization',
    tones: { PENDING: 'warning', ACTIVE: 'success', SUSPENDED: 'danger', ARCHIVED: 'neutral' },
  },
  affiliation: {
    labels: 'status.affiliation',
    tones: { PENDING: 'warning', ACTIVE: 'success', SUSPENDED: 'danger', ENDED: 'neutral' },
  },
  court: {
    labels: 'status.court',
    tones: { AVAILABLE: 'success', MAINTENANCE: 'warning', DISABLED: 'neutral' },
  },
  member: {
    labels: 'status.member',
    tones: { ACTIVE: 'success', SUSPENDED: 'danger', LEFT: 'neutral' },
  },
  membershipPayment: {
    labels: 'status.membershipPayment',
    tones: { PAID: 'success', PARTIALLY_PAID: 'info', PENDING: 'warning', OVERDUE: 'danger', EXPIRED: 'neutral' },
  },
  payment: {
    labels: 'status.payment',
    tones: { PENDING: 'warning', PAID: 'success', FAILED: 'danger', REFUNDED: 'accent', CANCELLED: 'neutral' },
  },
  booking: {
    labels: 'status.booking',
    tones: { PENDING: 'warning', CONFIRMED: 'success', CANCELLED: 'neutral' },
  },
  match: {
    labels: 'status.match',
    tones: { PENDING: 'neutral', READY: 'info', SCHEDULED: 'accent', LIVE: 'warning', COMPLETED: 'success', BYE: 'neutral', POSTPONED: 'danger' },
  },
  result: {
    labels: 'status.result',
    tones: { NONE: 'neutral', ENTERED: 'warning', VALIDATED: 'success', DISPUTED: 'danger' },
  },
  tournament: {
    labels: 'status.tournament',
    tones: {
      DRAFT: 'neutral',
      REGISTRATION_OPEN: 'success',
      REGISTRATION_CLOSED: 'info',
      IN_PROGRESS: 'accent',
      INTERRUPTED: 'warning',
      COMPLETED: 'neutral',
      CANCELLED: 'danger',
    },
  },
  registration: {
    labels: 'status.registration',
    tones: { PENDING: 'warning', APPROVED: 'success', WAITLISTED: 'info', REJECTED: 'danger', WITHDRAWN: 'neutral' },
  },
  draw: {
    labels: 'status.draw',
    tones: { NOT_GENERATED: 'neutral', DRAFT: 'warning', PUBLISHED: 'success', LOCKED: 'accent' },
  },
  accessRequest: {
    labels: 'status.accessRequest',
    tones: { PENDING: 'warning', INFO_REQUESTED: 'info', APPROVED: 'success', REJECTED: 'danger', CANCELLED: 'neutral' },
  },
} satisfies Record<string, { labels: string; tones: Record<string, Tone> }>;

export type StatusKind = keyof typeof STATUS_KINDS;

@Component({
  selector: 'tb-status-badge',
  template: `<span class="badge" [attr.data-tone]="tone()">{{ label() }}</span>`,
  styles: `
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 2px 10px;
      border-radius: var(--tb-radius-full);
      font-size: var(--tb-text-xs);
      font-weight: var(--tb-weight-semibold);
      white-space: nowrap;
    }
    .badge::before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }
    [data-tone='success'] { color: var(--tb-tone-success-fg); background: var(--tb-tone-success-bg); }
    [data-tone='info'] { color: var(--tb-tone-info-fg); background: var(--tb-tone-info-bg); }
    [data-tone='warning'] { color: var(--tb-tone-warning-fg); background: var(--tb-tone-warning-bg); }
    [data-tone='danger'] { color: var(--tb-tone-danger-fg); background: var(--tb-tone-danger-bg); }
    [data-tone='neutral'] { color: var(--tb-tone-neutral-fg); background: var(--tb-tone-neutral-bg); }
    [data-tone='accent'] { color: var(--tb-tone-accent-fg); background: var(--tb-tone-accent-bg); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBadge {
  private readonly t = inject(I18nService).t;
  readonly kind = input.required<StatusKind>();
  readonly value = input.required<string>();

  protected readonly tone = computed<Tone>(
    () => (STATUS_KINDS[this.kind()].tones as Record<string, Tone>)[this.value()] ?? 'neutral',
  );
  protected readonly label = computed(() => this.t(`${STATUS_KINDS[this.kind()].labels}.${this.value()}`));
}
