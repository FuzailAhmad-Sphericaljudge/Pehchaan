import React from "react";
import { Link } from "react-router-dom";
import { contentApi, type ContentPage, type Language } from "./api";

// Tiny local markdown renderer for the consent notice (same approach as the
// public content pages): escapes HTML first, then formats the small subset
// the DRAFT policy text uses — headings, lists, bold, italic.
function miniMarkdown(text: string): string {
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (value: string) => escape(value).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return text
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split("\n").map(inline);
      if (lines.every((line) => line.startsWith("- "))) return `<ul>${lines.map((line) => `<li>${line.slice(2)}</li>`).join("")}</ul>`;
      if (lines[0]?.startsWith("## ")) return `<h2>${lines[0].slice(3)}</h2>${lines.slice(1).length ? `<p>${lines.slice(1).join("<br/>")}</p>` : ""}`;
      return `<p>${lines.join("<br/>")}</p>`;
    })
    .join("");
}

// Phase 35: on-screen consent gate shown in the worker area before the first
// data submission. The notice text is the versioned, CMS-backed
// "worker-consent" legal page (EN/HI), so any policy change stays in the
// content system — the gate itself only records an on-device acknowledgement
// timestamp. DRAFT content is labelled until legal review completes.
export function ConsentGate({ lang, children }: { lang: Language; children: React.ReactNode }) {
  const storageKey = "pehchaan-consent-ack-v1";
  const [page, setPage] = React.useState<ContentPage | null>(null);
  const [acknowledged, setAcknowledged] = React.useState(() => localStorage.getItem(storageKey) !== null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    contentApi
      .page("worker-consent")
      .then(setPage)
      .catch(() => setPage(null));
  }, []);
  if (acknowledged) return <>{children}</>;
  const locale = page?.locales?.[lang]?.body ? lang : page?.locales?.en?.body ? "en" : null;
  const accept = () => {
    setBusy(true);
    localStorage.setItem(storageKey, new Date().toISOString());
    setAcknowledged(true);
  };
  return (
    <div className="list-panel consent-gate">
      <h1>{lang === "hi" ? "शुरू करने से पहले" : "Before you start"}</h1>
      {locale ? (
        <div className="cms-preview" dangerouslySetInnerHTML={{ __html: miniMarkdown(page!.locales[locale].body) }} />
      ) : (
        <p>
          {lang === "hi"
            ? "आप जो जानकारी सेव करते हैं वह आपके अपने सबूत के लिए रखी जाती है। आपकी शिकायतें केवल आपकी मदद करने वाले NGO केसवर्कर देखते हैं। आप अपना रिकॉर्ड कभी भी डाउनलोड या डिलीट कर सकते हैं।"
            : "What you save is kept as your own proof. Your complaints are seen only by the NGO caseworker helping you. You can download or delete your record anytime."}
        </p>
      )}
      <p className="helper">
        {lang === "hi" ? "पूरा विवरण पढ़ें: " : "Read the full details: "}
        <Link to="/worker-consent" target="_blank">{lang === "hi" ? "गोपनीयता नीति और सहमति" : "privacy notice and consent"}</Link>
      </p>
      <button className="button" disabled={busy} onClick={accept}>
        {lang === "hi" ? "मैं समझ गया/गई हूँ — आगे बढ़ें" : "I understand — continue"}
      </button>
    </div>
  );
}
