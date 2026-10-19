export interface MathMarkdownProps {
  /** HTML from the repository-only compiled-guide-markdown Vite plugin. */
  html: string;
  className?: string;
}

/** Display precompiled Markdown and accessible MathML without a runtime parser. */
export function MathMarkdown({ html, className = '' }: MathMarkdownProps) {
  return <div className={`math-markdown ${className}`.trim()} dangerouslySetInnerHTML={{ __html: html }} />;
}
