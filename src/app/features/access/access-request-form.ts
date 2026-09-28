import { ChangeDetectionStrategy, Component, computed, effect, inject, output, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AutoCompleteModule, type AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { I18nService } from '../../core/i18n/i18n.service';
import { AccessApi, type AccessRequestInput, type RegistrationOptions } from './access.api';

type Role = RegistrationOptions['roles'][number];
type OrgOption = { id: string; name: string; city: string | null };

/**
 * "Which profile, for which organization": the part of an access request
 * shared by sign-up and by signed-in users asking for a new role. Emits the
 * request body (or null while incomplete); the API validates it again.
 */
@Component({
  selector: 'tb-access-request-form',
  imports: [FormsModule, AutoCompleteModule, InputTextModule, SelectButtonModule, SelectModule, TextareaModule],
  template: `
    <fieldset class="profiles">
      <legend>{{ t('register.profile') }}</legend>
      @for (r of options.value()?.roles ?? []; track r.key) {
        <label class="profile" [class.active]="role()?.key === r.key">
          <input type="radio" name="profile" [value]="r.key" [checked]="role()?.key === r.key" (change)="selectRole(r)" />
          <strong>{{ r.name }}</strong>
          @if (r.description) {
            <small>{{ r.description }}</small>
          }
        </label>
      }
    </fieldset>

    @if (role()?.scope === 'ORGANIZATION') {
      <fieldset class="org">
        <legend>{{ t('register.organization') }}{{ role()?.organizationType ? ' · ' + t('organizationType.' + role()!.organizationType) : '' }}</legend>
        <p-selectbutton [options]="modes()" [ngModel]="mode()" (ngModelChange)="mode.set($event)" optionLabel="label" optionValue="value" [allowEmpty]="false" />
        @if (mode() === 'existing') {
          <div class="tb-field">
            <label for="req-org">{{ t('register.organization') }}</label>
            <p-autocomplete
              inputId="req-org"
              [ngModel]="organization()"
              (ngModelChange)="organization.set($event)"
              [suggestions]="suggestions()"
              (completeMethod)="search($event)"
              optionLabel="name"
              [dropdown]="true"
              [forceSelection]="true"
              [placeholder]="t('register.searchOrganization')"
              appendTo="body"
              [fluid]="true"
            >
              <ng-template #item let-o>
                <span>{{ o.name }}</span>
                @if (o.city) {
                  <small class="tb-muted"> · {{ o.city }}</small>
                }
              </ng-template>
            </p-autocomplete>
          </div>
        } @else {
          <div class="grid">
            <div class="tb-field">
              <label for="req-new-name">{{ t('register.newOrgName') }}</label>
              <input pInputText id="req-new-name" [ngModel]="newName()" (ngModelChange)="newName.set($event)" maxlength="120" />
            </div>
            <div class="tb-field">
              <label for="req-city">{{ t('register.city') }}</label>
              <p-select inputId="req-city" [options]="cities()" optionLabel="name" optionValue="id" [ngModel]="cityId()" (ngModelChange)="cityId.set($event)" [filter]="true" appendTo="body" [fluid]="true" />
            </div>
            <div class="tb-field">
              <label for="req-address">{{ t('register.address') }}</label>
              <input pInputText id="req-address" [ngModel]="address()" (ngModelChange)="address.set($event)" maxlength="200" />
            </div>
            <div class="tb-field">
              <label for="req-org-phone">{{ t('register.orgPhone') }}</label>
              <input pInputText id="req-org-phone" [ngModel]="orgPhone()" (ngModelChange)="orgPhone.set($event)" inputmode="tel" maxlength="30" />
            </div>
          </div>
        }
      </fieldset>
    }

    <div class="tb-field">
      <label for="req-message">{{ t('register.message') }}</label>
      <textarea pTextarea id="req-message" rows="3" [autoResize]="true" [ngModel]="message()" (ngModelChange)="message.set($event)" [placeholder]="t('register.messagePlaceholder')" maxlength="1000"></textarea>
    </div>
  `,
  styles: `
    :host { display: block; }
    fieldset { border: 0; padding: 0; margin: 0 0 var(--tb-space-5); }
    legend { font-weight: var(--tb-weight-semibold); margin-bottom: var(--tb-space-3); }
    .profiles { display: grid; gap: var(--tb-space-3); grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr)); }
    .profiles legend { grid-column: 1 / -1; }
    .profile { position: relative; display: flex; flex-direction: column; gap: var(--tb-space-1); padding: var(--tb-space-4); border: 1px solid var(--tb-border); border-radius: var(--tb-radius-md); cursor: pointer; }
    .profile:hover { border-color: var(--tb-primary-300); }
    .profile.active { border-color: var(--tb-primary-500); background: var(--tb-primary-50); box-shadow: 0 0 0 1px var(--tb-primary-500); }
    .profile input { position: absolute; opacity: 0; }
    .profile:has(input:focus-visible) { outline: 2px solid var(--tb-primary-400); outline-offset: 2px; }
    .profile small { color: var(--tb-text-muted); }
    .org p-selectbutton { display: block; margin-bottom: var(--tb-space-4); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr)); gap: 0 var(--tb-space-4); }
    textarea { width: 100%; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessRequestForm {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(AccessApi);

  readonly value = output<AccessRequestInput | null>();

  protected readonly options = resource({ loader: () => this.api.options() });
  protected readonly role = signal<Role | null>(null);
  protected readonly mode = signal<'existing' | 'new'>('existing');
  protected readonly organization = signal<OrgOption | string | null>(null);
  protected readonly suggestions = signal<OrgOption[]>([]);
  protected readonly newName = signal('');
  protected readonly cityId = signal<string | null>(null);
  protected readonly address = signal('');
  protected readonly orgPhone = signal('');
  protected readonly message = signal('');

  protected readonly modes = computed(() => [
    { label: this.t('register.orgExisting'), value: 'existing' },
    { label: this.t('register.orgNew'), value: 'new' },
  ]);
  protected readonly cities = computed(() => (this.options.value()?.countries ?? []).flatMap((c) => c.cities));

  private readonly request = computed<AccessRequestInput | null>(() => {
    const role = this.role();
    if (!role) return null;
    const message = this.message().trim() || undefined;
    if (role.scope !== 'ORGANIZATION') return { roleKey: role.key, message };
    if (this.mode() === 'existing') {
      const org = this.organization();
      return org && typeof org === 'object' ? { roleKey: role.key, organizationId: org.id, message } : null;
    }
    const name = this.newName().trim();
    const type = role.organizationType ?? 'CLUB';
    if (name.length < 2 || (type === 'CLUB' && !this.cityId())) return null;
    return {
      roleKey: role.key,
      message,
      proposedOrganization: {
        type,
        name,
        cityId: this.cityId() ?? undefined,
        address: this.address().trim() || undefined,
        phone: this.orgPhone().trim() || undefined,
      },
    };
  });

  constructor() {
    effect(() => this.value.emit(this.request()));
  }

  protected selectRole(role: Role) {
    this.role.set(role);
    this.organization.set(null);
  }

  protected async search(event: AutoCompleteCompleteEvent) {
    const type = this.role()?.organizationType;
    if (!type) return;
    this.suggestions.set(await this.api.organizations(type, event.query));
  }
}
