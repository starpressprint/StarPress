interface OrderIdentity {
  userId?: string | null;
  guestEmail?: string | null;
}
interface CustomerIdentity {
  id?: string;
  email?: string | null;
  email_confirmed_at?: string | null;
}

/** Email-based recovery is allowed only after the provider verifies that email. */
export function isOrderOwner(order: OrderIdentity, user: CustomerIdentity | null | undefined): boolean {
  if (!user) return false;
  if (user.id && order.userId === user.id) return true;
  return Boolean(user.email_confirmed_at && user.email && order.guestEmail &&
    user.email.trim().toLowerCase() === order.guestEmail.trim().toLowerCase());
}
