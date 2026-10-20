import { UnsubscribeButton } from "@/components/account/TokenActions";

export const instant = false;
export const metadata = { title: "Wishlist emails" };

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ c?: string; t?: string }> }) {
  const sp = await searchParams;
  return <div className="container-x grid place-items-center py-16"><div className="w-full max-w-md"><UnsubscribeButton c={sp.c ?? ""} t={sp.t ?? ""} /></div></div>;
}
