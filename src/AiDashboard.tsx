import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  AlertTriangle, 
  Activity, 
  Zap, 
  MessageSquare, 
  ChevronRight, 
  RefreshCcw,
  ShieldCheck,
  Cpu
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

interface AiInsight {
  id: number;
  system_area: string;
  insight_type: string;
  severity: string;
  summary: string;
  metadata: any;
  created_at: string;
}

interface AutoAction {
  id: number;
  action_type: string;
  command_issued: string;
  reasoning: string;
  status: string;
  created_at: string;
}

interface ChatMessage {
  role: 'astra' | 'crew';
  text: string;
  timestamp: string;
  suggested_actions?: string[];
}

const AiDashboard: React.FC = () => {
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [actions, setActions] = useState<AutoAction[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { 
      role: 'astra', 
      text: "Astra AI Online. I am monitoring all habitat systems. How can I assist with the mission today?", 
      timestamp: new Date().toLocaleTimeString() 
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchInsights();
    fetchActions();
    const interval = setInterval(() => {
      fetchInsights();
      fetchActions();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchInsights = async () => {
    try {
      // In a real app, we'd have a specific GET endpoint for insights
      // For now, we simulate fetching from the Mission Assistant's broader context
      const res = await fetch('/astra/health'); // Just to check connectivity
      // Mock data if API is still warming up in docker
      setInsights([
        { 
          id: 1, system_area: 'eclss', insight_type: 'anomaly', severity: 'warning', 
          summary: 'CO2 concentration diverging from occupancy model in Lab Zone.',
          metadata: { score: 0.82 }, created_at: new Date().toISOString() 
        },
        { 
          id: 2, system_area: 'power', insight_type: 'prediction', severity: 'info', 
          summary: 'Solar array efficiency expected to drop by 4% due to dust trending.',
          metadata: { confidence: 0.95 }, created_at: new Date().toISOString() 
        }
      ]);
    } catch (e) { console.error(e); }
  };

  const fetchActions = async () => {
    // Simulating fetching autonomous actions
    setActions([
      {
        id: 1, action_type: 'hvac_adjust', command_issued: 'SET flow_rate = 120%',
        reasoning: 'CO2 trending above habitability baseline while crew is active.',
        status: 'EXECUTED', created_at: new Date().toISOString()
      }
    ]);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const crewMsg: ChatMessage = {
      role: 'crew',
      text: input,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, crewMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch('/astra/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crew_id: 'COMMANDER', query: input })
      });
      const data = await response.json();
      
      setMessages(prev => [...prev, {
        role: 'astra',
        text: data.text,
        timestamp: new Date().toLocaleTimeString(),
        suggested_actions: data.suggested_actions
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'astra',
        text: "I am having trouble accessing the core mission database. Please verify system connectivity.",
        timestamp: new Date().toLocaleTimeString()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="p-6 bg-slate-900 text-slate-100 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/20 rounded-lg">
            <Cpu className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AI & Autonomous Operations</h1>
            <p className="text-slate-400">Mission Intelligence Hub • Astra v1.1.0</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-500 text-sm font-medium">Anomaly Engine Active</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: AI Assistant Chat */}
        <div className="lg:col-span-4 flex flex-col bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden h-[700px]">
          <div className="p-4 border-b border-slate-700/50 bg-slate-800 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-400" />
            <h2 className="font-semibold text-lg">Astra Assistant</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'crew' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl ${
                  msg.role === 'crew' 
                    ? 'bg-blue-600/20 border border-blue-500/30' 
                    : 'bg-slate-700/50 border border-slate-600/50'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    {msg.role === 'astra' && <Bot className="w-4 h-4 text-blue-400" />}
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {msg.role === 'astra' ? 'ASTRA' : 'CREW'}
                    </span>
                    <span className="text-[10px] text-slate-500 ml-auto">{msg.timestamp}</span>
                  </div>
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                  
                  {msg.suggested_actions && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {msg.suggested_actions.map((act, j) => (
                        <button key={j} className="text-[10px] bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded px-2 py-1 flex items-center gap-1 transition-colors">
                          <ChevronRight className="w-3 h-3" /> {act}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-slate-700/50 p-3 rounded-2xl flex gap-1 items-center">
                  <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                  <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                  <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-4 bg-slate-800 border-t border-slate-700/50">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Query Astra (e.g. 'Status check')"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
              />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-400 hover:text-blue-300">
                <RefreshCcw className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Insights and Actions */}
        <div className="lg:col-span-8 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* System Heatmap Simulation */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Activity className="w-5 h-5 text-orange-400" />
                  System Anomaly Scores
                </h3>
                <span className="text-[10px] font-mono text-slate-500 uppercase">Isolation Forest Realtime</span>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={[
                    { time: '0m', score: 0.1 },
                    { time: '5m', score: 0.2 },
                    { time: '10m', score: 0.8 },
                    { time: '15m', score: 0.4 },
                    { time: '20m', score: 0.3 },
                  ]}>
                    <defs>
                      <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={10} domain={[0, 1]} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    />
                    <Area type="monotone" dataKey="score" stroke="#f97316" fillOpacity={1} fill="url(#scoreGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* AI Heartbeat / Status Card */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 flex flex-col justify-center items-center text-center">
              <div className="relative mb-4">
                <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full scale-150 animate-pulse" />
                <Bot className="w-16 h-16 text-blue-400 relative z-10" />
              </div>
              <h3 className="text-xl font-bold mb-1">Astra Intelligence Online</h3>
              <p className="text-slate-400 text-sm max-w-[200px]">Currently evaluating 142 sensor streams across 3 modules.</p>
              <div className="mt-6 flex gap-4">
                <div className="text-center">
                  <div className="text-lg font-bold">98%</div>
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Confidence</div>
                </div>
                <div className="w-px h-8 bg-slate-700" />
                <div className="text-center">
                  <div className="text-lg font-bold">1.2s</div>
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Latency</div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Insights Feed */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              AI Insight Feed
            </h3>
            <div className="space-y-3">
              {insights.map(insight => (
                <div key={insight.id} className="p-4 bg-slate-900 border border-slate-700 rounded-xl flex gap-4">
                  <div className={`p-2 rounded-lg ${insight.severity === 'warning' ? 'bg-yellow-500/10' : 'bg-blue-500/10'}`}>
                    <Activity className={`w-5 h-5 ${insight.severity === 'warning' ? 'text-yellow-400' : 'text-blue-400'}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold uppercase text-slate-500">{insight.system_area} • {insight.insight_type}</span>
                      <span className="text-[10px] text-slate-500">Just Now</span>
                    </div>
                    <p className="text-sm font-medium">{insight.summary}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Autonomous Actions Timeline */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-400" />
              Autonomous Action Log
            </h3>
            <div className="space-y-4">
              {actions.map(action => (
                <div key={action.id} className="relative pl-8 before:absolute before:left-3 before:top-2 before:bottom-0 before:w-px before:bg-slate-700 last:before:hidden">
                  <div className="absolute left-0 top-0 p-1.5 bg-purple-500/20 border border-purple-500/30 rounded-full z-10">
                    <ShieldCheck className="w-3 h-3 text-purple-400" />
                  </div>
                  <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-purple-400 uppercase tracking-tighter">{action.action_type}</span>
                      <div className="flex gap-2">
                        <button className="text-[10px] font-bold px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20 transition-colors">OVERRIDE</button>
                        <button className="text-[10px] font-bold px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded">VALIDATED</button>
                      </div>
                    </div>
                    <div className="bg-black/30 font-mono text-[11px] p-2 rounded mb-2 text-blue-300">
                      {action.command_issued}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      <span className="text-slate-500 font-bold uppercase mr-1 text-[10px]">Reason:</span> {action.reasoning}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AiDashboard;
