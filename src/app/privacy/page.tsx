import Link from 'next/link';
import LegalPage, { LegalContacts } from '@/components/legal/LegalPage';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Privacy Policy',
  description: "How INNOVISION 2026, Eastern India's largest techno-management fest, hosted by NIT Rourkela, collects, uses and protects your personal data.",
  path: '/privacy',
});

/**
 * /privacy. Describes what the site actually does with personal data; keep it in step with the code when the data
 * collected changes (registration form fields, supabase/schema.sql, the analytics in src/app/layout.tsx).
 */
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" path="/privacy" updated="23 October 2026">
      <p>
        This policy explains what personal data the INNOVISION 2026 website collects, why, who can see it and what you can
        do about it. &ldquo;We&rdquo; means the INNOVISION 2026 organising team at the National Institute of Technology
        Rourkela, Odisha. By signing in or registering you agree to this policy and to our{' '}
        <Link href="/terms">Terms and Conditions</Link>.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><b>From Google sign-in:</b> your name, email address and profile photo. We never see your Google password.</li>
        <li><b>When you register:</b> your name, gender, college, enrolment or roll number and phone number, and a photo of the front of your college ID card that you upload.</li>
        <li><b>For the fee:</b> the UPI transaction ID (UTR) and the screenshot of your payment that you upload. We do not collect card, bank or UPI PIN details.</li>
        <li><b>Referral codes:</b> if you enter a friend&apos;s or a campus ambassador&apos;s code when you register, we record whose code it was.</li>
        <li>
          <b>Campus ambassadors:</b> when you get an ambassador code, we store it with your name, college and Google
          email. What you fill in on our ambassador application form is kept by the organisers in Google Forms.
        </li>
        <li><b>At the venue:</b> when your entry pass is scanned, we record the time, the entry desk and which volunteer checked you in.</li>
        <li><b>Visit statistics:</b> anonymous page-view counts through Vercel Analytics, which uses no cookies and does not identify you.</li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To sign you in and keep you signed in.</li>
        <li>To verify your payment and your college ID card, and confirm or reject your registration.</li>
        <li>To issue your QR entry pass and check you in at the gate, once per registration.</li>
        <li>To contact you about your registration or important changes to the fest.</li>
        <li>To keep the site secure and stop abuse, such as fake or repeated registrations.</li>
      </ul>
      <p>We do not sell your data, use it for advertising or send you marketing email.</p>

      <h2>Who can see it</h2>
      <ul>
        <li><b>You</b> can see your own profile, registration and entry pass after signing in.</li>
        <li><b>The registration team</b> sees registration details, payment screenshots and ID card photos to verify payments and identities. These files are kept in private storage and opened only through short-lived links.</li>
        <li><b>Admins and the registration team</b> also see which code each registrant entered, and each campus ambassador&apos;s name, email, phone number, college and the registrations their code brought in, to run the programme and contact them. Ambassadors see only their own code, never who used it.</li>
        <li><b>Gate volunteers</b> see your registration details and the ID card photo you uploaded when they scan your pass, to match them with your college ID.</li>
        <li>
          <b>Service providers</b> that run the site for us: Google (sign-in, and Google Forms for ambassador
          applications), Supabase (database and file storage) and Vercel (hosting and visit statistics). They process data
          only to provide those services.
        </li>
      </ul>
      <p>We share data with anyone else only if the law requires it.</p>

      <h2>Cookies and browser storage</h2>
      <p>
        We use two sign-in cookies, which last up to 7 and 30 days, so you stay logged in. The site also keeps small,
        temporary notes in your browser&apos;s session storage, for example to reopen the registration form after you sign
        in. If you open a share link that carries a referral code, the code is kept in your browser&apos;s local storage for
        up to 30 days, only to fill it in when you register. We use no advertising or tracking cookies.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep registration data, payment screenshots, ID card photos and check-in records only for as long as we need them to run
        INNOVISION 2026, handle questions about payments or entry and settle the fest&apos;s accounts. After that we delete them.
      </p>

      <h2>How we protect it</h2>
      <p>
        Data is sent over encrypted connections. Access is limited by role: participants can read only their own records,
        and only the registration team can see payment screenshots and ID card photos. Entry-pass codes are stored encrypted. No system is
        perfectly secure, but we take reasonable steps to protect your data.
      </p>

      <h2>Your choices and rights</h2>
      <ul>
        <li>You can view your details in your profile and update your phone number there.</li>
        <li>You can ask us for a copy of your data, to correct details you can&apos;t edit yourself, or to delete your data.</li>
        <li>If you have a concern about how we handle your data, contact us first and we will try to resolve it.</li>
      </ul>
      <p>
        Deleting your data cancels your registration and entry pass. We may keep a record of a payment where that is needed
        to settle accounts or resolve a dispute.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we change this policy we will update it on this page and change the date at the top. Significant changes will
        also be announced on the site.
      </p>

      <h2>Contact us</h2>
      <p>For any privacy question or request, contact the organising team:</p>
      <LegalContacts />
    </LegalPage>
  );
}
