// Stier som "beton.armering.afskalning" i en model.
type Model = Record<string, any>;
/** Sætter en værdi på en sti som "beton.armering.afskalning" i en model (muterer). */
export function saetSti(model: Model, sti: string, v: unknown): void {
  const dele = sti.split('.');
  let o: any = model;
  for (let i = 0; i < dele.length - 1; i++) {
    if (o[dele[i]!] == null || typeof o[dele[i]!] !== 'object') o[dele[i]!] = {};
    o = o[dele[i]!];
  }
  o[dele[dele.length - 1]!] = v;
}
export const laesSti = (model: Model, sti: string): unknown => sti.split('.').reduce<any>((o, k) => o?.[k], model);
