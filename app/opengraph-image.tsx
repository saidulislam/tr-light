import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background: "#fafafa",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect x="3" y="6" width="14" height="14" rx="3" fill="#000" opacity="0.3" />
            <rect x="7" y="4" width="14" height="14" rx="3" fill="#000" />
            <line x1="10" y1="9" x2="18" y2="9" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="10" y1="12" x2="15" y2="12" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", color: "#0a0a0a" }}>
            Talent Review
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <p
            style={{
              fontSize: 84,
              fontWeight: 600,
              letterSpacing: "-0.025em",
              lineHeight: 1.05,
              color: "#0a0a0a",
              margin: 0,
            }}
          >
            Reviews
            <br />
            worth writing.
          </p>
          <p
            style={{
              fontSize: 26,
              color: "#52525b",
              maxWidth: 760,
              lineHeight: 1.4,
              margin: 0,
            }}
          >
            Calm, candid performance reviews — on the manager&apos;s side.
          </p>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <span style={{ fontSize: 18, color: "#a1a1aa", letterSpacing: "0.04em" }}>
            ACME · Talent Review
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
