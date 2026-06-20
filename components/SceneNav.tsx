"use client";

import Image from "next/image";
import Link from "next/link";

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

type SceneNavProps = {
  pathname: string;
};

export function SceneNav({ pathname }: SceneNavProps) {
  return (
    <nav className="scene-nav" aria-label="Primary">
      {SCENE_NAV_ITEMS.map((item) => {
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
