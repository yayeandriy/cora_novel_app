import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";
import type {
  Project, ProjectCreate,
  Doc, Character, Event, Place,
  Draft, DraftCreate,
  ProjectDraft, ProjectDraftCreate, ProjectDraftUpdate,
  FolderDraft, FolderDraftCreate, FolderDraftUpdate
} from "../shared/models";

@Injectable({ providedIn: "root" })
export class ProjectService {
  async createProject(payload: ProjectCreate): Promise<Project> {
    // Normalize optional fields so the invoke payload is consistent
    const normalized = { name: payload.name, desc: payload.desc ?? null, path: payload.path ?? null, notes: payload.notes ?? null };
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

  // Doc Groups
  async listDocGroups(projectId: number): Promise<any[]> {
    return invoke<any[]>("doc_group_list", { projectId });
  }

  async createDocGroup(projectId: number, name: string, parentId?: number | null): Promise<any> {
    return invoke<any>("doc_group_create", { projectId, name, parentId: parentId ?? null });
  }

  async createDocGroupAfter(projectId: number, name: string, parentId: number | null, afterSortOrder: number): Promise<any> {
    return invoke<any>("doc_group_create_after", { projectId, name, parentId, afterSortOrder });
  }

  async deleteDocGroup(id: number): Promise<void> {
    return invoke<void>("doc_group_delete", { id });
  }

  async reorderDocGroup(id: number, direction: 'up' | 'down'): Promise<void> {
    return invoke<void>("doc_group_reorder", { id, direction });
  }

  async renameDocGroup(id: number, newName: string): Promise<void> {
    return invoke<void>("doc_group_rename", { id, newName });
  }

  async updateDocGroupNotes(id: number, notes: string): Promise<void> {
    return invoke<void>("doc_group_update_notes", { id, notes });
  }

  // Docs
  async listDocs(projectId: number): Promise<Doc[]> {
    return invoke<Doc[]>("doc_list", { projectId });
  }

  async getDoc(id: number): Promise<Doc | null> {
    return invoke<Doc | null>("doc_get", { id });
  }

  async createDocNew(projectId: number, name: string, docGroupId?: number | null): Promise<Doc> {
    return invoke<Doc>("doc_create_new", { projectId, name, docGroupId: docGroupId ?? null });
  }

  async createDocAfter(projectId: number, name: string, docGroupId: number | null, afterSortOrder: number): Promise<Doc> {
    return invoke<Doc>("doc_create_after", { projectId, name, docGroupId, afterSortOrder });
  }

  async updateDocText(id: number, text: string): Promise<void> {
    return invoke<void>("doc_update_text", { id, text });
  }

  async updateDocNotes(id: number, notes: string): Promise<void> {
    return invoke<void>("doc_update_notes", { id, notes });
  }

  async deleteDoc(id: number): Promise<void> {
    return invoke<void>("doc_delete", { id });
  }

  async reorderDoc(id: number, direction: 'up' | 'down'): Promise<void> {
    return invoke<void>("doc_reorder", { id, direction });
  }

  async moveDocToGroup(docId: number, newGroupId?: number | null): Promise<void> {
    return invoke<void>("doc_move_to_group", { docId, newGroupId: newGroupId ?? null });
  }

  async renameDoc(id: number, newName: string): Promise<void> {
    return invoke<void>("doc_rename", { id, newName });
  }

  // Basic stubs for docs/characters/events
  async createDoc(projectId: number, path: string, name?: string | null, text?: string | null): Promise<Doc> {
    const payload = { project_id: projectId, path, name: name ?? null, text: text ?? null };
    return invoke<Doc>("doc_create", payload);
  }

  async createCharacter(projectId: number, name: string, desc?: string | null): Promise<Character> {
    // Commands expect camelCase arg names (projectId) on the JS side
    const payload = { projectId, name, desc: desc ?? null };
    return invoke<Character>("character_create", payload);
  }

  async listCharacters(projectId: number): Promise<Character[]> {
    return invoke<Character[]>("character_list", { projectId });
  }

  async updateCharacter(id: number, changes: Partial<{ name: string; desc: string }>): Promise<Character> {
    return invoke<Character>("character_update", { id, changes });
  }

  async deleteCharacter(id: number): Promise<void> {
    return invoke<void>("character_delete", { id });
  }

  async listDocCharacters(docId: number): Promise<number[]> {
    return invoke<number[]>("doc_character_list", { docId });
  }

  async attachCharacterToDoc(docId: number, characterId: number): Promise<void> {
    return invoke<void>("doc_character_attach", { docId, characterId });
  }

  async detachCharacterFromDoc(docId: number, characterId: number): Promise<void> {
    return invoke<void>("doc_character_detach", { docId, characterId });
  }

  async listDocGroupCharacters(docGroupId: number): Promise<number[]> {
    return invoke<number[]>("doc_group_character_list", { docGroupId });
  }

  async listDocGroupCharactersFromDocs(docGroupId: number): Promise<number[]> {
    return invoke<number[]>("doc_group_characters_from_docs", { docGroupId });
  }

  async attachCharacterToDocGroup(docGroupId: number, characterId: number): Promise<void> {
    return invoke<void>("doc_group_character_attach", { docGroupId, characterId });
  }

  async detachCharacterFromDocGroup(docGroupId: number, characterId: number): Promise<void> {
    return invoke<void>("doc_group_character_detach", { docGroupId, characterId });
  }

  // Events
  async createEvent(projectId: number, name: string, desc?: string | null, startDate?: string | null, endDate?: string | null): Promise<Event> {
    // Backend command accepts (project_id camelCase: projectId), name, desc, start_date, end_date, and a legacy 'date'
    const payload = { projectId, name, desc: desc ?? null, startDate: startDate ?? null, endDate: endDate ?? null, date: null as string | null };
    return invoke<Event>("event_create", payload as any);
  }

  async listEvents(projectId: number): Promise<Event[]> {
    return invoke<Event[]>("event_list", { projectId });
  }

  async updateEvent(id: number, changes: Partial<{ name: string; desc: string; start_date: string | null; end_date: string | null }>): Promise<Event> {
    return invoke<Event>("event_update", { id, changes });
  }

  async deleteEvent(id: number): Promise<void> {
    return invoke<void>("event_delete", { id });
  }

  async listDocEvents(docId: number): Promise<number[]> {
    return invoke<number[]>("doc_event_list", { docId });
  }

  async attachEventToDoc(docId: number, eventId: number): Promise<void> {
    return invoke<void>("doc_event_attach", { docId, eventId });
  }

  async detachEventFromDoc(docId: number, eventId: number): Promise<void> {
    return invoke<void>("doc_event_detach", { docId, eventId });
  }

  async listDocGroupEvents(docGroupId: number): Promise<number[]> {
    return invoke<number[]>("doc_group_event_list", { docGroupId });
  }

  async listDocGroupEventsFromDocs(docGroupId: number): Promise<number[]> {
    return invoke<number[]>("doc_group_events_from_docs", { docGroupId });
  }

  async attachEventToDocGroup(docGroupId: number, eventId: number): Promise<void> {
    return invoke<void>("doc_group_event_attach", { docGroupId, eventId });
  }

  async detachEventFromDocGroup(docGroupId: number, eventId: number): Promise<void> {
    return invoke<void>("doc_group_event_detach", { docGroupId, eventId });
  }

  // Places
  async createPlace(projectId: number, name: string, desc?: string | null): Promise<Place> {
    const payload = { projectId, name, desc: desc ?? null };
    return invoke<Place>("place_create", payload);
  }

  async listPlaces(projectId: number): Promise<Place[]> {
    return invoke<Place[]>("place_list", { projectId });
  }

  async updatePlace(id: number, changes: Partial<{ name: string; desc: string }>): Promise<Place> {
    return invoke<Place>("place_update", { id, changes });
  }

  async deletePlace(id: number): Promise<void> {
    return invoke<void>("place_delete", { id });
  }

  async listDocPlaces(docId: number): Promise<number[]> {
    return invoke<number[]>("doc_place_list", { docId });
  }

  async attachPlaceToDoc(docId: number, placeId: number): Promise<void> {
    return invoke<void>("doc_place_attach", { docId, placeId });
  }

  async detachPlaceFromDoc(docId: number, placeId: number): Promise<void> {
    return invoke<void>("doc_place_detach", { docId, placeId });
  }

  async listDocGroupPlaces(docGroupId: number): Promise<number[]> {
    return invoke<number[]>("doc_group_place_list", { docGroupId });
  }

  async listDocGroupPlacesFromDocs(docGroupId: number): Promise<number[]> {
    return invoke<number[]>("doc_group_places_from_docs", { docGroupId });
  }

  async attachPlaceToDocGroup(docGroupId: number, placeId: number): Promise<void> {
    return invoke<void>("doc_group_place_attach", { docGroupId, placeId });
  }

  async detachPlaceFromDocGroup(docGroupId: number, placeId: number): Promise<void> {
    return invoke<void>("doc_group_place_detach", { docGroupId, placeId });
  }

  // Drafts
  async createDraft(docId: number, name: string, content: string): Promise<Draft> {
    return invoke<Draft>("draft_create", { docId, payload: { name, content } });
  }

  async getDraft(id: number): Promise<Draft | null> {
    return invoke<Draft | null>("draft_get", { id });
  }

  async listDrafts(docId: number): Promise<Draft[]> {
    return invoke<Draft[]>("draft_list", { docId });
  }

  async updateDraft(id: number, name?: string, content?: string): Promise<Draft> {
    return invoke<Draft>("draft_update", { id, payload: { name: name ?? null, content: content ?? null } });
  }

  async deleteDraft(id: number): Promise<void> {
    return invoke<void>("draft_delete", { id });
  }

  async restoreDraftToDoc(draftId: number): Promise<void> {
    return invoke<void>("draft_restore", { draftId });
  }

  async deleteAllDrafts(docId: number): Promise<void> {
    return invoke<void>("draft_delete_all", { docId });
  }

  // Project Drafts
  async createProjectDraft(projectId: number, name: string, content: string): Promise<ProjectDraft> {
    return invoke<ProjectDraft>("project_draft_create", { projectId, payload: { name, content } });
  }

  async getProjectDraft(id: number): Promise<ProjectDraft | null> {
    return invoke<ProjectDraft | null>("project_draft_get", { id });
  }

  async listProjectDrafts(projectId: number): Promise<ProjectDraft[]> {
    return invoke<ProjectDraft[]>("project_draft_list", { projectId });
  }

  async updateProjectDraft(id: number, changes: Partial<ProjectDraftUpdate> & { name?: string | null; content?: string | null }): Promise<ProjectDraft> {
    const payload = { name: changes.name ?? null, content: changes.content ?? null } as ProjectDraftUpdate;
    return invoke<ProjectDraft>("project_draft_update", { id, payload });
  }

  async deleteProjectDraft(id: number): Promise<void> {
    return invoke<void>("project_draft_delete", { id });
  }

  async deleteAllProjectDrafts(projectId: number): Promise<void> {
    return invoke<void>("project_draft_delete_all", { projectId });
  }

  // Folder (Doc Group) Drafts
  async createFolderDraft(docGroupId: number, name: string, content: string): Promise<FolderDraft> {
    return invoke<FolderDraft>("folder_draft_create", { docGroupId, payload: { name, content } });
  }

  async getFolderDraft(id: number): Promise<FolderDraft | null> {
    return invoke<FolderDraft | null>("folder_draft_get", { id });
  }

  async listFolderDrafts(docGroupId: number): Promise<FolderDraft[]> {
    return invoke<FolderDraft[]>("folder_draft_list", { docGroupId });
  }

  async updateFolderDraft(id: number, changes: Partial<FolderDraftUpdate> & { name?: string | null; content?: string | null }): Promise<FolderDraft> {
    const payload = { name: changes.name ?? null, content: changes.content ?? null } as FolderDraftUpdate;
    return invoke<FolderDraft>("folder_draft_update", { id, payload });
  }

  async deleteFolderDraft(id: number): Promise<void> {
    return invoke<void>("folder_draft_delete", { id });
  }

  async moveFolderDraft(id: number, newIndex: number): Promise<void> {
    return invoke<void>("folder_draft_move", { id, newIndex });
  }

  async deleteAllFolderDrafts(docGroupId: number): Promise<void> {
    return invoke<void>("folder_draft_delete_all", { docGroupId });
  }

  // Import .txt files into a target folder
  async importTxtFiles(projectId: number, docGroupId: number, files: string[]): Promise<number> {
    return invoke<number>("import_txt_files", { projectId, docGroupId, files });
  }

  // Import a whole project from a folder
  async importProject(folderPath: string): Promise<Project> {
    return invoke<Project>("import_project", { folderPath });
  }

  // Export a whole project to a folder
  async exportProject(projectId: number, destPath: string): Promise<void> {
    return invoke<void>("export_project", { projectId, destPath });
  }
}
