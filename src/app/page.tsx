import Innovision from "@/components/innovision/Innovision";
import { SITE_DESCRIPTION } from "@/config/site";
import { homeJsonLd, jsonLdScript, pageMetadata } from "@/lib/seo";

// Canonical "/" covers the main Innovision 2026 website experience
export const metadata = pageMetadata({ title: null, description: SITE_DESCRIPTION, path: "/" });

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(homeJsonLd()) }} />
      <Innovision />
    </>
  );
}
