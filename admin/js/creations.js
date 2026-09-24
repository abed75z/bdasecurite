/* =========================================================
   ESPACE ADMIN BDA — outils communs aux créations
   (cartes agents et flyers) : enregistrement automatique,
   textes modifiables au clic, aperçu à l'échelle, impression.
   ========================================================= */
import { api, h, $$, erreur, attendre } from './outils.js';

// Enregistre tout seul, 0,8 s après la dernière modification
export function enregistreurAuto({ type, route, id, data, titre, ctx, indicateur }) {
  const etat = { id };
  const marquer = (txt, cls = '') => { indicateur.textContent = txt; indicateur.className = `etat-save ${cls}`; };
  let enCours = null, encore = false;
  async function enregistrer() {
    if (enCours) { encore = true; return enCours; }
    marquer('Enregistrement…', 'is-encours');
    enCours = (async () => {
      try {
        const res = await api('creation.enregistrer', { id: etat.id, type, titre: titre(), data });
        if (!etat.id) history.replaceState(null, '', `#/${route}/${res.id}`);
        etat.id = res.id;
        marquer('✓ Enregistré', 'is-ok');
      } catch (e) { marquer('Non enregistré', 'is-erreur'); erreur(e); }
    })();
    await enCours;
    enCours = null;
    if (encore) { encore = false; return enregistrer(); }
  }
  const plusTard = attendre(enregistrer, 800);
  marquer(id ? '✓ À jour' : 'Nouveau');
  return {
    etat,
    change: () => { marquer('Modifications…'); plusTard(); },
    maintenant: () => { plusTard.annuler(); return enregistrer(); },
  };
}

// Texte modifiable directement sur le visuel (sans mise en forme)
export function editable(tag, cls, obj, cle, ph, surChange) {
  const el = h(tag, { class: cls, contenteditable: 'plaintext-only', spellcheck: 'false', 'data-ph': ph || '' });
  el.textContent = obj[cle] ?? '';
  el.addEventListener('input', () => {
    obj[cle] = el.innerText.replace(/\n+$/, '');
    el.classList.toggle('est-vide', !obj[cle].trim());
    surChange();
  });
  el.classList.toggle('est-vide', !String(obj[cle] ?? '').trim());
  return el;
}

// Aperçu : le visuel (en mm) est réduit pour tenir dans la largeur disponible
export function ajusterEchelle(zone, el, max = 1.6) {
  const maj = () => {
    el.style.zoom = '';
    const dispo = zone.clientWidth - 8;
    if (dispo <= 0) return;
    const largeur = el.offsetWidth || 1;
    el.style.zoom = String(Math.min(max, dispo / largeur));
  };
  maj();
  new ResizeObserver(maj).observe(zone);
}

// Impression dédiée : seules les pages fournies sortent, au format voulu
export async function imprimerPages(pages, format, titre) {
  const style = document.getElementById('format-page');
  const avant = { style: style.textContent, titre: document.title };
  const zone = h('div', { class: 'impression' }, pages);
  document.body.append(zone);
  document.body.classList.add('impression-dediee');
  style.textContent = `@page { size: ${format}; margin: 0; }`;
  document.title = titre.replace(/[\\/:*?"<>|]/g, '-');
  const fin = () => {
    zone.remove();
    document.body.classList.remove('impression-dediee');
    style.textContent = avant.style;
    document.title = avant.titre;
  };
  try {
    await document.fonts.ready;
    await Promise.all($$('img', zone).map((i) => i.decode().catch(() => {})));
  } catch (e) { /* on imprime quand même */ }
  window.addEventListener('afterprint', fin, { once: true });
  setTimeout(() => window.print(), 60);
}
