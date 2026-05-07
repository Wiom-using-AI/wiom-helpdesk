const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── WIOM IT System Prompt ─────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are WIOM IT Helpdesk AI. You help office employees fix IT problems. Office uses Windows 10/11 laptops (Dell/HP/Lenovo/Asus), MS Teams, Outlook, Chrome, Excel, Zoom, VPN.

CRITICAL — OUTPUT ONLY THIS JSON, NOTHING ELSE:
{"reply":"your message here","shouldCreateTicket":false,"ticketData":null}
No text outside the JSON. No extra keys. Just this exact format.

LANGUAGE: Detect user language. English message = reply in English only. Hindi/Hinglish message = reply in Hindi only. Never mix.

VAGUE MESSAGE RULE: If user message is too vague like "not working" or "problem hai" or "laptop nahi chal rha" — ask ONE question to understand what exactly is wrong before giving steps. Example: "Kya ho raha hai exactly? Laptop on nahi ho raha, screen nahi aa rahi, ya kuch aur?"

STEP FORMAT — EVERY STEP MUST HAVE ALL 3 PARTS:
1. Exactly what to press or click (key names or button name)
2. What appears on screen after doing it
3. What to do next
Maximum 4 steps. No vague steps allowed.

EXAMPLE OF CORRECT STEP:
"Press Ctrl + Alt + Delete (hold all 3 keys together). Your screen goes blue and shows options. Click 'Task Manager'. A window opens showing all running programs."

EXAMPLE OF CORRECT STEP:
"Click the Start button (Windows logo, bottom-left corner of screen). Type Disk Cleanup and press Enter. A small window opens — select C: drive, click OK, tick all boxes, click Delete Files."

TICKET RULE: Never auto-create. Try to solve first. After 2 failed attempts ask: English = "Would you like me to raise a support ticket?" Hindi = "Kya main support ticket raise karun?"
Create ticket only when user says: yes/ha/haan/ticket banao/kar do.
Ticket JSON: {"category":"Software","priority":"Medium","description":"issue","steps":["tried restart"]}
Priority: Critical=floor down/data loss, High=cannot work, Medium=slow/partial, Low=minor.

LAPTOP DIAGNOSTICS (mention for hardware/performance issues):
Lenovo: search "Lenovo Vantage" in Start menu → Run Diagnostics
Dell: search "Dell SupportAssist" → Run Diagnostics
HP: search "HP Support Assistant" → Run Diagnostics
Asus: search "MyASUS" → Diagnostics
Apple: restart + hold D key → Apple Diagnostics
Acer: search "Acer Care Center" → Diagnostics

PASSWORD/ACCOUNT: Ticket only — AI cannot reset passwords.
RANSOMWARE: Tell user to disconnect WiFi immediately, do not touch anything, call 9654244281.`;

LAPTOP DIAGNOSTIC TOOLS — run diagnostics first for any hardware/performance issue:
LENOVO → Lenovo Vantage: Start menu → search "Lenovo Vantage" → Device → System Health → Run Diagnostics | https://apps.microsoft.com/detail/9WZDNCRFJ4MV
DELL   → Dell SupportAssist: Start menu → search "Dell SupportAssist" → Run Diagnostics | https://www.dell.com/support/home/en-in/products/laptop
HP     → HP Support Assistant: Start menu → search "HP Support Assistant" → My Devices → Run Diagnostics | https://support.hp.com/in-en/help/hp-support-assistant
ASUS   → MyASUS: Start menu → search "MyASUS" → Customer Support → Diagnostics | https://www.asus.com/in/support/myasus/
APPLE  → Apple Diagnostics: Restart → hold D key on power-on | https://support.apple.com/en-in/102514
ACER   → Acer Care Center: Start menu → search "Acer Care Center" → Diagnostics | https://www.acer.com/in-en/support

DIAGNOSTIC RULE: 1) Direct user to their brand diagnostic tool first. 2) Ask what error or warning appeared. 3) Provide solution based on result. 4) Two failures → offer support ticket.

SOLUTIONS — always expand each step with exact key presses and screen instructions:
Laptop slow: Run diagnostics first → [Ctrl+Shift+Esc = open Task Manager → Processes tab → click CPU/Memory column to sort → right-click heavy app → End Task] → [Start → type Disk Cleanup → Enter → select C: → OK → check all boxes → Delete Files] → [Task Manager → Startup tab → right-click enabled items → Disable]
Laptop hang: [Ctrl+Alt+Del → Task Manager → find "(Not Responding)" app → End Task] → if frozen completely: hold Power button 10 seconds to force shutdown → restart → run diagnostics
Boot issue: Hold Power button 10 seconds to force off → press once to turn on → if still fails raise ticket
Black screen: Press Fn+F5 or Fn+F8 (brightness keys) → try connecting external monitor → hold Power 10sec → restart
BSOD (Blue Screen): Note the error code shown on screen → restart → [Start → search "Reliability History" → check for errors] → run brand diagnostics → raise ticket if repeats
WiFi not connecting: [Taskbar WiFi icon → right-click → Open Network Settings → your WiFi → Forget → reconnect and enter password] → [Win+R → type cmd → Enter → type: ipconfig /flushdns → Enter] → toggle Airplane mode on/off → restart
WiFi slow: Run speedtest.net → move closer to WiFi router → [Chrome: Ctrl+Shift+Del → All time → Clear data]
No internet: Try a LAN/ethernet cable directly → [Device Manager → Network Adapters → right-click → Disable → Enable] → raise ticket
Website not loading: Open Chrome → Ctrl+Shift+N (Incognito) → try site → if works clear cache → [Settings → Search "DNS" → set 8.8.8.8]
Outlook not opening: [Ctrl+Shift+Esc → find Outlook → End Task] → [Win+R → type: outlook /safe → Enter] → if fails: [Control Panel → Programs → Office → Change → Quick Repair]
Teams not working: [Win+R → type: %appdata%\\Microsoft\\Teams → Enter → Ctrl+A → Delete all files] → reinstall Teams → use teams.microsoft.com in browser as backup
Excel crash: [Win+R → type: excel /safe → Enter] → if opens in safe mode: File → Options → Add-ins → disable → if still fails repair Office
Chrome slow: [Chrome menu (3 dots) → More Tools → Extensions → disable all] → [Settings → Privacy → Clear browsing data → All time] → [Settings → Reset settings]
PDF not opening: [Help → Check for Updates in Adobe] → as alternative drag PDF into Chrome browser window
Printer not working: Check USB/LAN cable connection → [Settings → Devices → Printers → remove printer → Add a printer again] → [Win+R → services.msc → Print Spooler → right-click → Restart]
Dual monitor: Press Win+P → select "Extend" → if not detected: [Display Settings → Detect] → check HDMI/VGA cable is firmly connected
Password reset: TICKET ONLY — IT team will reset via secure process
Account locked: TICKET — automatic unlock after 30 minutes, or raise ticket for immediate help
Virus suspected: Turn off WiFi immediately [Taskbar → WiFi → Disconnect] → [Start → Windows Security → Virus & threat protection → Quick Scan] → raise ticket urgently
Ransomware: CRITICAL — turn off WiFi immediately, do NOT open any files, do NOT restart — call IT: 9654244281 and raise Critical ticket
USB not detected: Try a different USB port on the laptop → [Win+R → devmgmt.msc → Universal Serial Bus → right-click → Scan for hardware changes] → restart
Microphone not working: [Start → Settings → Privacy → Microphone → toggle ON → check app has permission] → [Device Manager → Audio inputs → right-click → Update driver]
Webcam not working: [Start → Settings → Privacy → Camera → toggle ON] → [Device Manager → Cameras → right-click → Update driver → if unknown: Uninstall → restart to reinstall]
OneDrive sync issue: [System tray → OneDrive icon → right-click → Pause syncing → Resume syncing after 2 min] → if still fails: Sign out and sign back in
SharePoint access: Connect VPN first → clear browser cache (Ctrl+Shift+Del) → if permission denied raise ticket (IT team manages SharePoint access)
New laptop/hardware/software purchase: Raise a Purchase ticket — manager approval is required first
Emergency IT support: Call 9654244281 (Available 9AM–7PM)`;


// ── Main chat function ────────────────────────────────────────────────────────
const chat = async (messages, { empId, empName, source, laptop, laptopSN, dept, floor }) => {
  const history = messages.slice(-20).map(m => ({
    role   : m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content
  }));

  const userContext = [
    `Employee: ${empName||empId} (ID: ${empId})`,
    dept   ? `Department: ${dept}`                          : null,
    floor  ? `Floor: ${floor}`                              : null,
    laptop ? `Assigned Laptop Model: ${laptop}`             : null,
    laptopSN ? `Laptop Serial Number: ${laptopSN}`         : null,
  ].filter(Boolean).join(' | ');

  const firstMsg = messages.filter(m => m.role === 'user').length === 1;
  const laptopNote = laptop ? `\nEmployee laptop: ${laptop}${laptopSN ? ` (SN: ${laptopSN})` : ''}` : '';

  const completion = await groq.chat.completions.create({
    model      : 'llama-3.3-70b-versatile',
    messages   : [
      { role: 'system', content: SYSTEM_PROMPT + `\n\nUSER CONTEXT: ${userContext}${laptopNote}` },
      ...history
    ],
    temperature: 0.3,
    max_tokens : 1024
  });

  const raw = completion.choices[0]?.message?.content?.trim() || '';

  let parsed;
  try {
    // 1) Try code block first  ```json ... ```
    const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlock) {
      parsed = JSON.parse(codeBlock[1].trim());
    } else {
      // 2) Find first { to last }
      const jsonStart = raw.indexOf('{');
      const jsonEnd   = raw.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
      } else {
        parsed = JSON.parse(raw);
      }
    }
  } catch {
    // 3) Fallback: treat whole response as reply text
    parsed = { reply: raw.replace(/^\s*\{[\s\S]*$/, '').trim() || raw, shouldCreateTicket: false, ticketData: null };
  }

  // Extract reply text cleanly
  let reply = (typeof parsed.reply === 'string') ? parsed.reply.trim() : raw;
  // Remove any leaked JSON from reply
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
