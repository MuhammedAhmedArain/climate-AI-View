import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface ChatMessage { role: 'user' | 'bot'; text: string }

export default function ClimateChatbot() {
  const [open, setOpen] = useState(false);
  const initialGreeting: ChatMessage[] = [
    { role: 'bot', text: 'Hi! Ask me about air quality, carbon footprint reduction, forest cover, water stress, temperature anomalies, or climate education.' }
  ];
  const [messages, setMessages] = useState<ChatMessage[]>(initialGreeting);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    const historyPayload = [...messages, { role: 'user', text: trimmed }];
    setMessages(m => [...m, { role: 'user', text: trimmed }]);
    setInput('');
    setLoading(true);
    try {
      const res = await apiFetch<{ answer: string; message: string; suggestions?: string[] }>("/api/chat/ask", {
        method: 'POST',
        body: JSON.stringify({ message: trimmed, history: historyPayload })
      });
      setMessages(m => [...m, { role: 'bot', text: res.answer }]);
      if (res.suggestions && res.suggestions.length) {
        setMessages(m => [...m, { role: 'bot', text: `Tips: ${res.suggestions.join('; ')}` }]);
      }
    } catch (e: any) {
      setMessages(m => [...m, { role: 'bot', text: e.message || 'Error answering. Try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Reset conversation when closing as requested
    setMessages(initialGreeting);
    setInput('');
  };

  return (
    <>
      {/* Floating toggle button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-50 rounded-full bg-primary text-primary-foreground p-4 shadow-lg hover:shadow-xl transition-all focus:outline-none"
          aria-label="Open climate chat"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}
      {open && (
        <div className="fixed bottom-4 right-4 z-50 w-80 sm:w-96 max-h-[70vh] rounded-xl border bg-background/95 backdrop-blur shadow-xl flex flex-col overflow-hidden">
          {/* Fixed header */}
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/40 shrink-0">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Climate Assistant</span>
            </div>
            <button onClick={handleClose} className="p-1 rounded hover:bg-muted" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* Scrollable messages area */}
          <div ref={listRef} className="flex-1 px-4 py-3 space-y-3 overflow-y-auto text-sm">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-3 py-2 rounded-lg ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{m.text}</div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-lg bg-muted animate-pulse">Thinking…</div>
              </div>
            )}
          </div>
          {/* Fixed footer */}
          <div className="p-3 border-t bg-background/50 shrink-0">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask about AQI, emissions..."
                className="flex-1 bg-muted rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-1"
              >
                <Send className="h-4 w-4" />
                Send
              </button>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">Answers are heuristic climate facts, not personalized advice.</p>
          </div>
        </div>
      )}
    </>
  );
}
