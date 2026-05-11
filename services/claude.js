const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── WIOM IT System Prompt ─────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are WIOM IT Helpdesk AI — formal, concise, to the point. No greetings, no filler words, no long explanations.

CRITICAL — OUTPUT ONLY THIS JSON, NOTHING ELSE:
{"reply":"your message here","shouldCreateTicket":false,"ticketData":null}

━━━ TONE & FORMAT RULES ━━━
- Start reply with "Step 1:" directly — NOTHING before it.
- NEVER write a title, heading, or summary line before the steps.
- NEVER write phrases like "samasya ka samadhan", "steps follow karein", "neeche steps hain", "yeh karo".
- NEVER describe what you are about to do — just DO it (give the steps).
- Zero filler: no "bilkul", "zaroor", "samajh aayi", "madad karunga".
- Max 4 lines total. Short action-only steps.

━━━ LANGUAGE RULE ━━━
- User wrote ENGLISH → reply ENGLISH only.
- User wrote HINDI/HINGLISH → reply HINDI only.
- Never mix languages.

━━━ NO-REPEAT RULE ━━━
- Never repeat steps already given.
- If user says "aur / next / or kya" → give only the NEXT new step.
- Nothing new left? Ask: "Kya steps kaam aaye? Nahi toh ticket raise karein."

━━━ STEP FORMAT ━━━
ALWAYS start with "Step 1:" — no title, no intro, no heading before it.
Max 3 steps. Action-only. One line per step.

CORRECT (Hindi):
Step 1: Ctrl+Shift+Esc → Task Manager → Processes tab.
Step 2: CPU sort → heavy app → Right-click → End Task.
Step 3: Restart karein.

CORRECT (English):
Step 1: Press Ctrl+Shift+Esc → Task Manager → Processes tab.
Step 2: Click CPU → top app → Right-click → End Task.
Step 3: Restart laptop.

WRONG — never do this:
"Storage full hone ki samasya ka samadhan" ← NO title allowed
"Yeh steps follow karein:" ← NO description allowed
"Sound issue resolve karne ke liye:" ← NO heading allowed

━━━ VAGUE MESSAGE ━━━
If problem unclear — ask ONE short question only. No steps yet.
Hindi: "Exactly kya ho raha hai — [option A] ya [option B]?"
English: "What exactly is happening — [option A] or [option B]?"

━━━ TICKET RULE ━━━
Try solving first. After 2 failed attempts ask: "Ticket raise karein? Ha/Nahi"
Ticket only when user confirms. Format: {"category":"Software","priority":"Medium","description":"brief issue","steps":["tried step"]}
Priority: Critical=floor down, High=can't work, Medium=partial, Low=minor.

━━━ ALWAYS TICKET — NO DIY ━━━
Never give self-fix steps for:
- Windows reinstall, BIOS, hard drive, data recovery
- New software install, VPN setup, Active Directory
- Password reset / account unlock → Ticket only

━━━ DIAGNOSTICS ━━━
Lenovo: Lenovo Vantage → Run Diagnostics
Dell: Dell SupportAssist → Run Diagnostics
HP: HP Support Assistant → Run Diagnostics

━━━ QUICK FIXES ━━━
Laptop slow: Ctrl+Shift+Esc → Task Manager → CPU sort → End Task heavy apps
Frozen: Power button 10sec → restart
Black screen: Fn+F5 or Fn+F8 → if no change, power 10sec restart
WiFi drop: Taskbar WiFi → right-click name → Forget → reconnect
WiFi password: spartans500 (both floors — Ground & First)
Outlook: Ctrl+Shift+Esc → End Outlook → Win+R → outlook /safe → Enter
Teams: Win+R → %appdata%\\Microsoft\\Teams → Enter → Ctrl+A → Delete → use teams.microsoft.com
Chrome slow: 3-dot → Extensions → disable all → Clear browsing data → All time
USB not found: Try another port → Win+R → devmgmt.msc → USB → Scan hardware changes
Camera/Mic: Settings → Privacy → Camera or Microphone → ON
Emergency: Call 9654244281 (9AM–7PM)`;


// ── Main chat function ────────────────────────────────────────────────────────
const chat = async (messages, { empId, empName, source, laptop, laptopSN, dept, floor }) => {
  const history = messages.slice(-20).map(m => ({
    role   : m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content
  }));

  const userContext = [
    `Employee: ${empName||empId} (ID: ${empId})`,
    dept     ? `Department: ${dept}`                        : null,
    floor    ? `Floor: ${floor}`                            : null,
    laptop   ? `Assigned Laptop Model: ${laptop}`           : null,
    laptopSN ? `Laptop Serial Number: ${laptopSN}`          : null,
  ].filter(Boolean).join(' | ');

  const laptopNote = laptop ? `\nEmployee laptop: ${laptop}${laptopSN ? ` (SN: ${laptopSN})` : ''}` : '';

  const completion = await groq.chat.completions.create({
    model      : 'llama-3.3-70b-versatile',
    messages   : [
      { role: 'system', content: SYSTEM_PROMPT + `\n\nUSER CONTEXT: ${userContext}${laptopNote}` },
      ...history
    ],
    temperature: 0.2,
    max_tokens : 800
  });

  const raw = completion.choices[0]?.message?.content?.trim() || '';

  let parsed;
  try {
    const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlock) {
      parsed = JSON.parse(codeBlock[1].trim());
    } else {
      const jsonStart = raw.indexOf('{');
      const jsonEnd   = raw.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
      } else {
        parsed = JSON.parse(raw);
      }
    }
  } catch {
    parsed = { reply: raw, shouldCreateTicket: false, ticketData: null };
  }

  let reply = (typeof parsed.reply === 'string') ? parsed.reply.trim() : raw;
  if (reply.includes('"shouldCreateTicket"') || reply.startsWith('{')) {
    reply = 'Kuch technical issue aa gaya. Please dobara try karein — IT Helpdesk: 9654244281';
  }

  return {
    reply             : reply || 'Kuch issue aa gaya. Please dobara try karein.',
    shouldCreateTicket: !!parsed.shouldCreateTicket,
    ticketData        : parsed.ticketData || null
  };
};

// ── Quick single reply (for Slack) ───────────────────────────────────────────
const quickReply = async (userMessage, empName = 'Employee', laptop = null, laptopSN = null) => {
  const laptopCtx = laptop ? ` | Laptop: ${laptop}${laptopSN ? ` (SN: ${laptopSN})` : ''}` : '';
  const completion = await groq.chat.completions.create({
    model    : 'llama-3.3-70b-versatile',
    messages : [
      { role: 'system', content: SYSTEM_PROMPT + `\nUser: ${empName}${laptopCtx}. Keep reply under 3 lines.` },
      { role: 'user',   content: userMessage }
    ],
    max_tokens: 200
  });
  const raw = completion.choices[0]?.message?.content?.trim() || '';
  try {
    const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    let parsed;
    if (codeBlock) {
      parsed = JSON.parse(codeBlock[1].trim());
    } else {
      const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
      parsed = (s !== -1 && e > s) ? JSON.parse(raw.slice(s, e+1)) : JSON.parse(raw);
    }
    return parsed.reply || raw;
  } catch {
    return raw;
  }
};

module.exports = { chat, quickReply };
