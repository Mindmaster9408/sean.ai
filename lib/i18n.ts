type TranslationDict = Record<string, Record<string, string>>;

const translations: TranslationDict = {
  EN: {
    // Common
    "sean.title": "Sean",
    "sean.subtitle": "AI Knowledge Layer",
    "action.login": "Login",
    "action.logout": "Logout",
    "action.send": "Send",
    "action.approve": "Approve",
    "action.reject": "Reject",
    "action.back": "Back",
    "action.new": "New Chat",
    "action.save": "Save",
    "action.cancel": "Cancel",

    // Auth
    "auth.email": "Email",
    "auth.required": "Authorized users only",
    "auth.denied": "Access denied. Your email is not on the allowlist.",
    "auth.loggingIn": "Logging in...",

    // Chat
    "chat.title": "Chat",
    "chat.newConversation": "New Conversation",
    "chat.empty": "Start a conversation",
    "chat.emptyHint": "Begin by asking a question, use LEER:/TEACH: to teach me knowledge, or use ASK: to query approved knowledge",
    "chat.placeholder": "Message Sean... (use LEER:/TEACH: to teach or ASK: to query)",
    "chat.knowledge": "Knowledge",

    // Knowledge
    "knowledge.title": "Knowledge Base",
    "knowledge.status": "Status",
    "knowledge.layer": "Layer",
    "knowledge.pending": "Pending",
    "knowledge.approved": "Approved",
    "knowledge.rejected": "Rejected",
    "knowledge.all": "All",
    "knowledge.allLayers": "All Layers",
    "knowledge.legal": "Legal/Regulatory",
    "knowledge.firm": "Firm-specific",
    "knowledge.client": "Client-specific",
    "knowledge.empty": "No knowledge items found for the selected filters.",
    "knowledge.version": "Version",

    // Audit
    "audit.title": "Audit Log",
    "audit.filter": "Filter by Action",
    "audit.allActions": "All Actions",
    "audit.empty": "No audit logs found.",

    // Messages
    "msg.error": "Error",
    "msg.success": "Success",
    "msg.loading": "Loading...",
    "msg.failedKB": "Failed to process teach message:",
    "msg.failedReason": "Failed to process question.",
    "msg.savedAsPending": "Saved as PENDING knowledge for admin approval. Ref:",
  },
  AF: {
    // Common
    "sean.title": "Sean",
    "sean.subtitle": "AI Kennislaag",
    "action.login": "Aanmeld",
    "action.logout": "Afmeld",
    "action.send": "Stuur",
    "action.approve": "Goedkeur",
    "action.reject": "Verwerp",
    "action.back": "Terug",
    "action.new": "Nuwe Chat",
    "action.save": "Stoor",
    "action.cancel": "Kanselleer",

    // Auth
    "auth.email": "E-pos",
    "auth.required": "Slegs gemagtigde gebruikers",
    "auth.denied": "Toegang geweier. Jou e-pos is nie op die toestemmingslyste nie.",
    "auth.loggingIn": "Besig om aan te meld...",

    // Chat
    "chat.title": "Gesprek",
    "chat.newConversation": "Nuwe Gesprek",
    "chat.empty": "Begin 'n gesprek",
    "chat.emptyHint": "Begin deur 'n vraag te vra, gebruik LEER:/TEACH: om my kennis aan te leer, of gebruik ASK: om goedgekeurde kennis te vra",
    "chat.placeholder": "Boodskap Sean... (gebruik LEER:/TEACH: om te onderrig of ASK: om op te vra)",
    "chat.knowledge": "Kennis",

    // Knowledge
    "knowledge.title": "Kennisbasis",
    "knowledge.status": "Status",
    "knowledge.layer": "Laag",
    "knowledge.pending": "In afwagting",
    "knowledge.approved": "Goedgekeurd",
    "knowledge.rejected": "Verwerp",
    "knowledge.all": "Alles",
    "knowledge.allLayers": "Alle Lae",
    "knowledge.legal": "Wetlik/Regulatories",
    "knowledge.firm": "Firma-spesifiek",
    "knowledge.client": "Kliënt-spesifiek",
    "knowledge.empty": "Geen kennisitems gevind vir die geselekteerde filters.",
    "knowledge.version": "Weergawe",

    // Audit
    "audit.title": "Ouditlêer",
    "audit.filter": "Filter volgens Aksie",
    "audit.allActions": "Alle Aksies",
    "audit.empty": "Geen ouditlêers gevind.",

    // Messages
    "msg.error": "Fout",
    "msg.success": "Sukses",
    "msg.loading": "Laai tans...",
    "msg.failedKB": "Kon nie onderrigboodskap verwerk nie:",
    "msg.failedReason": "Kon nie vraag verwerk nie.",
    "msg.savedAsPending": "Gestoor as IN AFWAGTING kennis vir admingoedkeuring. Verwysing:",
  },
};

export function t(key: string, lang: string = "EN"): string {
  const langDict = translations[lang] || translations.EN;
  return langDict[key] || key;
}

export function getLanguageLabel(lang: string): string {
  return lang === "AF" ? "Afrikaans" : "English";
}

export const availableLanguages = ["EN", "AF"];
