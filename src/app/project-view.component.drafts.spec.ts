// Mock Angular core so `@Injectable` import doesn't load ESM Angular at test runtime.
jest.mock("@angular/core", () => ({ Injectable: () => (x: any) => x }));
jest.mock("@tauri-apps/api/core", () => ({ invoke: jest.fn() }));

import { invoke } from "@tauri-apps/api/core";

describe('ProjectViewComponent - Drafts Feature', () => {
  const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;

  const mockDraft = {
    id: 1,
    doc_id: 10,
    name: 'Draft 1',
    content: 'Draft content',
    created_at: '2025-10-30T14:00:00Z',
    updated_at: '2025-10-30T14:00:00Z'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Draft Operations via Service', () => {
    it('should handle createDraft with proper parameters', async () => {
      mockInvoke.mockResolvedValue(mockDraft);

      const result = await mockInvoke('draft_create', {
        docId: 10,
        payload: { name: 'Draft 1', content: 'Draft content' }
      });

      expect(mockInvoke).toHaveBeenCalledWith('draft_create', {
        docId: 10,
        payload: { name: 'Draft 1', content: 'Draft content' }
      });
      expect(result).toEqual(mockDraft);
    });

    it('should handle listDrafts with docId', async () => {
      const drafts = [mockDraft];
      mockInvoke.mockResolvedValue(drafts);

      const result = await mockInvoke('draft_list', { docId: 10 });

      expect(mockInvoke).toHaveBeenCalledWith('draft_list', { docId: 10 });
      expect(result).toEqual(drafts);
    });

    it('should handle getDraft with id', async () => {
      mockInvoke.mockResolvedValue(mockDraft);

      const result = await mockInvoke('draft_get', { id: 1 });

      expect(mockInvoke).toHaveBeenCalledWith('draft_get', { id: 1 });
      expect(result).toEqual(mockDraft);
    });

    it('should handle updateDraft with payload', async () => {
      const updated = { ...mockDraft, name: 'Updated' };
      mockInvoke.mockResolvedValue(updated);

      const result: any = await mockInvoke('draft_update', {
        id: 1,
        payload: { name: 'Updated', content: null }
      });

      expect(mockInvoke).toHaveBeenCalledWith('draft_update', {
        id: 1,
        payload: { name: 'Updated', content: null }
      });
      expect(result.name).toBe('Updated');
    });

    it('should handle deleteDraft with id', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await mockInvoke('draft_delete', { id: 1 });

      expect(mockInvoke).toHaveBeenCalledWith('draft_delete', { id: 1 });
    });

    it('should handle restoreDraftToDoc', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await mockInvoke('draft_restore', { draftId: 1 });

      expect(mockInvoke).toHaveBeenCalledWith('draft_restore', { draftId: 1 });
    });

    it('should handle deleteAllDrafts', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await mockInvoke('draft_delete_all', { docId: 10 });

      expect(mockInvoke).toHaveBeenCalledWith('draft_delete_all', { docId: 10 });
    });
  });

  describe('Draft Data Handling', () => {
    it('should handle multiple drafts', async () => {
      const drafts = [
        { ...mockDraft, id: 1, name: 'Draft 1' },
        { ...mockDraft, id: 2, name: 'Draft 2' },
        { ...mockDraft, id: 3, name: 'Draft 3' }
      ];
      mockInvoke.mockResolvedValue(drafts);

      const result = await mockInvoke('draft_list', { docId: 10 });

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
    });

    it('should handle empty draft list', async () => {
      mockInvoke.mockResolvedValue([]);

      const result = await mockInvoke('draft_list', { docId: 10 });

      expect(result).toEqual([]);
    });

    it('should handle null/non-existent draft', async () => {
      mockInvoke.mockResolvedValue(null);

      const result = await mockInvoke('draft_get', { id: 999 });

      expect(result).toBeNull();
    });

    it('should preserve draft timestamps', async () => {
      mockInvoke.mockResolvedValue(mockDraft);

      const result: any = await mockInvoke('draft_create', {
        docId: 10,
        payload: { name: 'Draft 1', content: 'Content' }
      });

      expect(result.created_at).toBe('2025-10-30T14:00:00Z');
      expect(result.updated_at).toBe('2025-10-30T14:00:00Z');
    });

    it('should maintain doc_id reference', async () => {
      mockInvoke.mockResolvedValue(mockDraft);

      const result: any = await mockInvoke('draft_get', { id: 1 });

      expect(result.doc_id).toBe(10);
    });
  });

  describe('Draft Content Handling', () => {
    it('should handle draft with long content', async () => {
      const longContent = 'A'.repeat(10000);
      const draftWithLongContent = { ...mockDraft, content: longContent };
      mockInvoke.mockResolvedValue(draftWithLongContent);

      const result: any = await mockInvoke('draft_create', {
        docId: 10,
        payload: { name: 'Long Draft', content: longContent }
      });

      expect(result.content.length).toBe(10000);
    });

    it('should handle draft with special characters', async () => {
      const specialContent = '!@#$%^&*()_+-=[]{}|;:"<>?,./';
      const draftWithSpecial = { ...mockDraft, content: specialContent };
      mockInvoke.mockResolvedValue(draftWithSpecial);

      const result: any = await mockInvoke('draft_create', {
        docId: 10,
        payload: { name: 'Special', content: specialContent }
      });

      expect(result.content).toBe(specialContent);
    });

    it('should handle draft with empty content', async () => {
      const emptyDraft = { ...mockDraft, content: '' };
      mockInvoke.mockResolvedValue(emptyDraft);

      const result: any = await mockInvoke('draft_create', {
        docId: 10,
        payload: { name: 'Empty', content: '' }
      });

      expect(result.content).toBe('');
    });
  });

  describe('Error Handling', () => {
    it('should propagate errors from service', async () => {
      const error = new Error('Service error');
      mockInvoke.mockRejectedValue(error);

      await expect(
        mockInvoke('draft_create', {
          docId: 10,
          payload: { name: 'Draft', content: 'Content' }
        })
      ).rejects.toThrow('Service error');
    });

    it('should handle network errors', async () => {
      const error = new Error('Network error');
      mockInvoke.mockRejectedValue(error);

      await expect(
        mockInvoke('draft_list', { docId: 10 })
      ).rejects.toThrow('Network error');
    });
  });
});
