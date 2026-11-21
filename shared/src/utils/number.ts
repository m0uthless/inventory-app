/*
 * Numeri e importi in italiano con il separatore delle migliaia sempre presente.
 * `toLocaleString('it-IT')` lo omette sotto 10.000 («4142,86»): l'app scrive «4.142,86».
 */
const ALWAYS = { useGrouping: 'always' } as unknown as Intl.NumberFormatOptions

export const fmtNumber = (n: number, opts: Intl.NumberFormatOptions = {}) => n.toLocaleString('it-IT', { ...opts, ...ALWAYS })

/** «4.142,86 €» */
export const fmtEuro = (n: number) => `${fmtNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
