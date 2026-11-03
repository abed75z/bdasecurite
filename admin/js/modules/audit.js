/* =========================================================
   ESPACE ADMIN BDA — Audits de sûreté (module « audit »)
   #/audit                         liste des audits
   #/audit/nouveau                 nouvel audit (…/nouveau/demande/<id> : à partir d'une demande du site)
   #/audit/<id>                    l'audit : grille de visite, constat, recommandations, dispositif,
                                   rapport PDF et « Préparer le devis » (devis brouillon pré-rempli)
   ========================================================= */
import { api, h, icone, toast, erreur, confirmer, champ, saisie, zoneTexte, attendre, ilYa, ecusson, marqueLogo, isoVersFr } from '../outils.js';
import { telechargerFeuilles } from '../pdf.js';

const TONS = { ok: 'payee', ameliorer: 'attente', critique: 'refusee', na: 'archivee' };
const COURTS = { ok: 'Conforme', ameliorer: 'À améliorer', critique: 'Critique', na: 'N. C.' };
const tonScore = (s) => (s >= 75 ? 'is-ok' : s >= 50 ? 'is-attente' : 'is-alerte');
const auj = () => new Date().toISOString().slice(0, 10);

// Heures d'un besoin : par mois (jours par semaine × 52 / 12) ou ponctuel (nombre de jours)
function heuresBesoin(b) {
  const [dh, dm] = b.debut.split(':').map(Number);
  const [fh, fm] = b.fin.split(':').map(Number);
  let duree = (fh * 60 + fm - (dh * 60 + dm)) / 60;
  if (duree <= 0) duree += 24;
  return Math.round(b.nombre * duree * (b.frequence === 'ponctuel' ? b.jours : (b.jours * 52) / 12));
}

export async function pageAudit(ctx) {
  const [vue, a, b] = ctx.params;
  if (vue === 'nouveau') return editeur(ctx, 0, a === 'demande' ? Number(b) : 0);
  if (/^\d+$/.test(vue || '')) return editeur(ctx, Number(vue), 0);
  ctx.titre('Audits de sûreté');
  ctx.actions(h('a', { class: 'btn btn--gold', href: '#/audit/nouveau' }, icone('plus'), h('span', null, 'Nouvel audit')));
  const d = await api('mod.audit.liste');
  if (!ctx.actuel()) return;
  ctx.afficher(h('div', { class: 'tr au' },
    h('p', { class: 'pf-aide' }, 'Visitez le site du client avec votre téléphone, cochez chaque point, notez ce qu’il faut. Vous repartez avec un rapport PDF à son nom et un devis prêt à relire.'),
    h('section', { class: 'carte' }, d.audits.length ? h('div', { class: 'tableau' }, h('table', null,
      h('thead', null, h('tr', null, h('th', null, 'Client'), h('th', null, 'Site'), h('th', null, 'Visite'), h('th', null, 'Note'), h('th', null, 'État'))),
      h('tbody', null, d.audits.map((x) => h('tr', { class: 'ligne-clic', onclick: () => { location.hash = `#/audit/${x.id}`; } },
        h('td', null, h('b', null, x.client), x.adresse ? h('small', { class: 'muet mx-bloc' }, x.adresse) : null),
        h('td', null, x.typeLib),
        h('td', { class: 'mx-num' }, isoVersFr(x.visite)),
        h('td', null, h('b', { class: `tr-note ${tonScore(x.score)}` }, `${x.score}/100`), x.critiques ? h('small', { class: 'mx-rouge mx-bloc' }, `${x.critiques} point${x.critiques > 1 ? 's' : ''} critique${x.critiques > 1 ? 's' : ''}`) : null),
        h('td', null, h('span', { class: `pastille pastille--${x.statut === 'termine' ? 'payee' : 'attente'}` }, x.statut === 'termine' ? 'Terminé' : 'En cours'), h('small', { class: 'muet mx-bloc' }, ilYa(x.maj))))))))
      : h('div', { class: 'mx-vide' }, h('b', null, 'Aucun audit'), h('p', null, 'Un audit gratuit est un excellent argument pour signer : commencez par un prospect.')))));
}

async function editeur(ctx, id, demandeId) {
  ctx.titre(id ? 'Audit de sûreté' : 'Nouvel audit de sûreté');
  const [o, existant, site, regl] = await Promise.all([
    api('mod.audit.options', undefined, demandeId ? { demande: demandeId } : {}),
    id ? api('mod.audit.audit', undefined, { id }) : null,
    api('site').catch(() => ({ site: { tarifs: {} } })),
    api('reglages').catch(() => ({ reglages: {} })),
  ]);
  if (!ctx.actuel()) return;
  const tarifs = site.site?.tarifs || {};
  const A = existant ? { ...existant.audit } : {
    id: 0, client_id: 0, client: o.depart?.client || '', adresse: o.depart?.adresse || '', contact: o.depart?.contact || '', type: 'autre', visite: auj(), statut: 'brouillon', demande_id: o.depart?.demande_id || 0,
    data: { reponses: {}, besoins: [], constat: o.depart?.constat || '', recommandations: '' },
  };
  const D = A.data;
  let modifie = false;

  /* Barre d'état (collante) : note, points critiques, enregistrement */
  const note = h('b', { class: 'au-note' });
  const resume = h('span', { class: 'au-resume' });
  const etatEnreg = h('small', { class: 'muet' }, id ? 'Enregistré' : 'Pas encore enregistré');
  const calculer = () => {
    let total = 0, pts = 0;
    const n = { ok: 0, ameliorer: 0, critique: 0 };
    Object.values(D.reponses).forEach((t) => Object.values(t).forEach((x) => { if (n[x.etat] !== undefined) { n[x.etat]++; total++; pts += { ok: 1, ameliorer: 0.5, critique: 0 }[x.etat]; } }));
    const s = total ? Math.round((100 * pts) / total) : 0;
    note.textContent = total ? `${s}/100` : '—';
    note.className = `au-note tr-note ${total ? tonScore(s) : ''}`;
    resume.textContent = `${n.ok} conforme${n.ok > 1 ? 's' : ''} · ${n.ameliorer} à améliorer · ${n.critique} critique${n.critique > 1 ? 's' : ''}`;
    return { s, n };
  };
  const enregistrer = async (statut) => {
    if (!champClient.value.trim()) { if (statut !== undefined) toast('Indiquez le client ou le prospect.', 'erreur'); champClient.focus(); return false; }
    if (statut) A.statut = statut;
    etatEnreg.textContent = 'Enregistrement…';
    try {
      const r = await api('mod.audit.enregistrer', { id: A.id, client_id: A.client_id, client: champClient.value, adresse: champAdresse.value, contact: champContact.value, type: champType.value, visite: champVisite.value, statut: A.statut, demande_id: A.demande_id, data: D });
      const premier = !A.id;
      A.id = r.id;
      modifie = false;
      etatEnreg.textContent = 'Enregistré';
      if (premier) history.replaceState(null, '', `#/audit/${r.id}`);
      return true;
    } catch (e) { erreur(e); etatEnreg.textContent = 'Non enregistré'; return false; }
  };
  const auto = attendre(() => { if (champClient.value.trim()) enregistrer(); }, 1500);
  const change = () => { modifie = true; etatEnreg.textContent = 'Modifications…'; calculer(); auto(); };

  /* Client et site */
  const listeClients = h('datalist', { id: 'au-clients' }, o.clients.map((c) => h('option', { value: c.nom })));
  const champClient = saisie({ value: A.client, list: 'au-clients', placeholder: 'Client ou prospect', oninput: () => {
    const c = o.clients.find((x) => x.nom === champClient.value);
    A.client_id = c ? c.id : 0;
    if (c && !champAdresse.value) champAdresse.value = c.adresse || '';
    if (c && !champContact.value) champContact.value = [c.tel, c.email].filter(Boolean).join(' · ');
    change();
  } });
  const champAdresse = saisie({ value: A.adresse, placeholder: 'Adresse du site', oninput: change });
  const champContact = saisie({ value: A.contact, placeholder: 'Téléphone, mail du responsable', oninput: change });
  const champType = h('select', { class: 'input', onchange: change }, Object.entries(o.types).map(([k, l]) => h('option', { value: k, selected: k === A.type }, l)));
  const champVisite = saisie({ type: 'date', value: A.visite, onchange: change });
  const blocClient = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Client et site'), A.demande_id ? h('small', null, 'À partir d’une demande du site') : null),
    listeClients,
    h('div', { class: 'form-grille form-grille--2' }, champ('Client', champClient), champ('Type de site', champType)),
    champ('Adresse', champAdresse),
    h('div', { class: 'form-grille form-grille--2' }, champ('Contact sur place', champContact), champ('Date de la visite', champVisite)));

  /* Grille de visite */
  const recos = h('ul', { class: 'au-recos' });
  const dessinerRecos = () => {
    const l = [];
    o.grille.forEach((t) => t.points.forEach((p) => { const x = D.reponses[t.cle]?.[p.cle]; if (x && ['critique', 'ameliorer'].includes(x.etat)) l.push([x.etat, p.reco]); }));
    l.sort((a, b) => (a[0] === 'critique' ? -1 : 1) - (b[0] === 'critique' ? -1 : 1));
    recos.replaceChildren(...(l.length ? l.map(([e, r]) => h('li', { class: `is-${e}` }, h('span', { class: `pastille pastille--${TONS[e]}` }, COURTS[e]), r)) : [h('li', { class: 'muet' }, 'Les recommandations apparaissent ici dès qu’un point est « à améliorer » ou « critique ».')]));
  };
  const themes = o.grille.map((t) => {
    const compte = h('small', { class: 'muet' });
    const majCompte = () => { const r = Object.values(D.reponses[t.cle] || {}).filter((x) => x.etat); compte.textContent = `${r.length}/${t.points.length} vérifiés`; };
    majCompte();
    const points = t.points.map((p) => {
      const x = () => ((D.reponses[t.cle] ??= {})[p.cle] ??= { etat: '', commentaire: '' });
      const actuel = D.reponses[t.cle]?.[p.cle] || {};
      const boutons = Object.keys(COURTS).map((e) => h('button', { type: 'button', class: `au-choix is-${e} ${actuel.etat === e ? 'is-on' : ''}`, onclick: (ev) => {
        const r = x();
        r.etat = r.etat === e ? '' : e;
        ev.currentTarget.parentElement.querySelectorAll('.au-choix').forEach((b) => b.classList.toggle('is-on', b === ev.currentTarget && r.etat === e));
        majCompte(); dessinerRecos(); change();
      } }, COURTS[e]));
      const com = saisie({ value: actuel.commentaire || '', placeholder: 'Commentaire (facultatif)', oninput: (e) => { x().commentaire = e.target.value; change(); } });
      return h('div', { class: 'au-point' }, h('p', null, p.libelle), h('div', { class: 'au-choix-groupe' }, boutons), com);
    });
    return h('section', { class: 'carte au-theme' }, h('header', { class: 'carte__tete' }, h('h2', null, t.libelle), compte), points);
  });

  /* Constat et recommandations */
  const constat = zoneTexte({ rows: 4, value: D.constat, placeholder: 'Ce que vous avez vu : contexte, incidents racontés par le client, points forts…', oninput: (e) => { D.constat = e.target.value; change(); } });
  const recoLibres = zoneTexte({ rows: 3, value: D.recommandations, placeholder: 'Vos recommandations en plus (facultatif)', oninput: (e) => { D.recommandations = e.target.value; change(); } });
  dessinerRecos();

  /* Dispositif proposé */
  const listeBesoins = h('div', { class: 'au-besoins' });
  const totalH = h('b');
  const dessinerBesoins = () => {
    listeBesoins.replaceChildren(...D.besoins.map((b, i) => {
      const heures = h('span', { class: 'au-heures mx-num' });
      const maj = () => { heures.textContent = `${heuresBesoin(b)} h${b.frequence === 'mois' ? ' / mois' : ''}`; totalH.textContent = `${D.besoins.filter((x) => x.frequence === 'mois').reduce((s, x) => s + heuresBesoin(x), 0)} h / mois`; };
      const set = (k, conv = (v) => v) => (e) => { b[k] = conv(e.target.value); maj(); change(); };
      maj();
      return h('div', { class: 'au-besoin' },
        h('select', { class: 'input', onchange: set('profil') }, Object.entries(o.profils).map(([k, l]) => h('option', { value: k, selected: k === b.profil }, l))),
        h('label', { class: 'au-mini' }, h('span', null, 'Agents'), saisie({ type: 'number', min: 1, max: 50, value: b.nombre, oninput: set('nombre', (v) => Math.max(1, Number(v) || 1)) })),
        h('label', { class: 'au-mini' }, h('span', null, 'De'), saisie({ type: 'time', value: b.debut, oninput: set('debut') })),
        h('label', { class: 'au-mini' }, h('span', null, 'À'), saisie({ type: 'time', value: b.fin, oninput: set('fin') })),
        h('select', { class: 'input', onchange: (e) => { b.frequence = e.target.value; dessinerBesoins(); change(); } }, h('option', { value: 'mois', selected: b.frequence === 'mois' }, 'Jours par semaine'), h('option', { value: 'ponctuel', selected: b.frequence === 'ponctuel' }, 'Nombre de jours (ponctuel)')),
        h('label', { class: 'au-mini' }, h('span', null, 'Jours'), saisie({ type: 'number', min: 1, max: b.frequence === 'mois' ? 7 : 365, value: b.jours, oninput: set('jours', (v) => Math.max(1, Number(v) || 1)) })),
        heures,
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Retirer', onclick: () => { D.besoins.splice(i, 1); dessinerBesoins(); change(); } }, icone('croix')));
    }));
    if (!D.besoins.length) { listeBesoins.append(h('p', { class: 'muet' }, 'Ajoutez le dispositif que vous proposez : il servira à préparer le devis.')); totalH.textContent = '—'; }
  };
  dessinerBesoins();
  const blocBesoins = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Dispositif proposé'), h('small', null, 'Total mensuel : ', totalH)),
    listeBesoins,
    h('button', { class: 'lien-btn', type: 'button', onclick: () => { D.besoins.push({ profil: 'agent', nombre: 1, debut: '20:00', fin: '06:00', frequence: 'mois', jours: 7 }); dessinerBesoins(); change(); } }, icone('plus'), 'Ajouter des agents'));

  /* Rapport PDF et devis */
  const rapport = async () => {
    if (!(await enregistrer(undefined))) return;
    const { s, n } = calculer();
    const r = regl.reglages || {};
    const lignesPoints = [];
    o.grille.forEach((t) => t.points.forEach((p) => { const x = D.reponses[t.cle]?.[p.cle]; if (x && ['critique', 'ameliorer'].includes(x.etat)) lignesPoints.push([t.libelle, p, x]); }));
    lignesPoints.sort((a, b) => (a[2].etat === 'critique' ? -1 : 1) - (b[2].etat === 'critique' ? -1 : 1));
    const feuille = h('div', { class: 'feuille au-f' },
      h('header', { class: 'fx-tete' }, h('div', { class: 'fx-marque' }, ecusson('fx-blason'), marqueLogo()),
        h('div', { class: 'fx-doc' }, h('span', { class: 'fx-doc__type' }, 'Audit de sûreté'), h('div', { class: 'fx-doc__num' }, h('span', { class: 'fx-doc__label' }, 'Visite du'), h('span', { class: 'fx-doc__val' }, isoVersFr(champVisite.value))))),
      h('div', { class: 'fx-filet' }),
      h('div', { class: 'f-parties' },
        h('div', { class: 'f-partie' }, h('span', { class: 'f-label' }, 'Réalisé par'), h('div', { class: 'f-nom' }, 'BDA Security Group'), h('div', { class: 'f-lignes' }, 'Sécurité privée · surveillance et gardiennage')),
        h('div', { class: 'f-partie f-partie--client' }, h('span', { class: 'f-label' }, 'Pour'), h('div', { class: 'f-nom' }, champClient.value), h('div', { class: 'f-lignes' }, [champAdresse.value, o.types[champType.value]].filter(Boolean).join('\n')))),
      h('div', { class: 'au-f-score' },
        h('div', null, h('span', { class: 'f-label' }, 'Note globale'), h('b', null, `${s}`, h('small', null, '/100'))),
        h('div', null, h('span', { class: 'f-label' }, 'Conformes'), h('b', null, String(n.ok))),
        h('div', null, h('span', { class: 'f-label' }, 'À améliorer'), h('b', null, String(n.ameliorer))),
        h('div', null, h('span', { class: 'f-label' }, 'Critiques'), h('b', null, String(n.critique)))),
      D.constat ? h('div', { class: 'au-f-bloc' }, h('span', { class: 'f-label' }, 'Constat'), h('p', null, D.constat)) : null,
      lignesPoints.length ? h('div', { class: 'au-f-bloc' }, h('span', { class: 'f-label' }, 'Points à traiter et recommandations'),
        h('table', { class: 'au-f-table' }, h('thead', null, h('tr', null, h('th', null, 'Point vérifié'), h('th', null, 'État'), h('th', null, 'Recommandation'))),
          h('tbody', null, lignesPoints.map(([theme, p, x]) => h('tr', null,
            h('td', null, h('small', null, theme), p.libelle, x.commentaire ? h('em', null, x.commentaire) : null),
            h('td', null, h('span', { class: `au-f-etat is-${x.etat}` }, COURTS[x.etat])),
            h('td', null, p.reco)))))) : h('div', { class: 'au-f-bloc' }, h('span', { class: 'f-label' }, 'Points à traiter'), h('p', null, 'Aucun point à améliorer relevé lors de la visite.')),
      D.recommandations ? h('div', { class: 'au-f-bloc' }, h('span', { class: 'f-label' }, 'Recommandations complémentaires'), h('p', null, D.recommandations)) : null,
      D.besoins.length ? h('div', { class: 'au-f-bloc' }, h('span', { class: 'f-label' }, 'Dispositif de sécurité proposé'),
        h('table', { class: 'au-f-table' }, h('thead', null, h('tr', null, h('th', null, 'Profil'), h('th', null, 'Agents'), h('th', null, 'Horaires'), h('th', null, 'Fréquence'), h('th', null, 'Heures'))),
          h('tbody', null, D.besoins.map((b) => h('tr', null, h('td', null, o.profils[b.profil]), h('td', null, String(b.nombre)), h('td', null, `${b.debut} – ${b.fin}`),
            h('td', null, b.frequence === 'mois' ? `${b.jours} j / semaine` : `${b.jours} jour${b.jours > 1 ? 's' : ''}`), h('td', null, `${heuresBesoin(b)} h${b.frequence === 'mois' ? ' / mois' : ''}`)))))) : null,
      h('div', { class: 'au-f-pied' }, r.pied || 'BDA SECURITE — Autorisation d’exercice CNAPS n° AUT-075-2124-07-01-20250906336. « L’autorisation d’exercice ne confère aucune prérogative de puissance publique à l’entreprise ou aux personnes qui en bénéficient. » (art. L.612-14 du CSI)'));
    const scene = h('div', { class: 'au-scene' }, feuille);
    document.body.append(scene);
    try { await telechargerFeuilles([feuille], `Audit de sûreté — ${champClient.value} — ${isoVersFr(champVisite.value).replace(/\//g, '-')}`); } finally { scene.remove(); }
  };
  const devis = async () => {
    if (!D.besoins.length) return toast('Ajoutez d’abord le dispositif proposé (les agents et les horaires).', 'erreur');
    if (!(await enregistrer(undefined))) return;
    const horaires = [...new Set(D.besoins.map((b) => `${b.debut.replace(':', 'h')} – ${b.fin.replace(':', 'h')}`))].join(' · ');
    sessionStorage.setItem('bda-prefill-devis', JSON.stringify({
      client: { nom: champClient.value, adresse: [champAdresse.value, champContact.value].filter(Boolean).join('\n') },
      objet: `Mission de sécurisation — ${(o.types[champType.value] || 'site').toLowerCase()}`,
      description: `Suite à l’audit de sûreté réalisé sur votre site le ${isoVersFr(champVisite.value)}, nous vous proposons le dispositif ci-dessous. Nos agents, titulaires de la carte professionnelle délivrée par le CNAPS, interviennent en tenue, sous la supervision d’un responsable joignable à tout moment.`,
      lieu: champAdresse.value,
      horaires,
      effectif: D.besoins.map((b) => `${b.nombre} × ${o.profils[b.profil].replace(/^Agents? de sécurité \(ADS\)$/, 'agent de sécurité')}`).join(' + '),
      lignes: D.besoins.map((b) => ({
        designation: o.profils[b.profil],
        detail: `${b.nombre} agent${b.nombre > 1 ? 's' : ''} · ${b.debut.replace(':', 'h')} – ${b.fin.replace(':', 'h')} · ${b.frequence === 'mois' ? `${b.jours} j / semaine (volume mensuel)` : `${b.jours} jour${b.jours > 1 ? 's' : ''}`}`,
        qte: heuresBesoin(b), unite: 'h', pu: Number(tarifs[b.profil]) || 0,
      })),
    }));
    toast('Devis pré-rempli : relisez-le, rien n’est envoyé au client.');
    location.hash = '#/devis/nouveau';
  };

  const barre = h('div', { class: 'au-barre' },
    h('div', { class: 'au-barre__note' }, h('span', { class: 'f-label' }, 'Note'), note), h('div', { class: 'au-barre__txt' }, resume, etatEnreg),
    h('div', { class: 'au-barre__actions' },
      h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: rapport }, icone('telecharger'), h('span', null, 'Rapport PDF')),
      h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: devis }, icone('devis'), h('span', null, 'Préparer le devis')),
      h('button', { class: 'btn btn--gold btn--petit', type: 'button', onclick: async () => { if (await enregistrer(A.statut === 'termine' ? 'brouillon' : 'termine')) { toast(A.statut === 'termine' ? 'Audit terminé.' : 'Audit rouvert.'); terminer.lastChild.textContent = A.statut === 'termine' ? 'Rouvrir' : 'Terminer'; } } }, icone('coche'), h('span', null, A.statut === 'termine' ? 'Rouvrir' : 'Terminer'))));
  const terminer = barre.querySelector('.btn--gold');
  calculer();

  ctx.actions(h('a', { class: 'btn btn--ghost', href: '#/audit' }, icone('retour'), h('span', null, 'Audits')),
    id ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: async () => {
      if (!(await confirmer('Retirer cet audit de la liste ? (il est gardé dans les archives)', { ok: 'Retirer' }))) return;
      try { await api('mod.audit.retirer', { id: A.id }); location.hash = '#/audit'; } catch (e) { erreur(e); }
    } }, icone('poubelle'), h('span', null, 'Retirer')) : null);
  ctx.afficher(h('div', { class: 'tr au' }, barre, blocClient,
    h('h3', { class: 'tr-sous-titre' }, 'Grille de visite'), ...themes,
    h('section', { class: 'carte' }, h('header', { class: 'carte__tete' }, h('h2', null, 'Constat')), constat),
    h('section', { class: 'carte' }, h('header', { class: 'carte__tete' }, h('h2', null, 'Recommandations'), h('small', null, 'Tirées de la grille')), recos, recoLibres),
    blocBesoins));
  // Quitter la page avec des changements pas encore partis : on enregistre tout de suite
  const quitter = () => { if (modifie) auto.maintenant(); window.removeEventListener('hashchange', quitter); };
  window.addEventListener('hashchange', quitter);
}
