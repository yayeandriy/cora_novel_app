import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule, FormGroup, FormControl } from "@angular/forms";
import { ProjectService } from "./services/project.service";
import type { Project } from "./shared/models";
import { open } from "@tauri-apps/plugin-dialog";
import { Router } from "@angular/router";

@Component({
  selector: "app-project-dashboard",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: "./project-dashboard.component.html",
})
export class ProjectDashboardComponent {
  projects: Project[] = [];
  form: FormGroup;
  editingId: number | null = null;
  showCreate = false;

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

  async ngOnInit() {
    await this.reload();
  }

  async reload() {
    this.projects = await this.svc.listProjects();
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
    
    if (this.editingId) {
      // Update existing project
      await this.svc.updateProject(this.editingId, { 
        name: v.name, 
        desc: v.desc ?? null, 
        path: v.path ?? null 
      });
      this.editingId = null;
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
    this.showCreate = false;
  }

  toggleCreate() {
    this.showCreate = !this.showCreate;
    this.editingId = null;
    if (this.showCreate) {
      this.form.reset({ name: '', desc: null, path: null });
    }
  }

  editProject(p: Project, event: Event) {
    event.stopPropagation();
    this.editingId = p.id;
    this.showCreate = true;
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
    this.editingId = null;
    this.showCreate = false;
    this.form.reset({ name: '', desc: null, path: null });
  }

  openProject(p: Project) {
    this.router.navigate(['/project', p.id]);
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
