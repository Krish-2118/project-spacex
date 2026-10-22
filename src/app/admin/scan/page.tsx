import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyRegistrationStaff } from "@/lib/auth-server";
import EntryScanner from "@/components/entry/EntryScanner";
import SessionRestore from "@/components/entry/SessionRestore";

export const metadata: Metadata = {
  title: "Check-in Scanner | INNOVISION 2026",
  robots: { index: false, follow: false },
};

/**
 * /admin/scan: Venue check-in scanner for the registration team and admins.
 * Uses the established staff-authorized opaque-token lookup and atomic check-in endpoints.
 */
export default async function ScanPage() {
  const source = { headers: await headers(), cookies: await cookies() };
  const auth = await verifyRegistrationStaff(source);

  if ("error" in auth) {
    if (auth.status === 401 && source.cookies.get("inn_refresh_token")?.value) {
      return <SessionRestore />;
    }
    redirect(auth.status === 401 ? "/?auth=login&required=scan" : "/");
  }

  const name = auth.user.user_metadata?.full_name || auth.user.user_metadata?.name;
  const staffLabel = `${typeof name === "string" && name ? name : auth.user.email ?? "staff"} (${auth.role})`;
  return <EntryScanner staffLabel={staffLabel} />;
}
