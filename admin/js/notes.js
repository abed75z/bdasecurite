/* =========================================================
   ESPACE ADMIN BDA — Notes
   Écrire vite : une grande zone de saisie (Ctrl + Entrée pour
   enregistrer), puis des notes modifiables sur place, enregistrées
   toutes seules, à épingler (visibles sur l'accueil) et à colorer.
   ========================================================= */
import { api, h, icone, toast, erreur, confirmer, attendre, ilYa } from './outils.js';

const COULEURS = ['', 'or', 'bleu', 'vert', 'rouge', 'violet'];
const sansAccent = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const compter = (t) => { const mots = (t.trim().match(/\S+/g) || []).length; return `${mots} mot${mots > 1 ? 's' : ''} · ${t.length} caractère${t.length > 1 ? 's' : ''}`; };
const ajusterHauteur = (ta) => { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight + 2}px`; };

export async function pageNotes(ctx) {
  ctx.titre('Notes');
  let { notes } = await api('notes');
  let filtre = 'toutes', recherche = '';
  const cible = /^\d+$/.test(ctx.params[0] || '') ? +ctx.params[0] : 0;

  /* ----- Zone d'écriture ----- */
  let couleur = '', epingle = false;
  const saisie = h('textarea', { class: 'ecrire__zone', rows: 4, placeholder: 'Écrivez ici… une idée, un rappel, un compte rendu de mission. Ctrl + Entrée pour enregistrer.', spellcheck: 'true' });
  const compteur = h('span', { class: 'ecrire__compteur' }, compter(''));
  const pastilles = h('div', { class: 'couleurs', role: 'radiogroup', 'aria-label': 'Couleur de la note' });
  const dessinerPastilles = () => pastilles.replaceChildren(...COULEURS.map((c) => h('button', { type: 'button', class: `couleur couleur--${c || 'aucune'} ${c === couleur ? 'is-actif' : ''}`, role: 'radio', 'aria-checked': c === couleur ? 'true' : 'false', 'aria-label': c || 'Sans couleur', onclick: () => { couleur = c; dessinerPastilles(); } })));
  dessinerPastilles();
  const boutonEpingle = h('button', { type: 'button', class: 'btn btn--ghost btn--petit', 'aria-pressed': 'false', onclick: () => { epingle = !epingle; boutonEpingle.classList.toggle('is-actif', epingle); boutonEpingle.setAttribute('aria-pressed', String(epingle)); } }, icone('epingle'), 'Épingler sur l’accueil');
  const enregistrerNouvelle = async () => {
    const texte = saisie.value.trim();
    if (!texte) return saisie.focus();
    try {
      const { note } = await api('note.enregistrer', { texte, couleur, epingle });
      notes.unshift(note);
      notes.sort((a, b) => b.epingle - a.epingle);
      saisie.value = '';
      ajusterHauteur(saisie);
      compteur.textContent = compter('');
      toast('Note enregistrée.');
      dessiner();
      saisie.focus();
    } catch (e) { erreur(e); }
  };
  saisie.addEventListener('input', () => { ajusterHauteur(saisie); compteur.textContent = compter(saisie.value); });
  saisie.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); enregistrerNouvelle(); } });
  const ecrire = h('section', { class: 'carte ecrire' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Écrire une note'), h('small', null, 'Astuce : depuis n’importe quelle page, Ctrl + K puis « note … »')),
    saisie,
    h('div', { class: 'ecrire__barre' }, pastilles, boutonEpingle, compteur,
      h('button', { class: 'btn btn--gold', type: 'button', onclick: enregistrerNouvelle }, icone('coche'), 'Enregistrer', h('kbd', null, 'Ctrl ↵'))));

  /* ----- Liste ----- */
  const grille = h('div', { class: 'notes' });
  const chips = h('div', { class: 'chips' });
  const rech = h('input', { class: 'input input--recherche', type: 'search', placeholder: 'Chercher dans mes notes…', oninput: (e) => { recherche = e.target.value; dessiner(); } });

  function carteNote(n) {
    const ta = h('textarea', { class: 'note__texte', spellcheck: 'true', 'aria-label': 'Texte de la note' });
    ta.value = n.texte;
    const etat = h('span', { class: 'note__etat' }, `modifiée ${ilYa(n.maj)}`);
    const sauver = attendre(async () => {
      try { const { note } = await api('note.enregistrer', { id: n.id, texte: n.texte, couleur: n.couleur, epingle: !!n.epingle }); Object.assign(n, note); etat.textContent = '✓ enregistrée'; } catch (e) { etat.textContent = 'non enregistrée'; erreur(e); }
    }, 700);
    ta.addEventListener('input', () => { n.texte = ta.value; etat.textContent = 'modification…'; ajusterHauteur(ta); sauver(); });
    const el = h('article', { class: `note note--${n.couleur || 'aucune'} ${n.epingle ? 'is-epingle' : ''}`, id: `note-${n.id}` },
      n.epingle ? h('span', { class: 'note__epingle', title: 'Épinglée sur l’accueil' }, icone('epingle')) : null,
      ta,
      h('footer', { class: 'note__pied' }, etat,
        h('div', { class: 'note__outils' },
          h('button', { type: 'button', class: 'icon-btn', title: n.epingle ? 'Désépingler' : 'Épingler sur l’accueil', 'aria-label': n.epingle ? 'Désépingler' : 'Épingler', onclick: async () => { n.epingle = n.epingle ? 0 : 1; await maj(n); } }, icone('epingle')),
          h('button', { type: 'button', class: 'icon-btn', title: 'Changer la couleur', 'aria-label': 'Changer la couleur', onclick: async () => { n.couleur = COULEURS[(COULEURS.indexOf(n.couleur || '') + 1) % COULEURS.length]; await maj(n); } }, h('span', { class: `couleur couleur--${n.couleur || 'aucune'} couleur--mini` })),
          h('button', { type: 'button', class: 'icon-btn', title: 'Copier le texte', 'aria-label': 'Copier', onclick: async () => { try { await navigator.clipboard.writeText(n.texte); toast('Texte copié.'); } catch (e) { erreur(e); } } }, icone('copier')),
          h('button', { type: 'button', class: 'icon-btn icon-btn--danger', title: 'Supprimer', 'aria-label': 'Supprimer', onclick: async () => {
            if (!(await confirmer('Supprimer cette note ?', { ok: 'Supprimer', danger: true }))) return;
            try { await api('note.supprimer', { id: n.id }); notes = notes.filter((x) => x !== n); dessiner(); toast('Note supprimée.'); } catch (e) { erreur(e); }
          } }, icone('poubelle')))));
    requestAnimationFrame(() => ajusterHauteur(ta));
    return el;
  }
  async function maj(n) {
    try { const { note } = await api('note.enregistrer', { id: n.id, texte: n.texte, couleur: n.couleur, epingle: !!n.epingle }); Object.assign(n, note); notes.sort((a, b) => b.epingle - a.epingle || String(b.maj).localeCompare(String(a.maj))); dessiner(); } catch (e) { erreur(e); }
  }
  function dessiner() {
    const q = sansAccent(recherche);
    const visibles = notes.filter((n) => (filtre === 'toutes' || n.epingle) && (!q || sansAccent(n.texte).includes(q)));
    const nb = { toutes: notes.length, epinglees: notes.filter((n) => n.epingle).length };
    chips.replaceChildren(...[['toutes', 'Toutes'], ['epinglees', 'Épinglées']].map(([k, lib]) => h('button', { type: 'button', class: `chip ${filtre === k ? 'is-actif' : ''}`, onclick: () => { filtre = k; dessiner(); } }, lib, h('span', null, nb[k]))));
    grille.replaceChildren(...(visibles.length ? visibles.map(carteNote) : [h('div', { class: 'vide' }, icone('crayon'), h('p', null, notes.length ? 'Aucune note ne correspond.' : 'Aucune note pour le moment. Écrivez la première juste au-dessus !'))]));
  }

  ctx.afficher(ecrire, h('section', { class: 'carte' }, h('div', { class: 'carte__outils' }, chips, h('div', { class: 'recherche' }, icone('recherche'), rech)), grille));
  dessiner();
  if (cible) {
    const el = document.getElementById(`note-${cible}`);
    if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('is-cible'); el.querySelector('textarea')?.focus(); }
  } else saisie.focus();
}
