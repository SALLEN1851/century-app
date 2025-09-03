"use client";
import { signIn, signOut } from "next-auth/react";

export default function Home() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Welcome</h1>
      <p>Sign in to connect your Whoop account.</p>
      <div className="flex gap-3">
        <button onClick={() => signIn("whoop")} className="px-4 py-2 rounded-xl bg-orange-600 text-white">Sign in with WHOOP</button>
        <button onClick={() => signOut()} className="px-4 py-2 rounded-xl border">Sign out</button>
      </div>
    </div>
  );
}
