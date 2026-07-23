'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './whatsapp.module.css';

interface Message {
  id: number;
  from: 'user' | 'bot';
  text: string;
  time: string;
}

const initialMessages: Message[] = [
  { id: 1, from: 'bot', text: 'Welcome to ShelfWatch! 👋\n\nSend me a product barcode or scan code to verify its authenticity.\n\nType "help" for available commands.', time: '14:01' },
  { id: 2, from: 'user', text: '8901030873874', time: '14:02' },
  { id: 3, from: 'bot', text: '🔍 Scanning barcode: 8901030873874...\n\n✅ *GENUINE* — HealthCare Pro 500mg\n\n📋 Batch: HP-221-KHI\n📅 Expiry: 12/2027\n🏭 Factory: KHI-F4 (Karachi)\n🎯 Confidence: 99%\n\nThis product is authentic and safe for consumption.', time: '14:02' },
];

const botResponses: Record<string, string> = {
  default: '🔍 Scanning your product...\n\n⚠️ *SUSPICIOUS* — Potential anomaly detected\n\nBatch Code appears blurry. Please verify manually or contact brand support.',
  help: '📱 *ShelfWatch Bot Commands:*\n\n• Send a barcode number to verify\n• Type "history" to see recent scans\n• Type "report" to file a complaint\n• Type "contact" to reach support',
  history: '📜 *Recent Scan History:*\n\n1. HealthCare Pro — ✅ Genuine\n2. VitaPlus — ✅ Genuine\n3. Unknown — ⚠️ Suspicious\n\nType a barcode to scan a new product.',
  report: '🚨 *Report a Fake Product:*\n\nYour report has been submitted to the brand protection team. Reference: RPT-2026-4891\n\nThank you for helping protect consumers!',
};

export default function WhatsAppBotPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const now = () => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg: Message = { id: Date.now(), from: 'user', text: input.trim(), time: now() };
    setMessages(prev => [...prev, userMsg]);
    const query = input.toLowerCase().trim();
    setInput('');
    setTyping(true);
    await new Promise(r => setTimeout(r, 1200));
    const botText = botResponses[query] || botResponses.default;
    const botMsg: Message = { id: Date.now() + 1, from: 'bot', text: botText, time: now() };
    setMessages(prev => [...prev, botMsg]);
    setTyping(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className={styles.page}>
      <div className={styles.chatContainer}>
        {/* Header */}
        <div className={styles.chatHeader}>
          <div className={styles.botAvatar}>
            <span className="material-symbols-outlined">smart_toy</span>
          </div>
          <div className={styles.botInfo}>
            <div className={styles.botName}>ShelfWatch Bot</div>
            <div className={styles.botStatus}>
              <span className={styles.statusDot}></span>
              Online — Powered by AI
            </div>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.headerBtn}>
              <span className="material-symbols-outlined">videocam</span>
            </button>
            <button className={styles.headerBtn}>
              <span className="material-symbols-outlined">call</span>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className={styles.messagesArea}>
          <div className={styles.dateSeparator}>Today</div>
          {messages.map(msg => (
            <div key={msg.id} className={msg.from === 'user' ? styles.userBubbleWrapper : styles.botBubbleWrapper}>
              {msg.from === 'bot' && (
                <div className={styles.botAvatarSmall}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>smart_toy</span>
                </div>
              )}
              <div className={msg.from === 'user' ? styles.userBubble : styles.botBubble}>
                <p style={{ whiteSpace: 'pre-line', margin: 0 }}>{msg.text}</p>
                <span className={styles.msgTime}>{msg.time}</span>
              </div>
            </div>
          ))}
          {typing && (
            <div className={styles.botBubbleWrapper}>
              <div className={styles.botAvatarSmall}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>smart_toy</span>
              </div>
              <div className={styles.botBubble}>
                <div className={styles.typingDots}>
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef}></div>
        </div>

        {/* Input Area */}
        <div className={styles.inputArea}>
          <div className={styles.quickReplies}>
            {['help', 'history', 'report'].map(q => (
              <button key={q} className={styles.quickReply} onClick={() => { setInput(q); }}>
                {q}
              </button>
            ))}
          </div>
          <div className={styles.inputRow}>
            <button className={styles.attachBtn}>
              <span className="material-symbols-outlined">attach_file</span>
            </button>
            <textarea
              className={styles.input}
              placeholder="Type a barcode or message..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={1}
            />
            <button className={styles.sendBtn} onClick={sendMessage} disabled={!input.trim()}>
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
