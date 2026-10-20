import { ResetPasswordForm } from "@/components/account/TokenActions";

export const instant = false;
export const metadata = { title: "Choose a new password" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const sp = await searchParams;
  return <div className="container-x grid place-items-center py-16"><div className="w-full max-w-md"><ResetPasswordForm token={sp.token ?? ""} /></div></div>;
}
