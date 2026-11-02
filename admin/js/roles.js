/* =========================================================
   ESPACE ADMIN BDA — rôles côté interface
   Qui voit quelle entrée de menu. Le serveur reste le seul juge
   (app/auth.php : action_autorisee) ; ici on masque seulement ce qui
   serait refusé. admin = tout ; manager = tout sauf les entrées « admin ».
   ========================================================= */
export const LIBELLES_ROLES = { admin: 'Administrateur', manager: 'Manager' };

// Une entrée de menu { admin?: true, roles?: ['admin', …] } est-elle visible pour ce rôle ?
export function menuVisible(m, role) {
  if (Array.isArray(m.roles)) return m.roles.includes(role);
  return !m.admin || role === 'admin';
}
export const libelleRole = (role) => LIBELLES_ROLES[role] || 'Administrateur';
