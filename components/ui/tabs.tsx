'use client';
import * as React from 'react';
type TabsCtx = { value: string; setValue: (v: string)=>void };
const Ctx = React.createContext<TabsCtx | null>(null);
export function Tabs({ defaultValue, children }: { defaultValue: string; children: React.ReactNode }) {
  const [value, setValue] = React.useState(defaultValue);
  return <Ctx.Provider value={{ value, setValue }}>{children}</Ctx.Provider>;
}
export function TabsList({ children, className='' }: { children: React.ReactNode; className?: string }) {
  return <div className={`inline-flex gap-2 rounded-xl border bg-white p-1 ${className}`}>{children}</div>;
}
export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = React.useContext(Ctx)!;
  const active = ctx.value === value;
  return (
    <button onClick={()=>ctx.setValue(value)} className={`px-3 py-1.5 rounded-lg text-sm ${active ? 'bg-black text-white' : 'text-neutral-700 hover:bg-neutral-100'}`}>
      {children}
    </button>
  );
}
export function TabsContent({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = React.useContext(Ctx)!;
  if (ctx.value !== value) return null;
  return <div>{children}</div>;
}
