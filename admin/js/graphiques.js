/* =========================================================
   ESPACE ADMIN BDA — chiffres clés et graphiques
   Dessinés en HTML et SVG, sans bibliothèque : sobres, lisibles,
   utilisables au clavier (chaque barre ou point donne sa valeur).
   ========================================================= */
import { h } from './outils.js';

/* ---------- Bandeau de chiffres clés ----------
   [{ libelle, valeur, sous, ton: 'alerte' | 'ok', href }] */
export function metriques(liste) {
  return h('div', { class: 'metriques' }, liste.filter(Boolean).map((m) => h(m.href ? 'a' : 'div', { class: `metrique ${m.ton ? `metrique--${m.ton}` : ''}`, href: m.href },
    h('span', { class: 'metrique__libelle' }, m.libelle),
    h('b', { class: 'metrique__valeur' }, m.valeur),
    m.sous ? h('span', { class: 'metrique__sous' }, m.sous) : null)));
}

/* ---------- Choix segmenté (période, série…) ---------- */
export function segments(options, actif, surChoix, libelle = 'Choix') {
  const zone = h('div', { class: 'segments', role: 'group', 'aria-label': libelle });
  const dessiner = (courant) => zone.replaceChildren(...options.map(([cle, texte]) => h('button', {
    type: 'button', class: `segments__btn ${cle === courant ? 'is-actif' : ''}`, 'aria-pressed': String(cle === courant),
    onclick: () => { if (cle === courant) return; dessiner(cle); surChoix(cle); },
  }, texte)));
  dessiner(actif);
  return zone;
}

/* ---------- Graduation « ronde » de l'axe vertical ---------- */
function graduation(max, entier) {
  if (max <= 0) return { haut: entier ? 4 : 1, pas: entier ? 1 : 0.25 };
  const brut = max / 4;
  const ordre = 10 ** Math.floor(Math.log10(brut));
  const n = brut / ordre;
  let pas = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * ordre;
  if (entier) pas = Math.max(1, Math.round(pas));
  return { haut: Math.ceil(max / pas) * pas, pas };
}
const grille = (g, format) => {
  const lignes = [];
  for (let v = 0; v <= g.haut + 1e-9; v += g.pas) lignes.push(h('span', { style: { bottom: `${(v / g.haut) * 100}%` } }, h('em', null, format(v))));
  return h('div', { class: 'gr-grille', 'aria-hidden': 'true' }, lignes);
};
const axeX = (points) => {
  const pas = Math.max(1, Math.ceil(points.length / 8));
  return h('div', { class: 'gr-axe-x', 'aria-hidden': 'true' }, points.map((p, i) => h('span', null, i % pas === 0 || points.length <= 12 ? (p.court ?? p.libelle) : '')));
};
// Petite bulle qui donne la valeur du point survolé
function bulle(zone) {
  const b = h('div', { class: 'gr-bulle', hidden: true }, h('small'), h('b'));
  zone.append(b);
  return {
    montrer(x, y, titre, valeur) {
      b.firstChild.textContent = titre;
      b.lastChild.textContent = valeur;
      b.hidden = false;
      const max = zone.clientWidth - b.offsetWidth / 2 - 2;
      b.style.left = `${Math.max(b.offsetWidth / 2 + 2, Math.min(max, x))}px`;
      b.style.top = `${y}px`;
    },
    cacher() { b.hidden = true; },
  };
}

/* ---------- Barres verticales ----------
   points : [{ libelle, court, valeur }] */
export function barres(points, { format = (v) => String(v), entier = true, hauteur = 190, titre = 'Graphique' } = {}) {
  const max = Math.max(0, ...points.map((p) => p.valeur));
  const g = graduation(max, entier);
  const zone = h('div', { class: 'gr-zone', style: { height: `${hauteur}px` } });
  const b = bulle(zone);
  const cols = h('div', { class: 'gr-cols' }, points.map((p) => {
    const col = h('div', { class: 'gr-col', tabindex: '0', role: 'img', 'aria-label': `${p.libelle} : ${format(p.valeur)}` },
      h('i', { style: { height: `${(p.valeur / g.haut) * 100}%` }, class: p.valeur ? '' : 'is-zero' }));
    const montrer = () => {
      const barre = col.firstChild;
      b.montrer(col.offsetLeft + col.offsetWidth / 2, Math.min(barre.offsetTop, zone.clientHeight - 30) - 8, p.libelle, format(p.valeur));
    };
    col.addEventListener('mouseenter', montrer);
    col.addEventListener('focus', montrer);
    col.addEventListener('mouseleave', () => b.cacher());
    col.addEventListener('blur', () => b.cacher());
    return col;
  }));
  zone.prepend(grille(g, format), cols);
  return h('figure', { class: 'gr gr--barres', 'aria-label': titre }, zone, axeX(points));
}

/* ---------- Courbe avec aire ----------
   points : [{ libelle, court, valeur }] */
export function courbe(points, { format = (v) => String(v), entier = false, hauteur = 190, titre = 'Graphique' } = {}) {
  const max = Math.max(0, ...points.map((p) => p.valeur));
  const g = graduation(max, entier);
  const L = 1000, H = 100;
  const n = points.length;
  const x = (i) => (n === 1 ? L / 2 : (i / (n - 1)) * L);
  const y = (v) => H - (v / g.haut) * H;
  const ligne = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.valeur).toFixed(2)}`).join(' ');
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${L} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'gr-svg');
  svg.setAttribute('aria-hidden', 'true');
  const aire = document.createElementNS(ns, 'path');
  aire.setAttribute('d', `${ligne} L${x(n - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`);
  aire.setAttribute('class', 'gr-aire');
  const trait = document.createElementNS(ns, 'path');
  trait.setAttribute('d', ligne);
  trait.setAttribute('class', 'gr-trait');
  trait.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.append(aire, trait);

  const zone = h('div', { class: 'gr-zone', style: { height: `${hauteur}px` } });
  const repere = h('div', { class: 'gr-repere', hidden: true }, h('i'));
  const b = bulle(zone);
  const trace = h('div', { class: 'gr-trace' }, svg, repere);
  const cibles = h('div', { class: 'gr-cibles' }, points.map((p, i) => {
    const c = h('div', { class: 'gr-cible', tabindex: '0', role: 'img', 'aria-label': `${p.libelle} : ${format(p.valeur)}` });
    const montrer = () => {
      const px = (n === 1 ? 0.5 : i / (n - 1)) * trace.clientWidth;
      const py = (y(p.valeur) / H) * trace.clientHeight;
      repere.hidden = false;
      repere.style.left = `${px}px`;
      repere.firstChild.style.top = `${py}px`;
      b.montrer(trace.offsetLeft + px, Math.min(py, zone.clientHeight - 30) - 10, p.libelle, format(p.valeur));
    };
    c.addEventListener('mouseenter', montrer);
    c.addEventListener('focus', montrer);
    c.addEventListener('mouseleave', () => { b.cacher(); repere.hidden = true; });
    c.addEventListener('blur', () => { b.cacher(); repere.hidden = true; });
    return c;
  }));
  trace.append(cibles);
  zone.prepend(grille(g, format), trace);
  return h('figure', { class: 'gr gr--courbe', 'aria-label': titre }, zone, axeX(points));
}

/* ---------- Répartition en barres horizontales ----------
   lignes : [{ libelle, valeur, sous }] */
export function repartition(lignes, { format = (v) => String(v), vide = 'Aucune donnée sur la période.' } = {}) {
  const max = Math.max(0, ...lignes.map((l) => l.valeur));
  if (!lignes.length || !max) return h('p', { class: 'gr-vide' }, vide);
  return h('ul', { class: 'gr-repartition' }, lignes.map((l) => h('li', null,
    h('span', { class: 'gr-repartition__nom' }, l.libelle, l.sous ? h('small', null, l.sous) : null),
    h('span', { class: 'gr-repartition__piste', 'aria-hidden': 'true' }, h('i', { style: { width: `${(l.valeur / max) * 100}%` } })),
    h('b', { class: 'gr-repartition__val' }, format(l.valeur)))));
}
