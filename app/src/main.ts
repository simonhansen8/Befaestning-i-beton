import { APP_BUILD } from './version';
import { opsaet } from './ui/render';
import { Store } from './ui/state';
import { rapportHtml } from './ui/rapport';
import { gemLokalt, laesGemt, laesTema, saetTema } from './ui/autogem';
import './ui/style.css';

const rod = document.getElementById('app')!;
saetTema(laesTema());
const store = new Store();
const gemt = laesGemt();
if (gemt) store.indlaesTekst(gemt);
let timer: ReturnType<typeof setTimeout> | undefined;
store.subscribe(() => { clearTimeout(timer); timer = setTimeout(() => gemLokalt(store.tilJson()), 400); });
opsaet(rod, store, APP_BUILD);
// Til test og fejlsøgning
(window as unknown as { __ny: unknown }).__ny = { store, rapportHtml: () => rapportHtml(store.tilstand.model, store.tilstand.resultat, APP_BUILD) };
