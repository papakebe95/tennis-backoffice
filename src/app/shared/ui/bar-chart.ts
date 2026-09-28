import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';

export interface BarDatum {
  /** Short axis label ("14/09"). */
  label: string;
  value: number;
  /** Full label for tooltip and table ("Week of 14 Sept"). */
  title: string;
}

const MARGIN = { top: 12, right: 8, bottom: 26, left: 36 };
const BAR_MAX = 24;
const RADIUS = 4;

/** Clean tick step for counts: 1, 2, 5 × 10^n, at least 1. */
export function niceStep(max: number, targetTicks = 4): number {
  const raw = Math.max(max / targetTicks, 1);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude;
  return step;
}

/**
 * Single-series column chart for counts over time. One hue (no legend: the
 * card title names the series), thin columns with a rounded data end, hairline
 * grid, per-column tooltip on hover/focus, and a data table on demand.
 */
@Component({
  selector: 'tb-bar-chart',
  template: `
    <div class="plot" [style.height.px]="height()">
      <svg [attr.width]="width()" [attr.height]="height()" role="img" [attr.aria-label]="label()">
        @for (tick of layout().ticks; track tick.value) {
          <line class="grid" [attr.x1]="margin.left" [attr.x2]="width() - margin.right" [attr.y1]="tick.y" [attr.y2]="tick.y" />
          <text class="tick" [attr.x]="margin.left - 8" [attr.y]="tick.y" text-anchor="end" dominant-baseline="middle">{{ tick.text }}</text>
        }
        @for (bar of layout().bars; track bar.index) {
          @if (bar.path) {
            <path class="bar" [class.dim]="hovered() !== null && hovered() !== bar.index" [attr.d]="bar.path" />
          }
          @if (bar.showLabel) {
            <text class="tick" [attr.x]="bar.cx" [attr.y]="height() - 8" text-anchor="middle">{{ bar.label }}</text>
          }
          <rect
            class="hit"
            [attr.x]="bar.hitX"
            [attr.y]="margin.top"
            [attr.width]="bar.hitW"
            [attr.height]="layout().plotH"
            tabindex="0"
            [attr.aria-label]="bar.title + ': ' + bar.value"
            (mouseenter)="hovered.set(bar.index)"
            (mouseleave)="hovered.set(null)"
            (focus)="hovered.set(bar.index)"
            (blur)="hovered.set(null)"
          />
        }
      </svg>
      @if (tooltip(); as tip) {
        <div class="tooltip" [style.left.px]="tip.x" [style.top.px]="tip.y">
          <span>{{ tip.title }}</span>
          <strong>{{ tip.value }}</strong>
        </div>
      }
    </div>
    <button type="button" class="toggle" (click)="showTable.set(!showTable())" [attr.aria-expanded]="showTable()">
      {{ t(showTable() ? 'list.hideTable' : 'list.showTable') }}
    </button>
    @if (showTable()) {
      <table>
        <caption class="tb-sr-only">{{ label() }}</caption>
        <tbody>
          @for (d of data(); track d.title) {
            <tr><th scope="row">{{ d.title }}</th><td>{{ d.value }}</td></tr>
          }
        </tbody>
      </table>
    }
  `,
  styles: `
    :host { display: block; }
    .plot { position: relative; }
    svg { display: block; overflow: visible; }
    .grid { stroke: var(--tb-border); stroke-width: 1; }
    .tick { fill: var(--tb-text-subtle); font-size: 11px; font-variant-numeric: tabular-nums; }
    .bar { fill: var(--tb-primary-500); transition: opacity 0.12s; }
    .bar.dim { opacity: 0.45; }
    .hit { fill: transparent; cursor: default; outline: none; }
    .hit:focus-visible { stroke: var(--tb-primary-700); stroke-width: 1.5; }
    .tooltip { position: absolute; transform: translate(-50%, calc(-100% - 8px)); pointer-events: none; background: var(--tb-text); color: #fff; padding: 6px 10px; border-radius: var(--tb-radius-sm); font-size: var(--tb-text-xs); white-space: nowrap; display: flex; flex-direction: column; box-shadow: var(--tb-shadow-md); }
    .tooltip strong { font-size: var(--tb-text-md); }
    .toggle { margin-top: var(--tb-space-2); border: 0; background: none; padding: 0; font: inherit; font-size: var(--tb-text-xs); color: var(--tb-primary-700); cursor: pointer; }
    table { margin-top: var(--tb-space-2); border-collapse: collapse; font-size: var(--tb-text-sm); font-variant-numeric: tabular-nums; }
    th, td { padding: 2px 16px 2px 0; text-align: left; font-weight: var(--tb-weight-regular); color: var(--tb-text-muted); }
    td { color: var(--tb-text); text-align: right; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarChart {
  protected readonly t = inject(I18nService).t;
  readonly data = input.required<BarDatum[]>();
  readonly label = input.required<string>();
  readonly height = input(200);

  protected readonly margin = MARGIN;
  protected readonly width = signal(600);
  protected readonly hovered = signal<number | null>(null);
  protected readonly showTable = signal(false);

  protected readonly layout = computed(() => {
    const data = this.data();
    const width = this.width();
    const plotW = Math.max(width - MARGIN.left - MARGIN.right, 1);
    const plotH = this.height() - MARGIN.top - MARGIN.bottom;
    const base = MARGIN.top + plotH;
    const max = Math.max(...data.map((d) => d.value), 0);
    const step = niceStep(max);
    const top = Math.max(Math.ceil(max / step) * step, step);
    const ticks = [];
    for (let v = 0; v <= top; v += step) ticks.push({ value: v, text: String(v), y: base - (v / top) * plotH });

    const band = plotW / Math.max(data.length, 1);
    const barW = Math.min(BAR_MAX, band * 0.6);
    const labelEvery = Math.max(1, Math.ceil(56 / band));
    const bars = data.map((d, index) => {
      const h = (d.value / top) * plotH;
      const x = MARGIN.left + index * band + (band - barW) / 2;
      const y = base - h;
      const r = Math.min(RADIUS, h, barW / 2);
      const path =
        h > 0
          ? `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${base} Z`
          : null;
      return {
        ...d,
        index,
        path,
        cx: x + barW / 2,
        top: y,
        hitX: MARGIN.left + index * band,
        hitW: band,
        showLabel: (data.length - 1 - index) % labelEvery === 0,
      };
    });
    return { ticks, bars, plotH };
  });

  protected readonly tooltip = computed(() => {
    const index = this.hovered();
    if (index === null) return null;
    const bar = this.layout().bars[index];
    return bar ? { x: bar.cx, y: Math.min(bar.top, MARGIN.top + this.layout().plotH), title: bar.title, value: bar.value } : null;
  });

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const observer = new ResizeObserver(([entry]) => this.width.set(Math.floor(entry.contentRect.width)));
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
