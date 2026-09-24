/* =========================================================
   ESPACE ADMIN BDA — QR code (texte ou lien → SVG)
   Norme ISO 18004 : mode octets, correction d'erreur « M »,
   versions 1 à 10 (jusqu'à ~210 caractères).
   ========================================================= */

// Codes correcteurs par bloc et nombre de blocs (niveau M), versions 1 à 10
const ECC_PAR_BLOC = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const NB_BLOCS = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5];

const bit = (x, i) => ((x >>> i) & 1) !== 0;

function modulesDonnees(ver) {
  let n = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const na = Math.floor(ver / 7) + 2;
    n -= (25 * na - 10) * na - 55;
    if (ver >= 7) n -= 36;
  }
  return n;
}
const capacite = (ver) => Math.floor(modulesDonnees(ver) / 8) - ECC_PAR_BLOC[ver - 1] * NB_BLOCS[ver - 1];

/* ---------- Reed-Solomon sur GF(256) ---------- */
function mul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}
function diviseur(degre) {
  const r = new Array(degre).fill(0);
  r[degre - 1] = 1;
  let racine = 1;
  for (let i = 0; i < degre; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = mul(r[j], racine);
      if (j + 1 < r.length) r[j] ^= r[j + 1];
    }
    racine = mul(racine, 0x02);
  }
  return r;
}
function reste(data, div) {
  const r = div.map(() => 0);
  for (const b of data) {
    const f = b ^ r.shift();
    r.push(0);
    div.forEach((c, i) => { r[i] ^= mul(c, f); });
  }
  return r;
}

/* ---------- Construction ---------- */
export function qrMatrice(texte, masqueImpose) {
  const octets = [...new TextEncoder().encode(texte)];
  let ver = 1;
  const bitsNeeded = (v) => 4 + (v < 10 ? 8 : 16) + octets.length * 8;
  while (ver <= 10 && bitsNeeded(ver) > capacite(ver) * 8) ver++;
  if (ver > 10) throw new Error('Lien trop long pour le QR code.');

  // Flux de bits : mode octets (0100), longueur, données, terminaison, remplissage
  const bits = [];
  const ajouter = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  ajouter(4, 4);
  ajouter(octets.length, ver < 10 ? 8 : 16);
  octets.forEach((o) => ajouter(o, 8));
  const cap = capacite(ver) * 8;
  ajouter(0, Math.min(4, cap - bits.length));
  ajouter(0, (8 - (bits.length % 8)) % 8);
  for (let p = 0xec; bits.length < cap; p ^= 0xec ^ 0x11) ajouter(p, 8);
  const donnees = [];
  for (let i = 0; i < bits.length; i += 8) donnees.push(parseInt(bits.slice(i, i + 8).join(''), 2));

  // Blocs + codes correcteurs, puis entrelacement
  const nbBlocs = NB_BLOCS[ver - 1], eccLen = ECC_PAR_BLOC[ver - 1];
  const brut = Math.floor(modulesDonnees(ver) / 8);
  const courts = nbBlocs - (brut % nbBlocs), lgCourt = Math.floor(brut / nbBlocs);
  const div = diviseur(eccLen);
  const blocs = [];
  for (let i = 0, k = 0; i < nbBlocs; i++) {
    const dat = donnees.slice(k, k + lgCourt - eccLen + (i < courts ? 0 : 1));
    k += dat.length;
    const ecc = reste(dat, div);
    if (i < courts) dat.push(0);
    blocs.push(dat.concat(ecc));
  }
  const mots = [];
  for (let i = 0; i < blocs[0].length; i++) {
    blocs.forEach((b, j) => { if (i !== lgCourt - eccLen || j >= courts) mots.push(b[i]); });
  }

  // Matrice et motifs fixes
  const taille = ver * 4 + 17;
  const m = Array.from({ length: taille }, () => new Array(taille).fill(false));
  const fixe = Array.from({ length: taille }, () => new Array(taille).fill(false));
  const poser = (x, y, v) => { m[y][x] = v; fixe[y][x] = true; };
  for (let i = 0; i < taille; i++) { poser(6, i, i % 2 === 0); poser(i, 6, i % 2 === 0); }
  const reperage = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
      if (x >= 0 && x < taille && y >= 0 && y < taille) poser(x, y, d !== 2 && d !== 4);
    }
  };
  reperage(3, 3); reperage(taille - 4, 3); reperage(3, taille - 4);
  if (ver > 1) {
    const na = Math.floor(ver / 7) + 2;
    const pas = Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2;
    const pos = [6];
    for (let p = taille - 7; pos.length < na; p -= pas) pos.splice(1, 0, p);
    pos.forEach((y, i) => pos.forEach((x, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) poser(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));
  }
  const format = (masque) => {
    const d = (0 << 3) | masque; // niveau M = 00
    let r = d;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412;
    for (let i = 0; i <= 5; i++) poser(8, i, bit(b, i));
    poser(8, 7, bit(b, 6)); poser(8, 8, bit(b, 7)); poser(7, 8, bit(b, 8));
    for (let i = 9; i < 15; i++) poser(14 - i, 8, bit(b, i));
    for (let i = 0; i < 8; i++) poser(taille - 1 - i, 8, bit(b, i));
    for (let i = 8; i < 15; i++) poser(8, taille - 15 + i, bit(b, i));
    poser(8, taille - 8, true);
  };
  format(0);
  if (ver >= 7) {
    let r = ver;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const b = (ver << 12) | r;
    for (let i = 0; i < 18; i++) {
      const a = taille - 11 + (i % 3), c = Math.floor(i / 3);
      poser(a, c, bit(b, i)); poser(c, a, bit(b, i));
    }
  }

  // Placement des données en zigzag
  let i = 0;
  for (let droite = taille - 1; droite >= 1; droite -= 2) {
    if (droite === 6) droite = 5;
    for (let v = 0; v < taille; v++) {
      for (let j = 0; j < 2; j++) {
        const x = droite - j, monte = ((droite + 1) & 2) === 0, y = monte ? taille - 1 - v : v;
        if (!fixe[y][x] && i < mots.length * 8) { m[y][x] = bit(mots[i >>> 3], 7 - (i & 7)); i++; }
      }
    }
  }

  // Masque : on garde celui qui donne le code le plus lisible
  const MASQUES = [
    (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];
  const appliquer = (k) => { for (let y = 0; y < taille; y++) for (let x = 0; x < taille; x++) if (!fixe[y][x] && MASQUES[k](x, y)) m[y][x] = !m[y][x]; };
  let meilleur = 0, score = Infinity;
  for (let k = 0; k < 8; k++) {
    appliquer(k); format(k);
    const s = penalite(m);
    if (s < score) { score = s; meilleur = k; }
    appliquer(k);
  }
  if (masqueImpose !== undefined) meilleur = masqueImpose;
  appliquer(meilleur); format(meilleur);
  return m;
}

// Pénalités de la norme (séries, blocs 2×2, motifs trompeurs, équilibre)
function penalite(m) {
  const n = m.length;
  let s = 0;
  const lignes = (get) => {
    for (let a = 0; a < n; a++) {
      let run = 1;
      const seq = [];
      for (let b = 0; b < n; b++) seq.push(get(a, b) ? 1 : 0);
      for (let b = 1; b <= n; b++) {
        if (b < n && seq[b] === seq[b - 1]) run++;
        else { if (run >= 5) s += run - 2; run = 1; }
      }
      const txt = seq.join('');
      for (const motif of ['10111010000', '00001011101']) {
        let p = txt.indexOf(motif);
        while (p !== -1) { s += 40; p = txt.indexOf(motif, p + 1); }
      }
    }
  };
  lignes((a, b) => m[a][b]);
  lignes((a, b) => m[b][a]);
  let noirs = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (m[y][x]) noirs++;
    if (x < n - 1 && y < n - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) s += 3;
  }
  s += Math.floor(Math.abs(noirs * 20 - n * n * 10) / (n * n)) * 10;
  return s;
}

// QR code en SVG (vectoriel : net à l'impression), marge de 4 modules
export function qrSvg(texte, couleur = '#0b0b0d') {
  const m = qrMatrice(texte);
  const n = m.length, t = n + 8;
  let d = '';
  m.forEach((ligne, y) => ligne.forEach((v, x) => { if (v) d += `M${x + 4} ${y + 4}h1v1h-1z`; }));
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${t} ${t}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `QR code : ${texte}`);
  const fond = document.createElementNS(svg.namespaceURI, 'rect');
  fond.setAttribute('width', t); fond.setAttribute('height', t); fond.setAttribute('fill', '#fff');
  const p = document.createElementNS(svg.namespaceURI, 'path');
  p.setAttribute('d', d); p.setAttribute('fill', couleur);
  svg.append(fond, p);
  return svg;
}
