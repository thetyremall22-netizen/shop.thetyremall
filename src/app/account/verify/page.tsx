import { ConfirmEmail } from "@/components/account/TokenActions";

export const instant = false;
export const metadata = { title: "Confirm your email" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string; next?: string }> }) {
  const sp = await searchParams;
  return <div className="container-x grid place-items-center py-16"><div className="w-full max-w-md"><ConfirmEmail token={sp.token ?? ""} next={sp.next} /></div></div>;
}
