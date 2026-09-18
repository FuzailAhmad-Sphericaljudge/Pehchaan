import React from "react";
import { motion } from "framer-motion";
import { Link, Route, Routes } from "react-router-dom";

// Replace these three URLs with approved local/desi photos when the final assets are ready.
const photos = {
  hero: "https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=1800&q=80",
  worker: "https://images.unsplash.com/photo-1521791055366-0d553872125f?auto=format&fit=crop&w=900&q=80",
  community: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=80",
};

const hi = {
  join: "पायलट से जुड़ें",
  nav: ["यह कैसे काम करता है", "श्रमिकों के लिए", "संस्थाओं के लिए", "सुरक्षा", "हमारे बारे में"],
  heroEyebrow: "सुरक्षित भविष्य की शुरुआत अपनी बात कहने से होती है",
  tagline: "हर श्रमिक सुरक्षित कल का हकदार है",
  intro: "पहचान प्रवासी श्रमिकों को अपनी मजदूरी सुरक्षित रखने, असुरक्षित परिस्थितियों की सूचना देने और भरोसेमंद सहायता से जुड़ने में मदद करता है — निजी और सुरक्षित तरीके से।",
  learn: "जानें, यह कैसे काम करता है",
  private: "डिफ़ॉल्ट रूप से निजी।",
  consent: "आपकी अनुमति के बिना कुछ साझा नहीं किया जाता।",
  reality: "हकीकत",
  realityTitle: "मेहनत पूरी, सुरक्षा अधूरी।",
  realityBody: "श्रमिक हमारे शहरों को चलाने में बड़ी भूमिका निभाते हैं। पहचान रिकॉर्ड रखने, सहायता मांगने और सम्मान के साथ आगे बढ़ने को आसान बनाता है।",
  cards: [
    ["मजदूरी जो कभी नहीं मिलती", "काम पूरा हो जाता है, लेकिन भुगतान देर से मिलता है, कम मिलता है या मिलता ही नहीं।"],
    ["काम की शर्तें साफ नहीं होतीं", "समय, दर और शर्तें अक्सर मौखिक होती हैं, इसलिए श्रमिक के पास प्रमाण कम रह जाता है।"],
    ["असुरक्षित कार्यस्थल", "सुरक्षा उपकरणों की कमी, ऊंचाई पर असुरक्षित काम और लंबे समय की शिफ्ट जोखिम बढ़ाती हैं।"],
  ],
  simple: "सरल सोच के साथ",
  recordTitle: "एक रिकॉर्ड, जो आपके साथ रहे।",
  recordBody: "नई जगह काम शुरू करने से लेकर भरोसेमंद संस्था से बात करने तक, आपकी जरूरी जानकारी एक सुरक्षित जगह पर व्यवस्थित रहती है।",
  workerLink: "श्रमिक सहायता देखें →",
  how: "यह कैसे काम करता है",
  stepsTitle: "चार कदम। अधिक भरोसा।",
  steps: ["निजी प्रोफाइल बनाएं", "मजदूरी और परिस्थितियां दर्ज करें", "सुरक्षित तरीके से समस्या बताएं", "भरोसेमंद सहायता से जुड़ें"],
  stepBody: "साफ, सरल और रोजमर्रा के मोबाइल के लिए बनाया गया।",
  support: "आपकी वास्तविक जरूरतों को समझने वाली सहायता।",
  joinPilot: "पायलट में शामिल हों →",
  footerTagline: "हर श्रमिक सुरक्षित कल का हकदार है।",
};

const pageContent = {
  "/how-it-works": ["पहचान का तरीका", "चिंता से सहायता तक एक साफ रास्ता।", "पहचान श्रमिक की यात्रा के छोटे लेकिन जरूरी पलों को एक निजी और सरल जगह पर लाता है।", ["कुछ कदमों में निजी श्रमिक प्रोफाइल बनाएं।", "वादा की गई और मिली मजदूरी दर्ज करें।", "अपनी पसंद के अनुसार समस्या की जानकारी दें।", "भरोसेमंद NGO या सहायता संस्था से जुड़ें।"], photos.community],
  "/for-workers": ["श्रमिकों के लिए", "आपका काम। आपका रिकॉर्ड। आपके अधिकार।", "सरल मोबाइल इंटरफेस, बड़े बटन, क्षेत्रीय भाषा की सहायता और रोजमर्रा की जरूरतों के लिए बनाया गया सुरक्षित मंच।", ["बड़े बटन और कम कदम, सामान्य स्मार्टफोन के लिए।", "आपकी अनुमति के बिना रिकॉर्ड साझा नहीं किया जाता।", "मजदूरी, सुरक्षा जांच, शिकायत और सहायता एक ही जगह।"], photos.worker],
  "/for-organizations": ["संस्थाओं के लिए", "हर मामले को अगले साफ कदम में बदलें।", "NGO और सामाजिक संस्थाएं श्रमिकों के मामले संभाल सकती हैं, सहायता सौंप सकती हैं और जरूरी प्रमाण सुरक्षित रख सकती हैं।", ["श्रमिकों के मामले संभालें और केसवर्कर नियुक्त करें।", "शिकायत की स्थिति और प्रतिक्रिया का समय देखें।", "प्रमाण सुरक्षित रखें और पहचान छिपाकर रिपोर्ट बनाएं।"], photos.community],
  "/safety": ["सुरक्षा और भरोसा", "पहचान लोगों को उजागर नहीं, सुरक्षित रखता है।", "पहचान आपातकालीन सेवाओं, पुलिस, अदालत या श्रम विभाग की जगह नहीं लेता। यह श्रमिकों और भरोसेमंद संस्थाओं को जानकारी व्यवस्थित करने और सहायता तक पहुंचने में मदद करता है।", ["निजता को प्राथमिकता और सहमति से जानकारी साझा करना।", "सुरक्षित प्रमाण भंडारण और भूमिका-आधारित पहुंच।", "श्रमिक की पहचान सार्वजनिक रूप से साझा नहीं की जाती।", "ज्यादा जोखिम वाले मामलों में मानवीय सहायता।"], photos.hero],
  "/about": ["पहचान के बारे में", "सम्मान हर कामकाजी दिन का हिस्सा होना चाहिए।", "पहचान प्रवासी और असंगठित श्रमिकों, NGO, जिम्मेदार नियोक्ताओं और सुरक्षित काम के लिए साथ आने वाले सहयोगियों के लिए है।", ["सहायता प्राप्त श्रमिक — पायलट के बाद अपडेट होगा।", "दर्ज किए गए मामले — पायलट के बाद अपडेट होगा।", "NGO सहयोगी — पायलट के बाद अपडेट होगा।", "समर्थित भाषाएं — पायलट के बाद अपडेट होगा।"], photos.community],
};

function Navbar({ english, setEnglish }: { english: boolean; setEnglish: (value: boolean) => void }) {
  const labels = english ? ["How It Works", "For Workers", "For Organizations", "Safety", "About"] : hi.nav;
  return <header className="navbar">
    <Link className="brand" to="/">Pehchaan<span>.</span></Link>
    <nav>{["/how-it-works", "/for-workers", "/for-organizations", "/safety", "/about"].map((path, i) => <Link key={path} to={path}>{labels[i]}</Link>)}</nav>
    <div className="nav-actions"><button className="language" onClick={() => setEnglish(!english)}>{english ? "हिंदी" : "EN"} <span>↔</span></button><Link className="button button-small" to="/join">{english ? "Join the Pilot" : hi.join}</Link></div>
  </header>;
}

function Footer() {
  return <footer><div><Link className="brand" to="/">Pehchaan<span>.</span></Link><p>{hi.footerTagline}</p></div><div className="footer-links"><Link to="/about">हमारे बारे में</Link><Link to="/safety">निजता और सुरक्षा</Link><Link to="/join">संपर्क</Link><span>Instagram · LinkedIn</span></div></footer>;
}

function Shell({ children, english, setEnglish }: { children: React.ReactNode; english: boolean; setEnglish: (value: boolean) => void }) {
  return <><Navbar english={english} setEnglish={setEnglish} />{children}<Footer /></>;
}

function Home() {
  return <main>
    <section className="hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(8,32,46,.9), rgba(8,32,46,.3)), url(${photos.hero})` }}>
      <div className="hero-content"><p className="eyebrow">{hi.heroEyebrow}</p><h1>{hi.tagline}</h1><p className="hero-copy">{hi.intro}</p><div className="hero-actions"><Link className="button" to="/join">{hi.join} <span>→</span></Link><Link className="button button-ghost" to="/how-it-works">{hi.learn}</Link></div></div>
      <div className="hero-note"><strong>{hi.private}</strong><br />{hi.consent}</div>
    </section>
    <section className="section reality"><div className="section-heading"><p className="eyebrow coral">{hi.reality}</p><h2>{hi.realityTitle}</h2><p>{hi.realityBody}</p></div><div className="card-grid">{hi.cards.map(([title, body], i) => <motion.article whileHover={{ y: -6 }} className={`feature-card tone-${i}`} key={title}><span className="card-number">0{i + 1}</span><h3>{title}</h3><p>{body}</p><span className="card-arrow">↗</span></motion.article>)}</div></section>
    <section className="section split"><div className="image-card" style={{ backgroundImage: `url(${photos.worker})` }} /><div><p className="eyebrow teal">{hi.simple}</p><h2>{hi.recordTitle}</h2><p>{hi.recordBody}</p><Link className="text-link" to="/for-workers">{hi.workerLink}</Link></div></section>
    <section className="steps section"><div className="section-heading"><p className="eyebrow green">{hi.how}</p><h2>{hi.stepsTitle}</h2></div><div className="step-row">{hi.steps.map((step, i) => <div className="step" key={step}><span>{i + 1}</span><h3>{step}</h3><p>{hi.stepBody}</p></div>)}</div></section>
  </main>;
}

function ContentPage({ content }: { content: string[] }) {
  const [eyebrow, title, body, bullets, image] = content;
  return <main><section className="page-hero"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{body}</p></section><section className="section split content-split"><div className="image-card tall" style={{ backgroundImage: `url(${image})` }} /><div><h2>{hi.support}</h2><ul className="check-list">{bullets.map((item) => <li key={item}>✓ <span>{item}</span></li>)}</ul><Link className="button" to="/join">{hi.joinPilot}</Link></div></section></main>;
}

function Join() {
  const [submitted, setSubmitted] = React.useState(false);
  return <main><section className="page-hero"><p className="eyebrow coral">बातचीत की शुरुआत</p><h1>पहचान के पायलट से जुड़ें।</h1><p>अपने या अपनी संस्था के बारे में थोड़ी जानकारी दें। हमारी टीम पायलट के बारे में आपसे संपर्क करेगी।</p></section><section className="section form-section"><form onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}><div className="form-grid"><label>नाम<input required /></label><label>मैं हूं<select><option>श्रमिक</option><option>NGO</option><option>नियोक्ता</option><option>सहयोगी</option></select></label><label>शहर या क्षेत्र<input required /></label><label>फोन या ईमेल<input required /></label></div><label>संदेश<textarea rows={5} placeholder="पहचान आपकी कैसे सहायता कर सकता है?" /></label><label className="consent"><input required type="checkbox" /> मैं सहमत हूं कि पहचान टीम पायलट के बारे में मुझसे संपर्क कर सकती है।</label><button className="button" type="submit">अपनी रुचि भेजें →</button>{submitted && <p className="success">धन्यवाद। हमारी टीम पहचान पायलट के बारे में आपसे संपर्क करेगी।</p>}</form><aside><p className="eyebrow teal">सवाल</p><h2>जानना जरूरी है।</h2>{["क्या पहचान श्रमिकों के लिए मुफ्त है?", "क्या मेरी शिकायत निजी रहेगी?", "क्या मैं अंग्रेजी के बिना पहचान इस्तेमाल कर सकता हूं?", "क्या पहचान कानूनी प्रतिनिधित्व देता है?", "NGO पहचान के साथ कैसे जुड़ सकता है?"].map((q) => <details key={q}><summary>{q}</summary><p>पायलट की बातचीत में हम आपको यह बात सरल भाषा में समझाएंगे।</p></details>)}</aside></section></main>;
}

function App() {
  const [english, setEnglish] = React.useState(false);
  const toggleLanguage = (value: boolean) => { setEnglish(value); localStorage.setItem("pehchaan-language", value ? "en" : "hi"); };
  return <Shell english={english} setEnglish={toggleLanguage}><Routes>
    <Route path="/" element={<Home />} />
    {Object.entries(pageContent).map(([path, content]) => <Route key={path} path={path} element={<ContentPage content={content} />} />)}
    <Route path="/join" element={<Join />} />
  </Routes></Shell>;
}

export default App;
