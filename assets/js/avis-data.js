/* =========================================================
   AVIS CLIENTS — accès aux données (espace admin du site, /api/avis.php)
   + mémoire locale pour un affichage instantané
   ========================================================= */

/* ====== CONFIGURATION =======================================
   endpoint : adresse des avis publiés (validés dans bdasecurite.com/admin).
   Vide = avis envoyés par email uniquement, sans affichage sur le site.
   ============================================================ */
const AVIS_CONFIG = {
  endpoint: '/api/avis.php',
  emailFallback: 'https://formsubmit.co/ajax/bdasecurite@gmail.com',
  parPage: 6,
};

const AvisData = (() => {
  const CLE = 'bda-avis-cache';
  const valide = (a) => a && a.nom && a.texte && a.note >= 1 && a.note <= 5;
  let enCours = null;

  // Derniers avis connus (affichage immédiat, même si le serveur met du temps à répondre)
  function memoire() {
    try {
      const c = JSON.parse(localStorage.getItem(CLE) || 'null');
      return c && Array.isArray(c.avis) ? c.avis : null;
    } catch (_) { return null; }
  }

  // Avis à jour depuis le serveur (une seule requête à la fois)
  function frais() {
    if (!AVIS_CONFIG.endpoint) return Promise.resolve([]);
    if (!enCours) {
      enCours = fetch(AVIS_CONFIG.endpoint)
        .then((r) => r.json())
        .then((json) => {
          const avis = (json.avis || []).filter(valide);
          try { localStorage.setItem(CLE, JSON.stringify({ t: Date.now(), avis })); } catch (_) { /* stockage indisponible */ }
          return avis;
        })
        .finally(() => { enCours = null; });
    }
    return enCours;
  }

  const moyenne = (avis) => (avis.length ? avis.reduce((s, a) => s + a.note, 0) / avis.length : 0);
  return { memoire, frais, moyenne };
})();
