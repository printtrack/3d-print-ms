// EDITABLE CONTENT — Change text here. No coding knowledge needed.
// After editing, save the file and the page will update on next reload.

export const CONTENT = {
  // Fallback company name shown if Admin → Einstellungen has no value set
  fallbackCompanyName: "Makerspace 3D-Druck",

  navbar: {
    ctaLabel: "Druckauftrag starten",
  },

  hero: {
    eyebrow: "Dein Schulmakerspace",
    // Use \n to split the headline into two lines
    headline: "Deine Idee.\nWir drucken sie.",
    subheadline:
      "Ob Schulprojekt, eigene Erfindung oder kreatives Experiment – reiche dein 3D-Modell ein und hol es fertig gedruckt im Makerspace ab.",
    primaryCta: "Druckauftrag starten",
  },

  features: {
    sectionLabel: "Darum der Makerspace",
    headline: "Kreativität trifft Technik",
    // icon must be one of: Zap | Shield | Eye | MessageCircle
    items: [
      {
        icon: "Zap",
        title: "Schnell gedruckt",
        description:
          "Die meisten Aufträge sind innerhalb weniger Tage fertig – du bekommst eine Nachricht, sobald dein Druck abholbereit ist.",
      },
      {
        icon: "Shield",
        title: "Zuverlässige Qualität",
        description:
          "Unsere Drucker liefern saubere Ergebnisse – egal ob für Referate, Wettbewerbe oder eigene Projekte.",
      },
      {
        icon: "Eye",
        title: "Status jederzeit einsehen",
        description:
          "Verfolge deinen Auftrag online und sieh genau, in welchem Schritt er gerade steckt.",
      },
      {
        icon: "MessageCircle",
        title: "Fragen? Schreib uns!",
        description:
          "Das Makerspace-Team hilft dir gerne – bei Dateiproblemen, Materialwahl oder anderen Fragen.",
      },
    ],
  },

  howItWorks: {
    sectionLabel: "So funktioniert's",
    headline: "In drei Schritten zum fertigen Druck",
    steps: [
      {
        number: "01",
        title: "Auftrag einreichen",
        description:
          "Beschreibe dein Projekt, lade deine 3D-Datei hoch und wähle das passende Material.",
      },
      {
        number: "02",
        title: "Wir drucken",
        description:
          "Das Makerspace-Team prüft deinen Auftrag und startet den Druck. Du wirst über den Fortschritt informiert.",
      },
      {
        number: "03",
        title: "Abholen im Makerspace",
        description:
          "Sobald dein Modell fertig ist, bekommst du eine Benachrichtigung und kannst es im Makerspace abholen.",
      },
    ],
  },

  orderSection: {
    sectionLabel: "Druckauftrag einreichen",
    headline: "Hast du eine Idee?",
    subheadline:
      "Füll das Formular aus – das Makerspace-Team meldet sich bei dir.",
  },

  accessCode: {
    label: "Zugangscode",
    placeholder: "Code eingeben",
    error: "Ungültiger Zugangscode",
  },

  footer: {
    tagline: "Kreativität aus dem Drucker.",
  },
} as const;
