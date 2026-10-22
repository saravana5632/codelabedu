import React from "react";
import { QuestionExample } from "./leetcodeHarness.js";

/**
 * Safe Markdown-to-JSX renderer supporting paragraphs, code blocks (```),
 * inline code (`...`), bold (**...**), italics (*...*), bullet lists (- / *),
 * and numbered lists without executing untrusted HTML.
 */
export function renderSafeMarkdown(text: string): React.ReactNode {
  if (!text) return null;

  const segments = text.split(/(```[\s\S]*?```)/g);

  return segments.map((seg, idx) => {
    if (seg.startsWith("```") && seg.endsWith("```")) {
      const inner = seg.slice(3, -3).replace(/^[a-zA-Z0-9_-]+\n/, "");
      return (
        <pre
          key={idx}
          className="my-3 bg-slate-900 text-slate-100 rounded-lg p-3.5 text-xs font-mono overflow-x-auto leading-relaxed"
        >
          <code>{inner.trim()}</code>
        </pre>
      );
    }

    const lines = seg.split(/\r?\n/);
    const elements: React.ReactNode[] = [];
    let listItems: string[] = [];

    const flushList = (keyPrefix: string) => {
      if (listItems.length > 0) {
        elements.push(
          <ul
            key={keyPrefix}
            className="list-disc list-inside space-y-1.5 my-2 text-sm text-slate-700"
          >
            {listItems.map((item, i) => (
              <li key={i} className="leading-relaxed">
                {renderInlineFormatting(item)}
              </li>
            ))}
          </ul>
        );
        listItems = [];
      }
    };

    lines.forEach((line, lIdx) => {
      const trimmed = line.trim();
      if (/^[-*]\s+/.test(trimmed)) {
        listItems.push(trimmed.replace(/^[-*]\s+/, ""));
      } else {
        flushList(`list-${idx}-${lIdx}`);
        if (trimmed === "") {
          elements.push(<div key={`sp-${idx}-${lIdx}`} className="h-2" />);
        } else if (trimmed.startsWith("### ")) {
          elements.push(
            <h4
              key={`h4-${idx}-${lIdx}`}
              className="text-sm font-bold text-slate-900 mt-3 mb-1"
            >
              {renderInlineFormatting(trimmed.slice(4))}
            </h4>
          );
        } else if (trimmed.startsWith("## ")) {
          elements.push(
            <h3
              key={`h3-${idx}-${lIdx}`}
              className="text-base font-bold text-slate-900 mt-4 mb-1.5"
            >
              {renderInlineFormatting(trimmed.slice(3))}
            </h3>
          );
        } else {
          elements.push(
            <p
              key={`p-${idx}-${lIdx}`}
              className="text-sm text-slate-700 leading-relaxed"
            >
              {renderInlineFormatting(line)}
            </p>
          );
        }
      }
    });

    flushList(`list-end-${idx}`);
    return <React.Fragment key={idx}>{elements}</React.Fragment>;
  });
}

function renderInlineFormatting(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-xs font-mono text-slate-800"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={i} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

export interface ProblemStatementProps {
  title: string;
  difficulty: string;
  topic?: string;
  maxMarks?: number;
  timeLimitSeconds?: number;
  memoryLimitMb?: number;
  description: string;
  examples?: QuestionExample[];
  constraints?: string | null;
  sampleInput?: string | null;
  sampleOutput?: string | null;
  inputFormat?: string | null;
  outputFormat?: string | null;
}

export default function ProblemStatementView({
  title,
  difficulty,
  topic,
  maxMarks = 50,
  timeLimitSeconds,
  memoryLimitMb,
  description,
  examples = [],
  constraints,
  sampleInput,
  sampleOutput,
  inputFormat,
  outputFormat,
}: ProblemStatementProps) {
  const diffLower = (difficulty || "medium").toLowerCase();
  const diffColor =
    diffLower === "easy"
      ? "text-emerald-700"
      : diffLower === "hard"
      ? "text-red-700"
      : "text-amber-700";
  const diffLabel =
    diffLower.charAt(0).toUpperCase() + diffLower.slice(1);

  const effectiveExamples: QuestionExample[] =
    Array.isArray(examples) && examples.length > 0
      ? examples
      : sampleInput || sampleOutput
      ? [
          {
            input: sampleInput || "",
            output: sampleOutput || "",
          },
        ]
      : [];

  const constraintLines = (constraints || "")
    .split(/\r?\n/)
    .map((c) => c.trim())
    .filter(Boolean);

  return (
    <div className="space-y-6">
      {/* 1. Title and Difficulty / Metadata */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
          {title || "Untitled Question"}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className={`font-semibold ${diffColor}`}>{diffLabel}</span>
          {topic && (
            <>
              <span aria-hidden="true">·</span>
              <span>{topic}</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{maxMarks} Marks</span>
          {timeLimitSeconds && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {timeLimitSeconds}s Time Limit
              </span>
            </>
          )}
          {memoryLimitMb && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {memoryLimitMb} MB
              </span>
            </>
          )}
        </div>
      </div>

      {/* 2. Problem Description (Markdown) */}
      <div className="space-y-1">
        {renderSafeMarkdown(description || "No description provided.")}
      </div>

      {inputFormat && (
        <div className="space-y-1">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Input Format
          </h3>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">
            {inputFormat}
          </p>
        </div>
      )}

      {outputFormat && (
        <div className="space-y-1">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Output Format
          </h3>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">
            {outputFormat}
          </p>
        </div>
      )}

      {/* 3. Examples with numbered Input, Output, and optional Explanation */}
      {effectiveExamples.length > 0 && (
        <div className="space-y-4">
          {effectiveExamples.map((ex, idx) => (
            <div key={idx} className="space-y-2">
              <h3 className="text-sm font-bold text-slate-900">
                Example {idx + 1}:
              </h3>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2 text-xs font-mono">
                <div>
                  <span className="font-bold text-slate-700">Input: </span>
                  <span className="text-slate-900 whitespace-pre-wrap">
                    {ex.input}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-slate-700">Output: </span>
                  <span className="text-slate-900 whitespace-pre-wrap">
                    {ex.output}
                  </span>
                </div>
                {ex.explanation && ex.explanation.trim() !== "" && (
                  <div className="font-sans text-xs text-slate-600 pt-1 border-t border-slate-200/70">
                    <span className="font-semibold text-slate-700">
                      Explanation:{" "}
                    </span>
                    <span className="whitespace-pre-wrap">
                      {ex.explanation}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. Constraints */}
      {constraintLines.length > 0 && (
        <div className="space-y-2 pt-1">
          <h3 className="text-sm font-bold text-slate-900">Constraints:</h3>
          <ul className="list-disc list-inside space-y-1.5 text-xs font-mono text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3.5">
            {constraintLines.map((line, idx) => {
              const cleaned = line.replace(/^[-*•]\s*/, "");
              return (
                <li key={idx} className="leading-relaxed whitespace-pre-wrap">
                  {cleaned}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
