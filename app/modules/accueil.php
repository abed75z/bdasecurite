<?php
/* =========================================================
   MODULE « ACCUEIL » — la Vue générale à la carte
   Chaque compte de l'admin choisit les blocs affichés et leur ordre (chiffres du jour,
   priorités, terrain, à traiter, domaines). Gardé côté serveur : le même accueil sur
   l'ordinateur et sur le téléphone.
   ========================================================= */
declare(strict_types=1);

const MOD_ACCUEIL_BLOCS = ['kpis', 'priorites', 'terrain', 'traiter', 'domaines'];

function module_accueil(): array
{
  return [
    'titre' => 'Accueil à la carte',
    'admin' => [
      'prefs' => ['methode' => 'GET', 'roles' => ['admin', 'manager'], 'fn' => 'mod_accueil_adm_prefs'],
      'prefs.enregistrer' => ['methode' => 'POST', 'roles' => ['admin', 'manager'], 'fn' => 'mod_accueil_adm_enregistrer'],
    ],
  ];
}

function mod_accueil_cle(): string
{
  return 'u:' . preg_replace('/[^a-z0-9_.-]/i', '', (string)($_SESSION['login'] ?? 'compte'));
}
function mod_accueil_nettoyer($p): array
{
  $p = is_array($p) ? $p : [];
  $ordre = array_values(array_unique(array_filter((array)($p['ordre'] ?? []), fn ($b) => in_array($b, MOD_ACCUEIL_BLOCS, true))));
  foreach (MOD_ACCUEIL_BLOCS as $b) if (!in_array($b, $ordre, true)) $ordre[] = $b; // nouveaux blocs : ajoutés à la fin
  $masques = array_values(array_unique(array_filter((array)($p['masques'] ?? []), fn ($b) => in_array($b, MOD_ACCUEIL_BLOCS, true))));
  return ['ordre' => $ordre, 'masques' => $masques];
}
function mod_accueil_adm_prefs(): void
{
  repondre(['ok' => true, 'prefs' => mod_accueil_nettoyer(mod_reglage('accueil', mod_accueil_cle(), []))]);
}
function mod_accueil_adm_enregistrer(): void
{
  $p = mod_accueil_nettoyer(corps());
  if (count($p['masques']) >= count(MOD_ACCUEIL_BLOCS)) throw new RuntimeException('Gardez au moins un bloc sur l’accueil.');
  mod_reglage_ecrire('accueil', mod_accueil_cle(), $p);
  repondre(['ok' => true, 'prefs' => $p]);
}
