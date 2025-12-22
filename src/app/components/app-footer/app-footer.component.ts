import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Minimal Doc interface (mirrors other components)
interface Doc {
  id: number;
  text?: string | null;
}

// Minimal DocGroup interface
interface DocGroup {
  id: number;
  name: string;
}

export type FontFamily = 'mono' | 'serif' | 'sans';
export type FontSize = 'S' | 'M' | 'L';
export type LineHeight = 'S' | 'M' | 'L';

const FONT_FAMILIES: Record<FontFamily, string> = {
  'mono': "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', Courier, monospace",
  'serif': "'Times New Roman', Georgia, serif",
  'sans': "'Helvetica Neue', Helvetica, Arial, sans-serif"
};

const FONT_SIZES: Record<FontSize, string> = {
  'S': '0.875rem',
  'M': '1rem',
  'L': '1.125rem'
};

const SERIF_FONT_SIZES: Record<FontSize, string> = {
  'S': '1rem',
  'M': '1.125rem',
  'L': '1.25rem'
};

const SANS_FONT_SIZES: Record<FontSize, string> = {
  'S': '1rem',
  'M': '1.125rem',
  'L': '1.25rem'
};

const LINE_HEIGHTS: Record<LineHeight, string> = {
  'S': '1.5',
  'M': '1.75',
  'L': '2'
};

const SERIF_LINE_HEIGHTS: Record<LineHeight, string> = {
  'S': '1.35',
  'M': '1.5',
  'L': '1.65'
};

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app-footer.component.html',
  styleUrls: ['./app-footer.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppFooterComponent implements OnInit {
  @ViewChild('statsDock', { read: ElementRef }) private statsDockEl?: ElementRef<HTMLElement>;
  @ViewChild('toolsDock', { read: ElementRef }) private toolsDockEl?: ElementRef<HTMLElement>;

  // Inputs
  @Input() selectedDoc: Doc | null = null;
  @Input() selectedGroup: DocGroup | null = null;
  @Input() allDocs: Doc[] = [];  
  @Input() leftCollapsed: boolean = false;
  @Input() rightCollapsed: boolean = false;

  // Action outputs (migrated from doc tree & editor docker)
  @Output() backToProjects = new EventEmitter<void>();
  @Output() createGroup = new EventEmitter<void>();
  @Output() deleteItem = new EventEmitter<void>();
  @Output() importFolders = new EventEmitter<void>();
  @Output() importFiles = new EventEmitter<void>();
  @Output() exportProject = new EventEmitter<void>();
  @Output() toggleLeft = new EventEmitter<void>();
  @Output() toggleRight = new EventEmitter<void>();
  @Output() toggleAll = new EventEmitter<void>();

  // Typography settings
  fontFamily: FontFamily = 'mono';
  fontSize: FontSize = 'M';
  lineHeight: LineHeight = 'M';

  // Tools dock UI state
  toolsCollapsed = false;

  // Inline style for shifting the centered stats dock when needed.
  statsDockTransform = 'translateX(-50%)';

  private resizeObserver?: ResizeObserver;
  private layoutRaf: number | null = null;
  private readonly dockGapPx = 16; // keep a small visual gap between pills
  private readonly edgePaddingPx = 16; // keep stats pill at least 1rem from viewport edge

  private onWindowResize = () => {
    this.scheduleDockLayout();
  };

  toggleToolsCollapsed() {
    this.toolsCollapsed = !this.toolsCollapsed;
    this.scheduleDockLayout();
  }

  ngOnInit() {
    this.loadTypographySettings();
    this.applyTypographySettings();
  }

  ngAfterViewInit() {
    // Watch for size changes so the centered stats pill can dodge the tools pill.
    this.resizeObserver = new ResizeObserver(() => this.scheduleDockLayout());
    if (this.statsDockEl?.nativeElement) this.resizeObserver.observe(this.statsDockEl.nativeElement);
    if (this.toolsDockEl?.nativeElement) this.resizeObserver.observe(this.toolsDockEl.nativeElement);

    window.addEventListener('resize', this.onWindowResize);
    this.scheduleDockLayout();
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.onWindowResize);
    this.resizeObserver?.disconnect();
    if (this.layoutRaf != null) {
      cancelAnimationFrame(this.layoutRaf);
      this.layoutRaf = null;
    }
  }

  private scheduleDockLayout(): void {
    if (this.layoutRaf != null) cancelAnimationFrame(this.layoutRaf);
    this.layoutRaf = requestAnimationFrame(() => {
      this.layoutRaf = null;
      this.recomputeStatsDockShift();
    });
  }

  private recomputeStatsDockShift(): void {
    const statsEl = this.statsDockEl?.nativeElement;
    const toolsEl = this.toolsDockEl?.nativeElement;
    if (!statsEl || !toolsEl) {
      this.statsDockTransform = 'translateX(-50%)';
      return;
    }

    const statsRect = statsEl.getBoundingClientRect();
    const toolsRect = toolsEl.getBoundingClientRect();

    // Only care about horizontal overlap; the tools dock sits to the right.
    const maxStatsRight = toolsRect.left - this.dockGapPx;
    let shiftPx = 0;
    const overlap = statsRect.right - maxStatsRight;
    if (overlap > 0) {
      // Shift stats left by the overlap amount.
      shiftPx = -overlap;
    }

    // Clamp so stats pill doesn't go off-screen.
    const desiredLeft = statsRect.left + shiftPx;
    if (desiredLeft < this.edgePaddingPx) {
      shiftPx += (this.edgePaddingPx - desiredLeft);
    }

    if (shiftPx === 0) {
      this.statsDockTransform = 'translateX(-50%)';
      return;
    }
    const abs = Math.round(Math.abs(shiftPx));
    const sign = shiftPx < 0 ? '-' : '+';
    this.statsDockTransform = `translateX(calc(-50% ${sign} ${abs}px))`;
  }

  private loadTypographySettings() {
    try {
      const savedFont = localStorage.getItem('cora-typography-font') as FontFamily;
      const savedSize = localStorage.getItem('cora-typography-size') as FontSize;
      const savedLeading = localStorage.getItem('cora-typography-leading') as LineHeight;
      
      if (savedFont && ['mono', 'serif', 'sans'].includes(savedFont)) {
        this.fontFamily = savedFont;
      }
      if (savedSize && ['S', 'M', 'L'].includes(savedSize)) {
        this.fontSize = savedSize;
      }
      if (savedLeading && ['S', 'M', 'L'].includes(savedLeading)) {
        this.lineHeight = savedLeading;
      }
    } catch {}
  }

  private saveTypographySettings() {
    try {
      localStorage.setItem('cora-typography-font', this.fontFamily);
      localStorage.setItem('cora-typography-size', this.fontSize);
      localStorage.setItem('cora-typography-leading', this.lineHeight);
    } catch {}
  }

  private applyTypographySettings() {
    document.documentElement.style.setProperty('--editor-font-family', FONT_FAMILIES[this.fontFamily]);
    const size = this.fontFamily === 'serif'
      ? SERIF_FONT_SIZES[this.fontSize]
      : this.fontFamily === 'sans'
        ? SANS_FONT_SIZES[this.fontSize]
        : FONT_SIZES[this.fontSize];
    document.documentElement.style.setProperty('--editor-font-size', size);
    const leading = this.fontFamily === 'serif'
      ? SERIF_LINE_HEIGHTS[this.lineHeight]
      : LINE_HEIGHTS[this.lineHeight];
    document.documentElement.style.setProperty('--editor-line-height', leading);
  }

  setFontFamily(font: FontFamily) {
    this.fontFamily = font;
    this.saveTypographySettings();
    this.applyTypographySettings();
    this.scheduleDockLayout();
  }

  setFontSize(size: FontSize) {
    this.fontSize = size;
    this.saveTypographySettings();
    this.applyTypographySettings();
    this.scheduleDockLayout();
  }

  setLineHeight(height: LineHeight) {
    this.lineHeight = height;
    this.saveTypographySettings();
    this.applyTypographySettings();
    this.scheduleDockLayout();
  }

  get isFullWidth(): boolean {
    return this.leftCollapsed && this.rightCollapsed;
  }

  // === Stats (mirroring previous editor docker logic) ===

  get docCharCount(): number {
    if (!this.selectedDoc?.text) return 0;
    return this.selectedDoc.text.length;
  }
  get docWordCount(): number {
    if (!this.selectedDoc?.text) return 0;
    return this.selectedDoc.text.split(/\s+/).filter(w => w.trim().length > 0).length;
  }
  get docPageCount(): number { return Math.ceil(this.docCharCount / 1800); }
  get projectCharCount(): number {
    return this.allDocs.reduce((t, d) => t + (d.text?.length || 0), 0);
  }
  get projectWordCount(): number {
    return this.allDocs.reduce((t, d) => {
      if (!d.text) return t;
      return t + d.text.split(/\s+/).filter(w => w.trim().length > 0).length;
    }, 0);
  }
  get projectPageCount(): number { return Math.ceil(this.projectCharCount / 1800); }

  formatNumber(num: number): string {
    if (num >= 1000) return Math.floor(num / 1000) + 'K';
    return num.toString();
  }
}
