-- =====================================================================
-- MEDD-App Database Schema (PostgreSQL)
-- Medication disposal survey for Colombian households.
-- Column names follow the structured codebook (FIELD_ID, lowercased)
-- so every column is traceable to the data dictionary.
-- =====================================================================

-- Idempotent rebuild helpers (safe to run repeatedly during dev).
-- DROP TABLE IF EXISTS medications CASCADE;
-- DROP TABLE IF EXISTS surveys CASCADE;

-- ---------------------------------------------------------------------
-- SURVEYS  (1 row per encuesta, PK = NUI)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS surveys (
    nui            SERIAL PRIMARY KEY,                 -- NUI  : ID Único de Registro (auto-increment PK)
    user_id        UUID        NOT NULL,               -- Dueño (auth.users.id de Supabase). Lo sella el backend desde el JWT; nunca llega del cliente.
    f_eta          DATE        NOT NULL,               -- F_ETA: Fecha de la entrevista (<= hoy)
    nui_etr        INTEGER     NOT NULL,               -- NUI_ETR: ID Único del Encuestador (entero positivo)
    f_nac          DATE        NOT NULL,               -- F_NAC: Fecha de nacimiento (< F_ETA)
    edad           INTEGER,                            -- EDAD : Calculada (F_ETA - F_NAC), read-only en UI
    ciudad         VARCHAR(120),                       -- CIUDAD
    dir            TEXT,                               -- DIR  : Dirección de residencia
    estrato        SMALLINT,                           -- ESTRATO: 1..6
    etnia          VARCHAR(40),                        -- ETNIA
    as_salud       VARCHAR(40),                        -- AS_SALUD: Régimen de afiliación
    est_lab        VARCHAR(40),                        -- EST_LAB: Ocupación actual
    ingreso        VARCHAR(40),                        -- INGRESO: Ingresos (SMMLV)
    nv_estu        VARCHAR(40),                        -- NV_ESTU: Nivel de estudios
    per_salud      VARCHAR(20),                        -- PER_SALUD: Percepción de salud
    est_salud      BOOLEAN,                            -- EST_SALUD: ¿Enfermedad últimas 4 semanas?
    prb_salud      TEXT,                               -- PRB_SALUD: Principal problema (req. si EST_SALUD)
    con_med        BOOLEAN,                            -- CON_MED  : ¿Consume medicamentos? (req. si EST_SALUD)
    med_prc        BOOLEAN,                            -- MED_PRC  : ¿Ordenados por médico? (req. si CON_MED)
    f_prc          DATE,                               -- F_PRC    : Fecha prescripción (F_NAC..F_ETA)
    f_disp         DATE,                               -- F_DISP   : Fecha dispensación (F_PRC..F_ETA)
    ind_med        BOOLEAN,                            -- IND_MED  : ¿Sigue indicaciones? (req. si MED_PRC)
    med_sob        BOOLEAN,                            -- MED_SOB  : ¿Tiene medicamentos guardados sin consumir?
    disp_med_vc    BOOLEAN,                            -- DISP_MED_VC: ¿Sabe qué hacer con vencidos?
    cto_disp_vc    TEXT,                               -- CTO_DISP_VC: ¿Qué hace? (req. si DISP_MED_VC)
    vto_med_nc     BOOLEAN,                            -- VTO_MED_NC : ¿Hay unidades vencidas almacenadas?
    cant_med       INTEGER,                            -- CANT_MED   : Cantidad total sin consumir (>=0)
    cant_med_vto   INTEGER,                            -- CANT_MED_VTO: Cantidad vencidos (>=0, <= CANT_MED)
    peso_med_nc    NUMERIC(12,2),                      -- PESO_MED_NC : Peso total (gramos, >=0)
    obs            TEXT,                               -- OBS  : Observaciones (opcional)
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Relational bounds / data-integrity constraints --------------------
    CONSTRAINT chk_nui_etr_pos   CHECK (nui_etr > 0),
    CONSTRAINT chk_f_eta_past    CHECK (f_eta <= CURRENT_DATE),
    CONSTRAINT chk_nac_before_eta CHECK (f_nac < f_eta),
    CONSTRAINT chk_estrato       CHECK (estrato IS NULL OR estrato BETWEEN 1 AND 6),
    CONSTRAINT chk_etnia         CHECK (etnia IS NULL OR etnia IN
                                   ('Indígena','Gitano/ROM','Afrodescendiente','Ninguna')),
    CONSTRAINT chk_as_salud      CHECK (as_salud IS NULL OR as_salud IN
                                   ('Contributivo','Subsidiado','Especial','No afiliado')),
    CONSTRAINT chk_est_lab       CHECK (est_lab IS NULL OR est_lab IN
                                   ('Empleado','Independiente','Hogar','Pensionado','Estudiante')),
    CONSTRAINT chk_ingreso       CHECK (ingreso IS NULL OR ingreso IN
                                   ('< 1 SMMLV','1-3 SMMLV','> 4 SMMLV','No responde')),
    CONSTRAINT chk_nv_estu       CHECK (nv_estu IS NULL OR nv_estu IN
                                   ('Ninguno','Primaria','Secundaria','Bachiller','Técnico','Profesional')),
    CONSTRAINT chk_per_salud     CHECK (per_salud IS NULL OR per_salud IN ('Buena','Regular','Mala')),
    CONSTRAINT chk_f_prc_bounds  CHECK (f_prc IS NULL OR (f_prc >= f_nac AND f_prc <= f_eta)),
    CONSTRAINT chk_f_disp_bounds CHECK (f_disp IS NULL OR (f_disp <= f_eta AND (f_prc IS NULL OR f_disp >= f_prc))),
    CONSTRAINT chk_cant_med      CHECK (cant_med IS NULL OR cant_med >= 0),
    CONSTRAINT chk_cant_med_vto  CHECK (cant_med_vto IS NULL OR cant_med_vto >= 0),
    CONSTRAINT chk_cant_vto_le   CHECK (cant_med_vto IS NULL OR cant_med IS NULL OR cant_med_vto <= cant_med),
    CONSTRAINT chk_peso          CHECK (peso_med_nc IS NULL OR peso_med_nc >= 0)
);

-- ---------------------------------------------------------------------
-- MEDICATIONS  (1:N — N productos almacenados por encuesta)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medications (
    id         SERIAL PRIMARY KEY,
    nui        INTEGER NOT NULL REFERENCES surveys(nui) ON DELETE CASCADE,  -- FK -> surveys.NUI
    nm_med     VARCHAR(200),                  -- NM_MED  : Nombre comercial
    dci        VARCHAR(200),                  -- DCI     : Denominación Común Internacional (principio activo)
    conc_med   NUMERIC(12,3),                 -- CONC_MED: Concentración
    und_conc   VARCHAR(8),                    -- UND_CONC: mcg|mg|g|UI|%
    f_vto      DATE,                          -- F_VTO   : Fecha de vencimiento individual
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_und_conc CHECK (und_conc IS NULL OR und_conc IN ('mcg','mg','g','UI','%')),
    CONSTRAINT chk_conc_pos CHECK (conc_med IS NULL OR conc_med >= 0)
);

-- Despliegues previos: añade user_id sin romper filas existentes. Se crea
-- nullable aquí porque puede haber datos históricos sin dueño conocido; tras
-- poblarlo se puede endurecer con: ALTER TABLE surveys ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS user_id UUID;

CREATE INDEX IF NOT EXISTS idx_medications_nui ON medications(nui);
CREATE INDEX IF NOT EXISTS idx_surveys_ciudad  ON surveys(ciudad);
CREATE INDEX IF NOT EXISTS idx_surveys_estrato ON surveys(estrato);
-- Filtra rápido las encuestas por dueño (autorización por propietario en el API).
CREATE INDEX IF NOT EXISTS idx_surveys_user_id ON surveys(user_id);

-- ---------------------------------------------------------------------
-- ANALYTICS VIEW  (Revenue-critical time calculations, Excel logic)
--   T_VTO  = F_ETA  - F_VTO   (días vencido acumulado en hogar)
--   T_DISP = F_ETA  - F_DISP  (días desde entrega hasta encuesta)
--   V_UTIL = F_VTO  - F_DISP  (vida útil remanente al entregar)
-- Per-product metrics joined to the survey's socio-geographic context.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_product_metrics AS
SELECT
    m.id,
    m.nui,
    m.nm_med,
    m.dci,
    m.conc_med,
    m.und_conc,
    m.f_vto,
    s.f_eta,
    s.f_disp,
    s.ciudad,
    s.dir,
    s.estrato,
    s.as_salud,
    s.peso_med_nc,
    s.cant_med,
    s.cant_med_vto,
    (m.f_vto < s.f_eta)                          AS is_expired,
    CASE WHEN m.f_vto IS NOT NULL
         THEN (s.f_eta  - m.f_vto)  END          AS t_vto,    -- días vencido
    CASE WHEN s.f_disp IS NOT NULL
         THEN (s.f_eta  - s.f_disp) END          AS t_disp,   -- ciclo total
    CASE WHEN m.f_vto IS NOT NULL AND s.f_disp IS NOT NULL
         THEN (m.f_vto  - s.f_disp) END          AS v_util    -- ventana útil
FROM medications m
JOIN surveys s ON s.nui = m.nui;
