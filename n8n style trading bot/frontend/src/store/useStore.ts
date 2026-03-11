import { create } from 'zustand';
export interface FlowNode { id:string; type:string; label:string; x:number; y:number; config:Record<string,string>; status:'idle'|'pass'|'skip'|'active'; }
export interface FlowEdge { id:string; from:string; to:string; }
interface Store {
  nodes:FlowNode[]; edges:FlowEdge[]; selected:string|null;
  setNodes:(n:FlowNode[])=>void; setEdges:(e:FlowEdge[])=>void; setSelected:(id:string|null)=>void;
  updateNode:(id:string,p:Partial<FlowNode>)=>void; addNode:(n:FlowNode)=>void; deleteNode:(id:string)=>void;
  tickers:Record<string,{price:number;prev:number}>;
  updateTicker:(pair:string,price:number)=>void;
  bots:any[]; activeBotId:string|null; setBots:(b:any[])=>void; setActiveBotId:(id:string|null)=>void;
  backtestResult:any|null; backtestLoading:boolean;
  setBacktestResult:(r:any)=>void; setBacktestLoading:(v:boolean)=>void;
  execLog:any[]; addLogEntry:(e:any)=>void; clearLog:()=>void;
  running:boolean; setRunning:(v:boolean)=>void;
  activeTab:'log'|'config'|'backtest'; setActiveTab:(t:'log'|'config'|'backtest')=>void;
  editId:string|null; setEditId:(id:string|null)=>void;
  showAddMenu:boolean; setShowAddMenu:(v:boolean)=>void;
}
export const useStore = create<Store>((set)=>({
  nodes:[], edges:[], selected:null,
  setNodes:(nodes)=>set({nodes}), setEdges:(edges)=>set({edges}), setSelected:(selected)=>set({selected}),
  updateNode:(id,p)=>set(s=>({nodes:s.nodes.map(n=>n.id===id?{...n,...p}:n)})),
  addNode:(node)=>set(s=>({nodes:[...s.nodes,node]})),
  deleteNode:(id)=>set(s=>({nodes:s.nodes.filter(n=>n.id!==id),edges:s.edges.filter(e=>e.from!==id&&e.to!==id),selected:s.selected===id?null:s.selected})),
  tickers:{'BTC/USDT':{price:64821,prev:64821},'ETH/USDT':{price:3412,prev:3412},'SOL/USDT':{price:182,prev:182}},
  updateTicker:(pair,price)=>set(s=>({tickers:{...s.tickers,[pair]:{price,prev:s.tickers[pair]?.price??price}}})),
  bots:[], activeBotId:null, setBots:(bots)=>set({bots}), setActiveBotId:(activeBotId)=>set({activeBotId}),
  backtestResult:null, backtestLoading:false,
  setBacktestResult:(backtestResult)=>set({backtestResult}), setBacktestLoading:(backtestLoading)=>set({backtestLoading}),
  execLog:[], addLogEntry:(e)=>set(s=>({execLog:[e,...s.execLog].slice(0,100)})), clearLog:()=>set({execLog:[]}),
  running:false, setRunning:(running)=>set({running}),
  activeTab:'log', setActiveTab:(activeTab)=>set({activeTab}),
  editId:null, setEditId:(editId)=>set({editId}),
  showAddMenu:false, setShowAddMenu:(showAddMenu)=>set({showAddMenu}),
}));
