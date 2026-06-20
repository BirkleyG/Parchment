"use client";

import Link from "next/link";

import { DESK_HOTSPOT_DEFAULTS } from "@/lib/hotspotDefaults";
import type { Scene } from "@/lib/types";

type SidebarNavProps = {
  activeScene: Scene;
  bottomPanel: React.ReactNode;
};

const NAV_HOTSPOTS = [
  { id: "desk", href: "/desk", rect: DESK_HOTSPOT_DEFAULTS.deskButton },
  { id: "registry", href: "/registry", rect: DESK_HOTSPOT_DEFAULTS.registryButton },
  { id: "mailbox", href: "/mailbox", rect: DESK_HOTSPOT_DEFAULTS.mailboxButton },
] as const;

export function SidebarNav({ activeScene, bottomPanel }: SidebarNavProps) {
  return (
    <aside className="absolute inset-0 z-40 pointer-events-none">
      {NAV_HOTSPOTS.map((item) => {
        const isActive = item.id === activeScene;
        return (
          <Link
            key={item.id}
            href={item.href}
            className={`absolute rounded-sm pointer-events-auto transition ${
              isActive
                ? "ring-1 ring-[#c59a65]/45 bg-[#8a6337]/12"
                : "hover:bg-[#8a6337]/10"
            }`}
            style={{
              left: `${item.rect.left}%`,
              top: `${item.rect.top}%`,
              width: `${item.rect.width}%`,
              height: `${item.rect.height}%`,
            }}
          >
            <span className="sr-only">Go to {item.id}</span>
          </Link>
        );
      })}

      <div className="absolute left-[3.6%] top-[65.4%] w-[15.2%] text-center pointer-events-auto">
        {bottomPanel}
      </div>
    </aside>
  );
}
