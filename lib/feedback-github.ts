// Optional GitHub-Issue-Anbindung für Beta-Feedback.
//
// Aktiv nur wenn BEIDE Env-Variablen gesetzt sind:
//   GITHUB_TOKEN — PAT (classic: `repo`-Scope; fine-grained: Issues → Read/Write)
//   GITHUB_REPO  — Ziel-Repo im Format "owner/repo"
//
// Ohne Token wird das Feedback nur in der DB gespeichert und die Admin-Ansicht
// zeigt es zur manuellen Sichtung — es geht also nie verloren. Wir sprechen die
// REST-API direkt per fetch an (kein Octokit-ESM-Ballast im Next-Server).

const GITHUB_API = "https://api.github.com";

export interface GitHubIssueInput {
  type: "BUG" | "IMPROVEMENT";
  title: string;
  description: string;
  pageUrl?: string | null;
  userAgent?: string | null;
  reporter?: string | null;
  /** Absolute URL to the stored screenshot, if any. */
  screenshotUrl?: string | null;
}

export interface GitHubIssueResult {
  url: string;
  number: number;
}

export function isGitHubConfigured(): boolean {
  return Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO);
}

function buildIssueBody(input: GitHubIssueInput): string {
  const lines: string[] = [input.description.trim(), ""];
  lines.push("---", "");
  if (input.reporter) lines.push(`**Gemeldet von:** ${input.reporter}`);
  if (input.pageUrl) lines.push(`**Seite:** ${input.pageUrl}`);
  if (input.userAgent) lines.push(`**Browser:** ${input.userAgent}`);
  if (input.screenshotUrl) lines.push("", `![Screenshot](${input.screenshotUrl})`);
  lines.push("", "_Automatisch aus dem 3D-Druck-CMS Beta-Feedback erstellt._");
  return lines.join("\n");
}

/**
 * Create a GitHub issue for a feedback item. Returns null (never throws) when
 * GitHub is not configured or the API call fails — the caller has already
 * persisted the feedback, so a failed issue must not fail the request.
 */
export async function createGitHubIssue(
  input: GitHubIssueInput,
): Promise<GitHubIssueResult | null> {
  if (!isGitHubConfigured()) return null;

  const repo = process.env.GITHUB_REPO!;
  const labels = [input.type === "BUG" ? "bug" : "enhancement", "beta-feedback"];

  try {
    const res = await fetch(`${GITHUB_API}/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: `${input.type === "BUG" ? "🐛" : "💡"} ${input.title}`,
        body: buildIssueBody(input),
        labels,
      }),
    });

    if (!res.ok) {
      console.error(`GitHub issue creation failed: ${res.status} ${await res.text()}`);
      return null;
    }

    const data = (await res.json()) as { html_url: string; number: number };
    return { url: data.html_url, number: data.number };
  } catch (err) {
    console.error("GitHub issue creation error:", err);
    return null;
  }
}
