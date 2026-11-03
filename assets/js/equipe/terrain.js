/* =========================================================
   ESPACE ÉQUIPE — Consignes des sites et matériel (module « terrain », version 13)
   - Consignes : celles des sites où l'agent a un poste à venir ; il confirme
     « J'ai lu et compris » (version, date et heure gardées par la direction).
     Avec les numéros d'urgence et les documents du site (plans, procédures).
   - Mon matériel : ce que l'agent a reçu (talkie, badge, tenue…) et doit rendre.
   ========================================================= */
export const ICONES = {
  classeur: '<path d="M6 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M8 7h6M8 11h6M8 15h3"/>',
  sac: '<path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
};

const API = '/api/equipe.php';
const confirmerNatif = (txt) => window.confirm(txt); // même fonctionnement que le reste de l'espace équipe
const TYPES = { talkie: 'Talkie', badge: 'Badge', tenue: 'Tenue', cle: 'Clé', lampe: 'Lampe', autre: 'Autre' };
const ETATS = { neuf: 'Neuf', bon: 'Bon état', use: 'Usé', abime: 'Abîmé', hs: 'Hors service', perdu: 'Perdu' };
const fr = (s) => (/^\d{4}-\d{2}-\d{2}/.test(s || '') ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
const heure = (s) => (s && s.length >= 16 ? s.slice(11, 16).replace(':', ' h ') : '');

// Rendu simple : « # Titre », « - point », « 1. étape », **gras**
function texteConsignes(h, t) {
  const blocs = [];
  let liste = null;
  const enGras = (s) => s.split(/\*\*(.+?)\*\*/g).map((x, i) => (i % 2 ? h('b', null, x) : x));
  const point = (tag, txt) => { if (liste?.tagName !== tag.toUpperCase()) { liste = h(tag); blocs.push(liste); } liste.append(h('li', null, enGras(txt))); };
  String(t || '').split('\n').forEach((l) => {
    const s = l.trim();
    if (/^#+\s/.test(s)) { liste = null; blocs.push(h('h3', null, s.replace(/^#+\s*/, ''))); }
    else if (/^[-*•]\s/.test(s)) point('ul', s.replace(/^[-*•]\s*/, ''));
    else if (/^\d+[.)]\s/.test(s)) point('ol', s.replace(/^\d+[.)]\s*/, ''));
    else if (s) { liste = null; blocs.push(h('p', null, enGras(s))); }
    else liste = null;
  });
  return h('div', { class: 'eqt-texte' }, blocs);
}

function carteSite(o, s) {
  const { h, api, toast, ic, dateLongue, recharger } = o;
  const aLire = s.consigne && !s.lu;
  const bouton = aLire ? h('button', { class: 'eq-btn eq-btn--plein', type: 'button', onclick: async (e) => {
    if (!confirmerNatif(`Vous confirmez avoir lu et compris les consignes de ${s.nom} (version ${s.consigne.version}) ?`)) return;
    e.currentTarget.disabled = true;
    try { await api('mod.terrain.lu', { id: s.consigne.id }); toast('Merci : votre lecture est enregistrée.'); recharger(); } catch (err) { toast(err.message, true); recharger(); }
  } }, ic('coche'), 'J’ai lu et compris') : null;
  const prochain = s.prochain ? `Prochain poste : ${dateLongue(s.prochain.jour)}, ${s.prochain.debut} - ${s.prochain.fin}` : '';
  return h('section', { class: `eq-carte eqt-site ${aLire ? 'is-a-lire' : ''}` },
    h('div', { class: 'eq-carte__tete' }, h('h2', null, s.nom),
      s.consigne ? h('span', { class: `eq-pastille eq-pastille--${aLire ? (s.versionLue ? 'nouveau' : 'attente') : 'ok'}` }, aLire ? (s.versionLue ? 'Nouvelle version' : 'À lire') : 'Lu') : null),
    h('p', { class: 'eqt-meta' }, prochain),
    s.adresse ? h('p', { class: 'eqt-meta' }, ic('pin'), h('a', { href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.adresse)}`, target: '_blank', rel: 'noopener' }, s.adresse)) : null,
    s.consigne ? [
      s.consigne.resume && s.versionLue ? h('p', { class: 'eqt-change' }, ic('info'), `Ce qui change : ${s.consigne.resume}`) : null,
      texteConsignes(h, s.consigne.texte),
      s.lu ? h('p', { class: 'eqt-lu' }, ic('coche'), `Lu et compris le ${fr(s.lu)} à ${heure(s.lu)} (version ${s.consigne.version})`) : bouton,
    ] : s.texteFiche ? texteConsignes(h, s.texteFiche) : h('p', { class: 'eqt-meta' }, 'Pas encore de consignes écrites pour ce site : demandez-les à la direction.'),
    s.urgences?.length ? h('div', { class: 'eqt-bloc' }, h('h3', null, 'Numéros d’urgence'),
      h('ul', { class: 'eqt-urgences' }, s.urgences.map((u) => h('li', null,
        h('span', null, h('b', null, u.libelle || 'Contact'), u.note ? h('small', null, u.note) : null),
        u.numero ? h('a', { class: 'eq-btn eq-btn--ghost eq-btn--petit', href: `tel:${u.numero.replace(/[^\d+]/g, '')}` }, ic('telephone'), u.numero) : null)))) : null,
    s.contact ? h('p', { class: 'eqt-meta' }, ic('bulle'), `Contact sur place : ${s.contact}`) : null,
    s.documents?.length ? h('div', { class: 'eqt-bloc' }, h('h3', null, 'Documents du site'),
      h('ul', { class: 'eqt-docs' }, s.documents.map((d) => h('li', null, h('a', { href: `${API}?${new URLSearchParams({ a: 'mod.terrain.document', id: d.id })}`, target: '_blank', rel: 'noopener' },
        ic(d.mime === 'application/pdf' ? 'documents' : 'photo'), h('span', null, d.titre), ic('fleche')))))) : null);
}

async function renduConsignes(o) {
  const { h, api, enTete, vide } = o;
  const d = await api('mod.terrain.consignes');
  return h('div', { class: 'eqt' },
    enTete('Mes sites', 'Consignes', d.nonLus ? `${d.nonLus} site${d.nonLus > 1 ? 's' : ''} à lire avant votre prochain poste.` : 'Les consignes des sites où vous travaillez bientôt.'),
    d.sites.length ? d.sites.map((s) => carteSite(o, s)) : vide('classeur', 'Aucun poste à venir', 'Les consignes s’affichent ici dès que vous êtes prévu sur un site.'));
}

async function renduMateriel(o) {
  const { h, api, enTete, vide, ic } = o;
  const d = await api('mod.terrain.materiel');
  return h('div', { class: 'eqt' },
    enTete('Mon équipement', 'Mon matériel', 'Ce que l’entreprise vous a confié. À rendre en fin de mission ou de contrat.'),
    d.materiel.length ? h('section', { class: 'eq-carte' }, h('ul', { class: 'eqt-materiel' }, d.materiel.map((m) => h('li', null,
      ic(m.type === 'tenue' ? 'profil' : m.type === 'talkie' ? 'telephone' : m.type === 'badge' ? 'carte' : 'outil'),
      h('span', null, h('b', null, m.libelle), h('small', null, [TYPES[m.type], m.numero ? `n° ${m.numero}` : '', m.taille ? `taille ${m.taille}` : '', m.remis_le ? `reçu le ${fr(m.remis_le)}` : ''].filter(Boolean).join(' · '))),
      h('span', { class: 'eq-pastille eq-pastille--neutre' }, ETATS[m.etat] || m.etat)))),
    h('p', { class: 'eqt-meta' }, 'Un objet perdu ou abîmé ? Prévenez la direction tout de suite.'))
      : vide('sac', 'Aucun matériel', 'Rien ne vous a été confié pour le moment.'));
}

export const PAGES = {
  consignes: { titre: 'Consignes', icone: 'classeur', rendu: renduConsignes },
  materiel: { titre: 'Mon matériel', icone: 'sac', rendu: renduMateriel },
};

// Carte d'accueil : seulement s'il y a des consignes à lire
export const CARTES = [async (o) => {
  const { h, api, ic } = o;
  const d = await api('mod.terrain.consignes', undefined, { resume: 1 });
  if (!d.nonLus) return null;
  const noms = d.sites.map((s) => s.nom).slice(0, 2).join(', ');
  return h('a', { class: 'eq-carte eqt-alerte', href: '#/consignes' },
    h('span', { class: 'eqt-alerte__ic' }, ic('classeur')),
    h('span', null, h('b', null, `Consignes à lire : ${d.nonLus} site${d.nonLus > 1 ? 's' : ''}`), h('small', null, `${noms}${d.sites.length > 2 ? '…' : ''} · à lire avant votre poste`)),
    ic('fleche'));
}];
