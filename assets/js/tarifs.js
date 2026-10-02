/* =========================================================
   TARIFS — estimation immédiate d'une mission de sécurité
   (taux horaire × agents × heures, majorations nuit / dimanche / férié).
   Les prix et majorations viennent de l'admin (Contenu du site).
   ========================================================= */
(() => {
  const form = document.getElementById('calc');
  if (!form) return;
  const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
  const ht = document.getElementById('calc-ht');
  const ttc = document.getElementById('calc-ttc');
  const devis = document.getElementById('calc-devis');
  const SERVICE = { agent: 'gardiennage', evenementiel: 'evenementiel', ssiap1: 'gardiennage', ssiap2: 'gardiennage', ssiap3: 'gardiennage', protection: 'protection' };
  const NOMS = { agent: 'Agent de sécurité', evenementiel: 'Sécurité événementielle', ssiap1: 'SSIAP 1', ssiap2: 'SSIAP 2', ssiap3: 'SSIAP 3', protection: 'Protection rapprochée' };
  let maj = { nuit: 10, dimanche: 10, ferie: 100 };

  function calculer() {
    const opt = form.type.selectedOptions[0];
    const taux = parseFloat(form.type.value) || 0;
    const agents = Math.min(50, Math.max(1, parseInt(form.agents.value, 10) || 1));
    const heures = Math.min(744, Math.max(1, parseFloat(form.heures.value) || 0));
    // Le jour férié remplace la majoration du dimanche
    const coef = 1 + (form.nuit.checked ? maj.nuit / 100 : 0) + (form.ferie.checked ? maj.ferie / 100 : (form.dimanche.checked ? maj.dimanche / 100 : 0));
    const total = Math.round(taux * coef * agents * heures * 100) / 100;
    ht.textContent = euro.format(total);
    ttc.textContent = euro.format(Math.round(total * 120) / 100);
    devis.href = `devis?service=${SERVICE[opt?.dataset.cle] || 'gardiennage'}`;
  }

  // Prix réglés dans l'admin
  document.addEventListener('bda:contenu', (e) => {
    const t = e.detail.tarifs || {};
    form.type.querySelectorAll('option[data-cle]').forEach((o) => {
      const v = t[o.dataset.cle];
      if (typeof v !== 'number') return;
      o.value = String(v);
      o.textContent = `${NOMS[o.dataset.cle]} · ${euro.format(v)} HT/h`;
    });
    ['nuit', 'dimanche', 'ferie'].forEach((k) => { if (typeof t[k] === 'number') maj[k] = t[k]; });
    const l = form.querySelector('[name="nuit"] + span');
    if (l) l.textContent = `De nuit (+${maj.nuit} %)`;
    const d = form.querySelector('[name="dimanche"] + span');
    if (d) d.textContent = `Un dimanche (+${maj.dimanche} %)`;
    const f = form.querySelector('[name="ferie"] + span');
    if (f) f.textContent = `Un jour férié (+${maj.ferie} %)`;
    calculer();
  });
  form.addEventListener('input', calculer);
  form.addEventListener('change', calculer);
  calculer();
})();
