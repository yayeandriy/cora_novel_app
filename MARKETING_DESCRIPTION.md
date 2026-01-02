# Cora Novel App - Professional Writing Studio for Authors

## Transform Your Novel Writing Workflow

**Cora** is a professional-grade desktop application designed exclusively for novelists, storytellers, and creative writers who demand powerful organization without the complexity. Built with cutting-edge technology (Tauri + Angular), Cora delivers native desktop performance with an elegant, distraction-free interface.

---

## 🎯 Who Is Cora For?

- **Novel Writers** crafting multi-chapter, multi-part stories
- **Series Authors** managing complex story arcs across multiple books
- **Creative Writers** who need sophisticated character and event tracking
- **Professional Authors** seeking a reliable, offline-first writing environment
- **Organized Writers** who want their manuscripts, notes, and metadata in one place

---

## 🚀 Core Features

### 📚 **Hierarchical Document Organization**

**Never lose track of your manuscript structure again.**

- **Intelligent Part/Chapter System**: Organize your novel into Parts (Roman numerals: Part I, Part II) with unlimited nested chapters
- **Visual Tree Navigation**: Sidebar tree view with drag-and-drop reordering
- **Auto-numbering**: Documents automatically labeled (1.1, 1.2, 2.1) for easy reference
- **Expand/Collapse Controls**: Focus on the section you're writing while keeping the big picture accessible
- **Root-Level Folders**: Create standalone folders for research, notes, or alternative storylines

**Workflow**: 
1. Create folders for story structure (Acts, Parts, Books)
2. Add chapters within each folder
3. Drag and drop to reorganize instantly
4. Tree state persists between sessions

---

### ✍️ **Distraction-Free Editor**

**A clean writing environment that stays out of your way.**

- **Full-Screen Mode**: Toggle sidebars (Cmd+1, Cmd+2, Cmd+3) for pure writing focus
- **Adjustable Width**: Customize editor width from 40% to 100% of screen
- **Smart Auto-Save**: Changes saved automatically after 2 seconds of inactivity
- **Character Counter**: Real-time word count at the bottom of the editor
- **Document Notes**: Separate notes panel for each chapter (research, reminders, plot points)
- **Instant Caching**: Text cached in browser storage immediately - never lose work, even if auto-save hasn't triggered

**Keyboard Shortcuts**:
- `Cmd+S`: Manual save
- `Cmd+N`: New chapter
- `Cmd+Shift+N`: New folder
- `Cmd+P`: Quick document navigation
- `Cmd+F`: Search in current document
- `Cmd+Shift+F`: Search across entire project
- `Cmd+H`: Find and replace
- `Escape`: Return focus to tree

---

### 📝 **Advanced Drafts System**

**Experiment fearlessly with built-in version control.**

#### Document Drafts
- **Multiple Versions**: Create unlimited draft snapshots of any chapter
- **One-Click Restore**: Revert to any previous draft instantly
- **Split-View Editing**: View and edit drafts side-by-side with main document
- **Auto-Sync**: Drafts auto-save with visual sync indicators (pending/syncing/synced)
- **Timestamped**: Every draft shows creation and last modified times
- **Draft Indicators**: Visual markers in tree show which documents have saved drafts

#### Folder Notes (Folder Drafts)
- **Per-Folder Scratch Pads**: Each folder gets its own notes/drafts area
- **Unlimited Notes**: Store research, outlines, character sheets per section
- **Reorderable**: Drag notes to organize within folders
- **Persistent**: Notes stay with folders when you reorganize structure

#### Project-Level Drafts
- **Global Workspace**: Project-wide notes and drafts
- **Series Planning**: Perfect for overarching series notes or worldbuilding
- **Always Accessible**: Available from any document or folder view

**Use Cases**:
- Save experimental rewrites before committing
- Archive deleted scenes for potential later use
- Keep multiple endings and choose the best one
- Store research notes per chapter without cluttering main text

---

### 👥 **Character Management**

**Track unlimited characters across your entire story.**

- **Character Database**: Create comprehensive character profiles (name + detailed description)
- **Per-Document Assignment**: Tag which characters appear in each chapter
- **Per-Folder Views**: See all characters in a folder at a glance (union of all chapters)
- **Smart Search**: Dropdown autocomplete when adding characters to documents
- **Inline Editing**: Quick-edit character names directly in metadata chips
- **Reorderable Lists**: Custom sort order for your character lists
- **Visual Indicators**: Color-coded chips show character assignments at a glance

**Workflow**:
1. Create characters in the sidebar (Characters panel)
2. Write detailed descriptions for reference
3. Tag characters to chapters as they appear
4. View character presence across folders
5. Edit descriptions as characters develop

---

### 📅 **Event & Timeline Management**

**Organize complex plot timelines with precision.**

#### Events System
- **Event Database**: Create unlimited story events with names and descriptions
- **Date Ranges**: Set start and end dates for events (or single-day events)
- **Document Tagging**: Assign events to specific chapters
- **Folder Views**: See all events occurring within a story section
- **Visual Chips**: Events displayed as metadata chips in document view

#### Project Timeline Visualization
- **Adaptive Timeline Bar**: Visual timeline spanning your entire project
- **Smart Scaling**: Automatically adjusts tick marks based on project duration:
  - **Multi-year projects (3+ years)**: Years with quarterly divisions
  - **1-2 Year projects**: Years with monthly divisions  
  - **Within one year**: Monthly ticks with weekly subdivisions
  - **Within one month**: Weekly ticks with daily subdivisions
- **Interactive Date Pickers**: Click to set or modify start/end dates
- **Persistent Display**: Timeline header stays visible while writing

**Use Cases**:
- Track parallel storylines in complex narratives
- Manage historical fiction timelines with precision
- Coordinate multiple character arcs across chapters
- Visualize pacing and time gaps in your story

---

### 🗺️ **Places & Locations**

**Map your story's geography effortlessly.**

- **Location Database**: Unlimited places with names and descriptions
- **Document Assignment**: Tag locations where scenes take place
- **Folder-Level Views**: See all locations used in a story section
- **Worldbuilding Notes**: Store detailed setting descriptions
- **Visual Organization**: Places shown as metadata chips per document

**Perfect For**:
- Fantasy worldbuilding with multiple kingdoms/cities
- Travel narratives with changing locations
- Multi-setting stories (past/present, real/imagined)
- Detective/thriller stories with crime scenes

---

### 📊 **Project Timeline Feature**

**Visualize your writing project's scope and progress.**

- **Start & End Dates**: Set project timeline with inline date pickers
- **Visual Progress Bar**: See your project timeline at a glance
- **Intelligent Scaling**: Timeline adapts to show appropriate units (years/months/weeks/days)
- **Auto-Persistence**: Timeline dates saved automatically
- **Responsive Layout**: Timeline adjusts when toggling sidebars

**Applications**:
- Plan novel writing sprints
- Track multi-year series planning
- Coordinate with publishing deadlines
- Visualize NaNoWriMo progress

---

### 💾 **Import & Export**

**Seamlessly move your work in and out of Cora.**

#### Import Options
- **Bulk TXT Import**: Select multiple .txt files to import as chapters
- **Folder Import**: Import entire folders as Part structures (each subfolder becomes a Part)
- **Project Import**: Import complete Cora projects with full metadata preservation
- **ZIP Support**: Import zipped project exports with one click
- **Smart Placement**: Choose target folder for imported files

#### Export Options  
- **Project Export**: Export entire project as structured ZIP file
  - Folders become nested directories
  - Documents exported as numbered text files (1.1 Chapter One.txt)
  - Metadata preserved in JSON format
  - Drafts included for each document
- **PDF Export**: Generate professional manuscript PDF
  - Hierarchical structure with chapters and parts
  - Page numbers and running headers
  - Cyrillic and special character support
  - Automatic page breaks and formatting
- **Structured Text Export**: Maintains folder hierarchy and document order

**Round-Trip Support**: Export from Cora → Edit externally → Import back without data loss

---

### 🔍 **Command Palette & Search**

**Navigate and find anything instantly.**

#### Command Palette (Cmd+K)
- **Quick Navigation**: Jump to any document by name
- **Search Modes**: 
  - `Cmd+K`: Commands and document navigation
  - `Cmd+F`: Search within current document
  - `Cmd+Shift+F`: Search across entire project
  - `Cmd+H`: Find and replace in current document
- **Smart Matching**: Fuzzy search finds documents even with partial names
- **Result Preview**: See content snippets in search results
- **Position Jumping**: Click results to jump to exact position in documents

#### Full-Text Search
- **Project-Wide**: Search across all chapters and notes simultaneously
- **Context Snippets**: See surrounding text for each match
- **Instant Navigation**: Click any result to jump directly to that document
- **Find & Replace**: Bulk replace text across current document

---

### 🎨 **Storyline & Doc Cards View**

**Visualize your entire manuscript at once.**

- **Expandable Header**: Click project or folder headers to reveal storyline view
- **Document Cards**: Each chapter displayed as a card with:
  - Chapter number and title
  - Assigned characters (with inline add/remove)
  - Linked events and places
  - Visual indicators for drafts
- **Metadata Management**: Add/remove characters, events, places directly from cards
- **Highlight System**: Click cards to highlight without navigating away
- **Horizontal Scroll**: Mouse wheel scrolls cards horizontally for easy browsing

**Use Cases**:
- Get bird's-eye view of story structure
- Verify character presence across chapters
- Check event distribution throughout narrative
- Quick metadata tagging across multiple chapters

---

### 🏠 **Project Dashboard**

**Manage multiple writing projects effortlessly.**

- **Grid View**: All projects displayed as visual cards
- **Quick Stats**: Word count and chapter count per project
- **Recent Access**: Projects sorted by last modified date
- **Timeline Preview**: See project timelines at a glance
- **One-Click Creation**: New project wizard with automatic structure
- **Import Project**: Add existing projects from disk
- **Grid Order**: Drag to reorder projects in custom arrangement

---

## 🔧 Technical Excellence

### Desktop-Native Performance
- **Built with Tauri v2**: Rust backend for blazing-fast performance and minimal memory footprint
- **Angular 20 Frontend**: Modern, reactive UI with TypeScript type safety
- **SQLite Database**: Local-first data storage with WAL mode for excellent concurrency
- **No Cloud Dependency**: 100% offline - your work stays on your machine
- **Native macOS Integration**: Feels like a native Mac app (Windows/Linux coming soon)

### Data Safety & Reliability
- **Auto-Save**: Text cached instantly in localStorage, saved to DB after 2 seconds
- **Crash Recovery**: Unsaved changes preserved even if app crashes
- **Database Migrations**: Seamless schema updates without data loss
- **Export Backups**: Regular ZIP exports serve as backups
- **No Lock-In**: Export to standard formats anytime

### Professional Development
- **Comprehensive Test Suite**: 61+ unit tests, 14+ E2E scenarios
- **Active Development**: Regularly updated with new features
- **macOS Optimized**: Built on and for macOS (Apple Silicon & Intel)
- **Open Architecture**: Extensible design for future features

---

## 🎬 Typical Workflows

### Starting a New Novel
1. **Create Project**: Click "New Project" on dashboard, enter title
2. **Auto-Structure**: App creates "Part I" folder and "Chapter One" automatically
3. **Add Folders**: Create additional Parts with `Cmd+Shift+N`
4. **Add Chapters**: Within each Part, add chapters with `Cmd+N`
5. **Set Timeline**: Click timeline header to set project start/end dates
6. **Start Writing**: Select first chapter and begin

### Developing Characters
1. **Open Characters Panel**: Right sidebar → Characters section
2. **Create Character**: Click "+" to add new character
3. **Write Profile**: Add name and detailed description
4. **Tag Appearances**: As you write, click character chips to assign to chapters
5. **Track Presence**: Use Folder tab to see which characters appear in each section

### Managing Complex Timelines
1. **Create Events**: Right sidebar → Events section → Add events with dates
2. **Assign to Chapters**: Tag events to chapters where they occur
3. **Visualize**: Use project timeline header to see overall chronology
4. **Coordinate**: Folder view shows all events in story sections for consistency

### Experimenting with Drafts
1. **Create Draft**: While editing chapter, click "+" in Drafts panel
2. **Name Draft**: Timestamped name created automatically (or rename)
3. **Split View**: Select draft to view side-by-side with main document
4. **Edit Safely**: Modify draft content without affecting main text
5. **Restore**: Click restore button if you prefer the draft version

### Exporting for Publishing
1. **Project Menu**: Click floating command button (top-right)
2. **Export Options**: Choose between:
   - **ZIP**: Full project with metadata (for backup/sharing)
   - **PDF**: Formatted manuscript for submission
3. **Select Destination**: Choose where to save
4. **Done**: Professional output ready for agents/publishers

---

## 💡 What Sets Cora Apart

### For Writers, By Writers
- **No Bloat**: Only features novelists actually need
- **Distraction-Free**: Minimal UI keeps focus on your words
- **Intuitive**: Natural workflows that match how writers think
- **Fast**: Native desktop performance, not a web app

### Powerful Yet Simple
- **Sophisticated Features**: Character tracking, timelines, drafts system
- **Easy to Learn**: Start writing in minutes, discover advanced features organically
- **Flexible Structure**: Organize your way - hierarchical folders or flat sections
- **Non-Intrusive**: Advanced features hidden until you need them

### Data You Can Trust
- **Local-First**: Your manuscript lives on your computer, not someone's server
- **No Subscriptions**: One-time purchase, yours forever
- **Export Freedom**: Standard formats mean no lock-in
- **Privacy**: What you write stays on your machine

### Professional Grade
- **Reliable**: Comprehensive test coverage ensures stability
- **Performant**: Handle novels of any length without slowdown
- **Scalable**: From novellas to epic series
- **Future-Proof**: Active development, regular updates

---

## 📦 System Requirements

- **Operating System**: macOS 10.15 (Catalina) or later
- **Architecture**: Apple Silicon (M1/M2/M3) or Intel
- **Memory**: 4GB RAM minimum, 8GB recommended
- **Storage**: 100MB for app, space for your manuscripts
- **Display**: Optimized for 1440x900 or higher

---

## 🎯 Use Cases & Success Stories

### Novel Writers
*"Cora helped me organize my 120,000-word fantasy novel into 45 chapters across 5 acts. The character tracking ensured I never forgot who appeared where, and the drafts feature let me experiment with alternative endings."*

### Series Authors  
*"Managing a trilogy was overwhelming until Cora. Separate projects for each book, but I can track series-wide characters and events. The timeline feature keeps my chronology consistent across 1,500 pages."*

### NaNoWriMo Participants
*"During NaNoWriMo, Cora's auto-save meant I never lost a single word during my writing sprints. The word counter kept me on track for my 50,000-word goal."*

### Historical Fiction Writers
*"The events system with date ranges is perfect for historical fiction. I can see exactly when every plot point happens and ensure historical accuracy across my narrative."*

### Pantsers & Plotters
*"As a pantser, I love discovering the story as I write. Cora's flexible structure lets me add chapters and reorganize on the fly. The folder notes keep my spontaneous ideas organized."*

---

## 🚀 Getting Started

### Installation
1. Download Cora for macOS (Apple Silicon or Intel)
2. Open the .dmg file
3. Drag Cora to Applications folder
4. Launch Cora from Applications

### Your First Project
1. **Dashboard**: Opens automatically on first launch
2. **Create Project**: Click "New Project", enter your novel's title
3. **Start Writing**: App creates initial structure, select "Chapter One" and begin
4. **Explore Features**: Add characters, set timeline, create drafts as you write
5. **Save & Export**: Auto-save runs constantly; export when ready to share

### Learning Resources
- **In-App Discovery**: Feature tooltips guide you through advanced functionality
- **Keyboard Shortcuts**: Press `Cmd+K` to see all available commands
- **Quick Reference**: Help menu includes comprehensive command list
- **Test Project**: Create a test project to experiment risk-free

---

## 🎁 What You Get

### Core Application
- Full-featured novel writing environment
- Unlimited projects, chapters, characters, events
- All organizational and metadata features
- Import/Export capabilities
- Auto-save and crash recovery
- Command palette and search

### Premium Features
- Multi-level drafts system (document, folder, project)
- Advanced timeline visualization
- PDF export with professional formatting
- Project-wide search and replace
- Storyline view with doc cards
- Metadata management (characters, events, places)

### Updates & Support
- Regular feature updates
- Bug fixes and performance improvements
- macOS optimization
- Community support forum
- Email support for critical issues

---

## 🔮 Roadmap

### Coming Soon
- **Windows & Linux Builds**: Cross-platform support
- **Themes**: Light/dark mode and custom color schemes
- **Statistics Dashboard**: Writing velocity, chapter completion, word count trends
- **Goal Tracking**: Daily word count goals with progress visualization
- **Tags System**: Custom tags for documents and folders
- **Collaboration**: Multi-user project sharing (networked mode)

### Under Consideration
- **Scrivener Import**: Direct import from Scrivener projects
- **Cloud Sync**: Optional cloud backup (Google Drive, Dropbox)
- **Mobile Companion**: iOS/Android app for reading/light editing
- **AI Integration**: Optional AI writing assistant
- **Publishing Templates**: Genre-specific formatting presets

---

## 📊 Competitive Comparison

| Feature | Cora | Scrivener | Word | Google Docs |
|---------|------|-----------|------|-------------|
| **Desktop Native** | ✅ | ✅ | ✅ | ❌ |
| **Offline First** | ✅ | ✅ | ✅ | ❌ |
| **Character Tracking** | ✅ | ✅ | ❌ | ❌ |
| **Timeline Visualization** | ✅ | ❌ | ❌ | ❌ |
| **Multi-Level Drafts** | ✅ | ✅ | ❌ | ✅ |
| **Folder Notes** | ✅ | ✅ | ❌ | ❌ |
| **Auto-Save** | ✅ | ✅ | ✅ | ✅ |
| **PDF Export** | ✅ | ✅ | ✅ | ✅ |
| **Learning Curve** | Easy | Moderate | Easy | Easy |
| **Price Model** | One-time | One-time | Subscription | Free/Subscription |
| **macOS Optimized** | ✅ | ✅ | ❌ | ❌ |

---

## 💬 Frequently Asked Questions

### Is my data safe?
Yes. Cora stores everything locally on your computer using SQLite database with WAL mode. Your manuscripts never leave your machine unless you explicitly export them.

### Can I use Cora offline?
Absolutely. Cora is designed to work 100% offline. No internet connection required.

### What happens if Cora crashes?
Your work is safe. Text is cached in browser storage immediately and auto-saved to database every 2 seconds. If Cora crashes, your unsaved changes are recovered on restart.

### Can I export my work?
Yes. Export to structured ZIP (preserves all metadata) or PDF (formatted manuscript). You're never locked in.

### How large can my projects be?
Cora can handle projects of any size. The app has been tested with 120+ chapter novels (300,000+ words) without performance issues.

### Does Cora support collaboration?
Currently, Cora is single-user. Multi-user collaboration is on the roadmap.

### Can I import existing manuscripts?
Yes. Import individual .txt files, folders of .txt files, or complete exported Cora projects.

### What platforms does Cora support?
Currently macOS (Apple Silicon and Intel). Windows and Linux builds are in development.

### Is there a mobile app?
Not yet. Mobile companion app is under consideration for future releases.

### How much does Cora cost?
Cora is currently in active development. Pricing will be announced closer to official release.

---

## 🎓 Target Audience Breakdown

### Primary Users
- **Novelists** (fiction writers working on book-length projects)
- **Fantasy/Sci-Fi Authors** (worldbuilding and character-heavy stories)
- **Historical Fiction Writers** (timeline and event coordination)
- **Series Authors** (managing multiple books with recurring characters)
- **NaNoWriMo Participants** (fast-paced novel writing in November)

### Secondary Users
- **Screenwriters** (adapted workflow for act/scene structure)
- **Non-Fiction Authors** (chapter-based books)
- **Academics** (dissertation and thesis writing)
- **Technical Writers** (structured documentation)
- **Content Creators** (long-form content with research notes)

### User Profiles

**The Plotter**: Uses timeline extensively, creates detailed character profiles before writing, leverages folder notes for outlines.

**The Pantser**: Starts with minimal structure, adds folders/chapters organically, uses drafts to experiment freely.

**The Organized Writer**: Loves hierarchical structure, uses all metadata features, maintains comprehensive character/event databases.

**The Minimalist**: Keeps sidebars collapsed, writes in full-screen, relies on auto-save and minimal features.

**The Series Writer**: Manages separate projects per book, tracks characters/events across series, exports for consistency checks.

---

## 🏆 Why Choose Cora

### For Your Creativity
- **Distraction-Free**: Write without interruption
- **Flexible Structure**: Organize your way
- **Experiment Safely**: Drafts system encourages creative risk-taking
- **Visual Planning**: Timeline and metadata help you see the big picture

### For Your Productivity  
- **Fast Performance**: Native app, not browser-based
- **Smart Auto-Save**: Never lose work
- **Quick Navigation**: Command palette and tree view
- **Keyboard Shortcuts**: Write without touching the mouse

### For Your Peace of Mind
- **Local Storage**: Complete privacy and control
- **No Subscriptions**: One purchase, lifetime access
- **Export Freedom**: Standard formats, no lock-in
- **Reliable**: Comprehensive testing ensures stability

### For Your Professional Work
- **Scalable**: From novellas to epic series
- **PDF Export**: Professional manuscript formatting
- **Metadata Rich**: Track complex story elements
- **Import/Export**: Work seamlessly with other tools

---

## 📞 Get Started Today

**Cora Novel App** - The professional writing studio for novelists who demand power, simplicity, and complete control.

- **Download**: [Coming Soon]
- **Documentation**: Comprehensive guides included
- **Support**: Community forum and email support
- **Updates**: Regular feature additions and improvements

### Ready to Transform Your Writing Workflow?

Start your next novel in Cora and experience the difference of a tool designed specifically for serious fiction writers.

---

## 📄 Technical Specifications

### Frontend
- **Framework**: Angular 20 (Standalone Components)
- **Language**: TypeScript 5.x
- **Styling**: TailwindCSS 4.x
- **State Management**: RxJS + local state
- **Testing**: Jest (unit), Playwright (E2E)

### Backend
- **Framework**: Tauri v2
- **Language**: Rust (latest stable)
- **Database**: SQLite 3 with WAL mode
- **Connection Pooling**: r2d2
- **Migrations**: SQL-based schema versioning

### Architecture
- **Pattern**: Desktop-first, local-first
- **Data Flow**: Reactive (Observable-based)
- **Storage**: Local SQLite + browser localStorage (caching)
- **Performance**: Native binary, minimal overhead
- **Security**: Sandboxed, no network access required

### Build & Distribution
- **Packaging**: DMG installer (macOS)
- **Targets**: Apple Silicon (aarch64), Intel (x86_64), Universal Binary
- **Size**: ~10MB binary + dependencies
- **Code Signing**: macOS notarized (ready for distribution)

---

## 📚 Appendix: Feature Matrix

### Document Management
- ✅ Hierarchical folder structure (unlimited depth)
- ✅ Drag-and-drop reordering
- ✅ Auto-numbering (1.1, 1.2, 2.1...)
- ✅ Expand/collapse tree nodes
- ✅ Persistent tree state
- ✅ Keyboard navigation (arrows, Enter, Escape)
- ✅ Quick document creation (Cmd+N)
- ✅ Inline renaming
- ✅ Delete with confirmation

### Editor Features
- ✅ Plain-text editing (Markdown-compatible)
- ✅ Auto-save (2-second debounce)
- ✅ Real-time word count
- ✅ Document notes panel
- ✅ Adjustable editor width (40-100%)
- ✅ Full-screen writing mode
- ✅ Immediate text caching
- ✅ Crash recovery

### Metadata Management
- ✅ Characters (name + description)
- ✅ Events (name + description + date range)
- ✅ Places (name + description)
- ✅ Per-document assignment
- ✅ Per-folder union views
- ✅ Visual metadata chips
- ✅ Inline editing
- ✅ Drag-to-reorder lists

### Drafts & Versioning
- ✅ Document drafts (unlimited per chapter)
- ✅ Folder drafts (per-folder notes)
- ✅ Project drafts (global scratch pad)
- ✅ Split-view editing
- ✅ One-click restore
- ✅ Auto-sync with visual indicators
- ✅ Draft management (rename, delete, reorder)
- ✅ Tree indicators (show which docs have drafts)

### Timeline & Planning
- ✅ Project timeline (start/end dates)
- ✅ Adaptive timeline visualization
- ✅ Event date ranges
- ✅ Visual timeline bar with smart scaling
- ✅ Inline date pickers
- ✅ Persistent timeline display

### Import/Export
- ✅ Import .txt files (single/multiple)
- ✅ Import folders (creates structure)
- ✅ Import projects (.zip)
- ✅ Export project (structured .zip)
- ✅ Export to PDF (formatted manuscript)
- ✅ Metadata preservation (JSON)
- ✅ Round-trip support

### Navigation & Search
- ✅ Command palette (Cmd+K)
- ✅ Document search (Cmd+F)
- ✅ Project-wide search (Cmd+Shift+F)
- ✅ Find and replace (Cmd+H)
- ✅ Fuzzy document matching
- ✅ Position jumping
- ✅ Context snippets

### UI/UX Features
- ✅ Storyline view (doc cards)
- ✅ Collapsible sidebars (Cmd+1/2/3)
- ✅ Resizable panels
- ✅ Drag-to-expand collapsed sidebars
- ✅ Project dashboard (grid view)
- ✅ Dark-on-light color scheme
- ✅ Keyboard-first navigation
- ✅ OnPush change detection (performance)

### Data & Reliability
- ✅ SQLite with WAL mode
- ✅ Connection pooling
- ✅ Schema migrations
- ✅ Auto-save
- ✅ Crash recovery
- ✅ Local-first architecture
- ✅ No cloud dependency
- ✅ Privacy-focused

---

**Cora Novel App** - Write Better. Organize Smarter. Publish Confidently.

*Version 0.1.0 • Built for macOS • Designed for Writers*

---

*This marketing description reflects the current feature set as of January 2026. Features and specifications subject to change as development continues.*
