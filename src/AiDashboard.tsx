import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  AlertTriangle, 
  Activity, 
  Zap, 
  MessageSquare, 
  ChevronRight, 
  RefreshCcw,
  Cpu
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { authFetch, currentUser } from './auth'

interface AiInsight {
  id: number;
  system_area: string;
  insight_type: string;
  severity: string;
  summary: string;
  metadata: Record<string, unknown>;
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
      await authFetch('/astra/health'); // Just to check connectivity
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
      const response = await authFetch('/astra/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crew_id: currentUser(), query: input })
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

  const st = {
    wrap: { 
      padding: '24px', 
      color: '#e2e8f0', 
      background: '#0a0f1e', 
      minHeight: '100vh', 
      fontFamily: "'Inter', sans-serif",
      boxSizing: 'border-box'
    } as React.CSSProperties,
    header: { 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      marginBottom: '32px' 
    } as React.CSSProperties,
    headerLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: '16px'
    } as React.CSSProperties,
    logoBox: { 
      padding: '12px', 
      background: 'rgba(34, 211, 238, 0.1)', 
      border: '1px solid rgba(34, 211, 238, 0.2)', 
      borderRadius: '12px', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center' 
    } as React.CSSProperties,
    title: {
      fontSize: '28px',
      fontWeight: 700,
      margin: 0,
      letterSpacing: '-0.02em',
      color: '#fff'
    } as React.CSSProperties,
    subtitle: {
      fontSize: '14px',
      color: '#94a3b8',
      margin: '4px 0 0 0'
    } as React.CSSProperties,
    statusBadge: { 
      padding: '6px 14px', 
      background: 'rgba(52, 211, 153, 0.08)', 
      border: '1px solid rgba(52, 211, 153, 0.25)', 
      borderRadius: '20px', 
      display: 'flex', 
      alignItems: 'center', 
      gap: '8px', 
      fontSize: '13px', 
      fontWeight: 500, 
      color: '#34d399' 
    } as React.CSSProperties,
    statusDot: { 
      width: '8px', 
      height: '8px', 
      borderRadius: '50%', 
      background: '#34d399', 
      boxShadow: '0 0 8px #34d399' 
    } as React.CSSProperties,
    layout: {
      display: 'grid',
      gridTemplateColumns: '1fr',
      gap: '24px'
    } as React.CSSProperties,
    // Desktop layout using dynamic style check or simple responsive grid via standard media rules (handled via flex on big screens)
    desktopLayout: {
      display: 'flex',
      gap: '24px',
      width: '100%'
    } as React.CSSProperties,
    chatColumn: {
      flex: '0 0 380px',
      display: 'flex',
      flexDirection: 'column' as const,
      background: '#0d1526',
      border: '1px solid rgba(34, 211, 238, 0.12)',
      borderRadius: '16px',
      overflow: 'hidden',
      height: '700px',
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)'
    } as React.CSSProperties,
    mainColumn: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '24px'
    } as React.CSSProperties,
    chatHeader: { 
      padding: '16px', 
      borderBottom: '1px solid rgba(34, 211, 238, 0.12)', 
      background: '#111d35', 
      display: 'flex', 
      alignItems: 'center', 
      gap: '10px' 
    } as React.CSSProperties,
    chatHeaderTitle: {
      fontSize: '16px',
      fontWeight: 600,
      margin: 0,
      color: '#fff'
    } as React.CSSProperties,
    chatMessages: { 
      flex: 1, 
      overflowY: 'auto' as const, 
      padding: '16px', 
      display: 'flex', 
      flexDirection: 'column' as const, 
      gap: '16px' 
    } as React.CSSProperties,
    chatInputArea: { 
      padding: '16px', 
      background: '#111d35', 
      borderTop: '1px solid rgba(34, 211, 238, 0.12)' 
    } as React.CSSProperties,
    inputWrapper: {
      position: 'relative' as const
    } as React.CSSProperties,
    input: { 
      width: '100%', 
      background: '#0a0f1e', 
      border: '1px solid rgba(34, 211, 238, 0.25)', 
      borderRadius: '10px', 
      padding: '12px 48px 12px 16px', 
      color: '#e2e8f0', 
      fontSize: '14px', 
      outline: 'none',
      boxSizing: 'border-box' as const
    } as React.CSSProperties,
    sendBtn: {
      position: 'absolute' as const,
      right: '8px',
      top: '50%',
      transform: 'translateY(-50%)',
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      color: '#22d3ee',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '6px'
    } as React.CSSProperties,
    messageRow: (isCrew: boolean): React.CSSProperties => ({
      display: 'flex',
      justifyContent: isCrew ? 'flex-end' : 'flex-start',
      width: '100%'
    }),
    messageBubble: (isCrew: boolean): React.CSSProperties => ({
      maxWidth: '85%',
      padding: '12px 14px',
      borderRadius: '14px',
      borderTopRightRadius: isCrew ? '2px' : '14px',
      borderTopLeftRadius: isCrew ? '14px' : '2px',
      background: isCrew ? 'rgba(34, 211, 238, 0.08)' : '#111d35',
      border: `1px solid ${isCrew ? 'rgba(34, 211, 238, 0.25)' : 'rgba(255,255,255,0.06)'}`,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
    }),
    messageMeta: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      marginBottom: '6px',
      fontSize: '11px',
      fontWeight: 700,
      letterSpacing: '0.05em',
      color: '#94a3b8'
    } as React.CSSProperties,
    messageText: {
      fontSize: '13.5px',
      lineHeight: 1.5,
      margin: 0
    } as React.CSSProperties,
    actionBtn: {
      fontSize: '10px',
      fontWeight: 600,
      background: 'rgba(34, 211, 238, 0.08)',
      color: '#22d3ee',
      border: '1px solid rgba(34, 211, 238, 0.2)',
      borderRadius: '4px',
      padding: '4px 8px',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      marginTop: '8px',
      marginRight: '6px',
      transition: 'all 0.2s'
    } as React.CSSProperties,
    panel: { 
      background: '#0d1526', 
      border: '1px solid rgba(34, 211, 238, 0.12)', 
      borderRadius: '16px', 
      padding: '20px', 
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)' 
    } as React.CSSProperties,
    panelHeader: { 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      marginBottom: '16px', 
      borderBottom: '1px solid rgba(34, 211, 238, 0.06)', 
      paddingBottom: '10px' 
    } as React.CSSProperties,
    panelTitle: {
      fontSize: '16px',
      fontWeight: 600,
      margin: 0,
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    } as React.CSSProperties,
    insightCard: { 
      padding: '14px 16px', 
      background: '#0a0f1e', 
      border: '1px solid rgba(34, 211, 238, 0.06)', 
      borderRadius: '12px', 
      display: 'flex', 
      gap: '14px', 
      marginBottom: '12px',
      alignItems: 'flex-start'
    } as React.CSSProperties,
    actionCard: { 
      padding: '14px 16px', 
      background: '#0a0f1e', 
      border: '1px solid rgba(168, 85, 247, 0.15)', 
      borderRadius: '12px', 
      marginBottom: '16px' 
    } as React.CSSProperties,
    codeBlock: { 
      background: 'rgba(0, 0, 0, 0.3)', 
      fontFamily: "'JetBrains Mono', monospace", 
      fontSize: '11px', 
      padding: '10px', 
      borderRadius: '6px', 
      marginBottom: '10px', 
      color: '#22d3ee', 
      border: '1px solid rgba(34, 211, 238, 0.08)', 
      overflowX: 'auto' as const 
    } as React.CSSProperties,
    heartbeatCard: {
      background: '#0d1526',
      border: '1px solid rgba(34, 211, 238, 0.12)',
      borderRadius: '16px',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center' as const,
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
      position: 'relative' as const,
      overflow: 'hidden'
    } as React.CSSProperties,
    glowingPulse: {
      position: 'absolute' as const,
      width: '120px',
      height: '120px',
      background: 'rgba(34, 211, 238, 0.04)',
      borderRadius: '50%',
      filter: 'blur(20px)',
      animation: 'pulse 3s infinite'
    } as React.CSSProperties,
    pulseDot: {
      width: '10px',
      height: '10px',
      borderRadius: '50%',
      background: '#22d3ee',
      boxShadow: '0 0 10px #22d3ee'
    } as React.CSSProperties
  };

  return (
    <div style={st.wrap}>
      {/* Header bar */}
      <div style={st.header}>
        <div style={st.headerLeft}>
          <div style={st.logoBox}>
            <Cpu className="w-8 h-8 text-cyan-400" style={{ color: '#22d3ee' }} />
          </div>
          <div>
            <h1 style={st.title}>AI & Autonomous Operations</h1>
            <p style={st.subtitle}>Mission Intelligence Hub • Astra v1.1.0</p>
          </div>
        </div>
        <div>
          <div style={st.statusBadge}>
            <div style={st.statusDot} />
            <span>Anomaly Engine Active</span>
          </div>
        </div>
      </div>

      {/* Main Grid split */}
      <div style={st.desktopLayout}>
        
        {/* Left Column: AI Assistant Chat */}
        <div style={st.chatColumn}>
          <div style={st.chatHeader}>
            <MessageSquare className="w-5 h-5" style={{ color: '#22d3ee' }} />
            <h2 style={st.chatHeaderTitle}>Astra Assistant</h2>
          </div>
          
          <div style={st.chatMessages}>
            {messages.map((msg, i) => (
              <div key={i} style={st.messageRow(msg.role === 'crew')}>
                <div style={st.messageBubble(msg.role === 'crew')}>
                  <div style={st.messageMeta}>
                    {msg.role === 'astra' && <Bot className="w-4 h-4" style={{ color: '#22d3ee' }} />}
                    <span style={{ color: msg.role === 'crew' ? '#22d3ee' : '#94a3b8' }}>
                      {msg.role === 'astra' ? 'ASTRA' : 'CREW'}
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: '9px', opacity: 0.6 }}>{msg.timestamp}</span>
                  </div>
                  <p style={st.messageText}>{msg.text}</p>
                  
                  {msg.suggested_actions && (
                    <div style={{ marginTop: '8px' }}>
                      {msg.suggested_actions.map((act, j) => (
                        <button key={j} style={st.actionBtn} onClick={() => setInput(act)}>
                          <ChevronRight className="w-3 h-3" /> {act}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isTyping && (
              <div style={st.messageRow(false)}>
                <div style={{ ...st.messageBubble(false), padding: '8px 12px' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>Astra is analyzing system state...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendMessage} style={st.chatInputArea}>
            <div style={st.inputWrapper}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Query Astra (e.g. 'Status check')"
                style={st.input}
              />
              <button type="submit" style={st.sendBtn}>
                <RefreshCcw className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Insights and Actions */}
        <div style={st.mainColumn}>
          
          <div style={{ display: 'flex', gap: '24px' }}>
            {/* System Heatmap Simulation */}
            <div style={{ ...st.panel, flex: 1 }}>
              <div style={st.panelHeader}>
                <h3 style={st.panelTitle}>
                  <Activity className="w-5 h-5" style={{ color: '#f97316' }} />
                  System Anomaly Scores
                </h3>
                <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#64748b' }}>ISOLATION FOREST REALTIME</span>
              </div>
              <div style={{ height: '180px' }}>
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={10} domain={[0, 1]} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0d1526', border: '1px solid rgba(34, 211, 238, 0.12)', borderRadius: '8px', color: '#e2e8f0' }}
                    />
                    <Area type="monotone" dataKey="score" stroke="#f97316" fillOpacity={1} fill="url(#scoreGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* AI Heartbeat / Status Card */}
            <div style={st.heartbeatCard}>
              <div style={st.glowingPulse} />
              <div style={{ position: 'relative', marginBottom: '16px' }}>
                <Bot className="w-12 h-12" style={{ color: '#22d3ee' }} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px 0', color: '#fff' }}>Astra Core Online</h3>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, maxWidth: '220px', lineHeight: 1.4 }}>
                Evaluating 142 telemetry parameters across active RPi & Jetson nodes.
              </p>
              <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#22d3ee' }}>98%</div>
                  <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Confidence</div>
                </div>
                <div style={{ width: '1px', background: 'rgba(255,255,255,0.08)' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#22d3ee' }}>1.2s</div>
                  <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Latency</div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Insights Feed */}
          <div style={st.panel}>
            <div style={st.panelHeader}>
              <h3 style={st.panelTitle}>
                <AlertTriangle className="w-5 h-5" style={{ color: '#fbbf24' }} />
                AI Insight Feed
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {insights.map(insight => (
                <div key={insight.id} style={st.insightCard}>
                  <div style={{ padding: '8px', background: insight.severity === 'warning' ? 'rgba(251, 191, 36, 0.1)' : 'rgba(34, 211, 238, 0.1)', borderRadius: '8px', display: 'flex' }}>
                    <Activity className="w-4 h-4" style={{ color: insight.severity === 'warning' ? '#fbbf24' : '#22d3ee' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        {insight.system_area} • {insight.insight_type}
                      </span>
                      <span style={{ fontSize: '10px', color: '#64748b' }}>REALTIME</span>
                    </div>
                    <p style={{ fontSize: '13.5px', margin: 0, color: '#e2e8f0', fontWeight: 500 }}>{insight.summary}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Autonomous Actions Timeline */}
          <div style={st.panel}>
            <div style={st.panelHeader}>
              <h3 style={st.panelTitle}>
                <Zap className="w-5 h-5" style={{ color: '#a855f7' }} />
                Autonomous Action Log
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {actions.map(action => (
                <div key={action.id} style={st.actionCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#a855f7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {action.action_type}
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button style={{ fontSize: '9px', fontWeight: 700, padding: '3px 8px', background: 'rgba(248, 113, 113, 0.1)', color: '#f87171', border: '1px solid rgba(248, 113, 113, 0.2)', borderRadius: '4px', cursor: 'pointer' }}>
                        OVERRIDE
                      </button>
                      <button style={{ fontSize: '9px', fontWeight: 700, padding: '3px 8px', background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.2)', borderRadius: '4px', cursor: 'default' }}>
                        VALIDATED
                      </button>
                    </div>
                  </div>
                  <div style={st.codeBlock}>
                    {action.command_issued}
                  </div>
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
                    <span style={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginRight: '6px', fontSize: '10px' }}>Reason:</span>
                    {action.reasoning}
                  </p>
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
