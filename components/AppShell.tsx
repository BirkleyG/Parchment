"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/components/providers/AuthProvider";
import { SceneNav } from "@/components/SceneNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const isSceneRoute = pathname === "/desk" || pathname === "/mailbox" || pathname === "/registry";

  const displayName = `${profile?.settings.firstName ?? ""} ${profile?.settings.lastName ?? ""}`.trim()
    || profile?.username
    || "Parchment";
  const initials = `${profile?.settings.firstName?.[0] ?? profile?.username?.[0] ?? "P"}${profile?.settings.lastName?.[0] ?? ""}`.toUpperCase();
  const header = (
    <header className="app-topbar">
      <div className="app-brand-block">
        <Link href="/desk" className="app-brand">
          <span className="font-display app-brand-wordmark">Parchment.</span>
          <Image
            src="/design-assets/Seal.png"
            alt=""
            width={42}
            height={42}
            className="app-brand-seal"
          />
        </Link>
        <p className="app-brand-copy">
          A calm writing space for slow correspondence.
        </p>
      </div>

      {isSceneRoute ? <SceneNav pathname={pathname} /> : null}

      <div className="app-account">
        {profile ? (
          <div className="app-profile">
            <div className="app-profile-initials">
              {initials}
            </div>
            <div>
              <p className="app-profile-name">{displayName}</p>
              <p className="app-profile-address">@{profile.settings.mailboxName}</p>
            </div>
          </div>
        ) : null}
        <button type="button" className="secondary-button app-sign-out" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </header>
  );

  if (isSceneRoute) {
    return (
      <div className="app-shell desk-shell">
        <div className="desk-frame">
          {header}
          <main className="desk-frame-main">{children}</main>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {header}
      <main className="pb-10">{children}</main>
    </div>
  );
}
