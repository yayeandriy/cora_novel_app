// Shallow unit test for AppComponent
// Mock Angular modules so Jest doesn't try to load ESM Angular runtime.
jest.mock('@angular/core', () => ({ Component: () => (x: any) => x }));
jest.mock('@angular/common', () => ({ CommonModule: {}, JsonPipe: () => {}, NgIf: () => {} }));
jest.mock('@angular/forms', () => ({ FormsModule: {} }));
jest.mock('@angular/router', () => ({ RouterOutlet: {} }));

import { AppComponent } from './app.component';

describe('AppComponent (shallow)', () => {
  it('should create', () => {
    const comp = new AppComponent();
    expect(comp).toBeTruthy();
  });
});
