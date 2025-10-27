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
});
