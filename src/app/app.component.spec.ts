// Shallow unit test for AppComponent methods
// Mock Angular modules so Jest doesn't try to load ESM Angular runtime.
jest.mock('@angular/core', () => ({ Component: () => (x: any) => x }));
jest.mock('@angular/common', () => ({ CommonModule: {}, JsonPipe: () => {}, NgIf: () => {} }));
jest.mock('@angular/forms', () => ({ FormsModule: {} }));
jest.mock('@angular/router', () => ({ RouterOutlet: {} }));

// We instantiate the class directly and supply a mocked ProjectService.
import { AppComponent } from './app.component';
import { ProjectService } from './services/project.service';
import type { Project } from './shared/models';

const mockProjectService: Partial<ProjectService> = {
  createProject: jest.fn().mockResolvedValue({ id: 1, name: 'P1' } as Project),
  listProjects: jest.fn().mockResolvedValue([]),
  deleteProject: jest.fn().mockResolvedValue(true),
  updateProject: jest.fn().mockResolvedValue({ id: 1, name: 'P1-updated' } as Project),
};

describe('AppComponent (shallow)', () => {
  let comp: AppComponent;

  beforeEach(() => {
    // reset mocks
    (mockProjectService.createProject as jest.Mock).mockClear();
    (mockProjectService.listProjects as jest.Mock).mockClear();
    (mockProjectService.deleteProject as jest.Mock).mockClear();
    (mockProjectService.updateProject as jest.Mock).mockClear();
    comp = new AppComponent(mockProjectService as ProjectService);
  });

  it('createProject calls service and updates createdProject', async () => {
    await comp.createProject({ preventDefault() {} } as SubmitEvent, 'P1');
    expect((mockProjectService.createProject as jest.Mock).mock.calls.length).toBe(1);
    expect(comp.createdProject?.name).toBe('P1');
  });

  it('loadProjects calls listProjects', async () => {
    await comp.loadProjects();
    expect((mockProjectService.listProjects as jest.Mock).mock.calls.length).toBe(1);
  });
});
