## 2024-05-18 - Missing Supabase Environment Variables

**Learning:** When creating a Supabase client at module scope using `import.meta.env`, immediately throwing an error if environment variables are missing causes the whole app to crash on load. This is especially problematic in build steps, CI, or when the user wants to see a helpful fallback UI.

**Action:** Initialize the Supabase client with valid placeholder strings if the environment variables are missing. Log a warning conditionally in development (`import.meta.env.DEV`) instead of a raw `throw new Error()`. This ensures the module loads cleanly, allowing the application to render fallback states or handle the disconnected state gracefully.
