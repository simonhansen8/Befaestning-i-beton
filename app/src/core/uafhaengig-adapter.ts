// Adapter: giver den nye kerne samme form som den gamle fils window.__anker, så de uafhængige tests kan genbruges.
import { standardModel } from './indlaes';
import { indlaesProjekt } from './inddata';
import { beregnProjekt } from './beregn';
import { interaktionBeton } from './interaction';

export const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));
export function merge(base: any, patch: any): any {
  if (patch === undefined) return base;
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return clone(patch);
  const out = Array.isArray(base) || base == null || typeof base !== 'object' ? {} : { ...base };
  for (const [k, v] of Object.entries(patch)) out[k] = merge(out[k], v);
  return out;
}
export const ev = (o: any, id: string) => o.result?.eftervisninger?.find((e: any) => e.id === id);

function tilGammel(model: any, kritisk: boolean, r: any) {
  const k = r.styrendeKombination != null ? r.kombinationer[r.styrendeKombination] : r.kombinationer[0];
  const kr = k?.resultat;
  const result = k && {
    mock: false,
    partialkoefficienter: r.partialkoefficienter,
    eftervisninger: kr.brudformer.map((b: any) => {
      const x: any = { id: b.id, relevant: b.relevant, NEd: b.Ed, NRd: b.Rd, NRk: b.Rk, VEd: b.Ed, VRd: b.Rd, VRk: b.Rk, udnyttelse: b.udnyttelse, styrendeAnker: b.styrendeAnker };
      if (b.id === 'NV_c' || b.id === 'NV_re') {
        const poster = kr.brudformer.filter((y: any) => !y.id.startsWith('NV')).map((y: any) => ({ id: y.id, relevant: y.relevant, udnyttelse: y.udnyttelse }));
        const nv: any = interaktionBeton(poster, kr.tilfaelde, r.indstillinger.interaktion, model.anker.k11);
        if (!Number.isFinite(nv.I756)) delete nv.I756; // ∞ når en β > 1 (7.56 gælder ikke)
        Object.assign(x, nv);
      }
      return x;
    }),
    maksUdnyttelse: r.maksUdnyttelse, ok: r.ok, styrendeBrudform: r.styrendeBrudform,
    ankerkraefter: kr.fordeling.F.map((N: number, i: number) => ({ N, Vx: kr.forskydning.Vx[i], Vy: kr.forskydning.Vy[i] })), fordeling: { ...kr.fordeling, eN1: kr.traek.eN1, eN2: kr.traek.eN2, forskydningMulig: kr.forskydning.mulig },
  };
  if (result) Object.defineProperty(result, 'kombinationer', { value: r.kombinationer, enumerable: false });
  return { model, tilstand: kritisk || r.tilstand === 'fejl' ? 'fejl' : 'ok', fejl: r.diagnostik, result };
}

export function openEngine() {
  const baseModel: any = clone(standardModel('2026-01-01'));
  baseModel.anker.staalklasse = 'bruger'; // testene angiver fuk/fyk direkte
  const calc = async (patch: any) => {
    const ind = indlaesProjekt(merge(baseModel, patch));
    return tilGammel(ind.model, ind.kritisk, beregnProjekt(ind.model as any));
  };
  return { baseModel, calc, load: (m: any) => calc(m), pageErrors: [] as string[], close: async () => {} };
}
