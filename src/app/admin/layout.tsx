import { WwwToMainAddress } from "@/components/admin/WwwToMainAddress";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <WwwToMainAddress />
      {children}
    </>
  );
}
