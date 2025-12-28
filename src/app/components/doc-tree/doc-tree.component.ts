import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragPreview } from '@angular/cdk/drag-drop';
import type { CdkDragDrop } from '@angular/cdk/drag-drop';
import { moveItemInArray } from '@angular/cdk/drag-drop';

export interface DocGroup {
  id: number;
  name: string;
  project_id: number;
  parent_id?: number | null;
  sort_order?: number | null;
  expanded: boolean;
  docs: Doc[];
  groups?: DocGroup[];
}

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
  selector: 'app-doc-tree',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, CdkDragPreview],
  templateUrl: './doc-tree.component.html',
  styleUrls: ['./doc-tree.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocTreeComponent {
  @Input() docGroups: DocGroup[] = [];
  @Input() selectedDoc: Doc | null = null;
  @Input() selectedGroup: DocGroup | null = null;
  @Input() projectName: string = '';
  @Input() editingProjectName: boolean = false;
  @Input() projectNameEdit: string = '';
  @Input() groupsWithDrafts: Set<number> = new Set<number>();
  @Input() docsWithDrafts: Set<number> = new Set<number>();
  @Input() currentWorkingDocId: number | null = null;
  
  @Output() groupSelected = new EventEmitter<{ group: DocGroup; event?: MouseEvent }>();
  @Output() docSelected = new EventEmitter<Doc>();
  @Output() groupToggled = new EventEmitter<DocGroup>();
  @Output() groupCreated = new EventEmitter<void>();
  @Output() docCreatedInGroup = new EventEmitter<DocGroup>();
  @Output() docDeleted = new EventEmitter<Doc>();
  @Output() groupDeleted = new EventEmitter<DocGroup>();
  @Output() workingDocChanged = new EventEmitter<number>();
  @Output() importRequested = new EventEmitter<void>();
  @Output() importFoldersRequested = new EventEmitter<void>();
  @Output() importFilesRequested = new EventEmitter<void>();
  @Output() exportProjectRequested = new EventEmitter<void>();
  @Output() docDropped = new EventEmitter<{
    docId: number;
    sourceGroupId: number;
    targetGroupId: number;
    previousIndex: number;
    currentIndex: number;
  }>();
  @Output() treeKeyDown = new EventEmitter<KeyboardEvent>();
  @Output() widthChanged = new EventEmitter<number>();
  @Output() collapseToggle = new EventEmitter<void>();
  // Project name editing events (delegated to parent)
  @Output() projectNameEditStart = new EventEmitter<MouseEvent>();
  @Output() projectNameSave = new EventEmitter<void>();
  @Output() projectNameKeydown = new EventEmitter<KeyboardEvent>();
  @Output() projectNameEditChange = new EventEmitter<string>();
  @Output() backClicked = new EventEmitter<void>();
  
  @ViewChild('docTree') docTree?: ElementRef<HTMLDivElement>;
  @ViewChild('projectNameInput') projectNameInput?: ElementRef<HTMLTextAreaElement>;
  
  leftWidth = 250;
  isResizing = false;
  hoveredDocId: number | null = null;
  hoveredGroupId: number | null = null;

  constructor(private cdr: ChangeDetectorRef) {}

  // NOTE: doc reordering uses Angular CDK drag-drop (like metadata chips)

  selectGroup(group: DocGroup, event?: MouseEvent) {
    this.groupSelected.emit({ group, event });
  }

  selectDoc(doc: Doc) {
    this.docSelected.emit(doc);
  }

  setWorkingDoc(doc: Doc, event: MouseEvent) {
    event.stopPropagation();
    this.workingDocChanged.emit(doc.id);
  }

  onDocsDrop(groupId: number, event: CdkDragDrop<Doc[]>): void {
    // Only allow reordering inside the same group list.
    if (event.previousContainer !== event.container) return;
    if (!event.container.data) return;
    if (event.previousIndex === event.currentIndex) return;

    // Mutate the underlying array immediately so the UI doesn't "snap back".
    moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);

    const dragged = event.item.data as Doc | undefined;
    if (!dragged) return;

    this.docDropped.emit({
      docId: dragged.id,
      sourceGroupId: groupId,
      targetGroupId: groupId,
      previousIndex: event.previousIndex,
      currentIndex: event.currentIndex,
    });
  }

  toggleGroup(group: DocGroup, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    this.groupToggled.emit(group);
  }

  createGroup() {
    this.groupCreated.emit();
  }

  requestImport() {
    this.importRequested.emit();
  }

  requestImportFolders() {
    this.importFoldersRequested.emit();
  }

  requestImportFiles() {
    this.importFilesRequested.emit();
  }

  requestExportProject() {
    this.exportProjectRequested.emit();
  }

  createDocInGroup(group: DocGroup, event: MouseEvent) {
    event.stopPropagation();
    this.docCreatedInGroup.emit(group);
  }

  deleteDoc(doc: Doc, event: MouseEvent) {
    event.stopPropagation();
    this.docDeleted.emit(doc);
  }

  deleteGroup(group: DocGroup, event: MouseEvent) {
    event.stopPropagation();
    this.groupDeleted.emit(group);
  }

  handleTreeKeyDown(event: KeyboardEvent) {
    this.treeKeyDown.emit(event);
  }

  focusTree() {
    this.docTree?.nativeElement.focus();
  }

  startResize(event: MouseEvent) {
    this.isResizing = true;
    event.preventDefault();
    
    const onMouseMove = (e: MouseEvent) => {
      if (this.isResizing) {
        this.leftWidth = Math.max(200, Math.min(600, e.clientX));
        this.widthChanged.emit(this.leftWidth);
      }
    };
    
    const onMouseUp = () => {
      this.isResizing = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  onToggleCollapse() {
    this.collapseToggle.emit();
  }

  startEditProjectName(event: MouseEvent) {
    event.stopPropagation();
    this.projectNameEditStart.emit(event);
    // Manually trigger change detection after parent has processed the event
    setTimeout(() => {
      this.cdr.detectChanges();
      // Focus the input after Angular renders it
      setTimeout(() => {
        if (this.projectNameInput) {
          const textarea = this.projectNameInput.nativeElement;
          textarea.focus();
          textarea.select();
          // Auto-resize to fit content
          this.resizeTextarea(textarea);
        }
      }, 10);
    }, 10);
  }

  autoResizeTextarea(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    this.resizeTextarea(textarea);
  }

  private resizeTextarea(textarea: HTMLTextAreaElement) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  onProjectNameKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.projectNameSave.emit();
    }
    this.projectNameKeydown.emit(event);
  }
}
