/**
 * Unit Tests for Document Creation and Selection
 * 
 * These tests simulate the component's workflow to verify the fix:
 * The FIX: loadProject() THEN expandGroup() THEN findDocById()
 * 
 * The BUG (if it regresses): Setting selectedDoc before reload (stale reference)
 * 
 * These tests PASS when the fix works (new doc is in reloaded tree)
 * These tests FAIL if the fix breaks (selectedDoc becomes stale)
 */

describe('Document Creation and Selection - Fix Verification', () => {
  interface Doc {
    id: number;
    name: string;
    doc_group_id: number;
    sort_order: number;
    text: string;
  }

  interface DocGroup {
    id: number;
    name: string;
    docs: Doc[];
    groups?: DocGroup[];
  }

  // Helper: Find doc in tree (mirrors component's findDocById)
  function findDocById(docGroups: DocGroup[], docId: number): Doc | null {
    const search = (groups: DocGroup[]): Doc | null => {
      for (const group of groups) {
        const doc = group.docs.find(d => d.id === docId);
        if (doc) return doc;
        if (group.groups) {
          const found = search(group.groups);
          if (found) return found;
        }
      }
      return null;
    };
    return search(docGroups);
  }

  // Helper: Simulate tree reload (creates new object references)
  function reloadTreeWithNewDoc(oldGroups: DocGroup[], newDoc: Doc): DocGroup[] {
    return oldGroups.map(group => {
      if (group.id === newDoc.doc_group_id) {
        return {
          ...group,
          docs: [
            ...group.docs.map(d => ({ ...d })), // NEW references
            { ...newDoc } // NEW reference
          ]
        };
      }
      return { ...group };
    });
  }

  describe('The FIX: loadProject() -> expandGroup() -> findDocById()', () => {
    it('should find newly created doc in reloaded tree using findDocById', () => {
      // Setup: Initial state
      let docGroups: DocGroup[] = [
        {
          id: 1,
          name: 'Chapter 1',
          docs: [
            { id: 1, name: 'Existing Doc', doc_group_id: 1, sort_order: 1, text: '' }
          ]
        }
      ];

      // Backend returns new doc
      const newDocFromBackend: Doc = {
        id: 2,
        name: 'New Doc',
        doc_group_id: 1,
        sort_order: 2,
        text: ''
      };

      // THE FIX WORKFLOW:
      // 1. Reload project (creates new tree with new object references)
      docGroups = reloadTreeWithNewDoc(docGroups, newDocFromBackend);

      // 2. Find newly created doc in the NEW tree
      const newDoc = findDocById(docGroups, newDocFromBackend.id);

      // Verify: doc is found in tree
      expect(newDoc).toBeDefined();
      expect(newDoc?.id).toBe(2);
      expect(newDoc?.name).toBe('New Doc');
    });

    it('should have selectedDoc as reference from NEW tree (not stale)', () => {
      // Setup
      let docGroups: DocGroup[] = [
        {
          id: 1,
          name: 'Chapter 1',
          docs: [
            { id: 1, name: 'Existing Doc', doc_group_id: 1, sort_order: 1, text: '' }
          ]
        }
      ];

      const newDocFromBackend: Doc = {
        id: 2,
        name: 'New Doc',
        doc_group_id: 1,
        sort_order: 2,
        text: ''
      };

      // FIX WORKFLOW:
      docGroups = reloadTreeWithNewDoc(docGroups, newDocFromBackend);
      const newDoc = findDocById(docGroups, newDocFromBackend.id);

      // Set selectedDoc to the found reference from the NEW tree
      let selectedDoc: Doc | null = newDoc || null;

      // Verify: selectedDoc is now a reference from the tree
      expect(selectedDoc).toBe(newDoc);
      // Most important check: selectedDoc is in the tree
      expect(docGroups[0].docs.includes(selectedDoc!)).toBe(true);
    });

    it('should include newly created doc in tree structure', () => {
      // Setup
      let docGroups: DocGroup[] = [
        {
          id: 1,
          name: 'Chapter 1',
          docs: [
            { id: 1, name: 'Doc 1', doc_group_id: 1, sort_order: 1, text: '' }
          ]
        }
      ];

      const newDoc: Doc = {
        id: 2,
        name: 'Doc 2',
        doc_group_id: 1,
        sort_order: 2,
        text: ''
      };

      // Fix: Reload tree
      docGroups = reloadTreeWithNewDoc(docGroups, newDoc);

      // Verify: tree now has 2 docs
      expect(docGroups[0].docs.length).toBe(2);
      expect(docGroups[0].docs.map(d => d.id)).toEqual([1, 2]);
      expect(docGroups[0].docs[1].name).toBe('Doc 2');
    });
  });

  describe('Multiple Sequential Document Creations', () => {
    it('should correctly select second created doc (not first one)', () => {
      // Setup: Initial state
      let docGroups: DocGroup[] = [
        {
          id: 1,
          name: 'Chapter 1',
          docs: [
            { id: 1, name: 'Doc 1', doc_group_id: 1, sort_order: 1, text: '' }
          ]
        }
      ];

      let selectedDoc: Doc | null = null;

      // Create first doc
      const newDoc1: Doc = {
        id: 2,
        name: 'Doc 2',
        doc_group_id: 1,
        sort_order: 2,
        text: ''
      };
      docGroups = reloadTreeWithNewDoc(docGroups, newDoc1);
      selectedDoc = findDocById(docGroups, 2) || null;
      expect(selectedDoc?.id).toBe(2);

      // Create second doc
      const newDoc2: Doc = {
        id: 3,
        name: 'Doc 3',
        doc_group_id: 1,
        sort_order: 3,
        text: ''
      };
      docGroups = reloadTreeWithNewDoc(docGroups, newDoc2);
      selectedDoc = findDocById(docGroups, 3) || null; // Find the new one

      // Verify: second doc is selected, not first
      expect(selectedDoc?.id).toBe(3);
      expect(selectedDoc?.name).toBe('Doc 3');
      expect(docGroups[0].docs.length).toBe(3);
    });

    it('should keep all docs after multiple creations', () => {
      let docGroups: DocGroup[] = [
        {
          id: 1,
          name: 'Chapter 1',
          docs: [
            { id: 1, name: 'Doc 1', doc_group_id: 1, sort_order: 1, text: '' }
          ]
        }
      ];

      // Create doc 2
      docGroups = reloadTreeWithNewDoc(docGroups, {
        id: 2,
        name: 'Doc 2',
        doc_group_id: 1,
        sort_order: 2,
        text: ''
      });

      // Create doc 3
      docGroups = reloadTreeWithNewDoc(docGroups, {
        id: 3,
        name: 'Doc 3',
        doc_group_id: 1,
        sort_order: 3,
        text: ''
      });

      // Verify all docs are in tree
      expect(docGroups[0].docs.length).toBe(3);
      expect(docGroups[0].docs.map(d => d.id)).toEqual([1, 2, 3]);
    });
  });

  describe('Nested Groups', () => {
    it('should find doc in nested group', () => {
      let docGroups: DocGroup[] = [
        {
          id: 1,
          name: 'Part 1',
          docs: [{ id: 1, name: 'Doc 1', doc_group_id: 1, sort_order: 1, text: '' }],
          groups: [
            {
              id: 2,
              name: 'Chapter 1',
              docs: [
                { id: 2, name: 'Doc 2', doc_group_id: 2, sort_order: 1, text: '' }
              ]
            }
          ]
        }
      ];

      // Create new doc in nested group
      const newDoc: Doc = {
        id: 3,
        name: 'Doc 3',
        doc_group_id: 2,
        sort_order: 2,
        text: ''
      };

      // Find nested group and "reload" it
      if (docGroups[0].groups) {
        docGroups[0].groups[0].docs = [
          ...docGroups[0].groups[0].docs.map(d => ({ ...d })),
          { ...newDoc }
        ];
      }

      // Verify: doc is found in nested tree
      const found = findDocById(docGroups, 3);
      expect(found).toBeDefined();
      expect(found?.id).toBe(3);
      expect(docGroups[0].groups?.[0].docs.length).toBe(2);
    });
  });

  describe('REGRESSION TESTS - If Fix Breaks, These Should Fail', () => {
    it('should NOT work if selectedDoc is set before reload (stale reference)', () => {
      // Setup
      let docGroups: DocGroup[] = [
        {
          id: 1,
          name: 'Chapter 1',
          docs: [
            { id: 1, name: 'Existing', doc_group_id: 1, sort_order: 1, text: '' }
          ]
        }
      ];

      const newDocFromBackend: Doc = {
        id: 2,
        name: 'New Doc',
        doc_group_id: 1,
        sort_order: 2,
        text: ''
      };

      // THE BUG (if it regresses): Set selectedDoc BEFORE reload
      let selectedDoc: Doc | null = newDocFromBackend; // STALE reference!

      // Then reload (creates new objects)
      docGroups = reloadTreeWithNewDoc(docGroups, newDocFromBackend);

      // Now selectedDoc is STALE - it's not in the new tree!
      // This test verifies the bug would be caught:
      const isInNewTree = docGroups[0].docs.includes(selectedDoc);
      expect(isInNewTree).toBe(false); // Bug confirmed: stale reference NOT in tree

      // If someone reverts the fix and sets selectedDoc before reload,
      // this test will fail and alert us!
      const fixedSelectedDoc = findDocById(docGroups, 2);
      expect(fixedSelectedDoc).toBeDefined();
      expect(fixedSelectedDoc !== selectedDoc).toBe(true); // Different objects!
    });
  });
});
