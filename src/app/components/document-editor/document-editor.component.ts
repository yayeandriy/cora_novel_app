import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, ChangeDetectionStrategy, OnInit, OnDestroy, OnChanges, SimpleChanges, AfterViewInit } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { Draft } from '../../shared/models';

export interface Doc {
  id: number;
  name?: string | null;
  project_id: number;
  doc_group_id?: number | null;
  sort_order?: number | null;
  text?: string | null;
  notes?: string | null;
  path?: string;
  timeline_id?: number | null;
}

@Component({
  selector: 'app-document-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './document-editor.component.html',
  styleUrls: ['./document-editor.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentEditorComponent implements OnInit, OnDestroy, OnChanges, AfterViewInit {
  @Input() selectedDoc: Doc | null = null;
  @Input() docIndexLabel: string | null = null;
  @Input() showSaveStatus: boolean = false;
  @Input() hasUnsavedChanges: boolean = false;
  @Input() allProjectDocs: Doc[] = [];
  // Drafts integration
  @Input() drafts: Draft[] = [];
  @Input() draftSyncStatus: Record<number, 'syncing' | 'synced' | 'pending'> = {};
  @Input() selectedDraftId: number | null = null;
  // External draft mode (e.g., folder draft shown in split while editing a doc)
  @Input() externalMode: boolean = false;
  @Input() externalDraftId: number | null = null;
  @Input() externalDraftName: string | null = null;
  @Input() externalDraftContent: string = '';
  
  @Output() draftAdd = new EventEmitter<void>();
  @Output() draftSelect = new EventEmitter<number | null>();
  @Output() draftRenamed = new EventEmitter<{ id: number; name: string }>();
  @Output() draftChanged = new EventEmitter<{ draftId: number; content: string; cursorPosition: number }>();
  @Output() draftBlurred = new EventEmitter<number>();
  @Output() draftDeleted = new EventEmitter<number>();
  
  @Output() docNameChange = new EventEmitter<Doc>();
  @Output() docTextChange = new EventEmitter<void>();
  @Output() docSaved = new EventEmitter<void>();
  
  @ViewChild('docTitleInput') docTitleInput?: ElementRef<HTMLInputElement>;
  @ViewChild('editorTextarea') editorTextarea?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('draftTextarea') draftTextarea?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('draftNameInput') draftNameInput?: ElementRef<HTMLInputElement>;
  @ViewChild('splitContainer') splitContainer?: ElementRef<HTMLDivElement>;

  // Inline rename state
  editingDraftId: number | null = null;
  draftNameEdit: string = '';
  private clickTimer: any;

  // Split state
  isSplitCollapsed: boolean = true; // default collapsed by default until a saved state is loaded
  draftPaneWidth: number = 360; // right pane width in px
  private resizing = false;
  private moveListener?: (e: MouseEvent) => void;
  private upListener?: (e: MouseEvent) => void;

  private readonly WIDTH_KEY_GLOBAL = 'cora-editor-split-width';
  private readonly COLLAPSE_KEY_GLOBAL = 'cora-editor-split-collapsed';
  private readonly COLUMN_PCT_KEY_GLOBAL = 'cora-editor-column-pct';
  private loadedProjectId: number | null = null;
  // Draft controls follow split visibility (no separate collapse state)

  private getWidthKey(): string {
    const pid = this.selectedDoc?.project_id;
    return pid ? `${this.WIDTH_KEY_GLOBAL}-${pid}` : this.WIDTH_KEY_GLOBAL;
  }

  private getCollapseKey(): string {
    const pid = this.selectedDoc?.project_id;
    return pid ? `${this.COLLAPSE_KEY_GLOBAL}-${pid}` : this.COLLAPSE_KEY_GLOBAL;
  }

  // Visual column width for the primary (and draft) textareas as % of pane width
  editorWidthPct: number = 100;

  private getColumnPctKey(): string {
    const pid = this.selectedDoc?.project_id;
    return pid ? `${this.COLUMN_PCT_KEY_GLOBAL}-${pid}` : this.COLUMN_PCT_KEY_GLOBAL;
  }

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    // Load generic fallback immediately; project-scoped keys will override on first selectedDoc change
    try {
      const savedWidth = localStorage.getItem(this.WIDTH_KEY_GLOBAL);
      if (savedWidth) {
        const w = parseInt(savedWidth, 10);
        if (!Number.isNaN(w) && w >= 200 && w <= 1200) this.draftPaneWidth = w;
      }
      const savedCollapsed = localStorage.getItem(this.COLLAPSE_KEY_GLOBAL);
      if (savedCollapsed) {
        this.isSplitCollapsed = savedCollapsed === 'true';
      }
      const savedCol = localStorage.getItem(this.COLUMN_PCT_KEY_GLOBAL);
      if (savedCol) {
        const pct = parseInt(savedCol, 10);
        if (!Number.isNaN(pct)) this.editorWidthPct = Math.max(20, Math.min(100, pct));
      }
    } catch {}
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedDoc'] && this.selectedDoc?.project_id) {
      const pid = this.selectedDoc.project_id;
      if (this.loadedProjectId !== pid) {
        this.loadedProjectId = pid;
        // Load project-scoped values, with fallback to global if missing
        try {
          const wStr = localStorage.getItem(this.getWidthKey()) || localStorage.getItem(this.WIDTH_KEY_GLOBAL);
          if (wStr) {
            const w = parseInt(wStr, 10);
            if (!Number.isNaN(w)) this.draftPaneWidth = Math.max(200, Math.min(1200, w));
          }
          const cStr = localStorage.getItem(this.getCollapseKey());
          if (cStr == null) {
            const globalC = localStorage.getItem(this.COLLAPSE_KEY_GLOBAL);
            if (globalC != null) this.isSplitCollapsed = globalC === 'true';
          } else {
            this.isSplitCollapsed = cStr === 'true';
          }
          const colStr = localStorage.getItem(this.getColumnPctKey()) || localStorage.getItem(this.COLUMN_PCT_KEY_GLOBAL);
          if (colStr) {
            const pct = parseInt(colStr, 10);
            if (!Number.isNaN(pct)) this.editorWidthPct = Math.max(20, Math.min(100, pct));
          }
        } catch {}
        // After view updates, ensure width fits the current container and persist if clamped
        setTimeout(() => this.adjustWidthToContainer(), 0);
        this.cdr.markForCheck();
      }
    }
    // If external mode requested, ensure split is expanded
    if (changes['externalMode'] && this.externalMode) {
      if (this.isSplitCollapsed) {
        this.isSplitCollapsed = false;
        try { localStorage.setItem(this.getCollapseKey(), 'false'); } catch {}
        setTimeout(() => this.adjustWidthToContainer(), 0);
      }
    }
    // Recompute textarea sizes when doc or draft context changes
    if (changes['selectedDoc'] || changes['selectedDraftId'] || changes['externalMode'] || changes['externalDraftId']) {
      setTimeout(() => { this.autoSizePrimary(); this.autoSizeDraft(); }, 0);
    }
  }

  ngOnDestroy(): void {
    this.detachResizeListeners();
  }

  focusEditor() {
    this.editorTextarea?.nativeElement.focus();
  }

  // Draft helpers
  get selectedDraft() {
    if (this.externalMode && this.externalDraftId != null) {
      return { id: this.externalDraftId, name: this.externalDraftName ?? 'Draft', content: this.externalDraftContent } as any;
    }
    return this.drafts.find(d => d.id === this.selectedDraftId) || null;
  }

  addDraft() {
    this.draftAdd.emit();
  }

  selectDraft(id: number) {
    this.draftSelect.emit(id);
    setTimeout(() => this.draftTextarea?.nativeElement.focus(), 0);
  }

  // Click to select, click again (not double-click) to collapse (deselect)
  selectOrToggle(id: number, event: MouseEvent) {
    // If different draft, select immediately
    if (this.selectedDraftId !== id) {
      if (this.clickTimer) { clearTimeout(this.clickTimer); this.clickTimer = null; }
      this.draftSelect.emit(id);
      setTimeout(() => this.draftTextarea?.nativeElement.focus(), 0);
      return;
    }
    // Same draft: schedule collapse unless a dblclick occurs
    if (this.clickTimer) { clearTimeout(this.clickTimer); }
    this.clickTimer = setTimeout(() => {
      this.draftSelect.emit(null);
      this.clickTimer = null;
    }, 220); // allow dblclick to cancel within this window
  }

  // Draft name editing
  startEditDraftName(draftId: number, currentName: string) {
    if (this.clickTimer) { clearTimeout(this.clickTimer); this.clickTimer = null; }
    this.editingDraftId = draftId;
    this.draftNameEdit = currentName;
    // Ensure selected for split view
    if (this.selectedDraftId !== draftId) {
      this.draftSelect.emit(draftId);
    }
    setTimeout(() => {
      const el = this.draftNameInput?.nativeElement;
      if (el) { el.focus(); el.select(); }
    }, 0);
  }

  saveDraftName() {
    if (this.editingDraftId == null) return;
    const newName = (this.draftNameEdit || '').trim();
    const id = this.editingDraftId;
    this.editingDraftId = null;
    if (!newName) return; // no empty names
    this.draftRenamed.emit({ id, name: newName });
  }

  cancelDraftNameEdit() {
    this.editingDraftId = null;
  }

  onClickDeleteDraft(draftId: number) {
    // Emit delete without triggering input blur-save
    this.draftDeleted.emit(draftId);
    this.editingDraftId = null;
  }

  // Split handlers
  startResize(event: MouseEvent) {
    event.preventDefault();
    this.resizing = true;
    document.body.style.userSelect = 'none';
    const container = this.splitContainer?.nativeElement;
    if (!container) return;

    this.moveListener = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const dividerX = e.clientX;
      const rightWidthPx = Math.round(rect.right - dividerX);
      // Clamp between 200px and container width - 200px
      const clamped = Math.max(200, Math.min(rect.width - 200, rightWidthPx));
      this.draftPaneWidth = clamped;
      try { localStorage.setItem(this.getWidthKey(), String(this.draftPaneWidth)); } catch {}
      this.cdr.markForCheck();
    };

    this.upListener = () => {
      this.resizing = false;
      document.body.style.userSelect = '';
      this.detachResizeListeners();
    };

    window.addEventListener('mousemove', this.moveListener);
    window.addEventListener('mouseup', this.upListener, { once: true });
  }

  private detachResizeListeners() {
    if (this.moveListener) {
      window.removeEventListener('mousemove', this.moveListener);
      this.moveListener = undefined;
    }
    if (this.upListener) {
      window.removeEventListener('mouseup', this.upListener);
      this.upListener = undefined;
    }
  }

  toggleCollapse() {
    this.isSplitCollapsed = !this.isSplitCollapsed;
    try { localStorage.setItem(this.getCollapseKey(), String(this.isSplitCollapsed)); } catch {}
    if (!this.isSplitCollapsed) {
      // Just expanded: make sure width is valid for current container
      setTimeout(() => this.adjustWidthToContainer(), 0);
    }
  }

  expandDrafts() {
    if (this.isSplitCollapsed) {
      this.isSplitCollapsed = false;
      try { localStorage.setItem(this.getCollapseKey(), 'false'); } catch {}
      setTimeout(() => this.adjustWidthToContainer(), 0);
      this.cdr.markForCheck();
    }
  }

  toggleDraftControls() {
    // Directly toggle the split; toolbar visibility follows split state
    this.isSplitCollapsed = !this.isSplitCollapsed;
    try { localStorage.setItem(this.getCollapseKey(), String(this.isSplitCollapsed)); } catch {}
    if (!this.isSplitCollapsed) setTimeout(() => this.adjustWidthToContainer(), 0);
    this.cdr.markForCheck();
  }

  private adjustWidthToContainer() {
    // If user is actively resizing, don't override their in-progress size.
    if (this.resizing) return;
    const container = this.splitContainer?.nativeElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    // If no draft selected, container may not be fully laid out yet
    if (!rect || rect.width <= 0) return;
    const maxRight = Math.max(200, rect.width - 200);
    const clamped = Math.max(200, Math.min(maxRight, this.draftPaneWidth));
    if (clamped !== this.draftPaneWidth) {
      this.draftPaneWidth = clamped;
      try { localStorage.setItem(this.getWidthKey(), String(this.draftPaneWidth)); } catch {}
      this.cdr.markForCheck();
    }
  }

  onDraftInput(event: Event, draftId: number) {
    const target = event.target as HTMLTextAreaElement;
    this.draftChanged.emit({ draftId, content: target.value, cursorPosition: target.selectionStart });
    this.autoSizeDraft();
  }

  onDraftBlur(draftId: number) {
    this.draftBlurred.emit(draftId);
  }

  focusTitle() {
    const el = this.docTitleInput?.nativeElement;
    if (el) {
      el.focus();
      el.select();
    }
  }

  onTitleChange(doc: Doc) {
    this.docNameChange.emit(doc);
  }

  // Compute an appropriate input size so the full title is visible in the header
  getDocTitleSize(): number {
    const len = this.selectedDoc?.name ? this.selectedDoc.name.length : 0;
    // Add 1 extra character for caret/padding headroom
    return Math.max(1, len + 1);
  }

  onTextChange() {
    this.docTextChange.emit();
    this.autoSizePrimary();
  }

  onBlur() {
    this.docSaved.emit();
  }

  private autoSizePrimary() {
    const el = this.editorTextarea?.nativeElement;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200000) + 'px';
  }

  private autoSizeDraft() {
    const el = this.draftTextarea?.nativeElement;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200000) + 'px';
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.autoSizePrimary();
      this.autoSizeDraft();
    }, 0);
  }

  onEditorWidthChange() {
  const pct = Math.max(20, Math.min(100, this.editorWidthPct | 0));
    this.editorWidthPct = pct;
    try { localStorage.setItem(this.getColumnPctKey(), String(pct)); } catch {}
    // Textareas center via CSS; no further action needed
    this.cdr.markForCheck();
  }

  // Document statistics
  getDocCharCount(): number {
    if (!this.selectedDoc?.text) return 0;
    return this.selectedDoc.text.length;
  }

  getDocWordCount(): number {
    if (!this.selectedDoc?.text) return 0;
    const words = this.selectedDoc.text.split(/\s+/).filter(w => w.trim().length > 0);
    return words.length;
  }

  getDocPageCount(): number {
    // Standard: 1 page = 1800 characters (including spaces)
    const chars = this.getDocCharCount();
    return Math.ceil(chars / 1800);
  }

  // Project statistics
  getProjectCharCount(): number {
    return this.allProjectDocs.reduce((total, doc) => {
      return total + (doc.text?.length || 0);
    }, 0);
  }

  getProjectWordCount(): number {
    return this.allProjectDocs.reduce((total, doc) => {
      if (!doc.text) return total;
      const words = doc.text.split(/\s+/).filter(w => w.trim().length > 0);
      return total + words.length;
    }, 0);
  }

  getProjectPageCount(): number {
    const chars = this.getProjectCharCount();
    return Math.ceil(chars / 1800);
  }

  // Format large numbers with K suffix
  formatNumber(num: number): string {
    if (num >= 1000) {
      return Math.floor(num / 1000) + 'K';
    }
    return num.toString();
  }
}
