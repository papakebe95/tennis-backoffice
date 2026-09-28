import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import type { MenuItem } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { SelectModule } from 'primeng/select';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SessionStore } from '../auth/session.store';
import { AuthzService } from '../authz/authz.service';
import { WorkspaceStore, workspaceId, type Workspace } from '../context/workspace.store';
import { I18nService, LANGS, type Lang } from '../i18n/i18n.service';
import { NAV, visibleNav } from './nav.config';

@Component({
  selector: 'tb-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule, SelectModule, MenuModule, ButtonModule, AvatarModule],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  protected readonly session = inject(SessionStore);
  protected readonly workspaces = inject(WorkspaceStore);
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  private readonly authz = inject(AuthzService);

  protected readonly langs = LANGS;
  protected readonly mobileNavOpen = signal(false);

  protected readonly sections = computed(() =>
    visibleNav(NAV, this.workspaces.current(), (rule, scope) => this.authz.allows(rule, scope)),
  );

  protected readonly workspaceOptions = computed(() =>
    this.workspaces.available().map((workspace) => ({
      id: workspaceId(workspace),
      label: this.workspaceLabel(workspace),
      caption: this.workspaceCaption(workspace),
      workspace,
    })),
  );
  protected readonly currentWorkspaceId = computed(() => {
    const current = this.workspaces.current();
    return current ? workspaceId(current) : null;
  });

  protected readonly initials = computed(() => {
    const user = this.session.user();
    return user ? `${user.firstname[0] ?? ''}${user.lastname[0] ?? ''}`.toUpperCase() : '';
  });

  protected readonly userMenu = computed<MenuItem[]>(() => [
    { label: this.t('nav.profile'), icon: 'pi pi-user', routerLink: '/profile' },
    { separator: true },
    { label: this.t('common.signOut'), icon: 'pi pi-sign-out', command: () => void this.session.logout() },
  ]);

  constructor() {
    // Close the mobile drawer after navigating.
    inject(Router)
      .events.pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.mobileNavOpen.set(false));
  }

  protected selectWorkspace(id: string) {
    const option = this.workspaceOptions().find((o) => o.id === id);
    if (option) this.workspaces.select(option.workspace);
  }

  protected setLang(lang: Lang) {
    this.i18n.setLang(lang);
  }

  private workspaceLabel(workspace: Workspace): string {
    if (workspace.kind === 'platform') return this.t('context.platform');
    if (workspace.kind === 'organization') return workspace.organization.name;
    return workspace.competition.name;
  }

  private workspaceCaption(workspace: Workspace): string {
    if (workspace.kind === 'platform') return this.t('roleScope.GLOBAL');
    if (workspace.kind === 'organization') return this.t(`organizationType.${workspace.organization.type}`);
    return this.t('roleScope.COMPETITION');
  }
}
