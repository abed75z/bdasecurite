/* =========================================================
   ESPACE ADMIN BDA — téléchargement direct en PDF
   La feuille est photographiée en haute définition (html2canvas),
   puis rangée dans un vrai fichier PDF A4 (une ou plusieurs pages).
   ========================================================= */
import { toast, erreur } from './outils.js';

let chargement = null;
function html2canvas() {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  chargement = chargement || new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = 'js/vendor/html2canvas.min.js';
    s.onload = () => ok(window.html2canvas);
    s.onerror = () => { chargement = null; ko(new Error('Module PDF indisponible. Réessayez.')); };
    document.head.append(s);
  });
  return chargement;
}

const A4 = { l: 595.28, h: 841.89 }; // en points PDF

// Photo d'un élément, avec le même rendu qu'à l'impression (sans boutons ni cadres de saisie)
async function capturer(el, scale) {
  const h2c = await html2canvas();
  await document.fonts.ready;
  const zoom = el.style.zoom;
  el.style.zoom = '';
  try {
    return await h2c(el, {
      scale, backgroundColor: '#ffffff', useCORS: true, logging: false, windowWidth: 1600,
      onclone: (doc, clone) => {
        doc.body.classList.add('capture-pdf');
        clone.style.zoom = '';
        clone.querySelectorAll('[data-ph]').forEach((e) => { if (!e.textContent.trim()) e.setAttribute('data-ph', ''); });
        // Photos recadrées (object-fit) : converties en fond d'image, que html2canvas sait dessiner
        clone.querySelectorAll('img').forEach((img) => {
          const cs = doc.defaultView.getComputedStyle(img);
          if (cs.objectFit !== 'cover') return;
          const div = doc.createElement('div');
          div.style.cssText = `width:100%;height:100%;background:url("${img.src}") ${cs.objectPosition}/cover no-repeat;transform:${cs.transform};transform-origin:${cs.transformOrigin}`;
          img.replaceWith(div);
        });
        doc.body.replaceChildren(clone);
      },
    });
  } finally { el.style.zoom = zoom; }
}
function enregistrer(blob, nomFichier) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${nomFichier.replace(/[\\/:*?"<>|]+/g, '-').trim()}.pdf`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// Feuille A4 (devis, facture, planning) : coupée en plusieurs pages si elle dépasse
export async function telechargerPdf(feuille, nomFichier, { paysage = false } = {}) {
  const attente = toast('Préparation du PDF…', 'ok');
  try {
    const canvas = await capturer(feuille, 2.5);
    const W = paysage ? A4.h : A4.l, H = paysage ? A4.l : A4.h;
    enregistrer(fabriquerPdf(await Promise.all(decouper(canvas, H / W).map(enJpeg)), W, H), nomFichier);
    toast('PDF téléchargé.');
  } catch (e) {
    erreur(e);
  } finally {
    attente?.remove?.();
  }
}

// Pages déjà mises en forme (planches de cartes, flyer…) : une page PDF par élément
// taille en millimètres, ex. { l: 210, h: 297 }
export async function telechargerPages(pages, nomFichier, tailleMm, scale = 2.5) {
  const attente = toast('Préparation du PDF…', 'ok');
  const scene = document.createElement('div');
  scene.style.cssText = 'position:fixed;left:-20000px;top:0;pointer-events:none';
  scene.append(...pages);
  document.body.append(scene);
  try {
    const images = [];
    for (const p of pages) images.push(await enJpeg(await capturer(p, scale)));
    const pt = (mm) => (mm * 72) / 25.4;
    enregistrer(fabriquerPdf(images, pt(tailleMm.l), pt(tailleMm.h)), nomFichier);
    toast('PDF téléchargé.');
  } catch (e) {
    erreur(e);
  } finally {
    scene.remove();
    attente?.remove?.();
  }
}

// Une feuille plus longue qu'une page est coupée en plusieurs pages
function decouper(canvas, ratio) {
  const hauteurPage = Math.round(canvas.width * ratio);
  const n = Math.max(1, Math.ceil((canvas.height - hauteurPage * 0.02) / hauteurPage));
  return Array.from({ length: n }, (_, i) => {
    const c = document.createElement('canvas');
    c.width = canvas.width;
    c.height = hauteurPage;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(canvas, 0, -i * hauteurPage);
    return c;
  });
}
async function enJpeg(c) {
  const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.92));
  return { octets: new Uint8Array(await blob.arrayBuffer()), l: c.width, h: c.height };
}

// Petit générateur de PDF : une image JPEG pleine page par page
function fabriquerPdf(images, W, H) {
  const enc = new TextEncoder();
  const morceaux = [];
  const positions = [];
  let taille = 0;
  const ecrire = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; morceaux.push(b); taille += b.length; };
  const objet = (n, contenu) => { positions[n] = taille; ecrire(`${n} 0 obj\n`); contenu(); ecrire('\nendobj\n'); };

  ecrire('%PDF-1.4\n');
  ecrire(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  const kids = images.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  objet(1, () => ecrire('<< /Type /Catalog /Pages 2 0 R >>'));
  objet(2, () => ecrire(`<< /Type /Pages /Kids [${kids}] /Count ${images.length} >>`));
  images.forEach((img, i) => {
    const p = 3 + i * 3;
    const f = (v) => v.toFixed(2);
    const dessin = `q ${f(W)} 0 0 ${f(H)} 0 0 cm /Im0 Do Q`;
    objet(p, () => ecrire(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(W)} ${f(H)}] /Resources << /XObject << /Im0 ${p + 2} 0 R >> >> /Contents ${p + 1} 0 R >>`));
    objet(p + 1, () => ecrire(`<< /Length ${dessin.length} >>\nstream\n${dessin}\nendstream`));
    objet(p + 2, () => {
      ecrire(`<< /Type /XObject /Subtype /Image /Width ${img.l} /Height ${img.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.octets.length} >>\nstream\n`);
      ecrire(img.octets);
      ecrire('\nendstream');
    });
  });
  const nb = 3 + images.length * 3;
  const debutXref = taille;
  let xref = `xref\n0 ${nb}\n0000000000 65535 f \n`;
  for (let i = 1; i < nb; i++) xref += `${String(positions[i]).padStart(10, '0')} 00000 n \n`;
  ecrire(xref);
  ecrire(`trailer\n<< /Size ${nb} /Root 1 0 R >>\nstartxref\n${debutXref}\n%%EOF\n`);
  return new Blob(morceaux, { type: 'application/pdf' });
}
