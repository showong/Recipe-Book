"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function AdminLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "로그인에 실패했습니다.");
        return;
      }
      const from = searchParams.get("from");
      router.replace(from && from.startsWith("/admin") ? from : "/admin");
    } catch {
      setError("로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)" }}>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-3xl p-8"
        style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🔐</div>
          <h1 className="text-2xl font-extrabold text-white mb-1">관리자 로그인</h1>
          <p className="text-white/50 text-sm">비밀키를 입력하세요</p>
        </div>

        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="관리자 비밀키"
          autoFocus
          className="w-full px-4 py-3 rounded-2xl text-white placeholder-white/30 outline-none mb-3"
          style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.12)" }}
        />

        {error && <p className="text-red-300 text-xs mb-3 px-1">⚠️ {error}</p>}

        <button
          type="submit"
          disabled={loading || !secret.trim()}
          className="w-full py-3 rounded-2xl text-white font-bold transition-all hover:opacity-90 disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #ff6b35, #ffc857)" }}>
          {loading ? "확인 중..." : "로그인"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/")}
          className="w-full mt-4 py-2 rounded-2xl text-white/40 text-sm transition-all hover:text-white/70">
          ← 홈으로
        </button>
      </form>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginContent />
    </Suspense>
  );
}
