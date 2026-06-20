import clsx from "clsx";

import type { Scene } from "@/lib/types";

const BACKGROUND_BY_SCENE: Record<Scene, string> = {
  desk: "/assets/references/desk-no-items-with-text-16x9.png",
  registry: "/assets/references/registry-full.png",
  mailbox: "/assets/references/mailbox-full.png",
};

const CANVAS_BY_SCENE: Record<Scene, { width: number; height: number }> = {
  desk: { width: 16, height: 9 },
  registry: { width: 1448, height: 1086 },
  mailbox: { width: 1448, height: 1086 },
};

type SceneFrameProps = {
  scene: Scene;
  className?: string;
  children: React.ReactNode;
};

export function SceneFrame({ scene, className, children }: SceneFrameProps) {
  const canvas = CANVAS_BY_SCENE[scene];
  const aspect = canvas.width / canvas.height;

  return (
    <div className="h-screen w-screen bg-[#120a05] flex items-center justify-center overflow-hidden">
      <div
        className={clsx(
          "relative overflow-hidden",
          className,
        )}
        style={{
          width: `min(100vw, calc(100vh * ${aspect}))`,
          aspectRatio: `${canvas.width} / ${canvas.height}`,
          backgroundImage: `url(${BACKGROUND_BY_SCENE[scene]})`,
          backgroundSize: "100% 100%",
          backgroundPosition: "center",
        }}
      >
        {children}
      </div>
    </div>
  );
}
