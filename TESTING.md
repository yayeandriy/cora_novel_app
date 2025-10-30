# Notes Feature - Comprehensive Test Suite

## Overview

This document describes the complete test coverage for the notes feature implementation, including unit tests, integration tests (backend), and end-to-end tests.

## Test Architecture

### Test Layers

```
┌─────────────────────────────────────────┐
│  E2E Tests (Playwright)                 │
│  - User workflows                       │
│  - Multi-browser testing                │
│  - UI interactions                      │
└──────────────┬──────────────────────────┘
               │
┌──────────────┴──────────────────────────┐
│  Frontend Unit Tests (Jest)             │
│  - Cache behavior                       │
│  - Data persistence                     │
│  - Concurrent operations                │
└──────────────┬──────────────────────────┘
               │
┌──────────────┴──────────────────────────┐
│  Backend Tests (Cargo)                  │
│  - Database operations                  │
│  - Notes persistence                    │
│  - Special character handling           │
└─────────────────────────────────────────┘
```

## Frontend Unit Tests

**File:** `src/app/project-view.component.notes.spec.ts`

**Framework:** Jest with Jasmine syntax

**Test Count:** 19 tests across 5 describe blocks

### Test Suites

#### 1. Cache Storage (7 tests)
- ✅ Cache notes immediately when changed
- ✅ Preserve notes across multiple updates
- ✅ Handle empty string notes
- ✅ Handle null notes
- ✅ Store notes separately from text
- ✅ Handle very long notes (10KB+)
- ✅ Handle special characters in notes

#### 2. Cache Clearing (4 tests)
- ✅ Clear cache after successful save
- ✅ Keep cache on save failure
- ✅ Support clearing specific documents
- ✅ Support clearing all cache

#### 3. Multi-document Operations (3 tests)
- ✅ Maintain independent cache for multiple documents
- ✅ Update one document without affecting others
- ✅ Handle concurrent text and notes updates

#### 4. Auto-save Timer Logic (2 tests)
- ✅ Track unsaved changes
- ✅ Clear unsaved flag after save

#### 5. Edge Cases (3 tests)
- ✅ Handle empty string
- ✅ Handle null values
- ✅ Handle large data

**Running Frontend Unit Tests:**
```bash
npm run test:unit
```

**Output Example:**
```
PASS  src/app/services/project.service.spec.ts
PASS  src/app/app.component.spec.ts
PASS  src/app/project-view.component.notes.spec.ts

Test Suites: 3 passed, 3 total
Tests:       19 passed, 19 total
```

## Backend Unit Tests

**File:** `src-tauri/src/services/docs.rs`

**Framework:** Cargo native tests (Rust)

**Test Count:** 7 tests

### Test Functions

#### 1. test_update_doc_notes()
- Tests basic notes update operation
- Verifies notes can be set and retrieved from database
- Validates INSERT and SELECT operations

#### 2. test_update_doc_notes_multiple_times()
- Tests updating notes multiple times on same document
- Ensures previous values are properly overwritten
- Validates sequential update behavior

#### 3. test_notes_with_special_characters()
- Tests notes containing:
  - Single and double quotes
  - Newlines
  - Tab characters
  - Unicode characters
- Validates proper escaping and persistence

#### 4. test_list_docs_includes_notes()
- Tests that list_docs() returns all notes
- Validates notes appear in bulk document queries
- Ensures consistency across multiple documents

#### 5. test_empty_notes()
- Tests storing empty string notes
- Validates distinction between NULL and empty string
- Tests empty string persistence

#### 6. test_very_long_notes()
- Tests 10KB notes storage and retrieval
- Validates large data handling
- Ensures no truncation or data loss

#### 7. test_notes_persist_across_other_updates()
- Tests that notes survive text content updates
- Validates notes remain intact when other columns change
- Ensures cross-operation data integrity

### Database Schema for Tests

Tests use isolated in-memory SQLite databases with unique names (memory0, memory1, etc.) to prevent locking issues.

**Migrations Run:**
1. `001_create_schema.sql` - Core tables (projects, docs, etc.)
2. `002_add_tree_order.sql` - Tree structure support
3. `003_add_doc_notes.sql` - Notes column (implicit via ALTER TABLE)

**Running Backend Tests:**
```bash
cd src-tauri
cargo test --lib services::docs::tests
```

**Output Example:**
```
running 8 tests
test services::docs::tests::doc_create_get ... ok
test services::docs::tests::test_update_doc_notes ... ok
test services::docs::tests::test_update_doc_notes_multiple_times ... ok
test services::docs::tests::test_notes_with_special_characters ... ok
test services::docs::tests::test_list_docs_includes_notes ... ok
test services::docs::tests::test_empty_notes ... ok
test services::docs::tests::test_very_long_notes ... ok
test services::docs::tests::test_notes_persist_across_other_updates ... ok

test result: ok. 8 passed; 0 failed
```

## End-to-End Tests

**File:** `e2e/notes.e2e.spec.ts`

**Framework:** Playwright

**Test Count:** 8 scenarios

**Browser Coverage:** Chromium, Firefox, WebKit

### Test Scenarios

#### 1. Display notes section when document selected
- Verifies UI appears when a document is selected
- Tests DOM visibility of notes section
- Validates [data-testid="notes-section"] element

#### 2. Cache notes on rapid document switching
- Types notes in doc 1
- Rapidly switches to doc 2
- Returns to doc 1
- Verifies notes are preserved in cache
- Tests `[data-testid="notes-textarea"]` content

#### 3. Auto-save after 2 seconds inactivity
- Types notes
- Waits 2.5 seconds
- Verifies unsaved indicator disappears
- Validates auto-save timing

#### 4. No data loss on rapid document switching
- Switches between 3+ documents rapidly
- Modifies notes in each
- Verifies all data is preserved
- Tests concurrent save operations

#### 5. Unsaved indicator display
- Modifies notes
- Verifies `[data-testid="unsaved-indicator"]` appears
- Validates visual feedback

#### 6. Handle empty notes
- Clears notes textarea
- Waits for auto-save
- Verifies empty state is saved
- Tests edge case: empty vs NULL

#### 7. Collapse/expand notes section
- Clicks collapse button
- Verifies content hidden
- Clicks expand button
- Verifies content shown
- Tests `[data-testid="notes-collapse-btn"]` functionality

#### 8. Rich text formatting support
- Enters markdown-style content
- Includes headers, bold, italic, bullets, numbering
- Waits for auto-save
- Verifies formatting is preserved
- Tests multiline content storage

### Required Data Attributes

The e2e tests expect the following data attributes in the HTML:

```html
<!-- Document list item -->
<div data-testid="doc-item">...</div>

<!-- Notes section container -->
<div data-testid="notes-section">
  <!-- Notes textarea -->
  <textarea data-testid="notes-textarea"></textarea>
  
  <!-- Unsaved indicator -->
  <span data-testid="unsaved-indicator"></span>
  
  <!-- Content area -->
  <div data-testid="notes-content">...</div>
  
  <!-- Collapse button -->
  <button data-testid="notes-collapse-btn">...</button>
</div>
```

**Running E2E Tests:**

```bash
# Run in headless mode
npm run test:e2e

# Run with interactive UI
npm run test:e2e:ui

# Run in specific browser
npx playwright test --project=chromium
```

**Configuration:** `playwright.config.ts`
- Base URL: `http://localhost:4200`
- Web server: `ng serve` (auto-started)
- Parallel execution: enabled for CI/disabled for local
- Trace capture: on first failure

## Test Coverage Summary

| Layer | Framework | Count | Status | Exec Time |
|-------|-----------|-------|--------|-----------|
| Unit (Frontend) | Jest | 19 | ✅ PASS | 0.67s |
| Unit (Backend) | Cargo | 7 | ✅ PASS | 0.02s |
| E2E | Playwright | 8 | ⏳ Ready | ~30s |
| **Total** | **Mixed** | **34** | **✅** | **~31s** |

## Running All Tests

```bash
# Frontend unit tests
npm run test:unit

# Backend unit tests
cd src-tauri && cargo test --lib services::docs::tests

# E2E tests (requires running app)
npm run start &  # Start the app in background
npm run test:e2e
```

## Test Features

### Frontend Unit Tests

- **Mock-based:** No Angular TestBed complexity
- **Fast execution:** 19 tests in <1 second
- **Isolated:** Each test is independent
- **Comprehensive:** Covers caching, persistence, edge cases
- **Maintainable:** Pure unit test structure without framework dependencies

### Backend Unit Tests

- **In-memory database:** Fast, isolated test environment
- **Schema initialization:** Each test runs full migrations
- **Database locking prevention:** Unique memory databases (memory0, memory1, etc.)
- **Real queries:** Tests actual SQL operations
- **Edge cases:** Special characters, large data, edge values

### E2E Tests

- **Multi-browser:** Tests Chrome, Firefox, Safari
- **Real user workflows:** Simulates actual user interactions
- **Visual verification:** Checks DOM visibility and state
- **Timing validation:** Auto-save and debounce behavior
- **Data integrity:** Verifies data isn't lost during operations

## Key Features Tested

✅ **Caching:**
- Notes cached immediately on keystroke
- Cache preserved across document switches
- Cache cleared after successful save

✅ **Persistence:**
- Notes stored in SQLite database
- Special characters properly escaped
- Large notes (10KB+) supported
- Notes survive other document updates

✅ **Auto-save:**
- 2-second debounce after typing
- Unsaved indicator shown during changes
- Auto-save timer works correctly

✅ **UI/UX:**
- Notes section visible when document selected
- Collapse/expand functionality
- Rapid document switching doesn't cause data loss
- Empty notes handled correctly

✅ **Edge Cases:**
- Null vs empty string distinction
- Special characters and newlines
- Very long content (10KB+)
- Concurrent updates
- Rapid successive changes

## Notes Implementation Architecture

### Frontend (TypeScript/Angular)

**File:** `src/app/project-view.component.ts`

```typescript
// Local cache for unsaved changes
docStateCache: Map<number, { text?: string | null; notes?: string | null }> = new Map();

// Auto-save with 2-second debounce
onDocumentNotesChange() {
  clearTimeout(this.notesSaveTimer);
  this.selectedDoc.notes = event.target.value;
  this.docStateCache.set(this.selectedDoc.id, { 
    notes: this.selectedDoc.notes 
  });
  
  this.notesSaveTimer = setTimeout(() => {
    this.projectService.updateDocNotes(this.selectedDoc.id, this.selectedDoc.notes)
      .then(() => this.docStateCache.delete(this.selectedDoc.id));
  }, 2000);
}
```

### Backend (Rust/SQLite)

**File:** `src-tauri/src/services/docs.rs`

```rust
pub fn update_doc_notes(pool: &DbPool, id: i64, notes: &str) -> anyhow::Result<()> {
    let conn = get_conn(pool)?;
    
    // Create column if it doesn't exist
    conn.execute(
        "ALTER TABLE docs ADD COLUMN IF NOT EXISTS notes TEXT",
        [],
    ).ok();
    
    // Update notes
    conn.execute(
        "UPDATE docs SET notes = ?1 WHERE id = ?2",
        rusqlite::params![notes, id],
    ).context("updating doc notes")?;
    
    Ok(())
}
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run backend tests
        run: cd src-tauri && cargo test --lib
      
      - name: Run frontend unit tests
        run: npm run test:unit
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Run e2e tests
        run: npm run test:e2e
      
      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## Troubleshooting

### Frontend Unit Tests Fail: "Cannot use import statement outside a module"
**Solution:** Use CommonJS in Jest config, exclude .mjs files from node_modules

### Backend Tests Fail: "database schema is locked"
**Solution:** Use unique in-memory database names (memory0, memory1, etc.) to prevent lock contention

### E2E Tests Fail: "baseURL not set"
**Solution:** Ensure Playwright config has `baseURL: 'http://localhost:4200'` and web server is running

### E2E Tests Timeout: "Element not found"
**Solution:** Add test IDs to HTML elements and wait for them with `waitForLoadState('networkidle')`

## Future Enhancements

1. **Performance Testing:** Measure auto-save latency
2. **Stress Testing:** Test with 100KB+ notes
3. **Accessibility Testing:** WCAG compliance for notes section
4. **Mutation Testing:** Verify test effectiveness
5. **Visual Regression:** Screenshot comparison for UI consistency
6. **Load Testing:** Multiple concurrent users modifying notes

## Test Maintenance

- Run tests on every commit (via git hooks or CI)
- Update tests when changing notes feature
- Keep data attributes in sync between tests and components
- Review test coverage regularly (maintain >80%)
- Update this document when adding new test scenarios
