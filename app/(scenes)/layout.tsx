import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";
import { FadePageTransition } from "@/components/FadePageTransition";

export default function ScenesLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <AppShell>
        <FadePageTransition>{children}</FadePageTransition>
      </AppShell>
    </AuthGate>
  );
}
