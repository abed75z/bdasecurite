/* =========================================================
   ESPACE ÉQUIPE — modules
   Chaque module dépose son interface dans assets/js/equipe/<nom>.js et exporte :
     PAGES  = { route: { titre, icone, rendu: async (outils) => élément, badge?, chauffeur?, plus? } }
     CARTES = [async (outils) => élément | null]   (cartes ajoutées à l'accueil)
     ICONES = { nom: '<path …/>' }                  (icônes 24×24 en traits)
   La liste des modules vient du serveur ; tout est versionné avec le ?v= du HTML.
   ========================================================= */
const V = new URL(import.meta.url).searchParams.get('v') || '1';
const liste = await fetch('/api/equipe.php?a=modules.ui', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
  .then((r) => r.json()).catch(() => ({}));
const noms = Array.isArray(liste.noms) ? liste.noms : [];
// feuilles de style des modules : assets/css/equipe/<nom>.css
for (const n of Array.isArray(liste.css) ? liste.css : []) {
  document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: `/assets/css/equipe/${n}.css?v=${V}` }));
}
const mods = await Promise.all(noms.map((n) => import(`./equipe/${n}.js?v=${V}`).catch((e) => { console.error(`Module ${n}`, e); return {}; })));
export const PAGES = Object.assign({}, ...mods.map((m) => m.PAGES || {}));
export const CARTES = mods.flatMap((m) => m.CARTES || []);
export const ICONES = Object.assign({}, ...mods.map((m) => m.ICONES || {}));
