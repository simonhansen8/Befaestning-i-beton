import { APP_BUILD } from './version';
import { opsaet } from './ui/render';
import { Store } from './ui/state';
import { rapportHtml } from './ui/rapport';
import './ui/style.css';

const rod = document.getElementById('app')!;
const store = new Store();
opsaet(rod, store, APP_BUILD);
// Til test og fejlsøgning
(window as unknown as { __ny: unknown }).__ny = { store, rapportHtml: () => rapportHtml(store.tilstand.model, store.tilstand.resultat, APP_BUILD) };
