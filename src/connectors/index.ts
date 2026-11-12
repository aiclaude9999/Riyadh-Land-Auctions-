/**
 * Connector registry. To add a new source: create `src/connectors/<name>.ts` exporting a `Connector`
 * and add it to this list — nothing else in the app needs to change.
 */
import type { Connector } from './types';
import { mobasher } from './mobasher';
import { saudiaAuctions } from './saudia-auctions';
import { mazadat } from './mazadat';
import { tarsyah } from './tarsyah';
import { qemah } from './qemah';
import { wasalt, athmann } from './protected';
import { infath } from './infath';
import { soum } from './soum';
import { infathAuctions } from './infath-auctions';

export const connectors: Connector[] = [mobasher, saudiaAuctions, mazadat, tarsyah, qemah, soum, infath, infathAuctions, wasalt, athmann];

export function getConnector(id: string): Connector | undefined {
  return connectors.find((c) => c.id === id);
}

/** Connectors this machine can reach: Saudi-only sources run only where SAUDI_NETWORK=1, and then alone. */
export function connectorsForThisNetwork(): Connector[] {
  const saudi = process.env.SAUDI_NETWORK === '1';
  return connectors.filter((c) => (saudi ? c.saudiOnly : !c.saudiOnly));
}
