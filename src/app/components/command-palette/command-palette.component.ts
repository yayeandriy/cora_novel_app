import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export type CommandMode = 'commands' | 'search-doc' | 'search-project' | 'search-replace';

export interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  icon?: string;
  mode?: CommandMode;
  action?: () => void;
}

export interface SearchResult {
  docId: number;
  docName: string;
  groupName?: string;
  matches: Array<{
    lineNumber: number;
    lineText: string;
    matchStart: number;
    matchEnd: number;
  }>;
}

@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './command-palette.component.html',
  styleUrls: ['./command-palette.component.css']
})
export class CommandPaletteComponent implements OnInit, OnDestroy {
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  @ViewChild('replaceInput') replaceInput!: ElementRef<HTMLInputElement>;

  @Input() isOpen = false;
  @Input() docs: Array<{ id: number; name?: string | null; text?: string | null; doc_group_id?: number | null }> = [];
  @Input() groups: Array<{ id: number; name: string }> = [];
  @Input() currentDocId: number | null = null;
  @Input() currentDocText: string = '';

  @Output() close = new EventEmitter<void>();
  @Output() navigateToDoc = new EventEmitter<number>();
  @Output() navigateToDocAtPosition = new EventEmitter<{ docId: number; position: number }>();
  @Output() replaceInCurrentDoc = new EventEmitter<{ position: number; length: number; replacement: string }>();
  @Output() focusEditorAtPosition = new EventEmitter<number>();

  mode: CommandMode = 'commands';
  searchQuery = '';
  replaceQuery = '';
  selectedIndex = 0;
  searchResults: SearchResult[] = [];
  currentDocMatches: Array<{ lineNumber: number; lineText: string; matchStart: number; matchEnd: number; absolutePosition: number }> = [];
  
  // Case sensitivity toggle
  caseSensitive = false;
  
  // Replace in all chapters toggle (for search-replace mode)
  replaceInAllChapters = false;

  commands: CommandItem[] = [
    { id: 'search-doc', label: 'Search in Current Chapter', shortcut: '⌘F', icon: '🔍', mode: 'search-doc' },
    { id: 'search-project', label: 'Search in All Chapters', shortcut: '⌘⇧F', icon: '📁', mode: 'search-project' },
    { id: 'search-replace', label: 'Search and Replace', shortcut: '⌘H', icon: '🔄', mode: 'search-replace' },
    { id: 'goto-doc', label: 'Go to Chapter...', shortcut: '⌘P', icon: '📄' },
  ];

  filteredCommands: CommandItem[] = [];
  filteredDocs: Array<{ id: number; name: string; groupName?: string }> = [];

  private keydownHandler = (e: KeyboardEvent) => this.handleKeydown(e);

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.filteredCommands = [...this.commands];
    document.addEventListener('keydown', this.keydownHandler);
  }

  ngOnDestroy() {
    document.removeEventListener('keydown', this.keydownHandler);
  }

  open(initialMode: CommandMode = 'commands') {
    this.isOpen = true;
    this.mode = initialMode;
    this.searchQuery = '';
    this.replaceQuery = '';
    this.selectedIndex = 0;
    this.searchResults = [];
    this.currentDocMatches = [];
    this.replaceInAllChapters = false;
    this.filteredCommands = [...this.commands];
    this.filteredDocs = this.buildDocList();
    this.cdr.detectChanges();
    
    setTimeout(() => {
      this.searchInput?.nativeElement?.focus();
    }, 50);
  }

  closePanel() {
    this.isOpen = false;
    this.mode = 'commands';
    this.searchQuery = '';
    this.replaceQuery = '';
    this.close.emit();
  }

  private buildDocList(): Array<{ id: number; name: string; groupName?: string }> {
    return this.docs.map(doc => {
      const group = this.groups.find(g => g.id === doc.doc_group_id);
      return {
        id: doc.id,
        name: doc.name || 'Untitled',
        groupName: group?.name
      };
    });
  }

  onSearchChange() {
    this.selectedIndex = 0;
    
    switch (this.mode) {
      case 'commands':
        this.filterCommands();
        break;
      case 'search-doc':
        this.searchInCurrentDoc();
        break;
      case 'search-project':
        this.searchInProject();
        break;
      case 'search-replace':
        this.searchInCurrentDoc();
        break;
    }
  }

  private filterCommands() {
    const query = this.searchQuery.toLowerCase();
    
    // Check if it looks like a doc search (starts with > or has no special prefix)
    if (this.searchQuery.startsWith('>')) {
      // Command mode
      const cmdQuery = this.searchQuery.slice(1).toLowerCase();
      this.filteredCommands = this.commands.filter(cmd => 
        cmd.label.toLowerCase().includes(cmdQuery)
      );
      this.filteredDocs = [];
    } else if (this.searchQuery.startsWith('/')) {
      // Search in project mode
      this.mode = 'search-project';
      this.searchQuery = this.searchQuery.slice(1);
      this.searchInProject();
    } else {
      // Default: show both commands and docs
      this.filteredCommands = this.commands.filter(cmd => 
        cmd.label.toLowerCase().includes(query)
      );
      this.filteredDocs = this.buildDocList().filter(doc =>
        doc.name.toLowerCase().includes(query) ||
        (doc.groupName?.toLowerCase().includes(query) ?? false)
      );
    }
  }

  private searchInCurrentDoc() {
    this.currentDocMatches = [];
    if (!this.searchQuery || !this.currentDocText) return;

    const text = this.currentDocText;
    const query = this.caseSensitive ? this.searchQuery : this.searchQuery.toLowerCase();
    const searchText = this.caseSensitive ? text : text.toLowerCase();
    
    const lines = text.split('\n');
    let absolutePosition = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const searchLine = this.caseSensitive ? line : line.toLowerCase();
      let searchStart = 0;
      
      while (true) {
        const matchIndex = searchLine.indexOf(query, searchStart);
        if (matchIndex === -1) break;
        
        this.currentDocMatches.push({
          lineNumber: i + 1,
          lineText: line,
          matchStart: matchIndex,
          matchEnd: matchIndex + query.length,
          absolutePosition: absolutePosition + matchIndex
        });
        
        searchStart = matchIndex + 1;
      }
      
      absolutePosition += line.length + 1; // +1 for newline
    }
  }

  private searchInProject() {
    this.searchResults = [];
    if (!this.searchQuery) return;

    const query = this.caseSensitive ? this.searchQuery : this.searchQuery.toLowerCase();

    for (const doc of this.docs) {
      if (!doc.text) continue;
      
      const text = doc.text;
      const searchText = this.caseSensitive ? text : text.toLowerCase();
      const lines = text.split('\n');
      const matches: SearchResult['matches'] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const searchLine = this.caseSensitive ? line : line.toLowerCase();
        let searchStart = 0;
        
        while (true) {
          const matchIndex = searchLine.indexOf(query, searchStart);
          if (matchIndex === -1) break;
          
          matches.push({
            lineNumber: i + 1,
            lineText: line,
            matchStart: matchIndex,
            matchEnd: matchIndex + query.length
          });
          
          searchStart = matchIndex + 1;
        }
      }
      
      if (matches.length > 0) {
        const group = this.groups.find(g => g.id === doc.doc_group_id);
        this.searchResults.push({
          docId: doc.id,
          docName: doc.name || 'Untitled',
          groupName: group?.name,
          matches
        });
      }
    }
  }

  handleKeydown(e: KeyboardEvent) {
    if (!this.isOpen) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.closePanel();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      this.moveSelection(1);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      this.moveSelection(-1);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      this.executeSelection();
      return;
    }

    // Tab to switch between search and replace fields
    if (e.key === 'Tab' && this.mode === 'search-replace') {
      e.preventDefault();
      e.stopPropagation();
      if (document.activeElement === this.searchInput?.nativeElement) {
        this.replaceInput?.nativeElement?.focus();
      } else {
        this.searchInput?.nativeElement?.focus();
      }
      return;
    }
  }

  private moveSelection(delta: number) {
    const maxIndex = this.getMaxIndex();
    if (maxIndex < 0) return;
    
    this.selectedIndex = (this.selectedIndex + delta + maxIndex + 1) % (maxIndex + 1);
    this.cdr.detectChanges();
    
    // Scroll selected item into view
    setTimeout(() => {
      const selected = document.querySelector('.command-palette-item.selected');
      selected?.scrollIntoView({ block: 'nearest' });
    }, 0);
  }

  private getMaxIndex(): number {
    switch (this.mode) {
      case 'commands':
        return this.filteredCommands.length + this.filteredDocs.length - 1;
      case 'search-doc':
      case 'search-replace':
        return this.currentDocMatches.length - 1;
      case 'search-project':
        return this.searchResults.reduce((acc, r) => acc + r.matches.length, 0) - 1;
      default:
        return -1;
    }
  }

  executeSelection() {
    switch (this.mode) {
      case 'commands':
        this.executeCommandSelection();
        break;
      case 'search-doc':
        this.executeDocSearchSelection();
        break;
      case 'search-project':
        this.executeProjectSearchSelection();
        break;
      case 'search-replace':
        this.executeDocSearchSelection();
        break;
    }
  }

  private executeCommandSelection() {
    if (this.selectedIndex < this.filteredCommands.length) {
      const cmd = this.filteredCommands[this.selectedIndex];
      if (cmd.mode) {
        this.mode = cmd.mode;
        this.searchQuery = '';
        this.selectedIndex = 0;
        this.cdr.detectChanges();
        setTimeout(() => this.searchInput?.nativeElement?.focus(), 50);
      } else if (cmd.action) {
        cmd.action();
        this.closePanel();
      } else if (cmd.id === 'goto-doc') {
        // Show doc list
        this.filteredCommands = [];
        this.filteredDocs = this.buildDocList();
        this.selectedIndex = 0;
      }
    } else {
      // Selected a doc
      const docIndex = this.selectedIndex - this.filteredCommands.length;
      if (docIndex >= 0 && docIndex < this.filteredDocs.length) {
        const doc = this.filteredDocs[docIndex];
        this.navigateToDoc.emit(doc.id);
        this.closePanel();
      }
    }
  }

  private executeDocSearchSelection() {
    if (this.selectedIndex >= 0 && this.selectedIndex < this.currentDocMatches.length) {
      const match = this.currentDocMatches[this.selectedIndex];
      this.focusEditorAtPosition.emit(match.absolutePosition);
      this.closePanel();
    }
  }

  private executeProjectSearchSelection() {
    let currentIndex = 0;
    for (const result of this.searchResults) {
      for (const match of result.matches) {
        if (currentIndex === this.selectedIndex) {
          // Calculate absolute position in doc
          const doc = this.docs.find(d => d.id === result.docId);
          if (doc?.text) {
            const lines = doc.text.split('\n');
            let absolutePos = 0;
            for (let i = 0; i < match.lineNumber - 1; i++) {
              absolutePos += lines[i].length + 1;
            }
            absolutePos += match.matchStart;
            this.navigateToDocAtPosition.emit({ docId: result.docId, position: absolutePos });
          } else {
            this.navigateToDoc.emit(result.docId);
          }
          this.closePanel();
          return;
        }
        currentIndex++;
      }
    }
  }

  selectItem(index: number) {
    this.selectedIndex = index;
    this.executeSelection();
  }

  selectCommand(cmd: CommandItem) {
    if (cmd.mode) {
      this.mode = cmd.mode;
      this.searchQuery = '';
      this.selectedIndex = 0;
      this.cdr.detectChanges();
      setTimeout(() => this.searchInput?.nativeElement?.focus(), 50);
    }
  }

  selectDoc(doc: { id: number }) {
    this.navigateToDoc.emit(doc.id);
    this.closePanel();
  }

  selectMatch(index: number) {
    this.selectedIndex = index;
    this.executeDocSearchSelection();
  }

  selectProjectMatch(docId: number, matchIndex: number, absoluteIndex: number) {
    this.selectedIndex = absoluteIndex;
    this.executeProjectSearchSelection();
  }

  replaceOne() {
    if (!this.searchQuery || this.currentDocMatches.length === 0) return;
    
    // Get the currently selected match (or first one)
    const matchIndex = Math.min(this.selectedIndex, this.currentDocMatches.length - 1);
    const match = this.currentDocMatches[matchIndex];
    if (!match) return;
    
    this.replaceInCurrentDoc.emit({
      position: match.absolutePosition,
      length: this.searchQuery.length,
      replacement: this.replaceQuery
    });
    
    // Re-search after replace
    setTimeout(() => this.searchInCurrentDoc(), 50);
  }

  replaceAll() {
    if (!this.searchQuery) return;
    
    if (this.replaceInAllChapters) {
      // Replace in all chapters
      this.replaceInAllDocs();
    } else {
      // Replace in current chapter only
      if (this.currentDocMatches.length === 0) return;
      
      // Replace all matches from end to start to preserve positions
      const matches = [...this.currentDocMatches].sort((a, b) => b.absolutePosition - a.absolutePosition);
      
      for (const match of matches) {
        this.replaceInCurrentDoc.emit({
          position: match.absolutePosition,
          length: this.searchQuery.length,
          replacement: this.replaceQuery
        });
      }
    }
    
    this.closePanel();
  }
  
  private replaceInAllDocs() {
    // First, search in all docs to find all matches
    const query = this.caseSensitive ? this.searchQuery : this.searchQuery.toLowerCase();
    let totalReplacements = 0;
    
    for (const doc of this.docs) {
      if (!doc.text) continue;
      
      const text = doc.text;
      const searchText = this.caseSensitive ? text : text.toLowerCase();
      
      // Find all matches in this doc
      const matches: Array<{ position: number; length: number }> = [];
      let searchStart = 0;
      
      while (true) {
        const matchIndex = searchText.indexOf(query, searchStart);
        if (matchIndex === -1) break;
        
        matches.push({
          position: matchIndex,
          length: this.searchQuery.length
        });
        
        searchStart = matchIndex + 1;
      }
      
      // If this is the current doc, emit replacements
      if (matches.length > 0 && doc.id === this.currentDocId) {
        // Replace from end to start to preserve positions
        matches.sort((a, b) => b.position - a.position);
        
        for (const match of matches) {
          this.replaceInCurrentDoc.emit({
            position: match.position,
            length: match.length,
            replacement: this.replaceQuery
          });
          totalReplacements++;
        }
      } else if (matches.length > 0) {
        // For other docs, we need to navigate to them and replace
        // Since we can't modify other docs directly from here,
        // we'll need to collect all replacements and handle them differently
        // For now, just count them (we'll need parent component support for cross-doc replace)
        totalReplacements += matches.length;
      }
    }
  }

  toggleCaseSensitive() {
    this.caseSensitive = !this.caseSensitive;
    this.onSearchChange();
  }

  getPlaceholder(): string {
    switch (this.mode) {
      case 'commands':
        return 'Type a command or search for chapters...';
      case 'search-doc':
        return 'Search in current chapter...';
      case 'search-project':
        return 'Search in all chapters...';
      case 'search-replace':
        return 'Search text...';
      default:
        return 'Search...';
    }
  }

  getModeLabel(): string {
    switch (this.mode) {
      case 'commands':
        return 'Command Palette';
      case 'search-doc':
        return 'Search in Chapter';
      case 'search-project':
        return 'Search in Story';
      case 'search-replace':
        return 'Search and Replace';
      default:
        return 'Search';
    }
  }

  highlightMatch(text: string, start: number, end: number): string {
    const before = this.escapeHtml(text.substring(0, start));
    const match = this.escapeHtml(text.substring(start, end));
    const after = this.escapeHtml(text.substring(end));
    return `${before}<mark>${match}</mark>${after}`;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  goBack() {
    this.mode = 'commands';
    this.searchQuery = '';
    this.selectedIndex = 0;
    this.searchResults = [];
    this.currentDocMatches = [];
    this.filteredCommands = [...this.commands];
    this.filteredDocs = this.buildDocList();
    setTimeout(() => this.searchInput?.nativeElement?.focus(), 50);
  }

  // Calculate absolute index for project search results
  getAbsoluteIndex(resultIndex: number, matchIndex: number): number {
    let index = 0;
    for (let i = 0; i < resultIndex; i++) {
      index += this.searchResults[i].matches.length;
    }
    return index + matchIndex;
  }
}
