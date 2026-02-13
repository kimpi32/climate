'use client';

export default function Header() {
  return (
    <header className="border-b border-[var(--card-border)] bg-[var(--card-bg)]">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          <span className="text-[var(--accent)]">끓는</span> 한반도
        </h1>
        <p className="text-[var(--muted)] mt-1 text-sm md:text-base">
          1961년부터 오늘까지, 대한민국 기온의 모든 기록
        </p>
      </div>
    </header>
  );
}
