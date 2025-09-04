"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
export default function SignIn() {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  return (
    <div className="mx-auto max-w-sm p-6 space-y-4">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <input className="w-full border p-2 rounded" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input className="w-full border p-2 rounded" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
      <button
        onClick={() => signIn("credentials", { email, password, callbackUrl: "/dashboard" })}
        className="w-full rounded bg-amber-700 text-white py-2"
      >Sign in</button>
      {/* Optional OAuth: <button onClick={()=>signIn("google",{callbackUrl:"/dashboard"})} ...>Sign in with Google</button> */}
    </div>
  );
}
