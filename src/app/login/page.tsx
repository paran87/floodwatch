import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-950 via-navy-900 to-navy-700 p-4">
      <div className="w-full max-w-sm rounded-xl border-t-4 border-brand-500 bg-white p-8 text-center shadow-lg">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-navy-700">Flood-prone area monitoring</p>
        <h1 className="mt-1 font-display text-4xl font-extrabold uppercase text-navy-900">Flood<span className="text-brand-500">Watch</span></h1>
        <p className="mt-1 text-sm text-slate-500">Sign in to continue.</p>
        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <Button type="submit" className="w-full">
            Sign in with Google
          </Button>
        </form>
      </div>
    </div>
  );
}
