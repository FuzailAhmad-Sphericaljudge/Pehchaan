export type Language = "hi" | "en" | "bn" | "ta" | "te";

export type Worker = {
  id: string;
  phone: string;
  role: string;
  language: Language;
  profile?: Record<string, unknown>;
};

export type WageEntry = {
  id: string;
  date: string;
  type: string;
  amount: number;
  deductions: number;
  overtime: number;
  relationshipId?: string | null;
  fairPay?: { status: string; message: string; nextStep: string; dailyReference?: number; state?: string; workerCategory?: string };
};

export type WorkRelationship = {
  id: string;
  label: string;
  employerName: string | null;
  siteName: string | null;
  category: string | null;
  startedOn: string | null;
  endedOn: string | null;
  active: boolean;
  createdAt: string;
};

export type IncomeByRelationship = { combined: number; relationships: { relationshipId: string; total: number }[] };

export type CheckIn = {
  id: string;
  status: string;
  hazard: string | null;
  notes: string;
  createdAt: string;
};

export type AiTriage = { category: string; score: number; signals: string[]; generatedBy: string; generatedAt: string; humanDecision: string | null; finalCategory?: string; decidedBy?: string; decidedAt?: string };
export type DebtBondage = { advanceTaken: boolean; cannotLeave: boolean; wagesWithheldForRepayment: boolean; movementRestricted: boolean; reportedAt: string };
export type WorkerCase = {
  id: string;
  type: string;
  priority: string;
  status: string;
  summary: string;
  relationshipId?: string | null;
  debtBondage?: DebtBondage | null;
  createdAt: string;
  aiTriage?: AiTriage;
  aiSummary?: string;
};

export type Dashboard = {
  worker: Worker;
  wageEntries: WageEntry[];
  checkIns: CheckIn[];
  cases: WorkerCase[];
  workRelationships?: WorkRelationship[];
  incomeByRelationship?: IncomeByRelationship;
  schemes?: WelfareScheme[];
};
export type WelfareScheme = { id: string; slug: string; name: string; description: string; eligibility: string; registrationInstructions: string; officialUrl?: string | null; languages?: Record<string, { name?: string; description?: string; eligibility?: string; registrationInstructions?: string }>; states?: string[]; workerCategories?: string[]; minAge?: number | null; maxAge?: number | null; active?: boolean; updatedAt?: string; };

export type NgoCase = WorkerCase & { workerId: string; owner: string | null; updatedAt: string; fraudReview?: FraudReview | null };
export type Evidence = { id: string; fileName: string; type: string; mimeType?: string; sizeBytes?: number; checksum?: string | null; scanStatus?: string; available?: boolean; createdAt: string };
export type CaseDetail = { case: NgoCase; notes: { id: string; author: string; text: string; createdAt: string }[]; evidence: Evidence[]; auditLog: { id: string; action: string; actor: string; timestamp: string; details: Record<string, unknown> }[]; aiSummary?: string };

type ApiError = Error & { offline?: boolean; status?: number };

async function request<T>(path: string, init?: RequestInit, retry = true): Promise<T> {
  try {
    const session = (() => {
      try {
        const worker = JSON.parse(localStorage.getItem("pehchaan-worker-session") || "null");
        const ngo = JSON.parse(localStorage.getItem("pehchaan-ngo-session") || "null");
        const platform = JSON.parse(localStorage.getItem("pehchaan-platform-session") || "null");
        const employer = JSON.parse(localStorage.getItem("pehchaan-employer-session") || "null");
        return worker || ngo || platform || employer || null;
      } catch { return ""; }
    })();
    const token = session?.token || "";
    const headers = new Headers(init?.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(path, { ...init, headers });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401 && retry && session?.refreshToken && path !== "/api/auth/refresh") {
      const refreshResponse = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.refreshToken}`, "Content-Type": "application/json" },
        body: "{}",
      });
      if (refreshResponse.ok) {
        const refreshed = await refreshResponse.json();
        const key = localStorage.getItem("pehchaan-worker-session") ? "pehchaan-worker-session" : localStorage.getItem("pehchaan-platform-session") ? "pehchaan-platform-session" : "pehchaan-ngo-session";
        localStorage.setItem(key, JSON.stringify({ ...session, token: refreshed.accessToken, refreshToken: refreshed.refreshToken, expiresAt: Date.now() + refreshed.expiresIn * 1000 }));
        return request<T>(path, init, false);
      }
    }
    if (!response.ok) {
      const error = new Error(String(payload.error || "Request failed.")) as ApiError;
      error.status = response.status;
      throw error;
    }
    return payload as T;
  } catch (cause) {
    if (cause instanceof TypeError) {
      const error = new Error("offline") as ApiError;
      error.offline = true;
      throw error;
    }
    throw cause;
  }
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const authApi = {
  requestOtp: (phone: string) => request<{ workerId: string; otpHint?: string }>("/api/auth/request-otp", json({ phone })),
  verifyOtp: (phone: string, otp: string) => request<{ accessToken: string; refreshToken: string; expiresIn: number; user: Worker }>("/api/auth/verify-otp", json({ phone, otp })),
  ngoLogin: (email: string, password: string) => request<{ accessToken: string; refreshToken: string; expiresIn: number; user: { id: string; role: string } }>("/api/auth/ngo-login", json({ email, password })),
  employerLogin: (email: string, password: string) => request<{ accessToken: string; refreshToken: string; expiresIn: number; user: { id: string; role: string } }>("/api/auth/employer-login", json({ email, password })),
  platformLogin: (email: string, password: string) => request<{ accessToken: string; refreshToken: string; expiresIn: number; user: { id: string; role: string } }>("/api/auth/platform-login", json({ email, password })),
  logout: (refreshToken?: string) => request<void>("/api/auth/logout", json({ refreshToken })),
};

export type EmployerRecord = { id: string; period: string; promisedAmount: number; paidAmount: number; status: string; discrepancyResponse?: string | null };
export const employerApi = {
  dashboard: () => request<{ records: EmployerRecord[]; compliance: { flagged: number; responded: number; responseRate: number; badge: string } }>("/api/employer/dashboard"),
  respond: (id: string, response: string) => request<{ record: EmployerRecord }>(`/api/employer/wage-records/${encodeURIComponent(id)}`, { ...json({ response }), method: "PATCH" }),
  interest: (body: Record<string, unknown>) => request<{ submitted: boolean }>("/api/employer/interest", json(body)),
  createWorksite: (name: string) => request<{ worksite: { id: string; name: string; registrationCode: string; verified: boolean }; qrPayload: string; qrDataUrl: string }>("/api/employer/worksites", json({ name })),
};

export const workerApi = {
  dashboard: (workerId: string) => request<Dashboard>(`/api/workers/${encodeURIComponent(workerId)}`),
  addWage: (body: Record<string, unknown>) => request<{ wageEntry: WageEntry; fairPay: NonNullable<WageEntry["fairPay"]> }>("/api/wage-entries", json(body)),
  checkIn: (body: Record<string, unknown>) => request<{ checkIn: CheckIn }>("/api/check-ins", json(body)),
  createCase: (body: Record<string, unknown>) => request<{ case: WorkerCase }>("/api/cases", json(body)),
  linkWorksite: (registrationCode: string) => request<{ worksite: { id: string; name: string; verified: boolean } }>("/api/worksites/link", json({ registrationCode })),
  updateProfile: (body: Record<string, unknown>) => request<{ worker: Worker }>("/api/worker/profile", { ...json(body), method: "PATCH" }),
};
export const workRelationshipApi = {
  create: (body: Record<string, unknown>) => request<{ relationship: WorkRelationship }>("/api/work-relationships", json(body)),
  update: (id: string, body: Record<string, unknown>) => request<{ relationship: WorkRelationship }>(`/api/work-relationships/${encodeURIComponent(id)}`, { ...json(body), method: "PATCH" }),
};
export type TrustedContact = { id: string; name: string; phone: string; relationshipLabel: string | null; status: "pending" | "confirmed"; confirmedAt: string | null; lastTestSentAt: string | null; createdAt: string };
export const trustedContactApi = {
  list: () => request<{ contacts: TrustedContact[] }>("/api/worker/trusted-contacts"),
  create: (body: Record<string, unknown>) => request<{ contact: TrustedContact }>("/api/worker/trusted-contacts", json(body)),
  update: (id: string, body: Record<string, unknown>) => request<{ contact: TrustedContact; sent?: boolean }>(`/api/worker/trusted-contacts/${encodeURIComponent(id)}`, { ...json(body), method: "PATCH" }),
  remove: (id: string) => request<void>(`/api/worker/trusted-contacts/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

export async function downloadWorkerData(format: "json" | "csv" | "pdf"): Promise<void> {
  const session = (() => {
    try {
      const worker = JSON.parse(localStorage.getItem("pehchaan-worker-session") || "null");
      return worker as { token?: string; refreshToken?: string } | null;
    } catch { return null; }
  })();
  const response = await fetch(`/api/worker/export?format=${encodeURIComponent(format)}`, { headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {} });
  if (response.status === 401 && session?.refreshToken) {
    const refresh = await fetch("/api/auth/refresh", { method: "POST", headers: { Authorization: `Bearer ${session.refreshToken}`, "Content-Type": "application/json" }, body: "{}" });
    if (!refresh.ok) throw new Error("Session expired. Please log in again.");
    const refreshed = await refresh.json();
    localStorage.setItem("pehchaan-worker-session", JSON.stringify({ ...session, token: refreshed.accessToken, refreshToken: refreshed.refreshToken, expiresAt: Date.now() + refreshed.expiresIn * 1000 }));
    return downloadWorkerData(format);
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(String(payload.error || "Export failed."));
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = response.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] || `pehchaan-my-data.${format}`;
  link.click();
  URL.revokeObjectURL(url);
}

export type MinimumWageRate = { id: string; state: string; workerCategory: string; dailyAmount: number; currency: string; effectiveFrom: string; sourceNote: string; updatedAt: string };
export const minimumWageApi = {
  list: () => request<{ rates: MinimumWageRate[] }>("/api/minimum-wages"),
  upsert: (body: Record<string, unknown>) => request<{ rate: MinimumWageRate }>("/api/ngo/minimum-wages", json(body)),
};
export const schemeApi = {
  list: () => request<{ schemes: WelfareScheme[] }>("/api/worker/schemes"),
  upsert: (body: Record<string, unknown>) => request<{ scheme: WelfareScheme }>("/api/ngo/schemes", json(body)),
};

export type PlatformApplication = { id: string; kind: "ngo" | "employer"; organizationName: string; contactName: string; contactEmail: string; contactPhone: string | null; registrationNumber: string; officialDomain: string | null; notes: string; status: "pending" | "approved" | "rejected" | "deactivated"; rejectionReason: string | null; reviewedBy: string | null; reviewedAt: string | null; createdAt: string };
export type FraudReview = { flagged: boolean; signals: string[]; screenedAt: string | null; screenedBy: string | null; disposition: "dismissed" | "confirmed" | null; reviewedBy: string | null; reviewedAt: string | null; fraudReported?: boolean; lastReason?: string };
export type FraudReport = { id: string; caseId: string; workerId: string | null; reason: "spam" | "duplicate" | "false_complaint" | "harassment" | "other"; detail: string; reportedBy: string; reviewedBy: string | null; reviewedAt: string | null; createdAt: string };
export type FraudAbuseOverviewRow = { workerId: string; fraudReports: number; reasons: Record<string, number>; flaggedCases: number; dismissedByCaseworker: number; lastActivityAt: string | null };
export type PlatformRecoveryRequest = { id: string; applicationId: string | null; organizationName: string | null; contactEmail: string; reason: string; status: "pending" | "resolved" | "dismissed"; resolutionNote: string | null; requestedBy: string; resolvedBy: string | null; resolvedAt: string | null; createdAt: string };
export type PlatformOverview = { generatedAt: string; aggregateOnly: boolean; organizations: { active: number; deactivated: number }; cases: { total: number; open: number; openByStatus: Record<string, number>; resolved: number; createdLast30Days: number }; workers: { total: number; registeredLast30Days: number }; alerts: { pending: number; escalated: number; acknowledged: number }; medianResponseHours: number | null; channels: Record<string, number> };
export type PlatformSummary = { generatedAt: string; organizations: { total: number; ngos: number; employers: number; active: number; deactivated: number }; queue: { pending: number; pendingNgos: number; pendingEmployers: number }; cases: { total: number; open: number; resolved: number }; workers: { total: number }; recoveryRequests: number; referenceData: { minimumWageRates: number; welfareSchemes: number }; fraud: { totalReports: number; accountsWithReports: number; flaggedCases: number; pendingReview: number } };

export type ContentPageEntry = { body: string; publishedAt: string; publishedBy: string };
export type ContentPage = { slug: string; kind: "legal" | "static"; title: string; locales: Record<string, ContentPageEntry> };
export type ContentDraft = { body: string; savedAt: string; savedBy: string };
export type PlatformContentPage = { slug: string; kind: "legal" | "static"; title: string; locales: Record<string, ContentPageEntry>; drafts: Record<string, ContentDraft>; staleLocales: string[]; publishedLocales: string[]; versionCount: number; updatedAt: string | null; updatedBy: string | null };
export type ContentVersion = { id: string; slug: string; kind: "legal" | "static"; locale: string; body: string; publishedBy: string; note: string; createdAt: string };

export const contentApi = {
  index: () => request<{ pages: { slug: string; kind: "legal" | "static"; title: string; locales: string[]; lastPublishedAt: string | null }[] }>("/api/content"),
  page: (slug: string) => request<ContentPage>(`/api/content/${encodeURIComponent(slug)}`),
  list: () => request<{ pages: PlatformContentPage[]; locales: string[]; localeNames: Record<string, string> }>("/api/platform/content"),
  saveDraft: (slug: string, locale: string, body: string) => request<{ slug: string; locale: string; draft: ContentDraft }>(`/api/platform/content/${encodeURIComponent(slug)}/${encodeURIComponent(locale)}`, { ...json({ body }), method: "PUT" }),
  publish: (slug: string, locale: string, body: string, note = "") => request<{ page: PlatformContentPage; version: ContentVersion }>(`/api/platform/content/${encodeURIComponent(slug)}/${encodeURIComponent(locale)}/publish`, json({ body, note })),
  versions: (slug: string) => request<{ slug: string; kind: ContentPage["kind"]; versions: ContentVersion[] }>(`/api/platform/content/${encodeURIComponent(slug)}/versions`),
  restore: (slug: string, versionId: string) => request<{ page: PlatformContentPage; version: ContentVersion }>(`/api/platform/content/${encodeURIComponent(slug)}/restore`, json({ versionId })),
};

export const platformApi = {
  overview: () => request<{ overview: PlatformOverview; summary: PlatformSummary }>("/api/platform/overview"),
  applications: (status?: "pending" | "approved" | "rejected" | "deactivated") => request<{ applications: PlatformApplication[]; total: number }>(`/api/platform/applications${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  decide: (id: string, body: Record<string, unknown>) => request<{ application: PlatformApplication }>("/api/platform/applications/decision", json({ id, ...body })),
  minimumWages: () => request<{ rates: MinimumWageRate[] }>("/api/platform/minimum-wages"),
  upsertWageRate: (body: Record<string, unknown>) => request<{ rate: MinimumWageRate }>("/api/platform/minimum-wages", json(body)),
  schemes: () => request<{ schemes: WelfareScheme[] }>("/api/platform/schemes"),
  upsertScheme: (body: Record<string, unknown>) => request<{ scheme: WelfareScheme }>("/api/platform/schemes", json(body)),
  accounts: () => request<{ accounts: PlatformApplication[]; total: number }>("/api/platform/accounts"),
  recovery: () => request<{ requests: PlatformRecoveryRequest[]; total: number }>("/api/platform/recovery"),
  resolveRecovery: (id: string, body: Record<string, unknown>) => request<{ request: PlatformRecoveryRequest }>("/api/platform/recovery/resolve", json({ id, ...body })),
  audit: (limit = 200) => request<{ entries: CaseDetail["auditLog"]; total: number }>(`/api/platform/audit-log?limit=${limit}`),
  signup: (body: Record<string, unknown>) => request<{ submitted: boolean; message: string }>("/api/platform/signup", json(body)),
  requestRecovery: (body: Record<string, unknown>) => request<{ submitted: boolean; message: string }>("/api/platform/recovery", json(body)),
  fraudReports: () => request<{ reports: FraudReport[]; total: number; overview: FraudAbuseOverviewRow[] }>("/api/platform/fraud-reports"),
};

export type AppNotification = { id: string; caseId: string | null; type: "case_status_changed" | "case_note_added" | "wage_flagged" | "scheme_matched" | "case_assigned" | "case_reopened" | "alert_escalated"; priority: "normal" | "high"; title: string; body: string; meta: Record<string, unknown>; readAt: string | null; createdAt: string };
export type NotificationPreferences = { caseUpdates: boolean; caseNotes: boolean; wageFlags: boolean; schemeMatches: boolean };

export const notificationApi = {
  vapidPublicKey: () => request<{ publicKey: string | null }>("/api/notifications/vapid-public-key"),
  list: () => request<{ notifications: AppNotification[]; unread: number; total: number }>("/api/notifications"),
  markRead: (ids?: string[]) => request<{ updated: number; unread: number }>("/api/notifications/read", json(ids ? { ids } : {})),
  preferences: () => request<{ preferences: NotificationPreferences }>("/api/notifications/preferences"),
  updatePreferences: (body: Partial<NotificationPreferences>) => request<{ preferences: NotificationPreferences }>("/api/notifications/preferences", { ...json(body), method: "PATCH" }),
  pushSubscribe: (subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) => request<{ subscribed: boolean; delivery: string }>("/api/notifications/push-subscribe", json(subscription)),
  pushUnsubscribe: (endpoint: string) => request<{ subscribed: boolean }>("/api/notifications/push-unsubscribe", json({ endpoint })),
};

export const ngoApi = {
  cases: () => request<{ cases: NgoCase[]; total: number }>("/api/ngo/cases"),
  detail: (caseId: string) => request<CaseDetail>(`/api/ngo/cases/${encodeURIComponent(caseId)}`),
  updateCase: (caseId: string, body: Record<string, unknown>) => request<{ case: NgoCase }>(`/api/ngo/cases/${encodeURIComponent(caseId)}`, { ...json(body), method: "PATCH" }),
  addNote: (caseId: string, body: { author: string; text: string }) => request<{ note: CaseDetail["notes"][number] }>(`/api/ngo/cases/${encodeURIComponent(caseId)}/notes`, json(body)),
  audit: () => request<{ entries: CaseDetail["auditLog"] }>("/api/ngo/audit-log"),
  aiPatterns: () => request<{ patterns: { employer: string; complaintCount: number; independentWorkers: number; caseIds: string[]; signal: string }[] }>("/api/ngo/ai-patterns"),
  reportFraud: (caseId: string, body: { reason: string; detail?: string }) => request<{ report: FraudReport; case: NgoCase }>(`/api/cases/${encodeURIComponent(caseId)}/fraud-report`, json(body)),
  setFraudDisposition: (caseId: string, disposition: "dismissed" | "confirmed") => request<{ case: NgoCase }>(`/api/ngo/cases/${encodeURIComponent(caseId)}`, { ...json({ fraudDisposition: disposition }), method: "PATCH" }),
  alerts: () => request<{ alerts: Alert[]; total: number }>("/api/ngo/alerts"),
  updateAlert: (alertId: string, body: Record<string, unknown>) => request<{ alert: Alert }>(`/api/ngo/alerts/${encodeURIComponent(alertId)}`, { ...json(body), method: "PATCH" }),
  impact: (range = "month") => request<ImpactReport>(`/api/analytics/impact?range=${encodeURIComponent(range)}`),
  impactCsv: (range = "month") => `/api/analytics/impact.csv?range=${encodeURIComponent(range)}`,
};

export type Alert = { id: string; caseId: string | null; kind: string; status: string; createdAt: string; dueAt: string; acknowledgedAt: string | null; acknowledgedBy: string | null; actionTaken: string | null; falseAlarmReason: string | null };
export type ImpactReport = { range: { from: string; to: string }; workersSupported: number; casesDocumented: number; casesByCategory: Record<string, number>; averageResponseHours: number; casesByStatus: Record<string, number>; casesOverTime: { date: string; documented: number; resolved: number; open: number }[]; geographicDistribution: Record<string, number>; languageUsage: Record<string, number> };

export const evidenceApi = {
  createUpload: (caseId: string, body: Record<string, unknown>) => request<{ evidence: Evidence; uploadUrl: string }>(`/api/cases/${encodeURIComponent(caseId)}/evidence`, json(body)),
  complete: (caseId: string, evidenceId: string, checksum: string) => request<{ evidence: Evidence }>(`/api/cases/${encodeURIComponent(caseId)}/evidence/${encodeURIComponent(evidenceId)}/complete`, json({ checksum })),
  downloadUrl: (evidenceId: string) => request<{ url: string }>(`/api/evidence/${encodeURIComponent(evidenceId)}/download-url`),
};

export const legalDocumentApi = {
  generate: (caseId: string, body: Record<string, unknown>) => request<{ document: { id: string; downloadUrl: string; reviewed: boolean; content: Record<string, unknown> } }>(`/api/cases/${encodeURIComponent(caseId)}/legal-documents`, json(body)),
  download: async (documentId: string) => {
    const session = JSON.parse(localStorage.getItem("pehchaan-ngo-session") || localStorage.getItem("pehchaan-worker-session") || "null") as { token?: string } | null;
    const response = await fetch(`/api/legal-documents/${encodeURIComponent(documentId)}/pdf`, { headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {} });
    if (!response.ok) throw new Error((await response.text()) || "Document download failed.");
    return URL.createObjectURL(await response.blob());
  },
};

export type { ApiError };
