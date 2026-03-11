/**
 * App.jsx  –  Root component
 * Tabs: Builder | Dashboard | Orders | Portfolio
 */

import { useState, useEffect } from "react";
import { useStore } from "./store/useStore";
import { useWebSocket } from "./hooks/useWebSocket";
import FlowCanvas from "./components/FlowCanvas";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import "./styles/global.css";
import "./styles/canvas.css";
import "./styles/layout.css";

/* ── Tabs ── */
const TABS = ["BUILDER", "DASHBOARD", "ORDERS", "PORTFOLIO"];

const NODE_TYPES_COLOR = {
  trigger: "#f0b429", condition: "#3d9eff",
  indicator: "#a78bfa", action: "#00e5a0", alert: "#ff4d6a",
};

/* ── Main App ── */
export default function App() {
  const [tab, setTab] = useState("BUILDER");
  const wsStatus = useWebSocket();

  const { prices, prevPrices, candles, strategies, executionLog, orders, portfolio,
          fetchStrategies, fetchOrders, fetchPortfolio, fetchIndicators,
          runStrategy, toggleStrategy, deleteStrategy, saveStrategy,
          activeStrategy, setActiveStrategy, loading } = useStore();

  // Init: load data & indicators
  useEffect(() => {
    fetchStrategies();
    fetchOrders();
    fetchPortfolio();
    fetchIndicators("BTC");
  }, []);

  const currentStrategy = activeStrategy || strategies[0];

  const handleRunStrategy = async () => {
    if (!currentStrategy) return;
    await runStrategy(currentStrategy.id);
  };

  const latestExec = executionLog[0];

  return (
    <div className="app-shell">
      {/* ══ TOP BAR ══ */}
      <div className="topbar">
        <div className="topbar-logo">
          <div className="topbar-logo-icon">⚡</div>
          <div>
            <div className="topbar-logo-name">TRADEFLOW</div>
            <div className="topbar-logo-sub">VISUAL ALGO TRADING PLATFORM</div>
          </div>
        </div>
        <div className="divider" />

        {/* Tabs */}
        <div className="topbar-tabs">
          {TABS.map(t => (
            <div key={t} className={`topbar-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t}</div>
          ))}
        </div>
        <div className="divider" />

        {/* Live tickers */}
        {[["BTC", "#f0b429"], ["ETH", "#3d9eff"], ["SOL", "#a78bfa"]].map(([sym, col]) => (
          <div key={sym} className="ticker-chip">
            <span className="ticker-sym">{sym}</span>
            <span className="ticker-price" style={{ color: col }}>${prices[sym]?.toLocaleString() || "–"}</span>
            <span className="ticker-dir" style={{ color: (prices[sym] || 0) >= (prevPrices[sym] || 0) ? "#00e5a0" : "#ff4d6a" }}>
              {(prices[sym] || 0) >= (prevPrices[sym] || 0) ? "▲" : "▼"}
            </span>
          </div>
        ))}

        <div style={{ flex: 1 }} />

        {/* Stats */}
        <div className="flex gap-2">
          {[
            ["STRATEGIES", strategies.length, "#3d9eff"],
            ["ORDERS", orders.length, "#a78bfa"],
            ["P&L", `${portfolio.pnl >= 0 ? "+" : ""}$${Math.round(portfolio.pnl || 0).toLocaleString()}`, portfolio.pnl >= 0 ? "#00e5a0" : "#ff4d6a"],
          ].map(([k, v, c]) => (
            <div key={k} className="stat-chip">
              <div className="stat-chip-key">{k}</div>
              <div className="stat-chip-val" style={{ color: c }}>{v}</div>
            </div>
          ))}
        </div>
        <div className="divider" />

        {/* WS indicator */}
        <div className="flex items-center gap-2">
          <div className="ws-dot" style={{
            background: wsStatus === "connected" ? "#00e5a0" : wsStatus === "error" ? "#ff4d6a" : "#3a5470",
            animation: wsStatus === "connected" ? "blink 2s infinite" : "none",
          }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-sub)", letterSpacing: "0.08em" }}>
            {wsStatus.toUpperCase()}
          </span>
        </div>
      </div>

      {/* ══ WORKSPACE ══ */}
      <div className="workspace">
        {/* ── Left sidebar ── */}
        <div className="sidebar">
          <div className="sidebar-section">
            <div className="sidebar-section-title">STRATEGIES</div>
            {strategies.map(s => (
              <div key={s.id} className={`strategy-row ${currentStrategy?.id === s.id ? "active" : ""}`}
                onClick={() => setActiveStrategy(s)}>
                <div className="strategy-dot" style={{ background: s.enabled ? "#00e5a0" : "#3a5470", boxShadow: s.enabled ? "0 0 6px #00e5a050" : "none" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="strategy-name">{s.name}</div>
                  <div className="strategy-meta">runs: {s.runCount}</div>
                </div>
                <button className="btn btn-ghost" style={{ padding: "2px 6px", fontSize: 9 }}
                  onClick={e => { e.stopPropagation(); toggleStrategy(s.id); }}>
                  {s.enabled ? "■" : "▶"}
                </button>
              </div>
            ))}
            <button className="btn" style={{ width: "100%", marginTop: 8, justifyContent: "center" }}
              onClick={() => saveStrategy({ name: "New Strategy", nodes: [], edges: [], assets: [] })}>
              + NEW STRATEGY
            </button>
          </div>

          {/* Quick indicators */}
          <div className="sidebar-section" style={{ flex: 1, overflow: "auto" }}>
            <div className="sidebar-section-title">EXECUTION LOG</div>
            {executionLog.slice(0, 20).map((exec, i) => (
              <div key={i} style={{ padding: "6px 8px", marginBottom: 4, background: "var(--bg-surface)", borderRadius: 6, borderLeft: `2px solid ${exec.triggered ? "#00e5a0" : "#f0b429"}` }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", marginBottom: 2 }}>
                  {new Date(exec.startedAt).toLocaleTimeString("en", { hour12: false })}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-label)" }}>{exec.strategyName}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: exec.triggered ? "#00e5a0" : "#f0b429" }}>
                  {exec.triggered ? "✓ TRIGGERED" : "◎ EVALUATED"} · {exec.nodeResults?.length} nodes
                </div>
              </div>
            ))}
            {executionLog.length === 0 && (
              <div style={{ padding: "16px 0", textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 10 }}>
                No executions yet
              </div>
            )}
          </div>
        </div>

        {/* ── Main content area ── */}
        {tab === "BUILDER" && (
          <BuilderView currentStrategy={currentStrategy} onNodesChange={n => setActiveStrategy({ ...currentStrategy, nodes: n })}
            onEdgesChange={e => setActiveStrategy({ ...currentStrategy, edges: e })}
            latestExec={latestExec} onRun={handleRunStrategy} onSave={() => saveStrategy(currentStrategy)}
            onToggle={() => toggleStrategy(currentStrategy?.id)} loading={loading} />
        )}
        {tab === "DASHBOARD" && <DashboardView candles={candles} prices={prices} executionLog={executionLog} strategies={strategies} orders={orders} />}
        {tab === "ORDERS" && <OrdersView orders={orders} />}
        {tab === "PORTFOLIO" && <PortfolioView portfolio={portfolio} prices={prices} />}
      </div>

      {/* ══ STATUS BAR ══ */}
      <div className="statusbar">
        <span className="statusbar-text">TRADEFLOW · VISUAL ALGO TRADING PLATFORM v2.0</span>
        <div style={{ width: 1, height: 10, background: "var(--border-soft)" }} />
        <div className="flex items-center gap-2">
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: wsStatus === "connected" ? "#00e5a0" : "#3a5470" }} />
          <span className="statusbar-text" style={{ color: wsStatus === "connected" ? "#00e5a0" : "var(--text-dim)" }}>
            {wsStatus === "connected" ? "LIVE FEED ACTIVE" : "OFFLINE"}
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <span className="statusbar-text">Double-click canvas to add node · Delete/Backspace to remove</span>
      </div>
    </div>
  );
}

/* ── Builder Tab ── */
function BuilderView({ currentStrategy, onNodesChange, onEdgesChange, latestExec, onRun, onSave, onToggle, loading }) {
  const [panelTab, setPanelTab] = useState("LOG");

  if (!currentStrategy) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
      Select or create a strategy to begin
    </div>
  );

  return (
    <>
      {/* Canvas */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Builder toolbar */}
        <div style={{ height: 44, background: "var(--bg-panel)", borderBottom: "1px solid var(--border-dim)", display: "flex", alignItems: "center", padding: "0 14px", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-bright)", fontWeight: 600 }}>{currentStrategy.name}</span>
          <span className={`badge ${currentStrategy.enabled ? "badge-green" : "badge-blue"}`}>{currentStrategy.enabled ? "LIVE" : "PAUSED"}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)" }}>{currentStrategy.nodes?.length || 0} nodes · {currentStrategy.edges?.length || 0} edges</span>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={onSave}>💾 SAVE</button>
          <button className="btn" onClick={onToggle}>{currentStrategy.enabled ? "⏸ PAUSE" : "▶ ENABLE"}</button>
          <button className="btn btn-primary" onClick={onRun} disabled={loading[`run_${currentStrategy.id}`]}>
            {loading[`run_${currentStrategy.id}`] ? <span className="anim-spin">◎</span> : "▶ RUN NOW"}
          </button>
        </div>

        <FlowCanvas
          nodes={currentStrategy.nodes || []}
          edges={currentStrategy.edges || []}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          running={!!loading[`run_${currentStrategy.id}`]}
          executionNodes={latestExec?.nodeResults || []}
        />
      </div>

      {/* Right panel */}
      <div className="right-panel">
        <div className="panel-tabs">
          {["LOG", "NODES"].map(t => (
            <div key={t} className={`panel-tab ${panelTab === t ? "active" : ""}`} onClick={() => setPanelTab(t)}>{t}</div>
          ))}
        </div>

        {panelTab === "LOG" ? (
          <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
            {!latestExec ? (
              <div style={{ padding: 20, textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 10, lineHeight: 2 }}>
                <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.2 }}>◎</div>
                Press RUN NOW to execute<br />and trace each node
              </div>
            ) : latestExec.nodeResults?.map((r, i) => (
              <div key={i} className="exec-entry" style={{ borderLeftColor: r.pass ? "#00e5a0" : "#ff4d6a" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)" }}>{r.type?.toUpperCase()}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: r.pass ? "#00e5a0" : "#ff4d6a" }}>{r.pass ? "✓ PASS" : "✗ SKIP"}</span>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-label)", marginBottom: 2 }}>{r.label}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-sub)" }}>{r.detail}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
            {(currentStrategy.nodes || []).map(n => (
              <div key={n.id} style={{ padding: "7px 10px", borderRadius: 7, marginBottom: 5, background: "var(--bg-surface)", borderLeft: `2px solid ${NODE_TYPES_COLOR[n.type]}` }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: NODE_TYPES_COLOR[n.type], letterSpacing: "0.1em", marginBottom: 2 }}>{n.type?.toUpperCase()}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-label)" }}>{n.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Node palette */}
        <div style={{ borderTop: "1px solid var(--border-dim)", padding: "10px 12px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.15em", marginBottom: 6 }}>QUICK HELP</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)", lineHeight: 1.8 }}>
            <span style={{ color: "var(--text-sub)" }}>Dbl-click canvas</span> → add node<br />
            <span style={{ color: "var(--text-sub)" }}>Dbl-click node</span> → configure<br />
            <span style={{ color: "var(--text-sub)" }}>Drag bg</span> → pan canvas<br />
            <span style={{ color: "var(--text-sub)" }}>Del / Backspace</span> → delete
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Dashboard Tab ── */
function DashboardView({ candles, prices, executionLog, strategies, orders }) {
  const btcCandles = (candles.BTC || []).slice(-60).map((c, i) => ({ i, price: +c.close.toFixed(0), vol: +c.volume.toFixed(0) }));
  return (
    <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Price chart */}
      <div className="card">
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.12em", marginBottom: 10 }}>BTC/USDT · LIVE FEED</div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={btcCandles}>
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f0b429" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#f0b429" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#0f1e30" strokeDasharray="4 4" />
            <XAxis dataKey="i" hide />
            <YAxis domain={["auto", "auto"]} tick={{ fontFamily: "JetBrains Mono", fontSize: 9, fill: "#3a5470" }} width={68} />
            <Tooltip contentStyle={{ background: "#080d16", border: "1px solid #172438", borderRadius: 6, fontFamily: "JetBrains Mono", fontSize: 10 }} labelStyle={{ color: "#5a7a9a" }} itemStyle={{ color: "#f0b429" }} />
            <Area type="monotone" dataKey="price" stroke="#f0b429" strokeWidth={1.5} fill="url(#g)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {[
          ["ACTIVE STRATS", strategies.filter(s => s.enabled).length, "#00e5a0"],
          ["TOTAL EXECUTIONS", executionLog.length, "#3d9eff"],
          ["TOTAL ORDERS", orders.length, "#a78bfa"],
          ["TRIGGERED", executionLog.filter(e => e.triggered).length, "#f0b429"],
        ].map(([k, v, c]) => (
          <div key={k} className="card" style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 6 }}>{k}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 26, fontWeight: 700, color: c }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Recent orders */}
      <div className="card">
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.12em", marginBottom: 8 }}>RECENT ORDERS</div>
        {orders.slice(0, 5).map(o => (
          <div key={o.id} className="order-row">
            <span className={`badge ${o.side === "BUY" ? "badge-green" : "badge-red"}`}>{o.side}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-label)" }}>{o.symbol}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-body)" }}>{o.qty} @ ${o.price?.toLocaleString()}</span>
            <span className="badge badge-blue">{o.status}</span>
          </div>
        ))}
        {orders.length === 0 && <div style={{ padding: 12, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>No orders yet</div>}
      </div>
    </div>
  );
}

/* ── Orders Tab ── */
function OrdersView({ orders }) {
  return (
    <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
      <div className="card">
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.12em", marginBottom: 10 }}>ORDER HISTORY</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-soft)" }}>
              {["TIME", "SYMBOL", "SIDE", "TYPE", "QTY", "PRICE", "STATUS"].map(h => (
                <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontSize: 8, color: "var(--text-muted)", letterSpacing: "0.1em", fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id} style={{ borderBottom: "1px solid var(--border-dim)" }}>
                <td style={{ padding: "7px 10px", color: "var(--text-sub)" }}>{new Date(o.createdAt).toLocaleTimeString("en", { hour12: false })}</td>
                <td style={{ padding: "7px 10px", color: "var(--text-label)", fontWeight: 600 }}>{o.symbol}</td>
                <td style={{ padding: "7px 10px" }}><span className={`badge ${o.side === "BUY" ? "badge-green" : "badge-red"}`}>{o.side}</span></td>
                <td style={{ padding: "7px 10px", color: "var(--text-body)" }}>{o.type}</td>
                <td style={{ padding: "7px 10px", color: "var(--text-label)" }}>{o.qty}</td>
                <td style={{ padding: "7px 10px", color: "var(--text-label)" }}>${o.price?.toLocaleString()}</td>
                <td style={{ padding: "7px 10px" }}><span className="badge badge-green">{o.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "var(--text-dim)", fontSize: 10 }}>No orders placed yet</div>}
      </div>
    </div>
  );
}

/* ── Portfolio Tab ── */
function PortfolioView({ portfolio, prices }) {
  return (
    <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
      <div className="portfolio-summary">
        {[
          ["BALANCE", `$${Math.round(portfolio.balance || 0).toLocaleString()}`, "var(--text-white)"],
          ["EQUITY", `$${Math.round(portfolio.equity || 0).toLocaleString()}`, "var(--text-white)"],
          ["TOTAL P&L", `${(portfolio.pnl || 0) >= 0 ? "+" : ""}$${Math.round(portfolio.pnl || 0).toLocaleString()}`, portfolio.pnl >= 0 ? "#00e5a0" : "#ff4d6a"],
          ["RETURN", `${(((portfolio.pnl || 0) / 50000) * 100).toFixed(2)}%`, portfolio.pnl >= 0 ? "#00e5a0" : "#ff4d6a"],
        ].map(([k, v, c]) => (
          <div key={k} className="portfolio-stat">
            <div className="portfolio-stat-key">{k}</div>
            <div className="portfolio-stat-val" style={{ color: c }}>{v}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 0 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.12em", marginBottom: 10 }}>OPEN POSITIONS</div>
        {Object.entries(portfolio.positions || {}).map(([sym, pos]) => (
          <div key={sym} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-dim)" }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-bright)", fontWeight: 700 }}>{sym}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-sub)" }}>qty: {pos.qty} · avg: ${pos.avgPrice?.toLocaleString()}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-label)", fontWeight: 600 }}>${Math.round(pos.value || 0).toLocaleString()}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: (pos.pnl || 0) >= 0 ? "#00e5a0" : "#ff4d6a" }}>
                {(pos.pnl || 0) >= 0 ? "+" : ""}${Math.round(pos.pnl || 0).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
