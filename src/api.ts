export type Language = "hi" | "en";

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

export type WorkerCase = {
  id: string;
  type: string;
  priority: string;
  status: string;
  summary: string;
  createdAt: string;
};

export type Dashboard = {
  worker: Worker;
  wageEntries: WageEntry[];
  checkIns: CheckIn[];
  cases: WorkerCase[];
};

export type NgoCase = WorkerCase & { workerId: string; owner: string | null; updatedAt: string };
export type CaseDetail = { case: NgoCase; notes: { id: string; author: string; text: string; createdAt: string }[]; evidence: { id: string; fileName: string; type: string; createdAt: string }[]; auditLog: { id: string; action: string; actor: string; timestamp: string; details: Record<string, unknown> }[] };

type ApiError = Error & { offline?: boolean; status?: number };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(path, init);
    const payload = await response.json().catch(() => ({}));
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
  verifyOtp: (phone: string, otp: string) => request<{ accessToken: string; user: Worker }>("/api/auth/verify-otp", json({ phone, otp })),
};

export const workerApi = {
  dashboard: (workerId: string) => request<Dashboard>(`/api/workers/${encodeURIComponent(workerId)}`),
  addWage: (body: Record<string, unknown>) => request<{ wageEntry: WageEntry }>("/api/wage-entries", json(body)),
  checkIn: (body: Record<string, unknown>) => request<{ checkIn: CheckIn }>("/api/check-ins", json(body)),
  createCase: (body: Record<string, unknown>) => request<{ case: WorkerCase }>("/api/cases", json(body)),
};

export const ngoApi = {
  cases: () => request<{ cases: NgoCase[]; total: number }>("/api/ngo/cases"),
  detail: (caseId: string) => request<CaseDetail>(`/api/ngo/cases/${encodeURIComponent(caseId)}`),
  updateCase: (caseId: string, body: Record<string, unknown>) => request<{ case: NgoCase }>(`/api/ngo/cases/${encodeURIComponent(caseId)}`, { ...json(body), method: "PATCH" }),
  addNote: (caseId: string, body: { author: string; text: string }) => request<{ note: CaseDetail["notes"][number] }>(`/api/ngo/cases/${encodeURIComponent(caseId)}/notes`, json(body)),
  audit: () => request<{ entries: CaseDetail["auditLog"] }>("/api/ngo/audit-log"),
};

export type { ApiError };
