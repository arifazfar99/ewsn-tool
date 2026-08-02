import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

async function login(formData: FormData) {
  "use server";

  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=1");
    }
    throw error;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <form
        action={login}
        className="panel w-full max-w-sm p-8 shadow-sm"
      >
        <p className="eyebrow mb-1">EWSN Document Tool</p>
        <h1
          className="mb-6 text-2xl font-semibold text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Log in
        </h1>

        {error && (
          <p className="stamp stamp-negative mb-5 !block !text-left">
            Invalid email or password
          </p>
        )}

        <label className="mb-3 block">
          <span className="field-label">Email</span>
          <input type="email" name="email" required className="field-input" />
        </label>

        <label className="mb-6 block">
          <span className="field-label">Password</span>
          <input
            type="password"
            name="password"
            required
            className="field-input"
          />
        </label>

        <button type="submit" className="btn-primary w-full">
          Log in
        </button>
      </form>
    </div>
  );
}
