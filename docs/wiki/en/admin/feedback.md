---
title: "Feedback & Bug Reports (Beta)"
description: "Report bugs and improvements straight from the UI – optionally with a screenshot and an automatic GitHub issue"
route: "/admin/feedback"
icon: "MessageSquarePlus"
group: "Knowledge & Admin"
order: 10
---

# Feedback & Bug Reports (Beta)

During the beta phase, every team member can report bugs and improvement ideas straight from the admin interface – without leaving the app. Each report can automatically become a GitHub issue, so nothing gets lost.

![Feedback overview](/wiki-screenshots/feedback.png)

## The feedback button

As long as **beta mode** is enabled (Settings → Modules → Beta), a round **feedback button** appears in the bottom-right corner of every admin page. Clicking it opens the report dialog:

1. **Choose a type:** *Bug* (something doesn't work) or *Improvement* (an idea/request).
2. **Title & description:** Summarize briefly and describe what happened, what you expected, and how to reproduce it.
3. **Capture the current page (optional):** Clicking "Capture current page" takes a screenshot of the current view with no further prompt – **no screen-sharing permission required**. The dialog briefly hides itself during capture so it isn't in the shot. You can then draw directly on the screenshot with your mouse to mark **exactly where** the problem is.
4. **Submit:** The report is saved. If the GitHub integration is configured, an issue is created right away and you get a link to it.

The current page (URL) and browser information are sent along automatically – saving you follow-up questions.

## The triage view

Under **Feedback** in the navigation (admins only, visible only in beta mode) all reports come together. For each report you see the type, title, description, reporter, timestamp, the annotated screenshot and – if present – the link to the GitHub issue.

Each report has a **status** you set here:

| Status | Meaning |
|--------|---------|
| **New** | Just received, not yet triaged |
| **In progress** | Currently being worked on |
| **Resolved** | Fixed or implemented |
| **Dismissed** | No action needed |

Use the status filter in the top-right to show individual statuses. Reports can also be deleted here.

## Setting up the GitHub integration

Issue creation is optional. It becomes active as soon as two environment variables are set:

- `GITHUB_TOKEN` – a personal access token with write access to issues (classic: `repo` scope; fine-grained: *Issues → Read and write*).
- `GITHUB_REPO` – the target repository in `owner/repo` format.

Without these variables the feedback is still stored in the database and shows up in the triage view – so it is never lost.

## Turning off beta mode

Once the beta phase is over, disable beta mode under **Settings → Modules → Beta**. Both the floating feedback button and the "Feedback" navigation entry then disappear. Any feedback already collected stays in the database.
