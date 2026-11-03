/* =========================================================
   ESPACE ÉQUIPE — l'appli iPhone « BDA Équipe » (module « mobile »)
   - Dans l'appli (coque Capacitor) : inscription aux notifications Apple, ouverture de la bonne
     page quand on touche une notification, copie des prochains postes et des consignes sur le
     téléphone (affichés par la page hors ligne de l'appli quand il n'y a pas de réseau).
   - Page « Mon compte » : infos du compte et suppression du compte (règle de l'App Store).
   ========================================================= */
export const ICONES = {
  compte: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1.3-3.6 3.9-5.5 7-5.5s5.7 1.9 7 5.5"/>',
};

const cap = window.Capacitor;
export const natif = () => Boolean(cap?.isNativePlatform?.());
if (natif()) document.documentElement.classList.add('eq-natif');

// Ouvre l'adresse portée par une notification (ex. /espace-equipe#/messages)
function aller(url) {
  try {
    const u = new URL(url, location.origin);
    if (u.origin !== location.origin) return;
    if (u.pathname === location.pathname) location.hash = u.hash || '#/';
    else location.href = u.pathname + u.hash;
  } catch (e) { /* adresse invalide : on reste où on est */ }
}

let branche = false;
async function brancher(o) {
  if (branche || !natif()) return;
  branche = true;
  try {
    const Push = cap.registerPlugin('PushNotifications');
    await Push.addListener('registration', (t) => { o.api('mod.mobile.push.inscrire', { jeton: t.value }).catch(() => {}); });
    await Push.addListener('registrationError', (e) => console.error('Notifications', e));
    await Push.addListener('pushNotificationActionPerformed', (a) => { const url = a?.notification?.data?.url; if (url) aller(url); });
    let p = await Push.checkPermissions();
    if (p.receive === 'prompt' || p.receive === 'prompt-with-rationale') p = await Push.requestPermissions();
    if (p.receive === 'granted') await Push.register();
  } catch (e) { console.error('Notifications', e); }
  memoriser(o);
}
// Copie pour le mode hors ligne (au plus une fois toutes les 10 minutes)
async function memoriser(o) {
  try {
    const Prefs = cap.registerPlugin('Preferences');
    const { value } = await Prefs.get({ key: 'bda-horsligne-quand' });
    if (value && Date.now() - Number(value) < 600000) return;
    const d = await o.api('mod.mobile.horsligne');
    await Prefs.set({ key: 'bda-horsligne', value: JSON.stringify(d) });
    await Prefs.set({ key: 'bda-horsligne-quand', value: String(Date.now()) });
  } catch (e) { /* pas de réseau : la copie précédente reste */ }
}

async function rendu(o) {
  const { h, api, toast, enTete } = o;
  brancher(o);
  const d = await api('mod.mobile.compte');
  const c = d.compte;
  const ligne = (lib, val) => h('div', { class: 'eqa-ligne' }, h('span', null, lib), h('b', null, val || '—'));
  const infos = h('section', { class: 'eq-carte' },
    ligne('Nom', `${c.prenom} ${c.nom}`), ligne('Identifiant', c.identifiant), ligne('E-mail', c.email),
    ligne('Notifications', d.appareils ? `activées sur ${d.appareils} iPhone` : natif() ? 'à autoriser dans les Réglages de l’iPhone' : 'dans l’appli BDA Équipe'));

  const confirmation = h('input', { class: 'eq-input', type: 'text', autocomplete: 'off', autocapitalize: 'characters', placeholder: 'SUPPRIMER', 'aria-label': 'Tapez SUPPRIMER pour confirmer' });
  const supprimer = async (e) => {
    if (confirmation.value.trim() !== 'SUPPRIMER') { toast('Tapez SUPPRIMER pour confirmer.', true); return; }
    e.currentTarget.disabled = true;
    try {
      await api('mod.mobile.compte.supprimer', { confirmation: 'SUPPRIMER' });
      toast('Votre compte est supprimé.');
      setTimeout(() => location.replace('/espace-equipe'), 1200);
    } catch (err) { toast(err.message, true); e.currentTarget.disabled = false; }
  };
  const zone = h('section', { class: 'eq-carte eqa-danger' },
    h('h2', null, 'Supprimer mon compte'),
    h('p', null, 'Votre accès à l’Espace équipe et à l’appli est supprimé définitivement. Votre dossier de salarié (contrat, fiches de paie) reste conservé par BDA, comme la loi l’impose.'),
    confirmation,
    h('button', { class: 'eq-btn eqa-supprimer', type: 'button', onclick: supprimer }, 'Supprimer mon compte'));

  return h('div', { class: 'eqa' }, enTete('Moi', 'Mon compte', null), infos, zone);
}

export const PAGES = {
  compte: { titre: 'Mon compte', icone: 'compte', rendu },
};

// Pas de carte à l'accueil : ce point d'entrée sert seulement à brancher l'appli une fois connecté
export const CARTES = [async (o) => { brancher(o); return null; }];
