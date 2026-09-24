/**
 * BDA — Avis clients stockés dans Google Sheets
 * ------------------------------------------------------------
 * À coller dans : Google Sheets > Extensions > Apps Script
 * (voir le README du site, rubrique « Activer les avis clients »).
 *
 * Fonctionnement :
 *  - chaque avis envoyé depuis le site arrive dans l'onglet « Avis »
 *    avec « Publié » = NON, et vous recevez un email ;
 *  - pour publier un avis sur le site, remplacez NON par OUI ;
 *  - pour le retirer, remettez NON (ou supprimez la ligne).
 */

const ONGLET = 'Avis';
const EMAIL_NOTIFICATION = 'bdasecurite@gmail.com';

/* Lecture des avis publiés (appelée par la page Avis du site) */
function doGet() {
  const lignes = feuille_().getDataRange().getValues().slice(1);
  const avis = lignes
    .filter((l) => String(l[5]).trim().toUpperCase() === 'OUI')
    .map((l) => ({
      date: l[0] instanceof Date ? l[0].toISOString() : String(l[0]),
      nom: String(l[1]),
      note: Number(l[2]) || 0,
      prestation: String(l[3]),
      texte: String(l[4]),
    }))
    .filter((a) => a.note >= 1 && a.note <= 5)
    .reverse();
  return json_({ ok: true, avis: avis });
}

/* Réception d'un nouvel avis (non publié tant que vous n'avez pas mis OUI) */
function doPost(e) {
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (d.site_web) return json_({ ok: true }); // champ piège anti-robots

    const nom = propre_(d.nom, 60);
    const note = Math.max(0, Math.min(5, parseInt(d.note, 10) || 0));
    const prestation = propre_(d.prestation, 80);
    const texte = propre_(d.texte, 1200);
    const email = propre_(d.email, 120);
    if (nom.length < 2 || texte.length < 10 || note < 1) return json_({ ok: false, error: 'invalide' });

    const verrou = LockService.getScriptLock();
    verrou.waitLock(10000);
    try {
      feuille_().appendRow([new Date(), nom, note, prestation, texte, 'NON', email]);
    } finally {
      verrou.releaseLock();
    }

    MailApp.sendEmail({
      to: EMAIL_NOTIFICATION,
      subject: 'Nouvel avis ' + '★'.repeat(note) + ' de ' + nom + ' — à valider',
      body: 'Nouvel avis reçu sur le site BDA.\n\n'
        + 'Nom : ' + nom + '\nNote : ' + note + '/5\nPrestation : ' + (prestation || '—')
        + '\nEmail : ' + (email || 'non communiqué') + '\n\n' + texte
        + '\n\nPour le publier : ouvrez votre tableau Google Sheets et mettez OUI dans la colonne « Publié ».',
    });
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* ---------- Outils ---------- */
function feuille_() {
  const classeur = SpreadsheetApp.getActiveSpreadsheet();
  let f = classeur.getSheetByName(ONGLET);
  if (!f) {
    f = classeur.insertSheet(ONGLET);
    f.appendRow(['Date', 'Nom', 'Note (1 à 5)', 'Prestation', 'Avis', 'Publié (OUI/NON)', 'Email (privé)']);
    f.setFrozenRows(1);
    f.getRange('A1:G1').setFontWeight('bold');
    f.getRange('F2:F1000').setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['OUI', 'NON'], true).build()
    );
    f.setColumnWidth(5, 420);
  }
  return f;
}

// Nettoie le texte et empêche qu'il soit interprété comme une formule par Google Sheets
function propre_(valeur, max) {
  let s = String(valeur || '').replace(/\s+/g, ' ').trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function json_(objet) {
  return ContentService.createTextOutput(JSON.stringify(objet)).setMimeType(ContentService.MimeType.JSON);
}

/* À lancer une fois (bouton ▶ Exécuter) pour créer l'onglet et autoriser l'envoi d'emails */
function installer() {
  feuille_();
}
