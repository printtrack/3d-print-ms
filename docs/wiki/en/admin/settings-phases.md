---
title: "Settings → Phases"
description: "Create, edit and sort order phases, part phases and project phases"
route: "/admin/settings?tab=phasen"
icon: "Layers"
group: "Knowledge & Admin"
order: 9.2
---

# Managing phases

![Settings Phases](/wiki-screenshots/settings-phases.png)

Phases control which stages an order, an individual part, or a project passes through. The configuration is divided into three areas: **Order phases**, **Part phases**, and **Project phases**.

## Order phases (Tab: Phases)

Order phases form the columns of the [[Dashboard]] and define the workflow for each customer order.

### Adding a phase

1. Scroll to the end of the phase list and click **+ Add phase**.
2. Fill in name (DE and EN), color, and optional flags.
3. Click **Save**.

### Phase fields

| Field | Description |
|-------|-------------|
| **Name (DE)** | German phase name (e.g. "In Bearbeitung") |
| **Name (EN)** | English phase name (e.g. "In Progress") |
| **Color** | Hex color code or color picker — shown as column color on the Dashboard |
| **Default** | This phase is automatically assigned to new orders |
| **Survey phase** | Customers receive the satisfaction survey after reaching this phase |
| **Prototype phase** | Marks prototype orders (optional flag) |
| **Archive phase** | Orders are auto-archived on entry (`archivedAt` is set). Moving an order back out reactivates it. Pairs nicely with auto-advance conditions like `Survey submitted`. |

### Changing the order

Drag a phase to the desired position using **drag & drop**. The new order is saved immediately and reflected on the [[Dashboard]].

### Editing a phase

Click the **pencil icon** next to a phase, edit the fields, and click **Save**.

### Deleting a phase

Click the **trash icon** next to the phase. A phase can only be deleted if **no orders** are assigned to it. Move the orders to another phase first.

> The default phase (where new orders land) cannot be deleted while marked as default. Set another phase as default first.

### Phase flow diagram

Above the phase list, a horizontal **flow diagram** shows all phases in configured order with arrows between them. It visualises at a glance which phases have an enter-gate (🔒 lock icon) and which auto-advance to the next phase when their conditions are met (animated arrow + `Auto` badge). Click a phase in the diagram to open its editor.

### Gate (entry condition)

In the phase editor's **Gate** tab you can define conditions that must be satisfied for an order to enter this phase. If an admin tries to drag an order into a gated phase whose conditions are not met, an **override dialog** appears showing the unmet conditions and a mandatory reason input. The override is captured in the audit log as `GATE_OVERRIDDEN`.

**Available conditions** (AND logic — every selected condition must be met):

| Condition | Met when… |
|-----------|-----------|
| All parts are print-ready | Every part of the order is in a part phase with the `Print ready` flag |
| All parts are printed | Every part is in a part phase with the `Printed` flag |
| All parts are marked as misprint | Every part is in a part phase with the `Failed print` flag |
| All print jobs done | All print jobs linked to the order have status `DONE` or `CANCELLED` |
| Quote approved | No quote exists at all (condition does not apply), OR the latest quote has status `APPROVED`. Orders without a quote workflow are not blocked. |
| Invoice paid | An `Invoice` with status `PAID` exists |
| All verifications resolved | No pending `VerificationRequest` left |
| Survey submitted | The `SurveyResponse` has a `submittedAt` timestamp |
| At least X days in this phase | The latest `PHASE_CHANGED` audit log is at least X days in the past |

### Auto-advance

In the **Auto-advance** tab you define conditions that, when all met, move the order forward to the next phase automatically. The trigger is **event-based** — auto-advance runs the moment a relevant signal arrives (job completed, payment recorded, quote approved, verification resolved, survey submitted, …). Time-based conditions (`At least X days in this phase`) also fire from a fallback sweep on every order-detail page load.

Auto-advance always respects the **target phase's** gate: if a condition there is unmet, the automatic hop is skipped — gates can never be bypassed by auto-advance.

A Kanban order card shows:
- **🔒 lock badge** when the gate to the next phase is currently blocking
- **→ pulsing arrow** when its auto-advance would fire right now

---

## Part phases (Tab: Part phases)

Part phases control the progress of individual parts within an order (e.g. Design → Review → Print Ready → Printed).

### Fields

| Field | Description |
|-------|-------------|
| **Name** | Part phase name |
| **Color** | Color indicator in the order detail view |
| **Default** | New parts start in this phase |
| **Print ready** | Parts in this phase are considered by the job planner |
| **Review** | Marks the quality control phase |
| **Printed** | Parts that have completed printing |
| **Failed print** | Marks failed prints |

### Influence on the job planner

The automatic planner specifically looks for parts whose phase has the **Print ready** flag. Set this flag correctly so the planner only schedules fully prepared parts.

---

## Project phases (Tab: Project phases)

Project phases control the overall status of a [[Projects|project]] (e.g. Planning → Active → Completed).

Configuration works the same as order phases (name, color, default flag, drag & drop).
