import { supabase } from './supabase';
import type { SurveyDraft } from './store';

// Data-access layer for surveys. When VITE_API_URL is configured, requests go
// through the hardened Express backend: writes are atomic (survey + its N
// medications in one transaction), server-validated, and authorized per owner.
// When it is not set, we fall back to talking to Supabase directly (RLS-backed)
// so the app keeps working without the backend deployed.
//
// In both cases the user never deals with auth plumbing: the Supabase access
// token is attached automatically (Tesler's law — the complexity stays here).

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

export const usingBackend = API_URL.length > 0;

type SurveyRow = Record<string, unknown>;

async function authHeaders(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) throw new Error('No autenticado');
    return { Authorization: `Bearer ${token}` };
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()), ...(init.headers ?? {}) },
    });
    if (!res.ok) {
        // Surface the backend's error message when present, without leaking raw bodies.
        let message = `Error ${res.status}`;
        try {
            const body = await res.json();
            if (body?.error) message = body.error;
        } catch {
            /* non-JSON error body; keep the status-based message */
        }
        throw new Error(message);
    }
    return res.json() as Promise<T>;
}

export async function listSurveys(): Promise<SurveyRow[]> {
    if (usingBackend) {
        return apiFetch<SurveyRow[]>('/api/surveys');
    }
    const { data, error } = await supabase
        .from('surveys')
        .select('*, medications(*)')
        .order('nui', { ascending: false });
    if (error) throw error;
    return data ?? [];
}

export async function createSurvey(draft: SurveyDraft): Promise<SurveyRow> {
    if (usingBackend) {
        // The backend stamps user_id from the verified JWT — never sent by the client.
        return apiFetch<SurveyRow>('/api/surveys', {
            method: 'POST',
            body: JSON.stringify(draft),
        });
    }

    // Direct-Supabase fallback (RLS enforces ownership). Mirrors the previous
    // store behavior: stamp user_id client-side, then insert medications.
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) throw new Error('No autenticado');

    const { medications, ...surveyFields } = draft;
    const { data: survey, error: surveyErr } = await supabase
        .from('surveys')
        .insert({ ...surveyFields, user_id: userId })
        .select()
        .single();
    if (surveyErr) throw surveyErr;

    if (medications.length) {
        const rows = medications.map((m) => ({ ...m, nui: (survey as { nui: number }).nui }));
        const { error: medErr } = await supabase.from('medications').insert(rows);
        if (medErr) throw medErr;
    }
    return survey as SurveyRow;
}
