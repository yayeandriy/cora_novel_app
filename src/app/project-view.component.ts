import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectService } from './services/project.service';
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
  styleUrls: ['./project-view.component.css']
})
export class ProjectViewComponent implements OnInit {
  projectId: number = 0;
  projectName: string = '';
  
  // Layout state
  leftCollapsed = false;
  rightCollapsed = false;
  leftWidth = 250;
  rightWidth = 300;
  isResizingLeft = false;
  isResizingRight = false;
  
  // Content
  docGroups: DocGroup[] = [];
  selectedDoc: Doc | null = null;
  
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

  async loadProject() {
    try {
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

      // Auto-select first doc if available
      const firstDoc = this.findFirstDoc(this.docGroups);
      if (firstDoc) {
        this.selectedDoc = firstDoc;
      }
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  }

  private buildDocGroupTree(groups: any[], docs: Doc[]): DocGroup[] {
    // Create a map of groups by ID
    const groupMap = new Map<number, DocGroup>();
    
    // Initialize all groups with expanded=false and empty children
    groups.forEach(g => {
      groupMap.set(g.id, {
        ...g,
        expanded: false,
        docs: [],
        groups: []
      });
    });

    // Separate root-level docs from grouped docs
    const rootDocs: Doc[] = [];
    
    // Assign docs to their groups or to root
    docs.forEach(doc => {
      if (doc.doc_group_id) {
        const group = groupMap.get(doc.doc_group_id);
        if (group) {
          group.docs.push(doc);
        }
      } else {
        // Doc without a group - add to root
        rootDocs.push(doc);
      }
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

    // If there are root-level docs, create a virtual "Documents" group for them
    if (rootDocs.length > 0) {
      const virtualGroup: DocGroup = {
        id: -1, // Virtual ID
        name: 'Documents',
        project_id: this.projectId,
        parent_id: null,
        sort_order: -1,
        expanded: true,
        docs: rootDocs,
        groups: []
      };
      rootGroups.unshift(virtualGroup); // Add at the beginning
    }

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
  }

  selectDoc(doc: Doc) {
    this.selectedDoc = doc;
  }

  async renameDoc(doc: Doc) {
    if (!doc.name || !doc.name.trim()) {
      doc.name = 'Untitled Document';
    }
    
    try {
      await this.projectService.renameDoc(doc.id, doc.name!);
      console.log('Doc renamed successfully');
    } catch (error) {
      console.error('Failed to rename doc:', error);
      alert('Failed to rename document: ' + error);
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
      await this.projectService.createDocGroup(this.projectId, name);
      await this.loadProject();
    } catch (error) {
      console.error('Failed to create group:', error);
      alert('Failed to create folder: ' + error);
    }
  }

  async createDoc() {
    console.log('createDoc called');
    const name = 'Untitled Document'; // Simple default name for now
    console.log('Document name:', name);

    try {
      const doc = await this.projectService.createDocNew(this.projectId, name);
      console.log('Doc created:', doc);
      await this.loadProject();
      // Auto-select the newly created doc
      this.selectedDoc = doc;
    } catch (error) {
      console.error('Failed to create doc:', error);
      alert('Failed to create document: ' + error);
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
