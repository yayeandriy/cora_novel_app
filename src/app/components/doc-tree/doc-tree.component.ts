import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
  imports: [CommonModule, FormsModule],
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
  
  @Output() groupSelected = new EventEmitter<{ group: DocGroup; event?: MouseEvent }>();
  @Output() docSelected = new EventEmitter<Doc>();
  @Output() groupToggled = new EventEmitter<DocGroup>();
  @Output() groupCreated = new EventEmitter<void>();
  @Output() docCreatedInGroup = new EventEmitter<DocGroup>();
  @Output() importRequested = new EventEmitter<void>();
  @Output() importFoldersRequested = new EventEmitter<void>();
  @Output() importFilesRequested = new EventEmitter<void>();
  @Output() exportProjectRequested = new EventEmitter<void>();
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
  
  leftWidth = 250;
  isResizing = false;

  selectGroup(group: DocGroup, event?: MouseEvent) {
    this.groupSelected.emit({ group, event });
  }

  selectDoc(doc: Doc) {
    this.docSelected.emit(doc);
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
}
