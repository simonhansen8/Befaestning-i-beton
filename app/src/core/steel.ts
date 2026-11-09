import { GEVINDAREAL, STAALKLASSER, type StaalKlasseNavn } from './constants';

export interface AnkerStaalInput {
  staalklasse: StaalKlasseNavn | 'bruger';
  /** Kun brugt når staalklasse === 'bruger'. */
  fuk?: number; fyk?: number; duktil?: boolean;
  d: number;
  gevind: boolean;
  /** Valgfri overstyring af spændingsarealet (produktdata). */
  As?: number | null;
}

export interface AnkerStaal { fuk: number; fyk: number; duktil: boolean; As: number }

/** Afleder stålets egenskaber og spændingsareal. Intet af dette gemmes som input ved siden af klassen. */
export function afledStaal(a: AnkerStaalInput): AnkerStaal {
  const k = a.staalklasse === 'bruger' ? undefined : STAALKLASSER[a.staalklasse];
  const fuk = k?.fuk ?? a.fuk, fyk = k?.fyk ?? a.fyk;
  if (fuk == null || fyk == null) throw new Error('fuk/fyk mangler for brugerdefineret stålklasse');
  const As = a.As ?? (a.gevind ? GEVINDAREAL[a.d] ?? (Math.PI / 4) * (0.885 * a.d) ** 2 : (Math.PI / 4) * a.d ** 2);
  return { fuk, fyk, duktil: k?.duktil ?? a.duktil ?? true, As };
}
