"use client";

import Image from "next/image";
import Link from "next/link";

import { useAuth } from "@/components/providers/AuthProvider";
import { ADMIN_USERNAME } from "@/lib/adminConfig";

const SCENE_NAV_ITEMS = [
  {
    href: "/desk",
    label: "Desk",
    description: "Write",
    icon: "/design-assets/Letter.png",
  },
  {
    href: "/mailbox",
    label: "Mailbox",
    description: "Read",
    icon: "/design-assets/Letter Drawr.png",
  },
  {
    href: "/registry",
    label: "Registry",
    description: "Find",
    icon: "/design-assets/Registry.png",
  },
] as const;

const ADMIN_NAV_ITEM = {
  href: "/admin",
  label: "Admin",
  description: "Manage",
  icon: "/design-assets/Seal.png",
} as const;

type SceneNavProps = {
  pathname: string;
};

export function SceneNav({ pathname }: SceneNavProps) {
  const { profile } = useAuth();
  const items = profile?.username === ADMIN_USERNAME ? [...SCENE_NAV_ITEMS, ADMIN_NAV_ITEM] : SCENE_NAV_ITEMS;

  return (
    <nav className="scene-nav" aria-label="Primary">
      {items.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`scene-nav-link ${isActive ? "scene-nav-link-active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            <Image
              src={item.icon}
              alt=""
              width={26}
              height={26}
              className="scene-nav-icon"
            />
            <span className="scene-nav-label">{item.label}</span>
            <span className="scene-nav-description">{item.description}</span>
          </Link>
        );
      })}
    </nav>
  );
}
