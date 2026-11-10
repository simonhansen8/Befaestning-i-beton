// Danske navne på brudformer.
export const BRUDFORM: Record<string, string> = {
  N_s: 'Stålbrud, træk', N_p: 'Udtrækning', N_c: 'Betonkegle', N_sp: 'Spaltning', N_cb: 'Sidebrud', N_re: 'Ankerarmering, træk (stål)',
  N_a: 'Ankerarmering, forankring i beton', N_cre: 'Betonkegle med ankerarmering', V_s: 'Stålbrud, forskydning', V_cp: 'Pry-out',
  V_c: 'Betonkantbrud', V_re: 'Ankerarmering, forskydning', V_a: 'Ankerarmering, forankring (forskydning)', V_ek: 'Kantstang (fig. 7.10 a)', NV_s: 'Interaktion, stål',
  NV_c: 'Interaktion, beton', NV_re: 'Interaktion, ankerarmering',
};

export const MOENSTER_NAVN: Record<string, string> = {
  '1': '1 bolt', '2x': '2 bolte i x', '2y': '2 bolte i y', '4': '4 bolte, rektangulær', '6': '6 bolte, 3 × 2',
  '8': '8 bolte, randen af 3 × 3', '9': '9 bolte, 3 × 3', cirk: 'Cirkulær', fri: 'Fri placering',
};
export const PARAM_NAVN: Record<string, string> = { sx: 'Afstand sx [mm]', sy: 'Afstand sy [mm]', n: 'Antal', r: 'Radius [mm]', vinkel: 'Startvinkel [°]' };
