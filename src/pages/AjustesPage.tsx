import { useState } from 'react'
import { TopBar } from '../components/layout'
import { Divider, C } from '../components/ui'
import { ProjectConfigSection, SurveyorProfileSection, AppearanceSection, AccountSection, AppInfoSection } from '../components/settings'
import { useStore } from '../lib/store'
import { isProfileComplete, surveyMissingProfile } from '../lib/validators'
import type { Settings } from '../types'

// ─── SETTINGS PAGE ────────────────────────────────────────────────────────

export function AjustesPage() {
  const { settings, persistSettings, surveys, user, userRole, signOut, syncing, triggerSync, backfillProfile, openWelcome, theme, toggleTheme, density, setDensity } = useStore()
  const [form, setForm] = useState(settings)
  const set = (k: keyof Settings) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  const isInvestigador = userRole === 'investigador'
  const pendingCount   = surveys.filter(s => s.syncStatus !== 'synced').length
  // Surveys captured before the profile was complete that can be backfilled.
  // Only meaningful for encuestadores with a now-complete profile.
  const backfillCount  = (!isInvestigador && isProfileComplete(settings))
    ? surveys.filter(surveyMissingProfile).length
    : 0

  return (
    <div>
      <TopBar
        title="Ajustes"
        subtitle={isInvestigador ? 'Apariencia y cuenta' : 'Proyecto y perfil'}
        icon="ti-settings" accent={C.gray}
      />
      <div className="page-content narrow">
        {/* Project config and the surveyor profile only apply to encuestadores:
            the profile is stamped onto captured surveys and the surveyor id is
            prefilled into new ones. An investigador is a read-only analyst who
            never captures, so prompting them for a surveyor profile is wrong. */}
        {!isInvestigador && (
          <>
            <ProjectConfigSection form={form} set={set} />

            <SurveyorProfileSection
              form={form}
              set={set}
              onSave={() => persistSettings(form)}
              backfillCount={backfillCount}
              onBackfill={() => backfillProfile()}
            />

            <Divider label="apariencia" />
          </>
        )}
        <AppearanceSection
          theme={theme}
          toggleTheme={toggleTheme}
          density={density}
          setDensity={setDensity}
          onShowWelcome={() => openWelcome()}
        />

        <Divider label="cuenta" />
        <AccountSection
          userEmail={user?.email ?? '—'}
          isInvestigador={isInvestigador}
          pendingCount={pendingCount}
          syncing={syncing}
          onSync={() => triggerSync()}
          onSignOut={() => signOut()}
        />

        <Divider label="información" />
        <AppInfoSection surveyCount={surveys.length} />
      </div>
    </div>
  )
}
