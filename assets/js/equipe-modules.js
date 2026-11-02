/* =========================================================
   ESPACE ÉQUIPE — modules
   Chaque module dépose son interface dans assets/js/equipe/<nom>.js et exporte :
     PAGES  = { route: { titre, icone, rendu: async (outils) => élément, badge?, chauffeur?, plus? } }
     CARTES = [async (outils) => élément | null]   (cartes ajoutées à l'accueil)
     ICONES = { nom: '<path …/>' }                  (icônes 24×24 en traits)
   La liste des modules vient du serveur ; tout est versionné avec le ?v= du HTML.
   ========================================================= */
const V = new URL(import.meta.url).searchParams.get('v') || '1';
const noms = await fetch('/api/equipe.php?a=modules.ui', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
  .then((r) => r.json()).then((j) => (Array.isArray(j.noms) ? j.noms : [])).catch(() => []);
const mods = await Promise.all(noms.map((n) => import(`./equipe/${n}.js?v=${V}`).catch((e) => { console.error(`Module ${n}`, e); return {}; })));
export const PAGES = Object.assign({}, ...mods.map((m) => m.PAGES || {}));
export const CARTES = mods.flatMap((m) => m.CARTES || []);
export const ICONES = Object.assign({}, ...mods.map((m) => m.ICONES || {}));
