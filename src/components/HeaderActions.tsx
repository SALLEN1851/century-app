'use client';

import { useSession, signIn, signOut } from 'next-auth/react';

export default function HeaderActions() {
  const { data: session, status } = useSession();

  if (status === 'loading') return null;

  if (!session) {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => signIn()}
          className="rounded-lg bg-amber-700 text-stone-50 px-3 py-1.5 text-sm hover:bg-amber-800"
        >
          Sign in
        </button>
        <button
          onClick={() => (window.location.href = '/signup')}
          className="rounded-lg border border-stone-300 dark:border-stone-700 px-3 py-1.5 text-sm hover:bg-stone-100 dark:hover:bg-stone-800"
        >
          Create account
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-stone-600 dark:text-stone-300">
        Hi {session.user?.name || session.user?.email}
      </span>
      <button
        onClick={() => signOut({ callbackUrl: '/' })}
        className="rounded-lg border border-stone-300 dark:border-stone-700 px-3 py-1.5 text-sm hover:bg-stone-100 dark:hover:bg-stone-800"
      >
        Sign out
      </button>
    </div>
  );
}
