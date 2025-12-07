import { Component, signal, computed, ViewChild, ElementRef, AfterViewChecked } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule, FormGroup, FormControl } from "@angular/forms";
import { ProjectService } from "../../services/project.service";
import type { Project, Doc } from "../../shared/models";
import { open } from "@tauri-apps/plugin-dialog";
import { Router } from "@angular/router";

interface ProjectStats {
  docCount: number;
  charCount: number;
  pageCount: number;
  wordCount: number;
  folderCount: number;
}

@Component({
  selector: "app-project-dashboard",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: "./project-dashboard.component.html",
  styleUrls: ["./project-dashboard.component.css"],
})
export class ProjectDashboardComponent implements AfterViewChecked {
  @ViewChild('newProjectInput') newProjectInput?: ElementRef<HTMLInputElement>;
  
  // Signals for reactive state
  projects = signal<Project[]>([]);
  projectStats = signal<Map<number, ProjectStats>>(new Map());
  showCreate = signal(false);
  editingId = signal<number | null>(null);
  isLoading = signal(false);
  
  // For inline editing
  nameControl = new FormControl('');
  private shouldFocusInput = false;
  
  // Computed values
  hasProjects = computed(() => this.projects().length > 0);
  sortedProjects = computed(() => {
    return [...this.projects()].sort((a, b) => {
      // Sort by most recent activity (using timeline_start as proxy for now)
      const aTime = a.timeline_start ? new Date(a.timeline_start).getTime() : 0;
      const bTime = b.timeline_start ? new Date(b.timeline_start).getTime() : 0;
      return bTime - aTime;
    });
  });
  
  form: FormGroup;

  constructor(
    private svc: ProjectService,
    private router: Router
  ) {
    this.form = new FormGroup({
      name: new FormControl("") as FormControl<string | null>,
      desc: new FormControl(null) as FormControl<string | null>,
      path: new FormControl(null) as FormControl<string | null>,
    });
  }
  
  ngAfterViewChecked() {
    if (this.shouldFocusInput && this.newProjectInput) {
      this.newProjectInput.nativeElement.focus();
      this.shouldFocusInput = false;
    }
  }

  async ngOnInit() {
    await this.reload();
  }

  async reload() {
    this.isLoading.set(true);
    try {
      const projectList = await this.svc.listProjects();
      this.projects.set(projectList);
      
      // Fetch stats for each project in parallel
      await this.loadAllProjectStats(projectList);
    } finally {
      this.isLoading.set(false);
    }
  }
  
  private async loadAllProjectStats(projectList: Project[]) {
    const statsMap = new Map<number, ProjectStats>();
    
    await Promise.all(projectList.map(async (project) => {
      try {
        const docs = await this.svc.listDocs(project.id);
        const folders = await this.svc.listDocGroups(project.id);
        
        let totalChars = 0;
        let totalWords = 0;
        
        for (const doc of docs) {
          const text = doc.text || '';
          totalChars += text.length;
          totalWords += text.trim() ? text.trim().split(/\s+/).length : 0;
        }
        
        statsMap.set(project.id, {
          docCount: docs.length,
          charCount: totalChars,
          pageCount: Math.ceil(totalChars / 1800),
          wordCount: totalWords,
          folderCount: folders.length
        });
      } catch (err) {
        console.error(`Failed to load stats for project ${project.id}:`, err);
        statsMap.set(project.id, { docCount: 0, charCount: 0, pageCount: 0, wordCount: 0, folderCount: 0 });
      }
    }));
    
    this.projectStats.set(statsMap);
  }
  
  getStats(projectId: number): ProjectStats {
    return this.projectStats().get(projectId) || { docCount: 0, charCount: 0, pageCount: 0, wordCount: 0, folderCount: 0 };
  }
  
  getGridCells(): { index: number; project: Project | null }[] {
    const totalCells = 12; // 4 columns x 3 rows
    const projects = this.sortedProjects();
    const cells: { index: number; project: Project | null }[] = [];
    
    for (let i = 0; i < totalCells; i++) {
      cells.push({
        index: i,
        project: i < projects.length ? projects[i] : null
      });
    }
    
    return cells;
  }
  
  getFirstEmptyIndex(): number {
    return this.sortedProjects().length;
  }
  
  async createQuick() {
    const name = this.nameControl.value?.trim();
    if (!name) {
      this.cancelEdit();
      return;
    }
    
    await this.svc.createProject({ name, desc: null, path: null });
    this.nameControl.reset();
    this.showCreate.set(false);
    await this.reload();
  }
  
  onInputBlur() {
    // Small delay to allow for Enter key to fire first
    setTimeout(() => {
      if (this.showCreate() && !this.nameControl.value?.trim()) {
        this.cancelEdit();
      }
    }, 150);
  }
  
  formatNumber(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  }

  async selectFolder() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Project Folder",
      });
      
      if (selected) {
        this.form.patchValue({ path: selected });
      }
    } catch (err) {
      console.error("Failed to select folder:", err);
    }
  }

  async create() {
    const v = this.form.value;
    if (!v.name) return;
    
    const currentEditingId = this.editingId();
    if (currentEditingId) {
      // Update existing project
      await this.svc.updateProject(currentEditingId, { 
        name: v.name, 
        desc: v.desc ?? null, 
        path: v.path ?? null 
      });
      this.editingId.set(null);
    } else {
      // Create new project
      await this.svc.createProject({ 
        name: v.name, 
        desc: v.desc ?? null, 
        path: v.path ?? null 
      });
    }
    
    this.form.reset({ name: "", desc: null, path: null });
    await this.reload();
    this.showCreate.set(false);
  }

  toggleCreate() {
    this.showCreate.update(v => !v);
    this.editingId.set(null);
    if (this.showCreate()) {
      this.nameControl.reset();
      this.form.reset({ name: '', desc: null, path: null });
      this.shouldFocusInput = true;
    }
  }

  editProject(p: Project, event: Event) {
    event.stopPropagation();
    this.editingId.set(p.id);
    this.showCreate.set(true);
    this.form.setValue({ 
      name: p.name, 
      desc: p.desc ?? null, 
      path: p.path ?? null 
    });
  }

  async deleteProject(id: number, event: Event) {
    event.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this project?')) {
      return;
    }
    
    await this.svc.deleteProject(id);
    await this.reload();
  }

  cancelEdit() {
    this.editingId.set(null);
    this.showCreate.set(false);
    this.nameControl.reset();
    this.form.reset({ name: '', desc: null, path: null });
  }

  onProjectContextMenu(p: Project, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    // Simple context menu via confirm dialogs
    const action = prompt('Enter action: edit, delete, or cancel');
    if (action === 'edit') {
      this.editingId.set(p.id);
      this.showCreate.set(true);
      this.form.setValue({ 
        name: p.name, 
        desc: p.desc ?? null, 
        path: p.path ?? null 
      });
    } else if (action === 'delete') {
      if (confirm('Are you sure you want to delete this project?')) {
        this.svc.deleteProject(p.id).then(() => this.reload());
      }
    }
  }

  openProject(p: Project) {
    this.router.navigate(['/project', p.id]);
  }

  async importProject() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select a project folder to import'
      });
      if (!selected || Array.isArray(selected)) return;
      const imported = await this.svc.importProject(selected as string);
      await this.reload();
      // Navigate to the newly imported project
      this.openProject(imported);
    } catch (err) {
      console.error('Failed to import project:', err);
      alert('Failed to import project: ' + err);
    }
  }

  timeAgo(p: Project) {
    // use timeline_start or fallback text
    const when = p.timeline_start ?? null;
    if (!when) return '1 day ago';
    try {
      const d = new Date(when);
      const diff = Date.now() - d.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (days <= 0) return 'today';
      if (days === 1) return '1 day ago';
      return `${days} days ago`;
    } catch {
      return '1 day ago';
    }
  }
}
