/**
 * Campus Ambassador programme: the home page's Campus Ambassador section (APPLY and GET MY CODE), the CA- codes
 * registrants may enter (supabase/schema.sql, section 16) and the admin dashboard's AMBASSADORS tab.
 *
 * AMBASSADOR_FORM_URL is the organisers' Google Form that APPLY opens. It only collects applications for the team's own
 * records: GET MY CODE gives any signed-in student their code whether or not they filled it in, and nothing reads the
 * responses. PLACEHOLDER: while it is empty, APPLY shows "APPLICATIONS OPEN SOON" (disabled); GET MY CODE works either
 * way. When the organisers share the form, paste its link here (e.g. 'https://forms.gle/...').
 */
export const AMBASSADOR_FORM_URL = '';

/** Home page section id (data-sec) and route: #/ambassador scrolls there. */
export const AMBASSADOR_SECTION = 'ambassador';
