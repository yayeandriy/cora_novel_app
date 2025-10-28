import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

interface DocGroup {
  id: number;
  name: string;
  expanded: boolean;
  docs: Doc[];
  groups?: DocGroup[];
}

interface Doc {
  id: number;
  name: string;
  text: string;
  draft?: string;
  notes?: string;
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
    private router: Router
  ) {}

  ngOnInit() {
    this.route.params.subscribe((params: any) => {
      this.projectId = +params['id'];
      this.loadProject();
    });
    
    this.loadLayoutState();
  }

  loadProject() {
    // Mock data - will be replaced with actual DB calls
    this.projectName = 'Мультифільми';
    
    this.docGroups = [
      {
        id: 1,
        name: '2 візди',
        expanded: true,
        docs: [],
        groups: [
          {
            id: 2,
            name: 'Мультифільми',
            expanded: true,
            docs: [
              { id: 1, name: '2', text: 'Content for document 2...' }
            ]
          },
          {
            id: 3,
            name: 'уривки',
            expanded: false,
            docs: []
          },
          {
            id: 4,
            name: '22222',
            expanded: false,
            docs: []
          }
        ]
      },
      {
        id: 5,
        name: '1111',
        expanded: false,
        docs: []
      },
      {
        id: 6,
        name: '4343',
        expanded: false,
        docs: []
      }
    ];
    
    this.characters = [
      { id: 1, name: 'Character 1', desc: 'Description' },
      { id: 2, name: 'Character 2', desc: 'Description' }
    ];
    
    this.events = [
      { id: 1, name: "З'являються бандити", desc: 'Ввід офісу', startDate: 'Apr 23, 2018', endDate: 'Apr 23, 2018' },
      { id: 2, name: 'Погадка до діда', desc: '', startDate: 'Oct 1, 2019', endDate: 'Oct 18, 2019' },
      { id: 3, name: 'Костя потрапляє у студію', desc: '', startDate: 'Oct 7, 2025', endDate: 'Oct 17, 2025' },
      { id: 4, name: 'Офіс Кості виносить з приміщень 2', desc: '' }
    ];
    
    // Auto-select first doc
    if (this.docGroups[0]?.groups?.[0]?.docs?.[0]) {
      this.selectedDoc = this.docGroups[0].groups[0].docs[0];
    }
  }

  toggleGroup(group: DocGroup) {
    group.expanded = !group.expanded;
  }

  selectDoc(doc: Doc) {
    this.selectedDoc = doc;
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
