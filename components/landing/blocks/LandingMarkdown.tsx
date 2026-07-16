"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Markdown for admin-authored landing copy.
 *
 * Separate from WikiMarkdown on purpose, twice over:
 *  - Colors. WikiMarkdown styles with shadcn tokens (text-foreground); DESIGN.md
 *    forbids bleeding admin tokens onto the landing surface, which has its own
 *    palette and flips on a dark band.
 *  - Safety. WikiMarkdown passes `urlTransform={(url) => url}`, disabling
 *    react-markdown's URL sanitizing — defensible for wiki files in the repo, not
 *    for a field that reaches the public page through a web form. Here the
 *    default sanitizer stays on (drops javascript: and friends) and raw HTML is
 *    never enabled (no rehype-raw), so no separate sanitizer is needed.
 */
export function LandingMarkdown({ children, dark }: { children: string; dark: boolean }) {
  const body = dark ? "text-white/70" : "text-gray-500";
  const strong = dark ? "text-white" : "text-gray-900";

  return (
    <div className={`text-base leading-relaxed ${body}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1
              className={`text-3xl mt-8 mb-3 first:mt-0 ${strong}`}
              style={{ fontFamily: "var(--font-dm-serif)" }}
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              className={`text-2xl mt-8 mb-3 first:mt-0 ${strong}`}
              style={{ fontFamily: "var(--font-dm-serif)" }}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className={`text-lg font-semibold mt-6 mb-2 ${strong}`}>{children}</h3>
          ),
          p: ({ children }) => <p className="my-4">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 space-y-2 my-4">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-2 my-4">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className={`font-semibold ${strong}`}>{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ children, href }) => (
            <a
              href={href}
              className="underline underline-offset-2 hover:opacity-80 transition-opacity"
              style={{ color: "var(--landing-accent)" }}
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote
              className="border-l-2 pl-4 my-4 italic"
              style={{ borderColor: "var(--landing-accent)" }}
            >
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code
              className={`rounded px-1.5 py-0.5 text-sm font-mono ${
                dark ? "bg-white/10 text-white" : "bg-gray-100 text-gray-900"
              }`}
            >
              {children}
            </code>
          ),
          hr: () => <hr className={`my-8 ${dark ? "border-white/10" : "border-gray-200"}`} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
