import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';
import { AuthzService, type ScopeRef } from './authz.service';
import type { Permission } from './permissions';

/**
 * Renders its template only when the permission (or any of a list) is held:
 *
 *   <button *tbCan="'court.manage'; scope: { organizationId: org.id }">…</button>
 */
@Directive({ selector: '[tbCan]' })
export class CanDirective {
  private readonly authz = inject(AuthzService);
  private readonly template = inject(TemplateRef);
  private readonly container = inject(ViewContainerRef);

  readonly tbCan = input.required<Permission | readonly Permission[]>();
  readonly tbCanScope = input<ScopeRef | undefined>(undefined);

  private shown = false;

  constructor() {
    effect(() => {
      const required = this.tbCan();
      const list = typeof required === 'string' ? [required] : required;
      const allowed = this.authz.hasAnyPermission(list, this.tbCanScope());
      if (allowed && !this.shown) this.container.createEmbeddedView(this.template);
      if (!allowed && this.shown) this.container.clear();
      this.shown = allowed;
    });
  }
}
