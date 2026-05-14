"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { Link2 } from "lucide-react";
import { preprocessWikilinks } from "@/lib/wikilinks";
import type { WikiMeta } from "@/lib/wiki";

interface WikiMarkdownProps {
  body: string;
  pages: WikiMeta[];
}

export function WikiMarkdown({ body, pages }: WikiMarkdownProps) {
  const processed = preprocessWikilinks(body);

  return (
    <div className="text-sm leading-relaxed text-foreground/90 space-y-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => url}
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold text-foreground mt-6 mb-3 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-2 border-b pb-1">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-foreground mt-4 mb-1">{children}</h3>
          ),
          p: ({ children }) => <p className="my-2">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 my-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 my-2">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children, className }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <code className="block bg-muted rounded-lg px-4 py-3 text-xs font-mono overflow-x-auto my-3">
                  {children}
                </code>
              );
            }
            return (
              <code className="bg-muted rounded px-1 py-0.5 text-xs font-mono">{children}</code>
            );
          },
          pre: ({ children }) => <pre className="my-3 overflow-x-auto">{children}</pre>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/30 pl-4 italic text-muted-foreground my-3">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
          th: ({ children }) => (
            <th className="border border-border px-3 py-2 text-left font-semibold text-foreground">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-3 py-2 text-foreground/80">{children}</td>
          ),
          hr: () => <hr className="my-6 border-border" />,
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt ?? ""}
              loading="lazy"
              className="rounded-md border max-w-full my-4"
            />
          ),
          a: ({ href, children }) => {
            if (href?.startsWith("wikilink:")) {
              const title = decodeURIComponent(href.slice(9));
              const target = pages.find(
                (p) => p.title.toLowerCase() === title.toLowerCase()
              );
              if (target) {
                return (
                  <Link
                    href={`/admin/wiki/${target.slug}`}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium no-underline bg-primary/10 text-primary hover:bg-primary/20"
                  >
                    <Link2 className="h-3 w-3 shrink-0" />
                    {children}
                  </Link>
                );
              }
              return (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground opacity-70">
                  <Link2 className="h-3 w-3 shrink-0" />
                  {children}
                  <span>?</span>
                </span>
              );
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-2 hover:no-underline"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
