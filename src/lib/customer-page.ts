import "server-only";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getCustomer, type Customer } from "./customers";

/** Top of every signed-in client zone page: sends signed-out visitors to the
 *  sign-in screen and brings them back here afterwards. */
export async function requireCustomer(backTo: string): Promise<Customer> {
  await connection();
  const c = await getCustomer();
  if (!c) redirect(`/account?next=${encodeURIComponent(backTo)}`);
  return c;
}
