import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Send,
  ShieldCheck,
  TrendingUp,
  Target,
  ArrowRight,
  Info,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  Bot,
  User,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';

interface HealthScoreData {
  overall_score: number;
  category: 'poor' | 'fair' | 'good' | 'excellent';
  savings_score: number;
  emergency_score: number;
  debt_score: number;
  goal_score: number;
  summary: string;
}

interface RecommendationItem {
  id: string;
  category: string;
  priority: string;
  title: string;
  summary: string;
  expected_impact: string;
  effort: string;
  action: string;
}

interface ChatMessage {
  sender: 'user' | 'advisor';
  text: string;
  time: string;
}

export const AdvisorPage: React.FC = () => {
  const [healthScore, setHealthScore] = useState<HealthScoreData | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: 'advisor',
      text: 'Hello! I am your INARI AI Financial Advisor. Ask me anything about your cash flow, emergency runway, goal timelines, or spending optimizations.',
      time: 'Just now',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [asking, setAsking] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [h, r] = await Promise.all([
          api.getHealthScore(),
          api.getRecommendations(),
        ]);
        setHealthScore(h);
        setRecommendations(r.recommendations);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSend = async (questionText?: string) => {
    const q = (questionText || inputText).trim();
    if (!q || asking) return;

    const userMsg: ChatMessage = {
      sender: 'user',
      text: q,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');

    try {
      setAsking(true);
      const res = await api.askAdvisor(q);
      const advisorMsg: ChatMessage = {
        sender: 'advisor',
        text: res.answer,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, advisorMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'advisor',
          text: `Error analyzing request: ${err.message}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setAsking(false);
    }
  };

  const sampleQuestions = [
    'How is my emergency fund runway?',
    'How can I improve my savings rate?',
    'What happens if I cut dining out?',
    'Are my active goals achievable?',
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 font-mono text-xs text-[#64748b]">
        <div className="w-8 h-8 border-2 border-[#ff3b12] border-t-transparent rounded-full animate-spin" />
        <p>Loading AI Advisor & Health Assessment...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Notice */}
      <div className="p-4 rounded-xl bg-amber-50/70 border-l-4 border-[#ff3b12] border-y border-r border-amber-200/80 flex items-start gap-3 shadow-sm">
        <Info className="w-5 h-5 text-[#ff3b12] shrink-0 mt-0.5" />
        <p className="font-mono text-xs text-[#64748b] leading-relaxed">
          <strong className="text-[#0f172a]">Educational AI Advisor:</strong> Powered by the INARI intelligence engine. Answers questions strictly using your living money model data without recommending specific investment securities or speculative assets.
        </p>
      </div>

      {/* Top Grid: Health Score Card & Summary */}
      {healthScore && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Health Score Gauge */}
          <div className="md:col-span-4 p-6 rounded-xl bg-white border border-[#e2e8f0] flex flex-col justify-between shadow-sm">
            <div>
              <div className="font-mono text-xs text-[#64748b] uppercase tracking-wider mb-2 font-medium">
                Financial Health Score
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-archivo font-extrabold text-[#0f172a]">
                  {healthScore.overall_score}
                </span>
                <span className="font-mono text-sm text-[#64748b]">/ 100</span>
              </div>
              <div className="mt-2">
                <span
                  className={`font-mono text-xs font-bold uppercase px-2.5 py-0.5 rounded border ${
                    healthScore.category === 'excellent'
                      ? 'bg-emerald-50 text-[#059669] border-emerald-200'
                      : healthScore.category === 'good'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {healthScore.category} Condition
                </span>
              </div>
            </div>

            <p className="font-mono text-xs text-[#475569] mt-4 pt-4 border-t border-[#e2e8f0] leading-relaxed">
              {healthScore.summary}
            </p>
          </div>

          {/* 4 Health Breakdown Bars */}
          <div className="md:col-span-8 p-6 rounded-xl bg-white border border-[#e2e8f0] space-y-4 shadow-sm">
            <h3 className="font-archivo font-bold text-sm text-[#0f172a] uppercase tracking-wider mb-2">
              Health Factor Breakdown (Max 25 pts each)
            </h3>

            <div className="space-y-3 font-mono text-xs">
              {/* Savings */}
              <div>
                <div className="flex justify-between text-[#64748b] mb-1">
                  <span>Savings Velocity</span>
                  <span className="text-[#0f172a] font-bold">{healthScore.savings_score} / 25</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                  <div className="bg-[#059669] h-full" style={{ width: `${(healthScore.savings_score / 25) * 100}%` }} />
                </div>
              </div>

              {/* Emergency Buffer */}
              <div>
                <div className="flex justify-between text-[#64748b] mb-1">
                  <span>Emergency Fund Adequacy</span>
                  <span className="text-[#0f172a] font-bold">{healthScore.emergency_score} / 25</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                  <div className="bg-[#2563eb] h-full" style={{ width: `${(healthScore.emergency_score / 25) * 100}%` }} />
                </div>
              </div>

              {/* Fixed Commitments */}
              <div>
                <div className="flex justify-between text-[#64748b] mb-1">
                  <span>Fixed Commitments Ratio</span>
                  <span className="text-[#0f172a] font-bold">{healthScore.debt_score} / 25</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                  <div className="bg-[#d97706] h-full" style={{ width: `${(healthScore.debt_score / 25) * 100}%` }} />
                </div>
              </div>

              {/* Goal Pacing */}
              <div>
                <div className="flex justify-between text-[#64748b] mb-1">
                  <span>Goal Delivery Pacing</span>
                  <span className="text-[#0f172a] font-bold">{healthScore.goal_score} / 25</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                  <div className="bg-[#ff3b12] h-full" style={{ width: `${(healthScore.goal_score / 25) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2-Column: AI Advisor Chat Box & Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: AI Advisor Interactive Chat (7 cols) */}
        <div className="lg:col-span-7 p-6 rounded-xl bg-white border border-[#e2e8f0] space-y-4 flex flex-col h-[580px] shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0]">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-[#ff3b12]" />
              <h3 className="font-archivo font-bold text-base text-[#0f172a]">AI Financial Advisor</h3>
            </div>
            <span className="font-mono text-[10px] text-[#059669] flex items-center gap-1 font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#059669] animate-pulse" />
              Online
            </span>
          </div>

          {/* Quick Prompt Pills */}
          <div className="flex flex-wrap gap-2 pb-2">
            {sampleQuestions.map((sq, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(sq)}
                className="px-2.5 py-1 rounded bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#475569] hover:text-[#0f172a] font-mono text-[11px] transition-colors border border-slate-200"
              >
                {sq}
              </button>
            ))}
          </div>

          {/* Chat Messages Feed */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 font-mono text-xs">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-3 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.sender === 'advisor' && (
                  <div className="w-7 h-7 rounded-full bg-[#ff3b12]/10 text-[#ff3b12] flex items-center justify-center shrink-0 mt-0.5 border border-[#ff3b12]/20">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`p-3.5 rounded-xl max-w-lg leading-relaxed shadow-sm ${
                    m.sender === 'user'
                      ? 'bg-[#ff3b12] text-white rounded-tr-none font-semibold'
                      : 'bg-[#f8fafc] text-[#1e293b] border border-[#e2e8f0] rounded-tl-none'
                  }`}
                >
                  <div>{m.text}</div>
                  <div className={`text-[9px] mt-1 ${m.sender === 'user' ? 'text-white/80' : 'text-[#64748b]'}`}>
                    {m.time}
                  </div>
                </div>
                {m.sender === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-[#0f172a] text-white flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
            {asking && (
              <div className="flex items-center gap-2 text-[#64748b] font-mono text-xs">
                <div className="w-2 h-2 rounded-full bg-[#ff3b12] animate-bounce" />
                <span>Advisor analyzing living profile...</span>
              </div>
            )}
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2 pt-2 border-t border-[#e2e8f0]"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask a question about your living financial model..."
              className="flex-1 p-3 rounded-lg bg-white border border-[#cbd5e1] font-mono text-xs text-[#0f172a] focus:outline-none focus:border-[#ff3b12] focus:ring-1 focus:ring-[#ff3b12]"
            />
            <button
              type="submit"
              disabled={asking || !inputText.trim()}
              className="px-4 py-3 rounded-lg bg-[#ff3b12] hover:bg-[#e0340f] text-white disabled:opacity-40 transition-colors shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Right Column: Recommendations Deck (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] space-y-4 shadow-sm">
            <div className="flex items-center gap-2 pb-3 border-b border-[#e2e8f0]">
              <Lightbulb className="w-4 h-4 text-[#ff3b12]" />
              <h3 className="font-archivo font-bold text-sm text-[#0f172a] uppercase tracking-wider">
                Personalized Recommendations
              </h3>
            </div>

            <div className="space-y-4 font-mono text-xs">
              {recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="p-4 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] space-y-2 hover:border-slate-300 transition-all shadow-sm"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase tracking-wider text-[#64748b] font-medium">{rec.category}</span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                        rec.priority === 'High' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {rec.priority} Priority
                    </span>
                  </div>
                  <h4 className="font-archivo font-bold text-sm text-[#0f172a]">{rec.title}</h4>
                  <p className="text-[#475569] leading-relaxed">{rec.summary}</p>
                  <div className="pt-2 border-t border-[#e2e8f0] flex justify-between items-center text-[11px]">
                    <span className="text-[#059669] font-bold">{rec.expected_impact}</span>
                    <Link
                      to="/dashboard/planner"
                      className="text-[#ff3b12] hover:underline flex items-center gap-1 font-bold"
                    >
                      <span>Simulate</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
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
