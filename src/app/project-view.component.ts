import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectService } from './services/project.service';
import { confirm } from '@tauri-apps/plugin-dialog';
import { ask } from '@tauri-apps/plugin-dialog';

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
  startDate?: string;
  endDate?: string;
}

@Component({
  selector: 'app-project-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-view.component.html',
  styleUrls: ['./project-view.component.css'],
  host: {
    '(document:keydown)': 'handleKeyDown($event)'
  }
})
export class ProjectViewComponent implements OnInit {
  @ViewChild('docTitleInput') docTitleInput?: ElementRef<HTMLInputElement>;
  @ViewChild('editorTextarea') editorTextarea?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('docTree') docTree?: ElementRef<HTMLDivElement>;
  @ViewChild('groupNameInput') groupNameInput?: ElementRef<HTMLInputElement>;
  
  projectId: number = 0;
  projectName: string = '';
  
  // Layout state
  leftCollapsed = false;
  rightCollapsed = false;
  leftWidth = 250;
  rightWidth = 300;
  isResizingLeft = false;
  isResizingRight = false;
  
  // Deletion state
  isDeletingItem = false;
  
  // Content
  docGroups: DocGroup[] = [];
  selectedDoc: Doc | null = null;
  selectedGroup: DocGroup | null = null;
  currentGroup: DocGroup | null = null; // Track current group context for create button
  expandedGroupIds: Set<number> = new Set();
  
  // Right sidebar
  charactersExpanded = true;
  eventsExpanded = true;
  notesExpanded = true;
  draftsExpanded = true;
  
  characters: Character[] = [];
  events: Event[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService
  ) {}

  ngOnInit() {
    this.route.params.subscribe((params: any) => {
      this.projectId = +params['id'];
      this.loadProject();
    });
    
    this.loadLayoutState();
  }

  async loadProject(preserveSelection: boolean = false) {
    try {
      // Save current selection if we want to preserve it
      const currentDocId = preserveSelection ? this.selectedDoc?.id : null;
      const currentGroupId = preserveSelection ? this.selectedGroup?.id : null;

      // Load project details
      const project = await this.projectService.getProject(this.projectId);
      if (project) {
        this.projectName = project.name;
      }

      // Load doc groups and docs from backend
      const [groups, docs] = await Promise.all([
        this.projectService.listDocGroups(this.projectId),
        this.projectService.listDocs(this.projectId)
      ]);

      // Build hierarchical structure
      this.docGroups = this.buildDocGroupTree(groups, docs);

      // Load characters and events (using mock data for now)
      this.characters = [];
      this.events = [];

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
  }

  selectDoc(doc: Doc) {
    this.selectedDoc = doc;
    this.selectedGroup = null; // Clear group selection - only ONE selection at a time
    
    // Track parent group for create button context
    if (doc.doc_group_id) {
      this.currentGroup = this.findGroupById(this.docGroups, doc.doc_group_id) || null;
    } else {
      this.currentGroup = null;
    }
    
    // Save selection to localStorage
    this.saveSelection();
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
  }

  private saveSelection() {
    const selection = {
      projectId: this.projectId,
      docId: this.selectedDoc?.id || null,
      groupId: this.selectedGroup?.id || null
    };
    localStorage.setItem(`project_${this.projectId}_selection`, JSON.stringify(selection));
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

    // Cmd+Shift+N to create new folder (check both cases)
    if ((event.key === 'N' || event.key === 'n') && event.metaKey && event.shiftKey) {
      event.preventDefault();
      this.createGroup();
      return;
    }

    // Cmd+N to create new document (without shift)
    if ((event.key === 'N' || event.key === 'n') && event.metaKey && !event.shiftKey) {
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
    this.editorTextarea?.nativeElement.focus();
  }

  focusTree() {
    this.docTree?.nativeElement.focus();
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
    } else if (event.key === 'R' && event.shiftKey) {
      event.preventDefault();
      // Shift+R: Focus the name input for renaming
      if (this.selectedDoc) {
        setTimeout(() => {
          if (this.docTitleInput) {
            this.docTitleInput.nativeElement.focus();
            this.docTitleInput.nativeElement.select();
          }
        }, 0);
      } else if (this.selectedGroup) {
        setTimeout(() => {
          if (this.groupNameInput) {
            this.groupNameInput.nativeElement.focus();
            this.groupNameInput.nativeElement.select();
          }
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
      // Optional: Show a brief "Saved" indicator
    } catch (error) {
      console.error('Failed to save doc:', error);
      alert('Failed to save document: ' + error);
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
      
      await this.loadProject();
      
      // Auto-select the newly created folder ONLY
      this.selectedGroup = group;
      this.selectedDoc = null; // Clear doc selection
      this.currentGroup = group;
      
      // Focus and select the text in the group name input
      setTimeout(() => {
        if (this.groupNameInput) {
          this.groupNameInput.nativeElement.focus();
          this.groupNameInput.nativeElement.select();
        }
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
      
      // Expand the group before reloading
      await this.expandGroup(groupId);
      await this.loadProject();
      
      // Auto-select the newly created doc ONLY
      this.selectedDoc = doc;
      this.selectedGroup = null; // Clear group selection
      this.currentGroup = this.findGroupById(this.docGroups, groupId) || null;
      
      // Focus the title input after a short delay to allow rendering
      setTimeout(() => {
        this.docTitleInput?.nativeElement.focus();
        this.docTitleInput?.nativeElement.select();
      }, 100);
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
      
      // Expand the group before reloading
      await this.expandGroup(groupId);
      await this.loadProject();
      
      // Auto-select the newly created doc ONLY
      this.selectedDoc = doc;
      this.selectedGroup = null; // Clear group selection
      this.currentGroup = this.findGroupById(this.docGroups, groupId) || null;
      
      // Focus the title input after a short delay to allow rendering
      setTimeout(() => {
        this.docTitleInput?.nativeElement.focus();
        this.docTitleInput?.nativeElement.select();
      }, 100);
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
  }

  toggleLeftSidebar() {
    this.leftCollapsed = !this.leftCollapsed;
    this.saveLayoutState();
  }

  toggleRightSidebar() {
    this.rightCollapsed = !this.rightCollapsed;
    this.saveLayoutState();
  }

  startResizeLeft(event: MouseEvent) {
    this.isResizingLeft = true;
    event.preventDefault();
    
    const onMouseMove = (e: MouseEvent) => {
      if (this.isResizingLeft) {
        this.leftWidth = Math.max(200, Math.min(600, e.clientX));
        this.saveLayoutState();
      }
    };
    
    const onMouseUp = () => {
      this.isResizingLeft = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  startResizeRight(event: MouseEvent) {
    this.isResizingRight = true;
    event.preventDefault();
    
    const onMouseMove = (e: MouseEvent) => {
      if (this.isResizingRight) {
        this.rightWidth = Math.max(250, Math.min(600, window.innerWidth - e.clientX));
        this.saveLayoutState();
      }
    };
    
    const onMouseUp = () => {
      this.isResizingRight = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
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

  getWordCount(): number {
    if (!this.selectedDoc?.text) return 0;
    const words = this.selectedDoc.text.split(/\s+/).filter(w => w.trim().length > 0);
    return words.length;
  }
}
