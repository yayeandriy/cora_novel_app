import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { TimelineService } from '../../services/timeline.service';
import { confirm } from '@tauri-apps/plugin-dialog';
import { ask } from '@tauri-apps/plugin-dialog';
import { DocTreeComponent } from '../../components/doc-tree/doc-tree.component';
import { DocumentEditorComponent } from '../../components/document-editor/document-editor.component';
import { GroupViewComponent } from '../../components/group-view/group-view.component';
import { RightSidebarComponent } from '../../components/right-sidebar/right-sidebar.component';
import { ProjectTimelineComponent } from '../../components/project-timeline/project-timeline.component';
import type { Timeline } from '../../shared/models';

interface DocGroup {
  id: number;
  name: string;
  project_id: number;
  parent_id?: number | null;
  sort_order?: number | null;
  expanded: boolean;
  docs: Doc[];
  groups?: DocGroup[];
}

interface Doc {
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

interface Character {
  id: number;
  name: string;
  desc: string;
}

interface Event {
  id: number;
  name: string;
  desc: string;
  start_date?: string | null;
  end_date?: string | null;
}

@Component({
  selector: 'app-project-view',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    DocTreeComponent,
    DocumentEditorComponent,
    GroupViewComponent,
    RightSidebarComponent,
    ProjectTimelineComponent
  ],
  templateUrl: './project-view.component.html',
  styleUrls: ['./project-view.component.css'],
  host: {
    '(document:keydown)': 'handleKeyDown($event)'
  }
})
export class ProjectViewComponent implements OnInit, OnDestroy {
  @ViewChild('docTree') docTree?: ElementRef<HTMLDivElement>;
  @ViewChild(DocTreeComponent) docTreeComponent?: DocTreeComponent;
  @ViewChild(DocumentEditorComponent) documentEditorComponent?: DocumentEditorComponent;
  @ViewChild(GroupViewComponent) groupViewComponent?: GroupViewComponent;
  @ViewChild(ProjectTimelineComponent) projectTimelineComponent?: ProjectTimelineComponent;
  
  projectId: number = 0;
  projectName: string = '';
  timelineStart: string | null = null;
  timelineEnd: string | null = null;
  
  // Layout state
  leftCollapsed = false;
  rightCollapsed = false;
  leftWidth = 250;
  rightWidth = 300;
  
  // Deletion state
  isDeletingItem = false;
  
  // Save state
  lastSaveTime: Date | null = null;
  showSaveStatus = false;
  hasUnsavedChanges = false;
  private saveStatusTimeout: any;
  private autoSaveTimeout: any;
  private autoSaveNotesTimeout: any;
  
  // Local doc state cache
  private docStateCache: Map<number, {text?: string | null, notes?: string | null}> = new Map();
  
  // Content
  docGroups: DocGroup[] = [];
  selectedDoc: Doc | null = null;
  selectedGroup: DocGroup | null = null;
  currentGroup: DocGroup | null = null;
  expandedGroupIds: Set<number> = new Set();
  
  // Right sidebar
  charactersExpanded = true;
  eventsExpanded = true;
  notesExpanded = true;
  draftsExpanded = true;
  
  characters: Character[] = [];
  events: Event[] = [];
  drafts: any[] = [];
  // Characters per-doc selection
  docCharacterIds: Set<number> = new Set();
  // Editing state for character cards
  editingCharacterId: number | null = null;
  // Events per-doc selection and editing
  docEventIds: Set<number> = new Set();
  editingEventId: number | null = null;
  
  // Draft local caching and syncing
  private draftLocalContent: Map<number, string> = new Map();
  private draftAutoSaveTimeouts: Map<number, any> = new Map();
  draftSyncStatus: Record<number, 'syncing' | 'synced' | 'pending'> = {};
  private focusedDraftId: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService,
    private timelineService: TimelineService,
    private changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.route.params.subscribe((params: any) => {
      this.projectId = +params['id'];
      this.loadProject();
    });
    
    this.loadLayoutState();
  }

  ngOnDestroy() {
    // Clean up timers
    if (this.saveStatusTimeout) {
      clearTimeout(this.saveStatusTimeout);
    }
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    if (this.autoSaveNotesTimeout) {
      clearTimeout(this.autoSaveNotesTimeout);
    }
  }

  async loadProject(preserveSelection: boolean = false, skipRestore: boolean = false) {
    try {
      // Save current selection if we want to preserve it
      const currentDocId = preserveSelection ? this.selectedDoc?.id : null;
      const currentGroupId = preserveSelection ? this.selectedGroup?.id : null;

      // Load project details
      const project = await this.projectService.getProject(this.projectId);
      if (project) {
        this.projectName = project.name;
      }
      
      // Load project timeline for parent component (needed for doc timeline click calculations)
      const projectTimeline = await this.timelineService.getTimelineByEntity('project', this.projectId);
      if (projectTimeline) {
        this.timelineStart = projectTimeline.start_date ?? null;
        this.timelineEnd = projectTimeline.end_date ?? null;
      }

      // Load doc groups and docs from backend
      const [groups, docs] = await Promise.all([
        this.projectService.listDocGroups(this.projectId),
        this.projectService.listDocs(this.projectId)
      ]);

      // Restore tree expansion state before building the tree
      this.restoreTreeState();

      // Build hierarchical structure
      this.docGroups = this.buildDocGroupTree(groups, docs);

  // Load characters and events
  await Promise.all([this.loadCharacters(), this.loadEvents()]);

      // Skip restoration if requested (e.g., when creating new doc and managing selection manually)
      if (skipRestore) {
        return;
      }

      // Restore selection
      if (preserveSelection && (currentDocId || currentGroupId)) {
        // Restore the previous selection
        if (currentDocId) {
          const doc = this.findDocById(currentDocId);
          if (doc) {
            this.selectDoc(doc);
            return;
          }
        }
        if (currentGroupId) {
          const group = this.findGroupById(this.docGroups, currentGroupId);
          if (group) {
            this.selectGroup(group);
            return;
          }
        }
      }

      // Otherwise restore from localStorage or select first item
      this.restoreSelection();
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  }

  private buildDocGroupTree(groups: any[], docs: Doc[]): DocGroup[] {
    // Create a map of groups by ID
    const groupMap = new Map<number, DocGroup>();
    
    // Initialize all groups and restore expanded state
    groups.forEach(g => {
      groupMap.set(g.id, {
        ...g,
        expanded: this.expandedGroupIds.has(g.id),
        docs: [],
        groups: []
      });
    });
    
    // Assign docs to their groups (ignore root-level docs)
    docs.forEach(doc => {
      if (doc.doc_group_id) {
        const group = groupMap.get(doc.doc_group_id);
        if (group) {
          group.docs.push(doc);
        }
      }
      // Ignore docs without a group - we don't support root-level docs
    });

    // Build hierarchy: find root groups and assign children
    const rootGroups: DocGroup[] = [];
    
    groups.forEach(g => {
      const group = groupMap.get(g.id);
      if (!group) return;

      if (g.parent_id === null || g.parent_id === undefined) {
        // Root level group
        rootGroups.push(group);
      } else {
        // Child group - add to parent's groups array
        const parent = groupMap.get(g.parent_id);
        if (parent) {
          if (!parent.groups) parent.groups = [];
          parent.groups.push(group);
        }
      }
    });

    return rootGroups;
  }

  private findFirstDoc(groups: DocGroup[]): Doc | null {
    for (const group of groups) {
      if (group.docs.length > 0) {
        return group.docs[0];
      }
      if (group.groups && group.groups.length > 0) {
        const doc = this.findFirstDoc(group.groups);
        if (doc) return doc;
      }
    }
    return null;
  }

  toggleGroup(group: DocGroup) {
    group.expanded = !group.expanded;
    if (group.expanded) {
      this.expandedGroupIds.add(group.id);
    } else {
      this.expandedGroupIds.delete(group.id);
    }
    // Save tree state when toggling
    this.saveTreeState();
  }

  async selectDoc(doc: Doc) {
    // First, save any unsaved changes from the previous doc to cache
    if (this.selectedDoc) {
      this.docStateCache.set(this.selectedDoc.id, {
        text: this.selectedDoc.text,
        notes: this.selectedDoc.notes
      });
    }

    // Fetch fresh doc data to ensure we have the latest notes
    try {
      const freshDoc = await this.projectService.getDoc(doc.id);
      if (freshDoc) {
        this.selectedDoc = freshDoc;
        // Also update the doc in the docGroups tree so it stays in sync
        this.updateDocInTree(freshDoc);
      } else {
        this.selectedDoc = doc;
      }
    } catch (error) {
      console.error('Failed to fetch fresh doc data:', error);
      this.selectedDoc = doc;
    }

    // Restore any cached state for this doc (in case it was edited but not saved yet)
    const cachedState = this.docStateCache.get(this.selectedDoc.id);
    if (cachedState) {
      if (cachedState.text !== undefined) {
        this.selectedDoc.text = cachedState.text;
      }
      if (cachedState.notes !== undefined) {
        this.selectedDoc.notes = cachedState.notes;
      }
    }
    
    this.selectedGroup = null; // Clear group selection - only ONE selection at a time
    
    // Track parent group for create button context
    if (this.selectedDoc.doc_group_id) {
      this.currentGroup = this.findGroupById(this.docGroups, this.selectedDoc.doc_group_id) || null;
    } else {
      this.currentGroup = null;
    }
    
    // Load drafts for this document
    await this.loadDrafts(this.selectedDoc.id);
  // Load characters attached to this doc
  await this.loadDocCharacters(this.selectedDoc.id);
  // Load events attached to this doc
  await this.loadDocEvents(this.selectedDoc.id);
    
    // Save selection to localStorage
    this.saveSelection();
  }

  private updateDocInTree(updatedDoc: Doc) {
    // Find and update the doc in the docGroups tree
    const updateInGroups = (groups: DocGroup[]): boolean => {
      for (const group of groups) {
        const docIndex = group.docs.findIndex(d => d.id === updatedDoc.id);
        if (docIndex !== -1) {
          console.log('Found doc in group, updating:', updatedDoc.id);
          group.docs[docIndex] = { ...group.docs[docIndex], ...updatedDoc };
          return true;
        }
        if (group.groups && updateInGroups(group.groups)) {
          return true;
        }
      }
      return false;
    };
    const found = updateInGroups(this.docGroups);
    if (!found) {
      console.warn('Doc not found in tree for update:', updatedDoc.id);
    }
  }


  selectGroup(group: DocGroup, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    this.selectedGroup = group;
    this.selectedDoc = null; // Clear doc selection - only ONE selection at a time
    this.currentGroup = group; // Track group for create button context
    
    // Save selection to localStorage
    this.saveSelection();
    // Clear doc-specific character selection when no doc is selected
    this.docCharacterIds = new Set();
    this.docEventIds = new Set();
  }

  private saveSelection() {
    const selection = {
      projectId: this.projectId,
      docId: this.selectedDoc?.id || null,
      groupId: this.selectedGroup?.id || null
    };
    localStorage.setItem(`project_${this.projectId}_selection`, JSON.stringify(selection));
  }

  private saveTreeState() {
    const treeState = {
      projectId: this.projectId,
      expandedGroupIds: Array.from(this.expandedGroupIds)
    };
    localStorage.setItem(`project_${this.projectId}_tree_state`, JSON.stringify(treeState));
  }

  private restoreTreeState() {
    try {
      const saved = localStorage.getItem(`project_${this.projectId}_tree_state`);
      if (saved) {
        const treeState = JSON.parse(saved);
        this.expandedGroupIds = new Set(treeState.expandedGroupIds);
      }
    } catch (error) {
      console.error('Failed to restore tree state:', error);
      this.expandedGroupIds = new Set();
    }
  }

  private restoreSelection() {
    try {
      const saved = localStorage.getItem(`project_${this.projectId}_selection`);
      if (saved) {
        const selection = JSON.parse(saved);
        
        // Try to restore saved selection
        if (selection.docId) {
          const doc = this.findDocById(selection.docId);
          if (doc) {
            this.selectDoc(doc);
            // Focus tree so keyboard navigation works immediately
            setTimeout(() => this.focusTree(), 0);
            return;
          }
        }
        
        if (selection.groupId) {
          const group = this.findGroupById(this.docGroups, selection.groupId);
          if (group) {
            this.selectGroup(group);
            // Focus tree so keyboard navigation works immediately
            setTimeout(() => this.focusTree(), 0);
            return;
          }
        }
      }
    } catch (error) {
      console.error('Failed to restore selection:', error);
    }
    
    // Fallback: select first item
    this.selectFirstItem();
  }

  private selectFirstItem() {
    // Try to select first doc
    const firstDoc = this.findFirstDoc(this.docGroups);
    if (firstDoc) {
      this.selectDoc(firstDoc);
      // Focus tree so keyboard navigation works immediately
      setTimeout(() => this.focusTree(), 0);
      return;
    }
    
    // If no docs, select first group
    if (this.docGroups.length > 0) {
      this.selectGroup(this.docGroups[0]);
      // Focus tree so keyboard navigation works immediately
      setTimeout(() => this.focusTree(), 0);
    }
  }

  private findDocById(docId: number): Doc | null {
    const searchInGroups = (groups: DocGroup[]): Doc | null => {
      for (const group of groups) {
        // Search in group's docs
        const doc = group.docs.find(d => d.id === docId);
        if (doc) return doc;
        
        // Search in nested groups
        if (group.groups) {
          const found = searchInGroups(group.groups);
          if (found) return found;
        }
      }
      return null;
    };
    
    return searchInGroups(this.docGroups);
  }

  getAllDocs(): Doc[] {
    const allDocs: Doc[] = [];
    const collectDocs = (groups: DocGroup[]): void => {
      for (const group of groups) {
        allDocs.push(...group.docs);
        if (group.groups) {
          collectDocs(group.groups);
        }
      }
    };
    collectDocs(this.docGroups);
    return allDocs;
  }

  private findGroupById(groups: DocGroup[], id: number): DocGroup | null {
    for (const group of groups) {
      if (group.id === id) return group;
      if (group.groups && group.groups.length > 0) {
        const found = this.findGroupById(group.groups, id);
        if (found) return found;
      }
    }
    return null;
  }

  handleKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    
    // ESC always focuses the tree
    if (event.key === 'Escape') {
      event.preventDefault();
      this.focusTree();
      return;
    }

    // Cmd+S to save (works in textarea or anywhere)
    // Use event.code to support different keyboard layouts
    if ((event.key === 'S' || event.key === 's' || event.code === 'KeyS') && event.metaKey) {
      event.preventDefault();
      this.saveDoc();
      return;
    }

    // Cmd+Shift+N to create new folder (check both key and code for layout support)
    if ((event.key === 'N' || event.key === 'n' || event.code === 'KeyN') && event.metaKey && event.shiftKey) {
      event.preventDefault();
      this.createGroup();
      return;
    }

    // Cmd+N to create new document (without shift)
    if ((event.key === 'N' || event.key === 'n' || event.code === 'KeyN') && event.metaKey && !event.shiftKey) {
      event.preventDefault();
      if (this.currentGroup) {
        this.createDocInGroup(this.currentGroup);
      } else {
        this.createDoc();
      }
      return;
    }

    // Only handle delete key in tree context (not in textarea or input)
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      if (this.selectedDoc) {
        this.deleteDoc(this.selectedDoc);
      } else if (this.selectedGroup) {
        this.deleteGroup(this.selectedGroup);
      }
    }
  }

  async deleteDoc(doc: Doc) {
    console.log('deleteDoc called for:', doc.name);
    this.isDeletingItem = true;
    const confirmed = await confirm(`Delete "${doc.name}"?`, { title: 'Confirm Delete', kind: 'warning' });
    console.log('Confirmation result:', confirmed);
    if (!confirmed) {
      console.log('Delete cancelled by user');
      this.isDeletingItem = false;
      return;
    }

    console.log('Proceeding with deletion');
    try {
      // Find item to select after deletion (previous or next)
      const items = this.getFlatTreeItems();
      const currentIndex = items.findIndex(item => item.type === 'doc' && item.data.id === doc.id);
      let newSelection: {type: 'group' | 'doc', data: any} | null = null;
      
      if (currentIndex > 0) {
        // Select previous item
        newSelection = items[currentIndex - 1];
      } else if (currentIndex < items.length - 1) {
        // Select next item
        newSelection = items[currentIndex + 1];
      }

      console.log('Calling backend deleteDoc');
      await this.projectService.deleteDoc(doc.id);
      console.log('Backend deletion complete');
      
      // Clear current selection
      this.selectedDoc = null;
      this.selectedGroup = null;
      this.currentGroup = null;
      
      await this.loadProject();
      
      // Restore selection to previous/next item
      if (newSelection) {
        if (newSelection.type === 'doc') {
          const foundDoc = this.findDocById(newSelection.data.id);
          if (foundDoc) {
            this.selectDoc(foundDoc);
          }
        } else {
          const foundGroup = this.findGroupById(this.docGroups, newSelection.data.id);
          if (foundGroup) {
            this.selectGroup(foundGroup);
          }
        }
      }
      
      // Keep focus on tree
      setTimeout(() => this.focusTree(), 0);
    } catch (error) {
      console.error('Failed to delete doc:', error);
      alert('Failed to delete document: ' + error);
    } finally {
      this.isDeletingItem = false;
    }
  }

  async deleteGroup(group: DocGroup) {
    this.isDeletingItem = true;
    const confirmed = await confirm(`Delete folder "${group.name}" and all its contents?`, { title: 'Confirm Delete', kind: 'warning' });
    if (!confirmed) {
      console.log('Delete cancelled');
      this.isDeletingItem = false;
      return;
    }

    try {
      // Find item to select after deletion (previous or next)
      const items = this.getFlatTreeItems();
      const currentIndex = items.findIndex(item => item.type === 'group' && item.data.id === group.id);
      let newSelection: {type: 'group' | 'doc', data: any} | null = null;
      
      if (currentIndex > 0) {
        // Select previous item
        newSelection = items[currentIndex - 1];
      } else if (currentIndex < items.length - 1) {
        // Select next item
        newSelection = items[currentIndex + 1];
      }

      await this.projectService.deleteDocGroup(group.id);
      
      // Clear current selection
      this.selectedGroup = null;
      this.selectedDoc = null;
      this.currentGroup = null;
      
      await this.loadProject();
      
      // Restore selection to previous/next item
      if (newSelection) {
        if (newSelection.type === 'doc') {
          const foundDoc = this.findDocById(newSelection.data.id);
          if (foundDoc) {
            this.selectDoc(foundDoc);
          }
        } else {
          const foundGroup = this.findGroupById(this.docGroups, newSelection.data.id);
          if (foundGroup) {
            this.selectGroup(foundGroup);
          }
        }
      }
      
      // Keep focus on tree
      setTimeout(() => this.focusTree(), 0);
    } catch (error) {
      console.error('Failed to delete group:', error);
      alert('Failed to delete folder: ' + error);
    } finally {
      this.isDeletingItem = false;
    }
  }

  async renameGroup(group: DocGroup) {
    console.log('renameGroup called, isDeletingItem:', this.isDeletingItem);
    // Don't rename if we're in the middle of deleting
    if (this.isDeletingItem) {
      console.log('Skipping rename because isDeletingItem is true');
      return;
    }

    if (!group.name || !group.name.trim()) {
      group.name = 'New Folder';
    }
    
    try {
      await this.projectService.renameDocGroup(group.id, group.name!);
      console.log('Group renamed successfully');
      // Reload tree to reflect the new name, preserving current selection
      await this.loadProject(true);
    } catch (error) {
      console.error('Failed to rename group:', error);
      alert('Failed to rename folder: ' + error);
    }
  }

  async renameDoc(doc: Doc) {
    console.log('renameDoc called, isDeletingItem:', this.isDeletingItem);
    // Don't rename if we're in the middle of deleting
    if (this.isDeletingItem) {
      console.log('Skipping rename because isDeletingItem is true');
      return;
    }
    
    if (!doc.name || !doc.name.trim()) {
      doc.name = 'Untitled Document';
    }
    
    try {
      await this.projectService.renameDoc(doc.id, doc.name!);
      console.log('Doc renamed successfully');
      // Reload tree to reflect the new name, preserving current selection
      await this.loadProject(true);
    } catch (error) {
      console.error('Failed to rename doc:', error);
      alert('Failed to rename document: ' + error);
    }
  }

  focusEditor() {
    this.documentEditorComponent?.focusEditor();
  }

  focusTree() {
    this.docTreeComponent?.focusTree();
  }

  handleTreeKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.navigateTree('up');
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.navigateTree('down');
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.expandSelectedGroup();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.collapseSelectedGroup();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      // If a doc is selected, focus the editor
      if (this.selectedDoc) {
        this.focusEditor();
      } else if (this.selectedGroup) {
        // If a folder is selected, toggle expansion
        this.toggleGroup(this.selectedGroup);
      }
    } else if ((event.key === 'R' || event.code === 'KeyR') && event.shiftKey) {
      event.preventDefault();
      // Shift+R: Focus the name input for renaming (works with different keyboard layouts)
      if (this.selectedDoc) {
        // Focus the title input in the document editor (rename)
        setTimeout(() => {
          this.documentEditorComponent?.focusTitle();
        }, 0);
      } else if (this.selectedGroup) {
        // Focus the group name input for renaming
        setTimeout(() => {
          this.groupViewComponent?.focusName();
        }, 0);
      }
    }
  }

  private navigateTree(direction: 'up' | 'down') {
    // Build a flat list of all visible items in order
    const items = this.getFlatTreeItems();
    if (items.length === 0) return;

    // Find current selection index
    let currentIndex = -1;
    if (this.selectedDoc) {
      currentIndex = items.findIndex(item => item.type === 'doc' && item.data.id === this.selectedDoc!.id);
    } else if (this.selectedGroup) {
      currentIndex = items.findIndex(item => item.type === 'group' && item.data.id === this.selectedGroup!.id);
    }

    // Calculate new index with cyclic behavior
    let newIndex: number;
    if (currentIndex === -1) {
      // Nothing selected
      if (direction === 'down') {
        // Select first item when pressing down with no selection
        newIndex = 0;
      } else {
        // Select last item when pressing up with no selection
        newIndex = items.length - 1;
      }
    } else if (direction === 'up') {
      // Cycle to bottom when going up from top
      newIndex = currentIndex === 0 ? items.length - 1 : currentIndex - 1;
    } else {
      // Cycle to top when going down from bottom
      newIndex = currentIndex === items.length - 1 ? 0 : currentIndex + 1;
    }

    // Select the new item
    const newItem = items[newIndex];
    if (newItem.type === 'doc') {
      this.selectDoc(newItem.data);
    } else {
      this.selectGroup(newItem.data);
    }
  }

  private getFlatTreeItems(): Array<{type: 'group' | 'doc', data: any}> {
    const items: Array<{type: 'group' | 'doc', data: any}> = [];
    
    const addGroup = (group: DocGroup) => {
      items.push({ type: 'group', data: group });
      
      if (group.expanded) {
        // Add nested groups first
        if (group.groups) {
          group.groups.forEach(subGroup => addGroup(subGroup));
        }
        
        // Then add docs
        group.docs.forEach(doc => {
          items.push({ type: 'doc', data: doc });
        });
      }
    };
    
    this.docGroups.forEach(group => addGroup(group));
    return items;
  }

  private expandSelectedGroup() {
    if (this.selectedGroup && !this.selectedGroup.expanded) {
      this.toggleGroup(this.selectedGroup);
    }
  }

  private collapseSelectedGroup() {
    if (this.selectedGroup && this.selectedGroup.expanded) {
      this.toggleGroup(this.selectedGroup);
    } else if (this.selectedDoc && this.currentGroup) {
      // If a doc is selected, collapse means select its parent folder
      this.selectGroup(this.currentGroup);
    }
  }

  async saveDoc() {
    if (!this.selectedDoc) return;

    try {
      const text = this.selectedDoc.text || '';
      await this.projectService.updateDocText(this.selectedDoc.id, text);
      console.log('Doc saved successfully');
      
      // Clear cache for this doc since it's now synced
      this.docStateCache.delete(this.selectedDoc.id);
      
      // Update save state
      this.lastSaveTime = new Date();
      this.showSaveStatus = true;
      this.hasUnsavedChanges = false;
      
      // Hide the save status after 3 seconds
      if (this.saveStatusTimeout) {
        clearTimeout(this.saveStatusTimeout);
      }
      this.saveStatusTimeout = setTimeout(() => {
        this.showSaveStatus = false;
      }, 3000);
    } catch (error) {
      console.error('Failed to save doc:', error);
      alert('Failed to save document: ' + error);
    }
  }

  onDocumentTextChange() {
    // Cache text immediately so we never lose it
    if (this.selectedDoc) {
      const cached = this.docStateCache.get(this.selectedDoc.id) || {};
      cached.text = this.selectedDoc.text;
      this.docStateCache.set(this.selectedDoc.id, cached);
    }

    // Mark as having unsaved changes
    this.hasUnsavedChanges = true;
    
    // Clear existing auto-save timer
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    
    // Set new auto-save timer (save after 2 seconds of inactivity)
    this.autoSaveTimeout = setTimeout(() => {
      this.saveDoc();
    }, 2000);
  }

  onDocumentNotesChange() {
    // Cache notes immediately so we never lose them
    if (this.selectedDoc) {
      const cached = this.docStateCache.get(this.selectedDoc.id) || {};
      cached.notes = this.selectedDoc.notes;
      this.docStateCache.set(this.selectedDoc.id, cached);
    }

    // Clear existing auto-save timer for notes
    if (this.autoSaveNotesTimeout) {
      clearTimeout(this.autoSaveNotesTimeout);
    }
    
    // Set new auto-save timer (save after 2 seconds of inactivity)
    this.autoSaveNotesTimeout = setTimeout(() => {
      this.saveDocNotes();
    }, 2000);
  }

  async saveDocNotes() {
    if (!this.selectedDoc) return;

    try {
      const notes = this.selectedDoc.notes || '';
      await this.projectService.updateDocNotes(this.selectedDoc.id, notes);
      console.log('Doc notes saved successfully');
      
      // Clear cache for this doc since it's now synced
      this.docStateCache.delete(this.selectedDoc.id);
      
      // Reload the entire doc tree to ensure everything stays in sync
      // This preserves the current selection
      await this.loadProject(true);
    } catch (error) {
      console.error('Failed to save doc notes:', error);
    }
  }

  async createGroup() {
    console.log('createGroup called');
    const name = 'New Folder'; // Simple default name for now
    console.log('Folder name:', name);

    try {
      let group;
      
      // If a group is selected, create after it
      if (this.selectedGroup && this.selectedGroup.sort_order !== null && this.selectedGroup.sort_order !== undefined) {
        group = await this.projectService.createDocGroupAfter(
          this.projectId, 
          name, 
          this.selectedGroup.parent_id ?? null,
          this.selectedGroup.sort_order
        );
      } else {
        // Otherwise create at end
        group = await this.projectService.createDocGroup(this.projectId, name);
      }
      
      console.log('Group created:', group);
      
      // Reload the project - SKIP automatic restore so we can manually set selection
      await this.loadProject(false, true);
      
      // Find the newly created group from the freshly loaded tree
      const newGroup = this.findGroupById(this.docGroups, group.id);
      if (newGroup) {
        // Auto-select the newly created folder ONLY
        this.selectedGroup = newGroup; // Use the group from the reloaded tree
        this.selectedDoc = null; // Clear doc selection
        this.currentGroup = newGroup;
        console.log('Group selected from reloaded tree:', this.selectedGroup.id, this.selectedGroup.name);
        
        // Save the new selection to localStorage
        this.saveSelection();
      } else {
        console.warn('Could not find newly created group in reloaded tree');
      }
      
      // Force Angular to detect changes
      this.changeDetector.detectChanges();
      
      // Focus and select the text in the group name input
      setTimeout(() => {
        // Will be handled in child component
      }, 0);
    } catch (error) {
      console.error('Failed to create group:', error);
      alert('Failed to create folder: ' + error);
    }
  }

  async createDoc() {
    console.log('createDoc called');
    
    // Create doc in the current folder context
    if (!this.currentGroup) {
      alert('Please select a folder first');
      return;
    }

    const name = 'Untitled Document'; // Simple default name for now
    const groupId = this.currentGroup.id;
    console.log('Document name:', name, 'in group:', groupId);

    try {
      let doc;
      
      // If a doc is selected in the same group, create after it
      if (this.selectedDoc && this.selectedDoc.doc_group_id === groupId && 
          this.selectedDoc.sort_order !== null && this.selectedDoc.sort_order !== undefined) {
        doc = await this.projectService.createDocAfter(
          this.projectId, 
          name, 
          groupId,
          this.selectedDoc.sort_order
        );
      } else {
        // Otherwise create at end of group
        doc = await this.projectService.createDocNew(this.projectId, name, groupId);
      }
      
      console.log('Doc created:', doc);
      
      // Reload the project - SKIP automatic restore so we can manually set selection
      await this.loadProject(false, true);
      
      // NOW expand the group in the NEW tree
      await this.expandGroup(groupId);
      
      // Find the newly created doc from the freshly loaded tree
      const newDoc = this.findDocById(doc.id);
      console.log('Looking for doc with id:', doc.id);
      console.log('Current docGroups:', this.docGroups);
      if (newDoc) {
        this.selectedDoc = newDoc; // Use the doc from the reloaded tree
        this.selectedGroup = null; // Clear group selection
        this.currentGroup = this.findGroupById(this.docGroups, groupId) || null;
        console.log('Doc selected from reloaded tree:', this.selectedDoc.id, this.selectedDoc.name);
        
        // Save the new selection to localStorage
        this.saveSelection();
      } else {
        console.warn('Could not find newly created doc in reloaded tree');
        console.warn('Backend returned doc:', doc);
        console.warn('Available docs in groups:', JSON.stringify(this.docGroups.map(g => ({ id: g.id, docs: g.docs.map(d => ({ id: d.id, name: d.name })) }))));
      }
      
      // Force Angular to detect changes and render the updated tree
      this.changeDetector.detectChanges();
      
      // Focus the document title input in the editor once it's rendered
      setTimeout(() => {
        this.documentEditorComponent?.focusTitle();
      }, 0);
    } catch (error) {
      console.error('Failed to create doc:', error);
      alert('Failed to create document: ' + error);
    }
  }

    async createDocInGroup(group: DocGroup) {
    console.log('createDocInGroup called for group:', group.id);
    const name = 'Untitled Document';
    const groupId = group.id;

    try {
      let doc;
      
      // If a doc is selected in the same group, create after it
      if (this.selectedDoc && this.selectedDoc.doc_group_id === groupId && 
          this.selectedDoc.sort_order !== null && this.selectedDoc.sort_order !== undefined) {
        doc = await this.projectService.createDocAfter(
          this.projectId, 
          name, 
          groupId,
          this.selectedDoc.sort_order
        );
      } else {
        // Otherwise create at end of group
        doc = await this.projectService.createDocNew(this.projectId, name, groupId);
      }
      
      console.log('Doc created:', doc);
      
      // Reload the project - SKIP automatic restore so we can manually set selection
      await this.loadProject(false, true);
      
      // NOW expand the group in the NEW tree
      await this.expandGroup(groupId);
      
      // Find the newly created doc from the freshly loaded tree
      const newDoc = this.findDocById(doc.id);
      console.log('Looking for doc with id:', doc.id);
      console.log('Current docGroups:', this.docGroups);
      if (newDoc) {
        this.selectedDoc = newDoc; // Use the doc from the reloaded tree
        this.selectedGroup = null; // Clear group selection
        this.currentGroup = this.findGroupById(this.docGroups, groupId) || null;
        console.log('Doc selected from reloaded tree:', this.selectedDoc.id, this.selectedDoc.name);
        
        // Save the new selection to localStorage
        this.saveSelection();
      } else {
        console.warn('Could not find newly created doc in reloaded tree');
        console.warn('Backend returned doc:', doc);
        console.warn('Available docs in groups:', JSON.stringify(this.docGroups.map(g => ({ id: g.id, docs: g.docs.map(d => ({ id: d.id, name: d.name })) }))));
      }
      
      // Force Angular to detect changes and render the updated tree
      this.changeDetector.detectChanges();
      
      // Focus the document title input in the editor once it's rendered
      setTimeout(() => {
        this.documentEditorComponent?.focusTitle();
      }, 0);
    } catch (error) {
      console.error('Failed to create doc:', error);
      alert('Failed to create document: ' + error);
    }
  }

  private async expandGroup(groupId: number) {
    this.expandedGroupIds.add(groupId);
    const group = this.findGroupById(this.docGroups, groupId);
    if (group) {
      group.expanded = true;
    }
    // Save tree state when expanding a group
    this.saveTreeState();
  }

  async createDraft() {
    if (!this.selectedDoc) {
      alert('Please select a document first');
      return;
    }

    const draftName = `Draft ${new Date().toLocaleTimeString()}`;
    const draftContent = ''; // Start with empty content, not the doc's current text
    
    try {
      console.log('Creating draft for doc:', this.selectedDoc.id);
      const draft = await this.projectService.createDraft(
        this.selectedDoc.id,
        draftName,
        draftContent
      );
      console.log('Draft created:', draft);
      
      // Reload drafts for the current document
      await this.loadDrafts(this.selectedDoc.id);
    } catch (error) {
      console.error('Failed to create draft:', error);
      alert('Failed to create draft: ' + error);
    }
  }

  private async loadDrafts(docId: number) {
    try {
      this.drafts = await this.projectService.listDrafts(docId);
      console.log('Loaded drafts:', this.drafts);
      
      // Load local cached content for each draft
      for (const draft of this.drafts) {
        const cached = this.getLocalDraftContent(draft.id);
        if (cached !== null) {
          this.draftLocalContent.set(draft.id, cached);
          draft.content = cached; // reflect into UI model
        } else {
          // Initialize local cache with backend content
          const backendContent = draft.content || '';
          this.draftLocalContent.set(draft.id, backendContent);
          draft.content = backendContent; // reflect into UI model
        }
        // Initialize sync status
        this.draftSyncStatus[draft.id] = 'synced';
      }
    } catch (error) {
      console.error('Failed to load drafts:', error);
    }
  }

  private async loadCharacters(): Promise<void> {
    try {
  const chars = await this.projectService.listCharacters(this.projectId);
  this.characters = chars.map(c => ({ id: c.id, name: c.name, desc: c.desc ?? '' }));
    } catch (error) {
      console.error('Failed to load characters:', error);
      this.characters = [];
    }
  }

  private async loadEvents(): Promise<void> {
    try {
      const evs = await this.projectService.listEvents(this.projectId);
      // Normalize to local interface (desc empty string default)
      this.events = evs.map(e => ({ id: e.id, name: e.name, desc: e.desc ?? '', start_date: e.start_date ?? null, end_date: e.end_date ?? null } as any));
    } catch (error) {
      console.error('Failed to load events:', error);
      this.events = [];
    }
  }

  private async loadDocCharacters(docId: number): Promise<void> {
    try {
      const ids = await this.projectService.listDocCharacters(docId);
      this.docCharacterIds = new Set(ids);
    } catch (error) {
      console.error('Failed to load doc characters:', error);
      this.docCharacterIds = new Set();
    }
  }

  private async loadDocEvents(docId: number): Promise<void> {
    try {
      const ids = await this.projectService.listDocEvents(docId);
      this.docEventIds = new Set(ids);
    } catch (error) {
      console.error('Failed to load doc events:', error);
      this.docEventIds = new Set();
    }
  }

  // ===== Characters sidebar handlers =====
  async onSidebarCharacterAdd(): Promise<void> {
    try {
      // Ensure panel is opened
      this.charactersExpanded = true;
      const created = await this.projectService.createCharacter(this.projectId, 'New Character', '');
  this.characters = [...this.characters, { id: created.id, name: created.name, desc: created.desc ?? '' }];
      // Enter edit mode on the newly created card
      this.editingCharacterId = created.id;
    } catch (error) {
      console.error('Failed to create character:', error);
      alert('Failed to create character: ' + error);
    }
  }

  async onSidebarCharacterNameChange(payload: { id: number; name: string }): Promise<void> {
    try {
      await this.projectService.updateCharacter(payload.id, { name: payload.name });
      const idx = this.characters.findIndex(c => c.id === payload.id);
      if (idx !== -1) {
        this.characters[idx] = { ...this.characters[idx], name: payload.name } as any;
        this.characters = [...this.characters];
      }
    } catch (error) {
      console.error('Failed to update character name:', error);
    }
  }

  async onSidebarCharacterDescChange(payload: { id: number; desc: string }): Promise<void> {
    try {
      await this.projectService.updateCharacter(payload.id, { desc: payload.desc });
      const idx = this.characters.findIndex(c => c.id === payload.id);
      if (idx !== -1) {
        this.characters[idx] = { ...this.characters[idx], desc: payload.desc } as any;
        this.characters = [...this.characters];
      }
    } catch (error) {
      console.error('Failed to update character description:', error);
    }
  }

  async onSidebarCharacterUpdate(payload: { id: number; name: string; desc: string }): Promise<void> {
    try {
      await this.projectService.updateCharacter(payload.id, { name: payload.name, desc: payload.desc });
      const idx = this.characters.findIndex(c => c.id === payload.id);
      if (idx !== -1) {
        this.characters[idx] = { ...this.characters[idx], name: payload.name, desc: payload.desc } as any;
        this.characters = [...this.characters];
      }
      // Exit edit mode after successful save
      if (this.editingCharacterId === payload.id) {
        this.editingCharacterId = null;
      }
    } catch (error) {
      console.error('Failed to update character:', error);
    }
  }

  // ===== Events handlers =====
  async onSidebarEventAdd(): Promise<void> {
    try {
      // Ensure panel is opened
      this.eventsExpanded = true;
      const created = await this.projectService.createEvent(this.projectId, 'New Event', '', null, null);
      this.events = [...this.events, { id: created.id, name: created.name, desc: created.desc ?? '', start_date: created.start_date ?? null, end_date: created.end_date ?? null } as any];
      this.editingEventId = created.id;
    } catch (error) {
      console.error('Failed to create event:', error);
      alert('Failed to create event: ' + error);
    }
  }

  async onSidebarEventUpdate(payload: { id: number; name: string; desc: string; start_date: string | null; end_date: string | null }): Promise<void> {
    try {
      await this.projectService.updateEvent(payload.id, { name: payload.name, desc: payload.desc, start_date: payload.start_date, end_date: payload.end_date });
      const idx = this.events.findIndex(e => e.id === payload.id);
      if (idx !== -1) {
        this.events[idx] = { ...this.events[idx], name: payload.name, desc: payload.desc, start_date: payload.start_date, end_date: payload.end_date } as any;
        this.events = [...this.events];
      }
      if (this.editingEventId === payload.id) {
        this.editingEventId = null;
      }
    } catch (error) {
      console.error('Failed to update event:', error);
    }
  }

  async onSidebarEventDelete(id: number): Promise<void> {
    const confirmed = await confirm('Delete this event?', { title: 'Confirm Delete', kind: 'warning' });
    if (!confirmed) return;
    try {
      await this.projectService.deleteEvent(id);
      this.events = this.events.filter(e => e.id !== id);
      if (this.docEventIds.has(id)) {
        this.docEventIds.delete(id);
        this.docEventIds = new Set(this.docEventIds);
      }
    } catch (error) {
      console.error('Failed to delete event:', error);
      alert('Failed to delete event: ' + error);
    }
  }

  async onSidebarEventToggle(payload: { eventId: number; checked: boolean }): Promise<void> {
    if (!this.selectedDoc) return;
    const { eventId, checked } = payload;
    try {
      if (checked) {
        await this.projectService.attachEventToDoc(this.selectedDoc.id, eventId);
        this.docEventIds.add(eventId);
      } else {
        await this.projectService.detachEventFromDoc(this.selectedDoc.id, eventId);
        this.docEventIds.delete(eventId);
      }
      this.docEventIds = new Set(this.docEventIds);
    } catch (error) {
      console.error('Failed to update event relation:', error);
    }
  }

  async onSidebarCharacterDelete(id: number): Promise<void> {
    const confirmed = await confirm('Delete this character?', { title: 'Confirm Delete', kind: 'warning' });
    if (!confirmed) return;
    try {
      await this.projectService.deleteCharacter(id);
      this.characters = this.characters.filter(c => c.id !== id);
      // Ensure it is also removed from current doc selection
      if (this.docCharacterIds.has(id)) {
        this.docCharacterIds.delete(id);
        this.docCharacterIds = new Set(this.docCharacterIds);
      }
    } catch (error) {
      console.error('Failed to delete character:', error);
      alert('Failed to delete character: ' + error);
    }
  }

  async onSidebarCharacterToggle(payload: { characterId: number; checked: boolean }): Promise<void> {
    if (!this.selectedDoc) return;
    const { characterId, checked } = payload;
    try {
      if (checked) {
        await this.projectService.attachCharacterToDoc(this.selectedDoc.id, characterId);
        this.docCharacterIds.add(characterId);
      } else {
        await this.projectService.detachCharacterFromDoc(this.selectedDoc.id, characterId);
        this.docCharacterIds.delete(characterId);
      }
      // Reassign to trigger OnPush consumers
      this.docCharacterIds = new Set(this.docCharacterIds);
    } catch (error) {
      console.error('Failed to update character relation:', error);
    }
  }

  toggleLeftSidebar() {
    this.leftCollapsed = !this.leftCollapsed;
    this.saveLayoutState();
  }

  toggleRightSidebar() {
    this.rightCollapsed = !this.rightCollapsed;
    this.saveLayoutState();
  }

  startResizeLeft(width: number) {
    this.leftWidth = width;
    this.saveLayoutState();
  }

  startResizeRight(width: number) {
    this.rightWidth = width;
    this.saveLayoutState();
  }

  saveLayoutState() {
    localStorage.setItem('cora-layout', JSON.stringify({
      leftWidth: this.leftWidth,
      rightWidth: this.rightWidth,
      leftCollapsed: this.leftCollapsed,
      rightCollapsed: this.rightCollapsed
    }));
  }

  loadLayoutState() {
    const saved = localStorage.getItem('cora-layout');
    if (saved) {
      const state = JSON.parse(saved);
      this.leftWidth = state.leftWidth || 250;
      this.rightWidth = state.rightWidth || 300;
      this.leftCollapsed = state.leftCollapsed || false;
      this.rightCollapsed = state.rightCollapsed || false;
    }
  }

  goBack() {
    this.router.navigate(['/']);
  }

  onTimelineUpdated(timeline: Timeline) {
    this.timelineStart = timeline.start_date ?? null;
    this.timelineEnd = timeline.end_date ?? null;
    this.changeDetector.markForCheck();
  }

  async onDocTimelineClick(event: { docId: number; clickPosition: number }) {
    if (!this.timelineStart || !this.timelineEnd) {
      return;
    }

    // Calculate the date from click position
    const startMs = new Date(this.timelineStart).getTime();
    const endMs = new Date(this.timelineEnd).getTime();
    const duration = endMs - startMs;
    const clickMs = startMs + (duration * event.clickPosition / 100);
    const clickedDate = new Date(clickMs);
    const clickedDateStr = clickedDate.toISOString().split('T')[0];

    try {
      // Get existing timeline if any
      const existingTimeline = await this.timelineService.getTimelineByEntity('doc', event.docId);

      let startDate: string | null;
      let endDate: string | null;

      if (!existingTimeline || !existingTimeline.start_date || !existingTimeline.end_date) {
        // First click: set both start and end to the same date (creates a point)
        startDate = clickedDateStr;
        endDate = clickedDateStr;
      } else {
        // Timeline exists: extend it based on click position
        const existingStartMs = new Date(existingTimeline.start_date).getTime();
        const existingEndMs = new Date(existingTimeline.end_date).getTime();
        
        if (clickMs < existingStartMs) {
          // Click is before start: move start date
          startDate = clickedDateStr;
          endDate = existingTimeline.end_date;
        } else if (clickMs > existingEndMs) {
          // Click is after end: move end date
          startDate = existingTimeline.start_date;
          endDate = clickedDateStr;
        } else {
          // Click is in the middle: do nothing
          return;
        }
      }

      // Create or update timeline
      await this.timelineService.upsertTimeline('doc', event.docId, startDate, endDate);

      // Reload timelines in the timeline component
      if (this.projectTimelineComponent) {
        await this.projectTimelineComponent.loadDocTimelines();
        this.changeDetector.markForCheck();
      }
    } catch (error) {
      console.error('Error setting doc timeline:', error);
      await confirm(`Failed to set timeline: ${error}`, {
        title: 'Error',
        kind: 'error',
        okLabel: 'OK'
      });
    }
  }

  async onDocIntervalClick(event: { docId: number }) {
    // Clicking on existing interval does nothing - prevents accidental changes
    // User can extend the timeline by clicking before/after the interval
  }

  getWordCount(): number {
    if (!this.selectedDoc?.text) return 0;
    const words = this.selectedDoc.text.split(/\s+/).filter(w => w.trim().length > 0);
    return words.length;
  }

  // ==================== DRAFT LOCAL STORAGE & AUTO-SYNC ====================

  private getLocalDraftKey(draftId: number): string {
    return `cora-draft-${draftId}`;
  }

  private getLocalDraftContent(draftId: number): string | null {
    try {
      return localStorage.getItem(this.getLocalDraftKey(draftId));
    } catch {
      return null;
    }
  }

  private setLocalDraftContent(draftId: number, content: string): void {
    try {
      localStorage.setItem(this.getLocalDraftKey(draftId), content);
    } catch {
      console.error('Failed to save draft to localStorage');
    }
  }

  getDraftLocalContent(draftId: number): string {
    return this.draftLocalContent.get(draftId) || '';
  }

  onDraftChange(draftId: number, content: string, cursorPosition: number): void {
    // Track which draft is actively being edited for focus restoration
    this.focusedDraftId = draftId;
    // Update local memory cache immediately
    this.draftLocalContent.set(draftId, content);
    
    // Save to localStorage immediately
    this.setLocalDraftContent(draftId, content);
    
    // Set status to pending
    this.draftSyncStatus[draftId] = 'pending';
    
    // Clear existing timeout
    const existingTimeout = this.draftAutoSaveTimeouts.get(draftId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Debounce auto-save to backend (500ms)
    const timeout = setTimeout(() => {
      this.syncDraftToBackend(draftId, cursorPosition);
    }, 500);
    
    this.draftAutoSaveTimeouts.set(draftId, timeout);
  }

  onDraftBlur(draftId: number): void {
    // Clear focused state when leaving the textarea
    if (this.focusedDraftId === draftId) {
      this.focusedDraftId = null;
    }
    // Force immediate sync on blur
    const timeout = this.draftAutoSaveTimeouts.get(draftId);
    if (timeout) {
      clearTimeout(timeout);
      this.draftAutoSaveTimeouts.delete(draftId);
    }
    
    const status = this.draftSyncStatus[draftId];
    if (status === 'pending') {
      this.syncDraftToBackend(draftId);
    }
  }

  private async syncDraftToBackend(draftId: number, cursorPosition?: number): Promise<void> {
    const content = this.draftLocalContent.get(draftId);
    if (content === undefined) return;
    
    // Check if this is the currently focused draft
    const wasFocused = this.focusedDraftId === draftId;
    
    this.draftSyncStatus[draftId] = 'syncing';
    
    try {
      const draft = this.drafts.find(d => d.id === draftId);
      if (!draft) return;
      
      await this.projectService.updateDraft(draftId, draft.name, content);
      
      // Update the draft metadata from backend without overwriting content being edited
      const updated = await this.projectService.getDraft(draftId);
      if (updated) {
        const index = this.drafts.findIndex(d => d.id === draftId);
        if (index !== -1) {
          // Preserve current content from UI/local cache; update only metadata
          this.drafts[index].name = updated.name;
          this.drafts[index].updated_at = updated.updated_at;
          this.changeDetector.detectChanges();

          // Restore focus and cursor position after change detection
          if (wasFocused && cursorPosition !== undefined) {
            const textareas = document.querySelectorAll('.draft-textarea');
            const draftIndex = this.drafts.findIndex(d => d.id === draftId);
            if (draftIndex !== -1 && textareas[draftIndex]) {
              const textarea = textareas[draftIndex] as HTMLTextAreaElement;
              setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(cursorPosition, cursorPosition);
              }, 0);
            }
          }
        }
      }
      
      this.draftSyncStatus[draftId] = 'synced';
    } catch (error) {
      console.error('Failed to sync draft:', error);
      this.draftSyncStatus[draftId] = 'pending';
    }
  }

  async deleteDraft(draftId: number): Promise<void> {
    try {
      await this.projectService.deleteDraft(draftId);
      
      // Remove from local cache
      this.draftLocalContent.delete(draftId);
      delete this.draftSyncStatus[draftId];
      
      // Clear any pending timeouts
      const timeout = this.draftAutoSaveTimeouts.get(draftId);
      if (timeout) {
        clearTimeout(timeout);
        this.draftAutoSaveTimeouts.delete(draftId);
      }
      
      // Remove from drafts array
      this.drafts = this.drafts.filter(d => d.id !== draftId);
    } catch (error) {
      console.error('Failed to delete draft:', error);
    }
  }
}
