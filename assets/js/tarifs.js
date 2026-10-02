/* =========================================================
   TARIFS — estimation immédiate d'une mission de sécurité
   (taux horaire × agents × heures, majorations nuit / dimanche / férié)
   ========================================================= */
(() => {
  const form = document.getElementById('calc');
  if (!form) return;
  const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
  const ht = document.getElementById('calc-ht');
  const ttc = document.getElementById('calc-ttc');
  const devis = document.getElementById('calc-devis');
  const SERVICE = { 22: 'gardiennage', 24: 'evenementiel', 23.5: 'gardiennage', 26.5: 'gardiennage', 34: 'gardiennage', 55: 'protection' };

  function calculer() {
    const taux = parseFloat(form.type.value) || 0;
    const agents = Math.min(50, Math.max(1, parseInt(form.agents.value, 10) || 1));
    const heures = Math.min(744, Math.max(1, parseFloat(form.heures.value) || 0));
    // Majorations : nuit +10 %, dimanche +10 %, jour férié +100 % (remplace celle du dimanche)
    const coef = 1 + (form.nuit.checked ? 0.1 : 0) + (form.ferie.checked ? 1 : (form.dimanche.checked ? 0.1 : 0));
    const total = Math.round(taux * coef * agents * heures * 100) / 100;
    ht.textContent = euro.format(total);
    ttc.textContent = euro.format(Math.round(total * 120) / 100);
    devis.href = `devis?service=${SERVICE[taux] || 'gardiennage'}`;
  }
  form.addEventListener('input', calculer);
  form.addEventListener('change', calculer);
  calculer();
})();
