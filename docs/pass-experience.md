# Registration, payment approval and INNO pass

The live flow is Google login → participant details → payment QR → screenshot and 12-digit UTR → pending team review → approved pass. College and roll number are entered by the participant. College is never inferred from their email. Financial approval always comes from the authenticated backend.

## Reviewer preview and the single off switch

`REGISTRATION_PREVIEW_ENABLED` in `src/config/launch.ts` is currently **true**. Set it to **false** and redeploy to remove all preview entry points, mock users, local uploads and simulated approval. There is no UI toggle. This is independent of `REGISTRATIONS_OPEN`, which controls whether live registration is open.

- `/?preview=register` starts all steps, with a blank college field.
- Preview participants select a local screenshot and enter a 12-digit test UTR. No payment, registration, upload or acknowledgement is sent to the server.
- Submission shows pending review. **Simulate team approval** demonstrates the final pass using the details entered in the form.
- `/?preview=pass` opens an explicitly marked sample pass directly for design review. It contains no working entry QR.
- A real API failure never falls back to a mock approved participant, even while preview is enabled.
- All server authorization remains enforced while the preview switch is on. Turning it off requires no replacement backend or routing change.

## Deployment prerequisites

Apply `supabase/manual/pass_experience.sql` to the existing Supabase database. New installations can use the updated `supabase/schema.sql`. The idempotent migration creates an owner-authorized acknowledgement table and functions; it does not update financial status. Hosted database migration has not been performed by this code change.

The existing entry-pass tables/functions and a valid `ENTRY_PASS_ENCRYPTION_KEY` are required for QR check-in. The pass itself and PDF remain available without a QR. The scanner continues to use the existing staff-authorized opaque-token lookup and atomic check-in functions, including duplicate-check-in protection. No default signing secret or simulated server approval is used.

## Pass behavior

- `/api/pass` intentionally uses POST: first access can mint an owner's opaque QR token. It returns real name, college, registration ID and backend status. Tokens are only available for confirmed registrations with active passes.
- Visible registration/pass screens refresh on focus, visibility and a 15-second interval. Hidden tabs avoid polling. Preview records do not poll the live registration API.
- Database claims elect one tab to show the celebration. A 30-second lease recovers abandoned claims. In-flight claims are shared across React remounts.
- Acknowledgement happens after the pass has painted, or an explicit skip. Navigation cleanup acknowledges only a presented pass. Failed acknowledgements retain the claim and retry on focus/connection recovery. No local-storage value is the source of truth.
- Subsequent acknowledged visits show the static pass. Failure of the celebration service preserves access to the approved pass.
- Phones receive a separate vertical card. Desktop retains the illustrated two-sided ticket. Long details use the flexible card when necessary. The real college is distinct from the NIT Rourkela venue.
- Ticket details write in once; the participant's name briefly decrypts into its exact original text. The screen-reader name is always unchanged. Reduced motion disables both effects, and acknowledged revisits are static. The registration ticket has no idle canvas rendering loop.
- Desktop opens on the black artwork. The first switch to **Your pass** triggers its text reveal; it does not loop on later flips. Phones retain the vertical card. Registration accents use softened champagne-gold derived from the existing palette. Manrope carries the pass name and body details; monospace is reserved for labels and identifiers. The event date is 13 November 2026, with a clearly separated college-to-NIT route and venue-city coordinates.
- **Save PDF** directly downloads a personalized PDF. PDF/QR export libraries are loaded only on click. Text is drawn with browser brand fonts before embedding, preserving Unicode names. The QR is included only when the backend supplies a token. The existing PNG export helper is retained for older callers.
- Keyboard controls, visible focus and QR-dialog focus restoration remain available. Font license notices are retained.

## Verification

`npm run typecheck`, focused ESLint checks, `npm test`, and `npm run build` verify types, compilation, registration validation, the POST transport contract, and real PostgreSQL approval/acknowledgement ownership, contention and lease recovery.

The optional `npm run test:pass` browser harness is separate from production and mocks only transport. Browser checks are not run when reviewing code without Chrome. These checks do not constitute a 1,000-user load test; production capacity depends on the deployed application and Supabase configuration.
