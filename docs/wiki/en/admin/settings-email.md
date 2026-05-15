---
title: "Settings → Email templates"
description: "Configure automatic customer notifications per phase"
route: "/admin/settings?tab=emails"
icon: "Mail"
group: "Knowledge & Admin"
order: 9.1
---

# Email templates

![Settings email templates](/wiki-screenshots/settings-email.png)

An automatic email can be sent to the customer for each order phase. The email is sent as soon as an order moves into that phase.

## Editing a template

1. Select the desired phase from the list in the **Emails** tab.
2. Enable the template with the **Enable** toggle.
3. Fill in subject and message in both languages.
4. Click **Save**.

> If no template is enabled for a phase, no email is sent when the phase changes.

## Fields

| Field | Required | Description |
|-------|----------|-------------|
| **Active** | — | Toggle: enable or disable email for this phase |
| **Subject (DE)** | yes* | Subject of the German email |
| **Message (DE)** | yes* | Body of the German email (Markdown supported) |
| **Subject (EN)** | yes* | Subject of the English email |
| **Message (EN)** | yes* | Body of the English email (Markdown supported) |

*Required when the template is enabled.

## Placeholders

You can insert dynamic content using placeholders:

| Placeholder | Output |
|-------------|--------|
| `{customerName}` | Full name of the customer |
| `{orderNumber}` | Unique order number (short code) |
| `{phase}` | Name of the new phase |
| `{trackingLink}` | Link to the customer's public tracking page |

**Example:**

```
Hello {customerName},

your order {orderNumber} is now in the phase "{phase}".

You can check the current status here: {trackingLink}

Best regards,
Your 3D Print Team
```

## Customer email language

The system automatically detects the customer's preferred language (stored at registration in the portal) and sends the email in the corresponding language. If no language is set, German is used.

## Survey tab

The **Survey** tab configures the customer satisfaction survey:

- **Enable** — turns the survey on
- **Phase** — which phase triggers the survey email (recommended: Ready for pickup or Completed)
- **Subject and body** of the survey email in both languages
