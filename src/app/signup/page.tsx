"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
export default function SignUp() {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [name,setName]=useState("");
  const router = useRouter();
  async function submit() {
    const r = await fetch("/api/signup", { method:"POST", body: JSON.stringify({ email, password, name }) });
    if (r.ok) router.push("/signin");
    else alert((await r.json()).error || "Sign up failed");
  }
  return (
    <div className="mx-auto max-w-sm p-6 space-y-4">
      <h1 className="text-2xl font-bold">Create account</h1>
      <input className="w-full border p-2 rounded" placeholder="Name" value={name} onChange={e=>setName(e.target.value)} />
      <input className="w-full border p-2 rounded" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input className="w-full border p-2 rounded" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
      <button onClick={submit} className="w-full rounded bg-stone-900 text-white py-2">Create account</button>
    </div>
  );
}
