---
name: INARI
description: Black, ivory and vermilion editorial finance interface
colors:
  background: "#0c0c0b"
  surface: "#161615"
  text: "#f1eee6"
  text-secondary: "#c1beb5"
  muted: "#b1aea5"
  border: "#373733"
  primary: "#ff8065"
  primary-dark: "#b8371c"
  accent: "#bd381d"
  accent-hover: "#a92c15"
  vermilion: "#ff6040"
  hero-accent: "#ff7254"
  ivory-ink: "#1c1c19"
  ivory-body: "#55554c"
  ivory-surface: "#fbfaf6"
  ivory-border: "#c9c7bc"
  success: "#50d8aa"
  warning: "#efc46a"
  error: "#ff9991"
  info: "#94bdff"
  focus: "#ff947e"
typography:
  display:
    fontFamily: 'Archivo, "Segoe UI", sans-serif'
    fontSize: "clamp(3.2rem, 7.5vw, 7rem)"
    fontWeight: 850
    lineHeight: 0.98
    letterSpacing: "-0.04em"
  headline:
    fontFamily: 'Archivo, "Segoe UI", sans-serif'
    fontSize: "clamp(2rem, 4vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  title:
    fontFamily: 'Archivo, "Segoe UI", sans-serif'
    fontSize: "1.35rem"
    fontWeight: 700
    lineHeight: 1.15
  body:
    fontFamily: 'Inter, "Segoe UI", sans-serif'
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  metric:
    fontFamily: 'Archivo, "Segoe UI", sans-serif'
    fontSize: "clamp(1.6rem, 2.3vw, 2.15rem)"
    fontWeight: 700
    letterSpacing: "-0.03em"
  label:
    fontFamily: 'Inter, "Segoe UI", sans-serif'
    fontSize: "13px"
rounded:
  card: "14px"
  form: "8px"
  action: "6px"
  inset: "10px"
spacing:
  compact: "8px"
  standard: "12px"
  comfortable: "18px"
  card: "24px"
  workspace: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary-dark}"
    textColor: "#ffffff"
    rounded: "{rounded.action}"
    padding: "10px 12px"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.action}"
    padding: "10px 12px"
  landing-action:
    backgroundColor: "{colors.vermilion}"
    textColor: "{colors.background}"
    rounded: "{rounded.action}"
    padding: "14px 22px"
    height: "52px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "clamp(18px, 2.4vw, 30px)"
  navigation-active:
    backgroundColor: "{colors.vermilion}"
    textColor: "{colors.background}"
    rounded: "{rounded.form}"
    padding: "12px"
    height: "48px"
---

# Design System: INARI

## Overview

**Creative North Star: "The Editorial Money Model"**

The approved Swathi direction becomes an editorial financial interface: near-black working surfaces, warm ivory landing sections, emphatic Archivo headings, and vermilion accents. Financial screens use compact, readable controls and restrained panel boundaries; the landing page carries the larger typographic expression.

This records the implemented system, rather than a new visual proposal. The authoritative visual source is the final editorial override in client/src/index.css, together with the layout and ledger components. Earlier teal and light theme declarations in that stylesheet are compatibility history, not the current palette. Both :root and .dark receive the editorial theme.

**Key Characteristics:**

- Black working canvas and ivory editorial sections.
- Strong headings with quiet, legible supporting text.
- Flat bordered panels and explicit financial labels.
- Restrained motion with content visible independently of animation.

## Colors

### Primary

Light vermilion is the text, icon, and data accent. Deeper vermilion is the filled-action ink beneath white labels. The brighter vermilion pairs with near-black text on landing actions and active navigation. The hero has its own lighter accent for the final headline line.

**The Action Pairing Rule.** Keep white action labels on primary-dark; keep bright vermilion action fills paired with background-colored text. Do not substitute the light text accent beneath white small text.

### Neutral

Background is the canvas; surface separates panels; text is warm ivory. Text-secondary supports descriptions and labels, while muted supports metadata. Border establishes the panel and table rhythm. On ivory sections, use ivory-ink and ivory-body; ivory-surface and ivory-border define the illustrative model panel.

Success, warning, error, and info retain distinct semantic roles. They accompany text, evidence, or labels rather than supplying meaning alone. Compatibility overrides keep legacy semantic notices readable on dark surfaces.

## Typography

Display uses Archivo, a self-hosted variable WOFF2 at client/public/fonts/archivo-latin.woff2, with its OFL license alongside. Body uses Inter when installed, then Segoe UI and sans-serif. There are no external font calls and Inter is not guaranteed to be installed.

The frontmatter captures the desktop hero, shared page title, panel title, body, ledger metric, and label roles. Landing secondary headings use a separate fluid range (clamp(2.2rem, 4.5vw, 4rem)), weight 750 and line height 1.06. Dashboard greeting and section roles are also fluid CSS tokens. Headings balance wrapping; paragraphs use pretty wrapping. Financial tables and ledger metrics use tabular numbers.

At 1100px and below the hero uses clamp(3rem, 8vw, 6rem); at 767px and below it uses clamp(2.75rem, 9.8vw, 4rem) with line height 1.05. Mobile ledger metrics use clamp(1.25rem, 5vw, 1.8rem). Metadata remains smaller than body; do not use it for essential explanations.

## Layout

The desktop application sidebar starts at 1280px, is fixed at 224px wide, and reserves an equal body inset. Its contents scroll independently when necessary. Workspace main content uses 32px padding and a maximum width of 1440px at that breakpoint. Below 1280px, navigation becomes a wrapping top bar with an explicit menu toggle, current-page label, and two-column mobile links; it does not squeeze a desktop link row onto tablets.

The landing hero caps at 1600px; public navigation caps at 1440px. Landing inline padding is fluid, beginning at 24px. Model and advisor sections use two columns until 767px; below that they stack. Hero actions, section introductions, and the closing section also stack. The decorative thread is removed on mobile. At 1100px, capability links move beneath their descriptions and the profile overview becomes one column.

LedgerPulse uses four columns, becoming two at 1100px and below. It retains two columns on mobile with reduced inset spacing. Category rows align label and formatted INR amount above a narrow bar. Charts retain labels and units; mobile trend amounts move beneath the corresponding bar. Data tables keep a 640px minimum within their overflow wrapper so the page itself can remain narrow. Wrapping section anchors provide local navigation on feature-rich pages.

## Elevation & Depth

The shared low and card shadows are explicitly none. Use tonal surfaces, borders, and interior spacing to establish hierarchy. Some retained generic UI primitives have their original small focus or shadow treatments; do not turn those into floating dashboard cards.

## Shapes

Panels and the ledger overview share the card radius. Form controls and navigation links use the form radius; primary actions and local section links use the action radius. Goal, simulation, and EMI result insets use the inset radius. Borders are thin and structural. Data bars are low horizontal tracks, not decorative illustrations.

## Components

### Buttons

Shared ledger actions use primary-dark with white text, medium-small labels, and the action radius. The final compatibility selector deliberately overrides the older bg-wv-primary/text-white pairing. Ghost actions use surface, text, and a border. Pending or unavailable actions retain disabled states and reduced opacity. Shared slotted buttons and panel buttons have a 44px minimum height, and labels can wrap. Landing actions are taller with a rightward arrow and a lighter hover fill. Preserve button versus link semantics.

### Inputs / Fields

Native fields use surface, text, a border, and compact padding; the shared form token coexists with legacy rounded-md primitives. Text inputs and selects have a 44px minimum height. Checkboxes and radios remain 18px. File input is a full-width dashed-border field. Keep visible labels, keyboard input, composition handling, and dictation-compatible text entry. Invalid and disabled states remain supported by the underlying controls.

Global focus-visible uses a two-pixel focus outline with four-pixel offset. Shared Radix-style controls also retain their ring and invalid-border states. Placeholders are supporting hints, not substitutes for labels.

### Navigation

Active application links use bright vermilion with dark text, stronger weight, and a small trailing dot; aria-current identifies the page. Hover adds a quieter dark surface. The mobile toggle declares aria-expanded and aria-controls. Preserve named navigation landmarks, profile selection, persona switching, ending a demo session, and the workspace skip link. Page-section links target real section IDs and wrap.

### Cards / Containers

Shared panels are section elements with a heading, optional description, optional action, and content. Use fluid panel padding, a flat surface, and the card border/radius. Mode and demo notices distinguish imported data from fictional personas and explain temporary storage; their semantic roles and copy are part of the product behavior.

### Ledger overview and charts

LedgerPulse renders backend-supplied income, expenses, surplus, and savings rate. Missing amounts read “Not provided”. Surplus receives success color without losing its label. Categories use the backend breakdown, readable INR amounts, labeled image roles, and alternating warm bars. Ratios scale drawn bars only. Category loading, errors with role=alert, and no-data instructions are explicit. Never turn illustrative landing model graphics into live financial claims.

### Motion and states

Navigation color changes last 160ms; landing action hover lasts 180ms. The decorative thread draws over one second with cubic-bezier(0.16, 1, 0.3, 1). Legacy fade and slide utilities remain available, but critical content must be readable without a completed animation. Reduced-motion preference switches smooth scrolling off and reduces animation and transition durations to 0.01ms with one animation iteration. Preserve existing loading, error, empty, preview, confirm, duplicate-review, and undo states during future visual work.

## Do's and Don'ts

### Do:

- **Do** use the existing wv token contract for every financial feature.
- **Do** pair filled-action colors with their documented text colors.
- **Do** keep financial evidence, units, unknown values, and data-source notices visible.
- **Do** preserve native controls, named landmarks, focus visibility, and reduced-motion behavior.

### Don't:

- **Don't** reproduce financial calculations or replace backend amounts with display fixtures.
- **Don't** restore the historical teal palette by copying an earlier declaration block.
- **Don't** hide essential content behind decorative animation.
- **Don't** introduce portfolio branding, property-management imagery, or external font requests.
