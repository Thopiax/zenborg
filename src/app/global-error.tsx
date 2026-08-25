"use client";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "monospace",
          padding: "2rem",
          background: "#1c1917",
          color: "#fafaf9",
        }}
      >
        <h1 style={{ color: "#ef4444" }}>Zenborg crashed</h1>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: "#292524",
            padding: "1rem",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            lineHeight: 1.5,
          }}
        >
          {error.message}
          {"\n\n"}
          {error.stack}
        </pre>
      </body>
    </html>
  );
}
