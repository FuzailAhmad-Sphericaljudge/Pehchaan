import React from "react";
import { motion } from "framer-motion";
import { Link, Route, Routes } from "react-router-dom";

const photos = {
  hero: "https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=1800&q=80",
  worker: "https://images.unsplash.com/photo-1521791055366-0d553872125f?auto=format&fit=crop&w=900&q=80",
  community: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=80",
};

const copy = {
  en: {
    tagline: "Every Worker Deserves a Safer Tomorrow",
    intro: "Pehchaan helps migrant workers protect their wages, report unsafe conditions, and connect with trusted support — privately and safely.",
    join: "Join the Pilot",
    learn: "Learn How It Works",
  },
  hi: {
    tagline: "हर वर्कर की पहचान, सुरक्षित कल की शुरुआत।",
    intro: "पहचान प्रवासी श्रमिकों को अपनी मजदूरी सुरक्षित रखने, असुरक्षित परिस्थितियों की सूचना देने और भरोसेमंद सहायता से जुड़ने में मदद करता है।",
    join: "पायलट से जुड़ें",
    learn: "यह कैसे काम करता है",
  },
};

function Navbar({ hindi, setHindi }: { hindi: boolean; setHindi: (value: boolean) => void }) {
  return (
    <header className="navbar">
      <Link className="brand" to="/">Pehchaan<span>.</span></Link>
      <nav>
        <Link to="/how-it-works">How It Works</Link>
        <Link to="/for-workers">For Workers</Link>
        <Link to="/for-organizations">For Organizations</Link>
        <Link to="/safety">Safety</Link>
        <Link to="/about">About</Link>
      </nav>
      <div className="nav-actions">
        <button className="language" onClick={() => setHindi(!hindi)}>{hindi ? "हिंदी" : "EN"} <span>↔</span></button>
        <Link className="button button-small" to="/join">{hindi ? copy.hi.join : copy.en.join}</Link>
      </div>
    </header>
  );
}

function Footer() {
  return <footer><div><Link className="brand" to="/">Pehchaan<span>.</span></Link><p>Every worker deserves a safer tomorrow.</p></div><div className="footer-links"><Link to="/about">About</Link><Link to="/safety">Privacy & safety</Link><Link to="/join">Contact</Link><span>Instagram · LinkedIn</span></div></footer>;
}

function Shell({ children, hindi, setHindi }: { children: React.ReactNode; hindi: boolean; setHindi: (value: boolean) => void }) {
  return <><Navbar hindi={hindi} setHindi={setHindi} />{children}<Footer /></>;
}

function Home({ hindi }: { hindi: boolean }) {
  const text = hindi ? copy.hi : copy.en;
  return <main>
    <section className="hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(8,32,46,.9), rgba(8,32,46,.3)), url(${photos.hero})` }}>
      <div className="hero-content"><p className="eyebrow">A safer future starts with being heard</p><h1>{text.tagline}</h1><p className="hero-copy">{text.intro}</p><div className="hero-actions"><Link className="button" to="/join">{text.join} <span>→</span></Link><Link className="button button-ghost" to="/how-it-works">{text.learn}</Link></div></div>
      <div className="hero-note"><strong>Private by default.</strong><br />Shared only with your consent.</div>
    </section>
    <section className="section reality"><div className="section-heading"><p className="eyebrow coral">The reality</p><h2>Hard work, but very little protection.</h2><p>Workers keep our cities moving. Pehchaan makes it easier to keep a clear record, ask for help, and move forward with dignity.</p></div><div className="card-grid">{[["Wages that never arrive","Work is finished, but payment is delayed, reduced, or never made."],["Unclear employment terms","Hours, rate, and conditions are agreed verbally, leaving workers with little proof."],["Unsafe worksites","Missing safety gear, unsafe heights, and long shifts can put a job at risk."]].map(([title, body], i) => <motion.article whileHover={{ y: -6 }} className={`feature-card tone-${i}`} key={title}><span className="card-number">0{i + 1}</span><h3>{title}</h3><p>{body}</p><span className="card-arrow">↗</span></motion.article>)}</div></section>
    <section className="section split"><div className="image-card" style={{ backgroundImage: `url(${photos.worker})` }} /><div><p className="eyebrow teal">Simple by design</p><h2>A record you can carry with you.</h2><p>From the first day at a new worksite to a conversation with a trusted organization, your important details stay organized in one place.</p><Link className="text-link" to="/for-workers">Explore worker support →</Link></div></section>
    <section className="steps section"><div className="section-heading"><p className="eyebrow green">How it works</p><h2>Four steps. More confidence.</h2></div><div className="step-row">{["Create a private profile","Track wages & conditions","Report a problem safely","Connect with trusted support"].map((step, i) => <div className="step" key={step}><span>{i + 1}</span><h3>{step}</h3><p>Clear, simple, and made for everyday phones.</p></div>)}</div></section>
  </main>;
}

function ContentPage({ title, eyebrow, body, image, bullets }: { title: string; eyebrow: string; body: string; image: string; bullets: string[] }) {
  return <main><section className="page-hero"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{body}</p></section><section className="section split content-split"><div className="image-card tall" style={{ backgroundImage: `url(${image})` }} /><div><h2>Support that respects your reality.</h2><ul className="check-list">{bullets.map((item) => <li key={item}>✓ <span>{item}</span></li>)}</ul><Link className="button" to="/join">Join the pilot →</Link></div></section></main>;
}

function Join() {
  const [submitted, setSubmitted] = React.useState(false);
  return <main><section className="page-hero"><p className="eyebrow coral">Start a conversation</p><h1>Join the Pehchaan pilot.</h1><p>Tell us a little about yourself or your organization. Our team will contact you about the pilot.</p></section><section className="section form-section"><form onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}><div className="form-grid"><label>Name<input required /></label><label>I am a<select><option>Worker</option><option>NGO</option><option>Employer</option><option>Partner</option></select></label><label>City or region<input required /></label><label>Phone or email<input required /></label></div><label>Message<textarea rows={5} placeholder="How can Pehchaan support you?" /></label><label className="consent"><input required type="checkbox" /> I agree that the Pehchaan team may contact me about the pilot.</label><button className="button" type="submit">Send my interest →</button>{submitted && <p className="success">Thank you. Our team will contact you about the Pehchaan pilot.</p>}</form><aside><p className="eyebrow teal">Questions</p><h2>Good to know.</h2>{["Is Pehchaan free for workers?","Is my complaint private?","Can I use Pehchaan without English?","Does Pehchaan provide legal representation?"].map((q) => <details key={q}><summary>{q}</summary><p>We will explain this clearly during the pilot conversation.</p></details>)}</aside></section></main>;
}

function App() {
  const [hindi, setHindi] = React.useState(() => localStorage.getItem("pehchaan-language") === "hi");
  const toggleHindi = (value: boolean) => { setHindi(value); localStorage.setItem("pehchaan-language", value ? "hi" : "en"); };
  return <Shell hindi={hindi} setHindi={toggleHindi}><Routes>
    <Route path="/" element={<Home hindi={hindi} />} />
    <Route path="/how-it-works" element={<ContentPage eyebrow="The Pehchaan way" title="A clear path from concern to support." body="Pehchaan brings the small but important moments of a worker's journey into one private, simple place." image={photos.community} bullets={["Create a private worker profile in a few steps.","Keep track of promised wages, received wages, and conditions.","Report a problem with the level of detail you choose.","Connect with a trusted NGO or support organization."]} />} />
    <Route path="/for-workers" element={<ContentPage eyebrow="For workers" title="Your work. Your records. Your rights." body="A simple mobile interface, large buttons, regional-language assistance, and support that works for real life." image={photos.worker} bullets={["Large buttons and few steps for basic smartphones.","Your records stay private unless you choose to share them.","Use wage tracking, check-ins, complaints, and support in one place."]} />} />
    <Route path="/for-organizations" element={<ContentPage eyebrow="For organizations" title="Turn every case into a clearer next step." body="NGOs and social organizations can manage worker cases, assign support, protect evidence, and understand where response is needed." image={photos.community} bullets={["Manage worker cases and assign caseworkers.","Track complaint status and response times.","Store evidence securely and create anonymized reports."]} />} />
    <Route path="/safety" element={<ContentPage eyebrow="Safety & trust" title="Built around consent, not exposure." body="Pehchaan does not replace emergency services, police, courts, or labour departments. It helps workers and trusted organizations organize information and access support more effectively." image={photos.hero} bullets={["Privacy-first design and consent-based sharing.","Secure evidence storage and role-based access.","No public exposure of worker identity.","Human support for high-risk cases."]} />} />
    <Route path="/about" element={<ContentPage eyebrow="About Pehchaan" title="Dignity should be part of every workday." body="Pehchaan is for migrant and informal workers, NGOs, responsible employers, and partners who want safer, clearer ways to support work." image={photos.community} bullets={["Workers supported — pilot metric to be updated after launch.","Cases documented — pilot metric to be updated after launch.","NGO partners — pilot metric to be updated after launch.","Languages supported — pilot metric to be updated after launch."]} />} />
    <Route path="/join" element={<Join />} />
  </Routes></Shell>;
}

export default App;
