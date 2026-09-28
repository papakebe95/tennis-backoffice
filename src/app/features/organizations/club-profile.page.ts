import { ChangeDetectionStrategy, Component, computed, effect, inject, input, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TextareaModule } from 'primeng/textarea';
import { ApiError } from '../../core/api/api';
import { AuthzService } from '../../core/authz/authz.service';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TbDatePipe } from '../../shared/format';
import { ImageUpload } from '../../shared/forms/image-upload';
import { emptyWeek, hoursValid, OpeningHoursEditor } from '../../shared/forms/opening-hours-editor';
import { SaveBar, SocialLinksFields } from '../../shared/forms/profile-bits';
import { PageHeader } from '../../shared/ui/page-header';
import { StatusBadge } from '../../shared/ui/status-badge';
import { AccessApi } from '../access/access.api';
import { OrgApi, type ClubInput } from './org.api';
import type { ClubProfile, SocialLinks, WeeklyHours } from './org.models';

/** Amenity names the apps know (stable keys, translated for display). */
const KNOWN_AMENITIES = ['Parking', 'Floodlights', 'Clubhouse', 'Locker rooms', 'Pro shop', 'Coaching'];

interface Draft {
  name: string;
  description: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  photos: string[];
  email: string;
  phone: string;
  website: string;
  socialLinks: SocialLinks;
  address: string;
  cityId: string;
  latitude: number | null;
  longitude: number | null;
  openingHours: WeeklyHours;
  amenities: string[];
}

const toDraft = (c: ClubProfile): Draft => ({
  name: c.name,
  description: c.description ?? '',
  logoUrl: c.logoUrl,
  bannerUrl: c.bannerUrl,
  photos: c.photos,
  email: c.email ?? '',
  phone: c.phone ?? '',
  website: c.website ?? '',
  socialLinks: c.socialLinks ?? {},
  address: c.address,
  cityId: c.cityId,
  latitude: c.latitude,
  longitude: c.longitude,
  openingHours: c.openingHours ?? emptyWeek(),
  amenities: c.amenities,
});

@Component({
  selector: 'tb-club-profile-page',
  imports: [
    FormsModule,
    ButtonModule,
    ChipModule,
    InputNumberModule,
    InputTextModule,
    MessageModule,
    SelectModule,
    SkeletonModule,
    TextareaModule,
    PageHeader,
    ImageUpload,
    OpeningHoursEditor,
    SocialLinksFields,
    SaveBar,
    StatusBadge,
    TbDatePipe,
  ],
  templateUrl: './club-profile.page.html',
  styleUrl: './club-profile.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClubProfilePage {
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  private readonly api = inject(OrgApi);
  private readonly accessApi = inject(AccessApi);
  private readonly authz = inject(AuthzService);
  private readonly toasts = inject(MessageService);

  /** Route param: the club id. */
  readonly id = input.required<string>();

  protected readonly club = resource({
    // Reload on language change: the description is per language.
    params: () => ({ id: this.id(), lang: this.i18n.lang() }),
    loader: ({ params }) => this.api.club(params.id),
  });
  private readonly options = resource({ loader: () => this.accessApi.options() });
  protected readonly cities = computed(() => (this.options.value()?.countries ?? []).flatMap((c) => c.cities));

  protected readonly draft = signal<Draft | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly newAmenity = signal('');
  protected readonly federationId = signal<string | null>(null);

  protected readonly canEdit = computed(() => {
    const club = this.club.value();
    return !!club && this.authz.hasPermission('club.update', { organizationId: club.organizationId });
  });
  protected readonly dirty = computed(() => {
    const club = this.club.value();
    const draft = this.draft();
    return !!club && !!draft && JSON.stringify(toDraft(club)) !== JSON.stringify(draft);
  });
  protected readonly invalid = computed(() => {
    const d = this.draft();
    return !d || d.name.trim().length < 2 || !hoursValid(d.openingHours);
  });
  protected readonly amenitySuggestions = computed(() =>
    KNOWN_AMENITIES.filter((a) => !this.draft()?.amenities.includes(a)),
  );

  private readonly federations = resource({ loader: () => this.accessApi.organizations('FEDERATION', '') });
  /** Federations the club isn't (or no longer) affiliated to. */
  protected readonly federationOptions = computed(() => {
    const current = new Set(
      (this.club.value()?.affiliations ?? []).filter((a) => a.status !== 'ENDED').map((a) => a.parent.id),
    );
    return (this.federations.value() ?? []).filter((f) => !current.has(f.id));
  });

  constructor() {
    effect(() => {
      const club = this.club.value();
      if (club) this.draft.set(toDraft(club));
    });
  }

  protected amenityLabel(name: string) {
    const key = `amenities.${name}`;
    return this.i18n.has(key) ? this.t(key) : name;
  }

  protected patch(changes: Partial<Draft>) {
    const d = this.draft();
    if (d) this.draft.set({ ...d, ...changes });
  }

  protected addAmenity(name: string) {
    const value = name.trim();
    const d = this.draft();
    if (!d || !value || d.amenities.includes(value)) return;
    this.patch({ amenities: [...d.amenities, value] });
    this.newAmenity.set('');
  }

  protected removeAmenity(name: string) {
    const d = this.draft();
    if (d) this.patch({ amenities: d.amenities.filter((a) => a !== name) });
  }

  protected addPhoto(url: string | null) {
    const d = this.draft();
    if (d && url) this.patch({ photos: [...d.photos, url] });
  }

  protected removePhoto(url: string) {
    const d = this.draft();
    if (d) this.patch({ photos: d.photos.filter((p) => p !== url) });
  }

  protected reset() {
    const club = this.club.value();
    if (club) this.draft.set(toDraft(club));
    this.error.set(null);
  }

  protected async save() {
    const d = this.draft();
    if (!d || this.invalid()) return;
    const body: ClubInput = {
      name: d.name.trim(),
      description: d.description.trim() || null,
      logoUrl: d.logoUrl,
      bannerUrl: d.bannerUrl,
      photos: d.photos,
      email: d.email.trim() || null,
      phone: d.phone.trim() || null,
      website: d.website.trim() || null,
      socialLinks: d.socialLinks,
      address: d.address.trim(),
      cityId: d.cityId,
      latitude: d.latitude,
      longitude: d.longitude,
      openingHours: d.openingHours,
      amenities: d.amenities,
    };
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.api.updateClub(this.id(), body);
      this.toasts.add({ severity: 'success', summary: this.t('profile2.saved') });
      this.club.reload();
    } catch (raw) {
      this.error.set(describeError(ApiError.from(raw), this.t));
    } finally {
      this.saving.set(false);
    }
  }

  protected async requestAffiliation() {
    const federationId = this.federationId();
    if (!federationId) return;
    try {
      await this.api.requestAffiliation(this.id(), federationId);
      this.federationId.set(null);
      this.toasts.add({ severity: 'success', summary: this.t('profile2.requested') });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
    }
    this.club.reload();
  }
}
