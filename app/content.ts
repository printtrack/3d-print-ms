// Landing page copy is NOT edited here — it lives in the database and is edited
// under Admin → Landing-Page (see lib/landing/blocks.ts). What is left in this
// file are the two strings that have no other home: a company name for installs
// that have not set one, and the access code labels, which belong to the order
// form rather than to any landing block.
//
// This file used to hold the whole page as a "change text here, no coding
// needed" const. It no longer does, and nothing here changes the page's
// sections — editing them would be editing dead code.

export const CONTENT = {
  // Fallback company name shown if Admin → Einstellungen has no value set
  fallbackCompanyName: "Makerspace 3D-Druck",

  accessCode: {
    label: "Zugangscode",
    placeholder: "Code eingeben",
    error: "Ungültiger Zugangscode",
  },
} as const;
