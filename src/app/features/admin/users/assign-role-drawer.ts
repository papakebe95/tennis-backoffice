import { ChangeDetectionStrategy, Component, computed, inject, input, model, output, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AutoCompleteModule, type AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { ApiError } from '../../../core/api/api';
import { AuthzService } from '../../../core/authz/authz.service';
import { describeError } from '../../../core/http/interceptors';
import { I18nService } from '../../../core/i18n/i18n.service';
import { AdminApi } from '../admin.api';
import type { Named, Role } from '../admin.models';

type Picked = Named & { caption?: string };

/**
 * Grant a role: pick the role, then — depending on its level — the
 * organization or tournament it applies to. Options are limited to where the
 * signed-in user may assign roles; the API re-checks all of it.
 */
@Component({
  selector: 'tb-assign-role-drawer',
  imports: [DrawerModule, SelectModule, AutoCompleteModule, ButtonModule, MessageModule, FormsModule],
  template: `
    <p-drawer [(visible)]="visible" position="right" [header]="t('users.assign.title')" styleClass="tb-drawer" (onHide)="reset()">
      @if (error()) {
        <p-message severity="error" class="msg">{{ error() }}</p-message>
      }
      <div class="tb-field">
        <label for="assign-role">{{ t('users.assign.role') }}</label>
        <p-select
          inputId="assign-role"
          [options]="roleOptions()"
          optionLabel="name"
          [ngModel]="role()"
          (ngModelChange)="selectRole($event)"
          [filter]="true"
          filterBy="name,key"
          appendTo="body"
          [fluid]="true"
        >
          <ng-template #item let-r>
            <div class="option">
              <span>{{ r.name }}</span>
              <small>{{ t('roleScope.' + r.scope) }}{{ r.organizationType ? ' · ' + t('organizationType.' + r.organizationType) : '' }}</small>
            </div>
          </ng-template>
        </p-select>
      </div>

      @switch (role()?.scope) {
        @case ('GLOBAL') {
          <p class="tb-muted">{{ t('users.assign.scopeGlobal') }}</p>
        }
        @case ('ORGANIZATION') {
          <div class="tb-field">
            <label for="assign-org">{{ t('users.assign.organization') }}</label>
            <p-autocomplete
              inputId="assign-org"
              [ngModel]="target()"
              (ngModelChange)="target.set($event)"
              [suggestions]="suggestions()"
              (completeMethod)="searchOrganizations($event)"
              optionLabel="name"
              [dropdown]="true"
              [forceSelection]="true"
              [placeholder]="t('users.assign.searchOrganization')"
              appendTo="body"
              [fluid]="true"
            />
            @if (role()?.organizationType; as type) {
              <span class="tb-field-hint">{{ t('users.assign.onlyType', { type: t('organizationType.' + type) }) }}</span>
            }
          </div>
        }
        @case ('COMPETITION') {
          <div class="tb-field">
            <label for="assign-competition">{{ t('users.assign.competition') }}</label>
            <p-autocomplete
              inputId="assign-competition"
              [ngModel]="target()"
              (ngModelChange)="target.set($event)"
              [suggestions]="suggestions()"
              (completeMethod)="searchCompetitions($event)"
              optionLabel="name"
              [dropdown]="true"
              [forceSelection]="true"
              [placeholder]="t('users.assign.searchCompetition')"
              appendTo="body"
              [fluid]="true"
            />
          </div>
        }
      }

      <ng-template #footer>
        <div class="footer">
          <p-button [label]="t('common.cancel')" severity="secondary" [text]="true" (onClick)="visible.set(false)" />
          <p-button [label]="t('users.assign.submit')" icon="pi pi-check" [disabled]="!canSubmit()" [loading]="saving()" (onClick)="submit()" />
        </div>
      </ng-template>
    </p-drawer>
  `,
  styles: `
    .option { display: flex; flex-direction: column; }
    .option small { color: var(--tb-text-muted); }
    .msg { display: block; margin-bottom: var(--tb-space-4); }
    .footer { display: flex; justify-content: flex-end; gap: var(--tb-space-2); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignRoleDrawer {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(AdminApi);
  private readonly authz = inject(AuthzService);

  readonly userId = input.required<string>();
  readonly visible = model(false);
  readonly assigned = output<void>();

  private readonly roles = resource({ loader: () => this.api.roles() });
  /** Global roles only for global assigners; the API enforces the rest. */
  protected readonly roleOptions = computed(() =>
    (this.roles.value() ?? []).filter(
      (r) => r.scope !== 'GLOBAL' || this.authz.hasGlobalPermission('user.roles.assign'),
    ),
  );
  protected readonly role = signal<Role | null>(null);
  protected readonly target = signal<Picked | null>(null);
  protected readonly suggestions = signal<Picked[]>([]);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly canSubmit = computed(() => {
    const role = this.role();
    if (!role || this.saving()) return false;
    return role.scope === 'GLOBAL' || (this.target() !== null && typeof this.target() === 'object');
  });

  protected selectRole(role: Role | null) {
    this.role.set(role);
    this.target.set(null);
    this.suggestions.set([]);
    this.error.set(null);
  }

  protected async searchOrganizations(event: AutoCompleteCompleteEvent) {
    const rows = await this.api.lookupOrganizations(event.query, this.role()?.organizationType ?? undefined);
    this.suggestions.set(rows.map((o) => ({ id: o.id, name: o.name, caption: o.type })));
  }

  protected async searchCompetitions(event: AutoCompleteCompleteEvent) {
    const rows = await this.api.lookupCompetitions(event.query);
    this.suggestions.set(rows.map((c) => ({ id: c.id, name: c.name, caption: c.club?.name })));
  }

  protected async submit() {
    const role = this.role();
    if (!role) return;
    const target = this.target();
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.api.grantRole(this.userId(), {
        roleId: role.id,
        ...(role.scope === 'ORGANIZATION' && target ? { organizationId: target.id } : {}),
        ...(role.scope === 'COMPETITION' && target ? { competitionId: target.id } : {}),
      });
      this.assigned.emit();
      this.visible.set(false);
    } catch (raw) {
      this.error.set(describeError(ApiError.from(raw), this.t));
    } finally {
      this.saving.set(false);
    }
  }

  protected reset() {
    this.selectRole(null);
  }
}
