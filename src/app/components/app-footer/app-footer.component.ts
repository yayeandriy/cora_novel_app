import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Minimal Doc interface (mirrors other components)
interface Doc {
  id: number;
  text?: string | null;
}

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app-footer.component.html',
  styleUrls: ['./app-footer.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppFooterComponent {
  // Inputs
  @Input() selectedDoc: Doc | null = null;
  @Input() allDocs: Doc[] = [];
  @Input() leftCollapsed: boolean = false;
  @Input() rightCollapsed: boolean = false;

  // Action outputs (migrated from doc tree & editor footers)
  @Output() backToProjects = new EventEmitter<void>();
  @Output() createGroup = new EventEmitter<void>();
  @Output() importFolders = new EventEmitter<void>();
  @Output() importFiles = new EventEmitter<void>();
  @Output() exportProject = new EventEmitter<void>();
  // editorWidthPxChange removed as control moved to editor
  @Output() toggleLeft = new EventEmitter<void>();
  @Output() toggleRight = new EventEmitter<void>();
  @Output() toggleAll = new EventEmitter<void>();

  get isFullWidth(): boolean {
    return this.leftCollapsed && this.rightCollapsed;
  }

  // === Stats (mirroring previous editor footer logic) ===

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
