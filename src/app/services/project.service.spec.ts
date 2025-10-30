/** Jest tests for ProjectService. */
// Mock Angular core so `@Injectable` import doesn't load ESM Angular at test runtime.
jest.mock("@angular/core", () => ({ Injectable: () => (x: any) => x }));
jest.mock("@tauri-apps/api/core", () => ({ invoke: jest.fn() }));

import { invoke } from "@tauri-apps/api/core";
import { ProjectService } from "./project.service";
import type { Project } from "../shared/models";

describe("ProjectService", () => {
  let svc: ProjectService;

  beforeEach(() => {
    svc = new ProjectService();
    (invoke as jest.Mock).mockReset();
  });

  it("createProject calls invoke and returns project", async () => {
    const fake: Project = { id: 1, name: "P1", desc: null, path: null };
    (invoke as jest.Mock).mockResolvedValueOnce(fake);

    const res = await svc.createProject({ name: "P1" });
    expect(invoke).toHaveBeenCalledWith("project_create", { payload: { name: "P1", desc: null, path: null } });
    expect(res).toEqual(fake);
  });

  it("getProject calls invoke with id", async () => {
    const fake: Project = { id: 2, name: "P2", desc: null, path: null };
    (invoke as jest.Mock).mockResolvedValueOnce(fake);
    const res = await svc.getProject(2);
    expect(invoke).toHaveBeenCalledWith("project_get", { id: 2 });
    expect(res).toEqual(fake);
  });

  describe("Draft Operations", () => {
    const mockDraft = {
      id: 1,
      doc_id: 10,
      name: "Draft 1",
      content: "Draft content",
      created_at: "2025-10-30T14:00:00Z",
      updated_at: "2025-10-30T14:00:00Z"
    };

    it("createDraft calls invoke with correct parameters", async () => {
      (invoke as jest.Mock).mockResolvedValueOnce(mockDraft);

      const res = await svc.createDraft(10, "Draft 1", "Draft content");

      expect(invoke).toHaveBeenCalledWith("draft_create", {
        docId: 10,
        payload: { name: "Draft 1", content: "Draft content" }
      });
      expect(res).toEqual(mockDraft);
    });

    it("getDraft calls invoke with id", async () => {
      (invoke as jest.Mock).mockResolvedValueOnce(mockDraft);

      const res = await svc.getDraft(1);

      expect(invoke).toHaveBeenCalledWith("draft_get", { id: 1 });
      expect(res).toEqual(mockDraft);
    });

    it("listDrafts calls invoke with docId", async () => {
      const drafts = [mockDraft];
      (invoke as jest.Mock).mockResolvedValueOnce(drafts);

      const res = await svc.listDrafts(10);

      expect(invoke).toHaveBeenCalledWith("draft_list", { docId: 10 });
      expect(res).toEqual(drafts);
    });

    it("updateDraft calls invoke with id and payload", async () => {
      const updated = { ...mockDraft, name: "Updated Draft" };
      (invoke as jest.Mock).mockResolvedValueOnce(updated);

      const res = await svc.updateDraft(1, "Updated Draft", "Updated content");

      expect(invoke).toHaveBeenCalledWith("draft_update", {
        id: 1,
        payload: { name: "Updated Draft", content: "Updated content" }
      });
      expect(res).toEqual(updated);
    });

    it("deleteDraft calls invoke with id", async () => {
      (invoke as jest.Mock).mockResolvedValueOnce(undefined);

      await svc.deleteDraft(1);

      expect(invoke).toHaveBeenCalledWith("draft_delete", { id: 1 });
    });

    it("restoreDraftToDoc calls invoke with draftId", async () => {
      (invoke as jest.Mock).mockResolvedValueOnce(undefined);

      await svc.restoreDraftToDoc(1);

      expect(invoke).toHaveBeenCalledWith("draft_restore", { draftId: 1 });
    });

    it("deleteAllDrafts calls invoke with docId", async () => {
      (invoke as jest.Mock).mockResolvedValueOnce(undefined);

      await svc.deleteAllDrafts(10);

      expect(invoke).toHaveBeenCalledWith("draft_delete_all", { docId: 10 });
    });

    it("listDrafts returns empty array when no drafts", async () => {
      (invoke as jest.Mock).mockResolvedValueOnce([]);

      const res = await svc.listDrafts(10);

      expect(res).toEqual([]);
    });

    it("getDraft returns null for non-existent draft", async () => {
      (invoke as jest.Mock).mockResolvedValueOnce(null);

      const res = await svc.getDraft(999);

      expect(res).toBeNull();
    });
  });
});
