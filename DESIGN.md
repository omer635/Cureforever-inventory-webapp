# Token-Driven UI Design Guidance: Untitled Page (Vendor Partner Dashboard)

## Context and Goals

### Design Intent
Provide an implementation-ready, token-driven UI design system and operational guidance for the Untitled page dashboard web app, optimizing for consistency, WCAG 2.2 AA accessibility, and fast delivery across high-density operational surfaces.

### Brand Context
- **Product / Brand**: Untitled page (WTF Everyday Vendor Partner Dashboard)
- **URL**: `https://partners.wtfevryday.com/vendor`
- **Audience**: Authenticated users, vendor managers, and system operators
- **Product Surface**: Web application dashboard (responsive desktop and tablet focus)
- **Known Surface Component Density**:
  - **Cards**: 35 instances (KPI summaries, batch monitors, inventory cards, audit cards)
  - **Buttons**: 7 instances (Primary CTA, Secondary filter, Accent action, Destructive, Ghost, Icon trigger, Loading state trigger)
  - **Inputs**: 1 primary multi-state search/filter field instance
  - **Navigation**: 1 persistent header/sidebar navigation system instance

---

## Design Tokens and Foundations

### 1. Typography Tokens

All typography must be defined via semantic variables derived from the primary font stack (`Inter`).

| Token Name | Value | Usage Context |
| :--- | :--- | :--- |
| `font.family.primary` | `Inter` | Core UI font family |
| `font.family.stack` | `Inter, -apple-system, sans-serif` | Fallback browser stack |
| `font.size.xs` | `12px` | Badges, micro-labels, table timestamps |
| `font.size.sm` | `13px` | Form labels, table cell content, sub-navigation |
| `font.size.md` | `13.33px` | Standard body text, card text, button labels |
| `font.size.lg` | `16px` | Section headers, modal titles, primary inputs |
| `font.size.xl` | `22px` | Dashboard page titles, key KPI numbers |
| `font.weight.base` | `400` | Standard body content |
| `font.weight.medium` | `500` | Interactive labels, active tab items |
| `font.weight.bold` | `700` | KPI metrics, brand headers, high-priority status |
| `font.lineHeight.base`| `normal` (`1.4` - `1.5`) | Standard line height ratio |

### 2. Color Palette Tokens

Semantic tokens must be referenced across all component specifications instead of raw hexadecimal values.

| Token Name | Hex / Value | Semantic Role |
| :--- | :--- | :--- |
| `color.text.primary` | `#1a1a2e` | Primary high-contrast text and main body copy |
| `color.surface.base` | `#ffffff` | Primary background canvas |
| `color.text.tertiary` | `#888888` | Secondary labels, disabled icons, quiet metadata |
| `color.text.inverse` | `#c9a96e` | Rich gold accent text, inverse highlights, active badges |
| `color.surface.muted` | `#000000` | Deep contrast overlays, dark modal backdrops |
| `color.surface.raised` | `#f5f6f8` | Elevated card backgrounds, zebra table striping |
| `color.surface.strong` | `#0f0f14` | Primary dark header background, side navigation background |
| `color.border.default` | `#ebedf0` | Standard component borders, card dividers |

### 3. Spacing Scale Tokens

Zero arbitrary pixel values are allowed in component layout specifications.

| Token Name | Pixel Value | Application |
| :--- | :--- | :--- |
| `space.1` | `1px` | Hairline borders, subtle focus offsets |
| `space.2` | `4px` | Micro-gaps between badge icon and text |
| `space.3` | `6px` | Compact button vertical padding |
| `space.4` | `7px` | Dense input vertical padding |
| `space.5` | `8px` | Standard element gap, compact card padding |
| `space.6` | `9px` | Medium field padding |
| `space.7` | `10px` | Standard button horizontal padding |
| `space.8` | `12px` | Card content padding, section spacing |

### 4. Shape, Elevation, & Motion Tokens

| Category | Token Name | Value | Purpose |
| :--- | :--- | :--- | :--- |
| **Radius** | `radius.xs` | `8px` | Compact tags, input fields, badge pills |
| **Radius** | `radius.sm` | `10px` | Standard action buttons, alert banners |
| **Radius** | `radius.md` | `14px` | Operational cards, metric panels, modals |
| **Shadow** | `shadow.1` | `rgba(201, 169, 110, 0) 0px 0px 0px 0px` | Baseline flat state; transitions to active outline on hover/focus |
| **Shadow** | `shadow.focus` | `0 0 0 2px #0f0f14, 0 0 0 4px #c9a96e` | WCAG-compliant dual-ring focus indicator |
| **Motion** | `motion.duration.instant` | `150ms` | Micro-interactions (hover fill, border tint) |
| **Motion** | `motion.duration.fast` | `200ms` | Card expansion, modal host transitions |

---

## Component-Level Rules

### 1. Cards (Component Density: 35 Instances)

#### Anatomy
Cards contain a header container (title + badge action), body section (data list or metric), and optional footer controls.

#### Variants
- **Metric KPI Card**: Elevated surface (`color.surface.raised`), displaying `font.size.xl` figures and `color.text.tertiary` subtext.
- **Inventory Item Card**: Bordered container (`color.border.default`) with status badge and detail rows.
- **Interactive Action Card**: Clickable card with hover state elevation and `color.text.inverse` border highlight.

#### Complete 7-State Specification
1. **Default State**: Background `color.surface.raised` (`#f5f6f8`), border `color.border.default` (`#ebedf0`), radius `radius.md` (`14px`), padding `space.8` (`12px`).
2. **Hover State**: Border shifts to `color.text.inverse` (`#c9a96e`), cursor `pointer`, transition `motion.duration.instant` (`150ms`).
3. **Focus-Visible State**: Dual-ring focus outline: 2px solid `color.surface.strong` (`#0f0f14`) with 2px offset in `color.text.inverse` (`#c9a96e`). Keyboard users must be able to focus via `Tab`.
4. **Active State**: Background shifts to `color.surface.base` (`#ffffff`), slight scale inset (`0.995`).
5. **Disabled State**: Opacity `0.5`, background `color.surface.raised`, cursor `not-allowed`, zero pointer events.
6. **Loading State**: Content replaced by skeleton loader pulses using `color.surface.raised` and shimmer background.
7. **Error State**: Border shifts to high-contrast warning indicator, error inline banner inside body with standard error icon.

#### Interactions & Edge Cases
- **Pointer/Touch**: Minimum tap target area of 44x44px. Double-tap prevented.
- **Keyboard Navigation**: `Enter` or `Space` activates interactive card link.
- **Long-Content & Overflow**: Text must truncate with ellipsis (`text-overflow: ellipsis`) when title exceeds container width. Card content container must maintain fixed internal padding `space.8`.
- **Empty State**: Displays centered tertiary icon, `font.size.sm` message ("No items found"), and single action button.

---

### 2. Buttons (Component Density: 7 Instances)

#### Anatomy
Button components consist of an icon slot (left/right), a text label (`font.size.md`, `font.weight.medium`), and a container fill.

#### 7 Variants
1. **Primary Action**: Solid `color.surface.strong` (`#0f0f14`) fill, `color.text.inverse` (`#c9a96e`) text, `radius.sm` (`10px`).
2. **Secondary Filter**: Background `color.surface.raised` (`#f5f6f8`), border `color.border.default`, `color.text.primary` text.
3. **Accent Action**: Background `color.text.inverse` (`#c9a96e`), `color.surface.strong` text.
4. **Destructive Action**: Crimson border/fill alert state with explicit contrast label.
5. **Ghost Action**: Transparent background, `color.text.primary` text, hover fill `color.surface.raised`.
6. **Icon Trigger**: Square 36x36px container, centered SVG icon, `color.text.tertiary` defaulting to `color.text.primary` on hover.
7. **Loading Action**: Spinner icon replaces left icon, text label changes to active action ("Saving..."), pointer events disabled.

#### Complete 7-State Specification
1. **Default State**: Height 36px, vertical padding `space.3` (`6px`), horizontal padding `space.7` (`10px`), font `font.size.sm`, radius `radius.sm`.
2. **Hover State**: Background contrast adjusts by 10%, transition `motion.duration.instant` (`150ms`).
3. **Focus-Visible State**: Must show 2px solid ring (`color.text.inverse` `#c9a96e`) with 2px offset. `outline: 2px solid #c9a96e; outline-offset: 2px;`.
4. **Active State**: Inset box-shadow, transform `translateY(1px)`.
5. **Disabled State**: Background `color.surface.raised`, text `color.text.tertiary` (`#888888`), opacity `0.6`, cursor `not-allowed`.
6. **Loading State**: Displays loading indicator, label opacity `0.7`, `aria-busy="true"`.
7. **Error State**: Shakes 3px horizontally for `motion.duration.fast`, outline turns red alert token.

#### Interactions & Edge Cases
- **Keyboard**: Triggerable via `Space` and `Enter`. Focus ring must never be suppressed on keyboard nav.
- **Long-Content**: Text labels must stay on a single line (`white-space: nowrap`). Container width adapts with padding `space.7`.

---

### 3. Inputs (Component Density: 1 Primary Search/Filter Field)

#### Anatomy
Input component features an outer field wrapper, leading search icon, text input control (`font.size.md`), trailing clear/filter action button, and supporting helper text.

#### Complete 7-State Specification
1. **Default State**: Background `color.surface.base` (`#ffffff`), border 1px solid `color.border.default` (`#ebedf0`), radius `radius.xs` (`8px`), vertical padding `space.4` (`7px`), horizontal padding `space.7` (`10px`), placeholder color `color.text.tertiary` (`#888888`).
2. **Hover State**: Border shifts to `color.text.primary` (`#1a1a2e`).
3. **Focus-Visible State**: Border shifts to `color.surface.strong` (`#0f0f14`), box-shadow `0 0 0 3px rgba(201, 169, 110, 0.35)`, outline `none`.
4. **Active State**: Same as focus-visible.
5. **Disabled State**: Background `color.surface.raised` (`#f5f6f8`), border `color.border.default`, text `color.text.tertiary`, cursor `not-allowed`.
6. **Loading State**: Trailing icon replaced with subtle spinning indicator.
7. **Error State**: Border shifts to 1.5px crimson, helper message rendered below in `font.size.xs` red text (`aria-invalid="true"`).

#### Interactions & Edge Cases
- **Keyboard**: Focus via `Tab`. `Escape` clears input value.
- **Overflow**: Long search query text scrolls horizontally without breaking field bounds.
- **Empty State**: Clear icon hidden when field value is empty.

---

### 4. Navigation (Component Density: 1 Navigation System Instance)

#### Anatomy
Navigation comprises a dark persistent header bar (`color.surface.strong` `#0f0f14`) with gold logo accent (`color.text.inverse` `#c9a96e`), role switcher, search/notification quick triggers, and tab bar links (`font.size.sm`).

#### Complete 7-State Specification (Navigation Items)
1. **Default State**: Text color `#a0a0b0`, background transparent, font `font.size.sm`, padding `space.3 space.7`.
2. **Hover State**: Background `rgba(255, 255, 255, 0.06)`, text `color.surface.base` (`#ffffff`).
3. **Focus-Visible State**: Outline 2px solid `color.text.inverse` (`#c9a96e`) with 1px inset.
4. **Active / Selected State**: Text color `color.text.inverse` (`#c9a96e`), font weight `font.weight.medium`, bottom indicator border 2px solid `color.text.inverse`.
5. **Disabled State**: Text color `rgba(255, 255, 255, 0.25)`, pointer events none.
6. **Loading State**: Tab label replaced by skeleton line.
7. **Error State**: Red dot badge rendered adjacent to tab label for tabs with system errors.

#### Interactions & Edge Cases
- **Keyboard**: Left/Right Arrow keys navigate tab list when focused (`role="tablist"`). `Home` / `End` move to first/last tab.
- **Responsive**: Converts to collapsible mobile drawer menu below `768px` viewport width.

---

## Accessibility Requirements & Testable Acceptance Criteria

Target Compliance: **WCAG 2.2 AA**

### Testable Acceptance Criteria

1. **Color Contrast (Pass/Fail)**
   - *Pass*: Primary text (`#1a1a2e`) on base surface (`#ffffff`) must achieve contrast ratio $\ge 4.5:1$ (Actual: ~15.2:1).
   - *Pass*: Inverse text (`#c9a96e`) on dark surface (`#0f0f14`) must achieve contrast ratio $\ge 4.5:1$ (Actual: ~8.2:1).
   - *Fail*: Text contrast ratio $< 4.5:1$ for standard body text or $< 3:1$ for large text headers.

2. **Keyboard Navigation & Focus Visible (Pass/Fail)**
   - *Pass*: Pressing `Tab` cycles through every interactive button, input, card, and tab in logical DOM order.
   - *Pass*: Focus indicator is always visible (`outline` width $\ge 2\text{px}$, color `#c9a96e` or `#0f0f14`).
   - *Fail*: Utilizing `outline: none` or `outline: 0` without providing a custom focus indicator token.

3. **Touch Targets (Pass/Fail)**
   - *Pass*: All mobile touch target dimensions must be at least $44 \times 44\text{px}$ or provide equivalent touch spacing.
   - *Fail*: Clickable button dimensions $< 36 \times 36\text{px}$ on touch viewports.

4. **Screen Reader Semantics (Pass/Fail)**
   - *Pass*: Navigation tabs use `role="tablist"`, `role="tab"`, `aria-selected="true/false"`.
   - *Pass*: Inputs link to labels via `htmlFor` and `id`, with errors announced via `aria-live="polite"` and `aria-invalid="true"`.
   - *Fail*: Clickable `div` or `span` elements without `role="button"`, `tabIndex={0}`, and keypress handlers.

---

## Content and Tone Standards

- **Tone**: Concise, confident, implementation-focused, and operational.
- **Button Labels**: Verbs first. Use descriptive actions (e.g., "Add Batch", "Export CSV", "Filter Stock") instead of vague labels like "OK" or "Go".
- **Error Messages**: State what happened and how to fix it immediately (e.g., "Batch ID must be 6 digits" instead of "Invalid input").
- **Empty States**: Explain what is missing and offer a direct creation CTA.

---

## Anti-Patterns and Prohibited Implementations

- **No Raw Hex Values**: Hardcoding `#1a1a2e` directly in inline component styles is strictly prohibited. Developers must reference CSS variables (`var(--color-text-primary)`).
- **No Hidden Focus Indicators**: `outline: none` without replacement violates WCAG rules and quality gates.
- **No Non-Standard Spacing**: Using `padding: 13px` or `margin: 19px` outside the `space.1` to `space.8` scale is prohibited.
- **No Missing States**: Shipping a button or interactive card without explicit hover, active, focus-visible, and disabled states is prohibited.

---

## QA Checklist

- [ ] All 8 design system colors verified against CSS token definitions.
- [ ] Typography scale implemented using `Inter` font stack.
- [ ] Spacing scale enforced without raw pixel overrides.
- [ ] 35 Card component instances verified for hover, focus, and overflow handling.
- [ ] 7 Button variants verified across all 7 state specifications.
- [ ] 1 Input field verified with clear button, search icon, and focus ring.
- [ ] 1 Navigation bar verified with keyboard arrow navigation and dark header theme.
- [ ] WCAG 2.2 AA contrast ratios validated for light and dark surfaces.
- [ ] Keyboard navigation test completed (`Tab`, `Enter`, `Space`, `Escape`).
- [ ] Responsive viewports verified ($320\text{px}$, $768\text{px}$, $1024\text{px}$, $1440\text{px}$).
