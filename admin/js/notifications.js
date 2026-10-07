/* =========================================================
   ESPACE ADMIN BDA — Notifications
   Tout ce qui arrive (demandes, messages, avis, VTC, espace équipe,
   main courante, pointages, veille, sécurité) part en notification sur
   les appareils abonnés. Aucune donnée personnelle dans la notification :
   on la touche pour ouvrir le détail dans l'admin.
   ========================================================= */
import { api, h, icone, toast, erreur, modale, confirmer, ilYa } from './outils.js';

const ICONES = {
  demandes: 'demande', messages: 'mail', assistance: 'activite', espace_client: 'clients', avis: 'avis', vtc: 'voiture',
  candidatures: 'candidature', equipe: 'agents', absences: 'planning', incidents: 'alerte', pointages: 'horloge',
  veille: 'eclair', rappels: 'epingle', securite: 'bouclier',
};

/* ---------- Abonnement de cet appareil (Web Push) ---------- */
export const pushPossible = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const estIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const estInstallee = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function cleVapid(b64) {
  const p = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
const enregistrementSw = () => navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' });
export async function abonnementActuel() {
  if (!pushPossible()) return null;
  try { return await (await enregistrementSw()).pushManager.getSubscription(); } catch (e) { return null; }
}
async function activer(vapid) {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications refusées : autorisez-les dans les réglages du navigateur (ou du téléphone).');
  if (!vapid) throw new Error('Clés de notification absentes : rechargez la page.');
  const reg = await enregistrementSw();
  const abo = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cleVapid(vapid) });
  await api('push.abonner', abo.toJSON());
}
async function desactiver(abo) {
  await api('push.desabonner', { endpoint: abo.endpoint });
  await abo.unsubscribe();
}
function aideInstallation() {
  return modale({
    titre: 'Activer les notifications',
    contenu: h('div', { class: 'form-grille' }, estIos() && !estInstallee()
      ? [h('p', null, "Sur iPhone, les notifications ne marchent qu'avec l'admin installé sur l'écran d'accueil :"),
        h('ol', { class: 'op-etapes' },
          h('li', null, 'Dans Safari, appuyez sur le bouton Partager (carré avec une flèche).'),
          h('li', null, "Choisissez « Sur l'écran d'accueil », puis « Ajouter »."),
          h('li', null, "Ouvrez « BDA Admin » depuis la nouvelle icône, allez dans Notifications et appuyez sur « Activer sur cet appareil »."))]
      : h('p', null, 'Ce navigateur ne gère pas les notifications. Utilisez Chrome, Edge, Firefox ou Safari (iPhone : après ajout à l’écran d’accueil).')),
    actions: [{ libelle: 'Compris', classe: 'btn--gold', valeur: true, submit: true }],
  });
}

/* ---------- Page ---------- */
export async function pageNotifications(ctx) {
  ctx.titre('Notifications');
  const [d, abo, dc] = await Promise.all([api('notif.prefs'), abonnementActuel(), api('discord').then((r) => r.discord).catch(() => null)]);
  if (!ctx.actuel()) return;
  const recharger = () => pageNotifications(ctx);
  const actif = !!abo;

  ctx.actions(h('button', { class: 'btn btn--ghost', type: 'button', onclick: async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    try { const r = await api('notif.tester', {}); toast(`Notification de test envoyée à ${r.appareils} appareil(s).`); } catch (err) { erreur(err); } finally { b.disabled = false; }
  } }, icone('envoyer'), h('span', null, 'Envoyer un test')));

  /* 1. Cet appareil */
  const bouton = h('button', { class: `btn ${actif ? 'btn--ghost' : 'btn--gold'}`, type: 'button', onclick: async () => {
    if (!pushPossible()) return aideInstallation();
    bouton.disabled = true;
    try {
      if (actif) {
        if (!(await confirmer('Ne plus recevoir les notifications sur cet appareil ?', { ok: 'Désactiver', danger: true }))) return;
        await desactiver(abo);
        toast('Notifications désactivées sur cet appareil.');
      } else {
        await activer(d.vapid);
        toast('Notifications activées sur cet appareil.');
      }
      recharger();
    } catch (err) { erreur(err); } finally { bouton.disabled = false; }
  } }, icone(actif ? 'croix' : 'mobile'), h('span', null, actif ? 'Désactiver sur cet appareil' : 'Activer sur cet appareil'));
  const appareil = h('section', { class: 'carte notif-tete' },
    h('div', { class: 'notif-tete__etat' },
      h('span', { class: `notif-pastille ${actif ? 'is-on' : ''}` }, icone(actif ? 'coche' : 'mobile')),
      h('div', null,
        h('h2', null, actif ? 'Cet appareil reçoit les notifications' : 'Cet appareil ne reçoit pas encore les notifications'),
        h('p', null, actif
          ? 'Vous êtes prévenu de chaque nouveauté, même l’admin fermée. Touchez une notification pour ouvrir le détail.'
          : 'Activez-les pour être prévenu à chaque demande, message, réservation, absence, incident, pointage ou appel d’offres.'))),
    bouton,
    h('p', { class: 'notif-note' }, icone('cadenas'), 'Aucune donnée personnelle dans les notifications (ni nom, ni téléphone, ni contenu) : le détail reste dans l’admin, protégé par votre connexion.'));

  /* 2. Ce que je reçois */
  const prefs = { ...d.prefs };
  const categories = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Ce que vous recevez'), h('small', null, 'Tout est activé par défaut · coupez ce qui fait trop de bruit')),
    h('ul', { class: 'services' }, d.categories.map((c) => {
      const etat = h('span', { class: 'service__etat' });
      const ligne = h('li', { class: 'service' });
      const inter = h('input', { type: 'checkbox', role: 'switch', 'aria-label': c.libelle, checked: prefs[c.cle] !== false });
      const peindre = () => {
        ligne.classList.toggle('service--ferme', !inter.checked);
        etat.classList.toggle('is-on', inter.checked);
        etat.textContent = inter.checked ? 'Activé' : 'Coupé';
      };
      inter.addEventListener('change', async () => {
        inter.disabled = true;
        prefs[c.cle] = inter.checked;
        try { await api('notif.prefs.enregistrer', { prefs }); toast(`${c.libelle} : ${inter.checked ? 'activé' : 'coupé'}.`); } catch (err) {
          inter.checked = !inter.checked;
          prefs[c.cle] = inter.checked;
          erreur(err);
        }
        inter.disabled = false;
        peindre();
      });
      peindre();
      ligne.append(h('span', { class: 'service__ic' }, icone(ICONES[c.cle] || 'activite')), h('div', { class: 'service__txt' }, h('b', null, c.libelle), h('small', null, c.detail)), etat,
        h('label', { class: 'interrupteur' }, inter, h('span')));
      return ligne;
    })));

  /* 3. Appareils abonnés */
  const appareils = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Appareils abonnés'), h('small', null, `${d.appareils.length} appareil(s)`)),
    d.appareils.length
      ? h('ul', { class: 'notif-appareils' }, d.appareils.map((a) => h('li', null,
        h('span', { class: 'notif-appareils__ic' }, icone(/iPhone|Android|iPad/.test(a.appareil) ? 'mobile' : 'appareil')),
        h('div', null, h('b', null, a.appareil || 'Appareil', abo && abo.endpoint === a.endpoint ? h('em', null, ' · cet appareil') : null),
          h('small', null, `${a.login ? `Compte ${a.login} · ` : ''}activé ${ilYa(a.cree)}${a.vu && a.vu !== a.cree ? ` · dernière notification ${ilYa(a.vu)}` : ''}`)),
        h('button', { class: 'icon-btn', type: 'button', title: 'Retirer', 'aria-label': 'Retirer cet appareil', onclick: async () => {
          if (!(await confirmer(`Ne plus envoyer de notifications à « ${a.appareil} » ?`, { ok: 'Retirer', danger: true }))) return;
          try { await api('notif.appareil.retirer', { id: a.id }); toast('Appareil retiré.'); recharger(); } catch (err) { erreur(err); }
        } }, icone('poubelle')))))
      : h('p', { class: 'vide' }, 'Aucun appareil pour le moment.'));

  ctx.afficher(h('div', { class: 'notif-page' }, appareil, categories, dc ? carteDiscord(dc, recharger) : null, appareils));
}

/* ---------- Serveur Discord de la direction ---------- */
function carteDiscord(dc, recharger) {
  const jeton = h('input', { class: 'input', type: 'password', autocomplete: 'off', placeholder: dc.jeton ? 'Jeton enregistré · collez-en un nouveau pour le remplacer' : 'Collez ici le jeton du bot (portail Discord > Bot)' });
  const occupe = async (b, travail) => {
    b.disabled = true;
    b.classList.add('is-loading');
    try { await travail(); } catch (err) { erreur(err); } finally { b.disabled = false; b.classList.remove('is-loading'); }
  };
  const journal = (titre, lignes) => modale({ titre, contenu: h('ul', { class: 'op-etapes' }, (lignes || []).map((l) => h('li', null, l))), actions: [{ libelle: 'Fermer', classe: 'btn--gold', valeur: true, submit: true }] });
  const etat = [
    dc.jeton ? 'Jeton du bot enregistré' : 'Jeton du bot à coller',
    dc.installe ? `serveur installé ${ilYa(dc.installe)} · ${dc.salons} salons` : 'serveur pas encore installé',
    dc.synchro ? `dernière mise à jour ${ilYa(dc.synchro)}` : '',
    `${dc.file.envoyes} message(s) envoyés · ${dc.file.attente} en attente${dc.file.erreurs ? ` · ${dc.file.erreurs} en erreur` : ''}`,
    `${dc.coffre} accès dans le coffre-fort`,
  ].filter(Boolean).join(' · ');
  return h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Serveur Discord de la direction'), h('small', null, 'Alertes détaillées, panel, dossiers, coffre-fort')),
    h('p', { class: 'notif-note' }, icone(dc.jeton && dc.installe ? 'coche' : 'alerte'), etat),
    !dc.sodium ? h('p', { class: 'notif-note' }, icone('alerte'), 'Le serveur ne sait pas vérifier les signatures Discord (extension sodium absente) : les commandes / ne répondront pas.') : null,
    h('div', { class: 'champ' }, h('span', { class: 'champ__label' }, 'Jeton du bot'), jeton,
      h('small', { class: 'champ__aide' }, 'Rangé dans le fichier privé .env du serveur, jamais affiché. Régénérez-le dans le portail Discord s’il a été partagé.')),
    h('div', { class: 'notif-actions' },
      h('button', { class: 'btn btn--gold', type: 'button', onclick: (e) => occupe(e.currentTarget, async () => {
        const r = await api('discord.jeton', { jeton: jeton.value.trim() });
        toast(jeton.value.trim() ? `Jeton enregistré (bot ${r.bot}).` : 'Jeton retiré.');
        recharger();
      }) }, icone('cle'), h('span', null, 'Enregistrer le jeton')),
      h('button', { class: 'btn btn--ghost', type: 'button', disabled: !dc.jeton, onclick: (e) => occupe(e.currentTarget, async () => {
        const r = await api('discord.installer', {});
        await journal('Serveur Discord installé', r.journal);
        recharger();
      }) }, icone('reglages'), h('span', null, 'Installer / réparer le serveur')),
      h('button', { class: 'btn btn--ghost', type: 'button', disabled: !dc.installe, onclick: (e) => occupe(e.currentTarget, async () => {
        const r = await api('discord.sync', {});
        await journal('Serveur Discord mis à jour', r.journal);
        recharger();
      }) }, icone('activite'), h('span', null, 'Tout mettre à jour')),
      dc.guild ? h('a', { class: 'btn btn--ghost', href: `https://discord.com/channels/${dc.guild}`, target: '_blank', rel: 'noopener' }, icone('site'), h('span', null, 'Ouvrir Discord')) : null,
      h('a', { class: 'btn btn--ghost', href: dc.lienBot, target: '_blank', rel: 'noopener' }, icone('bouclier'), h('span', null, 'Droits du bot'))));
}
