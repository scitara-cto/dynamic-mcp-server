// Authorization helper for user management actions

export function canActOnUser(sessionUser: any, targetEmail: string): boolean {
  const isSelf = sessionUser?.email === targetEmail;
  const isAdmin = sessionUser?.roles?.includes("admin");
  return isSelf || isAdmin;
}
