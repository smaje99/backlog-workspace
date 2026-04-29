import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

type Props = {
  markdown: string;
  className?: string;
};

function isExternalHref(href?: string) {
  return !!href && /^(https?:)?\/\//.test(href);
}

export function MarkdownRenderer({ markdown, className }: Props) {
  return (
    <div className={cn("markdown-body text-sm leading-7 text-slate-200", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="pt-4 text-2xl font-semibold tracking-tight text-foreground">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="pt-3 text-xl font-semibold text-foreground">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="pt-2 text-lg font-semibold text-foreground">{children}</h4>
          ),
          p: ({ children }) => <p className="my-3 text-slate-200">{children}</p>,
          ul: ({ children }) => <ul className="my-3 list-disc space-y-2 pl-6">{children}</ul>,
          ol: ({ children }) => (
            <ol className="my-3 list-decimal space-y-2 pl-6">{children}</ol>
          ),
          li: ({ children }) => <li className="pl-1 marker:text-teal-300">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-4 rounded-r-2xl border-l-4 border-teal-500/45 bg-teal-500/8 px-4 py-3 text-slate-100">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-6 border-border/70" />,
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-2xl border border-border/70">
              <table className="min-w-full border-collapse text-left text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-white/5">{children}</thead>,
          th: ({ children }) => (
            <th className="border-b border-border/70 px-4 py-3 font-semibold text-foreground">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-t border-border/50 px-4 py-3 align-top text-slate-200">
              {children}
            </td>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target={isExternalHref(href) ? "_blank" : undefined}
              rel={isExternalHref(href) ? "noreferrer" : undefined}
              className="text-teal-300 underline decoration-teal-500/40 underline-offset-4 hover:text-teal-200"
            >
              {children}
            </a>
          ),
          code: ({ className: codeClassName, children, ...props }) => {
            const language = codeClassName?.replace(/^language-/, "") ?? "";
            const content = String(children).replace(/\n$/, "");
            const multiline = content.includes("\n") || !!language;

            if (!multiline) {
              return (
                <code
                  className="rounded bg-slate-950/65 px-1.5 py-0.5 font-mono text-[0.92em] text-sky-100"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <div className="my-4 overflow-hidden rounded-2xl border border-border/70 bg-slate-950/85">
                {language ? (
                  <div className="border-b border-border/70 px-4 py-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {language}
                  </div>
                ) : null}
                <pre className="overflow-x-auto p-4 text-xs leading-6 text-sky-100">
                  <code className={codeClassName} {...props}>
                    {content}
                  </code>
                </pre>
              </div>
            );
          }
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
