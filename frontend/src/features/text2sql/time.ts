/** «oggi 10:42», «ieri 16:30» o «18/11 14:20». */
export function fmtWhen(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const hm = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(now) - day(d)) / 864e5)
  if (diff === 0) return `oggi ${hm}`
  if (diff === 1) return `ieri ${hm}`
  return `${d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })} ${hm}`
}
