import { ChangeDetectionStrategy, Component, computed, inject, input, output, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { ApiError } from '../../core/api/api';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TbDatePipe } from '../../shared/format';
import { EmptyState, UserCell } from '../../shared/ui/bits';
import { ConfirmService } from '../../shared/ui/confirm';
import { SearchInput } from '../../shared/ui/search-input';
import { TournamentApi } from './tournament.api';
import type { StaffGrant, TournamentDetail } from './tournament.models';
import type { TournamentCan } from './tournament-detail.page';

type Person = { id: string; firstname: string; lastname: string; phone: string };

/** The "Team" tab: directors, organizers and officials of this tournament only. */
@Component({
  selector: 'tb-team-panel',
  imports: [FormsModule, ButtonModule, MessageModule, SelectModule, EmptyState, UserCell, SearchInput, TbDatePipe],
  template: `
    @let d = tournament();
    <section class="tb-card">
      <h2 class="tb-card-title">{{ t('tournaments.tabs.team') }}</h2>
      <p class="tb-muted sub">{{ t('tournaments.team.subtitle') }}</p>
      @if (d.hostOrganization) {
        <p-message severity="secondary" class="msg">{{ t('tournaments.team.hostHint', { name: d.hostOrganization.name }) }}</p-message>
      }
      <ul class="grants">
        @for (g of staff.value()?.grants ?? []; track g.id) {
          <li>
            <tb-user-cell [firstname]="g.user.firstname" [lastname]="g.user.lastname" [secondary]="g.user.email" />
            <span class="role">{{ g.role.name }}</span>
            <small class="tb-muted">{{ g.grantedAt | tbDate: 'date' }}{{ g.grantedBy ? ' · ' + t('tournaments.team.grantedBy', { name: g.grantedBy.firstname + ' ' + g.grantedBy.lastname }) : '' }}</small>
            @if (canManage()) {
              <p-button [label]="t('tournaments.team.remove')" icon="pi pi-user-minus" severity="danger" [text]="true" size="small" (onClick)="remove(g)" />
            }
          </li>
        } @empty {
          <li><tb-empty-state [message]="t('tournaments.team.empty')" icon="pi pi-id-card" /></li>
        }
      </ul>
    </section>

    @if (canManage()) {
      <section class="tb-card add">
        <h2 class="tb-card-title">{{ t('tournaments.team.add') }}</h2>
        @if (error()) {
          <p-message severity="error" class="msg">{{ error() }}</p-message>
        }
        <div class="row">
          <div class="tb-field person">
            <label>{{ t('tournaments.team.person') }}</label>
            @if (person(); as p) {
              <div class="picked">
                <tb-user-cell [firstname]="p.firstname" [lastname]="p.lastname" [secondary]="p.phone" />
                <p-button icon="pi pi-times" [text]="true" severity="secondary" [ariaLabel]="t('common.cancel')" (onClick)="person.set(null)" />
              </div>
            } @else {
              <tb-search-input [value]="query()" [placeholder]="t('tournaments.team.search')" (search)="query.set($event)" />
              <ul class="candidates">
                @for (c of candidates.value() ?? []; track c.id) {
                  <li><button type="button" (click)="person.set(c)"><tb-user-cell [firstname]="c.firstname" [lastname]="c.lastname" [secondary]="c.phone" /></button></li>
                }
              </ul>
            }
          </div>
          <div class="tb-field">
            <label for="team-role">{{ t('tournaments.team.role') }}</label>
            <p-select inputId="team-role" [options]="roleOptions()" [ngModel]="roleKey()" (ngModelChange)="roleKey.set($event)" appendTo="body" [fluid]="true" />
            @if (roleDescription()) {
              <span class="tb-field-hint">{{ roleDescription() }}</span>
            }
          </div>
        </div>
        <div class="actions">
          <p-button [label]="t('tournaments.team.add')" icon="pi pi-user-plus" [disabled]="!person() || !roleKey()" [loading]="saving()" (onClick)="add()" />
        </div>
      </section>
    }
  `,
  styles: `
    :host { display: grid; gap: var(--tb-space-5); }
    .sub { margin: calc(-1 * var(--tb-space-2)) 0 var(--tb-space-4); font-size: var(--tb-text-sm); }
    .msg { display: block; margin-bottom: var(--tb-space-4); }
    .grants { list-style: none; margin: 0; padding: 0; display: grid; }
    .grants li { display: grid; grid-template-columns: minmax(200px, 1fr) auto auto auto; gap: var(--tb-space-4); align-items: center; padding: var(--tb-space-3) 0; border-top: 1px solid var(--tb-border); }
    .grants li:first-child { border-top: 0; }
    .role { font-weight: var(--tb-weight-semibold); }
    @media (max-width: 720px) { .grants li { grid-template-columns: 1fr; gap: var(--tb-space-1); } }
    .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--tb-space-4); }
    .picked { display: flex; align-items: center; justify-content: space-between; padding: var(--tb-space-2) var(--tb-space-3); border: 1px solid var(--tb-border); border-radius: var(--tb-radius-md); }
    .candidates { list-style: none; margin: var(--tb-space-2) 0 0; padding: 0; }
    .candidates button { all: unset; box-sizing: border-box; width: 100%; padding: var(--tb-space-2) var(--tb-space-3); border-radius: var(--tb-radius-md); cursor: pointer; }
    .candidates button:hover, .candidates button:focus-visible { background: var(--tb-surface-muted); }
    .actions { display: flex; justify-content: flex-end; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamPanel {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(TournamentApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(MessageService);

  readonly tournament = input.required<TournamentDetail>();
  readonly can = input.required<TournamentCan>();
  readonly changed = output<void>();

  protected readonly canManage = computed(() => this.can()('tournament.staff.manage'));
  protected readonly staff = resource({ params: () => this.tournament().id, loader: ({ params }) => this.api.staff(params) });

  protected readonly query = signal('');
  protected readonly person = signal<Person | null>(null);
  protected readonly roleKey = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly candidates = resource({
    params: () => (this.query().length >= 2 ? { id: this.tournament().id, q: this.query() } : undefined),
    loader: ({ params }) => this.api.staffCandidates(params.id, params.q),
  });
  protected readonly roleOptions = computed(() => (this.staff.value()?.roles ?? []).map((r) => ({ label: r.name, value: r.key })));
  protected readonly roleDescription = computed(() => this.staff.value()?.roles.find((r) => r.key === this.roleKey())?.description ?? null);

  protected async add() {
    const person = this.person();
    const roleKey = this.roleKey();
    if (!person || !roleKey) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      this.staff.set(await this.api.addStaff(this.tournament().id, person.id, roleKey));
      this.person.set(null);
      this.query.set('');
      this.toasts.add({ severity: 'success', summary: this.t('tournaments.team.added') });
      this.changed.emit();
    } catch (raw) {
      this.error.set(describeError(ApiError.from(raw), this.t));
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(grant: StaffGrant) {
    const answer = await this.confirm.ask({
      title: this.t('tournaments.team.removeTitle'),
      message: this.t('tournaments.team.removeMessage', { name: `${grant.user.firstname} ${grant.user.lastname}`, role: grant.role.name }),
      confirmLabel: this.t('tournaments.team.remove'),
      severity: 'danger',
      reason: 'optional',
    });
    if (!answer) return;
    try {
      this.staff.set(await this.api.removeStaff(this.tournament().id, grant.id, answer.reason));
      this.toasts.add({ severity: 'success', summary: this.t('tournaments.team.removed') });
      this.changed.emit();
    } catch (raw) {
      this.toasts.add({ severity: 'error', summary: describeError(ApiError.from(raw), this.t) });
    }
  }
}
