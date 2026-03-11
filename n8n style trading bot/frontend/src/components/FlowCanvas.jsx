/**
 * FlowCanvas.jsx
 * ──────────────
 * SVG-based node graph editor.
 * Handles: drag, pan, node rendering, edge drawing, selection.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import "../styles/canvas.css";

/* ── Constants ── */
const NW = 200, NH = 78;
const NODE_TYPES = {
  trigger:   { label: "Trigger",   color: "#f0b429", dim: "#2d1e04", icon: "◈", glyph: "TRG" },
  condition: { label: "Condition", color: "#3d9eff", dim: "#0a2444", icon: "⬡", glyph: "CND" },
  indicator: { label: "Indicator", color: "#a78bfa", dim: "#1e1040", icon: "◎", glyph: "IND" },
  action:    { label: "Action",    color: "#00e5a0", dim: "#003d28", icon: "▶", glyph: "ACT" },
  alert:     { label: "Alert",     color: "#ff4d6a", dim: "#3d0010", icon: "◉", glyph: "ALT" },
};
const PRESETS = {
  trigger:   ["Price crosses above","Price crosses below","Volume spike detected","Time interval","Market open/close"],
  condition: ["RSI > 70 overbought","RSI < 30 oversold","MACD bullish cross","Price above EMA 50","Bollinger squeeze"],
  indicator: ["RSI (14 period)","MACD (12,26,9)","EMA 50 / EMA 200","Bollinger Bands (20,2)","ATR Volatility"],
  action:    ["Buy Market Order","Sell Market Order","Buy Limit Order","Sell Limit Order","Close All Positions"],
  alert:     ["Send Email","Telegram Message","Discord Webhook","Push Notification","REST API Callback"],
};
const out = n => ({ x: n.x + NW, y: n.y + NH / 2 });
const inp = n => ({ x: n.x,      y: n.y + NH / 2 });
const cubic = (a, b) => { const mx = (a.x + b.x) / 2; return `M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`; };

/* ── Sparkline ── */
const SPARK = [12,18,14,22,16,10,20,14,18,24,16,20,22,15,26,18,22,28,20,24];
function Spark({ color }) {
  const mx = Math.max(...SPARK), mn = Math.min(...SPARK);
  const pts = SPARK.map((v, i) => `${(i / (SPARK.length - 1)) * 68},${18 - ((v - mn) / (mx - mn)) * 14}`);
  return (
    <svg width="72" height="22" style={{ display: "block" }}>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" opacity="0.5" />
      <circle cx={pts.at(-1).split(",")[0]} cy={pts.at(-1).split(",")[1]} r="2.5" fill={color} />
    </svg>
  );
}

/* ── Single Node ── */
function FlowNode({ node, selected, running, onMouseDown, onDoubleClick }) {
  const t = NODE_TYPES[node.type];
  const sc = node.status === "pass" ? "#00e5a0" : node.status === "skip" ? "#ff4d6a" : null;
  return (
    <g transform={`translate(${node.x},${node.y})`} style={{ cursor: "grab" }}
      onMouseDown={onMouseDown} onDoubleClick={onDoubleClick}>
      {selected && <rect x={-4} y={-4} width={NW + 8} height={NH + 8} rx={14} fill="none" stroke={t.color} strokeWidth={1.5} opacity={0.4} />}
      <rect x={2} y={5} width={NW} height={NH} rx={10} fill="rgba(0,0,0,0.5)" />
      <rect width={NW} height={NH} rx={10} fill="#0c1420" stroke={selected ? t.color : "#172438"} strokeWidth={selected ? 1.5 : 1} />
      <rect x={10} y={0} width={NW - 20} height={2} rx={1} fill={t.color} opacity={selected ? 0.9 : 0.3} />
      <rect x={0} y={10} width={3} height={NH - 20} rx={1.5} fill={t.color} opacity={0.8} />
      {sc && <><circle cx={NW - 14} cy={13} r={5} fill={sc} opacity={0.9} /><circle cx={NW - 14} cy={13} r={8} fill={sc} opacity={0.12} /></>}
      <rect x={12} y={11} width={32} height={17} rx={4} fill={t.dim} stroke={t.color} strokeWidth={0.6} />
      <text x={28} y={23} textAnchor="middle" fontSize={8} fontFamily="'JetBrains Mono',monospace" fill={t.color} fontWeight="bold" letterSpacing={1}>{t.glyph}</text>
      <text x={52} y={29} fontSize={11} fontFamily="'JetBrains Mono',monospace" fill="#b8d0e8" fontWeight="bold">{node.label.length > 19 ? node.label.slice(0, 18) + "…" : node.label}</text>
      {node.config?.asset && <text x={52} y={44} fontSize={9} fontFamily="'JetBrains Mono',monospace" fill="#5a7a9a">{node.config.asset}{node.config.value ? ` · $${node.config.value}` : ""}</text>}
      {node.config?.amount && !node.config?.asset && <text x={52} y={44} fontSize={9} fontFamily="'JetBrains Mono',monospace" fill="#5a7a9a">qty: {node.config.amount}</text>}
      {node.config?.period && <text x={52} y={44} fontSize={9} fontFamily="'JetBrains Mono',monospace" fill="#5a7a9a">period: {node.config.period}</text>}
      <g transform={`translate(${NW - 78},${NH - 26})`} opacity={0.45}><Spark color={t.color} /></g>
      {node.type !== "trigger" && <><circle cx={0} cy={NH / 2} r={7} fill="#04080f" stroke="#1e3450" strokeWidth={1} /><circle cx={0} cy={NH / 2} r={3} fill="#1e3450" /></>}
      {node.type !== "alert" && <><circle cx={NW} cy={NH / 2} r={7} fill="#04080f" stroke={t.color} strokeWidth={1} opacity={0.7} /><circle cx={NW} cy={NH / 2} r={3} fill={t.color} opacity={0.7} /></>}
    </g>
  );
}

/* ── Edge ── */
function FlowEdge({ edge, nodes, active }) {
  const f = nodes.find(n => n.id === edge.from), t = nodes.find(n => n.id === edge.to);
  if (!f || !t) return null;
  const d = cubic(out(f), inp(t));
  const fc = NODE_TYPES[f.type].color;
  return (
    <g>
      <path d={d} fill="none" stroke="#04080f" strokeWidth={6} />
      <path d={d} fill="none" stroke="#172438" strokeWidth={2} />
      {active && (
        <>
          <path d={d} fill="none" stroke={fc} strokeWidth={1.5} strokeDasharray="10 6" opacity={0.65} className="edge-animated" />
          <path d={d} fill="none" stroke={fc} strokeWidth={5} opacity={0.05} />
        </>
      )}
    </g>
  );
}

/* ── Main component ── */
export default function FlowCanvas({ nodes, edges, onNodesChange, onEdgesChange, running, executionNodes }) {
  const [selected, setSelected] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [dragOff, setDragOff] = useState({ x: 0, y: 0 });
  const [pan, setPan] = useState({ x: 60, y: 40 });
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, ox: 0, oy: 0 });
  const [addMenu, setAddMenu] = useState(null); // { x, y } screen pos
  const [editNode, setEditNode] = useState(null);
  const svgRef = useRef();
  const nextId = useRef(100);

  // Merge execution status into display nodes
  const displayNodes = nodes.map(n => ({
    ...n,
    status: executionNodes?.find(en => en.nodeId === n.id)?.pass === true ? "pass"
          : executionNodes?.find(en => en.nodeId === n.id)?.pass === false ? "skip"
          : "idle",
  }));

  const svgPos = useCallback((cx, cy) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return { x: cx, y: cy };
    return { x: cx - r.left - pan.x, y: cy - r.top - pan.y };
  }, [pan]);

  const onMM = useCallback(e => {
    if (panning) { setPan({ x: panStart.x + e.clientX - panStart.ox, y: panStart.y + e.clientY - panStart.oy }); return; }
    if (!dragging) return;
    const p = svgPos(e.clientX, e.clientY);
    onNodesChange(nodes.map(n => n.id === dragging ? { ...n, x: p.x - dragOff.x, y: p.y - dragOff.y } : n));
  }, [dragging, dragOff, svgPos, panning, panStart, nodes, onNodesChange]);

  const onMU = useCallback(() => { setDragging(null); setPanning(false); }, []);

  const startNodeDrag = useCallback((e, id) => {
    e.stopPropagation();
    const p = svgPos(e.clientX, e.clientY);
    const n = nodes.find(x => x.id === id);
    setDragging(id); setDragOff({ x: p.x - n.x, y: p.y - n.y });
    setSelected(id);
  }, [nodes, svgPos]);

  const onBgMouseDown = useCallback(e => {
    setPanning(true);
    setPanStart({ x: pan.x, y: pan.y, ox: e.clientX, oy: e.clientY });
    setSelected(null);
  }, [pan]);

  const onBgDblClick = useCallback(e => {
    const r = svgRef.current?.getBoundingClientRect();
    setAddMenu({ screenX: e.clientX, screenY: e.clientY, svgX: e.clientX - r.left - pan.x, svgY: e.clientY - r.top - pan.y });
  }, [pan]);

  const addNode = type => {
    const id = `n${nextId.current++}`;
    const newNode = { id, type, x: addMenu.svgX - NW / 2, y: addMenu.svgY - NH / 2, label: PRESETS[type][0], config: {} };
    onNodesChange([...nodes, newNode]);
    setAddMenu(null);
  };

  const deleteSelected = useCallback(() => {
    if (!selected) return;
    onNodesChange(nodes.filter(n => n.id !== selected));
    onEdgesChange(edges.filter(e => e.from !== selected && e.to !== selected));
    setSelected(null);
  }, [selected, nodes, edges, onNodesChange, onEdgesChange]);

  useEffect(() => {
    const handler = e => { if (e.key === "Delete" || e.key === "Backspace") deleteSelected(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [deleteSelected]);

  const en = editNode ? nodes.find(n => n.id === editNode) : null;

  return (
    <div className="canvas-wrapper" onClick={() => setAddMenu(null)}>
      <svg ref={svgRef} className="canvas-svg" onMouseMove={onMM} onMouseUp={onMU}
        onMouseDown={onBgMouseDown} onDoubleClick={onBgDblClick}>
        <defs>
          <pattern id="g1" width={28} height={28} patternUnits="userSpaceOnUse" x={pan.x % 28} y={pan.y % 28}>
            <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#0a1020" strokeWidth="0.8" />
          </pattern>
          <pattern id="g2" width={140} height={140} patternUnits="userSpaceOnUse" x={pan.x % 140} y={pan.y % 140}>
            <path d="M 140 0 L 0 0 0 140" fill="none" stroke="#0c1828" strokeWidth="1" />
          </pattern>
          <radialGradient id="vig" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="100%" stopColor="rgba(4,8,15,0.7)" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="#04080f" />
        <rect width="100%" height="100%" fill="url(#g2)" />
        <rect width="100%" height="100%" fill="url(#g1)" />
        <rect width="100%" height="100%" fill="url(#vig)" style={{ pointerEvents: "none" }} />
        <g transform={`translate(${pan.x},${pan.y})`}>
          {edges.map(e => <FlowEdge key={e.id} edge={e} nodes={nodes} active={running} />)}
          {displayNodes.map(n => (
            <FlowNode key={n.id} node={n} selected={selected === n.id} running={running}
              onMouseDown={e => startNodeDrag(e, n.id)}
              onDoubleClick={e => { e.stopPropagation(); setEditNode(n.id); }} />
          ))}
        </g>
      </svg>

      {/* Canvas toolbar */}
      <div className="canvas-toolbar">
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>
          DBL-CLICK canvas to add node · DEL to remove · Drag to move
        </span>
        {selected && (
          <button className="btn btn-danger" style={{ padding: "3px 10px", fontSize: 9 }} onClick={deleteSelected}>
            ✕ DELETE
          </button>
        )}
      </div>

      {/* Add-node popup */}
      {addMenu && (
        <div className="add-node-menu" style={{ top: addMenu.screenY, left: addMenu.screenX }} onClick={e => e.stopPropagation()}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-muted)", padding: "4px 10px 8px", letterSpacing: "0.12em", borderBottom: "1px solid var(--border-dim)", marginBottom: 4 }}>
            ADD NODE
          </div>
          {Object.entries(NODE_TYPES).map(([k, v]) => (
            <div key={k} className="add-node-item" onClick={() => addNode(k)}>
              <div className="add-node-icon" style={{ background: v.dim, border: `1px solid ${v.color}40` }}>
                <span style={{ color: v.color }}>{v.icon}</span>
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-label)" }}>{v.label}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)" }}>{PRESETS[k][0]}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Node config drawer */}
      {en && (
        <div style={{ position: "absolute", top: 12, right: 12, width: 240, background: "var(--bg-panel)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-lg)", padding: 14, boxShadow: "0 16px 48px rgba(0,0,0,0.8)", animation: "slideIn 0.2s ease", zIndex: 200 }}
          onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: NODE_TYPES[en.type].color }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: NODE_TYPES[en.type].color, letterSpacing: "0.1em" }}>
              {NODE_TYPES[en.type].label.toUpperCase()} CONFIG
            </span>
            <button className="btn btn-ghost" style={{ marginLeft: "auto", padding: "2px 8px", fontSize: 10 }} onClick={() => setEditNode(null)}>✕</button>
          </div>
          <label>PRESET</label>
          <select value={en.label} onChange={e => onNodesChange(nodes.map(n => n.id === editNode ? { ...n, label: e.target.value } : n))} style={{ marginBottom: 10 }}>
            {PRESETS[en.type].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {Object.entries(en.config || {}).map(([field, val]) => (
            <div key={field} style={{ marginBottom: 8 }}>
              <label>{field.toUpperCase()}</label>
              <input value={val} onChange={e => onNodesChange(nodes.map(n => n.id === editNode ? { ...n, config: { ...n.config, [field]: e.target.value } } : n))} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { NODE_TYPES, PRESETS };
