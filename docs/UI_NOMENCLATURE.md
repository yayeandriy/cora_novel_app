# Cora Novel App - UI Nomenclature & Definitions

**Last Updated:** January 10, 2026  
**Version:** 2.0 (Based on current UI implementation)

## Document Purpose
This document establishes the official terminology, naming conventions, and definitions for all UI components, entities, and features in the Cora Novel App. Use this as the single source of truth for consistent communication across documentation, code, and user-facing text.

---

## Core Application Structure

### Main Layout Areas

#### **Project Workbench**
The primary workspace for editing a novel project, consisting of three main panels:

1. **Left Panel (Document Tree Panel)**
   - Collapsible sidebar on the left
   - Default width: 250px
   - Keyboard shortcut: `Cmd+1`
   - Contains the Document Navigator

2. **Center Panel (Editor Area)**
   - Primary content editing zone
   - Variable width (40-100% of available space)
   - Contains: Document Editor, Group View, or Planning Dock (Storyline/Notes views)
   
3. **Right Panel (Metadata Sidebar)**
   - Collapsible sidebar on the right
   - Default width: 300px
   - Keyboard shortcut: `Cmd+3`
   - Contains metadata management tools

**Full-Width Mode:** `Cmd+2` toggles both sidebars for distraction-free writing

---

## Left Panel: Document Navigator

### Document Tree
Visual hierarchy of the project structure showing:
- **Parts** (root-level folders)
- **Chapters** (documents within parts)
- Nested subfolders (future support)

### Tree Item Types

#### **Part** (formerly "Doc Group" or "Folder")
- **Definition:** A top-level organizational unit representing a major section of the novel
- **Visual:** Folder icon with expansion arrow
- **Naming Convention:** "Part I", "Part II", etc. (Roman numerals)
- **Features:**
  - Can contain multiple chapters
  - Can be expanded/collapsed
  - Has optional notes
  - Shows draft indicator badge when folder notes exist
  - Can be reordered with `Alt+Arrow`

#### **Chapter** (formerly "Doc" or "Document")
- **Definition:** An individual writing unit containing the actual novel text
- **Visual:** Document icon with chapter title
- **Naming Convention:** "Chapter One", "Chapter Two", etc. (literal numbers)
- **Features:**
  - Contains main text and optional notes
  - Shows draft indicator badge when document drafts exist
  - Can be moved between parts
  - Can be reordered within a part with `Alt+Arrow`
  - Tracks associated characters, events, and places

### Visual Indicators
- **Draft Badge:** Orange dot appears on items with saved drafts
- **Working Doc Marker:** Bold text indicates the currently active document
- **Selection Highlight:** Blue background shows selected item
- **Expansion State:** Arrow points down when expanded, right when collapsed

---

## Center Panel: Content Views

### 1. Document Editor View
**When:** A chapter is selected  
**Components:**

#### **Document Header Bar** (Inline Headers)
Appears at the top of the editor area when scrolled to top:
- **Project Header:** Shows project name (editable inline)
- **Part Header:** Shows part name (editable inline) with index label (e.g., "1.")
- **Chapter Header:** Shows chapter name (editable inline) with full index (e.g., "1.5")

**Behavior:**
- Headers hide when scrolling down past 50px
- Hovering near top when hidden shows floating overlay version
- Click-outside dismisses inline headers when scrolled
- Each header is clickable to expand additional tools

#### **Toolbar Actions** (Top-right)
Three primary action buttons:

1. **Storyline Button** (`⊞ Storyline`)
   - Opens Planning Dock in Storyline View
   - Shows overview of all chapters with metadata
   - Closes Notes View if open (switches dock mode)

2. **Notes Button** (`📄 Notes`)
   - Opens Planning Dock in Notes View
   - Shows folder-level notes and folder drafts
   - Closes Storyline View if open (switches dock mode)

3. **Drafts Button** (`📋 Drafts`)
   - Opens Chapter Drafts Panel (split-pane view)
   - Can remain open alongside Storyline or Notes (no mutual exclusivity)

#### **Main Textarea**
- **Content:** Chapter text
- **Auto-save:** 2 seconds after typing stops
- **Font:** Crimson Text, serif
- **Line height:** 1.8
- **Features:**
  - Selection stats shown in footer when text selected
  - Cmd+F for find in current chapter
  - Cmd+Shift+F for project-wide search
  - Cmd+H for find and replace

#### **Notes Textarea** (Below main text, optional)
- **Content:** Chapter-specific notes
- **Collapsible:** Can be hidden/shown
- **Auto-save:** 2 seconds after typing
- **Visual:** Distinct background color

#### **Footer Bar**
Displays document statistics:
- Word count (current doc)
- Character count (current doc)
- Page count estimate (current doc)
- Project totals
- Selection stats when text is selected
- Last save timestamp

### 2. Group View (Part View)
**When:** A part (folder) is selected  
**Shows:**
- Part name (editable)
- Part notes editor
- Part drafts section (optional notes cards)
- List of chapters in this part (for navigation)

### 3. Planning Dock
**Definition:** A collapsible top panel in the editor area that provides two mutually exclusive views for organizing and planning your novel.

**Two Modes:**
- **Storyline View** (Project Cards View) - Overview of all chapters with metadata
- **Notes View** (Part Notes) - Folder-level planning notes and drafts

**Behavior:**
- Opened via toolbar buttons: "⊞ Storyline" or "📄 Notes"
- Only one mode visible at a time (mutual exclusivity)
- Can remain open alongside Drafts panel (no mutual exclusivity with drafts)
- Closes with `Esc` key

---

### 3a. Storyline View (within Planning Dock)
**When:** Storyline button clicked  
**Visual Layout:**

#### **Parts Row** (Horizontal scroll)
Chips representing each part:
- Click to filter chapters by part
- Shows part index and name
- Auto-scrolls horizontally with mouse wheel

#### **Chapters Grid** (Horizontal scroll)
Cards for each chapter in selected part:
- **Card Header:** Chapter index + name
- **Metadata Sections:**
  - Characters (yellow/orange chips)
  - Events (blue chips)
  - Places (green chips)
- **Actions:**
  - Click card to highlight (not navigate)
  - Double-click name to edit
  - Click metadata to expand/collapse
  - Add new metadata items via dropdowns

**Behavior:**
- Mouse wheel scrolls horizontally
- Closes when Esc pressed
- Closes when Notes button clicked (switches to Notes View)
- Can remain open with Drafts panel

### 3b. Notes View (within Planning Dock)
**When:** Notes button clicked  
**Components:**

#### **Part Notes Editor**
- Rich text area for folder-level planning notes
- Auto-saves after 2 seconds
- Full-width editor

#### **Folder Drafts Section** (Expandable)
Horizontal scrollable cards for folder notes:
- **Draft Card:** Timestamp-based name
- **Content:** Text area for quick notes
- **Actions:**
  - Rename (double-click)
  - Delete (trash icon)
  - Reorder (drag handles)
  - Add new (+ button)
- **Sync Status:** Shows "syncing" → "synced" checkmark

**Behavior:**
- Closes when Esc pressed
- Closes when Storyline button clicked (switches to Storyline View)
- Can remain open with Drafts panel

---

## Right Panel: Metadata Sidebar

### Panel Tabs (Always visible)
Three mutually exclusive tabs:

#### 1. **Characters Tab** (Default)
- **Add Button:** Creates new character
- **Character List:** Ordered cards
  - Name (editable inline)
  - Description (expandable)
  - Checkbox: Linked to current chapter
  - Edit/Delete actions
- **Drag-to-reorder:** Visual handles
- **Search/Filter:** Quick find (future)

#### 2. **Events Tab**
- **Add Button:** Creates new event
- **Event List:** Ordered cards
  - Name (editable inline)
  - Description (expandable)
  - Date range (start/end dates)
  - Checkbox: Linked to current chapter
  - Edit/Delete actions
- **Drag-to-reorder:** Visual handles

#### 3. **Places Tab**
- **Add Button:** Creates new place
- **Place List:** Ordered cards
  - Name (editable inline)
  - Description (expandable)
  - Checkbox: Linked to current chapter
  - Edit/Delete actions
- **Drag-to-reorder:** Visual handles

### Context-Sensitive Display
When viewing:
- **Chapter:** Shows project-wide metadata with checkboxes for linking to current chapter
- **Part:** Shows project-wide metadata with checkboxes for linking to folder
- **No Selection:** Shows project-wide metadata (read-only)

---

## Drafts System

### Chapter Drafts (Document Drafts)
**Location:** Split-pane view in Document Editor  
**When:** Drafts button clicked for a chapter

#### **Drafts List** (Left column of split)
- Vertical scrollable list
- **Draft Chip:** Name + timestamp
- **Selected State:** Highlighted background
- **Actions:**
  - Click to view in split pane
  - Double-click name to rename
  - Delete button (trash icon)
  - Restore to main text option

#### **Draft Editor** (Right column of split)
- Full-height text area
- Live sync with 500ms debounce
- Shows sync status indicator
- Content persists to localStorage

**Special Behavior:**
- New drafts start with empty content
- Draft selection persists per chapter in localStorage
- Only one draft type visible at a time (doc, folder, or project)

### Folder Drafts (Part Notes)
**Location:** Within Part Notes Dock (Notes panel)  
**Visual:** Horizontal scrollable cards

#### **Draft Card**
- Timestamp-based name (editable)
- Text area for content
- Drag handles for reordering
- Delete button
- Syncing/synced status indicator

**Features:**
- Mouse wheel scrolls horizontally
- Auto-save with 500ms debounce
- Selection persists per folder in localStorage
- Can be viewed in Document Editor split-pane when "External Draft Mode" active

### Project Drafts (Project-Level Notes)
**Location:** Available in toolbar (future implementation)  
**Similar to folder drafts but project-scoped**

---

## Timeline System

### Project Timeline Header
**Location:** Optional header above editor area  
**When:** Timeline button clicked in toolbar (top-right area)

#### **Timeline Bar**
Horizontal timeline showing:
- Project start/end dates
- Chapter intervals (colored bars)
- Date markers
- Clickable regions

**Interactions:**
- Click empty space: Set chapter start/end date
- Click interval: No action (prevents accidents)
- Drag to extend: Not supported (use click)
- Hover: Shows date tooltip

**Visual States:**
- Green bar: Chapter has timeline data
- Gray space: No timeline assigned
- Project bounds: Lighter background region

### Timeline Editor Modal (future)
Detailed date picker and range editor

---

## Command Palette

### Activation
- **Keyboard:** `Cmd+K` (commands mode)
- **Keyboard:** `Cmd+P` (go to document mode)
- **Keyboard:** `Cmd+F` (search in doc mode)
- **Keyboard:** `Cmd+Shift+F` (search project mode)
- **Keyboard:** `Cmd+H` (search and replace mode)

### Modes

#### 1. **Commands Mode** (Default)
- Shows all available commands
- Navigate with arrows
- Execute with Enter

#### 2. **Go to Document Mode** (`Cmd+P`)
- Quick navigation to any chapter
- Fuzzy search by name
- Shows part context

#### 3. **Search in Document Mode** (`Cmd+F`)
- Find text in current chapter
- Highlights matches
- Navigate results

#### 4. **Search Project Mode** (`Cmd+Shift+F`)
- Find text across all chapters
- Shows results with context
- Click to jump to location

#### 5. **Search and Replace Mode** (`Cmd+H`)
- Find and replace in current chapter
- Confirmation before replace
- Replace all option

---

## Special UI Elements

### Metadata Chips
**Visual:** Rounded rectangles with text  
**Colors:**
- **Characters:** Yellow/orange gradient
- **Events:** Blue gradient
- **Places:** Green/teal gradient

**Interactions:**
- Click: Select/toggle
- Double-click: Edit name
- Hover: Shows tooltip with description
- X button: Remove from context

### Draft Indicator Badges
**Visual:** Small orange dot  
**Location:** Next to part/chapter names in tree  
**Meaning:** Item has saved drafts

### Sync Status Indicators
**States:**
1. **Pending:** No indicator (local changes not saved)
2. **Syncing:** Spinner icon
3. **Synced:** Green checkmark (auto-hides after 2.5s)

### Floating Action Buttons
**Location:** Top-left corner when headers hidden by scroll  
**Appearance:** Semi-transparent overlay  
**Actions:**
- Shows project/part/chapter headers on hover
- Dismisses on click-outside

---

## Navigation & Selection Model

### Single Selection Rule
**Only one item can be selected at a time:**
- **Chapter selected:** Document Editor visible, chapter metadata active
- **Part selected:** Group View visible, folder metadata active
- **Nothing selected:** Welcome screen or last saved state

### Selection Persistence
- Saved to localStorage per project
- Restored on app launch
- Cleared on project switch

### Working Document Concept
**Definition:** The chapter the user is actively writing in  
**Visual:** Bold text in tree  
**Behavior:**
- Auto-set when user types 2+ meaningful characters
- Persists across sessions
- Used for "resume writing" quick action

---

## Keyboard Shortcuts Reference

### Global
- `Cmd+S` - Save current chapter
- `Cmd+N` - New chapter (in current part)
- `Cmd+Shift+N` - New part
- `Cmd+K` - Command palette
- `Cmd+P` - Go to document
- `Cmd+F` - Find in document
- `Cmd+Shift+F` - Find in project
- `Cmd+H` - Find and replace
- `Esc` - Focus tree / Close panels

### Layout
- `Cmd+1` - Toggle left sidebar
- `Cmd+2` - Toggle both sidebars (full-width)
- `Cmd+3` - Toggle right sidebar

### Tree Navigation
- `↑/↓` - Navigate up/down (cycles)
- `→` - Expand selected part
- `←` - Collapse selected part
- `Enter` - Open in editor / Toggle expansion
- `Shift+R` - Rename (focus input)
- `Delete/Backspace` - Delete item (with confirmation)
- `Alt+↑/↓` - Reorder item

---

## Data Model Terminology

### Core Entities

#### **Project**
- **Fields:** id, name, desc, path, notes, timeline_start, timeline_end, grid_order, created_at, updated_at
- **Contains:** Multiple parts
- **Scope:** Top-level organizational unit

#### **Part** (Doc Group)
- **Database Name:** `doc_groups`
- **UI Name:** "Part"
- **Fields:** id, project_id, name, parent_id, sort_order, notes
- **Contains:** Multiple chapters
- **Can be nested:** Yes (but UI currently shows only root-level)

#### **Chapter** (Document)
- **Database Name:** `docs`
- **UI Name:** "Chapter"
- **Fields:** id, project_id, path, name, timeline_id, text, notes, doc_group_id, sort_order
- **Contains:** Text content and notes
- **Belongs to:** One part (required)

#### **Character**
- **Fields:** id, project_id, name, desc
- **Relationships:** Many-to-many with chapters (via doc_characters table)

#### **Event**
- **Fields:** id, project_id, name, desc, start_date, end_date, date (legacy)
- **Relationships:** Many-to-many with chapters (via doc_events table)

#### **Place**
- **Fields:** id, project_id, name, desc
- **Relationships:** Many-to-many with chapters (via doc_places table)

#### **Draft** (Chapter Draft)
- **Database Name:** `drafts`
- **Fields:** id, doc_id, name, content, created_at, updated_at
- **Belongs to:** One chapter

#### **Folder Draft** (Part Notes)
- **Database Name:** `folder_drafts`
- **Fields:** id, doc_group_id, name, content, sort_order, created_at, updated_at
- **Belongs to:** One part

#### **Project Draft**
- **Database Name:** `project_drafts`
- **Fields:** id, project_id, name, content, created_at, updated_at
- **Belongs to:** One project

#### **Timeline**
- **Fields:** id, entity_type, entity_id, start_date, end_date
- **Applies to:** Projects, chapters, parts, or events
- **Relationship:** One-to-one with entity

---

## State Management & Persistence

### LocalStorage Keys
All temporary UI state is saved to localStorage:

#### Selection State
- `project_{id}_selection` - Current selected item
- `project_{id}_tree_state` - Expanded folders
- `project_{id}_working_doc` - Active writing document
- `cora-last-route` - Last app location (dashboard/project)
- `cora-last-project-id` - Last opened project

#### Draft State
- `cora-draft-{id}` - Local draft content (auto-save buffer)
- `cora-draft-selected-{projectId}-{docId}` - Selected chapter draft
- `cora-folder-draft-{id}` - Local folder draft content
- `cora-folder-draft-selected-{projectId}-{groupId}` - Selected folder draft
- `cora-project-draft-{id}` - Local project draft content
- `cora-project-draft-selected-{projectId}` - Selected project draft

#### Layout State
- `cora-layout` - Panel widths, collapsed states, editor width
- `cora-project-drafts-expanded-{projectId}` - Project drafts panel state
- `cora-folder-drafts-expanded-{projectId}` - Folder drafts panel state

#### Temporary Ordering (until backend sorting implemented)
- `cora-characters-order-{projectId}` - Character display order
- `cora-events-order-{projectId}` - Event display order
- `cora-places-order-{projectId}` - Place display order

### Backend Database
Persistent data stored in SQLite:
- Location: `~/Library/Application Support/cora/app.db` (macOS)
- Schema: Managed via migrations in `src-tauri/migrations/`
- Connection: Pooled via r2d2
- Auto-save: All text changes saved 2 seconds after typing stops

---

## Visual Design Tokens

### Colors
**Based on screenshots and code:**
- **Primary:** Blue (#3b82f6 family)
- **Selection:** Light blue background
- **Characters:** Yellow/orange (#fbbf24, #f59e0b)
- **Events:** Blue (#3b82f6, #60a5fa)
- **Places:** Green/teal (#10b981, #14b8a6)
- **Draft Badge:** Orange (#f97316)
- **Background:** White/off-white
- **Text:** Dark gray/black
- **Borders:** Light gray (#e5e7eb)

### Typography
- **Main Editor:** Crimson Text, serif, 16-18px
- **UI Elements:** System font, sans-serif
- **Tree Items:** 14px
- **Headers:** 18-24px, bold

### Spacing
- **Panel padding:** 16-20px
- **Card spacing:** 12px gaps
- **Chip spacing:** 4px gaps
- **Line height:** 1.5-1.8

---

## User Workflow Patterns

### Starting a New Project
1. Create project from dashboard
2. Project auto-creates: "Part I" folder + "Chapter One" document
3. User begins writing immediately
4. Add more parts/chapters as needed

### Writing Session
1. Select chapter from tree (or resume to working doc)
2. Edit in main textarea
3. Auto-save runs every 2 seconds
4. Toggle sidebars for focus mode (Cmd+2)
5. Add characters/events/places via right sidebar

### Organizing Metadata
1. Create characters/events/places in right sidebar
2. Link to chapters via checkboxes
3. Reorder by dragging cards
4. View relationships in Planning Dock (Storyline View)

### Using Drafts
1. Click Drafts button to open split-pane
2. Create new draft (starts empty)
3. Write alternative version
4. Compare side-by-side with main text
5. Restore draft to main or keep separate

### Planning with Notes
1. Click Notes button to open Planning Dock (Notes View)
2. Write planning notes in main editor
3. Create folder drafts for quick notes/ideas
4. Reorder drafts by dragging
5. All notes auto-save

---

## Terminology Migration Guide

### Old → New Terminology

| Old Term | New Term | Notes |
|----------|----------|-------|
| Doc Group | Part | User-facing only |
| Folder | Part | User-facing only |
| Doc | Chapter | User-facing only |
| Document | Chapter | User-facing only |
| Character list | Characters Tab | Right sidebar tab |
| Event list | Events Tab | Right sidebar tab |
| Place list | Places Tab | Right sidebar tab |
| Draft panel | Chapter Drafts | Split-pane view |
| Folder notes | Part Notes | Notes View in Planning Dock |
| Tree | Document Navigator | Left sidebar |
| Editor | Document Editor | Center panel |
| Sidebar | Metadata Sidebar | Right panel |
| Doc cards dock | Planning Dock | Top dock with two modes |
| Storyline | Storyline View | Planning Dock mode |

### API/Database Names (Unchanged)
These remain for backend compatibility:
- `doc_groups` table → UI shows "Parts"
- `docs` table → UI shows "Chapters"
- `drafts` table → UI shows "Chapter Drafts"
- `folder_drafts` table → UI shows "Part Notes"

---

## Future Enhancements

### Planned Features (Terminology TBD)
1. **Nested Parts:** Sub-folders within parts (maintain "Part" terminology?)
2. **Scenes:** Smaller units within chapters (below chapter level)
3. **Series Management:** Multi-book projects
4. **Collaboration:** Shared projects with permissions
5. **Version History:** Git-like commit system
6. **Export Templates:** Custom PDF/DOCX formatting
7. **Research Panel:** Fourth sidebar for reference materials
8. **Timeline Visual Editor:** Drag-and-drop timeline creation

---

## Appendix: Component Mapping

### Angular Components (src/app/components/)
- `DocTreeComponent` → Document Navigator (left panel)
- `DocumentEditorComponent` → Document Editor (center)
- `GroupViewComponent` → Group View / Part View (center)
- `RightSidebarComponent` → Metadata Sidebar (right panel)
- `ProjectTimelineComponent` → Timeline Header (optional top)
- `FolderDraftsComponent` → Folder Drafts Section (Notes dock)
- `MetadataChipsComponent` → Metadata chips (reusable)
- `CommandPaletteComponent` → Command Palette (modal overlay)
- `AppFooterComponent` → Footer Bar (bottom)

### Rust Services (src-tauri/src/services/)
- `projects` → Project CRUD
- `doc_groups` → Part CRUD (backend name)
- `docs` → Chapter CRUD (backend name)
- `characters` → Character CRUD + relationships
- `events` → Event CRUD + relationships
- `places` → Place CRUD + relationships
- `drafts` → Chapter Drafts CRUD
- `folder_drafts` → Part Notes CRUD
- `project_drafts` → Project Drafts CRUD
- `timelines` → Timeline CRUD

---

## Document Maintenance

### When to Update This Document
- UI redesigns or component restructuring
- New features that introduce new terminology
- User feedback indicating confusion about naming
- API changes that affect terminology
- Quarterly reviews for consistency

### Review Schedule
- **Minor updates:** As needed with feature releases
- **Major review:** Quarterly
- **User testing validation:** Bi-annually

---

**Document Version History:**
- v2.0 (Jan 2026): Complete rewrite based on current UI implementation
- v1.0 (Jun 2024): Initial terminology document

**Maintained by:** Development Team  
**Last Reviewed by:** [To be filled]  
**Next Review Date:** April 2026
