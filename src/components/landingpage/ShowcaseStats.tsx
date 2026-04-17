"use client";

import { useEffect, useRef, useState } from "react";

interface StatItem {
  target: number;
  suffix: string;
  label: string;
}

const stats: StatItem[] = [
  { target: 2400, suffix: "+", label: "Active Users" },
  { target: 98, suffix: "%", label: "Schedule Coverage" },
  { target: 60, suffix: "%", label: "Fewer No-Shows" },
  { target: 40, suffix: "%", label: "Less Admin Time" },
];

function useCountUp(target: number, isVisible: boolean, duration = 1500) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isVisible) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [isVisible, target, duration]);

  return count;
}

function StatCounter({ target, suffix, label }: StatItem) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const count = useCountUp(target, isVisible);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="text-center">
      <div className="text-3xl sm:text-4xl font-bold text-white">
        {count.toLocaleString()}
        <span className="text-brand-blue">{suffix}</span>
      </div>
      <div className="text-slate-400 text-sm mt-1">{label}</div>
    </div>
  );
}

export function ShowcaseStats() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 py-10 border-b border-[#1e2d45]">
      {stats.map((stat) => (
        <StatCounter key={stat.label} {...stat} />
      ))}
    </div>
  );
}
