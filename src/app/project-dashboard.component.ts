import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule, FormGroup, FormControl } from "@angular/forms";
import { ProjectService } from "./services/project.service";
import type { Project } from "./shared/models";
import { open } from "@tauri-apps/plugin-dialog";

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

  constructor(private svc: ProjectService) {
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
    await this.svc.createProject({ name: v.name, desc: v.desc ?? null, path: v.path ?? null });
    this.form.reset({ name: "", desc: null, path: null });
    await this.reload();
    this.showCreate = false;
  }

  toggleCreate() {
    this.showCreate = !this.showCreate;
    if (this.showCreate) {
      this.form.reset({ name: '', desc: null, path: null });
    }
  }

  openProject(p: Project) {
    // placeholder: later this will navigate or open the project in the app
    console.log('open project', p.id, p.name);
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

  edit(p: Project) {
    this.editingId = p.id;
    this.form.setValue({ name: p.name, desc: p.desc ?? null, path: p.path ?? null });
  }

  async save() {
    if (!this.editingId) return;
    const v = this.form.value;
    await this.svc.updateProject(this.editingId, { name: v.name, desc: v.desc ?? null, path: v.path ?? null });
    this.editingId = null;
    this.form.reset({ name: "", desc: null, path: null });
    await this.reload();
  }

  cancel() {
    this.editingId = null;
    this.form.reset({ name: "", desc: null, path: null });
  }

  async remove(id: number) {
    await this.svc.deleteProject(id);
    await this.reload();
  }
}
