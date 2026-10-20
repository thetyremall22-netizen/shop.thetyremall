import { requireCustomer } from "@/lib/customer-page";
import { AccountFrame } from "@/components/account/AccountNav";
import { DetailsForm, PasswordForm } from "@/components/account/DetailsForm";

export const instant = false;
export const metadata = { title: "My details" };

export default async function MyDetails() {
  const c = await requireCustomer("/account/details");
  return (
    <AccountFrame name={`${c.firstName} ${c.lastName}`}>
      <h1 className="font-display text-3xl sm:text-4xl">My details</h1>
      <div className="mt-6 space-y-6">
        <DetailsForm initial={{ firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone, address: c.address }} wishlistEmails={c.wishlistEmails} />
        <PasswordForm />
      </div>
    </AccountFrame>
  );
}
