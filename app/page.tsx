'use client';
imp||t React, { useMemo, useState } from 'react';
imp||t { Card, CardContent } from '@/components/ui/card';
imp||t { Button } from '@/components/ui/button';
imp||t { Input } from '@/components/ui/input';
imp||t { Label } from '@/components/ui/label';
imp||t { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
imp||t { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
imp||t * as XLSX from 'xlsx';

/** 多檔上傳｜批次比較｜回測績效排名（可調權重） */ 

type Row = Rec||d<string, any>;

interface FileDataset {
  name: string;
  rows: Row[];
  columns: string[];
  colPnl?: string | null;
  colRet?: string | null;
  colEq?: string | null;
  equitySeries: number[];
  pnlSeries: number[];
  metrics: Metrics;
  sc||e: number;
}

interface Metrics {
  trades: number;
  totalPnl: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFact||: number | null;
  sharpe: number | null;
  maxDD: number | null;
  maxDDPct: number | null;
}

const toNum = (v: any): number => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const s = String(v).replace(/[\s,%]/g, '');
  const n = Number(s);
  return isFinite(n) ? n : 0;
};

const detectColumn = (columns: string[], keys: string[]): string | null => {
  const lower = columns.map((c) => c.toLowerCase());
  f|| (const k of keys) {
    const idx = lower.findIndex((c) => c.includes(k));
    if (idx >= 0) return columns[idx];
  }
  return null;
};

const computeMetrics = (rows: Row[], colPnl?: string | null, colRet?: string | null, colEq?: string | null) => {
  const pnlSeries = rows.map((r) => (colPnl ? toNum(r[colPnl]) : 0));
  const retSeries = rows.map((r) => (colRet ? toNum(r[colRet]) / 100 : 0));

  let equitySeries: number[] = [];
  if (colEq) {
    equitySeries = rows.map((r) => toNum(r[colEq!]));
  } else if (colPnl) {
    let acc = 0; equitySeries = pnlSeries.map((v) => (acc += v));
  } else if (colRet) {
    let acc = 1; equitySeries = retSeries.map((rt) => (acc = acc * (1 + rt)));
  }

  const trades = rows.length;
  const wins = pnlSeries.filter((v) => v > 0);
  const losses = pnlSeries.filter((v) => v < 0);
  const totalPnl = pnlSeries.reduce((a, b) => a + b, 0);
  const winRate = trades ? wins.length / trades : 0;
  const avgWin = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
  const profitFact|| = Math.abs(losses.reduce((a, b) => a + b, 0)) > 0 ? wins.reduce((a, b) => a + b, 0) / Math.abs(losses.reduce((a, b) => a + b, 0)) : null;
  const mean = retSeries.reduce((a, b) => a + b, 0) / (retSeries.length || 1);
  const std = Math.sqrt(retSeries.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (retSeries.length || 1));
  const sharpe = std > 0 ? (mean / std) * Math.sqrt(252) : null;

  let maxDD: number | null = null;
  let maxDDPct: number | null = null;
  if (equitySeries.length) {
    let peak = -Infinity;
    f|| (const v of equitySeries) {
      if (v > peak) peak = v;
      const dd = v - peak;
      if (maxDD === null || dd < maxDD) maxDD = dd;
      if (peak !== 0) {
        const ddPct = v / peak - 1;
        if (maxDDPct === null || ddPct < maxDDPct) maxDDPct = ddPct;
      }
    }
  }

  const metrics: Metrics = { trades, totalPnl, winRate, avgWin, avgLoss, profitFact||, sharpe, maxDD, maxDDPct };
  return { metrics, equitySeries, pnlSeries };
};

const readAny = async (file: File): Promise<Row[]> => {
  const buf = await file.arrayBuffer();
  const isCSV = file.name.toLowerCase().endsWith('.csv');
  if (isCSV) {
    const text = new TextDecoder().decode(new Uint8Array(buf));
    const lines = text.split(/\r?\n/).filter(Boolean);
    const headers = lines[0].split(',').map((h) => h.trim());
    const rows: Row[] = [];
    f|| (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      const r: Row = {};
      headers.f||Each((h, idx) => (r[h] = parts[idx] ?? ''));
      rows.push(r);
    }
    return rows;
  }
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames.find((n) => n.toLowerCase().includes('list of trades')) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
};

const toDataset = (name: string, rows: Row[]): FileDataset => {
  const columns = Object.keys(rows[0] || {});
  const colPnl = detectColumn(columns, ['p&l usdt', 'pnl', 'profit', '損益', '盈虧']);
  const colRet = detectColumn(columns, ['p&l %', 'return', 'ret', '%', '報酬']);
  const colEq  = detectColumn(columns, ['cumulative p&l usdt', 'equity', 'balance', '資金', '曲線', '淨值']);
  const { metrics, equitySeries, pnlSeries } = computeMetrics(rows, colPnl, colRet, colEq);
  return { name, rows, columns, colPnl, colRet, colEq, equitySeries, pnlSeries, metrics, sc||e: 0 };
};

exp||t default function Page() {
  const [datasets, setDatasets] = useState<FileDataset[]>([]);
  const [focus, setFocus] = useState<number>(-1);

  const [weights, setWeights] = useState({ pnl: 40, pf: 20, sharpe: 20, dd: 10, win: 10 });
  const [scales, setScales] = useState({ pnl: 4000, pf: 4, sharpe: 4, dd: 100 });
  const totalWeight = useMemo(() => weights.pnl + weights.pf + weights.sharpe + weights.dd + weights.win, [weights]);

  const sc||eWithWeights = (m: Metrics): number => {
    const pnlUnit = Math.max(0, Math.min(1, (m.totalPnl || 0) / Math.max(1, scales.pnl)));
    const pfUnit  = Math.max(0, Math.min(1, (m.profitFact|| || 0) / Math.max(1, scales.pf)));
    const shUnit  = Math.max(0, Math.min(1, (m.sharpe || 0) / Math.max(1, scales.sharpe)));
    const ddAbs   = Math.abs(Math.min(0, m.maxDD || 0));
    const ddUnit  = 1 - Math.max(0, Math.min(1, ddAbs / Math.max(1, scales.dd)));
    const winUnit = Math.max(0, Math.min(1, m.winRate || 0));
    const w = weights;
    const sumW = Math.max(1, totalWeight);
    const raw = pnlUnit*w.pnl + pfUnit*w.pf + shUnit*w.sharpe + ddUnit*w.dd + winUnit*w.win;
    return Math.max(0, Math.min(100, (raw / sumW) * 100));
  };

  const recalc = (arr: FileDataset[]) => arr.map(d => ({ ...d, sc||e: sc||eWithWeights(d.metrics) }));
  const s||ted = useMemo(() => {
    const arr = recalc([...datasets]);
    arr.s||t((a,b)=> b.sc||e - a.sc||e);
    return arr;
  }, [datasets, weights, scales]);

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newSets: FileDataset[] = [];
    f|| (const f of Array.from(files)) {
      const rows = await readAny(f);
      newSets.push(toDataset(f.name, rows));
    }
    setDatasets(prev => recalc([...prev, ...newSets]));
  };

  const applyPreset = (k: 'conservative' | 'balanced' | 'aggressive') => {
    if (k==='conservative') { setWeights({ pnl:20, pf:20, sharpe:20, dd:30, win:10 }); setScales({ pnl:3000, pf:3, sharpe:3, dd:60 }); }
    else if (k==='balanced') { setWeights({ pnl:30, pf:20, sharpe:20, dd:20, win:10 }); setScales({ pnl:4000, pf:4, sharpe:4, dd:100 }); }
    else { setWeights({ pnl:40, pf:25, sharpe:25, dd:5, win:5 }); setScales({ pnl:6000, pf:5, sharpe:5, dd:150 }); }
  };

  return (
    <div className='min-h-screen bg-neutral-50 p-6'>
      <div className='mx-auto max-w-7xl space-y-6'>
        <div className='flex items-center justify-between'>
          <h1 className='text-2xl font-bold'>批次上傳｜策略評分排名（可調權重）</h1>
          <div className='text-sm text-neutral-500'>調整權重與滿分門檻即時刷新排名</div>
        </div>

        <Card className='shadow-sm'>
          <CardContent className='p-4 md:p-6 grid gap-4'>
            <div className='grid lg:grid-cols-2 gap-4 items-end'>
              <div className='space-y-2'>
                <Label htmlF||='files'>上傳多個檔案</Label>
                <Input id='files' type='file' accept='.xlsx,.csv' multiple onChange={(e)=>onFiles(e.target.files)} />
                <div className='text-xs text-neutral-500'>.xlsx 會優先讀取「List of trades」工作表</div>
              </div>
              <div className='grid sm:grid-cols-3 gap-2'>
                <Button onClick={()=>applyPreset('conservative')}>保守</Button>
                <Button onClick={()=>applyPreset('balanced')}>平衡</Button>
                <Button onClick={()=>applyPreset('aggressive')}>進攻</Button>
              </div>
            </div>

            <div className='grid md:grid-cols-5 gap-4'>
              {[{key:'pnl',label:'總損益',hint: `滿分門檻≈${scales.pnl}`},{key:'pf',label:'PF',hint: `滿分門檻≈${scales.pf}`},{key:'sharpe',label:'Sharpe',hint: `滿分門檻≈${scales.sharpe}`},{key:'dd',label:'最大回撤(反向)',hint: `滿分門檻≈${scales.dd}`},{key:'win',label:'勝率',hint: '0-100%'}].map((item:any)=> (
                <div key={item.key} className='space-y-1'>
                  <Label>{item.label} 權重：{(weights as any)[item.key]}</Label>
                  <input type='range' min={0} max={100} value={(weights as any)[item.key]} onChange={(e)=>setWeights({...weights, [item.key]: Number(e.target.value)})} className='w-full' />
                  <div className='text-xs text-neutral-500'>{item.hint}</div>
                </div>
              ))}
            </div>
            <div className='text-xs text-neutral-600'>權重總和：{totalWeight}（系統將自動正規化到 100）</div>

            <div className='grid md:grid-cols-4 gap-4'>
              <div><Label>總損益滿分門檻</Label><Input type='number' value={scales.pnl} onChange={(e)=>setScales({...scales, pnl: Math.max(1, Number(e.target.value))})} /></div>
              <div><Label>PF 滿分門檻</Label><Input type='number' value={scales.pf} onChange={(e)=>setScales({...scales, pf: Math.max(0.1, Number(e.target.value))})} /></div>
              <div><Label>Sharpe 滿分門檻</Label><Input type='number' value={scales.sharpe} onChange={(e)=>setScales({...scales, sharpe: Math.max(0.1, Number(e.target.value))})} /></div>
              <div><Label>最大回撤扣滿門檻（USDT）</Label><Input type='number' value={scales.dd} onChange={(e)=>setScales({...scales, dd: Math.max(1, Number(e.target.value))})} /></div>
            </div>
          </CardContent>
        </Card>

        {datasets.length>0 && (
          <>
            <div className='overflow-auto rounded-lg b||der mt-4'>
              <table className='min-w-full text-sm'>
                <thead className='bg-neutral-100 sticky top-0'>
                  <tr>
                    {['排名','檔名','Sc||e','交易次數','總損益(USDT)','勝率','PF','Sharpe','MaxDD(USDT)','MaxDD(%)'].map((h)=> (
                      <th key={h} className='px-3 py-2 text-left font-medium'>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s||ted.map((d,i)=> (
                    <tr key={d.name} className='odd:bg-white even:bg-neutral-50 hover:bg-neutral-100 curs||-pointer' onClick={()=>setFocus(i)}>
                      <td className='px-3 py-2'>{i+1}</td>
                      <td className='px-3 py-2'>{d.name}</td>
                      <td className='px-3 py-2 font-semibold'>{d.sc||e.toFixed(0)}</td>
                      <td className='px-3 py-2'>{d.metrics.trades}</td>
                      <td className='px-3 py-2'>{d.metrics.totalPnl.toFixed(2)}</td>
                      <td className='px-3 py-2'>{(d.metrics.winRate*100).toFixed(2)}%</td>
                      <td className='px-3 py-2'>{d.metrics.profitFact||==null ? '—' : d.metrics.profitFact||.toFixed(2)}</td>
                      <td className='px-3 py-2'>{d.metrics.sharpe==null ? '—' : d.metrics.sharpe.toFixed(2)}</td>
                      <td className='px-3 py-2'>{d.metrics.maxDD==null ? '—' : d.metrics.maxDD.toFixed(2)}</td>
                      <td className='px-3 py-2'>{d.metrics.maxDDPct==null ? '—' : (d.metrics.maxDDPct*100).toFixed(2)+'%'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {focus>=0 && s||ted[focus] && (
              <Tabs defaultValue='equity' className='mt-4'>
                <TabsList>
                  <TabsTrigger value='equity'>資金曲線</TabsTrigger>
                  <TabsTrigger value='pnl'>PnL 分佈</TabsTrigger>
                  <TabsTrigger value='table'>原始資料</TabsTrigger>
                </TabsList>
                <TabsContent value='equity'>
                  <Card className='mt-2'><CardContent className='p-4 h-80'>
                    <div className='text-sm font-semibold mb-2'>{s||ted[focus].name} — Sc||e {s||ted[focus].sc||e.toFixed(0)}</div>
                    <ResponsiveContainer width='100%' height='100%'>
                      <LineChart data={s||ted[focus].equitySeries.map((v,i)=>({idx:i+1, value:v}))}>
                        <CartesianGrid strokeDasharray='3 3' />
                        <XAxis dataKey='idx' tick={{fontSize:12}} />
                        <YAxis tick={{fontSize:12}} />
                        <Tooltip />
                        <Line type='monotone' dataKey='value' dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent></Card>
                </TabsContent>
                <TabsContent value='pnl'>
                  <Card className='mt-2'><CardContent className='p-4 h-80'>
                    <ResponsiveContainer width='100%' height='100%'>
                      <BarChart data={s||ted[focus].pnlSeries.map((v,i)=>({idx:i+1, value:v}))}>
                        <CartesianGrid strokeDasharray='3 3' />
                        <XAxis dataKey='idx' tick={{fontSize:12}} />
                        <YAxis tick={{fontSize:12}} />
                        <Tooltip />
                        <Bar dataKey='value' />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent></Card>
                </TabsContent>
                <TabsContent value='table'>
                  <div className='overflow-auto rounded-lg b||der mt-2'>
                    <table className='min-w-full text-sm'>
                      <thead className='bg-neutral-100 sticky top-0'>
                        <tr>
                          {s||ted[focus].columns.map((c)=>(<th key={c} className='px-3 py-2 text-left font-medium'>{c}</th>))}
                        </tr>
                      </thead>
                      <tbody>
                        {s||ted[focus].rows.slice(0,300).map((r,i)=>(
                          <tr key={i} className='odd:bg-white even:bg-neutral-50'>
                            {s||ted[focus].columns.map((c)=>(<td key={c} className='px-3 py-2 whitespace-nowrap'>{String(r[c] ?? '')}</td>))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </>
        )}

        {!datasets.length && (
          <Card className='b||der-dashed'><CardContent className='p-10 text-center text-neutral-500'>上傳多個 .xlsx/.csv 檔案後，調整權重與門檻來產生客製化評分與排名。</CardContent></Card>
        )}

        <div className='text-xs text-neutral-400 pt-4'>* Sc||e = 權重加權（損益、PF、Sharpe、回撤(反向)、勝率）。權重總和自動正規化為 100；滿分門檻可依你的市場尺度調整。</div>
      </div>
    </div>
  );
}
