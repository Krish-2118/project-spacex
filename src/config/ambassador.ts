/**
 * Campus Ambassador programme: the home page's Campus Ambassador section (APPLY and GET MY CODE), the CA- codes
 * registrants may enter (supabase/schema.sql, section 16) and the admin dashboard's AMBASSADORS tab.
 *
 * AMBASSADOR_FORM_URL is the organisers' Google Form that APPLY opens. It only collects applications for the team's own
 * records: GET MY CODE gives any signed-in student their code whether or not they filled it in, and nothing reads the
 * responses. Set it to '' to show "APPLICATIONS OPEN SOON" (disabled) instead; GET MY CODE works either way.
 */
export const AMBASSADOR_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSeYhrbZ0vrAdlSyShN7FUV_MfxNogBVWcKmPzcxzORCYcBMFQ/viewform';

/** Home page section id (data-sec) and route: #/ambassador scrolls there. */
export const AMBASSADOR_SECTION = 'ambassador';
