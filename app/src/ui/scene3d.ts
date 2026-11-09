// 3D-visning med three.js. Selve scenen beskrives af model3d.ts; her tegnes den og styres kameraet.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Del, Scene3DBeskrivelse } from './model3d';

export type Kamera = 'iso' | 'top' | 'front' | 'side';
const FARVE = { beton: 0xaab0ba, plade: 0x6e7684, staal: 0x2c323b, last: 0x7c3aed, arm: 0xb45309, forankring: 0xf59e0b, tilbehoer: 0x0f766e, inaktiv: 0x9ca3af, zone: 0xb45309, akse: 0x667085 };

// model (x, y, z op) → three (x, y op, z mod dig)
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, z, -y);

export interface Scene3DValg {
  /** null hvis målet kan rettes; ellers en forklaring (vises som tooltip). */
  kanRettes?: (felt: string) => string | null;
  /** Anvender ny værdi; returnerer false, hvis den afvises. */
  ret?: (felt: string, vaerdi: number) => boolean;
}

export interface Scene3D {
  element: HTMLElement;
  opdater(b: Scene3DBeskrivelse): void;
  saetKamera(k: Kamera, animer?: boolean): void;
  tegn(): void;
  destroy(): void;
}

function etiket(tekst: string, klasse = 'etiket3d'): CSS2DObject {
  const d = document.createElement('div');
  d.className = klasse; d.textContent = tekst;
  return new CSS2DObject(d);
}

function pil(fra: THREE.Vector3, til: THREE.Vector3, farve: number, r: number): THREE.Group {
  const g = new THREE.Group();
  const dir = til.clone().sub(fra), len = dir.length();
  if (len < 1e-6) return g;
  dir.normalize();
  const hoved = Math.min(len * 0.3, r * 7), skaft = len - hoved;
  const mat = new THREE.MeshStandardMaterial({ color: farve, roughness: 0.5, depthTest: false });
  const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r, skaft, 12), mat), h = new THREE.Mesh(new THREE.ConeGeometry(r * 2.4, hoved, 16), mat);
  s.position.y = skaft / 2; h.position.y = skaft + hoved / 2;
  s.renderOrder = h.renderOrder = 10;
  const inde = new THREE.Group(); inde.add(s, h);
  inde.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  inde.position.copy(fra);
  g.add(inde);
  return g;
}

function bue(centrum: THREE.Vector3, akse: 'x' | 'y' | 'z', radius: number, fortegn: 1 | -1, vinkel: number, farve: number, r: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: farve, roughness: 0.5, depthTest: false });
  const bueGeo = new THREE.TorusGeometry(radius, r, 8, 48, (vinkel * Math.PI) / 180);
  const t = new THREE.Mesh(bueGeo, mat); t.renderOrder = 10;
  const kegle = new THREE.Mesh(new THREE.ConeGeometry(r * 2.6, r * 8, 16), mat); kegle.renderOrder = 10;
  const slut = (vinkel * Math.PI) / 180;
  kegle.position.set(radius * Math.cos(slut), radius * Math.sin(slut), 0);
  kegle.rotation.z = slut + Math.PI / 2 * (fortegn > 0 ? 1 : -1) - (fortegn > 0 ? 0 : Math.PI);
  const inde = new THREE.Group(); inde.add(t, kegle);
  if (fortegn < 0) inde.scale.y = -1;
  // torus ligger i xy-planen med normal z; drej til ønsket akse (model-akse → three-akse)
  const ind = new THREE.Group(); ind.add(inde);
  if (akse === 'x') ind.rotation.y = Math.PI / 2;           // normal langs three-x
  else if (akse === 'y') ind.rotation.x = -Math.PI / 2;     // model-y = three-(−z)... normal langs three-z
  else ind.rotation.x = Math.PI / 2;                        // model-z = three-y: normal op
  ind.position.copy(centrum);
  g.add(ind);
  return g;
}

export function opret3D(valg: Scene3DValg = {}): Scene3D {
  const element = document.createElement('div');
  element.className = 'scene3d';
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const labels = new CSS2DRenderer();
  labels.domElement.className = 'labels3d';
  element.append(renderer.domElement, labels.domElement);
  const scene = new THREE.Scene();
  const kamera = new THREE.PerspectiveCamera(40, 1, 1, 100000);
  const lys = new THREE.DirectionalLight(0xffffff, 2.2); lys.position.set(-1, 2, 1.4);
  scene.add(new THREE.AmbientLight(0xffffff, 1.1), lys);
  const kontrol = new OrbitControls(kamera, labels.domElement);
  kontrol.enableDamping = false;
  let indhold = new THREE.Group(); scene.add(indhold);
  let beskrivelse: Scene3DBeskrivelse | null = null;
  let planlagt = 0;
  const tegn = () => { planlagt = 0; renderer.render(scene, kamera); labels.render(scene, kamera); };
  const bed = () => { if (!planlagt) planlagt = requestAnimationFrame(tegn); };
  kontrol.addEventListener('change', bed);

  const tilpas = () => {
    const w = Math.max(element.clientWidth, 100), h = Math.max(element.clientHeight, 100);
    renderer.setSize(w, h, false); labels.setSize(w, h);
    kamera.aspect = w / h; kamera.updateProjectionMatrix(); bed();
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(tilpas) : null;
  ro?.observe(element);

  /** Klik på et mål åbner et indtastningsfelt; Enter anvender, Esc eller klik udenfor fortryder. */
  function goerRedigerbar(el: HTMLElement, tekst: string, felt: string, vaerdi: number) {
    const hvorfor = valg.kanRettes?.(felt) ?? null;
    el.classList.add(hvorfor ? 'laast' : 'redigerbar');
    el.title = hvorfor ?? (felt.startsWith('last:') ? 'Klik for at rette lasten' : 'Klik for at rette målet');
    if (hvorfor) return;
    for (const ev of ['pointerdown', 'mousedown', 'touchstart']) el.addEventListener(ev, (e) => e.stopPropagation());
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (el.querySelector('input')) return;
      const [navn, rest = ''] = tekst.split(' = ');
      const enhed = rest.split(' ').pop() || 'mm';
      const inp = document.createElement('input');
      inp.type = 'text'; inp.inputMode = 'decimal'; inp.value = String(Math.round(vaerdi * 100) / 100).replace('.', ',');
      inp.size = 6; inp.className = 'maalinput'; inp.setAttribute('aria-label', `Ret ${navn} i ${enhed}`);
      const gendan = () => { el.textContent = tekst; };
      inp.addEventListener('keydown', (k) => {
        k.stopPropagation();
        if (k.key === 'Escape') gendan();
        else if (k.key === 'Enter') {
          const v = Number(inp.value.replace(',', '.'));
          if (!valg.ret?.(felt, v)) { inp.classList.add('ugyldig'); inp.title = 'Ugyldig værdi'; }
        }
      });
      inp.addEventListener('blur', gendan);
      el.textContent = `${navn} = `; el.append(inp, ` ${enhed}`); inp.focus(); inp.select();
    });
  }

  function tilfoej(d: Del, g: THREE.Group, s: number) {
    if (d.type === 'boks') {
      const geo = new THREE.BoxGeometry(d.x1 - d.x0, d.z1 - d.z0, d.y1 - d.y0);
      const beton = d.rolle === 'beton';
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: beton ? FARVE.beton : FARVE.plade, transparent: beton, opacity: beton ? 0.28 : 1, roughness: 0.8, depthWrite: !beton, side: beton ? THREE.DoubleSide : THREE.FrontSide }));
      mesh.position.copy(v((d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2, (d.z0 + d.z1) / 2));
      const kant = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: beton ? 0x6b7280 : 0x2f343c }));
      kant.position.copy(mesh.position);
      g.add(mesh, kant);
      if (beton && d.afbrudt) { const e = etiket('(afbrudt)'); e.position.copy(v(d.x0, d.y0, d.z0)); g.add(e); }
    } else if (d.type === 'cyl') {
      const geo = new THREE.CylinderGeometry(d.r, d.r, d.z1 - d.z0, d.sider);
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: FARVE.staal, roughness: 0.45, metalness: 0.3 }));
      if (d.sider === 4) mesh.rotation.y = Math.PI / 4;
      mesh.position.copy(v(d.x, d.y, (d.z0 + d.z1) / 2));
      g.add(mesh);
    } else if (d.type === 'stang') {
      const a = v(...d.fra), b = v(...d.til), len = a.distanceTo(b);
      if (len > 1e-6) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(d.r, d.r, len, 10), new THREE.MeshStandardMaterial({ color: d.inaktiv ? FARVE.inaktiv : d.variant === 'forankring' ? FARVE.forankring : d.variant === 'tilbehoer' ? FARVE.tilbehoer : FARVE.arm, roughness: 0.5 }));
        m.position.copy(a.clone().add(b).multiplyScalar(0.5));
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
        g.add(m);
      }
    } else if (d.type === 'cirkel') {
      const pts = Array.from({ length: 97 }, (_, i) => v(d.x + d.radius * Math.cos((i / 96) * 2 * Math.PI), d.y + d.radius * Math.sin((i / 96) * 2 * Math.PI), d.z));
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: FARVE.zone })));
    } else if (d.type === 'kegle') {
      const geo = new THREE.ConeGeometry(d.radius, d.hoejde, 48, 1, true);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xdc2626, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }));
      m.rotation.x = Math.PI; // spids nedad
      m.position.copy(v(d.x, d.y, d.zTop - d.hoejde / 2));
      const kant = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 80), new THREE.LineBasicMaterial({ color: 0xdc2626 }));
      kant.rotation.copy(m.rotation); kant.position.copy(m.position);
      g.add(m, kant);
    } else if (d.type === 'legeme') {
      const geo = new THREE.BufferGeometry();
      const pos: number[] = [];
      for (const [a, b, c] of d.flader) for (const i of [a, b, c]) { const p = v(...d.punkter[i]!); pos.push(p.x, p.y, p.z); }
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xdc2626, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }));
      g.add(m, new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), new THREE.LineBasicMaterial({ color: 0xdc2626 })));
    } else if (d.type === 'maal') {
      const a = v(...d.fra), b = v(...d.til);
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color: FARVE.akse, depthTest: false })));
      const dir = b.clone().sub(a), len = dir.length();
      if (len > 1e-6) {
        dir.normalize();
        const perp = new THREE.Vector3().crossVectors(dir, Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(s * 0.012);
        for (const p of [a, b]) g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p.clone().sub(perp), p.clone().add(perp)]), new THREE.LineBasicMaterial({ color: FARVE.akse, depthTest: false })));
      }
      const e = etiket(d.tekst, 'etiket3d maal'); e.position.copy(a.clone().add(b).multiplyScalar(0.5)); g.add(e);
      if (d.felt && d.vaerdi != null && valg.ret) goerRedigerbar(e.element, d.tekst, d.felt, d.vaerdi);
    } else if (d.type === 'pil') {
      g.add(pil(v(...d.fra), v(...d.til), FARVE.last, s * 0.004));
      const e = etiket(d.tekst, 'etiket3d last'); e.position.copy(v(...d.til)); g.add(e);
      if (d.felt && d.vaerdi != null && valg.ret) goerRedigerbar(e.element, d.tekst, d.felt, d.vaerdi);
    } else {
      g.add(bue(v(...d.centrum), d.akse, d.radius, d.fortegn, d.vinkel, FARVE.last, s * 0.004));
      const e = etiket(d.tekst, 'etiket3d last'); e.position.copy(v(d.centrum[0], d.centrum[1], d.centrum[2] + d.radius)); g.add(e);
      if (d.felt && d.vaerdi != null && valg.ret) goerRedigerbar(e.element, d.tekst, d.felt, d.vaerdi);
    }
  }

  function akser(b: Scene3DBeskrivelse, g: THREE.Group) {
    const u = b.udstraekning, o = v(u.x0 - b.stoerrelse * 0.08, u.y0 - b.stoerrelse * 0.08, 0.5), L = b.stoerrelse * 0.12;
    for (const [dx, dy, dz, n] of [[1, 0, 0, 'x'], [0, 1, 0, 'y'], [0, 0, 1, 'z']] as const) {
      const til = o.clone().add(v(dx * L, dy * L, dz * L).sub(v(0, 0, 0)));
      g.add(pil(o, til, FARVE.akse, b.stoerrelse * 0.0025));
      const e = etiket(n, 'etiket3d akse'); e.position.copy(til); g.add(e);
    }
  }

  function opdater(b: Scene3DBeskrivelse) {
    const foerste = beskrivelse == null;
    beskrivelse = b;
    scene.remove(indhold);
    indhold.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments || o instanceof THREE.Line) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); }
      if (o instanceof CSS2DObject) o.element.remove();
    });
    indhold = new THREE.Group();
    for (const d of b.dele) tilfoej(d, indhold, b.stoerrelse);
    akser(b, indhold);
    scene.add(indhold);
    if (foerste) saetKamera('iso', false);
    tilpas(); bed();
  }

  function saetKamera(k: Kamera, _animer = true) {
    if (!beskrivelse) return;
    const u = beskrivelse.udstraekning;
    const midt = v((u.x0 + u.x1) / 2, (u.y0 + u.y1) / 2, (u.z0 + u.z1) / 2 + 0.15 * (u.z1 - u.z0));
    const r = 0.5 * Math.hypot(u.x1 - u.x0, u.y1 - u.y0, u.z1 - u.z0);
    const fov = (kamera.fov * Math.PI) / 180;
    const afstand = (r / Math.sin(Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * kamera.aspect)) / 2)) * (k === 'top' ? 0.62 : 0.78);
    const retning = { iso: [-0.62, 0.72, 0.95], top: [0, 1, 1e-4], front: [0, 0.12, 1], side: [1, 0.12, 0] }[k];
    const dir = new THREE.Vector3(...retning).normalize();
    kamera.position.copy(midt).addScaledVector(dir, afstand);
    kontrol.target.copy(midt); kontrol.update(); bed();
  }

  return {
    element, opdater, saetKamera, tegn,
    destroy() { cancelAnimationFrame(planlagt); ro?.disconnect(); kontrol.dispose(); renderer.dispose(); element.remove(); },
  };
}
