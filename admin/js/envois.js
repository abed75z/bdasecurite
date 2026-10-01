/* =========================================================
   ESPACE ADMIN BDA — PDF clients
   Envoyer n'importe quel PDF (détail des heures, planning,
   attestation…) dans l'espace client d'un client : il le
   retrouve dans « Factures > Détails et documents ».
   ========================================================= */
import { api, apiFichier, h, icone, toast, erreur, confirmer, champ, saisie, statutPastille, dateLisible, MOIS, cap, pad } from './outils.js';

const libelleMois = (p) => (/^\d{4}-\d{2}$/.test(p || '') ? `${cap(MOIS[+p.slice(5) - 1])} ${p.slice(0, 4)}` : '—');
const taille = (o) => (o > 1048576 ? `${(o / 1048576).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(o / 1024))} Ko`);

export async function pageEnvois(ctx) {
  ctx.titre('PDF clients');
  const [{ clients }, { envois }] = await Promise.all([api('clients'), api('envois')]);

  /* ----- Formulaire d'envoi ----- */
  const auj = new Date();
  const moisPrec = new Date(auj.getFullYear(), auj.getMonth() - 1, 1);
  const selClient = h('select', { class: 'input' }, h('option', { value: '' }, clients.length ? 'Choisir le client…' : 'Aucun client enregistré'), clients.map((c) => h('option', { value: c.id }, c.nom)));
  if (clients.length === 1) selClient.value = String(clients[0].id);
  const titre = saisie({ placeholder: 'ex. Détail des heures — Septembre 2026' });
  const periode = h('input', { class: 'input', type: 'month', value: `${moisPrec.getFullYear()}-${pad(moisPrec.getMonth() + 1)}` });
  const prevenir = h('input', { type: 'checkbox', checked: true });
  let fichier = null;
  const nomFichier = h('span', { class: 'depot__nom' }, 'Aucun fichier choisi');
  const choix = h('input', { type: 'file', accept: 'application/pdf,.pdf', hidden: true, onchange: () => prendre(choix.files[0]) });
  function prendre(f) {
    if (!f) return;
    if (!/pdf$/i.test(f.type) && !/\.pdf$/i.test(f.name)) return toast('Choisissez un fichier PDF.', 'erreur');
    fichier = f;
    nomFichier.textContent = `${f.name} · ${taille(f.size)}`;
    depot.classList.add('is-plein');
    if (!titre.value.trim()) titre.value = f.name.replace(/\.pdf$/i, '');
  }
  const depot = h('button', { type: 'button', class: 'depot', onclick: () => choix.click(),
    ondragover: (e) => { e.preventDefault(); depot.classList.add('is-survol'); },
    ondragleave: () => depot.classList.remove('is-survol'),
    ondrop: (e) => { e.preventDefault(); depot.classList.remove('is-survol'); prendre(e.dataTransfer.files[0]); },
  }, icone('telecharger'), h('b', null, 'Choisir le PDF'), h('small', null, 'ou le glisser ici'), nomFichier);
  const bouton = h('button', { class: 'btn btn--gold', type: 'submit' }, icone('envoyer'), 'Envoyer dans l’espace client');
  const form = h('form', { class: 'form-grille', onsubmit: async (e) => {
    e.preventDefault();
    if (!selClient.value) return toast('Choisissez le client.', 'erreur');
    if (!fichier) return toast('Choisissez le PDF à envoyer.', 'erreur');
    const client = clients.find((c) => String(c.id) === selClient.value);
    if (!(await confirmer(`Envoyer « ${titre.value.trim() || fichier.name} » dans l’espace client de ${client.nom}${prevenir.checked ? ' (le client sera prévenu par email)' : ''} ?`, { titre: 'Envoyer le PDF', ok: 'Envoyer' }))) return;
    bouton.disabled = true;
    try {
      const fd = new FormData();
      fd.append('client_id', selClient.value);
      fd.append('titre', titre.value.trim() || fichier.name.replace(/\.pdf$/i, ''));
      fd.append('periode', periode.value || '');
      fd.append('type', 'document');
      if (prevenir.checked) fd.append('prevenir', '1');
      fd.append('fichier', fichier, fichier.name);
      const r = await apiFichier('envoi.ajouter', fd);
      toast(!r.compte ? `Enregistré, mais ${client.nom} n’a pas encore d’espace client : créez-le dans Fiches clients > Espace client.` : r.email ? 'Envoyé : le client est prévenu par email.' : 'Envoyé dans l’espace client.');
      await pageEnvois(ctx);
    } catch (err) { erreur(err); bouton.disabled = false; }
  } },
  h('div', { class: 'form-grille form-grille--2' }, champ('Client', selClient), champ('Mois concerné', periode, 'Facultatif. Sert à classer le document chez le client.')),
  champ('Titre (ce que voit le client)', titre),
  choix, depot,
  h('label', { class: 'champ champ--case' }, prevenir, h('span', null, 'Prévenir le client par email')),
  h('div', null, bouton));

  /* ----- PDF déjà envoyés ----- */
  const corps = h('tbody', null, envois.length ? envois.map((e) => h('tr', null,
    h('td', null, h('b', null, e.titre), h('small', { class: 'muet paie-poste' }, `${e.nom} · ${taille(+e.taille || 0)}`)),
    h('td', null, e.client || h('span', { class: 'muet' }, 'Client supprimé')),
    h('td', null, libelleMois(e.periode)),
    h('td', null, dateLisible(e.cree)),
    h('td', null, e.vu ? statutPastille('payee', 'Téléchargé') : statutPastille('attente', 'Pas encore ouvert')),
    h('td', { class: 'paie-action' },
      h('a', { class: 'btn btn--ghost btn--petit', href: `api.php?a=envoi.fichier&id=${e.id}`, target: '_blank', rel: 'noopener' }, icone('oeilv'), 'Voir'),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Retirer de l’espace client', title: 'Retirer de l’espace client', onclick: async () => {
        if (!(await confirmer(`Retirer « ${e.titre} » de l’espace client de ${e.client || 'ce client'} ? Il ne pourra plus le télécharger.`, { ok: 'Retirer', danger: true }))) return;
        try { await api('envoi.supprimer', { id: e.id }); toast('PDF retiré.'); await pageEnvois(ctx); } catch (err) { erreur(err); }
      } }, icone('poubelle')))))
    : h('tr', null, h('td', { colspan: 6, class: 'vide-ligne' }, 'Aucun PDF envoyé pour le moment.')));

  ctx.afficher(
    h('section', { class: 'carte' },
      h('header', { class: 'carte__tete' }, h('h2', null, 'Envoyer un PDF à un client'), h('small', null, 'Il le retrouve dans son espace client, rubrique « Factures > Détails et documents »')),
      form),
    h('section', { class: 'carte' },
      h('header', { class: 'carte__tete' }, h('h2', null, 'PDF envoyés'), h('small', null, `${envois.length} document${envois.length > 1 ? 's' : ''}`)),
      h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau' },
        h('thead', null, h('tr', null, h('th', null, 'Document'), h('th', null, 'Client'), h('th', null, 'Mois'), h('th', null, 'Envoyé le'), h('th', null, 'Suivi'), h('th'))),
        corps))));
}
