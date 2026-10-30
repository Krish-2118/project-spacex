import Link from 'next/link';
import LegalPage, { LegalContacts } from '@/components/legal/LegalPage';
import { REGISTRATION_FEE } from '@/config/payment';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Terms and Conditions',
  description: "The terms for registering for and attending INNOVISION 2026, Eastern India's largest techno-management fest, hosted by NIT Rourkela.",
  path: '/terms',
});

/** /terms. The registration and entry rules here mirror the registration flow and the QR check-in at the gate. */
export default function TermsPage() {
  return (
    <LegalPage title="Terms and Conditions" path="/terms" updated="13 October 2026">
      <p>
        These terms apply to everyone who uses the INNOVISION 2026 website, registers for the fest or attends it.
        &ldquo;We&rdquo; means the INNOVISION 2026 organising team at the National Institute of Technology Rourkela, Odisha.
        By signing in or registering you accept these terms and our <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>Accounts and registration</h2>
      <ul>
        <li>You sign in with your own Google account. One account can hold one registration.</li>
        <li>Your details must be true and must match your college ID card. You upload a photo of its front when you register, and show the card itself at the gate.</li>
        <li>You are responsible for keeping your account secure and for activity under it.</li>
      </ul>

      <h2>Fee and payment</h2>
      <ul>
        <li>The registration fee is <b>₹{REGISTRATION_FEE}</b>, paid by UPI to the account shown on the registration form.</li>
        <li>After paying, you upload a screenshot of the payment and enter its UPI transaction ID (UTR).</li>
        <li>
          Your registration stays <b>pending</b> until the registration team has verified the payment. It is then
          confirmed or rejected.
        </li>
        <li>
          A registration is rejected if the payment can&apos;t be verified, for example a wrong amount or an unclear or
          edited screenshot. You can then register again with a valid payment.
        </li>
        <li>A UTR can be used for only one registration. We may block accounts that submit false payment details.</li>
      </ul>

      <h2>Refunds</h2>
      <p>
        The registration fee is non-refundable once your registration is confirmed. If you were charged twice, or your
        payment reached us but your registration was rejected, contact us with your UTR and we will look into a refund.
        If the fest is cancelled, we will announce how fees will be refunded.
      </p>

      <h2>Entry pass</h2>
      <ul>
        <li>A confirmed registration gets one QR entry pass, shown under MY PASS on the site.</li>
        <li>The pass is personal and non-transferable. Don&apos;t share it: whoever is scanned first is checked in.</li>
        <li>Each pass checks in once. Carry your college ID; volunteers may refuse entry if it doesn&apos;t match your registration.</li>
      </ul>

      <h2>At the fest</h2>
      <ul>
        <li>Follow the rules of NIT Rourkela and the instructions of the organisers, volunteers and security staff.</li>
        <li>Individual events may have their own rules, eligibility and judging, which apply alongside these terms.</li>
        <li>
          We may refuse entry to or remove anyone who breaks these rules or behaves unsafely or abusively, without a refund.
        </li>
        <li>You are responsible for your belongings. We are not liable for loss or damage to personal property.</li>
        <li>
          The fest is photographed and filmed. Photos and videos may appear on this site and on our social media.
        </li>
      </ul>

      <h2>Changes to the fest</h2>
      <p>
        Schedules, venues, line-ups, prizes and event formats may change. We will post changes on the site. If the fest
        has to be postponed or cancelled, we will announce what happens to registrations.
      </p>

      <h2>Using this website</h2>
      <ul>
        <li>Don&apos;t try to break, overload or get around the site&apos;s security, registration or payment checks.</li>
        <li>Don&apos;t submit someone else&apos;s details, or create accounts or registrations on their behalf without their consent.</li>
        <li>The site&apos;s design, text and artwork belong to INNOVISION and its creators. Don&apos;t reuse them without permission.</li>
        <li>We may suspend accounts or cancel registrations that break these terms.</li>
      </ul>

      <h2>Liability</h2>
      <p>
        We run the site and the fest with reasonable care, but we provide the site &ldquo;as is&rdquo; and can&apos;t promise it
        will always be available or error-free. As far as the law allows, our liability for any registration is limited to
        the fee you paid for it.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms. The date at the top shows the latest version. Continuing to use the site after a change
        means you accept the updated terms.
      </p>

      <h2>Contact us</h2>
      <p>For questions about registration, payments or these terms, contact the organising team:</p>
      <LegalContacts />
    </LegalPage>
  );
}
