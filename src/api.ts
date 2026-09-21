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
};

export type CheckIn = {
  id: string;
  status: string;
  hazard: string | null;
  notes: string;
  createdAt: string;
};

export type AiTriage = { category: string; score: number; signals: string[]; generatedBy: string; generatedAt: string; humanDecision: string | null; finalCategory?: string; decidedBy?: string; decidedAt?: string };
export type WorkerCase = {
  id: string;
  type: string;
  priority: string;
  status: string;
  summary: string;
  createdAt: string;
  aiTriage?: AiTriage;
  aiSummary?: string;
};

export type Dashboard = {
  worker: Worker;
  wageEntries: WageEntry[];
  checkIns: CheckIn[];
  cases: WorkerCase[];
};

export type NgoCase = WorkerCase & { workerId: string; owner: string | null; updatedAt: string };
export type Evidence = { id: string; fileName: string; type: string; mimeType?: string; sizeBytes?: number; checksum?: string | null; scanStatus?: string; available?: boolean; createdAt: string };
export type CaseDetail = { case: NgoCase; notes: { id: string; author: string; text: string; createdAt: string }[]; evidence: Evidence[]; auditLog: { id: string; action: string; actor: string; timestamp: string; details: Record<string, unknown> }[]; aiSummary?: string };

type ApiError = Error & { offline?: boolean; status?: number };

async function request<T>(path: string, init?: RequestInit, retry = true): Promise<T> {
  try {
    const session = (() => {
      try {
        const worker = JSON.parse(localStorage.getItem("pehchaan-worker-session") || "null");
        const ngo = JSON.parse(localStorage.getItem("pehchaan-ngo-session") || "null");
        return worker || ngo || null;
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
        const key = localStorage.getItem("pehchaan-worker-session") ? "pehchaan-worker-session" : "pehchaan-ngo-session";
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
  logout: (refreshToken?: string) => request<void>("/api/auth/logout", json({ refreshToken })),
};

export type EmployerRecord = { id: string; period: string; promisedAmount: number; paidAmount: number; status: string; discrepancyResponse?: string | null };
export const employerApi = {
  dashboard: () => request<{ records: EmployerRecord[]; compliance: { flagged: number; responded: number; responseRate: number } }>("/api/employer/dashboard"),
  respond: (id: string, response: string) => request<{ record: EmployerRecord }>(`/api/employer/wage-records/${encodeURIComponent(id)}`, { ...json({ response }), method: "PATCH" }),
  interest: (body: Record<string, unknown>) => request<{ submitted: boolean }>("/api/employer/interest", json(body)),
  createWorksite: (name: string) => request<{ worksite: { id: string; name: string; registrationCode: string; verified: boolean }; qrPayload: string; qrDataUrl: string }>("/api/employer/worksites", json({ name })),
};

export const workerApi = {
  dashboard: (workerId: string) => request<Dashboard>(`/api/workers/${encodeURIComponent(workerId)}`),
  addWage: (body: Record<string, unknown>) => request<{ wageEntry: WageEntry }>("/api/wage-entries", json(body)),
  checkIn: (body: Record<string, unknown>) => request<{ checkIn: CheckIn }>("/api/check-ins", json(body)),
  createCase: (body: Record<string, unknown>) => request<{ case: WorkerCase }>("/api/cases", json(body)),
  linkWorksite: (registrationCode: string) => request<{ worksite: { id: string; name: string; verified: boolean } }>("/api/worksites/link", json({ registrationCode })),
};

export const ngoApi = {
  cases: () => request<{ cases: NgoCase[]; total: number }>("/api/ngo/cases"),
  detail: (caseId: string) => request<CaseDetail>(`/api/ngo/cases/${encodeURIComponent(caseId)}`),
  updateCase: (caseId: string, body: Record<string, unknown>) => request<{ case: NgoCase }>(`/api/ngo/cases/${encodeURIComponent(caseId)}`, { ...json(body), method: "PATCH" }),
  addNote: (caseId: string, body: { author: string; text: string }) => request<{ note: CaseDetail["notes"][number] }>(`/api/ngo/cases/${encodeURIComponent(caseId)}/notes`, json(body)),
  audit: () => request<{ entries: CaseDetail["auditLog"] }>("/api/ngo/audit-log"),
  aiPatterns: () => request<{ patterns: { employer: string; complaintCount: number; independentWorkers: number; caseIds: string[]; signal: string }[] }>("/api/ngo/ai-patterns"),
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
