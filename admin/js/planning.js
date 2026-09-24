/* =========================================================
   ESPACE ADMIN BDA — planning mensuel des agents
   Saisie : 12h-19h · 7h30-19h · 19h-7h (nuit) · 8 · R / CP / M
   Calcul automatique : heures totales, de nuit, du dimanche, fériées.
   ========================================================= */
import { api, h, $, $$, icone, toast, erreur, modale, champ, attendre, MOIS, cap, pad, iso, fr, fmtHeures, lireHeures } from './outils.js';
import { telechargerPdf } from './pdf.js';

const JOURS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

/* ---------- Jours fériés (France) ---------- */
function paques(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), hh = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - hh - k) % 7, m = Math.floor((a + 11 * hh + 22 * l) / 451);
  const n = hh + l - 7 * m + 114;
  return new Date(y, Math.floor(n / 31) - 1, (n % 31) + 1);
}
const cacheFeries = {};
function feries(y) {
  if (cacheFeries[y]) return cacheFeries[y];
  const p = paques(y);
  const plus = (j) => new Date(p.getFullYear(), p.getMonth(), p.getDate() + j);
  const liste = [new Date(y, 0, 1), plus(1), new Date(y, 4, 1), new Date(y, 4, 8), plus(39), plus(50), new Date(y, 6, 14), new Date(y, 7, 15), new Date(y, 10, 1), new Date(y, 10, 11), new Date(y, 11, 25)];
  return (cacheFeries[y] = new Set(liste.map(iso)));
}
const estFerie = (d) => feries(d.getFullYear()).has(iso(d));

/* ---------- Créneaux ---------- */
export function lireCreneau(txt) {
  const t = String(txt || '').trim().toLowerCase().replace(/\s+/g, '').replace(/[–—à]/g, '-');
  if (!t) return null;
  if (/^[a-zéè]+$/.test(t)) return { code: t.toUpperCase() };
  const m = t.match(/^(\d{1,2})(?:[h:](\d{2})?)?-(\d{1,2})(?:[h:](\d{2})?)?h?$/);
  if (m) {
    const h1 = +m[1], m1 = +(m[2] || 0), h2 = +m[3], m2 = +(m[4] || 0);
    if (h1 > 24 || h2 > 24 || m1 > 59 || m2 > 59) return { err: true };
    const debut = h1 * 60 + m1;
    let fin = h2 * 60 + m2;
    if (fin <= debut) fin += 1440;
    return { debut, fin };
  }
  const hrs = lireHeures(t);
  if (Number.isFinite(hrs) && hrs > 0 && hrs <= 24) return { duree: Math.round(hrs * 60) };
  return { err: true };
}
const fmtH = (min) => { const hh = Math.floor(min / 60) % 24, m = min % 60; return m ? `${hh}h${pad(m)}` : `${hh}h`; };
function normaliser(c) {
  if (!c || c.err) return null;
  if (c.code) return c.code;
  if (c.duree != null) return fmtHeures(c.duree / 60, true);
  return `${fmtH(c.debut)}-${fmtH(c.fin)}`;
}
function apercu(c) {
  if (!c) return [];
  if (c.err) return ['?'];
  if (c.code) return [c.code];
  if (c.duree != null) return [fmtHeures(c.duree / 60, true)];
  return [fmtH(c.debut), h('br'), fmtH(c.fin)];
}
const minutes = (hhmm, def) => { const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/); return m ? +m[1] * 60 + +m[2] : def; };
function compter(date, c, nuit) {
  const r = { total: 0, nuit: 0, dim: 0, fer: 0 };
  if (!c || c.code || c.err) return r;
  const jour = (dec) => { const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + dec); return { dim: d.getDay() === 0, fer: estFerie(d) }; };
  if (c.duree != null) {
    const j = jour(0);
    r.total = c.duree; if (j.dim) r.dim = c.duree; if (j.fer) r.fer = c.duree;
    return r;
  }
  const jours = [jour(0), jour(1)];
  const enNuit = (mod) => (nuit.debut > nuit.fin ? mod >= nuit.debut || mod < nuit.fin : mod >= nuit.debut && mod < nuit.fin);
  for (let m = c.debut; m < c.fin; m++) {
    const j = jours[Math.floor(m / 1440)] || jours[1];
    r.total++;
    if (enNuit(m % 1440)) r.nuit++;
    if (j.dim) r.dim++;
    if (j.fer) r.fer++;
  }
  return r;
}
// Totaux (en minutes) d'un planning pour un mois « AAAA-MM » ; parAgent en option
export function totauxDuMois(p, mois, parAgent) {
  const [y, mo] = mois.split('-').map(Number);
  const nb = new Date(y, mo, 0).getDate();
  const nuit = { debut: minutes(p.nuitDebut, 1260), fin: minutes(p.nuitFin, 360) };
  const G = { total: 0, nuit: 0, dim: 0, fer: 0, parJour: {} };
  (p.agents || []).forEach((a, ai) => {
    const T = { total: 0, nuit: 0, dim: 0, fer: 0 };
    for (let d = 1; d <= nb; d++) {
      const dt = new Date(y, mo - 1, d), cle = iso(dt);
      const r = compter(dt, lireCreneau((a.jours || {})[cle]), nuit);
      T.total += r.total; T.nuit += r.nuit; T.dim += r.dim; T.fer += r.fer;
      G.parJour[cle] = (G.parJour[cle] || 0) + r.total;
    }
    if (parAgent) parAgent(ai, T);
    G.total += T.total; G.nuit += T.nuit; G.dim += T.dim; G.fer += T.fer;
  });
  return G;
}

/* =========================================================
   PAGE PLANNING
   ========================================================= */
export async function pagePlanning(ctx) {
  const auj = new Date();
  const mois = /^\d{4}-\d{2}$/.test(ctx.params[0] || '') ? ctx.params[0] : `${auj.getFullYear()}-${pad(auj.getMonth() + 1)}`;
  const [y, mo] = mois.split('-').map(Number);
  const libelle = `${cap(MOIS[mo - 1])} ${y}`;
  const decaler = (n) => { const d = new Date(y, mo - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };

  const [{ planning }, { agents }, { clients }, { reglages }] = await Promise.all([api('planning', undefined, { mois }), api('agents'), api('clients'), api('reglages')]);
  const p = planning || { client: '', site: '', mission: '', nuitDebut: '21:00', nuitFin: '06:00', agents: [] };
  p.agents = p.agents || [];

  /* ----- Enregistrement ----- */
  const indicateur = h('span', { class: 'etat-save is-ok' }, planning ? '✓ À jour' : '');
  const enregistrer = attendre(async () => {
    indicateur.textContent = 'Enregistrement…'; indicateur.className = 'etat-save is-encours';
    try { await api('planning.enregistrer', { mois, planning: p }); indicateur.textContent = '✓ Enregistré'; indicateur.className = 'etat-save is-ok'; }
    catch (e) { indicateur.textContent = 'Non enregistré'; indicateur.className = 'etat-save is-erreur'; erreur(e); }
  }, 800);
  const change = () => { indicateur.textContent = 'Modifications…'; indicateur.className = 'etat-save'; enregistrer(); };

  ctx.titre('Planning');
  ctx.actions(indicateur,
    h('button', { class: 'btn btn--ghost', type: 'button', onclick: async () => { await enregistrer.maintenant(); telechargerPdf(feuille, `Planning ${libelle} - ${p.client || 'BDA'}`, { paysage: true }); } }, icone('telecharger'), h('span', null, 'Télécharger en PDF')),
    h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => imprimer() }, icone('imprimer'), h('span', null, 'Imprimer')),
    h('button', { class: 'btn btn--gold', type: 'button', onclick: () => creerFacture() }, icone('facture'), h('span', null, 'Créer la facture du mois')));

  /* ----- Feuille paysage ----- */
  const nb = new Date(y, mo, 0).getDate();
  const jours = Array.from({ length: nb }, (_, i) => {
    const dt = new Date(y, mo - 1, i + 1);
    return { d: i + 1, dt, cle: iso(dt), cls: estFerie(dt) ? 'ho' : dt.getDay() === 0 || dt.getDay() === 6 ? 'we' : '' };
  });
  const table = h('table', { class: 'plan' });
  const champsInfos = [];
  const infos = (cle, label, ph) => {
    const el = h('div', { class: 'plan-info__val', contenteditable: 'plaintext-only', spellcheck: 'false', 'data-ph': ph });
    el.textContent = p[cle] || '';
    champsInfos.push(() => { el.textContent = p[cle] || ''; });
    el.addEventListener('input', () => { p[cle] = el.innerText.trim(); change(); });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
    return h('div', null, h('span', { class: 'f-label' }, label), el);
  };
  const nuitTxt = h('b');
  const feuille = h('div', { class: 'feuille feuille--paysage' },
    h('div', { class: 'plan-entete' },
      h('img', { class: 'f-logo f-logo--mini', src: 'logo-document.jpg', alt: '' }),
      h('div', null, h('h2', { class: 'plan-titre' }, 'Planning des agents'), h('div', { class: 'plan-mois' }, libelle)),
      h('div', { class: 'plan-info' }, infos('client', 'Client', 'Client'), infos('site', 'Site', 'Adresse du site'), infos('mission', 'Mission', 'Type de mission'))),
    table,
    h('div', { class: 'plan-legende' },
      h('span', null, h('i', { class: 'lg-has' }), 'Jour travaillé'), h('span', null, h('i', { class: 'lg-we' }), 'Week-end'), h('span', null, h('i', { class: 'lg-ho' }), 'Jour férié'),
      h('span', null, 'Heures de nuit : ', nuitTxt),
      h('span', null, 'Saisie : 12h-19h · 7h30-19h · 19h-7h (nuit jusqu\'au lendemain) · 8 (heures) · R repos · CP congés · M maladie')),
    h('div', { class: 'f-espace' }),
    h('div', { class: 'f-pied' }, reglages.pied));

  function dessiner() {
    nuitTxt.textContent = `de ${fmtH(minutes(p.nuitDebut, 1260))} à ${fmtH(minutes(p.nuitFin, 360))}`;
    const tete = h('thead', null,
      h('tr', null, h('th', { rowspan: 2, class: 'th-agent' }, 'Agent'), jours.map((j) => h('th', { class: j.cls }, j.d)),
        ['Total', 'Nuit', 'Dim.', 'Férié'].map((t) => h('th', { rowspan: 2 }, t))),
      h('tr', null, jours.map((j) => h('th', { class: `wd ${j.cls}` }, JOURS[j.dt.getDay()]))));
    const corps = h('tbody', null, p.agents.map((a, ai) => {
      a.jours = a.jours || {};
      const nom = h('div', { class: 'agent__nom', contenteditable: 'plaintext-only', spellcheck: 'false', 'data-ph': 'Nom de l\'agent' }, a.nom || '');
      const poste = h('div', { class: 'agent__poste', contenteditable: 'plaintext-only', spellcheck: 'false', 'data-ph': 'Poste' }, a.poste || '');
      [nom, poste].forEach((el, k) => {
        el.addEventListener('input', () => { a[k ? 'poste' : 'nom'] = el.innerText.trim(); change(); });
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
      });
      const retirer = h('button', { type: 'button', class: 'f-outil-agent', title: 'Retirer cet agent', onclick: async () => {
        if (!(await modale({ titre: 'Retirer l\'agent', contenu: h('p', { class: 'modale__texte' }, `Retirer ${a.nom || 'cet agent'} du planning de ${libelle} ?`), actions: [{ libelle: 'Annuler', classe: 'btn--ghost', valeur: false }, { libelle: 'Retirer', classe: 'btn--danger', valeur: true, submit: true }] }))) return;
        p.agents.splice(ai, 1); dessiner(); change();
      } }, '×');
      return h('tr', { dataset: { a: ai } },
        h('td', { class: 'agent' }, nom, poste, retirer),
        jours.map((j) => cellule(a, j)),
        ['t-total', 't-nuit', 't-dim', 't-fer'].map((c) => h('td', { class: `tot ${c}` })));
    }));
    const pied = h('tfoot', null, h('tr', null, h('td', { class: 'agent' }, 'Total / jour'), jours.map((j) => h('td', { class: 'f-jour', dataset: { date: j.cle } })),
      ['f-total', 'f-nuit', 'f-dim', 'f-fer'].map((c) => h('td', { class: c }))));
    table.replaceChildren(
      h('colgroup', null, h('col', { class: 'c-agent' }), jours.map(() => h('col')), [1, 2, 3, 4].map(() => h('col', { class: 'c-tot' }))),
      tete, corps, pied);
    if (!p.agents.length) corps.append(h('tr', null, h('td', { colspan: nb + 5, class: 'plan-vide' }, 'Aucun agent sur ce mois : ajoutez-en avec le bouton ci-dessous.')));
    calculer();
  }
  function cellule(a, j) {
    const v = a.jours[j.cle] || '';
    const c = lireCreneau(v);
    const pv = h('span', { class: 'pv' }, apercu(c));
    const td = h('td', { class: ['cell', j.cls, v ? 'has' : '', c?.code ? 'code' : '', c?.err ? 'bad' : ''].filter(Boolean).join(' ') });
    const input = h('input', { value: v, 'aria-label': `${a.nom || 'Agent'} — ${j.d} ${MOIS[mo - 1]}` });
    input.addEventListener('input', () => {
      const val = input.value.trim(), cc = lireCreneau(val);
      if (val) a.jours[j.cle] = val; else delete a.jours[j.cle];
      td.classList.toggle('has', !!val); td.classList.toggle('code', !!cc?.code); td.classList.toggle('bad', !!cc?.err);
      pv.replaceChildren(...apercu(cc));
      calculer(); change();
    });
    input.addEventListener('blur', () => {
      const n = normaliser(lireCreneau(input.value));
      if (n && n !== input.value) { input.value = n; a.jours[j.cle] = n; change(); }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); (td.nextElementSibling?.querySelector('input') || input).focus(); }
    });
    td.append(input, pv);
    return td;
  }
  const hm = (min) => (min ? fmtHeures(min / 60, true) : '–');
  function calculer() {
    const G = totauxDuMois(p, mois, (ai, T) => {
      const tr = $(`tr[data-a="${ai}"]`, table);
      if (!tr) return;
      $('.t-total', tr).textContent = hm(T.total); $('.t-nuit', tr).textContent = hm(T.nuit);
      $('.t-dim', tr).textContent = hm(T.dim); $('.t-fer', tr).textContent = hm(T.fer);
    });
    $$('.f-jour', table).forEach((td) => { td.textContent = G.parJour[td.dataset.date] ? hm(G.parJour[td.dataset.date]) : ''; });
    [['f-total', 'total'], ['f-nuit', 'nuit'], ['f-dim', 'dim'], ['f-fer', 'fer']].forEach(([c, k]) => { const td = $(`.${c}`, table); if (td) td.textContent = hm(G[k]); });
    resume.replaceChildren(
      tuileP('Heures du mois', fmtHeures(G.total / 60)), tuileP('Dont nuit', fmtHeures(G.nuit / 60)),
      tuileP('Dont dimanche', fmtHeures(G.dim / 60)), tuileP('Dont fériés', fmtHeures(G.fer / 60)), tuileP('Agents', String(p.agents.length)));
    return G;
  }
  const tuileP = (l, v) => h('div', { class: 'mini' }, h('span', null, l), h('b', null, v));
  const resume = h('div', { class: 'minis' });

  /* ----- Outils sous la feuille ----- */
  const choixAgent = h('select', { class: 'input input--auto', onchange: () => {
    const val = choixAgent.value;
    choixAgent.value = '';
    if (!val) return;
    const ag = agents.find((x) => String(x.id) === val);
    p.agents.push({ nom: ag ? ag.nom : '', poste: ag ? ag.poste : 'ADS', jours: {} });
    dessiner(); change();
    if (!ag) $$('.agent__nom', table).pop()?.focus();
  } }, h('option', { value: '' }, '+ Ajouter un agent…'), agents.filter((a) => +a.actif).map((a) => h('option', { value: a.id }, `${a.nom} (${a.poste})`)), h('option', { value: 'libre' }, 'Autre (saisie libre)'));
  const nd = h('input', { type: 'time', class: 'input input--auto', value: p.nuitDebut || '21:00', onchange: (e) => { p.nuitDebut = e.target.value || '21:00'; dessiner(); change(); } });
  const nf = h('input', { type: 'time', class: 'input input--auto', value: p.nuitFin || '06:00', onchange: (e) => { p.nuitFin = e.target.value || '06:00'; dessiner(); change(); } });
  const reprendre = h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: async () => {
    const prec = decaler(-1);
    const { planning: pp } = await api('planning', undefined, { mois: prec });
    if (!pp?.agents?.length) return toast('Aucun agent dans le planning du mois précédent.', 'erreur');
    const noms = new Set(p.agents.map((a) => a.nom));
    pp.agents.forEach((a) => { if (!noms.has(a.nom)) p.agents.push({ nom: a.nom, poste: a.poste, jours: {} }); });
    ['client', 'site', 'mission'].forEach((k) => { if (!p[k]) p[k] = pp[k] || ''; });
    champsInfos.forEach((f) => f());
    dessiner(); change();
    toast('Agents du mois précédent repris.');
  } }, 'Reprendre les agents du mois précédent');

  const nav = h('div', { class: 'mois-nav' },
    h('a', { class: 'icon-btn', href: `#/planning/${decaler(-1)}`, 'aria-label': 'Mois précédent' }, icone('retour')),
    h('b', null, libelle),
    h('a', { class: 'icon-btn', href: `#/planning/${decaler(1)}`, 'aria-label': 'Mois suivant' }, icone('suivant')),
    mois !== `${auj.getFullYear()}-${pad(auj.getMonth() + 1)}` ? h('a', { class: 'lien-btn', href: '#/planning' }, 'Revenir au mois en cours') : null);

  const zone = h('div', { class: 'feuille-zone feuille-zone--paysage' }, feuille);
  ctx.afficher(nav, resume, zone,
    h('div', { class: 'plan-outils' }, choixAgent, reprendre, h('label', { class: 'plan-nuit' }, 'Heures de nuit : de ', nd, ' à ', nf)),
    agents.length ? null : h('p', { class: 'astuce' }, 'Astuce : enregistrez vos agents dans la rubrique « Agents » pour les ajouter en un clic.'));
  dessiner();

  function imprimer() {
    const st = document.getElementById('format-page');
    st.textContent = '@page { size: A4 landscape; margin: 0; }';
    const avant = document.title;
    document.title = `Planning ${libelle} - ${p.client || 'BDA'}`;
    window.print();
    document.title = avant;
  }

  async function creerFacture() {
    enregistrer.maintenant();
    const G = calculer();
    if (!G.total) return toast(`Aucune heure saisie en ${libelle}.`, 'erreur');
    const sel = h('select', { class: 'input' }, h('option', { value: '' }, p.client ? `${p.client} (du planning)` : 'Choisir un client…'), clients.map((c) => h('option', { value: c.id }, c.nom)));
    const ok = await modale({
      titre: `Facturer ${libelle}`,
      contenu: [
        h('p', { class: 'modale__texte' }, `Une facture brouillon va être créée avec ${fmtHeures(G.total / 60)} au total (dont ${fmtHeures(G.nuit / 60)} de nuit, ${fmtHeures(G.dim / 60)} le dimanche et ${fmtHeures(G.fer / 60)} fériées).`),
        champ('Client', sel),
      ],
      actions: [{ libelle: 'Annuler', classe: 'btn--ghost', valeur: false }, { libelle: 'Créer la facture', classe: 'btn--gold', valeur: true, submit: true }],
    });
    if (!ok) return;
    try {
      const { nouveauDocument, ROLES } = await import('./documents.js');
      const { numero } = await api('numero', undefined, { type: 'facture' });
      const f = nouveauDocument('facture', reglages, numero);
      const c = clients.find((x) => String(x.id) === sel.value);
      f.client = c ? { nom: c.nom, adresse: [c.adresse, c.tel ? `TÉL : ${c.tel}` : ''].filter(Boolean).join('\n') } : { nom: p.client || '', adresse: p.site || '' };
      f.periode = libelle;
      const heures = { base: G.total, nuit: G.nuit, dimanche: G.dim, ferie: G.fer };
      f.lignes = Object.entries(ROLES).map(([role, designation]) => ({ designation, qte: heures[role] / 60, unite: 'h', pu: role === 'base' ? +reglages.tauxHoraire || 0 : 0, role }));
      const res = await api('document.enregistrer', { type: 'facture', statut: 'brouillon', data: f });
      toast(`Facture ${res.numero} créée.`);
      ctx.aller(`#/factures/${res.id}`);
    } catch (e) { erreur(e); }
  }
}
