/* =========================================================
   ESPACE ADMIN BDA — Contrôle du site
   Mettre le site hors ligne (maintenance), ouvrir / fermer chaque
   service (devis, réservation VTC, candidatures, avis) et afficher
   un bandeau d'annonce en haut de toutes les pages.
   ========================================================= */
import { api, h, icone, toast, erreur, modale, champ, saisie, zoneTexte, dateLisible } from './outils.js';

const MESSAGE_DEFAUT = 'Notre site fait peau neuve et revient très vite. Nos équipes restent joignables 24 h/24.';
const PAGES_SITE = [
  ['Accueil', '/'], ['Demande de devis', '/devis'], ['Réservation VTC', '/reserver'], ['Recrutement', '/recrutement'],
  ['Avis clients', '/avis'], ['Carte digitale', '/carte'], ['Transfert aéroport', '/transfert-aeroport-paris'],
  ['Chauffeur privé VTC', '/chauffeur-prive-vtc-paris'], ['Sécurité privée', '/securite-privee-paris'], ['Mentions légales', '/mentions-legales'],
];

export async function pageSite(ctx) {
  ctx.titre('Contrôle du site');
  ctx.actions(h('a', { class: 'btn btn--ghost', href: '/', target: '_blank', rel: 'noopener' }, icone('site'), h('span', null, 'Voir le site')));
  let { site: s } = await api('site');

  const zoneEtat = h('div');
  const zoneServices = h('div');
  const zoneBandeau = h('div');

  /* ---------- 1. En ligne / hors ligne ---------- */
  function dessinerEtat() {
    const hl = s.horsLigne;
    zoneEtat.replaceChildren(h('section', { class: `etat-site ${hl ? 'etat-site--off' : ''}` },
      h('span', { class: 'etat-site__voyant', 'aria-hidden': 'true' }),
      h('div', { class: 'etat-site__txt' },
        h('span', { class: 'kicker' }, 'État du site'),
        h('h2', null, hl ? 'Votre site est hors ligne' : 'Votre site est en ligne'),
        h('p', null, hl
          ? `Depuis le ${dateLisible(hl.depuis, true)}, les visiteurs voient la page « Maintenance » avec vos numéros. Vous, connecté ici, voyez toujours le site normalement.`
          : 'bdasecurite.com est visible par tout le monde.'),
        hl ? h('a', { class: 'etat-site__lien', href: '/maintenance.php?apercu=1', target: '_blank', rel: 'noopener' }, icone('oeil'), 'Voir ce que voient les visiteurs') : null),
      hl
        ? h('button', { class: 'btn btn--gold', type: 'button', onclick: remettreEnLigne }, icone('coche'), 'Remettre le site en ligne')
        : h('button', { class: 'btn btn--danger-ghost', type: 'button', onclick: mettreHorsLigne }, icone('cadenas'), 'Mettre le site hors ligne')));
  }
  async function mettreHorsLigne() {
    const message = zoneTexte({ rows: 3, value: MESSAGE_DEFAUT, maxlength: 500 });
    const retour = saisie({ placeholder: 'ex. demain à 10 h (facultatif)', maxlength: 80 });
    const ok = await modale({
      titre: 'Mettre le site hors ligne',
      contenu: [
        h('p', { class: 'astuce' }, 'Les visiteurs verront une page « Maintenance » avec vos numéros (appel, WhatsApp, email). Vos pages, vos données et cet espace admin ne sont pas touchés : un clic suffit pour tout remettre.'),
        champ('Message affiché aux visiteurs', message),
        champ('Retour prévu', retour),
      ],
      actions: [
        { libelle: 'Annuler', classe: 'btn--ghost', valeur: false },
        { libelle: 'Mettre hors ligne', classe: 'btn--danger', submit: true, action: async () => {
          try { ({ site: s } = await api('site.horsligne', { actif: true, message: message.value.trim(), retour: retour.value.trim() })); return true; } catch (e) { erreur(e); return false; }
        } },
      ],
    });
    if (!ok) return;
    dessinerEtat();
    ctx.compteurs();
    toast('Le site est hors ligne. Vous seul le voyez encore.');
  }
  async function remettreEnLigne() {
    try { ({ site: s } = await api('site.horsligne', { actif: false })); } catch (e) { return erreur(e); }
    dessinerEtat();
    ctx.compteurs();
    toast('Le site est de nouveau en ligne pour tout le monde.');
  }

  /* ---------- 2. Services (enregistrés dès qu'on touche l'interrupteur) ---------- */
  const SERVICES = [
    ['devis', 'devis', 'Demandes de devis', 'Formulaire de la page Devis', 'Fermé : la page affiche vos numéros à la place du formulaire.'],
    ['vtc', 'voiture', 'Réservation VTC en ligne', 'Page /reserver et boutons « Réserver »', 'Fermé : les boutons sont masqués et les visiteurs voient « pas encore disponible ».'],
    ['recrutement', 'candidature', 'Candidatures', 'Formulaire de la page Recrutement', 'Fermé : la page indique que les candidatures sont fermées.'],
    ['avis', 'avis', 'Dépôt d\'avis', 'Formulaire de la page Avis', 'Fermé : les avis publiés restent visibles, on ne peut plus en déposer.'],
  ];
  function dessinerServices() {
    zoneServices.replaceChildren(h('section', { class: 'carte' },
      h('header', { class: 'carte__tete' }, h('h2', null, 'Services du site'), h('small', null, 'Ouvrez ou fermez chaque service en un clic')),
      h('ul', { class: 'services' }, SERVICES.map(([k, ic, titre, sous, aide]) => {
        const inter = h('input', { type: 'checkbox', role: 'switch', checked: !!s[k], 'aria-label': titre, onchange: async () => {
          inter.disabled = true;
          try {
            ({ site: s } = await api('site.enregistrer', { [k]: inter.checked }));
            toast(`${titre} : ${s[k] ? 'ouvert' : 'fermé'} sur le site.`);
          } catch (e) { inter.checked = !inter.checked; erreur(e); }
          inter.disabled = false;
          dessinerServices();
        } });
        return h('li', { class: `service ${s[k] ? '' : 'service--ferme'}` },
          h('span', { class: 'service__ic' }, icone(ic)),
          h('div', { class: 'service__txt' }, h('b', null, titre), h('small', null, s[k] ? sous : aide)),
          h('span', { class: `service__etat ${s[k] ? 'is-on' : ''}` }, s[k] ? 'Ouvert' : 'Fermé'),
          h('label', { class: 'interrupteur' }, inter, h('span', { 'aria-hidden': 'true' })));
      }))));
  }

  /* ---------- 3. Bandeau d'annonce ---------- */
  function dessinerBandeau() {
    const b = s.bandeau || {};
    const actif = h('input', { type: 'checkbox', role: 'switch', checked: !!b.actif, 'aria-label': 'Afficher le bandeau' });
    const texte = saisie({ value: b.texte || '', maxlength: 160, placeholder: 'ex. Fermeture exceptionnelle le 25 décembre · Joignables au 06 11 67 86 25' });
    const lien = saisie({ value: b.lien || '', maxlength: 300, placeholder: 'ex. /devis ou https://… (facultatif)' });
    const libelle = saisie({ value: b.libelleLien || '', maxlength: 40, placeholder: 'ex. Demander un devis' });
    const apercuTxt = h('span');
    const apercuLien = h('u');
    const apercu = h('div', { class: 'apercu-annonce' }, apercuTxt, apercuLien);
    const maj = () => {
      apercuTxt.textContent = texte.value.trim() || 'Votre message apparaîtra ici';
      apercuLien.textContent = lien.value.trim() ? (libelle.value.trim() || 'En savoir plus') : '';
      apercu.classList.toggle('is-off', !actif.checked);
    };
    [texte, lien, libelle].forEach((el) => el.addEventListener('input', maj));
    actif.addEventListener('change', maj);
    maj();
    const form = h('form', { class: 'form-grille', onsubmit: async (e) => {
      e.preventDefault();
      if (actif.checked && !texte.value.trim()) return toast('Écrivez le message du bandeau.', 'erreur');
      try {
        ({ site: s } = await api('site.enregistrer', { bandeau: { actif: actif.checked, texte: texte.value.trim(), lien: lien.value.trim(), libelleLien: libelle.value.trim() } }));
        toast(s.bandeau.actif ? 'Bandeau publié en haut de toutes les pages.' : 'Bandeau enregistré (masqué).');
      } catch (err) { erreur(err); }
    } },
    h('label', { class: 'ligne-inter' }, h('span', { class: 'interrupteur' }, actif, h('span', { 'aria-hidden': 'true' })), h('span', null, 'Afficher le bandeau sur le site')),
    champ('Message', texte, '160 caractères maximum. Idéal pour une fermeture, une promo ou une info importante.'),
    h('div', { class: 'form-grille form-grille--2' }, champ('Lien (facultatif)', lien), champ('Texte du lien', libelle)),
    h('div', null, h('span', { class: 'astuce' }, 'Aperçu'), apercu),
    h('div', null, h('button', { class: 'btn btn--gold', type: 'submit' }, icone('coche'), 'Enregistrer le bandeau')));
    zoneBandeau.replaceChildren(h('section', { class: 'carte' },
      h('header', { class: 'carte__tete' }, h('h2', null, 'Bandeau d\'annonce'), h('small', null, 'Un message en haut de toutes les pages')), form));
  }

  /* ---------- 4. Raccourcis vers les pages ---------- */
  const raccourcis = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Pages du site'), h('small', null, 'Ouvrir une page dans un nouvel onglet')),
    h('div', { class: 'pages-site' }, PAGES_SITE.map(([nom, url]) => h('a', { href: url, target: '_blank', rel: 'noopener' }, icone('site'), h('span', null, nom), icone('suivant')))),
    h('p', { class: 'astuce' }, 'Les changements faits ici s\'appliquent tout de suite, sans toucher au code du site.'));

  dessinerEtat();
  dessinerServices();
  dessinerBandeau();
  ctx.afficher(zoneEtat, h('div', { class: 'grille-2' }, zoneServices, zoneBandeau), raccourcis);
}
