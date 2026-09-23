import React from "react";
import { motion } from "framer-motion";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { ApiError, authApi, CaseDetail, contentApi, Dashboard, downloadWorkerData, employerApi, evidenceApi, Language, legalDocumentApi, minimumWageApi, ngoApi, NgoCase, notificationApi, platformApi, schemeApi, TrustedContact, trustedContactApi, WorkRelationship, workerApi, workRelationshipApi } from "./api";
import { addOfflineItem, listOfflineItems, OfflineItem, removeOfflineItem, updateOfflineItem } from "./offline";
import { disablePush, enablePush, pushSupported } from "./push";

const baseLabels = {
  hi: {
    home: "मुख्य पृष्ठ", how: "यह कैसे काम करता है", workers: "श्रमिकों के लिए", orgs: "संस्थाओं के लिए", safety: "सुरक्षा", about: "हमारे बारे में", join: "पायलट से जुड़ें",
    login: "श्रमिक लॉगिन", phone: "मोबाइल नंबर", sendOtp: "OTP भेजें", otp: "OTP डालें", verify: "सत्यापित करें", demo: "डेमो OTP: 123456", dashboard: "मेरा डैशबोर्ड", wages: "मजदूरी", checkin: "सुरक्षा जांच", complaint: "समस्या बताएं", cases: "मेरे मामले", logout: "लॉग आउट", confirmLogout: "क्या आप लॉग आउट करना चाहते हैं?", emergencyDisclaimer: "Pehchaan does not replace emergency services, police, courts, or labour departments. It helps workers and trusted organizations organize information and access support more effectively.", emergencyNumber: "तत्काल खतरे में 112 पर कॉल करें।",
    promised: "वादा की गई रकम", received: "मिली रकम", date: "तारीख", note: "काम/नियोक्ता का नोट", save: "सहेजें", safe: "मैं सुरक्षित हूं", help: "मुझे मदद चाहिए", summary: "समस्या का विवरण", type: "समस्या का प्रकार", submit: "भेजें", loading: "लोड हो रहा है...", retry: "फिर कोशिश करें", offline: "आप ऑफलाइन दिख रहे हैं। कनेक्शन आने पर यह काम अपने आप दोबारा कोशिश होगा।", error: "जानकारी लोड नहीं हो सकी। कृपया कनेक्शन जांचकर फिर कोशिश करें।", pending: "भेजने की कतार में", noData: "अभी कोई जानकारी नहीं है।", listen: "सुनें", stopListening: "रोकें", speakComplaint: "बोलकर समस्या बताएं", listening: "सुन रहा हूं...", voiceUnavailable: "इस डिवाइस में आवाज़ की सुविधा उपलब्ध नहीं है। आप लिखकर जारी रख सकते हैं।", voiceGuide: "आवाज़ में मदद", voiceGuideText: "पहले अपना मोबाइल नंबर डालें। फिर OTP बोलकर या लिखकर सत्यापित करें।", waitingSync: "सिंक होने का इंतज़ार", syncFailed: "सिंक नहीं हो सका। लॉगिन जांचें और फिर कोशिश करें।",
    schemes: "आपके लिए योजनाएं", schemesNote: "आप इन सरकारी योजनाओं के लिए पात्र हो सकते हैं। यह पक्की पात्रता नहीं है — आवेदन से पहले आधिकारिक स्रोत ज़रूर जांचें।", schemesEmpty: "अभी कोई संभावित योजना नहीं मिली। अपना राज्य, उम्र और काम की श्रेणी मेरी प्रोफ़ाइल में भरें ताकि हम सुझाव दे सकें।", schemesProfileHint: "अपना राज्य, उम्र और काम की श्रेणी भरें ताकि आपके लिए उपयुक्त योजनाएं दिख सकें।", whoQualifies: "कौन पात्र हो सकता है", howToStart: "कैसे शुरू करें", officialLink: "आधिकारिक जानकारी", profile: "मेरी प्रोफ़ाइल", profileNote: "यह जानकारी केवल आपके लिए संभावित सरकारी योजनाएं सुझाने के काम आती है। कोई भी जानकारी खाली छोड़ सकते हैं।", state: "राज्य", age: "उम्र", workCategory: "काम की श्रेणी", profileSaved: "प्रोफ़ाइल सहेज ली गई।",
    workRelationships: "काम के रिश्ते", workRelationshipsNote: "आप एक साथ कई काम कर सकते हैं — हर काम/नियोक्ता का अलग रिकॉर्ड रखें ताकि हर एक की कमाई और शिकायत अलग-अलग ट्रैक हो।", addRelationship: "नया काम जोड़ें", relLabel: "काम का नाम", relLabelHint: "जैसे: शाम की डिलीवरी", employerName: "नियोक्ता (वैकल्पिक)", siteName: "साइट/जगह (वैकल्पिक)", relCategory: "काम की श्रेणी (वैकल्पिक)", startedOn: "शुरू कब किया", activeRel: "चालू", endedRel: "बंद", endRel: "यह काम खत्म हो गया", reopenRel: "दोबारा चालू करें", relHistoryNote: "बंद किए गए काम भी आपके रिकॉर्ड में सुरक्षित रहते हैं — आप बाद में उन पर शिकायत कर सकते हैं।", relSaved: "काम का रिकॉर्ड सहेज लिया गया।", whichJob: "किस काम/नियोक्ता के बारे में है?", whichJobOptional: "किस काम/नियोक्ता के बारे में है? (वैकल्पिक)", selectJob: "कोई काम चुनें", totalIncome: "कुल कमाई", incomeByJob: "काम के हिसाब से कमाई", unlinkedIncome: "बिना लेबल वाली कमाई", forComplaint: "शिकायत के लिए",
    contacts: "भरोसेमंद संपर्क", contactsNote: "आपात स्थिति में इन संपर्कों को सूचना भेजी जाएगी। हर संपर्क को आपकी सहमति के बाद ही इस्तेमाल किया जाएगा।", addContact: "संपर्क जोड़ें", contactName: "नाम", contactPhone: "मोबाइल नंबर", contactRelation: "रिश्ता (वैकल्पिक)", contactRelationHint: "जैसे: भाई, पत्नी, मित्र", pendingContact: "पुष्टि बाकी", confirmedContact: "पुष्ट", confirmContact: "पुष्ट करें", contactConfirmText: "क्या आप पुष्ट करते हैं कि यह व्यक्ति आपकी आपात स्थिति की सूचना पाने के लिए सहमत है?", testContact: "टेस्ट अलर्ट भेजें", testSent: "टेस्ट संदेश भेज दिया गया।", editContact: "बदलें", removeContact: "हटाएं", contactRemoved: "संपर्क हटा दिया गया।", contactLimit: "अधिकतम 5 संपर्क जोड़ सकते हैं।", contactsEmpty: "अभी कोई संपर्क नहीं।", contactsEmergencyNote: "यह सुविधा आपात सेवाओं (112) का विकल्प नहीं है।",    downloadData: "मेरा डेटा डाउनलोड करें", downloadDataNote: "अपनी मजदूरी, सुरक्षा जांच और शिकायतों का पूरा रिकॉर्ड डाउनलोड करें — PDF, CSV या JSON में। यह आपका अपना रिकॉर्ड है; किसी की अनुमति ज़रूरी नहीं।", downloadPdf: "PDF", downloadCsv: "CSV", downloadJson: "JSON", downloadStarted: "डाउनलोड शुरू।", downloadFailed: "डाउनलोड नहीं हो सका। फिर कोशिश करें।", exportContactsHeading: "भरोसेमंद संपर्क", exportProfileHeading: "मेरी प्रोफ़ाइल",
    debtOption: "अग्रिम/बंधुआ मजदूरी की समस्या", debtExplainerTitle: "बंधुआ मजदूरी क्या है?", debtExplainer: "अगर किसी ने काम शुरू करने से पहले आपको अग्रिम पैसा या कर्ज़ दिया, और अब आपको काम छोड़ने नहीं दे रहे, मजदूरी रोक रखे हैं या आपकी चाल-ढाल सीमित कर दी है — तो यह बंधुआ मजदूरी है। भारत में यह गैरकानूनी है। आप अकेले नहीं हैं — इसकी जानकारी देना पूरी तरह आपका अधिकार है।", debtQ1: "काम शुरू करने से पहले अग्रिम/कर्ज़ लिया था?", debtQ2: "आपको कहा जा रहा है कि कर्ज़ चुकाए बिना काम छोड़ नहीं सकते?", debtQ3: "कर्ज़ 'चुकाने' के लिए मजदूरी रोकी या कम की जा रही है?", debtQ4: "आपकी आने-जाने की आज़ादी सीमित की गई है?", debtDisclaimer: "पहचान यह जानकारी व्यवस्थित करके भरोसेमंद संस्थाओं तक पहुंचाती है — यह खुद बचाव नहीं करता और ना ही कानूनी प्रतिनिधित्व करता है। तत्काल खतरे में 112 पर कॉल करें।", debtAlertNote: "यह रिपोर्ट सीधे तौर पर ज़रूरी मामला मानकर भेजी जाएगी — NGO टीम को तुरंत सूचना मिलेगी।",
  },
  en: {
    home: "Home", how: "How It Works", workers: "For Workers", orgs: "For Organizations", safety: "Safety", about: "About", join: "Join the Pilot",
    login: "Worker login", phone: "Mobile number", sendOtp: "Send OTP", otp: "Enter OTP", verify: "Verify", demo: "Demo OTP: 123456", dashboard: "My dashboard", wages: "Wages", checkin: "Safety check-in", complaint: "Report a problem", cases: "My cases", logout: "Log out", confirmLogout: "Do you want to log out?", emergencyDisclaimer: "Pehchaan does not replace emergency services, police, courts, or labour departments. It helps workers and trusted organizations organize information and access support more effectively.", emergencyNumber: "If you are in immediate danger, call 112.",
    promised: "Promised amount", received: "Received amount", date: "Date", note: "Employer/site note", save: "Save", safe: "I'm safe", help: "I need help", summary: "Problem summary", type: "Problem type", submit: "Submit", loading: "Loading...", retry: "Try again", offline: "You appear to be offline. This will retry automatically when your connection returns.", error: "Could not load your information. Please check your connection and try again.", pending: "Queued to send", noData: "Nothing here yet.", listen: "Listen", stopListening: "Stop", speakComplaint: "Describe by voice", listening: "Listening...", voiceUnavailable: "Voice is not available on this device. You can continue by typing.", voiceGuide: "Voice help", voiceGuideText: "Enter your mobile number first. Then speak or type the OTP to verify.", waitingSync: "Waiting to sync", syncFailed: "Sync failed. Check your login and try again.",
    schemes: "Schemes for you", schemesNote: "You may be eligible for these government schemes. This is not a guarantee — always check the official source before applying.", schemesEmpty: "No possible matches yet. Add your state, age, and work category in My profile so we can suggest schemes.", schemesProfileHint: "Add your state, age, and work category to see schemes that may fit you.", whoQualifies: "Who may qualify", howToStart: "How to start", officialLink: "Official information", profile: "My profile", profileNote: "Used only to suggest government schemes you may be eligible for. You can leave any field blank.", state: "State", age: "Age", workCategory: "Work category", profileSaved: "Profile saved.",
    workRelationships: "Work relationships", workRelationshipsNote: "You can work several jobs at once. Keep a separate record for each job/employer so income and complaints are tracked for each one.", addRelationship: "Add a work relationship", relLabel: "Work name", relLabelHint: "e.g. Evening delivery gig", employerName: "Employer (optional)", siteName: "Site/location (optional)", relCategory: "Work category (optional)", startedOn: "Started on", activeRel: "Active", endedRel: "Ended", endRel: "This work has ended", reopenRel: "Reactivate", relHistoryNote: "Ended work stays in your records so you can refer to it or file a complaint later.", relSaved: "Work relationship saved.", whichJob: "Which work/employer is this about?", whichJobOptional: "Which work/employer is this about? (optional)", selectJob: "Select a work", totalIncome: "Total income", incomeByJob: "Income by work", unlinkedIncome: "Unlabeled income", forComplaint: "For complaint",
    contacts: "Trusted contacts", contactsNote: "These contacts are notified during an emergency check-in or escalation. Each contact is only used for real alerts after you confirm it.", addContact: "Add contact", contactName: "Name", contactPhone: "Mobile number", contactRelation: "Relationship (optional)", contactRelationHint: "e.g. brother, spouse, friend", pendingContact: "Confirmation pending", confirmedContact: "Confirmed", confirmContact: "Confirm", contactConfirmText: "Do you confirm this person has agreed to receive your emergency alerts?", testContact: "Send test alert", testSent: "Test message sent.", editContact: "Edit", removeContact: "Remove", contactRemoved: "Contact removed.", contactLimit: "You can add up to 5 trusted contacts.", contactsEmpty: "No contacts yet.", contactsEmergencyNote: "This feature does not replace emergency services (112).",    downloadData: "Download my data", downloadDataNote: "Download your complete record — wage history, check-ins, and complaints — as PDF, CSV, or JSON. This is your own record; no approval needed.", downloadPdf: "PDF", downloadCsv: "CSV", downloadJson: "JSON", downloadStarted: "Download started.", downloadFailed: "Download failed. Please try again.", exportContactsHeading: "Trusted contacts", exportProfileHeading: "My profile",
    debtOption: "Advance payment / debt bondage concern", debtExplainerTitle: "What is debt bondage?", debtExplainer: "If someone gave you money or a loan before you started work, and now they will not let you leave until it is repaid, keep your wages to \"repay\" it, or restrict where you can go — this is called debt bondage. It is illegal in India. You are not alone, and reporting it is your right.", debtQ1: "Was an advance or loan taken before starting this work?", debtQ2: "Are you being told you cannot leave until the advance is repaid?", debtQ3: "Are wages being withheld or reduced to repay the advance?", debtQ4: "Is your movement or travel being restricted?", debtDisclaimer: "Pehchaan organizes and routes this information to trusted organizations. It does not itself rescue or represent the worker. If you are in immediate danger, call 112.", debtAlertNote: "This report will be sent as urgent right away — an NGO team is notified immediately.",
  },
} as const;

type LabelSet = { [K in keyof typeof baseLabels.en]: string };
const regionalLabels: Record<Exclude<Language, "hi" | "en">, LabelSet> = {
  bn: { ...baseLabels.en, home: "হোম", how: "যেভাবে কাজ করে", workers: "শ্রমিকদের জন্য", orgs: "সংস্থার জন্য", safety: "নিরাপত্তা", join: "পাইলটে যোগ দিন", login: "শ্রমিক লগইন", phone: "মোবাইল নম্বর", sendOtp: "OTP পাঠান", otp: "OTP দিন", verify: "যাচাই করুন", dashboard: "আমার ড্যাশবোর্ড", wages: "মজুরি", checkin: "নিরাপত্তা পরীক্ষা", complaint: "সমস্যা জানান", cases: "আমার মামলা", safe: "আমি নিরাপদ", help: "আমার সাহায্য দরকার", summary: "সমস্যার বিবরণ", submit: "পাঠান", loading: "লোড হচ্ছে...", retry: "আবার চেষ্টা করুন", noData: "এখনও কোনো তথ্য নেই", listen: "শুনুন", stopListening: "থামুন", speakComplaint: "কথা বলে সমস্যা জানান", listening: "শোনা হচ্ছে...", schemes: "আপনার জন্য স্কিম", schemesNote: "আপনি এই সরকারি স্কিমগুলির জন্য যোগ্য হতে পারেন। এটি নিশ্চয়তা নয় — আবেদনের আগে অফিসিয়াল উৎস যাচাই করুন।", schemesEmpty: "এখনও কোনও সম্ভাব্য স্কিম মেলেনি। আমার প্রোফাইলে আপনার রাজ্য, বয়স ও কাজের ধরন যোগ করুন।", schemesProfileHint: "আপনার রাজ্য, বয়স ও কাজের ধরন যোগ করলে আপনার উপযোগী স্কিম দেখা যাবে।", whoQualifies: "কারা যোগ্য হতে পারে", howToStart: "কীভাবে শুরু করবেন", officialLink: "অফিসিয়াল তথ্য", profile: "আমার প্রোফাইল", profileNote: "এই তথ্য শুধু সম্ভাব্য সরকারি স্কিম সাজেস্ট করতে ব্যবহৃত হয়। যেকোনো ঘর খালি রাখতে পারেন।", state: "রাজ্য", age: "বয়স", workCategory: "কাজের ধরন", profileSaved: "প্রোফাইল সংরক্ষিত হয়েছে।" },
  ta: { ...baseLabels.en, home: "முகப்பு", how: "இது எப்படி செயல்படுகிறது", workers: "தொழிலாளர்களுக்கு", orgs: "நிறுவனங்களுக்கு", safety: "பாதுகாப்பு", join: "முன்முயற்சியில் சேருங்கள்", login: "தொழிலாளர் உள்நுழைவு", phone: "மொபைல் எண்", sendOtp: "OTP அனுப்புக", otp: "OTP உள்ளிடுக", verify: "சரிபார்க்கவும்", dashboard: "என் டாஷ்போர்டு", wages: "ஊதியம்", checkin: "பாதுகாப்பு சோதனை", complaint: "சிக்கலை தெரிவிக்கவும்", cases: "என் வழக்குகள்", safe: "நான் பாதுகாப்பாக இருக்கிறேன்", help: "எனக்கு உதவி தேவை", summary: "சிக்கல் விவரம்", submit: "அனுப்புக", loading: "ஏற்றப்படுகிறது...", retry: "மீண்டும் முயற்சிக்கவும்", noData: "இன்னும் தகவல் இல்லை", listen: "கேளுங்கள்", stopListening: "நிறுத்துக", speakComplaint: "பேசி சிக்கலை தெரிவிக்கவும்", listening: "கேட்கிறது...", schemes: "உங்களுக்கான திட்டங்கள்", schemesNote: "இந்த அரசு திட்டங்களுக்கு நீங்கள் தகுதியாக இருக்கலாம். இது உத்தரவாதம் அல்ல — விண்ணப்பிக்கும் முன் அதிகாரப்பூர்வ மூலத்தைச் சரிபார்க்கவும்.", schemesEmpty: "இன்னும் பொருந்தக்கூடிய திட்டம் இல்லை. என் சுயவிவரத்தில் மாநிலம், வயது, வேலை வகையைச் சேர்க்கவும்.", schemesProfileHint: "மாநிலம், வயது, வேலை வகையைச் சேர்த்தால் உங்களுக்குப் பொருந்தக்கூடிய திட்டங்கள் தெரியும்.", whoQualifies: "யார் தகுதியானவராக இருக்கலாம்", howToStart: "எப்படித் தொடங்குவது", officialLink: "அதிகாரப்பூர்வ தகவல்", profile: "என் சுயவிவரம்", profileNote: "இந்தத் தகவல் சாத்தியமான அரசு திட்டங்களைப் பரிந்துரைக்க மட்டுமே பயன்படுகிறது. எந்தப் புலத்தையும் காலியாக விடலாம்.", state: "மாநிலம்", age: "வயது", workCategory: "வேலை வகை", profileSaved: "சுயவிவரம் சேமிக்கப்பட்டது." },
  te: { ...baseLabels.en, home: "హోమ్", how: "ఇది ఎలా పనిచేస్తుంది", workers: "కార్మికుల కోసం", orgs: "సంస్థల కోసం", safety: "భద్రత", join: "పైలట్‌లో చేరండి", login: "కార్మికుల లాగిన్", phone: "మొబైల్ నంబర్", sendOtp: "OTP పంపండి", otp: "OTP నమోదు చేయండి", verify: "ధృవీకరించండి", dashboard: "నా డాష్‌బోర్డ్", wages: "వేతనాలు", checkin: "భద్రత తనిఖీ", complaint: "సమస్యను నివేదించండి", cases: "నా కేసులు", safe: "నేను సురక్షితంగా ఉన్నాను", help: "నాకు సహాయం కావాలి", summary: "సమస్య వివరాలు", submit: "పంపండి", loading: "లోడ్ అవుతోంది...", retry: "మళ్లీ ప్రయత్నించండి", noData: "ఇంకా సమాచారం లేదు", listen: "వినండి", stopListening: "ఆపండి", speakComplaint: "మాట్లాడి సమస్యను చెప్పండి", listening: "వింటోంది...", schemes: "మీ కోసం పథకాలు", schemesNote: "ఈ ప్రభుత్వ పథకాలకు మీరు అర్హులు కావచ్చు. ఇది హామీ కాదు — దరఖాస్తు చేసే ముందు అధికారిక మూలాన్ని తనిఖీ చేయండి.", schemesEmpty: "ఇంకా సరిపోయే పథకం కనబడలేదు. నా ప్రొఫైల్‌లో మీ రాష్ట్రం, వయస్సు, పని రకాన్ని జోడించండి.", schemesProfileHint: "రాష్ట్రం, వయస్సు, పని రకం జోడిస్తే మీకు సరిపోయే పథకాలు కనబడతాయి.", whoQualifies: "ఎవరు అర్హులు కావచ్చు", howToStart: "ఎలా ప్రారంభించాలి", officialLink: "అధికారిక సమాచారం", profile: "నా ప్రొఫైల్", profileNote: "ఈ సమాచారం సాధ్యమయ్యే ప్రభుత్వ పథకాలను సూచించడానికి మాత్రమే వాడతారు. ఏ ఖాళీనైనా ఖాళీగా వదిలేయవచ్చు.", state: "రాష్ట్రం", age: "వయస్సు", workCategory: "పని రకం", profileSaved: "ప్రొఫైల్ సేవ్ అయింది." },
};
const labels: Record<Language, LabelSet> = { ...baseLabels, ...regionalLabels };
const languageNames: Record<Language, string> = { hi: "हिंदी", en: "English", bn: "বাংলা", ta: "தமிழ்", te: "తెలుగు" };
const voiceLocales: Record<Language, string> = { hi: "hi-IN", en: "en-IN", bn: "bn-IN", ta: "ta-IN", te: "te-IN" };

const publicPhotos = { hero: "https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=1800&q=80", worker: "https://images.unsplash.com/photo-1521791055366-0d553872125f?auto=format&fit=crop&w=900&q=80" };
const sessionKey = "pehchaan-worker-session";
type Session = { token: string; refreshToken: string; workerId: string; expiresAt: number };

function getSession(): Session | null {
  try {
    const session = JSON.parse(localStorage.getItem(sessionKey) || "null") as Session | null;
    return session && session.expiresAt > Date.now() ? session : null;
  } catch { return null; }
}

function t_public(lang: Language, key: "how" | "safety" | "about" | "join") {
  return labels[lang][key];
}

function relationshipLabel(rel?: WorkRelationship | null) {
  if (!rel) return "";
  return [rel.label, rel.employerName, rel.siteName].filter(Boolean).join(" · ");
}

function relationshipSummary(rel?: { label?: string; employerName?: string | null; siteName?: string | null } | null) {
  const label = String(rel?.label || ""); const employer = String(rel?.employerName || ""); const site = String(rel?.siteName || "");
  return !label && !employer && !site ? "—" : [label, employer, site].filter(Boolean).join(" · ");
}

function Schemes({ lang, dashboard }: { lang: Language; dashboard: Dashboard }) {
  const t = labels[lang]; const schemes = dashboard.schemes || [];
  return <><h1>{t.schemes}</h1><p className="helper">{t.schemesNote}</p><div className="detail-grid">{schemes.map((scheme) => <section className="list-panel" key={scheme.id}><h2>{scheme.name}</h2><p>{scheme.description}</p><p><strong>{t.whoQualifies}:</strong> {scheme.eligibility}</p><p><strong>{t.howToStart}:</strong> {scheme.registrationInstructions}</p>{scheme.officialUrl && <a className="button button-small" href={scheme.officialUrl} target="_blank" rel="noreferrer">{t.officialLink}</a>}</section>)}</div>{!schemes.length && <div className="list-panel"><p>{t.schemesEmpty}</p></div>}</>;
}

function Contacts({ lang, dashboard }: { lang: Language; dashboard: Dashboard }) {
  const t = labels[lang]; const [contacts, setContacts] = React.useState<TrustedContact[]>([]); const [loading, setLoading] = React.useState(true); const [error, setError] = React.useState(""); const [message, setMessage] = React.useState("");
  const [editing, setEditing] = React.useState<TrustedContact | null>(null); const [form, setForm] = React.useState({ name: "", phone: "", relationshipLabel: "" });
  const load = React.useCallback(async () => { setLoading(true); try { setContacts((await trustedContactApi.list()).contacts); setError(""); } catch { setError(t.error); } finally { setLoading(false); } }, [t.error]);
  React.useEffect(() => { void load(); }, [load]);
  const startEdit = (contact: TrustedContact) => { setEditing(contact); setForm({ name: contact.name, phone: contact.phone, relationshipLabel: contact.relationshipLabel || "" }); setMessage(""); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage("");
    try {
      if (editing) { await trustedContactApi.update(editing.id, form); setEditing(null); } else { await trustedContactApi.create(form); }
      setForm({ name: "", phone: "", relationshipLabel: "" }); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t.error); }
  };
  const confirm = async (contact: TrustedContact) => {
    if (!window.confirm(t.contactConfirmText)) return;
    try { await trustedContactApi.update(contact.id, { action: "confirm" }); await load(); } catch { setError(t.error); }
  };
  const sendTest = async (contact: TrustedContact) => {
    setMessage("");
    try { await trustedContactApi.update(contact.id, { action: "test" }); setMessage(t.testSent); await load(); } catch { setError(t.error); }
  };
  const remove = async (contact: TrustedContact) => {
    if (!window.confirm(`${t.removeContact}: ${contact.name}?`)) return;
    try { await trustedContactApi.remove(contact.id); if (editing?.id === contact.id) setEditing(null); setMessage(t.contactRemoved); await load(); } catch { setError(t.error); }
  };
  const atLimit = contacts.length >= 5;
  return <>
    <h1>{t.contacts}</h1><p className="helper">{t.contactsNote}</p>
    {error && <div className="error-box"><p>{error}</p></div>}{message && <p className="success">{message}</p>}
    <form className="worker-form" onSubmit={submit}>
      <label>{t.contactName}<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <label>{t.contactPhone}<input required type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" /></label>
      <label>{t.contactRelation}<input value={form.relationshipLabel} onChange={(e) => setForm({ ...form, relationshipLabel: e.target.value })} placeholder={t.contactRelationHint} /></label>
      <button className="button" disabled={loading || (!editing && atLimit)}>{editing ? t.save : t.addContact}</button>
      {editing && <button type="button" className="button button-ghost" onClick={() => { setEditing(null); setForm({ name: "", phone: "", relationshipLabel: "" }); }}>{t.stopListening}</button>}
      {!editing && atLimit && <p className="helper">{t.contactLimit}</p>}
    </form>
    <div className="list-panel">
      {loading ? <p>{t.loading}</p> : contacts.length ? contacts.map((contact) => (
        <div className="list-row" key={contact.id}>
          <strong>{contact.name}{contact.relationshipLabel ? <small> · {contact.relationshipLabel}</small> : null}</strong>
          <span>{contact.phone} · {contact.status === "confirmed" ? `✓ ${t.confirmedContact}` : t.pendingContact}</span>
          <div className="contact-actions">
            {contact.status === "pending" && <button className="button button-small" onClick={() => void confirm(contact)}>{t.confirmContact}</button>}
            <button className="button button-small" onClick={() => void sendTest(contact)}>{t.testContact}</button>
            <button className="button button-small" onClick={() => startEdit(contact)}>{t.editContact}</button>
            <button className="button button-small" onClick={() => void remove(contact)}>{t.removeContact}</button>
          </div>
        </div>
      )) : <p>{t.contactsEmpty}</p>}
      <p className="helper">{t.contactsEmergencyNote}</p>
    </div>
  </>;
}

function Profile({ lang, dashboard, refresh }: { lang: Language; dashboard: Dashboard; refresh: () => Promise<void> }) {
  const t = labels[lang]; const initial = dashboard.worker.profile || {};
  const [form, setForm] = React.useState({ state: String(initial.state || initial.originState || ""), age: initial.age === undefined || initial.age === null ? "" : String(initial.age), workerCategory: String(initial.workerCategory || "") });
  const [busy, setBusy] = React.useState(false); const [message, setMessage] = React.useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      await workerApi.updateProfile({ workerId: dashboard.worker.id, profile: { state: form.state.trim(), age: form.age ? Number(form.age) : undefined, workerCategory: form.workerCategory } });
      setMessage(t.profileSaved); await refresh();
    } catch { setMessage(t.error); } finally { setBusy(false); }
  };
  const categories: Array<[string, string]> = lang === "hi"
    ? [["unskilled_construction", "अकुशल निर्माण कार्य"], ["semi_skilled_construction", "अर्ध-कुशल निर्माण कार्य"], ["skilled_construction", "कुशल निर्माण कार्य"], ["domestic_work", "घरेलू काम"], ["street_vendor", "थेला/रेहड़ी विक्रेता"], ["factory", "कारखाना कार्य"], ["formal_employment", "औपचारिक रोजगार"], ["agriculture", "कृषि कार्य"]]
    : [["unskilled_construction", "Unskilled construction"], ["semi_skilled_construction", "Semi-skilled construction"], ["skilled_construction", "Skilled construction"], ["domestic_work", "Domestic work"], ["street_vendor", "Street vendor"], ["factory", "Factory work"], ["formal_employment", "Formal employment"], ["agriculture", "Agriculture"]];
  return <><h1>{t.profile}</h1><p className="helper">{t.profileNote}</p><form className="worker-form" onSubmit={submit}><label>{t.state}<input value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} placeholder="Delhi" /></label><label>{t.age}<input type="number" min={14} max={100} value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })} /></label><label>{t.workCategory}<select value={form.workerCategory} onChange={(event) => setForm({ ...form, workerCategory: event.target.value })}><option value="">—</option>{categories.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><button className="button" disabled={busy}>{busy ? t.loading : t.save}</button>{message && <p className="success">{message}</p>}</form><section className="list-panel"><h2>{t.downloadData}</h2><p className="helper">{t.downloadDataNote}</p><div className="contact-actions"><button className="button" onClick={() => void downloadWorkerData("pdf").then(() => setMessage(t.downloadStarted)).catch(() => setMessage(t.downloadFailed))}>{t.downloadPdf}</button><button className="button" onClick={() => void downloadWorkerData("csv").then(() => setMessage(t.downloadStarted)).catch(() => setMessage(t.downloadFailed))}>{t.downloadCsv}</button><button className="button" onClick={() => void downloadWorkerData("json").then(() => setMessage(t.downloadStarted)).catch(() => setMessage(t.downloadFailed))}>{t.downloadJson}</button></div></section><p className="helper">{t.schemesProfileHint}</p></>;
}

function SchemeAdmin() {
  const [schemes, setSchemes] = React.useState<import("./api").WelfareScheme[]>([]); const [message, setMessage] = React.useState("");
  React.useEffect(() => { schemeApi.list().then((result) => setSchemes(result.schemes)).catch(() => setMessage("Could not load schemes.")); }, []);
  return <><h1>Welfare scheme references</h1><div className="list-panel"><p><strong>Scheme reference data is now maintained by the Pehchaan platform team.</strong></p><p className="helper">To add or correct a scheme, contact your platform admin (platform@pehchaan.org) with the plain-language description, eligibility, and an official portal link. The list below shows schemes currently visible to workers.</p></div><div className="list-panel">{schemes.map((scheme) => <div className="list-row" key={scheme.id}><strong>{scheme.name}</strong><span>{scheme.eligibility}</span></div>)}{!schemes.length && <p>{message || "No schemes published yet."}</p>}</div></>;
}

function isOffline(error: unknown) { return Boolean((error as ApiError)?.offline); }
function translatedCaseType(lang: Language, type: string) {
  const values = lang === "hi"
    ? { wage_theft: "मजदूरी नहीं मिली", unsafe_site: "असुरक्षित जगह", harassment: "उत्पीड़न", debt_bondage: "अग्रिम/बंधुआ मजदूरी" }
    : { wage_theft: "Unpaid wages", unsafe_site: "Unsafe site", harassment: "Harassment", debt_bondage: "Advance payment / debt bondage" };
  return values[type as keyof typeof values] || type;
}
function translatedStatus(lang: Language, status: string) {
  const values = lang === "hi"
    ? { new: "नया", assigned: "सौंपा गया", in_progress: "काम चल रहा है", resolved: "हल हो गया" }
    : { new: "New", assigned: "Assigned", in_progress: "In progress", resolved: "Resolved" };
  return values[status as keyof typeof values] || status;
}
async function queueWork(item: Omit<OfflineItem, "createdAt" | "status">) {
  await addOfflineItem({ ...item, createdAt: new Date().toISOString(), status: "queued" });
  window.dispatchEvent(new Event("offline-queue-updated"));
}

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  const browser = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
  return browser.SpeechRecognition || browser.webkitSpeechRecognition || null;
}

function ListenButton({ lang, text }: { lang: Language; text: string }) {
  const t = labels[lang]; const [speaking, setSpeaking] = React.useState(false); const [unsupported, setUnsupported] = React.useState(false);
  const toggle = () => {
    if (!("speechSynthesis" in window)) { setUnsupported(true); return; }
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const utterance = new SpeechSynthesisUtterance(text); utterance.lang = voiceLocales[lang]; utterance.onend = () => setSpeaking(false); window.speechSynthesis.speak(utterance); setSpeaking(true);
  };
  return <span className="voice-control"><button type="button" className="voice-button" onClick={toggle} aria-label={speaking ? t.stopListening : t.listen}>🔊 {speaking ? t.stopListening : t.listen}</button>{unsupported && <small className="error">{t.voiceUnavailable}</small>}</span>;
}

function VoiceGuide({ lang }: { lang: Language }) {
  const t = labels[lang]; return <div className="voice-guide"><span>🎧 {t.voiceGuide}</span><ListenButton lang={lang} text={t.voiceGuideText} /></div>;
}

function Navbar({ lang, setLang }: { lang: Language; setLang: (value: Language) => void }) {
  const t = labels[lang];
  return <header className="navbar"><Link className="brand" to="/">{lang === "hi" ? "पहचान" : "Pehchaan"}<span>.</span></Link><nav><Link to="/">{t.home}</Link><Link to="/how-it-works">{t.how}</Link><Link to="/for-workers">{t.workers}</Link><Link to="/for-organizations">{t.orgs}</Link><Link to="/safety">{t.safety}</Link><Link to="/about">{t.about}</Link></nav><div className="nav-actions"><label className="language-picker"><span className="sr-only">Language</span><select value={lang} onChange={(event) => setLang(event.target.value as Language)} aria-label="Select language">{(Object.keys(languageNames) as Language[]).map((value) => <option value={value} key={value}>{languageNames[value]}</option>)}</select></label><Link className="button button-small" to="/join">{t.join}</Link></div></header>;
}

function PublicHome({ lang }: { lang: Language }) {
  const t = labels[lang];
  const hi = lang === "hi";
  return <main><section className="hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(8,32,46,.9), rgba(8,32,46,.3)), url(${publicPhotos.hero})` }}><div className="hero-content"><p className="eyebrow">{hi ? "सुरक्षित भविष्य की शुरुआत अपनी बात कहने से होती है" : "A safer future starts with being heard"}</p><h1>{hi ? "हर श्रमिक सुरक्षित कल का हकदार है" : "Every Worker Deserves a Safer Tomorrow"}</h1><p className="hero-copy">{hi ? "पहचान प्रवासी श्रमिकों को मजदूरी सुरक्षित रखने, असुरक्षित परिस्थितियों की सूचना देने और भरोसेमंद सहायता से जुड़ने में मदद करता है।" : "Pehchaan helps migrant workers protect wages, report unsafe conditions, and connect with trusted support."}</p><div className="hero-actions"><Link className="button" to="/worker/login">{t.login} →</Link><Link className="button button-ghost" to="/how-it-works">{t.how}</Link><ListenButton lang={lang} text={hi ? "हर श्रमिक सुरक्षित कल का हकदार है। पहचान मजदूरी सुरक्षित रखने, असुरक्षित परिस्थितियों की सूचना देने और भरोसेमंद सहायता से जुड़ने में मदद करता है।" : "Every worker deserves a safer tomorrow. Pehchaan helps workers protect wages, report unsafe conditions, and connect with trusted support."} /></div></div></section></main>;
}

function Auth({ lang, setSession }: { lang: Language; setSession: (session: Session) => void }) {
  const t = labels[lang]; const [phone, setPhone] = React.useState(""); const [otp, setOtp] = React.useState(""); const [sent, setSent] = React.useState(false); const [busy, setBusy] = React.useState(false); const [error, setError] = React.useState("");
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); setError(""); try { if (!sent) { await authApi.requestOtp(phone); setSent(true); } else { const result = await authApi.verifyOtp(phone, otp); setSession({ token: result.accessToken, refreshToken: result.refreshToken, workerId: result.user.id, expiresAt: Date.now() + 15 * 60 * 1000 }); } } catch (cause) { setError(isOffline(cause) ? t.offline : t.error); } finally { setBusy(false); } };
  return <main className="auth-page"><form className="auth-card" onSubmit={submit}><p className="eyebrow teal">{t.login}</p><h1>{sent ? t.otp : t.phone}</h1><VoiceGuide lang={lang} /><input required type={sent ? "text" : "tel"} value={sent ? otp : phone} onChange={(event) => sent ? setOtp(event.target.value) : setPhone(event.target.value)} placeholder={sent ? "123456" : "+91 98765 43210"} /><button className="button" disabled={busy}>{busy ? t.loading : sent ? t.verify : t.sendOtp}</button>{sent && <p className="helper">{t.demo}</p>}{error && <p className="error">{error}</p>}</form></main>;
}

function WorkerLayout({ lang, dashboard, logout, children }: { lang: Language; dashboard: Dashboard; logout: () => void; children: React.ReactNode }) {
  const t = labels[lang]; const navigate = useNavigate();
  return <main className="worker-app"><aside className="worker-nav"><Link className="brand" to="/worker">{lang === "hi" ? "पहचान" : "Pehchaan"}<span>.</span></Link><NotificationCenter lang={lang} enabled /><button onClick={() => navigate("/worker")}>{t.dashboard}</button><button onClick={() => navigate("/worker/wages")}>{t.wages}</button><button onClick={() => navigate("/worker/check-in")}>{t.checkin}</button><button onClick={() => navigate("/worker/report")}>{t.complaint}</button><button onClick={() => navigate("/worker/cases")}>{t.cases}</button><button onClick={() => navigate("/worker/schemes")}>{t.schemes}</button><button onClick={() => navigate("/worker/contacts")}>{t.contacts}</button><button onClick={() => navigate("/worker/profile")}>{t.profile}</button><button className="logout-link" onClick={logout}>{t.logout}</button></aside><section className="worker-content"><OfflineQueueStatus lang={lang} />{children}</section></main>;
}

function Loading({ lang }: { lang: Language }) { return <div className="loading-card" aria-live="polite">{labels[lang].loading}</div>; }
function ErrorBox({ lang, offline, onRetry }: { lang: Language; offline?: boolean; onRetry: () => void }) { const t = labels[lang]; return <div className="error-box"><p>{offline ? t.offline : t.error}</p><button className="button button-small" onClick={onRetry}>{t.retry}</button></div>; }

function OfflineQueueStatus({ lang }: { lang: Language }) {
  const [items, setItems] = React.useState<OfflineItem[]>([]);
  const refresh = React.useCallback(() => { void listOfflineItems().then(setItems).catch(() => setItems([])); }, []);
  React.useEffect(() => { refresh(); window.addEventListener("offline-queue-updated", refresh); return () => window.removeEventListener("offline-queue-updated", refresh); }, [refresh]);
  if (!items.length) return null;
  const t = labels[lang];
  return <div className="offline-queue" aria-live="polite"><strong>{t.waitingSync}: {items.length}</strong>{items.map((item) => <div key={item.id}>{item.kind === "checkin" ? t.checkin : item.kind === "case" ? t.complaint : t.wages} · {item.status === "failed" ? t.syncFailed : t.waitingSync}</div>)}</div>;
}

function DashboardHome({ lang, dashboard }: { lang: Language; dashboard: Dashboard }) {
  const t = labels[lang]; const pending = dashboard.wageEntries.reduce((sum, item) => sum + item.amount, 0); const latest = dashboard.checkIns.at(-1);;
  const income = dashboard.incomeByRelationship; const rels = dashboard.workRelationships || [];
  const relName = (id: string) => relationshipSummary(rels.find((item) => item.id === id));
  return <><h1>{t.dashboard}</h1><div className="stats-grid"><div className="stat-card"><span>{t.wages}</span><strong>₹{pending}</strong></div><div className="stat-card"><span>{t.checkin}</span><strong>{latest?.status === "unsafe" || latest?.status === "emergency" ? t.help : t.safe}</strong></div><div className="stat-card"><span>{t.cases}</span><strong>{dashboard.cases.length}</strong></div></div><div className="worker-cards"><Link className="worker-card" to="/worker/wages"><h2>{t.wages}</h2><p>{dashboard.wageEntries.length ? `${dashboard.wageEntries.length} ${lang === "hi" ? "रिकॉर्ड" : "records"}` : t.noData}</p></Link><Link className="worker-card" to="/worker/check-in"><h2>{t.checkin}</h2><p>{latest?.notes || t.noData}</p></Link><Link className="worker-card" to="/worker/report"><h2>{t.complaint}</h2><p>{t.summary}</p></Link></div>{(income?.relationships.length || rels.length) ? <section className="list-panel"><h2>{t.incomeByJob}</h2><p className="helper">{t.workRelationshipsNote}</p>{income?.relationships.map((row) => <div className="list-row" key={row.relationshipId}><strong>{row.relationshipId === "unlinked" ? t.unlinkedIncome : relName(row.relationshipId)}</strong><span>₹{row.total}</span></div>)}<div className="list-row"><strong>{t.totalIncome}</strong><span>₹{income?.combined ?? pending}</span></div></section> : null}</>;
}

function WorkRelationshipsManager({ lang, dashboard, refresh }: { lang: Language; dashboard: Dashboard; refresh: () => Promise<void> }) {
  const t = labels[lang]; const rels = dashboard.workRelationships || [];
  const [form, setForm] = React.useState({ label: "", employerName: "", siteName: "", category: "", startedOn: new Date().toISOString().slice(0, 10) });
  const [busy, setBusy] = React.useState(false); const [message, setMessage] = React.useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try { await workRelationshipApi.create({ ...form, label: form.label.trim() }); setMessage(t.relSaved); setForm({ label: "", employerName: "", siteName: "", category: "", startedOn: new Date().toISOString().slice(0, 10) }); await refresh(); } catch { setMessage(t.error); } finally { setBusy(false); }
  };
  const toggle = async (rel: WorkRelationship, active: boolean) => { setBusy(true); try { await workRelationshipApi.update(rel.id, { active }); await refresh(); } catch { setMessage(t.error); } finally { setBusy(false); } };
  const active = rels.filter((item) => item.active); const ended = rels.filter((item) => !item.active);
  return <section className="list-panel">
    <h2>{t.workRelationships}</h2><p className="helper">{t.workRelationshipsNote}</p>
    <form className="worker-form" onSubmit={submit}>
      <label>{t.relLabel}<input required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder={t.relLabelHint} /></label>
      <label>{t.employerName}<input value={form.employerName} onChange={(e) => setForm({ ...form, employerName: e.target.value })} /></label>
      <label>{t.siteName}<input value={form.siteName} onChange={(e) => setForm({ ...form, siteName: e.target.value })} /></label>
      <label>{t.relCategory}<input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
      <label>{t.startedOn}<input type="date" value={form.startedOn} onChange={(e) => setForm({ ...form, startedOn: e.target.value })} /></label>
      <button className="button" disabled={busy}>{busy ? t.loading : t.addRelationship}</button>{message && <p className="success">{message}</p>}
    </form>
    {rels.length ? <div>
      {active.map((rel) => <div className="list-row" key={rel.id}><strong>{relationshipLabel(rel)}</strong><span>✓ {t.activeRel} · {t.startedOn} {rel.startedOn || "—"}</span><button className="button button-small" disabled={busy} onClick={() => void toggle(rel, false)}>{t.endRel}</button></div>)}
      {ended.map((rel) => <div className="list-row" key={rel.id}><strong>{relationshipLabel(rel)}</strong><span>{t.endedRel} · {t.startedOn} {rel.startedOn || "—"}</span><button className="button button-small" disabled={busy} onClick={() => void toggle(rel, true)}>{t.reopenRel}</button></div>)}
      <p className="helper">{t.relHistoryNote}</p>
    </div> : null}
  </section>;
}

function Wages({ lang, dashboard, refresh }: { lang: Language; dashboard: Dashboard; refresh: () => Promise<void> }) {
  const t = labels[lang]; const [busy, setBusy] = React.useState(false); const [error, setError] = React.useState(""); const [fairPay, setFairPay] = React.useState<{ status: string; message: string; nextStep: string; dailyReference?: number } | null>(null); const [form, setForm] = React.useState({ promised: "", received: "", date: new Date().toISOString().slice(0, 10), note: "", relationshipId: "" });
  const rels = dashboard.workRelationships || [];
  const submit = async (event: React.FormEvent) => { event.preventDefault(); const body = { workerId: dashboard.worker.id, amount: Number(form.received || form.promised), type: form.received ? "received" : "promised", date: form.date, notes: form.note, relationshipId: form.relationshipId || undefined }; setBusy(true); setError(""); try { const result = await workerApi.addWage(body); setFairPay(result.fairPay); await refresh(); setForm({ ...form, promised: "", received: "", note: "" }); } catch (cause) { if (isOffline(cause)) { await queueWork({ id: crypto.randomUUID(), kind: "wage", body }); setError(t.offline); } else setError(t.error); } finally { setBusy(false); } };
  return <><h1>{t.wages}</h1>{error && <ErrorBox lang={lang} offline={error === t.offline} onRetry={() => setError("")} />}{fairPay && <div className={`fair-pay ${fairPay.status === "may_be_below_reference" ? "fair-pay-info" : "fair-pay-ok"}`} role="status"><strong>{lang === "hi" && fairPay.status === "may_be_below_reference" ? "यह रकम आपके राज्य/श्रेणी के मानक न्यूनतम वेतन संदर्भ से कम दिख रही है। सरकारी दरें शिफ्ट, कौशल और नवीनतम अधिसूचना के अनुसार बदल सकती हैं।" : fairPay.message}</strong>{fairPay.dailyReference ? <span>{lang === "hi" ? "संदर्भ दर:" : "Reference rate:"} ₹{fairPay.dailyReference}/day</span> : null}<p>{lang === "hi" ? (fairPay.status === "may_be_below_reference" ? "क्या आप इस बारे में शिकायत दर्ज करना चाहेंगे?" : "आप इस प्रविष्टि को अपने वेतन इतिहास में रख सकते हैं — कोई कार्रवाई ज़रूरी नहीं है।") : fairPay.nextStep}</p>{fairPay.status === "may_be_below_reference" && <Link className="button button-small" to="/worker/report">{lang === "hi" ? "शिकायत दर्ज करें" : "File a complaint"}</Link>}</div>}<form className="worker-form" onSubmit={submit}><label>{t.whichJob}<select value={form.relationshipId} onChange={(e) => setForm({ ...form, relationshipId: e.target.value })}><option value="">{t.selectJob}</option>{rels.map((rel) => <option value={rel.id} key={rel.id}>{relationshipLabel(rel)}{rel.active ? "" : ` (${t.endedRel})`}</option>)}</select></label><label>{t.promised}<input type="number" value={form.promised} onChange={(e) => setForm({ ...form, promised: e.target.value })} /></label><label>{t.received}<input type="number" value={form.received} onChange={(e) => setForm({ ...form, received: e.target.value })} /></label><label>{t.date}<input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label><label>{t.note}<textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label><button className="button" disabled={busy}>{busy ? t.loading : t.save}</button></form><WorkRelationshipsManager lang={lang} dashboard={dashboard} refresh={refresh} /><div className="list-panel"><h2>{t.incomeByJob}</h2>{(dashboard.incomeByRelationship?.relationships.length) ? dashboard.incomeByRelationship.relationships.map((row) => <div className="list-row" key={row.relationshipId}><strong>{row.relationshipId === "unlinked" ? t.unlinkedIncome : relationshipLabel(rels.find((item) => item.id === row.relationshipId))}</strong><span>₹{row.total}</span></div>) : <p>{t.noData}</p>}<div className="list-row"><strong>{t.totalIncome}</strong><span>₹{dashboard.incomeByRelationship?.combined ?? dashboard.wageEntries.reduce((sum, item) => sum + item.amount, 0)}</span></div></div><div className="list-panel">{dashboard.wageEntries.map((entry) => <div className="list-row" key={entry.id}><strong>₹{entry.amount}</strong><span>{entry.type} · {entry.date}{entry.relationshipId ? ` · ${relationshipLabel(rels.find((item) => item.id === entry.relationshipId)) || ""}` : ""}</span></div>)}</div></>;
}

function CheckIn({ lang, dashboard, refresh }: { lang: Language; dashboard: Dashboard; refresh: () => Promise<void> }) {
  const t = labels[lang]; const [busy, setBusy] = React.useState(false); const [error, setError] = React.useState(""); const [locationConsent, setLocationConsent] = React.useState(false);
  const submit = async (status: "safe" | "unsafe") => { const body = { workerId: dashboard.worker.id, status, locationConsent, location: null, notes: status === "safe" ? "Worker reported safe." : "Worker requested help." }; setBusy(true); setError(""); try { await workerApi.checkIn(body); await refresh(); } catch (cause) { if (isOffline(cause)) { await queueWork({ id: crypto.randomUUID(), kind: "checkin", body }); setError(t.offline); } else setError(t.error); } finally { setBusy(false); } };
  return <><h1>{t.checkin}</h1>{error && <ErrorBox lang={lang} offline={error === t.offline} onRetry={() => setError("")} />}<div className="list-panel"><p>{t.emergencyDisclaimer}</p><strong>{t.emergencyNumber}</strong><label><input type="checkbox" checked={locationConsent} onChange={(e) => setLocationConsent(e.target.checked)} /> {lang === "hi" ? "मैं इस check-in के लिए अपना स्थान साझा करने की सहमति देता/देती हूं।" : "I consent to sharing my location for this check-in."}</label></div><div className="checkin-actions"><button className="big-action safe-action" disabled={busy} onClick={() => submit("safe")}>✓<span>{t.safe}</span></button><button className="big-action help-action" disabled={busy} onClick={() => submit("unsafe")}>!<span>{t.help}</span></button></div><div className="list-panel">{dashboard.checkIns.slice().reverse().map((item) => <div className="list-row" key={item.id}><strong>{item.status === "safe" ? t.safe : t.help}</strong><span>{new Date(item.createdAt).toLocaleString()}</span></div>)}</div></>;
}

function Report({ lang, dashboard, refresh }: { lang: Language; dashboard: Dashboard; refresh: () => Promise<void> }) {
  const t = labels[lang]; const [busy, setBusy] = React.useState(false); const [error, setError] = React.useState(""); const [summary, setSummary] = React.useState(""); const [type, setType] = React.useState("wage_theft"); const [danger, setDanger] = React.useState(false); const [now, setNow] = React.useState(false); const [relationshipId, setRelationshipId] = React.useState(""); const [locationConsent, setLocationConsent] = React.useState(false); const [voiceError, setVoiceError] = React.useState(""); const [listening, setListening] = React.useState(false);
  const [debt, setDebt] = React.useState({ advanceTaken: false, cannotLeave: false, wagesWithheldForRepayment: false, movementRestricted: false });
  const startVoice = () => { const Constructor = getSpeechRecognition(); if (!Constructor) { setVoiceError(t.voiceUnavailable); return; } const recognition = new Constructor(); recognition.lang = voiceLocales[lang]; recognition.interimResults = false; recognition.maxAlternatives = 1; recognition.onresult = (event) => { const result = event.results[0]?.[0]?.transcript || ""; setSummary((current) => current ? `${current} ${result}` : result); }; recognition.onerror = () => { setVoiceError(t.voiceUnavailable); setListening(false); }; recognition.onend = () => setListening(false); setVoiceError(""); setListening(true); try { recognition.start(); } catch { setVoiceError(t.voiceUnavailable); setListening(false); } };
  const isDebt = type === "debt_bondage";
  const submit = async (event: React.FormEvent) => { event.preventDefault(); const body = { workerId: dashboard.worker.id, type, priority: danger || now || isDebt ? "high" : "medium", summary, immediateDanger: danger, happeningNow: now, locationConsent, location: null, relationshipId: relationshipId || undefined, debtBondage: isDebt ? debt : undefined }; setBusy(true); setError(""); try { await workerApi.createCase(body); setSummary(""); setRelationshipId(""); setDebt({ advanceTaken: false, cannotLeave: false, wagesWithheldForRepayment: false, movementRestricted: false }); await refresh(); } catch (cause) { if (isOffline(cause)) { await queueWork({ id: crypto.randomUUID(), kind: "case", body }); setError(t.offline); } else setError(t.error); } finally { setBusy(false); } };
  return <><h1>{t.complaint}</h1>{error && <ErrorBox lang={lang} offline={error === t.offline} onRetry={() => setError("")} />}{summary.trim().length > 0 && summary.trim().length < 15 && <p className="helper">{lang === "hi" ? "थोड़ा और विवरण लिखें — जैसे कब, कहाँ, और क्या हुआ। छोटा विवरण समीक्षा में देरी कर सकता है।" : "Add a little more detail — when, where, and what happened. Very short descriptions can slow down review."}</p>}<form className="worker-form" onSubmit={submit}><label>{t.type}<select value={type} onChange={(e) => setType(e.target.value)}><option value="wage_theft">{lang === "hi" ? "मजदूरी नहीं मिली" : "Unpaid wages"}</option><option value="unsafe_site">{lang === "hi" ? "असुरक्षित जगह" : "Unsafe site"}</option><option value="harassment">{lang === "hi" ? "उत्पीड़न" : "Harassment"}</option><option value="debt_bondage">{t.debtOption}</option></select></label>{isDebt && <div className="list-panel debt-bondage-panel" role="note"><strong>{t.debtExplainerTitle}</strong><p>{t.debtExplainer}</p><label><input type="checkbox" checked={debt.advanceTaken} onChange={(e) => setDebt({ ...debt, advanceTaken: e.target.checked })} /> {t.debtQ1}</label><label><input type="checkbox" checked={debt.cannotLeave} onChange={(e) => setDebt({ ...debt, cannotLeave: e.target.checked })} /> {t.debtQ2}</label><label><input type="checkbox" checked={debt.wagesWithheldForRepayment} onChange={(e) => setDebt({ ...debt, wagesWithheldForRepayment: e.target.checked })} /> {t.debtQ3}</label><label><input type="checkbox" checked={debt.movementRestricted} onChange={(e) => setDebt({ ...debt, movementRestricted: e.target.checked })} /> {t.debtQ4}</label><p><strong>{t.debtAlertNote}</strong></p><p>{t.debtDisclaimer}</p></div>}{isDebt ? null : <label>{t.whichJobOptional}<select value={relationshipId} onChange={(e) => setRelationshipId(e.target.value)}><option value="">{t.selectJob}</option>{(dashboard.workRelationships || []).map((rel) => <option value={rel.id} key={rel.id}>{relationshipLabel(rel)}{rel.active ? "" : ` (${t.endedRel})`}</option>)}</select></label>}<label>{t.summary}<textarea required rows={6} value={summary} onChange={(e) => setSummary(e.target.value)} /><button type="button" className="voice-button" onClick={startVoice}>🎙️ {listening ? t.listening : t.speakComplaint}</button>{voiceError && <small className="error">{voiceError}</small>}</label>{isDebt ? null : <><label><input type="checkbox" checked={danger} onChange={(e) => setDanger(e.target.checked)} /> {lang === "hi" ? "मैं तत्काल खतरे में हूं" : "I am in immediate danger"}</label><label><input type="checkbox" checked={now} onChange={(e) => setNow(e.target.checked)} /> {lang === "hi" ? "यह अभी हो रहा है" : "This is happening right now"}</label></>}{(danger || now) && <div className="list-panel"><p>{t.emergencyDisclaimer}</p><strong>{t.emergencyNumber}</strong><label><input type="checkbox" checked={locationConsent} onChange={(e) => setLocationConsent(e.target.checked)} /> {lang === "hi" ? "मैं इस शिकायत के लिए अपना स्थान साझा करने की सहमति देता/देती हूं।" : "I consent to sharing my location for this complaint."}</label></div>}<button className="button" disabled={busy}>{busy ? t.loading : t.submit}</button></form></>;
}

function Cases({ lang, dashboard }: { lang: Language; dashboard: Dashboard }) { const t = labels[lang]; const stages = ["new", "assigned", "in_progress", "resolved"]; return <><h1>{t.cases}</h1><p className="helper">{lang === "hi" ? "हर शिकायत पर एक मानव केसवर्कर ज़रूर नज़र डालता है — असली शिकायत कभी अपने आप रद्द नहीं होती।" : "A human caseworker reviews every complaint — a genuine report is never rejected automatically."}</p><div className="list-panel">{dashboard.cases.length ? dashboard.cases.map((item) => <div className="list-row" key={item.id}><strong>{translatedCaseType(lang, item.type)}</strong><span>{translatedStatus(lang, item.status)} · {item.priority} · {new Date(item.createdAt).toLocaleDateString()}</span><div className="case-timeline" aria-label="Case progress">{stages.map((stage, index) => <span className={stages.indexOf(item.status) >= index ? "timeline-stage complete" : "timeline-stage"} key={stage}><i>{index + 1}</i>{stage === "new" ? "Received" : stage === "assigned" ? "Under review" : stage === "in_progress" ? "Action taken" : "Resolved"}</span>)}</div><p>{item.summary}</p></div>) : <p>{t.noData}</p>}</div></>; }

type AppNotification = import("./api").AppNotification;
type NotificationPreferences = import("./api").NotificationPreferences;

function useNotifications(enabled: boolean) {
  const [items, setItems] = React.useState<AppNotification[]>([]);
  const [unread, setUnread] = React.useState(0);
  const refresh = React.useCallback(async () => {
    if (!enabled) return;
    try { const result = await notificationApi.list(); setItems(result.notifications); setUnread(result.unread); } catch { /* silent: the bell hides when unreachable */ }
  }, [enabled]);
  React.useEffect(() => {
    if (!enabled) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30 * 1000);
    const onUpdated = () => void refresh();
    window.addEventListener("pehchaan-notifications-updated", onUpdated);
    return () => { window.clearInterval(timer); window.removeEventListener("pehchaan-notifications-updated", onUpdated); };
  }, [refresh]);
  return { items, unread, refresh };
}

const notificationTypeLabel: Record<AppNotification["type"], (lang: Language) => string> = {
  case_status_changed: (lang) => (lang === "hi" ? "केस अपडेट" : "Case update"),
  case_note_added: (lang) => (lang === "hi" ? "केसवर्कर नोट" : "Caseworker note"),
  wage_flagged: (lang) => (lang === "hi" ? "वेतन संदर्भ जांच" : "Fair-pay check"),
  scheme_matched: (lang) => (lang === "hi" ? "संभावित योजना" : "Scheme match"),
  case_assigned: (lang) => (lang === "hi" ? "केस असाइनमेंट" : "Assignment"),
  case_reopened: (lang) => (lang === "hi" ? "केस फिर खुला" : "Case re-opened"),
  alert_escalated: (lang) => (lang === "hi" ? "सुरक्षा अलर्ट" : "Safety alert"),
};

function NotificationCenter({ lang, enabled }: { lang: Language; enabled: boolean }) {
  const { items, unread, refresh } = useNotifications(enabled);
  const [open, setOpen] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);
  const [prefs, setPrefs] = React.useState<NotificationPreferences | null>(null);
  const [pushState, setPushState] = React.useState<"idle" | "subscribed" | "denied" | "unsupported" | "error">("idle");
  const [pushMessage, setPushMessage] = React.useState("");
  const hi = lang === "hi";
  React.useEffect(() => { if (open && !prefs) void notificationApi.preferences().then((result) => setPrefs(result.preferences)).catch(() => setPrefs(null)); }, [open, prefs]);
  React.useEffect(() => { if (pushSupported()) setPushState(Notification.permission === "granted" ? "subscribed" : Notification.permission === "denied" ? "denied" : "idle"); else setPushState("unsupported"); }, []);
  const markAll = async () => { try { await notificationApi.markRead(); await refresh(); } catch { /* ignore */ } };
  const togglePrefs = async (key: keyof NotificationPreferences) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] }; setPrefs(next);
    try { await notificationApi.updatePreferences({ [key]: next[key] }); window.dispatchEvent(new Event("pehchaan-notifications-updated")); } catch { setPrefs(prefs); }
  };
  const optIn = async () => {
    setPushMessage("");
    const result = await enablePush();
    setPushState(result === "subscribed" ? "subscribed" : result);
    setPushMessage(result === "subscribed" ? (hi ? "पुश नोटिफिकेशन चालू।" : "Push notifications are on.") : result === "denied" ? (hi ? "ब्राउज़र ने अनुमति अस्वीकार की।" : "Permission was denied in the browser.") : result === "unsupported" ? (hi ? "इस ब्राउज़र में पुश उपलब्ध नहीं है।" : "Push is not available in this browser.") : (hi ? "पुश सेटअप नहीं हो सका।" : "Push could not be set up."));
  };
  const optOut = async () => { await disablePush(); setPushState("idle"); setPushMessage(hi ? "पुश नोटिफिकेशन बंद।" : "Push notifications are off."); };
  if (!enabled) return null;
  return <div className="notif-wrap">
    <button className="notif-bell" aria-label={hi ? `नोटिफिकेशन${unread ? ` (${unread} नई)` : ""}` : `Notifications${unread ? ` (${unread} unread)` : ""}`} onClick={() => { setOpen(!open); if (!open && unread) void markAll(); }}>
      🔔{unread > 0 && <span className="notif-badge">{unread > 99 ? "99+" : unread}</span>}
    </button>
    {open && <div className="notif-panel" role="dialog" aria-label={hi ? "नोटिफिकेशन सेंटर" : "Notification center"}>
      <div className="notif-head"><strong>{hi ? "नोटिफिकेशन" : "Notifications"}</strong><button className="button button-small" onClick={() => setShowSettings(!showSettings)}>{hi ? "सेटिंग्स" : "Settings"}</button></div>
      {showSettings && <div className="notif-settings">
        <p className="helper">{hi ? "गैर-ज़रूरी नोटिफिकेशन बंद करें। सुरक्षा अलर्ट हमेशा भेजे जाते हैं।" : "Turn routine notifications off. Safety alerts are always delivered."}</p>
        {prefs ? ([
          ["caseUpdates", hi ? "केस स्थिति बदलना" : "Case status changes"],
          ["caseNotes", hi ? "केसवर्कर नोट्स" : "Caseworker notes"],
          ["wageFlags", hi ? "वेतन संदर्भ जांच" : "Fair-pay wage checks"],
          ["schemeMatches", hi ? "संभावित सरकारी योजनाएं" : "New scheme matches"],
        ] as [keyof NotificationPreferences, string][]).map(([key, label]) => <label key={key}><input type="checkbox" checked={prefs[key]} onChange={() => void togglePrefs(key)} /> {label}</label>) : <p className="helper">{hi ? "प्राथमिकताएं लोड नहीं हुईं।" : "Preferences could not be loaded."}</p>}
        <div className="notif-push-row">
          <span>{hi ? "पुश (ऐप बंद होने पर भी)" : "Push (even when the app is closed)"}</span>
          {pushState === "subscribed" ? <button className="button button-small" onClick={() => void optOut()}>{hi ? "बंद करें" : "Turn off"}</button> : <button className="button button-small" disabled={pushState === "unsupported" || pushState === "denied"} onClick={() => void optIn()}>{hi ? "चालू करें" : "Enable"}</button>}
        </div>
        {pushMessage && <p className="helper">{pushMessage}</p>}
      </div>}
      <div className="notif-list">
        {items.length ? items.map((item) => <div className={`notif-item${item.readAt ? "" : " notif-unread"}`} key={item.id}>
          <div><strong>{notificationTypeLabel[item.type]?.(lang) || item.type}{item.priority === "high" ? " · ⚠" : ""}</strong><span>{new Date(item.createdAt).toLocaleString()}</span><p>{item.body}</p></div>
        </div>) : <p className="empty-state">{hi ? "अभी कोई नोटिफिकेशन नहीं।" : "No notifications yet."}</p>}
      </div>
    </div>}
  </div>;
}

function WorkerArea({ lang, session, logout }: { lang: Language; session: Session; logout: () => void }) {
  const [dashboard, setDashboard] = React.useState<Dashboard | null>(null); const [loading, setLoading] = React.useState(true); const [offline, setOffline] = React.useState(false);
  const refresh = React.useCallback(async () => { setLoading(true); try { setDashboard(await workerApi.dashboard(session.workerId)); setOffline(false); } catch (cause) { setOffline(isOffline(cause)); } finally { setLoading(false); } }, [session.workerId]);
  React.useEffect(() => { void refresh(); }, [refresh]);
  React.useEffect(() => {
    const sync = async () => {
      const queue = await listOfflineItems().catch(() => []);
      for (const item of queue) {
        try {
          if (item.kind === "checkin") await workerApi.checkIn(item.body);
          else if (item.kind === "case") await workerApi.createCase(item.body);
          else await workerApi.addWage(item.body);
          await removeOfflineItem(item.id);
        } catch (cause) {
          if (!isOffline(cause)) await updateOfflineItem({ ...item, status: "failed", error: cause instanceof Error ? cause.message : "Sync failed." });
        }
      }
      window.dispatchEvent(new Event("offline-queue-updated"));
      if (queue.length) void refresh();
    };
    window.addEventListener("online", sync);
    void sync();
    return () => window.removeEventListener("online", sync);
  }, [refresh]);
  React.useEffect(() => {
    const migrateLegacyQueue = async () => {
      const raw = localStorage.getItem("pehchaan-offline-queue");
      if (!raw) return;
      let legacy: Array<{ id: string; kind: "checkin" | "case"; body: Record<string, unknown> }>;
      try { legacy = JSON.parse(raw) as Array<{ id: string; kind: "checkin" | "case"; body: Record<string, unknown> }>; } catch { localStorage.removeItem("pehchaan-offline-queue"); return; }
      for (const item of legacy) await queueWork(item);
      localStorage.removeItem("pehchaan-offline-queue");
    };
    void migrateLegacyQueue();
  }, []);
  const stubDashboard: Dashboard = { worker: { id: session.workerId, phone: "", role: "worker", language: lang, profile: {} }, wageEntries: [], checkIns: [], cases: [] };
  if (loading && !dashboard) return <WorkerLayout lang={lang} dashboard={stubDashboard} logout={logout}><Loading lang={lang} /></WorkerLayout>;
  if (!dashboard) return <WorkerLayout lang={lang} dashboard={stubDashboard} logout={logout}><ErrorBox lang={lang} offline={offline} onRetry={() => void refresh()} /></WorkerLayout>;
  return <WorkerLayout lang={lang} dashboard={dashboard} logout={logout}>{offline && <ErrorBox lang={lang} offline onRetry={() => void refresh()} />}<Routes><Route index element={<DashboardHome lang={lang} dashboard={dashboard} />} /><Route path="wages" element={<Wages lang={lang} dashboard={dashboard} refresh={refresh} />} /><Route path="check-in" element={<CheckIn lang={lang} dashboard={dashboard} refresh={refresh} />} /><Route path="report" element={<Report lang={lang} dashboard={dashboard} refresh={refresh} />} /><Route path="cases" element={<Cases lang={lang} dashboard={dashboard} />} /><Route path="schemes" element={<Schemes lang={lang} dashboard={dashboard} />} /><Route path="contacts" element={<Contacts lang={lang} dashboard={dashboard} />} /><Route path="profile" element={<Profile lang={lang} dashboard={dashboard} refresh={refresh} />} /></Routes></WorkerLayout>;
}

function ForOrganizations({ lang }: { lang: Language }) {
  const hi = lang === "hi";
  return <main className="page-hero"><p className="eyebrow">{hi ? "संस्थाओं के लिए" : "For Organizations"}</p><h1>{hi ? "भरोसेमंद जानकारी, तेज़ कार्रवाई।" : "Reliable information, faster action."}</h1><p>{hi ? "Pehchaan NGO केसवर्कर्स को श्रमिकों की शिकायतें व्यवस्थित देता है — ताकि सीमित संसाधनों में सबसे ज़रूरी मामलों पर पहले ध्यान दिया जा सके।" : "Pehchaan gives NGO caseworkers organized worker complaints, so limited resources go to the most urgent cases first."}</p><div className="detail-grid"><section className="list-panel"><h2>{hi ? "केस इनबॉक्स और AI ट्रायज" : "Case inbox and AI triage"}</h2><p>{hi ? "हर शिकायत सुझाव-प्राथमिकता के साथ आती है; निर्णय हमेशा मानव केसवर्कर का होता है।" : "Every complaint arrives with a suggested priority; the final call always stays with a human caseworker."}</p></section><section className="list-panel"><h2>{hi ? "सुरक्षा एस्कलेशन" : "Safety escalation"}</h2><p>{hi ? "तत्काल खतरे वाली रिपोर्ट सीधे हाई-प्रायोरिटी अलर्ट बनती हैं, जिन्हें 15 मिनट में स्वीकार न करने पर admin को बढ़ाया जाता है।" : "Immediate-danger reports become high-priority alerts that escalate to admins if not acknowledged within 15 minutes."}</p></section><section className="list-panel"><h2>{hi ? "विशेष पैटर्न संकेत" : "Special pattern signals"}</h2><p>{hi ? "एक ही नियोक्ता पर कई श्रमिकों की शिकायतें और बंधुआ मजदूरी के संकेत अलग से चिह्नित होते हैं — श्रम प्रवर्तन से समन्वन के लिए।" : "Multiple complaints against one employer and debt-bondage indicators are tagged separately for coordination with labour enforcement."}</p></section><section className="list-panel"><h2>{hi ? "गोपनीयता हमेशा पहले" : "Privacy first"}</h2><p>{hi ? "इम्पैक्ट रिपोर्ट में केवल समग्र आंकड़े होते हैं — नाम, फोन नंबर, प्रमाण या ठिकाने कभी शामिल नहीं होते।" : "Impact reports contain aggregate counts only — names, phone numbers, evidence, and exact locations are never included."}</p></section></div><div className="hero-actions"><Link className="button" to="/ngo/login">{hi ? "संस्था लॉगिन" : "Organization login"} →</Link><Link className="button button-ghost" to="/partner-signup">{hi ? "नई संस्था/नियोक्ता पंजीकरण" : "Apply to join"}</Link></div><p className="helper">{hi ? "नया खाता बनाने से पहले Pehchaan टीम हर आवेदन की जांच करती है।" : "Every new NGO and employer application is verified by the Pehchaan team before an account goes live."} {hi ? "पायलट डेमो लॉगिन: ngo@pehchaan.org / demo" : "Pilot demo login: ngo@pehchaan.org / demo"}</p></main>;
}

function HowItWorks({ lang }: { lang: Language }) {
  const hi = lang === "hi";
  const steps = hi
    ? [["1. मजदूरी दर्ज करें", "वादा की गई और मिली रकम हर काम के हिसाब से सहेजें — एक साथ कई काम भी चल सकते हैं।"], ["2. सुरक्षा जांच करें", "हर दिन एक टैप में बताएं कि आप सुरक्षित हैं या मदद चाहिए। मदद मांगने पर भरोसेमंद संपर्क और संस्था को सूचना जाती है।"], ["3. समस्या बताएं", "मजदूरी, सुरक्षा, उत्पीड़न या बंधुआ मजदूरी — शिकायत भरोसेमंद संस्था तक पहुंचती है और आपके रिकॉर्ड में सुरक्षित रहती है।"]] : [["1. Record your wages", "Save promised and received amounts per job — you can work several jobs at once."], ["2. Check in daily", "One tap to say you are safe or that you need help. Help requests notify your trusted contacts and partner organizations."], ["3. Report a problem", "Wages, safety, harassment, or debt bondage — complaints reach trusted organizations and stay in your own record."]];
  return <main className="page-hero"><p className="eyebrow">{t_public(lang, "how")}</p><h1>{hi ? "तीन कदम, आपकी पहचान आपके हाथ।" : "Three steps, your record in your hands."}</h1><div className="detail-grid">{steps.map(([title, body]) => <section className="list-panel" key={title}><h2>{title}</h2><p>{body}</p></section>)}</div><p className="helper">{hi ? "स्मार्टफोन न हो तो भी काम चलता है — WhatsApp, SMS और USSD से भी मजदूरी दर्ज और मदद मांगी जा सकती है।" : "No smartphone needed — wages and help requests also work over WhatsApp, SMS, and USSD."}</p><div className="hero-actions"><Link className="button" to="/worker/login">{hi ? "श्रमिक लॉगिन" : "Worker login"} →</Link></div></main>;
}

function SafetyPage({ lang }: { lang: Language }) {
  const hi = lang === "hi";
  return <main className="page-hero"><p className="eyebrow">{t_public(lang, "safety")}</p><h1>{hi ? "सुरक्षा: एक टैप में मदद।" : "Safety: help in one tap."}</h1><div className="detail-grid"><section className="list-panel"><h2>{hi ? "सुरक्षा जांच" : "Safety check-in"}</h2><p>{hi ? "हर दिन बताएं कि आप सुरक्षित हैं। लगातार जांच न होने पर संस्था संपर्क कर सकती है।" : "Check in every day to say you are safe. Missed check-ins can prompt your organization to reach out."}</p></section><section className="list-panel"><h2>{hi ? "भरोसेमंद संपर्क" : "Trusted contacts"}</h2><p>{hi ? "आप 5 तक संपर्क जोड़ सकते हैं। हर संपर्क आपकी पुष्टि के बाद ही अलर्ट पाता है, और आप पहले टेस्ट संदेश भेजकर जांच सकते हैं।" : "Add up to 5 contacts. Each one only receives alerts after your explicit confirmation, and you can send a test message first."}</p></section><section className="list-panel"><h2>{hi ? "एस्कलेशन" : "Escalation"}</h2><p>{hi ? "ज़रूरी अलर्ट स्वीकार न होने पर अपने-आप NGO admin तक बढ़ता है — कोई सूचना अनसुनी नहीं रहती।" : "Unacknowledged urgent alerts escalate automatically to an NGO admin — no alert goes unheard."}</p></section></div><p className="helper">{hi ? "Pehchaan आपात सेवाओं, पुलिस या अदालत का विकल्प नहीं है। तत्काल खतरे में 112 पर कॉल करें।" : "Pehchaan does not replace emergency services, police, or courts. If you are in immediate danger, call 112."}</p></main>;
}

function AboutPage({ lang }: { lang: Language }) {
  const hi = lang === "hi";
  const [mission, setMission] = React.useState<string | null>(null);
  React.useEffect(() => { contentApi.page("about-mission").then((page) => setMission(page.locales[lang]?.body || page.locales.en?.body || null)).catch(() => setMission(null)); }, [lang]);
  return <main className="page-hero"><p className="eyebrow">{t_public(lang, "about")}</p><h1>{hi ? "हर श्रमिक की आवाज़, उसका अपना रिकॉर्ड।" : "Every worker's voice, their own record."}</h1><p>{mission || (hi ? "पहचान प्रवासी और अनौपचारिक श्रमिकों के लिए बनी है — जो अक्सर कई काम एक साथ करते हैं और जिनका कोई लिखित रिकॉर्ड नहीं होता। हम श्रमिक की जानकारी व्यवस्थित करके भरोसेमंद संस्थाओं तक पहुंचाते हैं।" : "Pehchaan is built for migrant and informal workers who often hold several jobs at once and rarely have written records. We organize worker information and route it to trusted organizations.")}</p><div className="detail-grid"><section className="list-panel"><h2>{hi ? "श्रमिक का नियंत्रण" : "Worker control"}</h2><p>{hi ? "रिकॉर्ड श्रमिक का अपना है — वह अपना पूरा डेटा कभी भी PDF, CSV या JSON में डाउनलोड कर सकता है, किसी की अनुमति के बिना।" : "The record belongs to the worker — they can download their complete data as PDF, CSV, or JSON anytime, without anyone's approval."}</p></section><section className="list-panel"><h2>{hi ? "सीमाएं साफ़" : "Clear limits"}</h2><p>{hi ? "हम बचाव नहीं करते, कानूनी प्रतिनिधित्व नहीं करते, और निर्णय नहीं लेते — सूचना व्यवस्थित करते हैं ताकि सही संस्था सही काम कर सके।" : "We do not rescue, provide legal representation, or make decisions — we organize information so the right organization can do the right work."}</p></section><section className="list-panel"><h2>{hi ? "गोपनीयता" : "Privacy"}</h2><p>{hi ? "प्रमाण एन्क्रिप्टेड स्टोरेज में, संवेदनशील जानकारी केवल अधिकृत केसवर्कर तक, और रिपोर्ट्स में केवल समग्र आंकड़े।" : "Evidence in encrypted storage, sensitive data only for authorized caseworkers, and aggregate counts only in reports."}</p></section></div></main>;
}

function JoinPilot({ lang }: { lang: Language }) {
  const hi = lang === "hi";
  return <main className="page-hero"><p className="eyebrow">{t_public(lang, "join")}</p><h1>{hi ? "पायलट से जुड़ें।" : "Join the pilot."}</h1><p>{hi ? "हम उन NGO और श्रमिक समुदायों के साथ काम कर रहे हैं जो मजदूरी, सुरक्षा और बंधुआ मजदूरी के मामलों पर रिकॉर्डिंग चाहते हैं।" : "We are working with NGOs and worker communities who want organized records for wage, safety, and debt bondage cases."}</p><div className="hero-actions"><Link className="button" to="/worker/login">{hi ? "श्रमिक के रूप में शुरू करें" : "Start as a worker"} →</Link><Link className="button button-ghost" to="/ngo/login">{hi ? "संस्था लॉगिन" : "Organization login"}</Link><Link className="button button-ghost" to="/employer/interest">{hi ? "नियोक्ता साझेदारी" : "Employer partnership"}</Link></div><p className="helper">{hi ? "पायलट डेमो: OTP मोड में 123456 डालें · NGO: ngo@pehchaan.org / demo" : "Pilot demo: use OTP 123456 in demo mode · NGO: ngo@pehchaan.org / demo"}</p><CmsFaqSection lang={lang} /></main>;
}

function CmsFaqSection({ lang }: { lang: Language }) {
  const [body, setBody] = React.useState<string | null>(null);
  React.useEffect(() => { contentApi.page("faq").then((page) => setBody(page.locales[lang]?.body || page.locales.en?.body || null)).catch(() => setBody(null)); }, [lang]);
  if (!body) return null;
  return <section className="faq-section"><h2>{lang === "hi" ? "सामान्य प्रश्न" : "Frequently asked questions"}</h2><div className="cms-preview" dangerouslySetInnerHTML={{ __html: tinyMarkdown(body) }} /><p className="helper"><Link className="text-link" to="/faq">{lang === "hi" ? "पूरा FAQ पढ़ें →" : "Read the full FAQ →"}</Link></p></section>;
}

function ContentPage({ lang, slug }: { lang: Language; slug: string }) {
  const [page, setPage] = React.useState<import("./api").ContentPage | null>(null);
  const [error, setError] = React.useState(false);
  React.useEffect(() => { contentApi.page(slug).then(setPage).catch(() => setError(true)); }, [slug]);
  const locales = page ? Object.keys(page.locales) : [];
  const preferred = page ? (page.locales[lang] ? lang : page.locales.en ? "en" : locales[0]) : null;
  const entry = page && preferred ? page.locales[preferred] : null;
  return <main className="page-hero content-page"><p className="eyebrow">{page?.title || (lang === "hi" ? "जानकारी" : "Information")}</p>{error || (page && !entry) ? <div className="error-box"><p>{lang === "hi" ? "यह पेज अभी उपलब्ध नहीं है।" : "This page is not available yet."}</p></div> : !page ? <Loading lang={lang} /> : <><div className="filter-row">{locales.map((locale) => <span className={locale === preferred ? "filter active" : "filter"} key={locale}>{contentLocaleNames[locale] || locale}</span>)}</div><div className="cms-preview" dangerouslySetInnerHTML={{ __html: entry ? tinyMarkdown(entry.body) : "" }} /><p className="helper">{lang === "hi" ? "यह पेज Pehchaan टीम अपडेट करती है — नवीनतम संस्करण हमेशा यहीं दिखता है।" : "This page is maintained by the Pehchaan team — the latest published version always appears here."}</p></>}</main>;
}

function PublicPage({ lang, title }: { lang: Language; title: string }) { return <main className="page-hero"><p className="eyebrow">{title}</p><h1>{lang === "hi" ? "सुरक्षित सहायता तक एक साफ रास्ता।" : "A clear path to safer support."}</h1><p>{lang === "hi" ? "यह जानकारी पेज जल्द ही और विस्तार से उपलब्ध होगा।" : "This information page will be expanded soon."}</p></main>; }

const ngoText = {
  hi: { login: "संस्था लॉगिन", email: "ईमेल", password: "पासवर्ड", signIn: "लॉगिन करें", demo: "डेमो: ngo@pehchaan.org / demo", inbox: "केस इनबॉक्स", audit: "ऑडिट लॉग", all: "सभी", fresh: "नए", high: "उच्च प्राथमिकता", mine: "मुझे सौंपे गए", search: "केस या श्रमिक खोजें", noCases: "अभी कोई मामला नहीं है।", retry: "फिर कोशिश करें", loading: "लोड हो रहा है...", error: "जानकारी लोड नहीं हो सकी। कनेक्शन जांचकर फिर कोशिश करें।", assigned: "सौंपें", status: "स्थिति", note: "नोट जोड़ें", add: "जोड़ें", evidence: "प्रमाण", upload: "प्रमाण अपलोड करें", download: "डाउनलोड करें", scanning: "सुरक्षा जांच लंबित", notes: "नोट्स", history: "इतिहास", acknowledge: "अलर्ट स्वीकार करें", acknowledged: "स्वीकार किया गया", back: "इनबॉक्स पर लौटें", save: "सहेजें", logout: "लॉग आउट", logoutConfirm: "क्या आप लॉग आउट करना चाहते हैं?", aiSuggested: "AI-सुझाया", aiSummary: "AI सारांश", acceptAi: "सुझाव स्वीकार करें", overrideAi: "मानव प्राथमिकता", patterns: "नियोक्ता पैटर्न संकेत", patternNote: "यह केवल जांच का संकेत है, दंड का निर्णय नहीं।" , fraudFlag: "समीक्षा चिह्न", fraudFlagNote: "सिस्टम को यह शिकायत डुप्लीकेट/स्पैम जैसी लगी — केस खुला है, फैसला आपकी।", fraudAction: "धोखाधड़ी/स्पैम रिपोर्ट करें", fraudReason: "कारण", fraudDetail: "विवरण (वैकल्पिक)", fraudSubmit: "रिपोर्ट दर्ज करें", fraudReported: "रिपोर्ट दर्ज हो गई — platform team को दिख जाएगी।", fraudDismissFlag: "झूठा चिह्न — हटाएं", fraudConfirmFlag: "स्पैम पुष्ट करें", fraudDone: "फैसला दर्ज हो गया।", fraudReviewHeading: "धोखाधड़ी/स्पैम समीक्षा", fraudNote: "चिह्न केवल समीक्षा के लिए है — असली श्रमिक की शिकायत कभी अपने आप रद्द नहीं होती।", fraudFilter: "चिह्नित" },
  en: { login: "Organization login", email: "Email", password: "Password", signIn: "Sign in", demo: "Demo: ngo@pehchaan.org / demo", inbox: "Case inbox", audit: "Audit log", all: "All", fresh: "New", high: "High priority", mine: "Assigned to me", search: "Search case or worker", noCases: "No cases yet.", retry: "Try again", loading: "Loading...", error: "Could not load this information. Check your connection and try again.", assigned: "Assign", status: "Status", note: "Add note", add: "Add", evidence: "Evidence", upload: "Upload evidence", download: "Download", scanning: "Security scan pending", notes: "Notes", history: "History", acknowledge: "Acknowledge alert", acknowledged: "Acknowledged", back: "Back to inbox", save: "Save", logout: "Log out", logoutConfirm: "Do you want to log out?", aiSuggested: "AI-suggested", aiSummary: "AI summary", acceptAi: "Accept suggestion", overrideAi: "Human priority", patterns: "Employer pattern signals", patternNote: "This is an investigation signal, not a penalty decision.", fraudFlag: "Flagged for review", fraudFlagNote: "The system found this complaint similar to recent ones or spam-like. The case stays open — the decision is yours.", fraudAction: "Report fraud/spam", fraudReason: "Reason", fraudDetail: "Detail (optional)", fraudSubmit: "Record report", fraudReported: "Fraud report recorded — visible to the platform team.", fraudDismissFlag: "Dismiss flag (genuine)", fraudConfirmFlag: "Confirm spam", fraudDone: "Review decision recorded.", fraudReviewHeading: "Fraud / spam review", fraudNote: "Flags are for review only — a genuine worker's complaint is never auto-rejected.", fraudFilter: "Flagged" },
} as const;
type NgoLabelSet = { [K in keyof typeof ngoText.en]: string };
const ngoLabels: Record<Language, NgoLabelSet> = {
  hi: ngoText.hi,
  en: ngoText.en,
  bn: ngoText.en,
  ta: ngoText.en,
  te: ngoText.en,
};

type NgoSession = { email: string; token: string; refreshToken: string; expiresAt: number; role?: string };
const ngoSessionKey = "pehchaan-ngo-session";
function getNgoSession(): NgoSession | null { try { const value = JSON.parse(localStorage.getItem(ngoSessionKey) || "null") as NgoSession | null; return value && value.expiresAt > Date.now() ? value : null; } catch { return null; } }

function NgoLogin({ lang, setSession }: { lang: Language; setSession: (session: NgoSession) => void }) {
  const t = ngoLabels[lang]; const [email, setEmail] = React.useState(""); const [password, setPassword] = React.useState(""); const [error, setError] = React.useState("");
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setError(""); try { const result = await authApi.ngoLogin(email, password); const session = { email, token: result.accessToken, refreshToken: result.refreshToken, expiresAt: Date.now() + result.expiresIn * 1000, role: result.user.role }; localStorage.setItem(ngoSessionKey, JSON.stringify(session)); setSession(session); } catch (cause) { const err = cause as Error & { offline?: boolean; status?: number }; const hi = lang === "hi"; if (err.offline) setError(hi ? "सर्वर से कनेक्शन नहीं हो पा रहा। कृपया जांचें कि API server (npm run dev:api) चल रहा है, फिर कोशिश करें।" : "Could not reach the server. Make sure the API server is running (npm run dev:api), then try again."); else if (err.status === 401) setError(hi ? "ईमेल या पासवर्ड गलत है। डेमो लॉगिन: ngo@pehchaan.org / demo" : "Email or password is incorrect. Demo login: ngo@pehchaan.org / demo"); else if (err.status === 429) setError(hi ? "बहुत ज़्यादा लॉगिन कोशिशें हो गई हैं। कृपया 15 मिनट बाद फिर कोशिश करें।" : "Too many login attempts. Please wait 15 minutes and try again."); else setError(hi ? `सर्वर उपलब्ध नहीं है। ${err.message || ""}` : `The server is unavailable. ${err.message || ""}`); } };
  return <main className="auth-page"><form className="auth-card" onSubmit={submit}><p className="eyebrow teal">{t.login}</p><h1>{t.login}</h1><label>{t.email}<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>{t.password}<input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label><button className="button">{t.signIn}</button><p className="helper">{t.demo}</p>{error && <p className="error">{error}</p>}</form></main>;
}

function NgoNav({ lang, logout, isAdmin }: { lang: Language; logout: () => void; isAdmin: boolean }) {
  const t = ngoLabels[lang]; const navigate = useNavigate();
  return <aside className="worker-nav ngo-nav"><Link className="brand" to="/ngo">{lang === "hi" ? "पहचान" : "Pehchaan"}<span>.</span></Link><NotificationCenter lang={lang} enabled /><button onClick={() => navigate("/ngo")}>{t.inbox}</button><button onClick={() => navigate("/ngo/analytics")}>{lang === "hi" ? "प्रभाव रिपोर्ट" : "Impact analytics"}</button>{isAdmin && <><button onClick={() => navigate("/ngo/minimum-wages")}>{lang === "hi" ? "न्यूनतम मजदूरी" : "Minimum wages"}</button><button onClick={() => navigate("/ngo/schemes")}>{lang === "hi" ? "सरकारी योजनाएं" : "Welfare schemes"}</button></>}<button onClick={() => navigate("/ngo/audit")}>{t.audit}</button><button className="logout-link" onClick={logout}>{t.logout}</button></aside>;
}

function NgoInbox({ lang }: { lang: Language }) {
  const t = ngoLabels[lang]; const [cases, setCases] = React.useState<NgoCase[]>([]); const [alerts, setAlerts] = React.useState<import("./api").Alert[]>([]); const [patterns, setPatterns] = React.useState<{ employer: string; complaintCount: number; independentWorkers: number; caseIds: string[]; signal: string }[]>([]); const [filter, setFilter] = React.useState("all"); const [search, setSearch] = React.useState(""); const [loading, setLoading] = React.useState(true); const [error, setError] = React.useState(false);
  const load = React.useCallback(async () => { setLoading(true); try { const [result, alertResult, patternResult] = await Promise.all([ngoApi.cases(), ngoApi.alerts(), ngoApi.aiPatterns().catch(() => ({ patterns: [] }))]); setCases(result.cases); setAlerts(alertResult.alerts); setPatterns(patternResult.patterns); setError(false); } catch { setError(true); } finally { setLoading(false); } }, []);
  React.useEffect(() => { void load(); }, [load]);
  const visible = cases.filter((item) => filter === "all" || (filter === "new" && item.status === "new") || (filter === "high" && (item.priority === "high" || item.type === "debt_bondage")) || (filter === "mine" && Boolean(item.owner)) || (filter === "flagged" && item.fraudReview?.flagged)).filter((item) => `${item.id} ${item.workerId} ${item.summary}`.toLowerCase().includes(search.toLowerCase()));
  if (loading) return <Loading lang={lang} />;
  if (error) return <div className="error-box"><p>{t.error}</p><button className="button button-small" onClick={() => void load()}>{t.retry}</button></div>;
  return <><div className="ngo-heading"><div><p className="eyebrow teal">Pehchaan NGO</p><h1>{t.inbox}</h1></div><input className="ngo-search" placeholder={t.search} value={search} onChange={(e) => setSearch(e.target.value)} /></div>{patterns.length > 0 && <section className="ai-patterns"><h2>{t.patterns}</h2><p>{t.patternNote}</p>{patterns.map((pattern) => <div className="pattern-row" key={pattern.employer}><strong>{pattern.employer}</strong><span>{pattern.independentWorkers} workers · {pattern.complaintCount} cases</span></div>)}</section>}{alerts.filter((alert) => alert.status === "pending" || alert.status === "escalated").map((alert) => <div className="alert-card" key={alert.id}><strong>{lang === "hi" ? "तत्काल सुरक्षा अलर्ट" : "Urgent safety alert"}</strong><span>{new Date(alert.createdAt).toLocaleString()}</span><button className="button button-small" onClick={() => void ngoApi.updateAlert(alert.id, { action: "acknowledge", actionTaken: "Caseworker contacted and reviewing." }).then(() => void load())}>{lang === "hi" ? "स्वीकार करें" : "Acknowledge"}</button></div>)}<div className="filter-row">{[["all", t.all], ["new", t.fresh], ["high", t.high], ["mine", t.mine], ["flagged", t.fraudFilter]].map(([value, label]) => <button className={filter === value ? "filter active" : "filter"} onClick={() => setFilter(value)} key={value}>{label}</button>)}</div><div className="list-panel">{visible.length ? visible.map((item) => <Link className="list-row case-row" to={`/ngo/cases/${item.id}`} key={item.id}><div><strong>{translatedCaseType(lang, item.type)}{item.type === "debt_bondage" && <small className="debt-tag"> ⚠ {lang === "hi" ? "बंधुआ मजदूरी — श्रम प्रवर्तन समन्वन देखें" : "Debt bondage — coordinate with labour enforcement"}</small>}</strong><span>{item.id} · {translatedStatus(lang, item.status)}</span></div><b className={`priority-${item.priority}`}>{item.priority}</b>{item.aiTriage && <small className="ai-badge">{t.aiSuggested}: {item.aiTriage.category}</small>}{item.fraudReview?.flagged && <small className="ai-badge fraud-badge">⚠ {t.fraudFlag}{item.fraudReview.fraudReported ? " · " + t.fraudConfirmFlag.replace(" पुष्ट करें", "") : ""}</small>}{item.debtBondage && <small className="debt-indicators">{[item.debtBondage.advanceTaken && (lang === "hi" ? "अग्रिम" : "advance"), item.debtBondage.cannotLeave && (lang === "hi" ? "जाने नहीं देना" : "cannot leave"), item.debtBondage.wagesWithheldForRepayment && (lang === "hi" ? "मजदूरी रोकी" : "wages withheld"), item.debtBondage.movementRestricted && (lang === "hi" ? "चाल-ढाल सीमित" : "movement restricted")].filter(Boolean).join(" · ")}</small>}<p>{item.aiSummary || item.summary}</p></Link>) : <p className="empty-state">{t.noCases}</p>}</div></>;
}

function NgoCaseDetail({ lang }: { lang: Language }) {
  const t = ngoLabels[lang]; const caseId = location.pathname.split("/").pop() || ""; const [detail, setDetail] = React.useState<CaseDetail | null>(null); const [loading, setLoading] = React.useState(true); const [note, setNote] = React.useState(""); const [busy, setBusy] = React.useState(false); const [error, setError] = React.useState(false); const [acknowledged, setAcknowledged] = React.useState(false); const [documentType, setDocumentType] = React.useState("wage_notice"); const [documentLanguage, setDocumentLanguage] = React.useState<"en" | "hi">("en"); const [documentId, setDocumentId] = React.useState(""); const [fraudReason, setFraudReason] = React.useState("spam"); const [fraudDetail, setFraudDetail] = React.useState(""); const [fraudMessage, setFraudMessage] = React.useState("");
  const load = React.useCallback(async () => { setLoading(true); try { setDetail(await ngoApi.detail(caseId)); setError(false); } catch { setError(true); } finally { setLoading(false); } }, [caseId]);
  React.useEffect(() => { void load(); }, [load]);
  if (loading) return <Loading lang={lang} />; if (error || !detail) return <div className="error-box"><p>{t.error}</p><button className="button button-small" onClick={() => void load()}>{t.retry}</button></div>;
  const update = async (body: Record<string, unknown>) => { setBusy(true); try { await ngoApi.updateCase(caseId, body); await load(); } finally { setBusy(false); } };
  const addNote = async (event: React.FormEvent) => { event.preventDefault(); if (!note.trim()) return; setBusy(true); try { await ngoApi.addNote(caseId, { author: "ngo-caseworker", text: note }); setNote(""); await load(); } finally { setBusy(false); } };
  const uploadEvidence = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type) || file.size > 10 * 1024 * 1024) return;
    setBusy(true);
    try {
      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const checksum = Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
      const created = await evidenceApi.createUpload(caseId, { fileName: file.name, mimeType: file.type, sizeBytes: file.size, consentPurpose: "case_support", consentAudience: "assigned_caseworkers" });
      const upload = await fetch(created.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!upload.ok) throw new Error("upload failed");
      await evidenceApi.complete(caseId, created.evidence.id, checksum);
      await load();
    } finally { setBusy(false); event.target.value = ""; }
  };
  const downloadEvidence = async (id: string) => { const result = await evidenceApi.downloadUrl(id); window.open(result.url, "_blank", "noopener,noreferrer"); };
  const generateDocument = async () => { setBusy(true); try { const result = await legalDocumentApi.generate(caseId, { documentType, language: documentLanguage }); setDocumentId(result.document.id); } finally { setBusy(false); } };
  const downloadDocument = async () => { if (!documentId) return; const url = await legalDocumentApi.download(documentId); window.open(url, "_blank", "noopener,noreferrer"); };
  return <><Link className="text-link" to="/ngo">← {t.back}</Link><div className="ngo-detail-head"><div><p className="eyebrow teal">{detail.case.id}</p><h1>{translatedCaseType(lang, detail.case.type)}</h1><p>{detail.case.summary}</p></div><button className="button button-small" onClick={() => void update({ status: "resolved" })} disabled={busy}>{t.save}</button></div>{detail.case.fraudReview?.flagged && <section className="ai-triage-card fraud-review-card"><div><strong>⚠ {t.fraudReviewHeading}</strong><p>{t.fraudFlagNote}</p>{detail.case.fraudReview?.signals?.length ? <small>{detail.case.fraudReview?.signals.join(" · ")}</small> : null}{detail.case.fraudReview?.disposition && <small>{detail.case.fraudReview?.disposition === "dismissed" ? "✓ " + t.fraudDismissFlag : "✓ " + t.fraudConfirmFlag} · {detail.case.fraudReview?.reviewedBy}</small>}{fraudMessage && <p className="success">{fraudMessage}</p>}</div><div className="ai-actions"><select value={fraudReason} onChange={(event) => setFraudReason(event.target.value)} aria-label={t.fraudReason}><option value="spam">{lang === "hi" ? "स्पैम" : "Spam"}</option><option value="duplicate">{lang === "hi" ? "डुप्लीकेट" : "Duplicate"}</option><option value="false_complaint">{lang === "hi" ? "झूठी शिकायत" : "False complaint"}</option><option value="harassment">{lang === "hi" ? "उत्पीड़न" : "Harassment"}</option><option value="other">{lang === "hi" ? "अन्य" : "Other"}</option></select><input value={fraudDetail} onChange={(event) => setFraudDetail(event.target.value)} placeholder={t.fraudDetail} aria-label={t.fraudDetail} /><button className="button button-small" disabled={busy || Boolean(detail.case.fraudReview?.fraudReported)} onClick={() => { setBusy(true); ngoApi.reportFraud(caseId, { reason: fraudReason, detail: fraudDetail }).then(() => { setFraudMessage(t.fraudReported); setFraudDetail(""); return load(); }).finally(() => setBusy(false)); }}>{t.fraudAction}</button><button className="button button-small" disabled={busy || detail.case.fraudReview?.disposition === "dismissed"} onClick={() => { setBusy(true); ngoApi.setFraudDisposition(caseId, "dismissed").then(() => { setFraudMessage(t.fraudDone); return load(); }).finally(() => setBusy(false)); }}>{t.fraudDismissFlag}</button><button className="button button-small" disabled={busy || detail.case.fraudReview?.disposition === "confirmed"} onClick={() => { setBusy(true); ngoApi.setFraudDisposition(caseId, "confirmed").then(() => { setFraudMessage(t.fraudDone); return load(); }).finally(() => setBusy(false)); }}>{t.fraudConfirmFlag}</button></div><p className="helper">{t.fraudNote}</p></section>}{detail.case.aiTriage && <section className="ai-triage-card"><div><strong>{t.aiSuggested}: {detail.case.aiTriage.category}</strong><span>Score {detail.case.aiTriage.score}/100 · {detail.case.aiTriage.generatedBy}</span><p>{detail.aiSummary || detail.case.summary}</p></div><div className="ai-actions"><button className="button button-small" onClick={() => void update({ aiDecision: "accept" })} disabled={busy || detail.case.aiTriage.humanDecision !== null}>{t.acceptAi}</button><select defaultValue="" onChange={(event) => event.target.value && void update({ aiDecision: "override", finalCategory: event.target.value })} disabled={busy}><option value="">Override...</option><option value="Urgent">Urgent</option><option value="Needs review">Needs review</option><option value="Routine">Routine</option></select></div>  </section>}<section className="list-panel legal-doc-panel"><h2>Legal document</h2><p className="helper">Review before sharing. This is not legal advice.</p><div className="inline-form"><select value={documentType} onChange={(event) => setDocumentType(event.target.value)}><option value="wage_notice">Wage Recovery Notice</option><option value="safety_report">Safety Incident Report</option></select><select value={documentLanguage} onChange={(event) => setDocumentLanguage(event.target.value as "en" | "hi")}><option value="en">English</option><option value="hi">Hindi</option></select><button className="button button-small" onClick={() => void generateDocument()} disabled={busy}>Generate for review</button>{documentId && <button className="button button-small" onClick={() => void downloadDocument()} disabled={busy}>Download PDF</button>}  </div></section><div className="detail-grid">{detail.case.debtBondage && <section className="list-panel debt-bondage-panel"><h2>{lang === "hi" ? "बंधुआ मजदूरी संकेतक" : "Debt bondage indicators"}</h2><ul>{[[detail.case.debtBondage.advanceTaken, lang === "hi" ? "अग्रिम/कर्ज़ लिया गया" : "Advance/loan taken"], [detail.case.debtBondage.cannotLeave, lang === "hi" ? "काम छोड़ने नहीं दिया जाना" : "Cannot leave until repaid"], [detail.case.debtBondage.wagesWithheldForRepayment, lang === "hi" ? "मजदूरी रोकी/कम की गई" : "Wages withheld to repay"], [detail.case.debtBondage.movementRestricted, lang === "hi" ? "चाल-ढाल सीमित" : "Movement restricted"]].map(([checked, label]) => <li key={String(label)}>{checked ? "☑" : "☐"} {String(label)}</li>)}</ul><p className="helper">{lang === "hi" ? "इन मामलों में श्रम प्रवर्तन अधिकारियों से समन्वन अक्सर ज़रूरी होता है।" : "These cases often require coordination with labour enforcement authorities."}</p></section>}
      <section className="list-panel"><h2>{t.status}</h2><div className="status-buttons">{["new", "assigned", "in_progress", "resolved"].map((status) => <button className={detail.case.status === status ? "filter active" : "filter"} onClick={() => void update({ status })} key={status}>{translatedStatus(lang, status)}</button>)}</div><label>{t.assigned}<input defaultValue={detail.case.owner || ""} onBlur={(e) => e.target.value && void update({ owner: e.target.value })} placeholder={lang === "hi" ? "केसवर्कर का नाम" : "Caseworker name"} /></label>{detail.case.priority === "high" && <div className="alert-card"><strong>{lang === "hi" ? "उच्च प्राथमिकता सुरक्षा अलर्ट" : "High priority safety alert"}</strong><button className="button button-small" onClick={() => setAcknowledged(true)} disabled={acknowledged}>{acknowledged ? t.acknowledged : t.acknowledge}</button></div>}</section><section className="list-panel"><h2>{t.notes}</h2>{detail.notes.map((item) => <div className="timeline-item" key={item.id}><strong>{item.author}</strong><span>{new Date(item.createdAt).toLocaleString()}</span><p>{item.text}</p></div>)}<form onSubmit={addNote} className="note-form"><textarea required value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.note} /><button className="button button-small" disabled={busy}>{t.add}</button></form></section><section className="list-panel"><h2>{t.evidence}</h2><label className="button button-small">{t.upload}<input type="file" accept=".jpg,.jpeg,.png,.pdf" hidden onChange={(event) => void uploadEvidence(event)} /></label>{detail.evidence.length ? detail.evidence.map((item) => <div className="list-row" key={item.id}><strong>{item.fileName}</strong><span>{item.type} · {new Date(item.createdAt).toLocaleDateString()}</span>{item.available ? <button className="button button-small" onClick={() => void downloadEvidence(item.id)}>{t.download}</button> : <small>{t.scanning}</small>}</div>) : <p>{t.noCases}</p>}</section><section className="list-panel"><h2>{t.history}</h2>{detail.auditLog.map((item) => <div className="timeline-item" key={item.id}><strong>{item.action}</strong><span>{item.actor} · {new Date(item.timestamp).toLocaleString()}</span></div>)}</section></div></>;
}

function NgoAudit({ lang }: { lang: Language }) { const t = ngoLabels[lang]; const [entries, setEntries] = React.useState<CaseDetail["auditLog"]>([]); const [loading, setLoading] = React.useState(true); React.useEffect(() => { ngoApi.audit().then((result) => setEntries(result.entries)).finally(() => setLoading(false)); }, []); if (loading) return <Loading lang={lang} />; return <><h1>{t.audit}</h1><div className="list-panel">{entries.length ? entries.map((entry) => <div className="timeline-item" key={entry.id}><strong>{entry.action}</strong><span>{entry.actor} · {new Date(entry.timestamp).toLocaleString()}</span></div>) : <p>{t.noCases}</p>}</div></>; }
function NgoAnalytics({ lang }: { lang: Language }) { const [range, setRange] = React.useState("month"); const [report, setReport] = React.useState<import("./api").ImpactReport | null>(null); const [error, setError] = React.useState(""); const exportCsv = async () => { const session = JSON.parse(localStorage.getItem(ngoSessionKey) || "null") as NgoSession | null; const response = await fetch(ngoApi.impactCsv(range), { headers: { Authorization: `Bearer ${session?.token || ""}` } }); if (!response.ok) throw new Error("export failed"); const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "pehchaan-impact-summary.csv"; link.click(); URL.revokeObjectURL(url); }; React.useEffect(() => { ngoApi.impact(range).then(setReport).catch(() => setError(lang === "hi" ? "केवल अधिकृत NGO admin यह रिपोर्ट देख सकते हैं।" : "Only an authorized NGO admin can view this report.")); }, [lang, range]); if (error) return <div className="error-box"><p>{error}</p></div>; if (!report) return <Loading lang={lang} />; return <><div className="ngo-heading"><div><p className="eyebrow teal">Anonymized reporting</p><h1>{lang === "hi" ? "प्रभाव रिपोर्ट" : "Impact analytics"}</h1></div><select value={range} onChange={(e) => setRange(e.target.value)}><option value="month">This month</option><option value="quarter">This quarter</option></select><button className="button button-small" onClick={() => void exportCsv()}>CSV export</button></div><div className="stats-grid"><div className="stat-card"><span>Workers supported</span><strong>{report.workersSupported}</strong></div><div className="stat-card"><span>Cases documented</span><strong>{report.casesDocumented}</strong></div><div className="stat-card"><span>Average response</span><strong>{report.averageResponseHours}h</strong></div></div><div className="detail-grid"><section className="list-panel"><h2>Cases by category</h2>{Object.entries(report.casesByCategory).map(([key, value]) => <div className="list-row" key={key}><strong>{key}</strong><span>{value}</span></div>)}</section><section className="list-panel"><h2>Language usage</h2>{Object.entries(report.languageUsage).map(([key, value]) => <div className="list-row" key={key}><strong>{key}</strong><span>{value}</span></div>)}</section><section className="list-panel"><h2>Region distribution</h2>{Object.entries(report.geographicDistribution).map(([key, value]) => <div className="list-row" key={key}><strong>{key}</strong><span>{value}</span></div>)}</section></div><p className="helper">This report contains aggregate counts only. Worker names, phone numbers, evidence, notes, and exact locations are never included.</p></>; }

function MinimumWageAdmin() { const [rates, setRates] = React.useState<import("./api").MinimumWageRate[]>([]); const [message, setMessage] = React.useState(""); React.useEffect(() => { minimumWageApi.list().then((result) => setRates(result.rates)).catch(() => setMessage("Could not load wage references.")); }, []); return <><h1>Minimum wage references</h1><div className="list-panel"><p><strong>Reference data is now maintained by the Pehchaan platform team.</strong></p><p className="helper">To correct an outdated rate, contact your platform admin (platform@pehchaan.org) with the state, category, amount, and the official notification reference. The table below is the live reference used for fair-pay checks.</p></div><div className="list-panel">{rates.map((rate) => <div className="list-row" key={rate.id}><strong>{rate.state} · {rate.workerCategory}</strong><span>₹{rate.dailyAmount}/day · effective {rate.effectiveFrom}</span></div>)}{!rates.length && <p>{message || "No reference rates published yet."}</p>}</div></>; }
function NgoArea({ lang, logout, session }: { lang: Language; logout: () => void; session: NgoSession }) { return <main className="worker-app"><NgoNav lang={lang} logout={logout} isAdmin={session.role === "ngo_admin"} /><section className="worker-content"><Routes><Route index element={<NgoInbox lang={lang} />} /><Route path="cases/:id" element={<NgoCaseDetail lang={lang} />} /><Route path="analytics" element={<NgoAnalytics lang={lang} />} /><Route path="audit" element={<NgoAudit lang={lang} />} /><Route path="minimum-wages" element={session.role === "ngo_admin" ? <MinimumWageAdmin /> : <Navigate to="/ngo" replace />} /><Route path="schemes" element={session.role === "ngo_admin" ? <SchemeAdmin /> : <Navigate to="/ngo" replace />} /></Routes></section></main>; }

function EmployerLogin({ setSession }: { setSession: (value: NgoSession) => void }) { const [email, setEmail] = React.useState(""); const [password, setPassword] = React.useState(""); const [error, setError] = React.useState(""); const submit = async (event: React.FormEvent) => { event.preventDefault(); try { const result = await authApi.employerLogin(email, password); const value = { email, token: result.accessToken, refreshToken: result.refreshToken, expiresAt: Date.now() + result.expiresIn * 1000 }; localStorage.setItem("pehchaan-employer-session", JSON.stringify(value)); setSession(value); } catch { setError("Employer credentials are invalid or access is pending approval."); } }; return <main className="auth-page"><form className="auth-card" onSubmit={submit}><p className="eyebrow teal">Employer portal</p><h1>Fair work transparency</h1><label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label><button className="button">Sign in</button>{error && <p className="error">{error}</p>}</form></main>; }
function EmployerInterest() { const [sent, setSent] = React.useState(false); const submit = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); await employerApi.interest({ name: form.get("name"), email: form.get("email"), organization: form.get("organization"), message: form.get("message") }); setSent(true); }; return <main className="auth-page"><form className="auth-card" onSubmit={submit}><p className="eyebrow teal">Employer partnership</p><h1>Build trust with fair work records</h1>{sent ? <p className="success">Thank you. Our team will contact you after review.</p> : <><label>Name<input name="name" required /></label><label>Work email<input name="email" type="email" required /></label><label>Organization<input name="organization" required /></label><label>Message<textarea name="message" /></label><button className="button">Request onboarding</button></>}</form></main>; }
function EmployerArea({ logout }: { logout: () => void }) { const [data, setData] = React.useState<{ records: import("./api").EmployerRecord[]; compliance: { flagged: number; responded: number; responseRate: number; badge: string } } | null>(null); const [error, setError] = React.useState(""); const [response, setResponse] = React.useState<Record<string, string>>({}); const [siteName, setSiteName] = React.useState(""); const [qr, setQr] = React.useState<{ name: string; code: string; dataUrl: string } | null>(null); React.useEffect(() => { employerApi.dashboard().then(setData).catch(() => setError("Could not load employer records.")); }, []); if (error) return <main className="worker-content"><p className="error">{error}</p></main>; if (!data) return <Loading lang="en" />; const createQr = async (event: React.FormEvent) => { event.preventDefault(); const result = await employerApi.createWorksite(siteName); setQr({ name: result.worksite.name, code: result.worksite.registrationCode, dataUrl: result.qrDataUrl }); setSiteName(""); }; return <main className="worker-app"><aside className="worker-nav"><Link className="brand" to="/">Pehchaan<span>.</span></Link><strong>Employer portal</strong><button className="logout-link" onClick={logout}>Log out</button></aside><section className="worker-content employer-portal"><p className="eyebrow teal">Responsible employer tools</p><h1>Fair work transparency</h1><div className="stats-grid"><div className="stat-card"><span>Compliance signal</span><strong>{data.compliance.badge}</strong></div><div className="stat-card"><span>Response rate</span><strong>{data.compliance.responseRate}%</strong></div><div className="stat-card"><span>Worker privacy</span><strong>Protected</strong></div></div><div className="list-panel"><h2>Register a worksite QR</h2><form onSubmit={createQr} className="inline-form"><input required value={siteName} onChange={(event) => setSiteName(event.target.value)} placeholder="Worksite name" /><button className="button button-small">Generate QR</button></form>{qr && <div className="qr-card"><img src={qr.dataUrl} alt={`QR code for ${qr.name}`} /><strong>{qr.name}</strong><small>Code: {qr.code}</small></div>}</div><div className="list-panel"><h2>Wage records</h2>{data.records.length ? data.records.map((record) => <div className="list-row" key={record.id}><strong>{record.period}</strong><span>Promised ₹{record.promisedAmount} · Paid ₹{record.paidAmount} · {record.status}</span>{record.status === "disputed" && <><input value={response[record.id] || ""} onChange={(e) => setResponse({ ...response, [record.id]: e.target.value })} placeholder="Your response" /><button className="button button-small" onClick={() => void employerApi.respond(record.id, response[record.id] || "").then(() => setData({ ...data, records: data.records.map((item) => item.id === record.id ? { ...item, status: "responded" } : item) }))}>Respond</button></>}</div>) : <p>No consented wage records yet.</p>}</div><p className="helper">Private complaints, evidence, NGO notes, and other employers' data are never shown here.</p></section></main>; }

const platformSessionKey = "pehchaan-platform-session";
type PlatformSession = { email: string; token: string; refreshToken: string; expiresAt: number };
function getPlatformSession(): PlatformSession | null { try { const value = JSON.parse(localStorage.getItem(platformSessionKey) || "null") as PlatformSession | null; return value && value.expiresAt > Date.now() ? value : null; } catch { return null; } }

function PlatformLogin({ setSession }: { setSession: (session: PlatformSession) => void }) {
  const [email, setEmail] = React.useState(""); const [password, setPassword] = React.useState(""); const [error, setError] = React.useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    try {
      const result = await authApi.platformLogin(email, password);
      if (result.user.role !== "platform_admin") throw new Error("This account is not a platform admin.");
      const session = { email, token: result.accessToken, refreshToken: result.refreshToken, expiresAt: Date.now() + result.expiresIn * 1000 };
      localStorage.setItem(platformSessionKey, JSON.stringify(session)); setSession(session);
    } catch (cause) { setError(cause instanceof Error && cause.message !== "Request failed." ? cause.message : "Invalid platform credentials."); }
  };
  return <main className="auth-page"><form className="auth-card" onSubmit={submit}><p className="eyebrow teal">Pehchaan platform team</p><h1>Platform admin</h1><p className="helper">Internal operations panel — separate from NGO, employer, and partner accounts. Requests are rate-limited and audited.</p><label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label><button className="button">Sign in</button>{error && <p className="error">{error}</p>}</form></main>;
}

function PlatformNav({ logout }: { logout: () => void }) {
  const navigate = useNavigate();
  return <aside className="worker-nav ngo-nav"><Link className="brand" to="/platform">Pehchaan<span>.</span></Link><strong>Platform admin</strong><button onClick={() => navigate("/platform")}>Overview</button><button onClick={() => navigate("/platform/approvals")}>Approval queue</button><button onClick={() => navigate("/platform/fraud")}>Fraud &amp; abuse</button><button onClick={() => navigate("/platform/content")}>Content</button><button onClick={() => navigate("/platform/reference")}>Reference data</button><button onClick={() => navigate("/platform/accounts")}>Accounts &amp; recovery</button><button onClick={() => navigate("/platform/audit")}>Audit log</button><button className="logout-link" onClick={logout}>Log out</button></aside>;
}

function PlatformArea({ logout }: { logout: () => void }) {
  return <main className="worker-app"><PlatformNav logout={logout} /><section className="worker-content"><Routes><Route index element={<PlatformOverview />} /><Route path="approvals" element={<PlatformApprovals />} /><Route path="fraud" element={<PlatformFraud />} /><Route path="content" element={<PlatformContentEditor />} /><Route path="reference" element={<PlatformReference />} /><Route path="accounts" element={<PlatformAccounts />} /><Route path="audit" element={<PlatformAudit />} /></Routes></section></main>;
}

function PlatformOverview() {
  const [data, setData] = React.useState<{ overview: import("./api").PlatformOverview; summary: import("./api").PlatformSummary } | null>(null); const [error, setError] = React.useState("");
  React.useEffect(() => { platformApi.overview().then(setData).catch(() => setError("Could not load the platform overview.")); }, []);
  if (error) return <div className="error-box"><p>{error}</p></div>;
  if (!data) return <Loading lang="en" />;
  const { overview, summary } = data;
  return <>
    <div className="ngo-heading"><div><p className="eyebrow teal">Pehchaan platform team</p><h1>Platform overview</h1></div></div>
    <p className="helper">Aggregate operational view across all organizations — totals and response signals only. Individual case content, worker identities, and contact details are never shown in this panel; the funder-facing impact report is a separate tool.</p>
    <div className="stats-grid">
      <div className="stat-card"><span>Active organizations</span><strong>{overview.organizations.active}</strong></div>
      <div className="stat-card"><span>Pending approvals</span><strong>{summary.queue.pending}</strong></div>
      <div className="stat-card"><span>Cases across platform</span><strong>{overview.cases.total}</strong></div>
      <div className="stat-card"><span>Median resolution time</span><strong>{overview.medianResponseHours === null ? "—" : `${overview.medianResponseHours}h`}</strong></div>
      <div className="stat-card"><span>Workers registered</span><strong>{overview.workers.total}</strong></div>
      <div className="stat-card"><span>Open recovery requests</span><strong>{summary.recoveryRequests}</strong></div>
      <div className="stat-card"><span>Cases flagged for review</span><strong>{summary.fraud.pendingReview}</strong></div>
    </div>
    <div className="detail-grid">
      <section className="list-panel"><h2>Organizations</h2>
        <div className="list-row"><strong>Active NGOs</strong><span>{summary.organizations.ngos}</span></div>
        <div className="list-row"><strong>Active employers</strong><span>{summary.organizations.employers}</span></div>
        <div className="list-row"><strong>Deactivated</strong><span>{overview.organizations.deactivated}</span></div>
        <div className="list-row"><strong>Queue: NGOs / employers</strong><span>{summary.queue.pendingNgos} / {summary.queue.pendingEmployers}</span></div>
      </section>
      <section className="list-panel"><h2>Case load (all NGOs)</h2>
        <div className="list-row"><strong>Open</strong><span>{overview.cases.open}</span></div>
        {Object.entries(overview.cases.openByStatus).map(([key, value]) => <div className="list-row" key={key}><strong>· {key}</strong><span>{value}</span></div>)}
        <div className="list-row"><strong>Resolved</strong><span>{overview.cases.resolved}</span></div>
        <div className="list-row"><strong>New in last 30 days</strong><span>{overview.cases.createdLast30Days}</span></div>
      </section>
      <section className="list-panel"><h2>Safety alerts</h2>
        <div className="list-row"><strong>Pending</strong><span>{overview.alerts.pending}</span></div>
        <div className="list-row"><strong>Escalated</strong><span>{overview.alerts.escalated}</span></div>
        <div className="list-row"><strong>Acknowledged</strong><span>{overview.alerts.acknowledged}</span></div>
      </section>
      <section className="list-panel"><h2>Reference data</h2>
        <div className="list-row"><strong>Minimum wage rates</strong><span>{summary.referenceData.minimumWageRates}</span></div>
        <div className="list-row"><strong>Welfare schemes</strong><span>{summary.referenceData.welfareSchemes}</span></div>
        <p className="helper">Updated by the platform team from the Reference data tab; every change is recorded in the audit log.</p>
      </section>
    </div>
    <p className="helper">Generated {new Date(overview.generatedAt).toLocaleString()}</p>
  </>;
}

function PlatformApprovals() {
  const [filter, setFilter] = React.useState<"pending" | "approved" | "rejected" | "deactivated">("pending");
  const [applications, setApplications] = React.useState<import("./api").PlatformApplication[]>([]);
  const [loading, setLoading] = React.useState(true); const [error, setError] = React.useState(""); const [message, setMessage] = React.useState("");
  const load = React.useCallback(async () => { setLoading(true); try { setApplications((await platformApi.applications(filter)).applications); setError(""); } catch { setError("Could not load the approval queue."); } finally { setLoading(false); } }, [filter]);
  React.useEffect(() => { void load(); }, [load]);
  const decide = async (item: import("./api").PlatformApplication, body: Record<string, unknown>, note: string) => { setMessage(""); setError(""); try { await platformApi.decide(item.id, body); setMessage(note); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Action failed."); } };
  const reject = (item: import("./api").PlatformApplication) => { const reason = window.prompt(`Reason for rejecting ${item.organizationName} (shared with the applicant):`); if (reason) void decide(item, { decision: "reject", reason }, "Application rejected."); };
  return <>
    <h1>Approval queue</h1>
    <p className="helper">New NGO and employer sign-ups wait here before they can access any worker data. Every application must carry a registration number or official domain — the server rejects approvals without one. Approving an employer provisions a verified worksite QR seed; approved organizations still receive their credentials out of band.</p>
    <div className="filter-row">{[["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"], ["deactivated", "Deactivated"]].map(([value, label]) => <button className={filter === value ? "filter active" : "filter"} onClick={() => setFilter(value as typeof filter)} key={value}>{label}</button>)}</div>
    {message && <p className="success">{message}</p>}
    {error && <div className="error-box"><p>{error}</p></div>}
    <div className="list-panel">
      {loading ? <p>Loading...</p> : applications.length ? applications.map((item) => (
        <div className="list-row" key={item.id}>
          <div>
            <strong>{item.organizationName} <small>· {item.kind === "ngo" ? "NGO" : "Employer"}</small></strong>
            <span>{item.contactName} · {item.contactEmail}{item.contactPhone ? ` · ${item.contactPhone}` : ""}</span>
            {item.notes && <p>{item.notes}</p>}
            <small>Verification: {item.registrationNumber ? `Reg. no. ${item.registrationNumber}` : ""}{item.registrationNumber && item.officialDomain ? " · " : ""}{item.officialDomain ? `Domain ${item.officialDomain}` : ""}{!item.registrationNumber && !item.officialDomain ? <b> none provided — approval blocked</b> : ""}</small>
            {item.status === "rejected" && item.rejectionReason && <p className="error">Reason: {item.rejectionReason}</p>}
            <small>Applied {new Date(item.createdAt).toLocaleString()}{item.reviewedBy ? ` · reviewed by ${item.reviewedBy}` : ""}</small>
          </div>
          <div className="contact-actions">
            {item.status === "pending" && <>
              <button className="button button-small" onClick={() => void decide(item, { decision: "approve" }, "Application approved.")}>Approve</button>
              <button className="button button-small" onClick={() => reject(item)}>Reject</button>
            </>}
            {item.status === "approved" && <button className="button button-small" onClick={() => void decide(item, { decision: "deactivate" }, "Account deactivated.")}>Deactivate</button>}
            {item.status === "deactivated" && <button className="button button-small" onClick={() => void decide(item, { decision: "reactivate" }, "Account reactivated.")}>Reactivate</button>}
          </div>
        </div>
      )) : <p className="empty-state">Nothing in this queue right now.</p>}
    </div>
  </>;
}

function PlatformFraud() {
  const [data, setData] = React.useState<{ reports: import("./api").FraudReport[]; total: number; overview: import("./api").FraudAbuseOverviewRow[] } | null>(null);
  const [error, setError] = React.useState("");
  React.useEffect(() => { platformApi.fraudReports().then(setData).catch(() => setError("Could not load fraud reports.")); }, []);
  if (error) return <div className="error-box"><p>{error}</p></div>;
  if (!data) return <Loading lang="en" />;
  return <>
    <h1>Fraud &amp; abuse review</h1>
    <p className="helper">Caseworker fraud/spam reports and auto-flagged complaints, grouped by worker account. Counts only — case content stays with the responsible NGO. These signals are for investigation, never automatic punishment: a real worker can be wrongly matched by a similarity rule, so every pattern here is verified by a human first.</p>
    <div className="stats-grid">
      <div className="stat-card"><span>Total fraud reports</span><strong>{data.total}</strong></div>
      <div className="stat-card"><span>Accounts with reports</span><strong>{data.overview.length}</strong></div>
      <div className="stat-card"><span>Auto-flagged cases</span><strong>{data.overview.reduce((sum, row) => sum + row.flaggedCases, 0)}</strong></div>
    </div>
    <div className="list-panel"><h2>Abuse patterns by account</h2>
      {data.overview.length ? data.overview.map((row) => (
        <div className="list-row" key={row.workerId}>
          <div>
            <strong>{row.workerId.slice(0, 8)}…</strong>
            <span>{row.fraudReports} fraud report{row.fraudReports === 1 ? "" : "s"} · {row.flaggedCases} flagged case{row.flaggedCases === 1 ? "" : "s"} · {row.dismissedByCaseworker} dismissed as genuine</span>
            <small>{Object.entries(row.reasons).map(([reason, count]) => `${reason}: ${count}`).join(" · ")}{row.lastActivityAt ? ` · last ${new Date(row.lastActivityAt).toLocaleString()}` : ""}</small>
          </div>
        </div>
      )) : <p>No fraud reports or flags yet.</p>}
      <p className="helper">Dismissed-as-genuine counts matter: a high dismiss rate means the worker is probably real and being wrongly matched, not abusive.</p>
    </div>
    <div className="list-panel"><h2>Recent caseworker reports</h2>
      {data.reports.length ? data.reports.slice(0, 50).map((report) => (
        <div className="timeline-item" key={report.id}>
          <strong>{report.reason}</strong>
          <span>{report.caseId} · {report.reportedBy} · {new Date(report.createdAt).toLocaleString()}{report.reviewedAt ? ` · reviewed by ${report.reviewedBy}` : ""}</span>
          {report.detail && <p>{report.detail}</p>}
        </div>
      )) : <p>No caseworker fraud reports yet.</p>}
    </div>
  </>;
}

type CmsPage = import("./api").PlatformContentPage;

tinyMarkdown.maybeHeading = undefined;
const contentLocaleNames: Record<string, string> = { en: "English", hi: "हिन्दी", bn: "বাংলা", ta: "தமிழ்", te: "తెలుగు" };

function tinyMarkdown(text: string): string {
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = String(text || "").split(/\n/);
  const out: string[] = [];
  let inList = false;
  const closeList = () => { if (inList) { out.push("</ul>"); inList = false; } };
  for (const raw of lines) {
    const line = escape(raw);
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (heading) { closeList(); out.push(`<h${heading[1].length + 2}>${heading[2]}</h${heading[1].length + 2}>`); }
    else if (bullet) { if (!inList) { out.push("<ul>"); inList = true; } out.push(`<li>${bullet[1]}</li>`); }
    else if (!line.trim()) closeList();
    else { closeList(); out.push(`<p>${line}</p>`); }
  }
  closeList();
  return out.join("");
}

function PlatformContentEditor() {
  const [pages, setPages] = React.useState<CmsPage[]>([]);
  const [locales, setLocales] = React.useState<string[]>([]);
  const [localeNames, setLocaleNames] = React.useState<Record<string, string>>({});
  const [selected, setSelected] = React.useState<{ slug: string; locale: string } | null>(null);
  const [body, setBody] = React.useState("");
  const [note, setNote] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [preview, setPreview] = React.useState(false);
  const [versions, setVersions] = React.useState<import("./api").ContentVersion[] | null>(null);
  const load = React.useCallback(async () => {
    try {
      const result = await contentApi.list();
      setPages(result.pages); setLocales(result.locales); setLocaleNames(result.localeNames);
      if (result.pages.length && !selected) setSelected({ slug: result.pages[0].slug, locale: result.pages[0].publishedLocales[0] || result.locales[0] });
    } catch { setError("Could not load content pages."); }
  }, [selected]);
  React.useEffect(() => { void load(); }, []);
  const page = pages.find((item) => item.slug === selected?.slug) || null;
  React.useEffect(() => {
    if (!page || !selected) return;
    const draft = page.drafts[selected.locale];
    setBody(draft?.body || page.locales[selected.locale]?.body || "");
    setNote(""); setPreview(false); setVersions(null); setMessage(""); setError("");
  }, [selected?.slug, selected?.locale]);
  if (error && !pages.length) return <div className="error-box"><p>{error}</p></div>;
  if (!locales.length) return <Loading lang="en" />;
  return <>
    <h1>Content &amp; legal pages</h1>
    <p className="helper">Edit the text-heavy pages — Privacy Policy, Terms of Use, FAQ, mission text — without a code deploy. Every publish stores a version; legal pages keep their full history. Languages that have not been updated since the most recent publish are marked stale.</p>
    <div className="detail-grid cms-grid">
      <div className="list-panel cms-list">
        {pages.map((item) => <button className={item.slug === selected?.slug ? "filter active" : "filter"} onClick={() => setSelected({ slug: item.slug, locale: item.publishedLocales[0] || locales[0] })} key={item.slug}>{item.title}{item.kind === "legal" ? " ⚖" : ""}{item.staleLocales.length ? <small> · {item.staleLocales.length} stale</small> : ""}</button>)}
      </div>
      {page && selected && <div className="list-panel cms-editor">
        <h2>{page.title}</h2>
        <div className="filter-row">{locales.map((locale) => <button className={locale === selected.locale ? "filter active" : "filter"} onClick={() => setSelected({ ...selected, locale })} key={locale}>{localeNames[locale] || locale}{page.staleLocales.includes(locale) ? " ⚠" : ""}{page.drafts[locale] ? " ✎" : ""}</button>)}</div>
        {page.staleLocales.includes(selected.locale) && <p className="helper">⚠ This language has not been updated since the latest publish. Please update it so no language is left behind.</p>}
        {preview
          ? <div className="cms-preview" dangerouslySetInnerHTML={{ __html: tinyMarkdown(body) }} />
          : <textarea className="cms-textarea" value={body} onChange={(event) => setBody(event.target.value)} rows={16} aria-label={`Body for ${page.title} (${localeNames[selected.locale] || selected.locale})`} />}
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Change note (optional, saved with the version)" aria-label="Change note" />
        <div className="ai-actions">
          <button className="button button-small" disabled={busy} onClick={() => { setBusy(true); contentApi.saveDraft(page.slug, selected.locale, body).then(() => { setMessage("Draft saved."); setError(""); }).catch(() => { setError("Could not save the draft."); }).finally(() => setBusy(false)); }}>Save draft</button>
          <button className="button button-small" onClick={() => setPreview((value) => !value)}>{preview ? "Edit" : "Preview"}</button>
          <button className="button button-small" disabled={busy || !body.trim()} onClick={() => { setBusy(true); contentApi.publish(page.slug, selected.locale, body, note).then(() => { setMessage("Published. Remember to update the other languages."); setError(""); return load(); }).catch(() => { setError("Could not publish."); }).finally(() => setBusy(false)); }}>Publish</button>
          <button className="button button-small" onClick={() => { contentApi.versions(page.slug).then((result) => setVersions(result.versions)).catch(() => setError("Could not load versions.")); }}>History</button>
        </div>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
        {versions && <div className="cms-versions">{versions.length ? versions.slice(0, 20).map((version) => <div className="timeline-item" key={version.id}><strong>{localeNames[version.locale] || version.locale} · {version.publishedBy}</strong><span>{new Date(version.createdAt).toLocaleString()}{version.note ? ` · ${version.note}` : ""}</span><button className="button button-small" onClick={() => { contentApi.restore(page.slug, version.id).then(() => { setMessage("Version restored as a new publish."); return load(); }).catch(() => setError("Could not restore.")); }}>Restore</button></div>) : <p>No versions yet.</p>}</div>}
      </div>}
    </div>
  </>;
}

function PlatformReference() {
  const [tab, setTab] = React.useState<"wages" | "schemes">("wages");
  const [rates, setRates] = React.useState<import("./api").MinimumWageRate[]>([]); const [schemes, setSchemes] = React.useState<import("./api").WelfareScheme[]>([]);
  const [changes, setChanges] = React.useState<import("./api").CaseDetail["auditLog"]>([]);
  const [wageForm, setWageForm] = React.useState({ state: "", workerCategory: "unskilled_construction", dailyAmount: "", effectiveFrom: new Date().toISOString().slice(0, 10), sourceNote: "" });
  const [schemeForm, setSchemeForm] = React.useState({ slug: "", name: "", description: "", eligibility: "", registrationInstructions: "", officialUrl: "", minAge: "", maxAge: "", states: "All India", workerCategories: "" });
  const [message, setMessage] = React.useState(""); const [error, setError] = React.useState("");
  const load = React.useCallback(async () => {
    try {
      const [wageResult, schemeResult, auditResult] = await Promise.all([platformApi.minimumWages(), platformApi.schemes(), platformApi.audit(500).catch(() => ({ entries: [] as import("./api").CaseDetail["auditLog"] }))]);
      setRates(wageResult.rates); setSchemes(schemeResult.schemes);
      setChanges(auditResult.entries.filter((entry) => ["minimum_wage_rate_updated", "welfare_scheme_updated"].includes(entry.action)).slice(0, 12));
      setError("");
    } catch { setError("Could not load reference data."); }
  }, []);
  React.useEffect(() => { void load(); }, [load]);
  const saveWage = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage(""); setError("");
    try { await platformApi.upsertWageRate({ ...wageForm, dailyAmount: Number(wageForm.dailyAmount) }); setMessage("Reference rate saved and audited."); setWageForm({ ...wageForm, state: "", dailyAmount: "", sourceNote: "" }); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the rate."); }
  };
  const saveScheme = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage(""); setError("");
    try { await platformApi.upsertScheme({ ...schemeForm, minAge: schemeForm.minAge || null, maxAge: schemeForm.maxAge || null, states: schemeForm.states.split(",").map((item) => item.trim()).filter(Boolean), workerCategories: schemeForm.workerCategories.split(",").map((item) => item.trim()).filter(Boolean) }); setMessage("Scheme saved and audited."); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the scheme."); }
  };
  return <>
    <h1>Global reference data</h1>
    <p className="helper">Single source of truth for the minimum-wage table (Phase 26) and the welfare scheme catalog (Phase 27). NGO admin tools can no longer edit these; every change here is attributed in the audit log.</p>
    <div className="filter-row"><button className={tab === "wages" ? "filter active" : "filter"} onClick={() => setTab("wages")}>Minimum wages</button><button className={tab === "schemes" ? "filter active" : "filter"} onClick={() => setTab("schemes")}>Welfare schemes</button></div>
    {message && <p className="success">{message}</p>}
    {error && <div className="error-box"><p>{error}</p></div>}
    {tab === "wages" ? <>
      <form className="worker-form" onSubmit={saveWage}>
        <label>State<input required value={wageForm.state} onChange={(event) => setWageForm({ ...wageForm, state: event.target.value })} placeholder="e.g. Delhi" /></label>
        <label>Worker category<select value={wageForm.workerCategory} onChange={(event) => setWageForm({ ...wageForm, workerCategory: event.target.value })}><option value="unskilled_construction">Unskilled construction</option><option value="semi_skilled_construction">Semi-skilled construction</option><option value="skilled_construction">Skilled construction</option><option value="domestic_work">Domestic work</option></select></label>
        <label>Daily amount (INR)<input required type="number" min="1" value={wageForm.dailyAmount} onChange={(event) => setWageForm({ ...wageForm, dailyAmount: event.target.value })} /></label>
        <label>Effective from<input required type="date" value={wageForm.effectiveFrom} onChange={(event) => setWageForm({ ...wageForm, effectiveFrom: event.target.value })} /></label>
        <label>Source note<textarea value={wageForm.sourceNote} onChange={(event) => setWageForm({ ...wageForm, sourceNote: event.target.value })} placeholder="Official notification reference" /></label>
        <button className="button">Save rate</button>
      </form>
      <div className="list-panel">{rates.map((rate) => <div className="list-row" key={rate.id}><strong>{rate.state} · {rate.workerCategory}</strong><span>₹{rate.dailyAmount}/day · effective {rate.effectiveFrom} · updated {new Date(rate.updatedAt).toLocaleDateString()}</span></div>)}{!rates.length && <p>No reference rates yet.</p>}</div>
    </> : <>
      <form className="worker-form" onSubmit={saveScheme}>
        {(["slug", "name", "description", "eligibility", "registrationInstructions", "officialUrl", "minAge", "maxAge", "states", "workerCategories"] as const).map((field) => <label key={field}>{field}<input required={["slug", "name", "description", "eligibility", "registrationInstructions"].includes(field)} value={schemeForm[field]} onChange={(event) => setSchemeForm({ ...schemeForm, [field]: event.target.value })} /></label>)}
        <button className="button">Save scheme</button>
      </form>
      <div className="list-panel">{schemes.map((scheme) => <div className="list-row" key={scheme.id}><strong>{scheme.name} <small>· {scheme.slug}</small></strong><span>{scheme.active === false ? "Inactive" : "Active"} · {(scheme.states || ["—"]).join(", ")} · updated {scheme.updatedAt ? new Date(scheme.updatedAt).toLocaleDateString() : "—"}</span></div>)}{!schemes.length && <p>No schemes yet.</p>}</div>
    </>}
    <div className="list-panel"><h2>Recent reference changes</h2>
      {changes.length ? changes.map((entry) => <div className="timeline-item" key={entry.id}><strong>{entry.action}</strong><span>{entry.actor} · {new Date(entry.timestamp).toLocaleString()}</span>{entry.details && <p>{[entry.details.state, entry.details.workerCategory, entry.details.dailyAmount ? `₹${entry.details.dailyAmount}` : "", entry.details.slug].filter(Boolean).join(" · ")}</p>}</div>) : <p>No reference changes recorded yet.</p>}
    </div>
  </>;
}

function PlatformAccounts() {
  const [accounts, setAccounts] = React.useState<import("./api").PlatformApplication[]>([]);
  const [requests, setRequests] = React.useState<import("./api").PlatformRecoveryRequest[]>([]);
  const [loading, setLoading] = React.useState(true); const [error, setError] = React.useState(""); const [message, setMessage] = React.useState("");
  const load = React.useCallback(async () => {
    setLoading(true);
    try { const [accountResult, recoveryResult] = await Promise.all([platformApi.accounts(), platformApi.recovery()]); setAccounts(accountResult.accounts); setRequests(recoveryResult.requests); setError(""); } catch { setError("Could not load accounts."); } finally { setLoading(false); }
  }, []);
  React.useEffect(() => { void load(); }, [load]);
  const deactivate = (account: import("./api").PlatformApplication) => { if (window.confirm(`Deactivate ${account.organizationName}? Active sessions are signed out immediately.`)) void platformApi.decide(account.id, { decision: "deactivate" }).then(load).catch((cause) => setError(cause instanceof Error ? cause.message : "Action failed.")); };
  const reactivate = (account: import("./api").PlatformApplication) => { void platformApi.decide(account.id, { decision: "reactivate" }).then(load).catch((cause) => setError(cause instanceof Error ? cause.message : "Action failed.")); };
  const resolve = (request: import("./api").PlatformRecoveryRequest, outcome: "grant" | "dismiss") => {
    const note = window.prompt(`Resolution note for ${request.contactEmail} (${outcome === "grant" ? "grant recovery" : "dismiss request"}):`);
    if (note === null) return;
    void platformApi.resolveRecovery(request.id, { outcome, note }).then(load).catch((cause) => setError(cause instanceof Error ? cause.message : "Action failed."));
  };
  return <>
    <h1>Accounts &amp; recovery</h1>
    <p className="helper">Create or deactivate NGO Admin and Employer accounts, and handle account recovery requests that should never be self-service for security reasons.</p>
    {message && <p className="success">{message}</p>}
    {error && <div className="error-box"><p>{error}</p></div>}
    <div className="list-panel"><h2>Recovery requests</h2>
      {loading ? <p>Loading...</p> : requests.length ? requests.map((request) => (
        <div className="list-row" key={request.id}>
          <div>
            <strong>{request.contactEmail}{request.organizationName ? <small> · {request.organizationName}</small> : null}</strong>
            <span>{request.status} · requested {new Date(request.createdAt).toLocaleString()}</span>
            <p>{request.reason}</p>
            {request.resolutionNote && <p className="helper">Note: {request.resolutionNote}</p>}
          </div>
          {request.status === "pending" && <div className="contact-actions"><button className="button button-small" onClick={() => resolve(request, "grant")}>Grant</button><button className="button button-small" onClick={() => resolve(request, "dismiss")}>Dismiss</button></div>}
        </div>
      )) : <p>No recovery requests.</p>}
    </div>
    <div className="list-panel"><h2>Organization accounts</h2>
      {loading ? <p>Loading...</p> : accounts.map((account) => (
        <div className="list-row" key={account.id}>
          <div><strong>{account.organizationName} <small>· {account.kind === "ngo" ? "NGO Admin" : "Employer"}</small></strong><span>{account.contactEmail} · {account.status}</span></div>
          <div className="contact-actions">
            {account.status === "approved" && <button className="button button-small" onClick={() => deactivate(account)}>Deactivate</button>}
            {account.status === "deactivated" && <button className="button button-small" onClick={() => reactivate(account)}>Reactivate</button>}
          </div>
        </div>
      ))}
      <p className="helper">New credentials for approved organizations are issued by the platform team out of band — this panel never displays or resets passwords.</p>
    </div>
  </>;
}

function PlatformAudit() {
  const [entries, setEntries] = React.useState<import("./api").CaseDetail["auditLog"]>([]); const [loading, setLoading] = React.useState(true); const [error, setError] = React.useState(false);
  React.useEffect(() => { platformApi.audit().then((result) => setEntries(result.entries)).catch(() => setError(true)).finally(() => setLoading(false)); }, []);
  if (loading) return <Loading lang="en" />;
  if (error) return <div className="error-box"><p>Could not load the audit log.</p><button className="button button-small" onClick={() => window.location.reload()}>Try again</button></div>;
  return <><h1>Platform audit log</h1><div className="list-panel">{entries.length ? entries.map((entry) => <div className="timeline-item" key={entry.id}><strong>{entry.action}</strong><span>{entry.actor} · {new Date(entry.timestamp).toLocaleString()}</span></div>) : <p>No entries yet.</p>}</div></>;
}

function PartnerSignup() {
  const [kind, setKind] = React.useState<"ngo" | "employer">("ngo");
  const [busy, setBusy] = React.useState(false); const [sent, setSent] = React.useState(false); const [error, setError] = React.useState("");
  const [recoveryEmail, setRecoveryEmail] = React.useState(""); const [recoveryReason, setRecoveryReason] = React.useState(""); const [recoveryMessage, setRecoveryMessage] = React.useState(""); const [recoveryError, setRecoveryError] = React.useState("");
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    try { const result = await platformApi.signup({ kind, organizationName: data.get("organizationName"), contactName: data.get("contactName"), contactEmail: data.get("contactEmail"), contactPhone: data.get("contactPhone"), registrationNumber: data.get("registrationNumber"), officialDomain: data.get("officialDomain"), notes: data.get("notes") }); setSent(true); void result; } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not submit the application."); } finally { setBusy(false); }
  };
  const submitRecovery = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setRecoveryError(""); setRecoveryMessage("");
    try { const result = await platformApi.requestRecovery({ contactEmail: recoveryEmail, reason: recoveryReason }); setRecoveryMessage(result.message); setRecoveryEmail(""); setRecoveryReason(""); } catch (cause) { setRecoveryError(cause instanceof Error ? cause.message : "Could not submit the request."); } finally { setBusy(false); }
  };
  return <main className="auth-page">
    <form className="auth-card" onSubmit={submit}>
      <p className="eyebrow teal">Partner onboarding</p><h1>Join Pehchaan</h1>
      <p className="helper">Applications are reviewed by the Pehchaan platform team before any account is activated. Review takes a few working days.</p>
      {sent ? <p className="success">Application received. The platform team will contact you after verifying your details — no account is created until then.</p> : <>
        <label>Organization type<select value={kind} onChange={(event) => setKind(event.target.value as "ngo" | "employer")}><option value="ngo">NGO / casework organization</option><option value="employer">Verified employer</option></select></label>
        <label>Organization name<input name="organizationName" required /></label>
        <label>Contact name<input name="contactName" required /></label>
        <label>Work email<input name="contactEmail" type="email" required /></label>
        <label>Phone (optional)<input name="contactPhone" type="tel" /></label>
        <label>Registration number<input name="registrationNumber" placeholder="e.g. NGO Darpan ID, company CIN, society reg. no." /></label>
        <label>Official email / website domain<input name="officialDomain" placeholder="e.g. asha-support.org" /></label>
        <p className="helper">Give at least one of the two — registration number or official domain — so the platform team has something real to verify before approval.</p>
        <label>What will you use Pehchaan for?<textarea name="notes" /></label>
        <button className="button" disabled={busy}>{busy ? "Sending..." : "Submit application"}</button>
      </>}
      {error && <p className="error">{error}</p>}
    </form>
    <form className="auth-card" onSubmit={submitRecovery}>
      <p className="eyebrow teal">Account recovery</p><h1>Lost access?</h1>
      <p className="helper">Password and account recovery are handled manually by the platform team for security — there is no self-service reset for organization accounts.</p>
      <label>Account email<input type="email" required value={recoveryEmail} onChange={(event) => setRecoveryEmail(event.target.value)} /></label>
      <label>What happened?<textarea required value={recoveryReason} onChange={(event) => setRecoveryReason(event.target.value)} /></label>
      <button className="button" disabled={busy}>Request recovery</button>
      {recoveryMessage && <p className="success">{recoveryMessage}</p>}
      {recoveryError && <p className="error">{recoveryError}</p>}
    </form>
  </main>;
}

function WorksiteLink({ session }: { session: Session | null }) { const [message, setMessage] = React.useState("Linking verified worksite..."); React.useEffect(() => { const code = window.location.pathname.split("/").pop() || ""; if (!session) { setMessage("Please log in as a worker first, then scan the worksite QR again."); return; } void workerApi.linkWorksite(code).then((result) => setMessage(`Worksite linked: ${result.worksite.name}`)).catch((error) => setMessage(error instanceof Error ? error.message : "Worksite could not be linked.")); }, [session]); return <main className="auth-page"><div className="auth-card"><p className="eyebrow teal">Pehchaan worksite</p><h1>{message}</h1><Link className="button" to={session ? "/worker" : "/worker/login"}>{session ? "Open worker dashboard" : "Worker login"}</Link></div></main>; }

function App() {
  const [lang, setLang] = React.useState<Language>(() => { const stored = localStorage.getItem("pehchaan-language") as Language | null; return stored && stored in languageNames ? stored : "hi"; });
  const [session, setSessionState] = React.useState<Session | null>(() => getSession());
  const [ngoSession, setNgoSession] = React.useState<NgoSession | null>(() => getNgoSession());
  const [employerSession, setEmployerSession] = React.useState<NgoSession | null>(() => { try { const value = JSON.parse(localStorage.getItem("pehchaan-employer-session") || "null"); return value?.expiresAt > Date.now() ? value : null; } catch { return null; } });
  const [platformSession, setPlatformSession] = React.useState<PlatformSession | null>(() => getPlatformSession());
  const platformLogout = () => { void authApi.logout(platformSession?.refreshToken); localStorage.removeItem(platformSessionKey); setPlatformSession(null); window.location.assign("/"); };
  const setSession = (value: Session) => { localStorage.setItem(sessionKey, JSON.stringify(value)); setSessionState(value); };
  const logout = () => { if (window.confirm(labels[lang].confirmLogout)) { void authApi.logout(session?.refreshToken); localStorage.removeItem(sessionKey); setSessionState(null); window.location.assign("/"); } };
  const updateLang = (value: Language) => { setLang(value); localStorage.setItem("pehchaan-language", value); };
  const ngoLogout = () => { if (window.confirm(ngoLabels[lang].logoutConfirm)) { void authApi.logout(ngoSession?.refreshToken); localStorage.removeItem(ngoSessionKey); setNgoSession(null); window.location.assign("/"); } };
  const employerLogout = () => { void authApi.logout(employerSession?.refreshToken); localStorage.removeItem("pehchaan-employer-session"); setEmployerSession(null); window.location.assign("/"); };
  return <><Navbar lang={lang} setLang={updateLang} /><Routes><Route path="/" element={<PublicHome lang={lang} />} /><Route path="/how-it-works" element={<HowItWorks lang={lang} />} /><Route path="/for-organizations" element={<ForOrganizations lang={lang} />} /><Route path="/safety" element={<SafetyPage lang={lang} />} /><Route path="/about" element={<AboutPage lang={lang} />} /><Route path="/join" element={<JoinPilot lang={lang} />} /><Route path="/privacy-policy" element={<ContentPage lang={lang} slug="privacy-policy" />} /><Route path="/terms-of-use" element={<ContentPage lang={lang} slug="terms-of-use" />} /><Route path="/faq" element={<ContentPage lang={lang} slug="faq" />} /><Route path="/worksite/:code" element={<WorksiteLink session={session} />} /><Route path="/worker/login" element={session ? <Navigate to="/worker" replace /> : <Auth lang={lang} setSession={setSession} />} /><Route path="/worker/*" element={session ? <WorkerArea lang={lang} session={session} logout={logout} /> : <Navigate to="/worker/login" replace />} /><Route path="/ngo/login" element={ngoSession ? <Navigate to="/ngo" replace /> : <NgoLogin lang={lang} setSession={setNgoSession} />} /><Route path="/ngo/*" element={ngoSession ? <NgoArea lang={lang} logout={ngoLogout} session={ngoSession} /> : <Navigate to="/ngo/login" replace />} /><Route path="/employer/login" element={employerSession ? <Navigate to="/employer" replace /> : <EmployerLogin setSession={setEmployerSession} />} /><Route path="/employer/interest" element={<EmployerInterest />} /><Route path="/employer/*" element={employerSession ? <EmployerArea logout={employerLogout} /> : <Navigate to="/employer/login" replace />} /><Route path="/platform/login" element={platformSession ? <Navigate to="/platform" replace /> : <PlatformLogin setSession={setPlatformSession} />} /><Route path="/platform/*" element={platformSession ? <PlatformArea logout={platformLogout} /> : <Navigate to="/platform/login" replace />} /><Route path="/partner-signup" element={<PartnerSignup />} /><Route path="*" element={<PublicPage lang={lang} title={lang === "hi" ? "पहचान" : "Pehchaan"} />} /></Routes><footer><div><Link className="brand" to="/">Pehchaan<span>.</span></Link><p>{lang === "hi" ? "हर श्रमिक सुरक्षित कल का हकदार है।" : "Every worker deserves a safer tomorrow."}</p><nav className="footer-links"><Link to="/privacy-policy">{lang === "hi" ? "गोपनीयता नीति" : "Privacy Policy"}</Link><Link to="/terms-of-use">{lang === "hi" ? "उपयोग की शर्तें" : "Terms of Use"}</Link><Link to="/faq">{lang === "hi" ? "सामान्य प्रश्न" : "FAQ"}</Link></nav></div></footer></>;
}

export default App;
