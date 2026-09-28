import { ChangeDetectionStrategy, Component, computed, inject, input, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService, type MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ApiError } from '../../core/api/api';
import { AuthzService } from '../../core/authz/authz.service';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { ImageUpload } from '../../shared/forms/image-upload';
import { emptyWeek, hoursValid, OpeningHoursEditor } from '../../shared/forms/opening-hours-editor';
import { EmptyState } from '../../shared/ui/bits';
import { ConfirmService } from '../../shared/ui/confirm';
import { PageHeader } from '../../shared/ui/page-header';
import { StatusBadge } from '../../shared/ui/status-badge';
import { OrgApi } from './org.api';
import { WEEKDAYS, type Court, type CourtStatus, type CourtWindow, type Surface, type WeeklyHours } from './org.models';

const SURFACES: Surface[] = ['HARD', 'CLAY', 'GRASS', 'INDOOR'];
const STATUSES: CourtStatus[] = ['AVAILABLE', 'MAINTENANCE', 'DISABLED'];

/** CourtAvailability rows ⇄ the weekly editor's shape. */
export const windowsToWeek = (windows: CourtWindow[]): WeeklyHours => {
  const week = emptyWeek();
  for (const w of windows) week[WEEKDAYS[w.weekday]].push(`${w.opensAt}-${w.closesAt}`);
  return week;
};
export const weekToWindows = (week: WeeklyHours): CourtWindow[] =>
  WEEKDAYS.flatMap((day, weekday) =>
    (week[day] ?? []).map((range) => {
      const [opensAt, closesAt] = range.split('-');
      return { weekday, opensAt, closesAt };
    }),
  );

interface CourtDraft {
  id: string | null;
  name: string;
  number: number | null;
  surface: Surface;
  indoor: boolean;
  lighting: boolean;
  pricePerHour: number | null;
  photos: string[];
  ownHours: boolean;
  hours: WeeklyHours;
}

@Component({
  selector: 'tb-courts-page',
  imports: [
    FormsModule,
    ButtonModule,
    DrawerModule,
    InputNumberModule,
    InputTextModule,
    MenuModule,
    MessageModule,
    SelectModule,
    SkeletonModule,
    ToggleSwitchModule,
    PageHeader,
    StatusBadge,
    EmptyState,
    ImageUpload,
    OpeningHoursEditor,
  ],
  templateUrl: './courts.page.html',
  styleUrl: './courts.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourtsPage {
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  private readonly api = inject(OrgApi);
  private readonly authz = inject(AuthzService);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(MessageService);

  /** Route param: the club id. */
  readonly id = input.required<string>();

  protected readonly data = resource({ params: () => this.id(), loader: ({ params }) => this.api.courts(params) });
  private readonly club = resource({ params: () => this.id(), loader: ({ params }) => this.api.club(params) });
  protected readonly canManage = computed(() => {
    const club = this.club.value();
    return !!club && this.authz.hasPermission('court.manage', { organizationId: club.organizationId });
  });

  protected readonly showArchived = signal(false);
  protected readonly courts = computed(() =>
    (this.data.value()?.courts ?? []).filter((c) => this.showArchived() || !c.archivedAt),
  );
  protected readonly archivedCount = computed(() => (this.data.value()?.courts ?? []).filter((c) => c.archivedAt).length);

  protected readonly surfaceOptions = computed(() => SURFACES.map((s) => ({ label: this.t(`courts.surfaces.${s}`), value: s })));
  private readonly money = computed(() => new Intl.NumberFormat(this.i18n.lang() === 'fr' ? 'fr-FR' : 'en-GB'));

  // Editor drawer
  protected readonly draft = signal<CourtDraft | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly draftValid = computed(() => {
    const d = this.draft();
    return !!d && d.name.trim().length > 0 && (!d.ownHours || hoursValid(d.hours));
  });

  protected price(court: Court) {
    return court.pricePerHour === null
      ? this.t('courts.noPrice')
      : this.t('courts.perHour', { price: this.money().format(Number(court.pricePerHour)) });
  }

  /** "Mon–Fri 17:00–23:00"-style summary of a court's own hours. */
  protected hoursSummary(court: Court): string {
    if (!court.availability.length) return this.t('courts.followsClub');
    const days = [...new Set(court.availability.map((w) => w.weekday))].length;
    const first = court.availability[0];
    return `${this.t('courts.ownHours')} · ${first.opensAt}–${first.closesAt}${days < 7 ? ` (${days}/7)` : ''}`;
  }

  protected statusMenu(court: Court): MenuItem[] {
    return STATUSES.filter((s) => s !== court.status).map((status) => ({
      label: this.t(`status.court.${status}`),
      command: () => void this.setStatus(court, status),
    }));
  }

  protected openNew() {
    const clubHours = this.data.value()?.clubHours;
    this.formError.set(null);
    this.draft.set({
      id: null,
      name: '',
      number: null,
      surface: 'HARD',
      indoor: false,
      lighting: false,
      pricePerHour: null,
      photos: [],
      ownHours: false,
      hours: clubHours ?? emptyWeek(),
    });
  }

  protected openEdit(court: Court) {
    const clubHours = this.data.value()?.clubHours;
    this.formError.set(null);
    this.draft.set({
      id: court.id,
      name: court.name,
      number: court.number,
      surface: court.surface,
      indoor: court.indoor,
      lighting: court.lighting,
      pricePerHour: court.pricePerHour === null ? null : Number(court.pricePerHour),
      photos: court.photos,
      ownHours: court.availability.length > 0,
      hours: court.availability.length ? windowsToWeek(court.availability) : (clubHours ?? emptyWeek()),
    });
  }

  protected patch(changes: Partial<CourtDraft>) {
    const d = this.draft();
    if (d) this.draft.set({ ...d, ...changes });
  }

  protected async save() {
    const d = this.draft();
    if (!d || !this.draftValid()) return;
    const body = {
      name: d.name.trim(),
      number: d.number,
      surface: d.surface,
      indoor: d.indoor,
      lighting: d.lighting,
      pricePerHour: d.pricePerHour,
      photos: d.photos,
    };
    this.saving.set(true);
    this.formError.set(null);
    try {
      const court = d.id ? await this.api.updateCourt(d.id, body) : await this.api.createCourt(this.id(), body);
      const hadOwn = !!this.data.value()?.courts.find((c) => c.id === d.id)?.availability.length;
      if (d.ownHours || hadOwn) {
        await this.api.setCourtAvailability(court.id, d.ownHours ? weekToWindows(d.hours) : []);
      }
      this.toasts.add({ severity: 'success', summary: this.t(d.id ? 'courts.saved' : 'courts.created') });
      this.draft.set(null);
      this.data.reload();
    } catch (raw) {
      this.formError.set(describeError(ApiError.from(raw), this.t));
    } finally {
      this.saving.set(false);
    }
  }

  protected async setStatus(court: Court, status: CourtStatus) {
    const blocking = status !== 'AVAILABLE';
    const result = await this.confirm.ask({
      title: this.t('courts.statusTitle', { status: this.t(`status.court.${status}`) }),
      message: blocking ? this.t('courts.statusBody') : undefined,
      detail: blocking && court.upcomingBookings ? this.t('courts.affected', { count: court.upcomingBookings }) : undefined,
      confirmLabel: this.t('common.confirm'),
      severity: blocking ? 'warn' : 'primary',
      reason: blocking ? 'required' : 'optional',
    });
    if (!result) return;
    await this.run(() => this.api.setCourtStatus(court.id, status, result.reason), 'courts.statusChanged');
  }

  protected async archive(court: Court) {
    const result = await this.confirm.ask({
      title: this.t('courts.archiveTitle'),
      message: this.t('courts.archiveBody'),
      detail: court.upcomingBookings ? this.t('courts.affected', { count: court.upcomingBookings }) : undefined,
      confirmLabel: this.t('courts.archive'),
      severity: 'danger',
      reason: 'optional',
    });
    if (!result) return;
    await this.run(() => this.api.archiveCourt(court.id, result.reason), 'courts.archivedDone');
  }

  protected async restore(court: Court) {
    await this.run(() => this.api.restoreCourt(court.id), 'courts.restoredDone');
  }

  protected removePhoto(url: string) {
    const d = this.draft();
    if (d) this.patch({ photos: d.photos.filter((p) => p !== url) });
  }

  protected addPhoto(url: string | null) {
    const d = this.draft();
    if (d && url) this.patch({ photos: [...d.photos, url] });
  }

  private async run(action: () => Promise<unknown>, successKey: string) {
    try {
      await action();
      this.toasts.add({ severity: 'success', summary: this.t(successKey) });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
    }
    this.data.reload();
  }
}
