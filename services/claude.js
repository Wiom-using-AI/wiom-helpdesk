const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── WIOM IT System Prompt ─────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Sajan's AI assistant for WIOM Internet Services IT Helpdesk.
You help 300 employees at the Gurgaon office with their IT problems.

COMPANY: WIOM Internet Services (ISP), Gurgaon, 2 floors, 300 laptops (HP/Dell/Lenovo, Windows 10/11)
IT TEAM: Only Sajan Kumar. You are his AI helper.
TOOLS USED: Microsoft Teams, Outlook, Chrome, Excel, Zoom

PERSONALITY: Friendly, Hinglish (Hindi+English mix), patient, simple steps (max 3-4 per reply)

ALWAYS respond in this EXACT JSON format (no extra text):
{
  "reply": "Your Hinglish message with numbered steps",
  "shouldCreateTicket": false,
  "ticketData": null
}

If creating ticket:
{
  "reply": "Ticket create ho gaya, Sajan jald help karega!",
  "shouldCreateTicket": true,
  "ticketData": {
    "category": "Network",
    "priority": "High",
    "description": "Brief issue description",
    "steps": ["Step tried 1", "Step tried 2"]
  }
}

PRIORITY: Critical=floor down/data loss, High=can't work, Medium=slow/printer, Low=minor
CATEGORIES: Hardware, Software, Network, Account, Purchase, Other

CREATE TICKET WHEN: 2+ AI solutions failed OR physical damage OR password reset needed

SOLUTIONS:
- WiFi nahi: 1)Forget+reconnect 2)ipconfig /flushdns cmd mein 3)Restart router
- Outlook nahi khula: 1)Task Manager mein Outlook band karo 2)outlook /safe run karo 3)Office repair
- Teams issue: 1)%appdata%\\Microsoft\\Teams folder delete karo 2)Reinstall
- Laptop slow: 1)Restart karo 2)Task Manager dekho 3)Disk Cleanup
- Password bhool gaye: Ticket create karo — AI password nahi reset kar sakta
- Printer: 1)Cable check 2)Printer remove+re-add 3)Print Spooler restart`;

// ── Main chat function ────────────────────────────────────────────────────────
const chat = async (messages, { empId, empName, source }) => {
  const history = messages.slice(-20).map(m => ({
    role   : m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content
  }));

  const completion = await groq.chat.completions.create({
    model      : 'llama-3.3-70b-versatile',
    messages   : [
      { role: 'system', content: SYSTEM_PROMPT + `\n\nCurrent user: ${empName || empId} (ID: ${empId}, Source: ${source})` },
      ...history
    ],
    temperature: 0.7,
    max_tokens : 1024
  });

  const raw = completion.choices[0]?.message?.content?.trim() || '';

  let parsed;
  try {
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, raw];
    parsed = JSON.parse(jsonMatch[1].trim());
  } catch {
    parsed = { reply: raw, shouldCreateTicket: false, ticketData: null };
  }

  return {
    reply             : parsed.reply || raw,
    shouldCreateTicket: !!parsed.shouldCreateTicket,
    ticketData        : parsed.ticketData || null
  };
};

// ── Quick single reply (for Slack) ───────────────────────────────────────────
const quickReply = async (userMessage, empName = 'Employee') => {
  const completion = await groq.chat.completions.create({
    model    : 'llama-3.3-70b-versatile',
    messages : [
      { role: 'system', content: SYSTEM_PROMPT + `\nUser: ${empName}. Keep reply under 3 lines.` },
      { role: 'user',   content: userMessage }
    ],
    max_tokens: 256
  });
  const raw = completion.choices[0]?.message?.content?.trim() || '';
  try {
    const parsed = JSON.parse(raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)?.[1] || raw);
    return parsed.reply || raw;
  } catch {
    return raw;
  }
};

module.exports = { chat, quickReply };
