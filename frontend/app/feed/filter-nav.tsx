"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function FilterSelect({
  label,
  param,
  options,
  value,
}: {
  label: string;
  param: string;
  options: string[];
  value: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const sp = new URLSearchParams(searchParams.toString());
    const v = e.target.value;
    if (v) {
      sp.set(param, v);
    } else {
      sp.delete(param);
    }
    sp.set("page", "1");
    router.push(`/feed?${sp}`);
  }

  return (
    <div className="relative">
      <label className="block text-[9px] text-muted tracking-widest uppercase mb-1">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          className="appearance-none bg-surface border border-border rounded px-3 py-1.5 pr-7 text-[11px] text-foreground tracking-wide cursor-pointer hover:border-border-hover transition-colors focus:outline-none focus:border-accent min-w-[120px]"
        >
          <option value="">All</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-muted pointer-events-none">
          &#9660;
        </span>
      </div>
    </div>
  );
}
