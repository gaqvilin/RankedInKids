// Feature switches. Adult leagues (SPL) are built but not launched yet:
// set VITE_ADULT_LEAGUES=1 in Vercel to show them on the start page.
export const ADULT_LEAGUES = import.meta.env.VITE_ADULT_LEAGUES === '1';
