# Project View Component Refactoring

## Overview

The `project-view.component.ts` has been refactored into smaller, more manageable components following Angular best practices and the Single Responsibility Principle.

## Component Structure

### Main Components

#### 1. **ProjectViewComponent** (`project-view.component.ts`)
- **Role**: Main container component that orchestrates all child components
- **Responsibilities**:
  - Project loading and initialization
  - State management (selected doc/group, layout state)
  - Document/group CRUD operations
  - Draft management and syncing
  - Keyboard navigation and shortcuts
  - Auto-save functionality
  - Layout persistence

### Child Components

#### 2. **DocTreeComponent** (`components/doc-tree.component.ts`)
- **Role**: Left sidebar with document tree navigation
- **Responsibilities**:
  - Display hierarchical document structure
  - Handle tree item selection and expansion
  - Emit events for group/document selection
  - Manage sidebar resizing
  - Handle keyboard shortcuts within the tree

**Inputs**:
- `docGroups: DocGroup[]` - The hierarchical document structure
- `selectedDoc: Doc | null` - Currently selected document
- `selectedGroup: DocGroup | null` - Currently selected group

**Outputs**:
- `groupSelected` - Emitted when a group is clicked
- `docSelected` - Emitted when a document is clicked
- `groupToggled` - Emitted when group expansion is toggled
- `groupCreated` - Emitted to create a new group
- `docCreatedInGroup` - Emitted to create a document in a group
- `treeKeyDown` - Emitted for keyboard events
- `widthChanged` - Emitted when sidebar is resized

#### 3. **DocumentEditorComponent** (`components/document-editor.component.ts`)
- **Role**: Main document editor in the center area
- **Responsibilities**:
  - Display and edit document title
  - Display and edit document text
  - Show save status
  - Display word count
  - Handle text input events

**Inputs**:
- `selectedDoc: Doc | null` - The currently selected document
- `showSaveStatus: boolean` - Show save status indicator
- `hasUnsavedChanges: boolean` - Track unsaved changes

**Outputs**:
- `docNameChange` - Emitted when document name changes
- `docTextChange` - Emitted when document text changes
- `docSaved` - Emitted when user blurs the editor

#### 4. **GroupViewComponent** (`components/group-view.component.ts`)
- **Role**: View displayed when a group/folder is selected
- **Responsibilities**:
  - Display group name for editing
  - Show button to create new documents
  - Display placeholder message

**Inputs**:
- `selectedGroup: DocGroup | null` - Currently selected group

**Outputs**:
- `groupNameChange` - Emitted when group name changes
- `createDocRequested` - Emitted when create document button is clicked

#### 5. **RightSidebarComponent** (`components/right-sidebar.component.ts`)
- **Role**: Right sidebar container with collapsible sections
- **Responsibilities**:
  - Display and manage Characters section
  - Display and manage Events section
  - Display and manage Notes section
  - Manage sidebar resizing
  - Delegate to DraftsPanelComponent for drafts

**Inputs**:
- `selectedDoc: Doc | null`
- `characters: Character[]`
- `events: Event[]`
- `drafts: Draft[]`
- `draftSyncStatus: Record<number, 'syncing' | 'synced' | 'pending'>`
- `[section]Expanded: boolean` - Expansion state for each section

**Outputs**:
- `[section]ExpandedChange` - Emitted when section expansion changes
- `notesChanged` - Emitted when notes are modified
- `draftCreated`, `draftChanged`, `draftBlurred`, `draftDeleted` - Draft operations
- `widthChanged` - Emitted when sidebar is resized

#### 6. **DraftsPanelComponent** (`components/drafts-panel.component.ts`)
- **Role**: Drafts section within the right sidebar
- **Responsibilities**:
  - Display list of drafts
  - Handle draft content editing
  - Show sync status
  - Handle draft deletion

**Inputs**:
- `drafts: Draft[]`
- `draftSyncStatus: Record<number, 'syncing' | 'synced' | 'pending'>`
- `expanded: boolean`

**Outputs**:
- `expandedChange` - Emitted when expansion state changes
- `draftCreated`, `draftChanged`, `draftBlurred`, `draftDeleted` - Draft operations
- `draftContentRequested` - Emitted to get draft content

## File Structure

```
src/app/
├── project-view.component.ts      # Main orchestrator
├── project-view.component.html    # Main template
├── project-view.component.css     # Main styles
├── components/
│   ├── doc-tree.component.ts
│   ├── doc-tree.component.html
│   ├── doc-tree.component.css
│   ├── document-editor.component.ts
│   ├── document-editor.component.html
│   ├── document-editor.component.css
│   ├── group-view.component.ts
│   ├── group-view.component.html
│   ├── group-view.component.css
│   ├── right-sidebar.component.ts
│   ├── right-sidebar.component.html
│   ├── right-sidebar.component.css
│   ├── drafts-panel.component.ts
│   ├── drafts-panel.component.html
│   └── drafts-panel.component.css
```

## Benefits of This Refactoring

1. **Separation of Concerns**: Each component has a single, well-defined responsibility
2. **Reusability**: Components can be easily reused in other parts of the app
3. **Testability**: Smaller components are easier to test in isolation
4. **Maintainability**: Easier to locate and fix bugs
5. **Scalability**: New features can be added to specific components without affecting others
6. **Code Organization**: Better directory structure for larger teams

## State Management

The main `ProjectViewComponent` retains responsibility for:
- Overall state management (selected doc/group)
- Business logic (CRUD operations, auto-save)
- Complex interactions between components

Child components handle:
- Local UI state (expanded/collapsed sections)
- User interactions within their domain
- Emitting events for parent to handle

## Communication Pattern

- **Parent to Child**: Inputs for data binding
- **Child to Parent**: Outputs and event emitters
- **Between Siblings**: Through parent component (no direct sibling communication)

## Future Improvements

1. Implement a state management library (NgRx, Akita) for complex state
2. Extract database operations into a separate service layer
3. Add unit tests for each component
4. Extract keyboard shortcut handling into a dedicated service
5. Consider lazy loading for sidebar sections
