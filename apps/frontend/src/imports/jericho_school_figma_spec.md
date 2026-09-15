# Jericho School Management System
## Figma Make — UI Spec File
**Version:** 1.0 | **Date:** May 2026

---

## 1. DESIGN SYSTEM

### 1.1 Color Palette

#### Primary (School Brand)
- Maroon: #800020 — Primary actions, buttons, active states, key highlights
- Navy Blue: #001F5B — Navigation, sidebar, headers, structural elements
- White: #FFFFFF — Page backgrounds, card surfaces, text on dark

#### Supporting
- Gold: #C9A84C — Accent, badges, notifications, hover states
- Light Gray: #F4F4F6 — Page background, table stripes, inactive areas
- Mid Gray: #9A9A9A — Placeholder text, disabled states, secondary labels
- Dark Gray: #2C2C2C — Body text, table content

#### Semantic
- Success Green: #1A7F4B — Approved, paid, success states
- Warning Amber: #D97706 — Pending, expiring soon
- Danger Red: #C0392B — Rejected, expired, errors
- Info Blue: #2563EB — Informational notices

---

### 1.2 Typography

Font family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif

| Style | Weight | Size | Usage |
|---|---|---|---|
| Heading 1 | 700 | 28px | Page titles |
| Heading 2 | 600 | 22px | Section titles |
| Heading 3 | 600 | 18px | Card titles, modal headers |
| Body | 400 | 15px | General content, table rows |
| Body Strong | 600 | 15px | Labels, emphasis |
| Small | 400 | 13px | Captions, hints, timestamps |
| Tiny | 400 | 11px | Badge text, status pills |

---

### 1.3 Spacing

Base unit: 4px

- xs: 4px — Icon padding, tight gaps
- sm: 8px — Inner component padding
- md: 16px — Card padding, form fields
- lg: 24px — Section spacing
- xl: 32px — Page section gaps
- 2xl: 48px — Major layout gaps

---

### 1.4 Border Radius

- sm: 4px — Badges, pills, tags
- md: 8px — Buttons, inputs, cards
- lg: 12px — Modals, drawers, panels
- full: 9999px — Avatars, circular buttons

---

### 1.5 Component Library

#### Buttons
- Primary: Background Maroon #800020, text White — main actions (Save, Submit, Distribute)
- Secondary: Background Navy Blue #001F5B, text White — secondary actions (Cancel, Back)
- Outline: Transparent background, Maroon border and text — tertiary actions (Export, Preview)
- Ghost: Transparent, Dark Gray text — low priority (Reset, Clear)
- Danger: Background Danger Red, text White — destructive actions (Delete, Reject)
- All buttons: height 44px, border radius md, font Body Strong

#### Status Pills
- Approved / Active / Paid: Success Green background, white text
- Pending / Expiring: Warning Amber background, white text
- Rejected / Expired / Inactive: Danger Red background, white text
- Distributed: Navy Blue background, white text
- In Progress: Gold background, dark text

#### Input Fields
- Height: 44px
- Border: 1px solid Mid Gray
- Focus border: 2px solid Maroon
- Border radius: md (8px)
- Label above field, never floating
- Error state: Danger Red border + error message below field
- Placeholder color: Mid Gray

#### Tables
- Header: Navy Blue background, white text, font Body Strong
- Row height: 52px
- Alternating rows: White / Light Gray
- Hover row: #FFF5F7 (light maroon tint)
- Sticky header on scroll
- Pagination at bottom — show 20 rows default
- Action column: "..." menu on each row (rightmost column)
- Filter bar above table
- Search bar top left of table
- Summary bar below header when relevant

#### Cards
- Background: White
- Border: 1px solid Light Gray
- Border radius: lg (12px)
- Padding: md (16px)
- Shadow: 0 2px 8px rgba(0,0,0,0.06)

#### Navigation Sidebar
- Background: Navy Blue #001F5B
- Width: 240px desktop, collapses to 64px on mobile
- Active item: Left border 3px Maroon + background rgba(128,0,32,0.15)
- Active icon: Gold
- Inactive icon: Mid Gray
- Text: White, Body Strong for active, Body for inactive
- School logo at top
- User avatar and name at bottom

#### Modal
- Overlay: Navy Blue at 50% opacity
- Card: White background, border radius lg
- Header: Navy Blue background, white title, close icon top right
- Max width: 560px
- Padding: lg (24px)
- Footer: action buttons right-aligned

#### Notification Bell
- Icon: Gold
- Unread badge: Maroon background, white count, border radius full
- Dropdown: White card, low shadow, max height 400px scrollable

#### Toast Notifications
- Position: Top right
- Auto-dismiss: 4 seconds
- Success: Green left border 4px
- Warning: Amber left border 4px
- Error: Red left border 4px
- Width: 320px

#### "..." Action Menu (Row actions)
- Appears on hover or tap of "..." icon
- White card, low shadow, border radius md
- Items: Body text, hover state light maroon tint
- Danger items: Danger Red text

---

## 2. LAYOUT STRUCTURE

### Global Layout (authenticated)
- Left: Sidebar (240px) — fixed
- Top: Header bar (64px) — contains page title, notification bell, user avatar
- Main: Content area — scrollable
- Background: Light Gray #F4F4F6

### Header Bar
- Left: Page title (Heading 2, Dark Gray)
- Right: Notification bell + unread badge, user avatar + name, role pill

---

## 3. PORTALS & SCREENS

---

## PORTAL 1 — SHARED SCREENS

---

### Screen S1 — Login Screen

**Layout:** Split two columns desktop, single column mobile

**Left Panel (Navy Blue #001F5B):**
- Jericho School logo centered, top third
- School name: "Jericho School" — Heading 1, White
- Tagline: "School Management System" — Body, Gold
- Subtle geometric decoration bottom left — Maroon, low opacity

**Right Panel (White):**
- Small school crest — 48px, centered, top
- "Welcome back" — Heading 3, Dark Gray, centered
- "Sign in to your account" — Small, Mid Gray, centered
- Gap: lg

**Form:**
- Email input — label: "Email address", placeholder: "you@jericho.rw"
- Password input — label: "Password", show/hide toggle inside field
- Gap between fields: md
- Primary button: "Sign In" — full width, height 48px
- Below button: "Forgot password? Contact your administrator" — Small, Mid Gray, centered

**States:**
- Default: empty form
- Loading: button shows spinner, disabled
- Error: "Invalid email or password" — Danger Red below fields
- Locked: warning banner — "Account locked. Contact your administrator."
- Session expired: info banner — "Your session expired. Please sign in again."

**Mobile:** Left panel becomes top banner (logo + name only). Form full width below.

---

### Screen S2 — Notification Center

**Layout:** Dropdown panel from bell icon in header OR full page view

**Header:** "Notifications" — Heading 3 + "Mark all as read" — Ghost button right

**List items (each notification):**
- Left: colored dot (role-specific color)
- Main: notification message — Body
- Sub: timestamp — Small, Mid Gray
- Unread: Light Gray background
- Read: White background
- Hover: light maroon tint
- Click: marks as read + navigates to relevant screen

**Empty state:** Centered illustration + "No notifications yet" — Mid Gray

**For Accountant expiry notifications:**
- Additional "Generate Communiqué" button on each expiry item

---

### Screen S3 — Profile Settings

**Layout:** Single column, centered card max width 480px

**Sections:**
- Avatar display (initials-based, Navy Blue background)
- Name — read only
- Email — read only
- Role pill — read only
- Change password form:
  - Current password input
  - New password input
  - Confirm new password input
  - Primary button: "Update Password"

**States:**
- Success toast: "Password updated successfully"
- Error: mismatched passwords shown inline

---

### Screen S4 — 404 Not Found

**Layout:** Centered, full page

**Content:**
- Large "404" — Heading 1, Maroon
- "Page not found" — Heading 2, Dark Gray
- "The page you are looking for doesn't exist." — Body, Mid Gray
- Secondary button: "Go back to Dashboard"

---

### Screen S5 — 403 Unauthorized

**Layout:** Centered, full page

**Content:**
- Lock icon — Gold, 64px
- "Access Denied" — Heading 2, Dark Gray
- "You don't have permission to view this page." — Body, Mid Gray
- Secondary button: "Go back to Dashboard"

---

### Screen S6 — Session Timeout

**Layout:** Centered modal overlay

**Content:**
- Clock icon — Maroon, 48px
- "Session Expired" — Heading 3
- "You've been signed out due to inactivity." — Body, Mid Gray
- Primary button: "Sign In Again"

---

## PORTAL 2 — SUPER ADMIN

---

### Screen A1 — Super Admin Dashboard

**Layout:** Global layout

**Stats row (4 cards):**
- Total users
- Active users
- Current academic year
- Last backup date

**Quick actions (3 cards):**
- Manage Users — Navy Blue icon
- View Audit Log — Gold icon
- Archive Academic Year — Maroon icon

**Recent activity:** Last 5 audit log entries in a simple table — Action, User, Timestamp

---

### Screen A2 — User Management List

**Layout:** Global layout

**Above table:**
- Page title: "Users"
- Right: Primary button "Add User"
- Search bar
- Filter by role dropdown
- Filter by status dropdown

**Table columns:**
- Name
- Email
- Role (pill)
- Status (pill)
- Last Login
- Actions ("...")

**"..." menu per row:**
- Edit user
- Reset password
- Deactivate / Reactivate

**Empty state:** "No users found. Add your first user."

---

### Screen A3 — Create / Edit User

**Layout:** Modal (560px) or slide-in drawer

**Form fields:**
- Full name input
- Email input
- Role selector dropdown (Dean, Principal, Teacher, Accountant)
- Status toggle (Active / Inactive) — edit mode only
- Auto-generated password shown on create — copyable field

**Actions:**
- Primary: "Save User"
- Ghost: "Cancel"

**Validation:**
- Email must be unique — error shown inline
- All fields required

---

### Screen A4 — Audit Log

**Layout:** Global layout

**Above table:**
- Page title: "Audit Log"
- Date range filter
- Filter by user dropdown
- Filter by action type dropdown
- Export button — Outline

**Table columns:**
- Timestamp
- User (name + role pill)
- Action
- Details
- IP Address

**Read only — no actions on rows**

---

### Screen A5 — Academic Year Management

**Layout:** Global layout

**Current year card:**
- Year name — Heading 3
- Status: Active pill
- Start date
- Primary button: "Archive This Year"

**Past years list:**
- Table: Year name, Status (Archived pill), Archived date
- Read only

---

### Screen A6 — Archive Confirmation

**Layout:** Modal

**Content:**
- Warning icon — Warning Amber, 48px
- "Archive Academic Year 2024-2025?" — Heading 3
- "This will lock all current data and open a new academic cycle. This action cannot be undone." — Body, Mid Gray
- Input: Type year name to confirm — "Type 2024-2025 to confirm"
- Danger button: "Archive Year"
- Ghost button: "Cancel"

---

## PORTAL 3 — DEAN OF STUDIES

---

### Screen D1 — Dean Dashboard

**Layout:** Global layout

**Stats row (4 cards):**
- Total P-levels active
- P-levels pending approval
- P-levels distributed
- Total students this year

**P-level status overview (progress tracker):**
- Each P-level (P1–P5) shown as a row
- Status pill: In Progress / Pending Approval / Approved / Distributed
- Action button per row based on status

**Quick actions:**
- Import Excel
- View pending approvals

---

### Screen D2 — P-Level Management

**Layout:** Global layout

**Above list:**
- Page title: "P-Levels"
- Primary button: "Add P-Level"

**List (card per P-level):**
- P-level name — Heading 3
- Number of classes badge
- Number of students badge
- Status pill
- Actions: "Manage Classes" button + "..." menu (Edit, Delete)

**"..." on delete:**
- If classes exist: modal warning — "Redistribute students before deleting"
- If empty: confirmation modal

---

### Screen D3 — Class Management (per P-Level)

**Layout:** Global layout

**Page title:** "P1 — Classes"
**Breadcrumb:** P-Levels > P1

**Above list:**
- Primary button: "Add Class"
- Import Excel button — Outline

**List (card per class):**
- Class name (P1A, P1B, P1C)
- Assigned teacher name or "Unassigned" — Mid Gray italic
- Student count badge
- Status pill
- Actions: "Assign Teacher" button + "..." menu

**"..." menu:**
- View students
- Edit class
- Delete class (with redistribution warning)

---

### Screen D4 — Excel Import Screen

**Layout:** Global layout, centered card max width 600px

**Steps indicator:** 3 steps — Upload → Validate → Confirm (top of card)

**Step 1 — Upload:**
- P-level selector dropdown — "Select P-Level"
- File upload dropzone:
  - Dashed border, Light Gray background
  - Upload icon — Gold
  - "Drop your .xlsx file here or click to browse"
  - "Accepted format: .xlsx — Max size: 5MB" — Small, Mid Gray
- Primary button: "Upload & Validate"

**Step 2 — Validate:**
- Loading state: spinner + "Validating your file..."
- Success: Green checkmark + "File validated successfully"
  - Summary: P-level, sheets detected, total students per sheet
  - Primary button: "Confirm Import"
  - Ghost button: "Upload Different File"
- Error: Red icon + "Validation failed"
  - Error list: sheet name, row number, error description
  - Ghost button: "Upload Different File"

**Step 3 — Confirm:**
- Success toast: "P1 imported successfully — 95 students loaded"
- Auto-redirect to Algorithm Selection

**Duplicate detection:**
- If P-level already has data: warning modal
  - "P1 data already exists for 2024-2025. Replace or cancel?"
  - Danger button: "Replace"
  - Ghost button: "Cancel"

---

### Screen D5 — Algorithm Selection Screen

**Layout:** Global layout, centered card max width 680px

**Page title:** "Select Shuffle Algorithm — P1"
**Subtitle:** "Choose how students will be distributed into new classes"

**Algorithm cards (3 cards, stacked or grid):**

Each card contains:
- Algorithm name — Heading 3
- "(Recommended)" badge — Gold, shown on recommended algorithm
- Description — Body, Mid Gray
- Visual pattern example (simple dot/arrow illustration)
- Radio select — left side

**Card 1 — Round Robin:**
- "Students distributed in rotating order: 1→A, 2→B, 3→C, 4→A..."
- Pattern: 3 colored dots rotating

**Card 2 — Balanced Bands:**
- "Students split into Top, Middle, Bottom thirds — each class gets equal mix"
- Pattern: 3 horizontal bands each splitting into 3 columns

**Card 3 — Snake Draft:**
- "Forward then reverse: 1→A, 2→B, 3→C, then 4→C, 5→B, 6→A..."
- Pattern: Snake arrow across 3 columns

**Tie handling note (small, below cards):**
- "Tied students are distributed in their Excel sheet order"

**Actions:**
- Primary button: "Run Algorithm" — disabled until selection made
- Ghost button: "Back to Import"

---

### Screen D6 — Preview Table Screen

**Layout:** Global layout, full width

**Page title:** "Preview — P1 New Classes"
**Breadcrumb:** P-Levels > P1 > Preview

**Summary bar (above table):**
- P2A: [count] students | P2B: [count] students | P2C: [count] students
- Manual overrides badge: "[n] manual changes" — Gold, shown if any

**Above table controls:**
- Left: Search input — "Search student name..."
- Right: Filter dropdown — New Class / Former Class / Rank range / Marks % range
- Right: "Re-run Algorithm" — Ghost button
- Right: "Reset All Changes" — Ghost button (shown only if manual changes exist)

**Table columns:**
- Name
- Former Class (pill)
- Rank
- Marks %
- New Class (pill — editable via "..." menu)
- Actions ("...")

**"..." menu per row:**
- Move to P2A
- Move to P2B
- Move to P2C

**Manually changed rows:**
- Gold left border indicator
- Subtle Gold tint on row background

**Footer actions:**
- Left: "Back to Algorithm Selection" — Ghost
- Right: Primary button "Submit for Approval"

**Submit confirmation modal:**
- "Submit P1 class list for Principal approval?"
- Body: "Once submitted, you cannot make changes until the Principal reviews."
- Primary: "Submit"
- Ghost: "Cancel"

---

### Screen D7 — Distribution Screen

**Layout:** Global layout

**Page title:** "Distribute — P1 Classes"
**Status banner:** Success Green — "P1 has been approved by the Principal. Ready to distribute."

**Teacher assignment section:**
- Heading 3: "Assign Teachers Before Distributing"
- Table:

| Class | Students | Assigned Teacher | Action |
|---|---|---|---|
| P2A | 32 | [dropdown or "Unassigned"] | Assign |
| P2B | 31 | [dropdown or "Unassigned"] | Assign |
| P2C | 32 | [dropdown or "Unassigned"] | Assign |

- Teacher dropdown: searchable, shows all teacher accounts
- Warning if any class has no teacher: amber banner — "All classes must have a teacher before distributing"

**Actions:**
- Primary: "Distribute Classes" — disabled if any class unassigned
- Ghost: "Back"

**Distribution confirmation modal:**
- "Distribute P1 class list?"
- "This will send class lists to assigned teachers and the accountant. This cannot be undone."
- Primary: "Distribute"
- Ghost: "Cancel"

**Post-distribution:**
- Success toast: "P1 distributed successfully"
- P1 card on dashboard updates to Distributed status

---

### Screen D8 — Mid-Term Class Adjustment

**Layout:** Global layout

**Page title:** "Mid-Term Adjustments"

**P-level selector tabs:** P1 | P2 | P3 | P4 | P5

**Per P-level — class tabs:** P1A | P1B | P1C

**Student table per class:**
- Same columns as preview table
- "..." per row: Move to another class

**Add student button:** Primary — "Add Student to This Class"

**Add student modal:**
- Name input
- Former class input
- Rank input
- Marks % input
- Class selector
- Primary: "Add Student"

**All changes auto-saved with audit log entry**

---

## PORTAL 4 — PRINCIPAL

---

### Screen P1 — Principal Dashboard

**Layout:** Global layout

**Stats row (3 cards):**
- Pending approvals count — Warning Amber card if > 0
- Approved this year
- Rejected this year

**Pending approvals list:**
- Table: P-Level, Submitted by, Submitted at, Status, Action
- "Review" button per pending row — Maroon

---

### Screen P2 — Pending Approvals List

**Layout:** Global layout

**Page title:** "Pending Approvals"

**Filter:** All / Pending / Approved / Rejected

**Table columns:**
- P-Level
- Submitted by
- Submitted date
- Status pill
- Action: "Review" button

**Empty state:** "No pending approvals. All caught up." — with checkmark illustration

---

### Screen P3 — Shuffle Review Screen

**Layout:** Global layout, full width

**Page title:** "Review — P1 Class List"
**Breadcrumb:** Approvals > P1

**Status banner:** Warning Amber — "Pending your approval"

**Summary bar:**
- P2A: [count] | P2B: [count] | P2C: [count]
- Algorithm used badge
- Manual overrides count badge

**Table (read only — no "..." menu):**
- Name
- Former Class
- Rank
- Marks %
- New Class

**Filter and search (same as Dean preview — read only context)**

**Footer actions:**
- Left: Ghost button "Back to Approvals"
- Right: Danger button "Reject" | Primary button "Approve"

---

### Screen P4 — Approve Confirmation

**Layout:** Modal

**Content:**
- Checkmark icon — Success Green, 48px
- "Approve P1 Class List?" — Heading 3
- "The Dean will be notified and can proceed with distribution." — Body, Mid Gray
- Primary: "Approve"
- Ghost: "Cancel"

---

### Screen P5 — Reject Screen

**Layout:** Modal

**Content:**
- Warning icon — Danger Red, 48px
- "Reject P1 Class List?" — Heading 3
- Textarea: "Rejection note" — required, placeholder: "Explain what needs to be changed..."
- Danger button: "Reject & Notify Dean"
- Ghost: "Cancel"

**Validation:** Note cannot be empty

---

## PORTAL 5 — TEACHER

---

### Screen T1 — Teacher Dashboard

**Layout:** Global layout

**Welcome card:**
- "Welcome, [Teacher Name]"
- Assigned class badges: P2A, P3B (if multiple)

**Class cards (one per assigned class):**
- Class name — Heading 3
- Student count
- P-level badge
- "View Class" — Primary button

**Notification if new class distributed:**
- Info banner: "Your new class list for P2A is ready." — with "View" link

---

### Screen T2 — My Class — Student List

**Layout:** Global layout, full width

**Page title:** "P2A — Student List"
**Breadcrumb:** My Classes > P2A

**Above table:**
- Search input
- Filter by Former Class
- Filter by Rank range
- Right: Outline button "Download Excel" | Outline button "Download PDF"

**Table columns:**
- Name
- Former Class (pill)
- Rank
- Marks %
- Current Class

**Read only — no "..." menu**

---

### Screen T3 — Student Detail View

**Layout:** Modal or slide-in drawer

**Content:**
- Student name — Heading 3
- Current class badge
- Former class badge

**Details section:**
- Rank
- Marks %
- Status pill
- Academic year

**Close button top right**

---

### Screen T4 — Download Options

**Layout:** Small modal

**Content:**
- "Download P2A Class List" — Heading 3
- Two options (cards with radio):
  - Excel (.xlsx) — spreadsheet icon
  - PDF — document icon
- Primary button: "Download"
- Ghost: "Cancel"

---

## PORTAL 6 — ACCOUNTANT

---

### Screen AC1 — Accountant Dashboard

**Layout:** Global layout

**Stats row (4 cards):**
- Total students enrolled in feeding
- Total students enrolled in transport
- Expiring today (Danger Red card if > 0)
- Expiring in 3 days (Warning Amber card if > 0)

**Quick actions:**
- View Feeding Enrollments
- View Transport Enrollments
- Manage Zones
- Generate Communiqué

**Expiring today list:**
- Table: Student name, Class, Service, Expiry date, Action
- "Generate Communiqué" button per row

---

### Screen AC2 — Class Lists — P-Level Selector

**Layout:** Global layout

**Page title:** "Class Lists"

**P-level cards (P1–P5):**
- Each card: P-level name, number of classes, number of students, distribution date
- Status pill: Distributed / Pending
- "View Classes" button

---

### Screen AC3 — Student List per Class

**Layout:** Global layout, full width

**Page title:** "P2 — Class Lists"
**Breadcrumb:** Class Lists > P2

**Class tabs:** P2A | P2B | P2C

**Table columns:**
- Name
- Former Class
- Rank
- Marks %
- Current Class

**Above table:**
- Search input
- Download per class: Outline button "Download Excel" | "Download PDF"

---

### Screen AC4 — Enrollment Management — Service Selector

**Layout:** Global layout

**Page title:** "Enrollment Management"

**Two large option cards:**

**Card 1 — School Feeding:**
- Fork icon — Gold
- "School Feeding"
- "Manage breakfast and lunch subscriptions"
- "View Feeding" — Primary button

**Card 2 — Transport:**
- Bus icon — Gold
- "Transport"
- "Manage transport zone subscriptions"
- "View Transport" — Primary button

---

### Screen AC5 — Feeding Enrollment Table

**Layout:** Global layout, full width

**Page title:** "School Feeding"

**Above table:**
- P-level selector dropdown
- Class selector dropdown (based on P-level)
- Search input
- Primary button: "Add Student to Feeding"
- Outline button: "Download"

**Table columns:**
- Name
- Class
- 1st Month (B | L sub-columns)
- 2nd Month (B | L sub-columns)
- 3rd Month (B | L sub-columns)
- 4th Month (B | L sub-columns)
- Actions ("...")

**Cell behavior (B or L per month):**
- Unchecked: empty checkbox — Mid Gray
- Checked: Green checkmark — payment active
- Click checkbox: opens payment date input modal
- Hover checked cell: shows expiry countdown tooltip

**Payment date modal:**
- "Record Payment — Breakfast — 1st Month"
- Date input: "Payment date"
- Duration selector: 1 month / 2 months / custom days
- Calculated expiry shown: "Expires on: [date]"
- Primary: "Save Payment"
- Ghost: "Cancel"

**"..." menu per row:**
- Edit payments
- Waive from feeding (permanent — confirmation modal)
- View payment history

---

### Screen AC6 — Transport Enrollment Table

**Layout:** Global layout, full width

**Page title:** "Transport"

**Above table:**
- P-level selector dropdown
- Class selector dropdown
- Search input
- Primary button: "Add Student to Transport"
- Outline button: "Download"

**Table columns:**
- Name
- Class
- 1st Month
- 2nd Month
- 3rd Month
- 4th Month
- Zone (dropdown)
- Actions ("...")

**Month cell behavior:**
- Same as feeding — checkbox, payment date modal, expiry tooltip
- Zone must be set before any month can be checked — validation warning if not

**"..." menu per row:**
- Edit payments
- Change zone
- Waive from transport (permanent — confirmation modal)
- View payment history

---

### Screen AC7 — Zone Management

**Layout:** Global layout

**Page title:** "Transport Zones"

**Above table:**
- Primary button: "Add Zone"

**Table columns:**
- Zone name
- Price (formatted currency)
- Students assigned (count)
- Status pill
- Actions ("...")

**"..." menu:**
- Edit zone (name + price)
- Deactivate zone
- Delete zone (blocked if students assigned — warning shown)

**Add / Edit zone modal:**
- Zone name input
- Price input (numeric)
- Primary: "Save Zone"
- Ghost: "Cancel"

**Delete with students assigned:**
- Warning modal: "Zone 2 has 24 students assigned. Reassign them before deleting."
- No delete button until students are moved

---

### Screen AC8 — Add / Edit Enrollment Mid-Term

**Layout:** Modal (560px)

**Title:** "Add Student to [Feeding / Transport]"

**Form fields:**
- P-level selector
- Class selector (based on P-level)
- Student selector dropdown (searchable — shows students not yet enrolled)
- Service type: Feeding / Transport (pre-selected based on context)
- If Feeding: meal type selector (Breakfast / Lunch / Both)
- If Transport: zone selector dropdown
- Payment date input
- Duration selector

**Actions:**
- Primary: "Add Enrollment"
- Ghost: "Cancel"

---

### Screen AC9 — Notification Center (Accountant-specific)

**Layout:** Full page (extended from shared S2)

**Additional features beyond shared notification center:**

**Filter tabs:** All | Feeding | Transport | System

**Expiry notifications have additional actions:**
- "Generate Communiqué" button inline — Outline, small
- "Mark Renewed" button inline — Ghost, small (marks as resolved without generating communiqué)

**Batch action bar (appears when notifications selected):**
- Checkbox to select multiple
- "Generate Communiqué for Selected" — Primary button

---

### Screen AC10 — Communiqué Generator

**Layout:** Global layout

**Page title:** "Generate Communiqué"

**Step 1 — Select students:**
- Filter by: All expiring / Expiring today / Expiring in 2 days / Expiring in 3 days / Manual selection
- Student table with checkboxes:
  - Name | Class | Service | Expiry date
- "Select All" checkbox in header
- Selected count badge

**Step 2 — Preview:**
- Preview of communiqué template — one sample slip shown
- Template content:
  ```
  JERICHO SCHOOL — Payment Reminder
  Dear Parent/Guardian of [Student Name]
  Class: [Class]
  Your child's [Service] subscription expires on [Date].
  Please renew at the school's accounting office.
  ```
- Total slips count: "[n] communiqués will be generated"

**Step 3 — Generate:**
- Primary button: "Generate & Download PDF"
- Ghost: "Back"
- Success: PDF downloads automatically
- Toast: "[n] communiqués generated successfully"

---

### Screen AC11 — Download Options

**Layout:** Small modal (same as Teacher S4)

**Content:**
- "Download [P2 / P2A] Class List" — Heading 3
- Options: Excel (.xlsx) / PDF
- Scope selector (if P-level): All classes / P2A only / P2B only / P2C only
- Primary: "Download"
- Ghost: "Cancel"

---

## 4. USER FLOWS

---

### Flow 1 — End of Year Shuffle (Dean)

```
Login
→ Dashboard (sees P-levels needing shuffle)
→ P-Level Management
→ Excel Import (upload P1.xlsx)
→ Validate & Confirm Import
→ Algorithm Selection (choose Snake Draft - Recommended)
→ Preview Table (review proposed classes)
→ Manual adjustments if needed
→ Submit for Approval
→ Wait for Principal notification
→ Notification: "P1 approved"
→ Distribution Screen (assign teachers)
→ Confirm Distribution
→ Done — P1 distributed
→ Repeat for P2–P5
```

---

### Flow 2 — Principal Approval

```
Login
→ Dashboard (sees pending approvals badge)
→ Pending Approvals List
→ Review Shuffle (read-only preview table)
→ Approve OR Reject with note
→ Dean notified automatically
```

---

### Flow 3 — Teacher Receives Class

```
Login
→ Dashboard (notification banner: new class ready)
→ Notification Center
→ My Class — Student List
→ Review students
→ Download Excel or PDF
```

---

### Flow 4 — Accountant Enrollment

```
Login
→ Dashboard (sees class lists available)
→ Class Lists → select P-level
→ Enrollment Management → select Feeding
→ Feeding Table → select P-level + class
→ Tick student's breakfast checkbox
→ Payment date modal → enter date + duration
→ System calculates expiry
→ Save → checkmark shown
→ Repeat for all students
```

---

### Flow 5 — Accountant Communiqué

```
Notification Center (sees expiry alerts)
→ "Generate Communiqué" on notification
→ Communiqué Generator (students pre-selected)
→ Preview template
→ Generate & Download PDF
→ Print slips
```

---

### Flow 6 — Super Admin User Management

```
Login
→ User Management List
→ "Add User" button
→ Create User modal (name, email, role)
→ System generates password
→ Copy password → share with user
→ User appears in list
```

---

## 5. RESPONSIVE BEHAVIOR

**Desktop (1280px+):** Full sidebar, all columns visible, split layouts active
**Tablet (768px–1279px):** Sidebar collapses to icons only, table columns reduce
**Mobile (< 768px):** Sidebar becomes bottom nav or hamburger menu, tables scroll horizontally, modals full screen

---

## 6. EMPTY STATES

Every list and table has a defined empty state:
- Illustration (simple, line-based)
- Heading: what is empty
- Body: what to do next
- CTA button where applicable

Examples:
- No users: "No users yet. Add your first user."
- No students imported: "No students loaded. Import an Excel file to get started."
- No enrollments: "No students enrolled. Add students to feeding or transport."
- No notifications: "You're all caught up. No notifications."

---

## 7. LOADING STATES

- Tables: skeleton rows (3 animated placeholder rows)
- Cards: skeleton card with animated shimmer
- Buttons: spinner icon replaces label, button disabled
- Full page load: centered school logo with subtle pulse animation

---

## 8. ACCESSIBILITY NOTES

- All interactive elements keyboard navigable
- Focus states visible — Maroon outline 2px
- Color not used as sole indicator — always paired with icon or text
- Minimum contrast ratio 4.5:1 for all text
- All inputs have associated labels
- Error messages associated with input fields via aria-describedby

---

*End of Spec File — Jericho School Management System v1.0*
*Total screens: 38 | Portals: 6 | Generated: May 2026*
