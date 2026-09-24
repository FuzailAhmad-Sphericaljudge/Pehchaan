import React from "react";
import { Link, NavLink as RouterNavLink } from "react-router-dom";
import { contentApi, Language, publicApi } from "./api";

/* =====================================================================
   Pehchaan public site — shared chrome + the seven marketing pages.
   Design system: wheat/indigo/marigold/sindoor/leaf, Fraunces + Hind,
   flat geometric SVG illustrations, block-print dot-grid textures.
   ===================================================================== */

const DISCLAIMER_EN =
  "Pehchaan does not replace emergency services, police, courts, or labour departments. It helps workers and trusted organizations organize information and access support more effectively.";
const DISCLAIMER_HI =
  "Pehchaan किसी आपात सेवा, पुलिस, अदालत या श्रम विभाग का विकल्प नहीं है। यह श्रमिकों और भरोसेमंद संस्थाओं को जानकारी व्यवस्थित करने और सहायता तेज़ी से पहुंचाने में मदद करता है।";

type Chrome = { lang: Language; setLang: (value: Language) => void };

/* ------------------------------------------------------------------
   Flat geometric SVG illustration kit (warm-toned, no photos)
   ------------------------------------------------------------------ */

function ArtWorker({ accent = "#E8A33D", dark = "#17324A" }: { accent?: string; dark?: string }) {
  return (
    <svg viewBox="0 0 220 200" role="img" aria-label="Construction worker with a phone">
      <circle cx="110" cy="96" r="72" fill={accent} opacity="0.25" />
      <rect x="86" y="118" width="48" height="52" rx="8" fill={dark} />
      <circle cx="110" cy="74" r="26" fill="#E9B98A" />
      <path d="M84 70a26 26 0 0 1 52 0v-6a26 26 0 0 0-52 0z" fill={accent} />
      <rect x="82" y="62" width="56" height="10" rx="4" fill={accent} />
      <rect x="104" y="52" width="12" height="12" rx="3" fill={accent} />
      <circle cx="102" cy="76" r="2.6" fill={dark} />
      <circle cx="118" cy="76" r="2.6" fill={dark} />
      <path d="M104 84q6 4 12 0" stroke={dark} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <rect x="132" y="96" width="20" height="34" rx="5" fill={dark} />
      <rect x="135" y="100" width="14" height="22" rx="3" fill="#FBF6EA" />
      <path d="M138 106l8 0M138 112l8 0" stroke={accent} strokeWidth="2" strokeLinecap="round" />
      <rect x="60" y="118" width="26" height="52" rx="8" fill={dark} opacity="0.85" />
      <path d="M150 130l24-16 6 8-24 16z" fill={dark} opacity="0.85" />
      <rect x="30" y="168" width="160" height="8" rx="4" fill={dark} opacity="0.18" />
    </svg>
  );
}

function ArtCyclist({ accent = "#FBF6EA", bg = "#3C6E47" }: { accent?: string; bg?: string }) {
  return (
    <svg viewBox="0 0 220 160" role="img" aria-label="Delivery cyclist">
      <rect x="0" y="0" width="220" height="160" rx="18" fill={bg} />
      <circle cx="62" cy="122" r="24" fill="none" stroke={accent} strokeWidth="4" />
      <circle cx="162" cy="122" r="24" fill="none" stroke={accent} strokeWidth="4" />
      <path d="M62 122l36-40h34l30 40" stroke={accent} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M98 82l14-18h20" stroke={accent} strokeWidth="4" fill="none" strokeLinecap="round" />
      <circle cx="128" cy="42" r="12" fill={accent} />
      <rect x="120" y="54" width="18" height="22" rx="6" fill={accent} opacity="0.9" />
      <rect x="138" y="66" width="26" height="16" rx="4" fill="#A6321E" />
      <path d="M20 146h180" stroke={accent} strokeWidth="3" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

function ArtSpeechBubble() {
  return (
    <svg viewBox="0 0 120 90" role="img" aria-label="Speech bubble">
      <rect x="8" y="10" width="104" height="52" rx="16" fill="#17324A" />
      <path d="M38 62l-6 20 24-20z" fill="#17324A" />
      <path d="M30 30h60M30 42h44" stroke="#E8A33D" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

function ArtNightWorker() {
  return (
    <svg viewBox="0 0 220 140" role="img" aria-label="Night-shift worker with a glowing phone">
      <circle cx="150" cy="66" r="26" fill="#E9B98A" />
      <path d="M124 62a26 26 0 0 1 52 0l-4-12a26 26 0 0 0-44 0z" fill="#2E4257" />
      <rect x="138" y="88" width="46" height="52" rx="10" fill="#2E4257" />
      <rect x="160" y="102" width="16" height="26" rx="3" fill="#F2B95C" />
      <rect x="163" y="106" width="10" height="16" rx="2" fill="#0E2233" opacity="0.7" />
      <circle cx="163" cy="70" r="2.4" fill="#0E2233" />
      <circle cx="176" cy="70" r="2.4" fill="#0E2233" />
      <path d="M168 76q4 3 8 0" stroke="#0E2233" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function ArtProfile() {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-hidden="true">
      <rect x="8" y="8" width="48" height="48" rx="12" fill="#17324A" />
      <circle cx="32" cy="26" r="9" fill="#E8A33D" />
      <path d="M16 50c3-10 12-13 16-13s13 3 16 13" fill="#E8A33D" />
    </svg>
  );
}

function ArtLedger() {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-hidden="true">
      <rect x="12" y="8" width="40" height="48" rx="8" fill="#3C6E47" />
      <path d="M20 22h24M20 32h24M20 42h14" stroke="#FBF6EA" strokeWidth="4" strokeLinecap="round" />
      <circle cx="44" cy="42" r="7" fill="#E8A33D" />
      <path d="M41 42l2.4 2.6L48 40" stroke="#0E2233" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function ArtShield() {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-hidden="true">
      <path d="M32 6l20 8v16c0 14-9 22-20 28C21 52 12 44 12 30V14z" fill="#A6321E" />
      <path d="M24 31l6 6 12-12" stroke="#FBF6EA" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArtFolder() {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-hidden="true">
      <rect x="8" y="16" width="48" height="36" rx="8" fill="#E8A33D" />
      <path d="M8 26h48" stroke="#FBF6EA" strokeWidth="3" />
      <rect x="24" y="10" width="16" height="10" rx="3" fill="#17324A" />
      <rect x="20" y="34" width="24" height="4" rx="2" fill="#FBF6EA" opacity="0.8" />
      <rect x="20" y="42" width="16" height="4" rx="2" fill="#FBF6EA" opacity="0.6" />
    </svg>
  );
}

function ArtBell() {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-hidden="true">
      <path d="M32 8a16 16 0 0 1 16 16v12l6 8H10l6-8V24A16 16 0 0 1 32 8z" fill="#17324A" />
      <circle cx="32" cy="50" r="5" fill="#A6321E" />
      <circle cx="46" cy="16" r="6" fill="#E8A33D" />
    </svg>
  );
}

function ArtRoute() {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-hidden="true">
      <circle cx="16" cy="16" r="7" fill="#A6321E" />
      <circle cx="48" cy="48" r="7" fill="#3C6E47" />
      <path d="M20 20c14 2 8 22 24 26" stroke="#17324A" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="1 9" />
      <path d="M44 40l4 8-9 1z" fill="#3C6E47" />
    </svg>
  );
}

function ArtGlobe() {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-hidden="true">
      <circle cx="32" cy="32" r="24" fill="#17324A" />
      <path d="M8 32h48M32 8c8 8 8 40 0 48M32 8c-8 8-8 40 0 48" stroke="#E8A33D" strokeWidth="3" fill="none" />
    </svg>
  );
}

function ArtLock() {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-hidden="true">
      <rect x="14" y="28" width="36" height="26" rx="8" fill="#3C6E47" />
      <path d="M22 28v-6a10 10 0 0 1 20 0v6" stroke="#17324A" strokeWidth="5" fill="none" />
      <circle cx="32" cy="41" r="4" fill="#FBF6EA" />
    </svg>
  );
}

function ArtSiteScene() {
  return (
    <svg viewBox="0 0 400 240" className="scene" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Construction site with scaffolding">
      <path d="M40 240V70l10-10 10 10v170M96 240V100l8-8 8 8v140" stroke="#B99B62" strokeWidth="8" fill="none" strokeLinecap="round" />
      <path d="M40 90h66M40 130h66M40 170h66M96 120h50M96 160h50" stroke="#B99B62" strokeWidth="4" strokeLinecap="round" />
      <circle cx="210" cy="120" r="30" fill="#E9B98A" />
      <path d="M182 116a30 30 0 0 1 60 0l-4-12a30 30 0 0 0-52 0z" fill="#E8A33D" />
      <rect x="186" y="108" width="48" height="9" rx="4" fill="#E8A33D" />
      <rect x="188" y="150" width="44" height="90" rx="10" fill="#17324A" />
      <path d="M188 176h44" stroke="#E8A33D" strokeWidth="6" />
      <rect x="258" y="120" width="18" height="34" rx="5" fill="#17324A" />
      <rect x="261" y="125" width="12" height="20" rx="3" fill="#FBF6EA" />
      <path d="M300 240V150h80v90" fill="#EADCBB" />
      <rect x="312" y="166" width="22" height="22" fill="#FBF6EA" />
      <rect x="344" y="166" width="22" height="22" fill="#FBF6EA" />
      <rect x="312" y="198" width="22" height="22" fill="#FBF6EA" />
    </svg>
  );
}

function ArtDeliveryScene() {
  return (
    <svg viewBox="0 0 400 200" className="scene" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Delivery rider between buildings">
      <rect x="0" y="0" width="400" height="200" fill="#3C6E47" />
      <rect x="20" y="60" width="70" height="140" fill="#2E5238" />
      <rect x="104" y="90" width="56" height="110" fill="#2E5238" />
      <rect x="320" y="50" width="60" height="150" fill="#2E5238" />
      <circle cx="150" cy="128" r="30" fill="none" stroke="#FBF6EA" strokeWidth="5" />
      <circle cx="250" cy="128" r="30" fill="none" stroke="#FBF6EA" strokeWidth="5" />
      <path d="M150 128l42-46h34l24 46" stroke="#FBF6EA" strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="212" cy="52" r="13" fill="#E9B98A" />
      <rect x="204" y="64" width="20" height="24" rx="7" fill="#A6321E" />
      <rect x="230" y="78" width="30" height="18" rx="4" fill="#E8A33D" />
      <path d="M0 168h400" stroke="#FBF6EA" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function ArtNightScene() {
  return (
    <svg viewBox="0 0 400 200" className="scene" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Night-shift worker with a glowing phone">
      <rect x="0" y="0" width="400" height="200" fill="#0E2233" />
      <circle cx="150" cy="104" r="26" fill="#E9B98A" />
      <path d="M124 100a26 26 0 0 1 52 0l-4-12a26 26 0 0 0-44 0z" fill="#2E4257" />
      <rect x="138" y="128" width="46" height="60" rx="10" fill="#2E4257" />
      <rect x="162" y="140" width="16" height="26" rx="3" fill="#F2B95C" />
      <circle cx="162" cy="108" r="2.4" fill="#0E2233" />
      <circle cx="176" cy="108" r="2.4" fill="#0E2233" />
      <path d="M168 114q4 3 8 0" stroke="#0E2233" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M280 200v-70l30-14 30 14v70" fill="#17324A" />
      <rect x="296" y="152" width="16" height="16" fill="#F2B95C" opacity="0.5" />
      <rect x="322" y="152" width="16" height="16" fill="#F2B95C" opacity="0.3" />
    </svg>
  );
}

function ArtStep({ kind, dark = "#17324A", accent = "#E8A33D" }: { kind: string; dark?: string; accent?: string }) {
  if (kind === "profile")
    return (
      <svg viewBox="0 0 220 170" role="img" aria-label="Creating a private profile">
        <rect x="60" y="24" width="100" height="126" rx="16" fill="#FBF6EA" stroke={dark} strokeWidth="4" />
        <circle cx="110" cy="66" r="20" fill={accent} />
        <path d="M78 122c4-18 18-22 32-22s28 4 32 22" fill={accent} />
        <rect x="26" y="60" width="34" height="44" rx="10" fill={dark} opacity="0.2" />
        <rect x="160" y="60" width="34" height="44" rx="10" fill={dark} opacity="0.2" />
        <circle cx="178" cy="46" r="12" fill="#3C6E47" />
        <path d="M173 46l4 4 7-7" stroke="#FBF6EA" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
    );
  if (kind === "wages")
    return (
      <svg viewBox="0 0 220 170" role="img" aria-label="Tracking wages">
        <rect x="34" y="20" width="152" height="130" rx="14" fill="#FBF6EA" stroke={dark} strokeWidth="4" />
        <path d="M56 52h60M56 74h108M56 96h108M56 118h44" stroke={dark} strokeWidth="6" strokeLinecap="round" opacity="0.5" />
        <path d="M120 130l24-34 20 14 22-38" stroke="#A6321E" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M186 72l-2-14-13 6z" fill="#A6321E" />
        <circle cx="56" cy="52" r="8" fill={accent} />
      </svg>
    );
  if (kind === "report")
    return (
      <svg viewBox="0 0 220 170" role="img" aria-label="Reporting a problem safely">
        <rect x="70" y="18" width="80" height="134" rx="16" fill={dark} />
        <rect x="78" y="30" width="64" height="96" rx="8" fill="#FBF6EA" />
        <path d="M110 44v40" stroke="#A6321E" strokeWidth="8" strokeLinecap="round" />
        <circle cx="110" cy="102" r="6" fill="#A6321E" />
        <path d="M92 138h36" stroke={accent} strokeWidth="6" strokeLinecap="round" />
        <path d="M34 60c-10 14-10 36 0 50" stroke={dark} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M186 60c10 14 10 36 0 50" stroke={dark} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M22 50c-14 20-14 50 0 70" stroke={accent} strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.7" />
        <path d="M198 50c14 20 14 50 0 70" stroke={accent} strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.7" />
      </svg>
    );
  return (
    <svg viewBox="0 0 220 170" role="img" aria-label="Connected with trusted support">
      <circle cx="60" cy="60" r="22" fill={accent} />
      <circle cx="160" cy="60" r="22" fill="#3C6E47" />
      <circle cx="110" cy="126" r="22" fill={dark} />
      <path d="M74 74l22 34M146 74l-22 34M82 60h56" stroke={dark} strokeWidth="4" strokeLinecap="round" strokeDasharray="2 8" />
      <circle cx="60" cy="56" r="7" fill="#FBF6EA" />
      <path d="M52 70c2-7 6-9 8-9s6 2 8 9" fill="#FBF6EA" />
      <circle cx="160" cy="56" r="7" fill="#FBF6EA" />
      <path d="M152 70c2-7 6-9 8-9s6 2 8 9" fill="#FBF6EA" />
      <circle cx="110" cy="122" r="7" fill="#FBF6EA" />
      <path d="M102 136c2-7 6-9 8-9s6 2 8 9" fill="#FBF6EA" />
    </svg>
  );
}

/* ------------------------------------------------------------------
   Shared chrome
   ------------------------------------------------------------------ */

function Navbar({ lang, setLang }: Chrome & { lang: Language; setLang: (value: Language) => void }) {
  const t = labels[lang];
  const links: Array<[string, string]> = [
    ["/how-it-works", t.how],
    ["/for-workers", t.workers],
    ["/for-organizations", t.orgs],
    ["/safety", t.safety],
    ["/about", t.about],
  ];
  return (
    <>
      <header className="navbar">
        <div className="navbar-inner">
          <Link className="brand" to="/" aria-label="Pehchaan home">
            <span className="logomark" aria-hidden="true">प</span>
            <span className="brand-name">Pehchaan</span>
          </Link>
          <nav aria-label="Primary">
            {links.map(([to, label]) => (
              <NavLink key={to} to={to}>{label}</NavLink>
            ))}
          </nav>
          <div className="nav-actions">
            <div className="lang-toggle" role="group" aria-label="Language">
              <button type="button" className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>EN</button>
              <button type="button" className={lang === "hi" ? "active" : ""} onClick={() => setLang("hi")}>हिं</button>
            </div>
            <Link className="button nav-join" to="/join">{t.join}</Link>
          </div>
        </div>
      </header>
      <div className="stripe-bar" aria-hidden="true" />
    </>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <RouterNavLink to={to} end className={({ isActive }) => (isActive ? "active" : "")}>
      {children}
    </RouterNavLink>
  );
}

function Footer({ lang }: { lang: Language }) {
  const hi = lang === "hi";
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <Link className="brand" to="/">
              <span className="logomark" aria-hidden="true">प</span>
              <span className="brand-name">Pehchaan</span>
            </Link>
            <p className="tagline">{hi ? "हर वर्कर की पहचान, सुरक्षित कल की शुरुआत।" : "Every worker deserves a safer tomorrow."}</p>
          </div>
          <div>
            <h4>{hi ? "जानकारी" : "Organization"}</h4>
            <ul>
              <li><Link to="/about">{hi ? "हमारे बारे में" : "About"}</Link></li>
              <li><Link to="/privacy-policy">{hi ? "गोपनीयता नीति" : "Privacy Policy"}</Link></li>
              <li><Link to="/terms-of-use">{hi ? "उपयोग की शर्तें" : "Terms of Use"}</Link></li>
            </ul>
          </div>
          <div>
            <h4>{hi ? "संपर्क" : "Contact"}</h4>
            <ul>
              <li><Link to="/join">{hi ? "पायलट से जुड़ें" : "Join the pilot"}</Link></li>
              <li><a href="https://www.instagram.com" target="_blank" rel="noreferrer">Instagram</a></li>
              <li><a href="https://www.linkedin.com" target="_blank" rel="noreferrer">LinkedIn</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-disclaimer">
          <p>{hi ? DISCLAIMER_HI : DISCLAIMER_EN}</p>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------
   Shared page pieces
   ------------------------------------------------------------------ */

function StatStrip({ lang }: { lang: Language }) {
  const hi = lang === "hi";
  const stats = hi
    ? [["5", "भाषाएँ — हिंदी, English, বাংলা, தமிழ், తెలుగు"], ["0", "श्रमिक की पहचान का सार्वजनिक खुलासा — कभी नहीं"], ["24×7", "सुरक्षा जांच की सुविधा"]]
    : [["5", "languages — Hindi, English, Bengali, Tamil, Telugu"], ["0", "public exposure of worker identity, ever"], ["24×7", "safety check-in access"]];
  return (
    <section className="stat-strip" aria-label={hi ? "प्लेटफॉर्म के आंकड़े" : "Platform statistics"}>
      <div className="wrap">
        {stats.map(([num, label]) => (
          <div key={label}><strong>{num}</strong><span>{label}</span></div>
        ))}
      </div>
    </section>
  );
}

function TrustStrip({ lang }: { lang: Language }) {
  const hi = lang === "hi";
  return (
    <section className="trust-strip">
      <div className="wrap">
        <p>{hi ? "पूरी तरह निजी। आपकी सहमति से ही साझा।" : "Private by default. Shared only with your consent."}</p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------
   Home
   ------------------------------------------------------------------ */

function PublicHome({ lang }: { lang: Language }) {
  const hi = lang === "hi";
  const t = labels[lang];
  const problems = hi
    ? [["मजदूरी जो कभी नहीं आती", "काम हो गया, लेकिन भुगतान का कोई लिखित सबूत नहीं — किसी के जवाबदेह होने की ज़रूरत नहीं पड़ती।"], ["अस्पष्ट रोजगार की शर्तें", "बिना लिखित शर्तों के काम — कितना, कब और किसके लिए, यह सब याददाश्त पर टिका है।"], ["असुरक्षित कार्यस्थल", "खतरनाक काम की शिकायत करने का कोई सुरक्षित रास्ता नहीं होता।"]]
    : [["Wages that never arrive", "The work is done, but there is no written proof of payment — and no one has to answer for it."], ["Unclear employment terms", "No written terms — how much, when, and for whom all live in memory."], ["Unsafe worksites", "No safe channel to raise a hand when the site is dangerous."]];

  const features = hi
    ? [
        ["ledger", "वेज ट्रैकर", "हर काम की मजदूरी का अपना रिकॉर्ड।", "/for-workers"],
        ["shield", "सुरक्षा जांच", "रोज़ एक टैप में बताएं — मैं सुरक्षित हूं।", "/for-workers"],
        ["folder", "सुरक्षित शिकायतें", "शिकायत सीधे भरोसेमंद संस्था तक।", "/for-workers"],
        ["lock", "सुरक्षित प्रमाण भंडार", "फोटो और फाइलें एन्क्रिप्टेड स्टोरेज में।", "/safety"],
        ["bell", "इमरजेंसी सहायता", "तत्काल मदद — भरोसेमंद संपर्कों तक सूचना।", "/for-workers"],
        ["route", "NGO केस ट्रैकिंग", "हर केस का साफ़ चरण-दर-चरण रिकॉर्ड।", "/for-organizations"],
        ["globe", "बहुभाषी एक्सेस", "आपकी भाषा में पूरा ऐप।", "/for-workers"],
        ["profile", "प्राइवेसी-फर्स्ट डिज़ाइन", "आपका डेटा आपकी सहमति से ही साझा।", "/safety"],
      ]
    : [
        ["ledger", "Wage Tracker", "A personal record of wages for every job.", "/for-workers"],
        ["shield", "Safety Check-ins", "One tap a day to say you are safe.", "/for-workers"],
        ["folder", "Secure Complaints", "Complaints reach trusted organizations, not the internet.", "/for-workers"],
        ["lock", "Evidence Storage", "Photos and files in encrypted storage.", "/safety"],
        ["bell", "Emergency Support", "Immediate alerts to your trusted contacts.", "/for-workers"],
        ["route", "NGO Case Tracking", "A clear stage-by-stage record for every case.", "/for-organizations"],
        ["globe", "Multilingual Access", "The whole app in your language.", "/for-workers"],
        ["profile", "Privacy-first Design", "Your data is shared only with your consent.", "/safety"],
      ];
  const art: Record<string, React.ReactNode> = { ledger: <ArtLedger />, shield: <ArtShield />, folder: <ArtFolder />, lock: <ArtLock />, bell: <ArtBell />, route: <ArtRoute />, globe: <ArtGlobe />, profile: <ArtProfile /> };

  return (
    <main>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <p className="kicker">हर श्रमिक की पहचान</p>
            <h1>{hi ? <>हर श्रमिक<br />सुरक्षित कल का<br />हकदार है।</> : <>Every worker<br />deserves a<br />safer tomorrow.</>}</h1>
            <p className="hindi-tag">हर वर्कर की पहचान, सुरक्षित कल की शुरुआत।</p>
            <p className="lede">{hi ? "पहचान मजदूरी दर्ज करने, असुरक्षित हालत की शिकायत करने और भरोसेमंद सहायता से जुड़ने का एक निजी, सहमति-आधारित तरीका है — आपकी भाषा में।" : "Pehchaan is a private, consent-based way to track wages, report unsafe conditions, and connect with trusted support — in your language."}</p>
            <div className="hero-actions">
              <Link className="button" to="/join">{t.join}</Link>
              <Link className="button button-ghost" to="/how-it-works">{hi ? "देखें यह कैसे काम करता है" : "See how it works"}</Link>
            </div>
            <p className="trust-line">{hi ? "पूरी तरह निजी। आपकी सहमति से ही साझा।" : "Private by default. Shared only with your consent."}</p>
          </div>
          <div style={{ position: "relative" }}>
            <div className="card" style={{ padding: 20, transform: "rotate(-1.5deg)" }}>
              <ArtWorker />
            </div>
            <div className="card" style={{ padding: 8, position: "absolute", bottom: -26, left: -12, width: 150, transform: "rotate(3deg)", borderColor: "var(--indigo-deep)", background: "var(--indigo-deep)" }}>
              <ArtCyclist accent="#F3E8CF" bg="#17324A" />
            </div>
            <div style={{ position: "absolute", top: -18, right: 6, width: 96 }}>
              <ArtSpeechBubble />
            </div>
          </div>
        </div>
      </section>

      <StatStrip lang={lang} />

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="kicker">{hi ? "हकीकत" : "THE REALITY"}</p>
            <h2>{hi ? "मेहनत बहुत, सुरक्षा बहुत कम।" : "Hard work, but very little protection."}</h2>
          </div>
          <div className="problem-grid">
            {problems.map(([title, body]) => (
              <div className="problem" key={title}><h3>{title}</h3><p>{body}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="section band">
        <div className="wrap">
          <div className="section-head">
            <p className="kicker">{hi ? "श्रमिकों के चेहरे" : "FACES OF THE WORKFORCE"}</p>
            <h2>{hi ? "हर काम का अपना चेहरा है।" : "Every kind of work has a face."}</h2>
          </div>
          <div className="faces">
            <article className="face-tile tall wheat-tile">
              <ArtSiteScene />
              <div className="tile-copy">
                <span className="tag">{hi ? "निर्माण" : "CONSTRUCTION"}</span>
                <h3>{hi ? "साइट पर मेहनत, रिकॉर्ड में सुरक्षा" : "Work on the site, safety in the record"}</h3>
                <p>{hi ? "मजदूरी की हर एंट्री आपका लिखित सबूत बनती है — चाहे काम बदले।" : "Every wage entry becomes written proof — even when the job changes."}</p>
              </div>
            </article>
            <article className="face-tile leaf-tile">
              <ArtDeliveryScene />
              <div className="tile-copy">
                <span className="tag">{hi ? "डिलीवरी" : "DELIVERY"}</span>
                <h3>{hi ? "हर राइड का हिसाब" : "Every ride, accounted for"}</h3>
                <p>{hi ? "कई काम एक साथ — हर एक की कमाई अलग ट्रैक होती है।" : "Several jobs at once — each one tracked separately."}</p>
              </div>
            </article>
            <article className="face-tile night-tile">
              <div className="night-stars" aria-hidden="true">
                {[["12%", "18%"], ["30%", "8%"], ["58%", "14%"], ["76%", "26%"], ["88%", "10%"], ["42%", "28%"], ["68%", "34%"]].map(([l, tp], i) => (
                  <i key={i} style={{ left: l, top: tp }} />
                ))}
              </div>
              <ArtNightScene />
              <div className="tile-copy">
                <span className="tag">{hi ? "नाइट शिफ्ट" : "NIGHT SHIFT"}</span>
                <h3>{hi ? "रात में भी कोई सुन रहा है" : "Someone is listening at night too"}</h3>
                <p>{hi ? "24×7 सुरक्षा जांच — मदद की सूचना तुरंत जाती है।" : "24×7 safety check-ins — help requests go out immediately."}</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="kicker">{hi ? "क्या करता है पहचान" : "WHAT PEHCHAAN DOES"}</p>
            <h2>{hi ? "छोटे उपकरण, बड़ा भरोसा।" : "Small tools, real trust."}</h2>
          </div>
          <div className="feature-grid">
            {features.map(([kind, title, body, to]) => (
              <article className="feature" key={title}>
                {art[kind]}
                <h3>{title}</h3>
                <p>{body}</p>
                <Link className="text-link" to={to}>{hi ? "और देखें →" : "See more →"}</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <TrustStrip lang={lang} />
    </main>
  );
}

/* ------------------------------------------------------------------
   How It Works
   ------------------------------------------------------------------ */

function HowItWorks({ lang }: { lang: Language }) {
  const hi = lang === "hi";
  const steps = hi
    ? [
        ["profile", "एक निजी श्रमिक प्रोफ़ाइल बनाएं", "सिर्फ़ आपका मोबाइल नंबर चाहिए — कोई ईमेल, कोई पासवर्ड नहीं। आपकी जानकारी आपके नियंत्रण में रहती है और आप कभी भी अपना पूरा डेटा डाउनलोड कर सकते हैं।"],
        ["wages", "मजदूरी और काम की हालत दर्ज करें", "हर काम के लिए वादा की गई और मिली रकम सहेजें। रोज़ एक टैप में बताएं कि आप सुरक्षित हैं। कम मजदूरी दिखे तो ऐप आपको भरते हुए बताएगा — कोई शिकायत अपने-आप नहीं बनती।"],
        ["report", "समस्या सुरक्षित रूप से बताएं", "मजदूरी, सुरक्षा, उत्पीड़न या बंधुआ मजदूरी — शिकायत सीधे भरोसेमंद NGO केसवर्कर तक पहुंचती है। फोटो/फाइलें एन्क्रिप्टेड स्टोरेज में जाती हैं और स्कैन के बाद ही खुलती हैं।"],
        ["support", "भरोसेमंद सहायता से जुड़ें", "आपका केस चरण-दर-चरण आगे बढ़ता है — प्राप्त, समीक्षा में, कार्रवाई, हल। आप हर बदलाव की सूचना पाते हैं और तत्काल खतरे की सूचना भरोसेमंद संपर्कों तक पहुंचती है।"],
      ]
    : [
        ["profile", "Create a private worker profile", "Just your mobile number — no email, no password. Your information stays in your control, and you can download your complete data anytime."],
        ["wages", "Track wages and work conditions", "Save promised and received amounts for every job. Check in once a day to say you are safe. If an entry looks below the minimum wage, the app tells you — nothing is filed automatically."],
        ["report", "Report a problem safely", "Wages, safety, harassment, or debt bondage — the complaint goes to a trusted NGO caseworker. Photos and files go into encrypted storage and stay sealed until scanned."],
        ["support", "Get connected with trusted support", "Your case moves through clear stages — received, under review, action taken, resolved. You are notified at every change, and urgent danger alerts reach your trusted contacts."],
      ];
  return (
    <main>
      <section className="page-hero">
        <div className="wrap">
          <p className="kicker">{hi ? "यह कैसे काम करता है" : "HOW IT WORKS"}</p>
          <h1>{hi ? "चार कदम, आपकी पहचान आपके हाथ।" : "Four steps, your record in your hands."}</h1>
          <p className="lede">{hi ? "स्मार्टफोन न हो तो भी काम चलता है — WhatsApp, SMS और USSD से भी मजदूरी दर्ज और मदद मांगी जा सकती है।" : "No smartphone needed — wages and help requests also work over WhatsApp, SMS, and USSD."}</p>
        </div>
      </section>
      {steps.map(([kind, title, body], index) => (
        <section className={`step-section step-band-${index % 2}`} key={title}>
          <div className="wrap step-grid" style={{ display: "contents" }}>
            <div>
              <p className="step-num">{hi ? `कदम ${index + 1}` : `Step ${index + 1}`}</p>
              <h2>{title}</h2>
              <p>{body}</p>
            </div>
            <div className="step-figure">
              <ArtStep kind={kind} />
            </div>
          </div>
        </section>
      ))}
      <section className="cta-band">
        <div className="wrap">
          <div>
            <h2>{hi ? "शुरुआत एक मोबाइल नंबर से।" : "It starts with a phone number."}</h2>
            <p>{hi ? "पायलट में हिस्सा लेने के लिए आज ही जुड़ें।" : "Join the pilot today."}</p>
          </div>
          <Link className="button button-marigold" to="/join">{hi ? "पायलट से जुड़ें" : "Join the Pilot"}</Link>
        </div>
      </section>
    </main>
  );
}

/* ------------------------------------------------------------------
   For Workers
   ------------------------------------------------------------------ */

function ForWorkers({ lang }: { lang: Language }) {
  const hi = lang === "hi";
  const t = labels[lang];
  const points = hi
    ? [
        ["एक सरल मोबाइल इंटरफ़ेस", "बड़े बटन, कम कदम, और ऐसी स्क्रीन जो साधारण स्मार्टफोन और धीमे कनेक्शन पर भी काम करती हैं।"],
        ["WhatsApp और SMS सहायता", "स्मार्टफोन न हो तो भी — SAFE, HELP, PAY जैसे शब्दों से मजदूरी दर्ज और मदद मांगी जा सकती है।"],
        ["क्षेत्रीय भाषाओं में मदद", "हिंदी, English, বাংলা, தமிழ், తెలుగు — पूरा ऐप आपकी भाषा में, बोलकर सुनने-बताने की सुविधा समेत।"],
      ]
    : [
        ["A simple mobile interface", "Large buttons, few steps, and screens that work on basic smartphones and slow connections."],
        ["WhatsApp and SMS support", "Even without a smartphone — record wages or ask for help with simple words like SAFE, HELP, and PAY."],
        ["Regional-language assistance", "Hindi, English, Bengali, Tamil, Telugu — the whole app in your language, with voice input and read-aloud where the device supports it."],
      ];
  return (
    <main>
      <section className="page-hero">
        <div className="wrap">
          <p className="kicker">{hi ? "श्रमिकों के लिए" : "FOR WORKERS"}</p>
          <h1>{hi ? <>आपका काम। आपका रिकॉर्ड।<br />आपका अधिकार।</> : <>Your work. Your records.<br />Your rights.</>}</h1>
          <p className="lede">{hi ? "पहचान आपके हाथ में एक निजी रिकॉर्ड देता है — मजदूरी, सुरक्षा और शिकायतों का, आपकी भाषा में।" : "Pehchaan puts a private record in your hands — wages, safety, and complaints, in your language."}</p>
        </div>
      </section>
      <section className="section">
        <div className="wrap">
          <div className="info-grid">
            {points.map(([title, body]) => (
              <article className="info-card sindoor-accent" key={title}><h3>{title}</h3><p>{body}</p></article>
            ))}
          </div>
        </div>
      </section>
      <section className="section band">
        <div className="wrap hero-grid">
          <div>
            <h2>{hi ? "एक दिन में आप क्या कर सकते हैं" : "What a day with Pehchaan looks like"}</h2>
            <p>{hi ? "सुबह एक टैप — मैं सुरक्षित हूं। शाम को मजदूरी दर्ज करें। कोई दिक्कत हो तो शिकायत — और हर बदलाव पर सूचना।" : "Morning: one tap to say you are safe. Evening: log your wage. Something wrong? File a complaint — and get notified at every step."}</p>
            <div className="hero-actions">
              <Link className="button" to="/join">{hi ? "श्रमिक के रूप में जुड़ें" : "Join as a Worker"}</Link>
              <Link className="button button-ghost" to="/how-it-works">{t.how}</Link>
            </div>
          </div>
          <div className="step-figure"><ArtWorker /></div>
        </div>
      </section>
      <TrustStrip lang={lang} />
    </main>
  );
}

/* ------------------------------------------------------------------
   For Organizations
   ------------------------------------------------------------------ */

function ForOrganizations({ lang }: { lang: Language }) {
  const hi = lang === "hi";
  const points = hi
    ? [
        ["श्रमिक केस मैनेज करें", "हर शिकायत एक व्यवस्थित इनबॉक्स में — प्राथमिकता-सुझाव समेत, फैसला हमेशा मानव केसवर्कर का।"],
        ["केसवर्कर सौंपें", "हर केस एक नामधारी केसवर्कर को — जिम्मेदारी साफ़, इतिहास दर्ज।"],
        ["शिकायत की स्थिति ट्रैक करें", "नया → सौंपा → काम चल रहा → हल — श्रमिक को हर बदलाव की सूचना मिलती है।"],
        ["प्रमाण सुरक्षित रखें", "फाइलें प्राइवेट, एन्क्रिप्टेड स्टोरेज में — मैलवेयर स्कैन के बाद ही खुलती हैं।"],
        ["जवाबी समय देखें", "औसत जवाबी समय और एस्कलेशन की स्थिति — संसाधन सही जगह लगाने के लिए।"],
        ["गुमनाम इम्पैक्ट रिपोर्ट बनाएं", "केवल समग्र आंकड़े — नाम, फोन, प्रमाण या ठिकाने कभी नहीं।"],
      ]
    : [
        ["Manage worker cases", "Every complaint in one organized inbox — with a suggested priority, where the final call always stays with a human caseworker."],
        ["Assign caseworkers", "Every case gets a named owner — clear responsibility, recorded history."],
        ["Track complaint status", "New → Assigned → In progress → Resolved — the worker is notified at every change."],
        ["Store evidence securely", "Files in private, encrypted storage — opened only after a malware scan."],
        ["Monitor response times", "Median response time and escalation status — so limited resources go where they matter."],
        ["Generate anonymized impact reports", "Aggregate counts only — names, phone numbers, evidence, and locations are never included."],
      ];
  return (
    <main>
      <section className="page-hero">
        <div className="wrap">
          <p className="kicker">{hi ? "संस्थाओं के लिए" : "FOR ORGANIZATIONS"}</p>
          <h1>{hi ? "भरोसेमंद जानकारी, तेज़ कार्रवाई।" : "Reliable information, faster action."}</h1>
          <p className="lede">{hi ? "Pehchaan NGO केसवर्कर्स को श्रमिकों की शिकायतें व्यवस्थित देता है — ताकि सीमित संसाधनों में सबसे ज़रूरी मामलों पर पहले ध्यान दिया जा सके।" : "Pehchaan gives NGO caseworkers organized worker complaints, so limited resources go to the most urgent cases first."}</p>
        </div>
      </section>
      <section className="section">
        <div className="wrap">
          <div className="info-grid">
            {points.map(([title, body], index) => (
              <article className={index % 3 === 0 ? "info-card sindoor-accent" : index % 3 === 1 ? "info-card accent" : "info-card leaf-accent"} key={title}>
                <h3>{title}</h3><p>{body}</p>
              </article>
            ))}
          </div>
          <div className="hero-actions" style={{ marginTop: 34 }}>
            <Link className="button" to="/join">{hi ? "पहचान के साथ साझेदार बनें" : "Partner with Pehchaan"}</Link>
            <Link className="button button-ghost" to="/ngo/login">{hi ? "संस्था लॉगिन" : "Organization login"}</Link>
          </div>
          <p className="helper" style={{ marginTop: 14 }}>{hi ? "नया खाता बनाने से पहले Pehchaan टीम हर आवेदन की जांच करती है। पायलट डेमो लॉगिन: ngo@pehchaan.org / demo" : "Every new NGO and employer application is verified by the Pehchaan team before an account goes live. Pilot demo login: ngo@pehchaan.org / demo"}</p>
        </div>
      </section>
      <TrustStrip lang={lang} />
    </main>
  );
}

/* ------------------------------------------------------------------
   Safety & Trust
   ------------------------------------------------------------------ */

function SafetyPage({ lang }: { lang: Language }) {
  const hi = lang === "hi";
  const points = hi
    ? [
        ["गोपनीयता-प्रथम डिज़ाइन", "रिकॉर्ड श्रमिक का अपना है — वह अपना पूरा डेटा PDF, CSV या JSON में कभी भी डाउनलोड कर सकता है।"],
        ["सहमति-आधारित साझाकरण", "नियोक्ता को केवल सहमत वेज रिकॉर्ड दिखते हैं — शिकायतें, प्रमाण, जांच या नोट्स कभी नहीं।"],
        ["सुरक्षित प्रमाण भंडार", "प्राइवेट बकेट, शॉर्ट-लाइव्ड साइन्ड URLs, मैलवेयर स्कैन — साफ़ होने तक फाइल सील।"],
        ["भूमिका-आधारित एक्सेस", "श्रमिक, NGO केसवर्कर, नियोक्ता और प्लेटफॉर्म टीम — हर कोई केवल अपनी भूमिका की जानकारी देखता है।"],
        ["श्रमिक पहचान का सार्वजनिक खुलासा नहीं", "रिपोर्ट्स में केवल समग्र आंकड़े — कोई नाम, फोन नंबर या ठिकाना कभी प्रकाशित नहीं होता।"],
        ["हाई-रिस्क मामलों में मानव सहायता", "तत्काल खतरे के अलर्ट 15 मिनट में स्वीकार न हों तो NGO admin तक अपने-आप बढ़ते हैं — हर अलर्ट एक इंसान तक पहुंचता है।"],
      ]
    : [
        ["Privacy-first design", "The record belongs to the worker — they can download their complete data as PDF, CSV, or JSON anytime."],
        ["Consent-based data sharing", "Employers see only consented wage records — never complaints, evidence, check-ins, or notes."],
        ["Secure evidence storage", "Private bucket, short-lived signed URLs, malware scanning — files stay sealed until clean."],
        ["Role-based access", "Workers, NGO caseworkers, employers, and the platform team each see only what their role allows."],
        ["No public exposure of worker identity", "Reports contain aggregate counts only — no names, phone numbers, or locations are ever published."],
        ["Human support for high-risk cases", "Urgent alerts unacknowledged for 15 minutes escalate automatically to an NGO admin — every alert reaches a person."],
      ];
  return (
    <main>
      <section className="page-hero">
        <div className="wrap">
          <p className="kicker">{hi ? "सुरक्षा और भरोसा" : "SAFETY & TRUST"}</p>
          <h1>{hi ? "आपकी जानकारी, आपकी शर्तों पर।" : "Your information, on your terms."}</h1>
          <p className="lede">{hi ? "पहचान की शुरुआत ही गोपनीयता से होती है — हर फीचर में, हर चरण पर।" : "Privacy is where Pehchaan starts — in every feature, at every step."}</p>
        </div>
      </section>
      <section className="section">
        <div className="wrap">
          <div className="info-grid">
            {points.map(([title, body]) => (
              <article className="info-card accent" key={title}><h3>{title}</h3><p>{body}</p></article>
            ))}
          </div>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="disclaimer-box">
            <h2>{hi ? "सीमाएं साफ़ शब्दों में" : "Clear limits, plainly stated"}</h2>
            <p>{hi ? DISCLAIMER_HI : DISCLAIMER_EN}</p>
          </div>
        </div>
      </section>
      <TrustStrip lang={lang} />
    </main>
  );
}

/* ------------------------------------------------------------------
   About
   ------------------------------------------------------------------ */

function AboutPage({ lang }: { lang: Language }) {
  const hi = lang === "hi";
  const [mission, setMission] = React.useState<string | null>(null);
  React.useEffect(() => {
    let alive = true;
    contentApi.page("about-mission")
      .then((page) => { if (alive) setMission(page.locales[lang]?.body || page.locales.en?.body || null); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [lang]);
  const impacts: Array<[string, string]> = hi
    ? [["—", "श्रमिक समर्थित"], ["—", "केस दर्ज"], ["—", "NGO साझेदार"], ["5", "भाषाएँ समर्थित"]]
    : [["—", "Workers supported"], ["—", "Cases documented"], ["—", "NGO partners"], ["5", "Languages supported"]];
  return (
    <main>
      <section className="page-hero">
        <div className="wrap">
          <p className="kicker">{hi ? "हमारे बारे में" : "ABOUT"}</p>
          <h1>{hi ? "हर श्रमिक की आवाज़, उसका अपना रिकॉर्ड।" : "Every worker's voice, their own record."}</h1>
          <p className="lede">{mission || (hi ? "पहचान प्रवासी और अनौपचारी श्रमिकों के लिए बनी है — जो अक्सर कई काम एक साथ करते हैं और जिनका कोई लिखित रिकॉर्ड नहीं होता। हम जानकारी व्यवस्थित करके भरोसेमंद संस्थाओं तक पहुंचाते हैं।" : "Pehchaan is built for migrant and informal workers who often hold several jobs at once and rarely have written records. We organize worker information and route it to trusted organizations.")}</p>
        </div>
      </section>
      <section className="section">
        <div className="wrap">
          <div className="info-grid">
            <article className="info-card sindoor-accent"><h3>{hi ? "श्रमिक का नियंत्रण" : "Worker control"}</h3><p>{hi ? "रिकॉर्ड श्रमिक का अपना है — कोई प्रोफ़ाइल आपके बिना काम नहीं कर सकती।" : "The record belongs to the worker — no profile works without its owner."}</p></article>
            <article className="info-card accent"><h3>{hi ? "सीमाएं साफ़" : "Clear limits"}</h3><p>{hi ? "हम बचाव नहीं करते, कानूनी प्रतिनिधित्व नहीं करते — सूचना व्यवस्थित करते हैं।" : "We do not rescue or provide legal representation — we organize information."}</p></article>
            <article className="info-card leaf-accent"><h3>{hi ? "गोपनीयता" : "Privacy"}</h3><p>{hi ? "प्रमाण एन्क्रिप्टेड स्टोरेज में, रिपोर्ट्स में केवल समग्र आंकड़े।" : "Evidence in encrypted storage, aggregate counts only in reports."}</p></article>
          </div>
        </div>
      </section>
      <section className="section band">
        <div className="wrap">
          <div className="section-head">
            <p className="kicker">{hi ? "असर" : "IMPACT"}</p>
            <h2>{hi ? "पायलट शुरू होने से पहले कोई दिखावटी आंकड़ा नहीं।" : "No vanity numbers before the pilot runs."}</h2>
          </div>
          <div className="impact-grid">
            {impacts.map(([num, label]) => (
              <div className="impact-card" key={label}><strong>{num}</strong><span>{label}</span></div>
            ))}
          </div>
          <p className="impact-note">{hi ? "पायलट मीट्रिक — लॉन्च के बाद अपडेट किए जाएंगे।" : "Pilot metrics — will be updated after launch."}</p>
        </div>
      </section>
    </main>
  );
}

/* ------------------------------------------------------------------
   Join the Pilot
   ------------------------------------------------------------------ */

function JoinPilot({ lang }: { lang: Language }) {
  const hi = lang === "hi";
  const [sent, setSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const faqs: Array<[string, string]> = hi
    ? [
        ["क्या Pehchaan श्रमिकों के लिए मुफ्त है?", "हां — श्रमिकों के लिए पहचान बिल्कुल मुफ्त है।"],
        ["क्या मेरी शिकायत निजी रहती है?", "जी हां। शिकायत केवल भरोसेमंद NGO केसवर्करों तक जाती है। नियोक्ता को कभी शिकायतें, प्रमाण या सुरक्षा जांच नहीं दिखते — केवल आपकी सहमति वाले वेज रिकॉर्ड।"],
        ["क्या मैं English के बिना Pehchaan इस्तेमाल कर सकता हूं?", "बिल्कुल — पूरा ऐप हिंदी, বাংলা, தமிழ் और తెలుగు समेत 5 भाषाओं में है, और बिना स्मार्टफोन के WhatsApp/SMS से भी काम चलता है।"],
        ["क्या Pehchaan कानूनी प्रतिनिधित्व देता है?", "नहीं। पहचान जानकारी व्यवस्थित करके भरोसेमंद संस्थाओं तक पहुंचाता है — यह बचाव, कानूनी प्रतिनिधित्व या निर्णय नहीं करता।"],
        ["क्या NGO Pehchaan से साझेदारी कर सकते हैं?", "हां। /join फॉर्म से NGO आवेदन करें — Pehchaan टीम सत्यापन के बाद खाता सक्रिय करती है।"],
        ["समस्या बताने के बाद क्या होता है?", "आपको केस नंबर मिलता है। एक इंसान केसवर्कर हर शिकायत देखता है, और आप हर स्थिति-बदलाव पर सूचना पाते हैं — प्राप्त, समीक्षा, कार्रवाई, हल।"],
      ]
    : [
        ["Is Pehchaan free for workers?", "Yes — Pehchaan is completely free for workers."],
        ["Is my complaint private?", "Yes. Complaints go only to trusted NGO caseworkers. Employers never see complaints, evidence, or check-ins — only wage records you consented to share."],
        ["Can I use Pehchaan without English?", "Absolutely — the whole app works in Hindi, Bengali, Tamil, Telugu, and English, and even without a smartphone over WhatsApp and SMS."],
        ["Does Pehchaan provide legal representation?", "No. Pehchaan organizes information and routes it to trusted organizations. It does not rescue, represent, or decide cases."],
        ["Can NGOs partner with Pehchaan?", "Yes. NGOs can apply through the join form — the Pehchaan team verifies and activates accounts after review."],
        ["What happens after I report a problem?", "You get a case number. A human caseworker reviews every complaint, and you are notified at every stage — received, under review, action taken, resolved."],
      ];
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    publicApi.pilotInterest({
      name: data.get("name"),
      role: data.get("role"),
      city: data.get("city"),
      contact: data.get("contact"),
      message: data.get("message"),
      consent: data.get("consent") === "on",
    })
      .then(() => { setSent(true); form.reset(); })
      .catch((cause) => setError(cause instanceof Error && cause.message ? cause.message : hi ? "फॉर्म भेजा नहीं जा सका। फिर कोशिश करें।" : "Could not send the form. Please try again."))
      .finally(() => setBusy(false));
  };
  return (
    <main>
      <section className="page-hero">
        <div className="wrap">
          <p className="kicker">{hi ? "पायलट से जुड़ें" : "JOIN THE PILOT"}</p>
          <h1>{hi ? "बताइए, कैसे जुड़ना चाहेंगे।" : "Tell us how you want to be part of it."}</h1>
          <p className="lede">{hi ? "हम उन NGO, श्रमिक समुदायों और नियोक्ताओं के साथ काम कर रहे हैं जो मजदूरी, सुरक्षा और बंधुआ मजदूरी के मामलों पर व्यवस्थित रिकॉर्डिंग चाहते हैं।" : "We are working with NGOs, worker communities, and employers who want organized records for wage, safety, and debt-bondage cases."}</p>
        </div>
      </section>
      <section className="section">
        <div className="wrap join-grid">
          <form className="join-form" onSubmit={submit}>
            {sent ? (
              <p className="success-note" role="status">Thank you. Our team will contact you about the Pehchaan pilot.</p>
            ) : (
              <>
                <label>{hi ? "नाम" : "Name"}
                  <input name="name" required autoComplete="name" />
                </label>
                <label>{hi ? "मैं हूं:" : "I am a:"}
                  <select name="role" required defaultValue="">
                    <option value="" disabled>{hi ? "चुनें" : "Select one"}</option>
                    <option value="worker">{hi ? "श्रमिक" : "Worker"}</option>
                    <option value="ngo">{hi ? "NGO" : "NGO"}</option>
                    <option value="employer">{hi ? "नियोक्ता" : "Employer"}</option>
                    <option value="partner">{hi ? "साझेदार" : "Partner"}</option>
                  </select>
                </label>
                <label>{hi ? "शहर या क्षेत्र" : "City or region"}
                  <input name="city" />
                </label>
                <label>{hi ? "फोन या ईमेल" : "Phone or email"}
                  <input name="contact" required />
                </label>
                <label>{hi ? "संदेश" : "Message"}
                  <textarea name="message" />
                </label>
                <label className="consent-row">
                  <input type="checkbox" name="consent" required />
                  <span>{hi ? "मैं सहमत हूं कि Pehchaan टीम पायलट के बारे में संपर्क करने के लिए यह जानकारी इस्तेमाल करे।" : "I agree that the Pehchaan team may use these details to contact me about the pilot."}</span>
                </label>
                {error && <p className="form-error">{error}</p>}
                <button className="button" disabled={busy}>{busy ? (hi ? "भेज रहे हैं…" : "Sending…") : (hi ? "पायलट से जुड़ें" : "Join the Pilot")}</button>
              </>
            )}
          </form>
          <aside>
            <div className="card">
              <h3>{hi ? "पायलट डेमो" : "Pilot demo"}</h3>
              <p>{hi ? "श्रमिक: OTP मोड में 123456 डालें। NGO: ngo@pehchaan.org / demo" : "Worker: use OTP 123456 in demo mode. NGO: ngo@pehchaan.org / demo"}</p>
              <p><Link className="text-link" to="/worker/login">{hi ? "श्रमिक लॉगिन →" : "Worker login →"}</Link></p>
            </div>
          </aside>
        </div>
      </section>
      <section className="section band">
        <div className="wrap">
          <div className="section-head">
            <p className="kicker">FAQ</p>
            <h2>{hi ? "अक्सर पूछे जाने वाले सवाल" : "Frequently asked questions"}</h2>
          </div>
          <div className="faq-list">
            {faqs.map(([q, a]) => (
              <details className="faq-item" key={q}>
                <summary>{q}</summary>
                <p className="faq-body">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

/* ------------------------------------------------------------------
   Shared labels (nav + CTAs)
   ------------------------------------------------------------------ */

const labels: Record<Language, { how: string; workers: string; orgs: string; safety: string; about: string; join: string }> = {
  hi: { how: "यह कैसे काम करता है", workers: "श्रमिकों के लिए", orgs: "संस्थाओं के लिए", safety: "सुरक्षा", about: "हमारे बारे में", join: "पायलट से जुड़ें" },
  en: { how: "How It Works", workers: "For Workers", orgs: "For Organizations", safety: "Safety", about: "About", join: "Join the Pilot" },
  bn: { how: "যেভাবে কাজ করে", workers: "শ্রমিকদের জন্য", orgs: "সংস্থার জন্য", safety: "নিরাপত্তা", about: "আমাদের সম্পর্কে", join: "পাইলটে যোগ দিন" },
  ta: { how: "இது எப்படி செயல்படுகிறது", workers: "தொழிலாளர்களுக்கு", orgs: "நிறுவனங்களுக்கு", safety: "பாதுகாப்பு", about: "எங்களைப் பற்றி", join: "முன்முயற்சியில் சேருங்கள்" },
  te: { how: "ఇది ఎలా పనిచేస్తుంది", workers: "కార్మికుల కోసం", orgs: "సంస్థల కోసం", safety: "భద్రత", about: "మా గురించి", join: "పైలట్‌లో చేరండి" },
};

export { Navbar, Footer, PublicHome, HowItWorks, ForWorkers, ForOrganizations, SafetyPage, AboutPage, JoinPilot };
