# Operación · `SUPABASE_DB_URL` (respaldo + seed de catálogos)

> ⚠️ La cadena de conexión **contiene la contraseña de la base de datos**. Es un
> secreto: solo el dueño del proyecto debe manejarla. **Nunca** la pegues en
> chats, commits, issues ni en el cuerpo de un PR — solo va en **GitHub → Secrets**.

Este único secret desbloquea dos cosas:

1. El **respaldo periódico** (`.github/workflows/supabase-backup.yml`), que compensa
   la ausencia de backups automáticos del plan Free.
2. La **siembra de catálogos grandes** en producción (p. ej. CIE-10) por el canal de
   migraciones, que no es viable por el canal MCP.

---

## Parte 1 — Supabase: obtener la cadena de conexión

1. Entra a [supabase.com/dashboard](https://supabase.com/dashboard) → proyecto
   `mobufleivfbnfdscgzbs`.
2. **Project Settings** (engranaje, abajo a la izquierda) → **Database**.
3. Sección **Connection string**. Elige el modo correcto para el runner de GitHub:

   | Modo | Puerto | ¿Para GitHub Actions? |
   |---|---|---|
   | **Session pooler** | 5432 | ✅ **Recomendado** — es IPv4 (los runners de GitHub no tienen IPv6) |
   | Direct connection | 5432 | Solo con el add-on IPv4 (por defecto es IPv6 → falla en Actions) |
   | Transaction pooler | 6543 | ❌ NO — `pg_dump` / `db dump` necesita sesión, no transacción |

   Usa **Session pooler**. El URI tiene esta forma:

   ```
   postgresql://postgres.mobufleivfbnfdscgzbs:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres
   ```

4. **Contraseña:** reemplaza `[YOUR-PASSWORD]` por la contraseña real de la BD.
   - Si no la recuerdas: misma página → **Database password** → **Reset database
     password** (genera una nueva; guárdala en tu gestor de contraseñas).
   - Si la contraseña trae caracteres especiales (`@ : / ? # %`), **URL-encódalos**
     (p. ej. `@` → `%40`) o resetéala a una sin esos caracteres.

   Cadena final de ejemplo (con contraseña ya sustituida):

   ```
   postgresql://postgres.mobufleivfbnfdscgzbs:MiClaveReal123@aws-0-us-east-1.pooler.supabase.com:5432/postgres
   ```

---

## Parte 2 — GitHub: cargar el secret

1. Repo → **Settings** → **Secrets and variables** → **Actions**.
2. Pestaña **Secrets** → **New repository secret**.
3. **Name:** `SUPABASE_DB_URL` (exacto, respeta mayúsculas).
   **Secret:** la cadena completa de la Parte 1.
4. **Add secret**. (Solo admin/owner del repo; el valor queda cifrado y no se
   vuelve a mostrar.)

Opcional — copia extra a Supabase Storage: añade también `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_BACKUP_BUCKET`. Sin ellos, el backup igual
guarda el artefacto en GitHub.

---

## Parte 3 — Probar que el backup funciona

1. Pestaña **Actions** → workflow **Supabase Backup** → **Run workflow**
   (`workflow_dispatch`).
2. Con el secret puesto, ya no dispara el fallo del *guard*: corre `supabase db
   dump` y sube el artefacto **`medd-backup-<timestamp>`** (retención 90 días).
3. Si falla el dump con error de conexión/timeout → casi siempre es que se usó el
   pooler de **transaction (6543)** o la **direct (IPv6)**. Vuelve a la Parte 1 y usa
   **Session pooler (5432)**.

---

## Parte 4 — Sembrar catálogos grandes (p. ej. CIE-10)

Con `SUPABASE_DB_URL` disponible en una terminal con `psql`, aplica el archivo de
migración ya versionado. Es **idempotente** (`create table if not exists` +
`on conflict do nothing`), seguro de re-ejecutar:

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/032_cie10_sispro.sql
```

Verifica integridad y coincidencia con el checksum de origen:

```sql
-- conteo esperado
select count(*) from public.cie10_sispro;   -- 2053

-- checksum: debe dar EXACTAMENTE f277370a45ff3fda8f52c6b581f1e217
select md5(string_agg(
         codigo || '|' || descripcion || '|' || capitulo::text || '|' || capitulo_nombre,
         E'\n' order by codigo))
from public.cie10_sispro;
```

Si el md5 coincide, la siembra es byte-perfecta (dato oficial sin corromper).

- Para granularidad RIPS de 4 caracteres (12.568 subcategorías), el catálogo
  completo está en `scripts/data/cie10_4char_full.sql` — se aplica igual con
  `psql -f`.
- **No** usar `supabase db push` para el *seed*: como la migración `032` ya se aplicó
  a prod (vía MCP), el historial de migraciones puede hacer que el CLI la salte. El
  `psql -f` directo es idempotente y no depende del tracking.

---

**Resumen.** Partes 1–2 configuran el secret una sola vez → Parte 3 activa el
respaldo diario → Parte 4 puebla los catálogos. Un secret, ambas cosas resueltas.
