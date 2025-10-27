import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule, FormGroup, FormControl } from "@angular/forms";
import { ProjectService } from "./services/project.service";
import type { Project } from "./shared/models";

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

  async create() {
    const v = this.form.value;
    if (!v.name) return;
    await this.svc.createProject({ name: v.name, desc: v.desc ?? null, path: v.path ?? null });
    this.form.reset({ name: "", desc: null, path: null });
    await this.reload();
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
