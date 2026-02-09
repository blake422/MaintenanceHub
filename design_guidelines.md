# MaintenanceHub Design Guidelines

## Design Approach

**Selected System:** Material Design 3 with industrial application adaptations  
**Rationale:** Data-intensive enterprise application requiring robust component patterns, strong information hierarchy, excellent mobile support, and proven usability for complex workflows. Material Design's comprehensive system provides the foundation needed for multi-role interfaces while maintaining consistency across desktop and mobile experiences.

**Key Design Principles:**
1. **Efficiency First:** Minimize clicks to complete common actions
2. **Mobile-Optimized:** Touch-friendly targets, thumb-zone considerations for tech interface
3. **Clarity & Scannability:** Dense information presented with clear hierarchy
4. **Status Transparency:** Always visible system state and work progress
5. **Progressive Disclosure:** Show essential info first, details on demand

---

## Typography System

**Font Family:** 
- Primary: Inter (via Google Fonts CDN) - exceptional readability for data-dense interfaces
- Monospace: JetBrains Mono - for technical identifiers, part numbers, codes

**Type Scale:**
- **Display (Dashboard Headers):** text-4xl font-bold (36px)
- **H1 (Page Titles):** text-3xl font-semibold (30px)
- **H2 (Section Headers):** text-2xl font-semibold (24px)
- **H3 (Card Titles):** text-xl font-semibold (20px)
- **H4 (Component Labels):** text-lg font-medium (18px)
- **Body Large (Primary Content):** text-base font-normal (16px)
- **Body (Standard):** text-sm font-normal (14px)
- **Caption (Metadata):** text-xs font-normal (12px)
- **Technical Data:** text-sm font-mono (14px monospace)

**Hierarchy Guidelines:**
- Use font-semibold for all headers and key information
- Body text always font-normal
- Metadata and secondary info in text-xs with reduced opacity
- Part numbers, equipment IDs, timestamps in monospace
- Interactive elements (buttons, links) font-medium

---

## Layout System

**Spacing Primitives (Tailwind Units):**
- **Core Set:** 2, 3, 4, 6, 8, 12, 16
- **Component Padding:** p-4 (cards), p-6 (sections), p-8 (page containers)
- **Element Spacing:** space-y-4 (form fields), gap-4 (grids), space-y-6 (sections)
- **Margins:** mb-2 (tight spacing), mb-4 (standard), mb-6 (section breaks), mb-8 (major sections)

**Container Strategy:**
- **Desktop Dashboard:** max-w-7xl mx-auto px-6
- **Mobile Tech View:** Full-width with px-4 edge padding
- **Forms/Content:** max-w-4xl mx-auto
- **Modals/Dialogs:** max-w-2xl

**Grid Patterns:**
- **Dashboard Stats:** grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4
- **Equipment Cards:** grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6
- **Work Order List:** Single column stack with dividers
- **Reports/Analytics:** grid grid-cols-1 lg:grid-cols-2 gap-6

---

## Component Library

### Navigation

**Primary Navigation (Desktop):**
- Persistent left sidebar: w-64, compact icons + labels
- Collapsible to icon-only mode (w-20) for more workspace
- Active state with indicator bar (border-l-4)
- Role-based menu items with clear visual grouping

**Mobile Navigation:**
- Bottom tab bar with 5 key functions for techs
- Hamburger menu for secondary features
- Floating Action Button (FAB) for primary action (Start Work)

**Top Bar:**
- Company/project selector (multi-tenant)
- Global search
- Notifications bell with badge counter
- User profile dropdown

### Core UI Elements

**Cards:**
- Standard elevation with rounded-lg, shadow-md
- Header section with title + action menu (3-dot)
- Body content with p-6 padding
- Footer for metadata/actions with border-t

**Work Order Cards (Tech View):**
- Large touch targets (min-h-24)
- Priority indicator (vertical colored accent bar border-l-4)
- Equipment name + WO number prominent
- Status badge top-right
- Timer display if active
- Quick action buttons bottom-aligned

**Buttons:**
- **Primary CTA:** px-6 py-3 rounded-lg font-medium (Start Work, Complete)
- **Secondary:** px-4 py-2 rounded-md with border
- **Icon Buttons:** p-2 rounded-full for actions
- **FAB (Mobile):** Circular, bottom-right fixed position

**Status Badges:**
- Pill shape: px-3 py-1 rounded-full text-xs font-medium
- Distinct visual treatment per status
- Icons optional for mobile space savings

**Forms:**
- Label above input: text-sm font-medium mb-2
- Input fields: px-4 py-3 rounded-lg border-2 
- Touch targets minimum 44x44px on mobile
- Helper text: text-xs mt-1
- Error states with border change + message

### Data Display

**Tables (Desktop):**
- Striped rows for scannability
- Sticky header on scroll
- Row actions appear on hover (desktop) or always visible (mobile)
- Sortable columns with icon indicators

**Lists (Mobile-First):**
- Card-based list items with dividers
- Swipe actions for delete/complete
- Pull-to-refresh pattern

**Stats/Metrics:**
- Large number display: text-3xl font-bold
- Label below: text-sm 
- Icon or trend indicator
- Background card with p-6

**Charts (Reports):**
- Clean bar/line charts using Chart.js
- Minimal grid lines
- Clear axis labels
- Legend below chart
- Responsive to container width

### Overlays & Modals

**Dialogs:**
- Centered with backdrop blur
- max-w-2xl with p-6
- Header with title + close button
- Footer with action buttons (Cancel left, Primary right)

**Slide-Outs (Equipment Manual Viewer):**
- Right-side panel, full height
- Smooth slide transition
- Close button top-right
- Scrollable content area

**Toast Notifications:**
- Bottom-center on mobile, top-right on desktop
- Auto-dismiss in 5 seconds
- Action button optional (Undo, View)

---

## Page-Specific Patterns

### Dashboard
- 4-column stat cards at top (grid-cols-4)
- Compliance metrics section (circular progress indicators)
- Activity feed (timeline pattern) left, chart widgets right (grid-cols-3 split)
- Top downtimes table full-width below

### Tech Work View (Mobile-Optimized)
- Sticky header with timer display if work in progress
- List of assigned work orders (cards)
- Each card: Equipment image thumbnail, WO details, status, quick actions
- Bottom navigation: My Work, Scan QR, Camera, Training, Profile
- Large "Start Work" FAB when WO selected

### Equipment Asset Page
- Hero image of equipment (if available) or placeholder
- Hierarchy breadcrumb navigation
- Tabbed interface: Details | Manuals | Photos | Work History | Parts
- QR code display with download button
- Quick action buttons: Create WO, View Manual, Add Photo

### Work Order Form
- Stepped progress indicator if multi-step
- Single column form layout (max-w-2xl)
- Equipment selector with search/autocomplete
- Priority and type selectors (segmented control or radio group)
- Rich text area for description
- Parts selector (multi-select dropdown)
- Image upload zone (drag-drop or camera)
- Sticky footer with Save/Cancel actions

### Training Platform
- Card grid of training modules (grid-cols-3)
- Progress ring on each card
- Badges displayed in sidebar
- Leaderboard table with ranks and points
- Quiz interface: Question card, option buttons, next/submit below

### Reports Page
- Filter panel (collapsible sidebar)
- Date range picker prominent
- Chart grid (grid-cols-2)
- Export button top-right
- Print-friendly layout consideration

---

## Responsive Breakpoints

- **Mobile:** < 768px (base Tailwind)
- **Tablet:** md: 768px - 1024px
- **Desktop:** lg: 1024px+

**Mobile-First Adjustments:**
- Stack all multi-column layouts to single column
- Expand collapsed navigation to full drawer
- Increase touch target sizes (py-3 instead of py-2)
- Reduce padding on containers (px-4 instead of px-6)
- Hide secondary information, show on demand

---

## Animations

**Minimal, Purposeful Only:**
- Page transitions: Fade in (150ms)
- Modal open/close: Scale + fade (200ms)
- Dropdown menus: Slide down (150ms)
- Loading states: Subtle spinner, skeleton screens for data
- No scroll-triggered animations
- No hover animations except button states

---

## Icons

**Library:** Heroicons (via CDN) - outline for navigation, solid for actions  
**Sizing:** w-5 h-5 (standard), w-6 h-6 (prominent actions), w-4 h-4 (inline with text)  
**Usage:** Equipment types, work order priorities, status indicators, navigation, actions

---

## Images

**Equipment Photos:**
- Aspect ratio 4:3 for thumbnails, full resolution in modal
- Placeholder for missing images (icon + equipment type)
- Lazy loading for galleries

**Training Module Covers:**
- 16:9 aspect ratio
- Thumbnail size: w-full h-48 object-cover

**No large hero images** - this is a utilitarian application focused on data and workflows, not marketing.