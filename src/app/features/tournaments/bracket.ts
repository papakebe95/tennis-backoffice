import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { I18nService } from '../../core/i18n/i18n.service';
import { roundLabel, type DrawEntry, type DrawView, type MatchStatus } from './tournament.models';

export type SideKind = 'entry' | 'bye' | 'qualifier' | 'empty' | 'tbd';

export interface BracketSide {
  kind: SideKind;
  /** First-round place of this side's player (or of this reserved place). */
  position: number | null;
  entry: DrawEntry | null;
  label: string | null;
  source: string | null;
  winner: boolean;
}

export interface BracketMatch {
  id: string;
  round: number;
  position: number;
  status: MatchStatus;
  sides: [BracketSide, BracketSide];
}

export interface PlaceRequest {
  position: number;
  mode: 'fill' | 'replace';
}

const NOT_STARTED: MatchStatus[] = ['PENDING', 'READY', 'SCHEDULED'];

/** Turns the API's draw into columns of matches with typed sides. */
export function bracketColumns(view: DrawView): BracketMatch[][] {
  const slots = new Map(view.slots.map((s) => [s.position, s]));
  const placeOf = new Map(view.slots.filter((s) => s.participantId).map((s) => [s.participantId!, s.position]));
  return view.rounds.map((round) =>
    round.matches.map((m) => {
      const side = (participantId: string | null, index: 0 | 1): BracketSide => {
        const winner = !!participantId && m.winnerId === participantId && m.status !== 'BYE';
        if (participantId) {
          return { kind: 'entry', position: placeOf.get(participantId) ?? null, entry: view.entries[participantId] ?? null, label: null, source: null, winner };
        }
        if (round.orderIndex === 1) {
          const slot = slots.get(2 * m.position + index);
          if (slot?.kind === 'BYE') return { kind: 'bye', position: slot.position, entry: null, label: null, source: null, winner: false };
          if (slot?.kind === 'QUALIFIER' || slot?.kind === 'EMPTY') {
            return {
              kind: slot.kind === 'QUALIFIER' ? 'qualifier' : 'empty',
              position: slot.position,
              entry: null,
              label: slot.label,
              source: slot.sourceEvent?.name ?? null,
              winner: false,
            };
          }
        }
        return { kind: 'tbd', position: null, entry: null, label: null, source: null, winner: false };
      };
      return { id: m.id, round: round.orderIndex, position: m.position, status: m.status, sides: [side(m.participant1Id, 0), side(m.participant2Id, 1)] };
    }),
  );
}

/**
 * The draw as a bracket: one column per round, matches centred between the
 * two they come from, connector lines drawn in CSS. First-round places can
 * be swapped by drag and drop, or by selecting one then another (keyboard).
 * Zoom and drag-to-pan keep 64- and 128-player draws usable.
 */
@Component({
  selector: 'tb-bracket',
  imports: [ButtonModule, TooltipModule],
  template: `
    <div class="toolbar">
      <p-button icon="pi pi-search-minus" [text]="true" severity="secondary" [ariaLabel]="t('tournaments.draw.zoomOut')" [pTooltip]="t('tournaments.draw.zoomOut')" (onClick)="setZoom(zoom() - 0.15)" [disabled]="zoom() <= 0.4" />
      <button type="button" class="zoom-value" (click)="setZoom(1)" [attr.aria-label]="t('tournaments.draw.zoomReset')">{{ (zoom() * 100).toFixed(0) }} %</button>
      <p-button icon="pi pi-search-plus" [text]="true" severity="secondary" [ariaLabel]="t('tournaments.draw.zoomIn')" [pTooltip]="t('tournaments.draw.zoomIn')" (onClick)="setZoom(zoom() + 0.15)" [disabled]="zoom() >= 1.6" />
    </div>
    <div
      #board
      class="board"
      [class.panning]="panning()"
      (pointerdown)="startPan($event)"
      (pointermove)="pan($event)"
      (pointerup)="endPan()"
      (pointercancel)="endPan()"
      (keydown.escape)="selected.set(null)"
    >
      <div class="canvas" [style.zoom]="zoom()">
        <div class="heads" [style.grid-template-columns]="'repeat(' + columns().length + ', var(--col))'">
          @for (col of columns(); track $index; let r = $index) {
            <div class="head">{{ roundTitle(r + 1) }}</div>
          }
        </div>
        <div class="grid" [style.grid-template-columns]="'repeat(' + columns().length + ', var(--col))'" [style.grid-template-rows]="'repeat(' + rows() + ', var(--row))'">
          @for (col of columns(); track $index; let r = $index; let lastCol = $last) {
            @for (m of col; track m.id) {
              <div
                class="cell"
                [class.first]="r === 0"
                [class.last]="lastCol"
                [class.even]="m.position % 2 === 0"
                [class.odd]="m.position % 2 === 1"
                [style.grid-column]="r + 1"
                [style.grid-row]="rowOf(r, m.position)"
              >
                <article class="match" [attr.data-status]="m.status">
                  @for (s of m.sides; track $index) {
                    <div
                      class="side"
                      [attr.data-kind]="s.kind"
                      [class.winner]="s.winner"
                      [class.swappable]="canSwap(m, s)"
                      [class.selected]="canSwap(m, s) && selected() === s.position"
                      [class.drop]="dropTarget() === s.position && canSwap(m, s)"
                      [attr.draggable]="canSwap(m, s)"
                      [attr.tabindex]="canSwap(m, s) ? 0 : null"
                      [attr.role]="canSwap(m, s) ? 'button' : null"
                      [attr.aria-pressed]="canSwap(m, s) ? selected() === s.position : null"
                      [attr.aria-label]="canSwap(m, s) ? t('tournaments.draw.selectForSwap') + ' : ' + sideText(s) : null"
                      (click)="canSwap(m, s) && pick(s.position!)"
                      (keydown.enter)="canSwap(m, s) && pick(s.position!)"
                      (keydown.space)="$event.preventDefault(); canSwap(m, s) && pick(s.position!)"
                      (dragstart)="dragStart($event, s.position!)"
                      (dragover)="canSwap(m, s) && dragOver($event, s.position!)"
                      (dragleave)="dropTarget.set(null)"
                      (drop)="canSwap(m, s) && drop($event, s.position!)"
                      (dragend)="dropTarget.set(null)"
                    >
                      @switch (s.kind) {
                        @case ('entry') {
                          <span class="seed" [class.none]="!s.entry?.seed">{{ s.entry?.seed ?? '' }}</span>
                          <span class="name" [title]="entryName(s.entry)">{{ entryName(s.entry) }}</span>
                          @if (s.entry?.entryType !== 'DIRECT' && s.entry) {
                            <span class="tag">{{ entryTag(s.entry) }}</span>
                          }
                          <span class="class">{{ s.entry?.player?.classification ?? '' }}</span>
                        }
                        @case ('bye') {
                          <span class="seed none"></span><span class="name muted">{{ t('tournaments.draw.bye') }}</span>
                        }
                        @case ('qualifier') {
                          <span class="seed q">Q</span>
                          <span class="name place" [title]="s.source ? t('tournaments.draw.fromTable', { name: s.source }) : ''">{{ t('tournaments.draw.qualifierPlace', { label: s.label ?? 'Q' }) }}</span>
                        }
                        @case ('empty') {
                          <span class="seed none"></span><span class="name place">{{ t('tournaments.draw.emptyPlace') }}</span>
                        }
                        @default {
                          <span class="seed none"></span><span class="name muted">{{ t('tournaments.draw.tbd') }}</span>
                        }
                      }
                      @if (placeAction(m, s); as mode) {
                        <p-button
                          [icon]="mode === 'fill' ? 'pi pi-user-plus' : 'pi pi-sync'"
                          [text]="true"
                          [rounded]="true"
                          size="small"
                          styleClass="side-action"
                          [pTooltip]="t('tournaments.draw.' + mode)"
                          [ariaLabel]="t('tournaments.draw.' + mode) + ' : ' + sideText(s)"
                          (onClick)="$event.stopPropagation(); place.emit({ position: s.position!, mode })"
                        />
                      }
                    </div>
                  }
                </article>
              </div>
            }
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    :host { display: grid; gap: var(--tb-space-2); --col: 280px; --row: 76px; --gap: 22px; --line: var(--tb-border-strong); }
    .toolbar { display: flex; align-items: center; justify-content: flex-end; gap: 2px; }
    .zoom-value { all: unset; cursor: pointer; min-width: 52px; text-align: center; font-size: var(--tb-text-sm); color: var(--tb-text-muted); font-variant-numeric: tabular-nums; border-radius: var(--tb-radius-sm); }
    .zoom-value:focus-visible { outline: 2px solid var(--tb-primary-500); }
    .board { overflow: auto; max-height: 72vh; border: 1px solid var(--tb-border); border-radius: var(--tb-radius-lg); background: var(--tb-surface-muted); cursor: grab; touch-action: pan-x pan-y; }
    .board.panning { cursor: grabbing; user-select: none; }
    .canvas { padding: var(--tb-space-4); width: max-content; }
    .heads, .grid { display: grid; }
    .head { padding: 0 var(--gap) var(--tb-space-3); font-size: var(--tb-text-xs); font-weight: var(--tb-weight-semibold); text-transform: uppercase; letter-spacing: 0.05em; color: var(--tb-text-muted); }
    .cell { position: relative; display: flex; align-items: center; padding: 0 var(--gap); }
    .cell:not(.first)::before { content: ''; position: absolute; left: 0; top: 50%; width: var(--gap); border-top: 2px solid var(--line); }
    .cell:not(.last)::after { content: ''; position: absolute; right: 0; width: var(--gap); height: 50%; border-right: 2px solid var(--line); }
    .cell.even:not(.last)::after { top: 50%; border-top: 2px solid var(--line); border-top-right-radius: 6px; }
    .cell.odd:not(.last)::after { top: 0; border-bottom: 2px solid var(--line); border-bottom-right-radius: 6px; }
    .match { width: 100%; background: var(--tb-surface); border: 1px solid var(--tb-border); border-radius: var(--tb-radius-md); box-shadow: var(--tb-shadow-sm); overflow: hidden; }
    .match[data-status='READY'] { border-color: var(--tb-primary-300); }
    .match[data-status='LIVE'] { border-color: var(--tb-accent-500); }
    .side { display: flex; align-items: center; gap: 8px; height: 31px; padding: 0 6px 0 8px; font-size: var(--tb-text-sm); position: relative; }
    .side + .side { border-top: 1px solid var(--tb-border); }
    .side.winner .name { font-weight: var(--tb-weight-bold); }
    .side.swappable { cursor: grab; }
    .side.swappable:hover, .side.swappable:focus-visible { background: var(--tb-primary-50); outline: none; }
    .side.selected { background: var(--tb-primary-100); box-shadow: inset 3px 0 0 var(--tb-primary-600); }
    .side.drop { background: var(--tb-primary-100); box-shadow: inset 0 0 0 2px var(--tb-primary-500); }
    .seed { flex: none; min-width: 20px; height: 18px; padding: 0 4px; border-radius: 4px; background: var(--tb-primary-600); color: #fff; font-size: 11px; font-weight: var(--tb-weight-bold); display: grid; place-items: center; }
    .seed.none { background: transparent; }
    .seed.q { background: var(--tb-tone-info-bg); color: var(--tb-tone-info-fg); }
    .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .name small { margin-left: 6px; color: var(--tb-text-muted); font-size: 11px; }
    .name.muted { color: var(--tb-text-subtle); font-style: italic; }
    .name.place { color: var(--tb-tone-info-fg); }
    .side[data-kind='qualifier'], .side[data-kind='empty'] { background: repeating-linear-gradient(135deg, transparent 0 6px, var(--tb-surface-muted) 6px 12px); }
    .tag { font-size: 10px; padding: 0 5px; border-radius: 4px; background: var(--tb-tone-accent-bg); color: var(--tb-tone-accent-fg); white-space: nowrap; }
    .class { flex: none; color: var(--tb-text-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
    :host ::ng-deep .side-action.p-button { width: 26px; height: 26px; padding: 0; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Bracket {
  protected readonly t = inject(I18nService).t;

  readonly view = input.required<DrawView>();
  /** First-round places can be exchanged (draft or published draw). */
  readonly swappable = input(false);
  /** Reserved places can be filled and players replaced. */
  readonly canPlace = input(false);
  readonly swap = output<{ a: number; b: number }>();
  readonly place = output<PlaceRequest>();

  private readonly board = viewChild.required<ElementRef<HTMLElement>>('board');
  protected readonly columns = computed(() => bracketColumns(this.view()));
  protected readonly rows = computed(() => Math.max(1, (this.view().event.drawSize ?? 2) / 2));
  protected readonly zoom = signal(1);
  protected readonly selected = signal<number | null>(null);
  protected readonly dropTarget = signal<number | null>(null);
  protected readonly panning = signal(false);
  private panStart: { x: number; y: number; left: number; top: number } | null = null;

  protected rowOf(roundIndex: number, position: number) {
    const span = 2 ** roundIndex;
    return `${position * span + 1} / span ${span}`;
  }

  protected roundTitle(round: number) {
    const label = roundLabel(round, this.columns().length);
    return this.t(label.key, label.params);
  }

  protected canSwap(m: BracketMatch, s: BracketSide) {
    return this.swappable() && m.round === 1 && s.position !== null;
  }

  /** Fill a reserved first-round place, or replace a player not yet playing. */
  protected placeAction(m: BracketMatch, s: BracketSide): 'fill' | 'replace' | null {
    if (!this.canPlace() || s.position === null) return null;
    if (m.round === 1 && (s.kind === 'qualifier' || s.kind === 'empty')) return 'fill';
    if (s.kind === 'entry' && NOT_STARTED.includes(m.status)) return 'replace';
    return null;
  }

  protected entryName(entry: DrawEntry | null) {
    if (!entry) return '';
    const name = `${entry.player.firstname} ${entry.player.lastname}`;
    return entry.partner ? `${entry.player.lastname} / ${entry.partner.lastname}` : name;
  }

  protected entryTag(entry: DrawEntry) {
    return entry.entryType === 'QUALIFIER' ? 'Q' : entry.entryType === 'LUCKY_LOSER' ? 'LL' : entry.entryType === 'WILDCARD' ? 'WC' : 'ALT';
  }

  protected sideText(s: BracketSide) {
    if (s.kind === 'entry') return this.entryName(s.entry);
    if (s.kind === 'qualifier') return s.label ?? 'Q';
    if (s.kind === 'bye') return this.t('tournaments.draw.bye');
    return this.t('tournaments.draw.emptyPlace');
  }

  protected setZoom(value: number) {
    this.zoom.set(Math.min(1.6, Math.max(0.4, Math.round(value * 100) / 100)));
  }

  // Swapping ----------------------------------------------------------------

  protected pick(position: number) {
    const selected = this.selected();
    if (selected === null) this.selected.set(position);
    else {
      this.selected.set(null);
      if (selected !== position) this.swap.emit({ a: selected, b: position });
    }
  }

  protected dragStart(event: DragEvent, position: number) {
    event.dataTransfer?.setData('text/plain', String(position));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    this.selected.set(null);
  }

  protected dragOver(event: DragEvent, position: number) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dropTarget.set(position);
  }

  protected drop(event: DragEvent, position: number) {
    event.preventDefault();
    this.dropTarget.set(null);
    const from = Number(event.dataTransfer?.getData('text/plain'));
    if (Number.isInteger(from) && from !== position) this.swap.emit({ a: from, b: position });
  }

  // Panning -----------------------------------------------------------------

  protected startPan(event: PointerEvent) {
    // Only on the background: sides keep click, drag and drop.
    if ((event.target as HTMLElement).closest('.side, button') || event.button !== 0) return;
    const el = this.board().nativeElement;
    this.panStart = { x: event.clientX, y: event.clientY, left: el.scrollLeft, top: el.scrollTop };
    this.panning.set(true);
    el.setPointerCapture(event.pointerId);
  }

  protected pan(event: PointerEvent) {
    if (!this.panStart) return;
    const el = this.board().nativeElement;
    el.scrollLeft = this.panStart.left - (event.clientX - this.panStart.x);
    el.scrollTop = this.panStart.top - (event.clientY - this.panStart.y);
  }

  protected endPan() {
    this.panStart = null;
    this.panning.set(false);
  }
}
