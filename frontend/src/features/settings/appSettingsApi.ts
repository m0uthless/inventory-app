import { api } from '@shared/api/client'

export type SettingValue = string | number
export type AppSettingRow = { key: string; label: string; kind: 'emails' | 'int'; value: SettingValue; default: SettingValue; min: number | null; max: number | null }
export type AppSettingsSection = { key: string; label: string; settings: AppSettingRow[] }
export type AppSettingsData = { sections: AppSettingsSection[] }

export const appSettingsApi = {
  get: async () => (await api.get<AppSettingsData>('/app-settings/')).data,
  patch: async (values: Record<string, SettingValue>) => (await api.patch<AppSettingsData>('/app-settings/', values)).data,
  testContractEmail: async () => (await api.post<{ sent_to: string[] }>('/app-settings/contracts/test-email/')).data,
}

/** Valori per chiave. */
export const settingValues = (d: AppSettingsData): Record<string, SettingValue> =>
  Object.fromEntries(d.sections.flatMap((s) => s.settings.map((x) => [x.key, x.value])))
