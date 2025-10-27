import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";

export interface ProjectCreate {
  name: string;
  desc?: string | null;
  path?: string | null;
}

export interface Project {
  id: number;
  name: string;
  desc?: string | null;
  path?: string | null;
}

@Injectable({ providedIn: "root" })
export class ProjectService {
  async createProject(payload: ProjectCreate): Promise<Project> {
    // Normalize optional fields so the invoke payload is consistent
    const normalized = { name: payload.name, desc: payload.desc ?? null, path: payload.path ?? null };
    return invoke<Project>("project_create", { payload: normalized });
  }

  async getProject(id: number): Promise<Project | null> {
    return invoke<Project | null>("project_get", { id });
  }

  async listProjects(): Promise<Project[]> {
    return invoke<Project[]>("project_list", {});
  }

  async deleteProject(id: number): Promise<boolean> {
    return invoke<boolean>("project_delete", { id });
  }

  async updateProject(id: number, changes: Partial<ProjectCreate>): Promise<Project> {
    return invoke<Project>("project_update", { id, changes });
  }

  // Basic stubs for docs/characters/events
  async createDoc(projectId: number, path: string, name?: string, text?: string) {
    return invoke("doc_create", { project_id: projectId, path, name, text });
  }

  async createCharacter(projectId: number, name: string, desc?: string) {
    return invoke("character_create", { project_id: projectId, name, desc });
  }

  async createEvent(projectId: number, name: string, desc?: string, date?: string) {
    return invoke("event_create", { project_id: projectId, name, desc, date });
  }
}
