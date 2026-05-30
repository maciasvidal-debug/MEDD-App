/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    // Base URL of the hardened Express API (e.g. https://api.example.com).
    // When set, the app routes survey reads/writes through the backend
    // (atomic, server-validated, JWT-authenticated). When empty, it falls
    // back to talking to Supabase directly.
    readonly VITE_API_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
