import { InviteClaimExperience } from "@/components/InviteClaimExperience";
import type { InviteClaimMode } from "@/lib/types";

function normalizeClaimMode(value: string | string[] | undefined): InviteClaimMode | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  if (first === "existingAccount" || first === "newAccount") {
    return first;
  }

  return undefined;
}

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ claimMode?: string | string[] }>;
}) {
  const { token } = await params;
  const resolvedSearchParams = await searchParams;

  return (
    <InviteClaimExperience
      token={token}
      initialClaimMode={normalizeClaimMode(resolvedSearchParams.claimMode)}
    />
  );
}
