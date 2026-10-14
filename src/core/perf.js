// Meet hoe lang onderdelen per beeldje duren (gemiddeld en piek), om haperingen op te sporen.
// Te zien in de browserconsole via window.__tp.store.perf (in dev-modus).
import { store } from './store.js';

const perf = (store.perf = {});
export const now = () => performance.now();
export function measure(name, t0) {
  const ms = performance.now() - t0;
  perf[name] = perf[name] == null ? ms : perf[name] * 0.95 + ms * 0.05;
  perf[name + 'Max'] = Math.max(ms, (perf[name + 'Max'] || 0) * 0.995);
}
