import { CIGARETTES } from './catalog'
import type { Customer } from './types'

/**
 * What the customer says when they step up.
 */
export const requestLine = (customer: Customer): string => {
  if (customer.cigarette === undefined) {
    return 'Just these, thanks.'
  }
  const spec = CIGARETTES[customer.cigarette.cigarette]
  return customer.cigarette.form === 'by-number'
    ? `And number ${String(spec.slot)}, please.`
    : `And a pack of ${spec.label}, please.`
}
