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
import { wasalt, athmann, infath } from './protected';

export const connectors: Connector[] = [mobasher, saudiaAuctions, mazadat, tarsyah, qemah, infath, wasalt, athmann];

export function getConnector(id: string): Connector | undefined {
  return connectors.find((c) => c.id === id);
}
