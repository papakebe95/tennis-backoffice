import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { PageHeader } from '../../shared/ui/page-header';
import { MatchesList } from './matches-list';

/** /matches — every tournament match the user may see (officials: their own). */
@Component({
  selector: 'tb-matches-page',
  imports: [PageHeader, MatchesList],
  template: `
    <tb-page-header [title]="t('matches.title')" [subtitle]="t('matches.subtitle')" />
    <tb-matches-list />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchesPage {
  protected readonly t = inject(I18nService).t;
}
