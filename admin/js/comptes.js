/* =========================================================
   ESPACE ADMIN BDA — Comptes & accès
   Qui peut ouvrir BDA Admin : le gérant, la famille, un manager.
   Créer un accès, changer son rôle, réinitialiser son mot de passe,
   le retirer. Réservé aux administrateurs (le serveur le vérifie aussi).
   ========================================================= */
import { api, h, icone, toast, erreur, modale, confirmer, champ, saisie, ilYa, cap } from './outils.js';

const ROLES = {
  admin: { nom: 'Administrateur', texte: 'Accès complet : réglages, comptes, IBAN, mise hors ligne du site.' },
  manager: { nom: 'Manager', texte: 'Le quotidien : demandes, devis, factures, agents, planning. Pas les réglages sensibles.' },
};
const TEINTES = ['#6366f1', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0d9488'];
const teinte = (s) => { let n = 0; for (const c of String(s)) n = (n * 31 + c.charCodeAt(0)) >>> 0; return TEINTES[n % TEINTES.length]; };
const initiales = (s) => String(s || '?').trim().split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join('').toUpperCase() || '?';

// Mot de passe provisoire lisible (sans 0/O, 1/l), 14 caractères
function motDePasseProvisoire() {
  const lettres = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const tirage = crypto.getRandomValues(new Uint32Array(12));
  const corps = [...tirage].map((n) => lettres[n % lettres.length]).join('');
  return `${corps.slice(0, 4)}-${corps.slice(4, 8)}-${corps.slice(8, 12)}`;
}
function champMotDePasse() {
  const input = saisie({ type: 'text', minlength: 10, required: true, autocomplete: 'new-password', spellcheck: 'false', value: motDePasseProvisoire(), class: 'input mono' });
  const regenerer = h('button', { type: 'button', class: 'btn btn--ghost btn--petit', onclick: () => { input.value = motDePasseProvisoire(); input.focus(); } }, icone('eclair'), 'Autre');
  const copier = h('button', { type: 'button', class: 'btn btn--ghost btn--petit', onclick: async () => { try { await navigator.clipboard.writeText(input.value); toast('Mot de passe copié.'); } catch (e) { input.select(); } } }, icone('copier'), 'Copier');
  return { input, bloc: h('div', { class: 'cpt-mdp' }, input, regenerer, copier) };
}

export async function pageComptes(ctx) {
  ctx.titre('Comptes & accès');
  const { utilisateurs } = await api('utilisateurs');
  if (!ctx.actuel()) return;
  const moi = String((await api('session')).utilisateur || '');
  ctx.actions(h('button', { class: 'btn btn--gold', type: 'button', onclick: () => creer(ctx) }, icone('plus'), h('span', null, 'Nouvel accès')));

  const admins = utilisateurs.filter((u) => u.role === 'admin').length;
  const carte = (u, i) => {
    const nom = u.nom || cap(u.login);
    const estMoi = u.login === moi;
    const role = ROLES[u.role] || ROLES.manager;
    const choixRole = h('select', { class: 'input input--mini', 'aria-label': `Rôle de ${nom}`, disabled: u.gerant || null, onchange: async (e) => {
      try { await api('utilisateur.modifier', { id: u.id, role: e.target.value }); toast(`${nom} est maintenant ${ROLES[e.target.value].nom.toLowerCase()}.`); pageComptes(ctx); } catch (err) { erreur(err); e.target.value = u.role; }
    } }, Object.entries(ROLES).map(([k, r]) => h('option', { value: k, selected: k === u.role }, r.nom)));
    return h('article', { class: 'cpt-carte', style: `--ag: ${teinte(u.login)}; animation-delay: ${0.05 * i}s` },
      h('div', { class: 'cpt-carte__tete' },
        h('span', { class: 'ag-avatar ag-avatar--grand', 'aria-hidden': 'true' }, initiales(nom)),
        h('div', { class: 'cpt-carte__qui' },
          h('b', null, nom, estMoi ? h('em', { class: 'cpt-badge cpt-badge--moi' }, 'vous') : null, u.gerant ? h('em', { class: 'cpt-badge' }, icone('couronne'), 'Propriétaire') : null),
          h('small', null, `Identifiant : ${u.login}`))),
      h('div', { class: `cpt-role cpt-role--${u.role}` }, h('span', null, icone(u.role === 'admin' ? 'bouclier' : 'personne'), role.nom), h('small', null, role.texte)),
      h('p', { class: 'cpt-carte__vu' }, h('i', { class: u.derniere ? 'is-vu' : '' }), u.derniere ? `Dernière activité ${ilYa(u.derniere)}` : 'Jamais connecté pour le moment'),
      h('div', { class: 'cpt-carte__pied' },
        choixRole,
        u.gerant || estMoi ? h('span', { class: 'cpt-carte__note' }, u.gerant ? 'Compte du propriétaire' : 'Votre compte : mot de passe dans Paramètres') : [
          h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: () => reinitialiser(u, nom) }, icone('cle'), 'Nouveau mot de passe'),
          h('button', { class: 'icon-btn', type: 'button', title: `Retirer l’accès de ${nom}`, 'aria-label': `Retirer l’accès de ${nom}`, onclick: () => retirer(ctx, u, nom) }, icone('poubelle')),
        ]));
  };

  ctx.afficher(
    h('div', { class: 'ag-kpis cpt-kpis' },
      h('div', { class: 'ag-kpi' }, h('span', { class: 'ag-kpi__libelle' }, 'Accès'), h('b', { class: 'metrique__valeur' }, String(utilisateurs.length)), h('small', null, 'personnes peuvent ouvrir BDA Admin')),
      h('div', { class: 'ag-kpi' }, h('span', { class: 'ag-kpi__libelle' }, 'Administrateurs'), h('b', { class: 'metrique__valeur' }, String(admins)), h('small', null, 'accès complet')),
      h('div', { class: 'ag-kpi' }, h('span', { class: 'ag-kpi__libelle' }, 'Managers'), h('b', { class: 'metrique__valeur' }, String(utilisateurs.length - admins)), h('small', null, 'le quotidien, sans les réglages sensibles'))),
    h('div', { class: 'cpt-grille' }, utilisateurs.map(carte)),
    h('p', { class: 'encart' }, h('b', null, 'Bon à savoir : '), 'chacun a son propre identifiant et son mot de passe. Ne partagez jamais le vôtre. Un mot de passe provisoire se change dès la première connexion, dans Compte › Paramètres. Toutes les connexions sont notées dans le journal.'));
}

async function creer(ctx) {
  const nom = saisie({ placeholder: 'ex. Abdelouahab BOUIDIA', autocomplete: 'off' });
  const login = saisie({ required: true, placeholder: 'ex. abdel', autocomplete: 'off', spellcheck: 'false' });
  const role = h('select', { class: 'input' }, Object.entries(ROLES).map(([k, r]) => h('option', { value: k, selected: k === 'manager' }, `${r.nom} — ${r.texte}`)));
  const mdp = champMotDePasse();
  nom.addEventListener('input', () => { if (!login.dataset.touche) login.value = nom.value.trim().split(/\s+/)[0]?.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '') || ''; });
  login.addEventListener('input', () => { login.dataset.touche = '1'; });
  const ok = await modale({
    titre: 'Nouvel accès à BDA Admin',
    contenu: h('div', { class: 'form-grille' },
      champ('Nom affiché', nom),
      champ('Identifiant de connexion', login, '3 caractères minimum : lettres, chiffres, point ou tiret.'),
      champ('Rôle', role),
      champ('Mot de passe provisoire', mdp.bloc, 'Notez-le ou copiez-le pour le donner à la personne : il ne sera plus affiché ensuite.')),
    actions: [{ libelle: 'Annuler', classe: 'btn--ghost', valeur: false }, { libelle: 'Créer l’accès', classe: 'btn--gold', submit: true, action: async () => {
      if (!login.value.trim()) { login.focus(); return false; }
      try { await api('utilisateur.creer', { login: login.value.trim(), nom: nom.value.trim(), role: role.value, motdepasse: mdp.input.value }); return true; } catch (e) { erreur(e); return false; }
    } }],
  });
  if (ok) { toast('Accès créé. Donnez l’identifiant et le mot de passe provisoire à la personne.'); pageComptes(ctx); }
}

async function reinitialiser(u, nom) {
  const mdp = champMotDePasse();
  const ok = await modale({
    titre: `Nouveau mot de passe pour ${nom}`,
    contenu: h('div', { class: 'form-grille' }, h('p', { class: 'modale__texte' }, 'Ses appareils seront déconnectés. Donnez-lui ce mot de passe provisoire : il le changera en se reconnectant.'), champ('Mot de passe provisoire', mdp.bloc)),
    actions: [{ libelle: 'Annuler', classe: 'btn--ghost', valeur: false }, { libelle: 'Enregistrer', classe: 'btn--gold', submit: true, action: async () => {
      try { await api('utilisateur.modifier', { id: u.id, motdepasse: mdp.input.value }); return true; } catch (e) { erreur(e); return false; }
    } }],
  });
  if (ok) toast(`Mot de passe de ${nom} remplacé.`);
}

async function retirer(ctx, u, nom) {
  if (!(await confirmer(`Retirer l’accès de ${nom} ? Il ne pourra plus ouvrir BDA Admin. Ses actions passées restent dans le journal.`, { titre: 'Retirer un accès', ok: 'Retirer l’accès', danger: true }))) return;
  try { await api('utilisateur.supprimer', { id: u.id }); toast(`Accès de ${nom} retiré.`); pageComptes(ctx); } catch (e) { erreur(e); }
}
