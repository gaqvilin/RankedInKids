// Feature switches. Adult leagues (SPL) are on; set VITE_ADULT_LEAGUES=0 in
// Vercel to hide them again.
export const ADULT_LEAGUES = import.meta.env.VITE_ADULT_LEAGUES !== '0';
