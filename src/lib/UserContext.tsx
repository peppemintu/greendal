'use client';

import { createContext, useContext } from 'react';

/**
 * Only what the header/nav needs to decide what to show — never the email.
 * Fetched once in the root layout (server-side) and handed down here so
 * every page doesn't have to call getCurrentUser() itself just to render
 * "signed in as ...".
 */
export type PublicUser = {
  displayName: string;
  role: 'admin' | 'reader';
  emailVerified: boolean;
};

const UserContext = createContext<PublicUser | null>(null);

export function UserProvider({ user, children }: { user: PublicUser | null; children: React.ReactNode }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useCurrentUser(): PublicUser | null {
  return useContext(UserContext);
}
