import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, ChangeDetectionStrategy, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface DocGroup {
  id: number;
  name: string;
  project_id: number;
  parent_id?: number | null;
  sort_order?: number | null;
  expanded: boolean;
  docs: any[];
  groups?: DocGroup[];
}

@Component({
  selector: 'app-group-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './group-view.component.html',
  styleUrls: ['./group-view.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GroupViewComponent implements OnInit, OnChanges {
  @Input() selectedGroup: DocGroup | null = null;
  @Input() selectedFolderDraftId: number | null = null;
  @Input() selectedFolderDraftContent: string = '';
  @Output() folderDraftChanged = new EventEmitter<{ draftId: number; content: string; cursorPosition: number }>();
  @Output() folderDraftBlurred = new EventEmitter<number>();
  
  @Output() groupNameChange = new EventEmitter<DocGroup>();
  @Output() createDocRequested = new EventEmitter<void>();
  @Output() focusTreeRequested = new EventEmitter<void>();
  
  @ViewChild('groupNameInput') groupNameInput?: ElementRef<HTMLInputElement>;
  @ViewChild('folderDraftTextarea') folderDraftTextarea?: ElementRef<HTMLTextAreaElement>;

  // Split state (mirrors document editor, but scoped for folders per project)
  isSplitCollapsed: boolean = true;
  draftPaneWidth: number = 360;
  private resizing = false;
  private moveListener?: (e: MouseEvent) => void;
  private upListener?: (e: MouseEvent) => void;
  private readonly WIDTH_KEY_GLOBAL = 'cora-folder-split-width';
  private readonly COLLAPSE_KEY_GLOBAL = 'cora-folder-split-collapsed';

  onNameChange(group: DocGroup) {
    this.groupNameChange.emit(group);
  }

  onCreateDoc() {
    this.createDocRequested.emit();
  }

  focusName() {
    const el = this.groupNameInput?.nativeElement;
    if (el) {
      el.focus();
      el.select();
    }
  }

  onNameEnter(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    if (this.selectedGroup) {
      this.groupNameChange.emit(this.selectedGroup);
    }
    // Request focus to be switched back to tree
    this.focusTreeRequested.emit();
  }

  ngOnInit(): void {
    try {
      const savedWidth = localStorage.getItem(this.WIDTH_KEY_GLOBAL);
      if (savedWidth) {
        const w = parseInt(savedWidth, 10);
        if (!Number.isNaN(w) && w >= 200 && w <= 1200) this.draftPaneWidth = w;
      }
      const savedCollapsed = localStorage.getItem(this.COLLAPSE_KEY_GLOBAL);
      if (savedCollapsed) this.isSplitCollapsed = savedCollapsed === 'true';
    } catch {}
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedFolderDraftId']) {
      // Expand when a folder draft is selected
      if (this.selectedFolderDraftId != null) {
        this.expandSplit();
        setTimeout(() => this.folderDraftTextarea?.nativeElement.focus(), 0);
      }
    }
  }

  // Split handlers
  startResize(event: MouseEvent) {
    event.preventDefault();
    this.resizing = true;
    document.body.style.userSelect = 'none';
    const container = (event.currentTarget as HTMLElement).closest('.editor-split') as HTMLElement | null;
    if (!container) return;
    this.moveListener = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const rightWidthPx = Math.round(rect.right - e.clientX);
      const clamped = Math.max(200, Math.min(rect.width - 200, rightWidthPx));
      this.draftPaneWidth = clamped;
      try { localStorage.setItem(this.WIDTH_KEY_GLOBAL, String(this.draftPaneWidth)); } catch {}
    };
    this.upListener = () => {
      this.resizing = false;
      document.body.style.userSelect = '';
      if (this.moveListener) window.removeEventListener('mousemove', this.moveListener);
      if (this.upListener) window.removeEventListener('mouseup', this.upListener as any);
      this.moveListener = undefined;
      this.upListener = undefined;
    };
    window.addEventListener('mousemove', this.moveListener);
    window.addEventListener('mouseup', this.upListener as any, { once: true } as any);
  }

  toggleCollapse() {
    this.isSplitCollapsed = !this.isSplitCollapsed;
    try { localStorage.setItem(this.COLLAPSE_KEY_GLOBAL, String(this.isSplitCollapsed)); } catch {}
  }

  expandSplit() {
    if (this.isSplitCollapsed) {
      this.isSplitCollapsed = false;
      try { localStorage.setItem(this.COLLAPSE_KEY_GLOBAL, 'false'); } catch {}
    }
  }

  onFolderDraftInput(event: Event) {
    if (this.selectedFolderDraftId == null) return;
    const target = event.target as HTMLTextAreaElement;
    this.folderDraftChanged.emit({ draftId: this.selectedFolderDraftId, content: target.value, cursorPosition: target.selectionStart });
  }

  onFolderDraftBlur() {
    if (this.selectedFolderDraftId == null) return;
    this.folderDraftBlurred.emit(this.selectedFolderDraftId);
  }
}
