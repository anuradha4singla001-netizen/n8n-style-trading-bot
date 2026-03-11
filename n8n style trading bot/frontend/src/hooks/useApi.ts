import { useStore } from '../store/useStore';
const BASE = '/api';
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: {'Content-Type':'application/json'}, ...opts });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}
export function useApi() {
  const { setBots, setActiveBotId, setBacktestResult, setBacktestLoading } = useStore();
  const fetchBots = async () => { const bots = await apiFetch<any[]>('/bots'); setBots(bots); };
  const createBot = async (config: any) => {
    const data = await apiFetch<any>('/bots', { method: 'POST', body: JSON.stringify(config) });
    setActiveBotId(data.id); await fetchBots(); return data;
  };
  const deleteBot = async (id: string) => { await apiFetch(`/bots/${id}`, {method:'DELETE'}); await fetchBots(); };
  const runBacktest = async (strategy: any) => {
    setBacktestLoading(true);
    try {
      const result = await apiFetch<any>('/backtest', { method:'POST', body: JSON.stringify({
        strategy, fromDate: Date.now()-30*86400000, toDate: Date.now(), initialBalance: 10000 }) });
      setBacktestResult(result);
    } finally { setBacktestLoading(false); }
  };
  const fetchMarket = async (pair: string, interval='5m', limit=100) =>
    apiFetch<any>(`/market/${encodeURIComponent(pair)}?interval=${interval}&limit=${limit}`);
  return { createBot, fetchBots, deleteBot, runBacktest, fetchMarket };
}
