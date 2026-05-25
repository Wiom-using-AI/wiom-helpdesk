const Groq      = require('groq-sdk');
const Anthropic = require('@anthropic-ai/sdk');

const groq      = new Groq({ apiKey: process.env.GROQ_API_KEY });
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// ── Active model display (logged on first call) ──────────────────────────────
let modelLogged = false;
const activeModel = () => anthropic ? 'claude-3-5-haiku-20241022 (Anthropic)' : 'llama-3.3-70b-versatile (Groq)';

// ── WIOM IT System Prompt ─────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Zivon — WIOM's IT helpdesk assistant on Slack. You talk like a smart, warm IT colleague — NOT a bot reading a script.

━━━ YOUR PERSONALITY ━━━
Think of yourself as the friendly IT person in the office who actually knows their stuff.
- You're patient, never condescending
- You ask ONE follow-up question when you need more info — not five
- You remember what was said earlier in the conversation (check history!)
- You give ONE step at a time, wait for response, then give next
- When something is fixed, you genuinely feel happy
- When something is serious, you're honest and calm

━━━ CONVERSATION STYLE — MOST IMPORTANT ━━━

RULE 1 — ASK BEFORE YOU ASSUME
If problem is vague → ask ONE smart question first:
"Laptop slow hai? Kab se ho raha hai — aaj se ya kuch dino se?"
"WiFi nahi chal raha? Connected dikh raha hai taskbar mein?"
"Camera nahi chal raha? Kaunsa app mein — Teams, Zoom, ya sab mein?"

RULE 2 — ONE STEP AT A TIME
Give 1-2 steps → wait for response → then next step
"Ctrl+Shift+Esc dabao — Task Manager khulega. Jo sabse zyada CPU le raha ho usse End Task karo. Karo batao!"
NOT: a wall of 5 steps at once

RULE 3 — USE CONVERSATION HISTORY
If user said "nahi hua" / "nahi chala" / "same problem" → you KNOW what issue they have from history.
Don't ask again — give next specific step for THAT problem.
"Acha, task manager wala nahi hua? Tab startup apps band karte hain — Settings → Apps → Startup → sab off karo → restart."

RULE 4 — NATURAL LANGUAGE
Hindi/Hinglish user → same language back
English user → English back
Vary your openers: "Acha", "Haan", "Got it", "Dekho", "Try karo ye"
Vary your closers: "Karo batao!", "Ho gaya?", "Batao!", sometimes nothing
NEVER: "Step 1:", "Step 2:", "Yeh steps follow karein:"

RULE 5 — WHEN ISSUE IS RESOLVED
User says "ho gaya" / "theek hai" / "chal gaya" → celebrate briefly, ask if anything else
"Acha! Sahi hua 😊 Koi aur cheez hai?"
DON'T give more steps when user says it's fixed!

━━━ TONE ━━━
- Office-appropriate, warm — "yaar", "bhai", "arre" BANNED always
- Short replies — max 3-4 lines usually
- Be confident: "ye karo, ho jaayega" not "aap try kar sakte hain"
- Reassuring: "Hota hai", "Koi baat nahi", "Simple fix hai"

━━━ FOLLOW-UP QUESTION EXAMPLES ━━━
"Internet nahi chal raha" → "WiFi icon taskbar mein dikh raha hai connected? Ya disconnected?"
"Laptop slow hai" → "Kab se ho raha hai? Aur koi specific app mein ya poora laptop?"
"Camera nahi chal raha" → "Kaunsa app mein — Teams/Zoom, ya sab mein nahi?"
"Password bhool gaya" → "Windows ka password ya kisi aur account ka — Gmail, email?"
"Screen black hai" → "Laptop on hai (power LED dikh raha hai)? Ya puri tarah band lagta hai?"

━━━ WIOM SPECIFIC FACTS ━━━
WiFi password: spartans500 (all networks)
Networks: "Wiom office 5g-Test" (Ground floor) | "Wiom office Guest" | "Wiom office 3rd floor" | "Wiomnet-Saket" (password: Password@12345)
IT Admin: Sajan Kumar | Phone: 9654244281 | Email: sajan.kumar@wiom.in
NEVER mention router/ethernet/modem/cable — only laptop-side Windows fixes

━━━ TROUBLESHOOTING KNOWLEDGE ━━━
Slow laptop: Ctrl+Shift+Esc → End Task heavy CPU apps → restart. If fails: Startup apps disable → restart. Still slow = RAM/SSD issue → ticket
WiFi not working: WiFi toggle OFF→ON → forget network → reconnect (spartans500). Fails: Device Manager → Network Adapters → WiFi → Disable→Enable. Fails: netsh winsock reset → restart
Blue screen: Note error code → restart (usually fixes). 3+ times = ticket immediately
Black screen: Fn+F5/F8 brightness keys → power hold 10sec restart → HDMI external monitor test
Battery not charging: Replug charger both ends → different socket → shutdown→remove charger→hold power 30sec→reconnect
Fan not working: Shut down NOW, remove charger — hardware risk, ticket immediately
Overheating: Hard surface only (not bed/sofa) → End Task heavy apps → Balanced power mode
Teams: System tray quit → reopen. Fails: %appdata%\Microsoft\Teams → delete Cache folder
Outlook: outlook /safe → Repair account. Fails: outlook.office365.com browser fallback
Camera: Settings→Privacy→Camera→ON → Teams/Zoom Settings→Video→select camera. Fails: Device Manager→Cameras→Disable→Enable
Keyboard: Restart → osk (on-screen keyboard temp). Fails: Device Manager→Keyboards→Uninstall→restart
Printer: OFF→ON → Print Spooler restart (services.msc). Fails = ticket
Storage full: cleanmgr C: → %temp% delete → Recycle Bin empty
Password Windows/email: Ticket only — IT resets
Password Google: myaccount.google.com → Security → Password (self-service)
Account locked: Ticket only — IT unlocks
VPN/Remote access: Ticket only — IT configures
Software install: Ticket only — IT permission required
USB not working: Different port → Device Manager→USB→Uninstall→Scan for changes
Bluetooth: Settings toggle OFF→ON → Device Manager→Bluetooth→Disable→Enable
Virus/Malware: Windows Security→Quick Scan → disconnect internet if serious → ticket

━━━ TICKET RULES ━━━
Say "Type karo *ha*, main IT ko bhej deta hoon 🎫" — nothing else
NEVER say "Ticket raised/created/submitted successfully"
NEVER show fake IDs
Give fix attempts first — suggest ticket after 2 failures

━━━ SCOPE ━━━
Non-IT topics → "IT problems mein help karta hoon 😊 Tech issue hai?"
Ticket status → "IT team dekh rahi hai — type karo *my tickets* for status 📋"
Compliments/thanks → warm 1-line reply, ask if more help needed
Bye/done → "Theek hai! Koi bhi issue aaye toh batana 😊"`;




// ── Extract steps already tried (to prevent repeats) ─────────────────────────
const extractTriedSteps = (messages) => {
  const assistantMsgs = messages.filter(m => m.role === 'assistant');
  if (assistantMsgs.length === 0) return '';
  const steps = [];
  assistantMsgs.forEach(msg => {
    const matches = msg.content.match(/Step \d+:[^\n]+/g);
    if (matches) steps.push(...matches.map(s => s.trim()));
  });
  if (steps.length === 0) return '';
  return `\n\n⚠️ STEPS ALREADY TRIED IN THIS CONVERSATION (DO NOT REPEAT ANY OF THESE):\n${steps.join('\n')}\nGive completely different steps from the above.`;
};


// ── Static KB Fallback (when both AI providers fail) ─────────────────────────
const getKBFallback = (problem) => {
  const p = problem.toLowerCase();
  if (p.includes('slow') || p.includes('hang') || p.includes('freez'))
    return `Laptop slow/hang fix! 🔧\nStep 1: Ctrl+Shift+Esc → CPU column sort karo → heavy app Right-click → End Task.\nStep 2: Win+R → type temp → Ctrl+A → Delete karo.\nStep 3: Laptop restart karo.\nScript button neeche hai — ek click mein automatic fix! ⬇️`;
  if (p.includes('wifi') || p.includes('internet') || p.includes('network'))
    return `WiFi fix! 📶\nStep 1: Taskbar WiFi click → OFF karo → ON karo.\nStep 2: Apna network select karo:\n   Ground floor: "Wiom office 5g-Test" → Password: spartans500\n   Guest: "Wiom office Guest" → Password: spartans500\n   3rd floor: "Wiom office 3rd floor" → Password: spartans500\n   Saket office: "Wiomnet" → Password: Password@12345\nStep 3: Kaam nahi hua toh laptop restart karo.\nClick the script button below! ⬇️`;
  if (p.includes('sound') || p.includes('audio') || p.includes('speaker') || p.includes('headphone'))
    return `Sound fix! 🔊\nStep 1: Taskbar speaker icon Right-click → Sound settings.\nStep 2: Output device → sahi device select karo.\nStep 3: Volume 0% nahi honi chahiye — check karo.\nClick the script button below! ⬇️`;
  if (p.includes('blue screen') || p.includes('bsod'))
    return `Blue Screen fix! 💙\nStep 1: Error code note karo jo screen par tha.\nStep 2: Laptop restart karo — akbar mein theek ho jata hai.\nStep 3: 3 baar se zyada hua toh ticket raise karo.\nClick the script button below! ⬇️`;
  if (p.includes('battery') || p.includes('charg'))
    return `Battery fix! 🔋\nStep 1: Charger dono taraf firmly lagao.\nStep 2: Alag power socket try karo.\nStep 3: Laptop band karo → charger lagao → 30 sec wait → on karo.\nClick the script button below! ⬇️`;
  if (p.includes('black screen') || p.includes('no display'))
    return `Black screen fix! 🖥️\nStep 1: Fn+F5 ya Fn+F8 (brightness keys) dabao.\nStep 2: Koi change nahi → power button 10sec hold → restart.\nStep 3: Baad mein bhi kuch nahi → ticket raise karo.\nClick the script button below! ⬇️`;
  if (p.includes('keyboard') || p.includes('keys'))
    return `Keyboard fix! ⌨️\nStep 1: Laptop restart karo.\nStep 2: Win+R → osk → on-screen keyboard se kaam chalao.\nStep 3: Device Manager → Keyboards → Update driver.\nClick the script button below! ⬇️`;
  if (p.includes('touchpad') || p.includes('mouse'))
    return `Touchpad fix! 🖱️\nStep 1: Fn + touchpad key (lock icon wali) dabao.\nStep 2: Settings → Bluetooth & devices → Touchpad → ON.\nStep 3: Laptop restart karo.\nClick the script button below! ⬇️`;
  if (p.includes('printer'))
    return `Printer fix! 🖨️\nStep 1: Settings → Bluetooth & devices → Printers → right-click → Set as default.\nStep 2: Win+R → services.msc → Print Spooler → Restart.\nStep 3: Dubara print karo.\nClick the script button below! ⬇️`;
  if (p.includes('teams'))
    return `Teams fix! 📹\nStep 1: System tray → Teams icon right-click → Quit → reopen.\nStep 2: Win+R → %appdata%\\Microsoft\\Teams → Cache folder delete karo.\nStep 3: teams.microsoft.com browser mein kholo (web fallback).\nClick the script button below! ⬇️`;
  if (p.includes('zoom'))
    return `Zoom fix! 🎥\nStep 1: Zoom band karo → dobara kholo.\nStep 2: Internet check karo → zoom.us/wc/join browser mein try karo.\nStep 3: Zoom Settings → Audio/Video → sahi device select karo.\nClick the script button below! ⬇️`;
  if (p.includes('outlook') || p.includes('email'))
    return `Outlook fix! 📧\nStep 1: Ctrl+Shift+Esc → Outlook process end karo.\nStep 2: Win+R → outlook /safe → Enter.\nStep 3: outlook.office365.com browser mein try karo.\nClick the script button below! ⬇️`;
  if (p.includes('password') || p.includes('locked') || p.includes('login'))
    return `Google account password reset ! 🔐\nStep 1: myaccount.google.com pe jaao\nStep 2: Security tab click karo\nStep 3: "How you sign in to Google" mein Password click karo\nStep 4: Current password enter karo (ya fingerprint/prompt se verify karo)\nStep 5: Naya password set karo\n\nAgar nahi hua: raise ticket — IT help karega 🎫`;
  if (p.includes('bluetooth'))
    return `Bluetooth fix! 🔵\nStep 1: Settings → Bluetooth → toggle OFF → ON karo.\nStep 2: Device dobara pair karo.\nStep 3: Device Manager → Bluetooth → Disable → Enable.\nClick the script button below! ⬇️`;
  if (p.includes('camera') || p.includes('camra') || p.includes('webcam') || /\bcam\b/.test(p))
    return `Settings → Privacy → Camera → ON karo 📷 Teams/Zoom mein Settings → Video → sahi camera select hai? Device Manager → Cameras → Disable → Enable karo. Batao kaise raha!`;
  if (p.includes('mic') || p.includes('microphone'))
    return `Microphone fix! 🎤\nStep 1: Settings → Privacy → Microphone → ON karo.\nStep 2: Sound settings → Input → sahi mic select karo.\nStep 3: Teams: Settings → Devices → mic test karo.\nClick the script button below! ⬇️`;
  if (p.includes('usb') || p.includes('pendrive'))
    return `USB fix! 🔌\nStep 1: Alag USB port mein try karo.\nStep 2: Device Manager → Universal Serial Bus → Uninstall → Scan for hardware changes.\nStep 3: Laptop restart karo.\nClick the script button below! ⬇️`;
  if (p.includes('storage') || p.includes('disk full'))
    return `Storage cleanup ! 💾\nStep 1: Win+R → cleanmgr → C: → Clean system files.\nStep 2: Win+R → %temp% → Ctrl+A → Delete.\nStep 3: Recycle Bin empty karo.\nClick the script button below! ⬇️`;
  if (p.includes('virus') || p.includes('malware') || p.includes('antivirus'))
    return `Virus scan ! 🦠\nStep 1: Windows Security kholo → Virus & threat protection.\nStep 2: Quick Scan karo → wait karo.\nStep 3: Serious lag raha → raise a ticket: type *raise ticket* 🎫\nClick the script button below! ⬇️`;
  if (p.includes('kaise ho') || p.includes('kaisa hai') || p.includes('how are you') || p.includes('kya haal'))
    return 'Theek hoon! Batao kya IT problem hai, help karta hoon 😊';
  if (p.includes('thanks') || p.includes('shukriya') || p.includes('thank you') || p.includes('dhanyawad'))
    return 'Khushi hui! Koi aur IT problem ho toh batao 😊';
  if (/^(hello|hi+|hey|namaste|namaskar|hlo|helo)\s*[!.]*$/i.test(p.trim()))
    return 'Hello! Kya IT problem hai — batao, abhi help karta hoon 😊';
  if (/\b(kise|kaun)\s*(ho|hain|hai)\b/i.test(p) || /\b(tum|aap)\s*(kya|kise|kaun)\b/i.test(p))
    return `Main *Zivon* hoon — WIOM ka IT helpdesk assistant ⚡\nLaptop, WiFi, software, password — kisi bhi IT problem mein help karta hoon.\nBatao kya issue hai! 😊`;
  if (p.includes('sajan') || p.includes('admin') || p.includes('it head') || p.includes('phone number') || p.includes('number do'))
    return 'Sajan Kumar — WIOM IT Admin\nPhone: 9654244281\nEmail: sajan.kumar@wiom.in\nTicket ke liye type karo: *raise ticket*';
  // Generic fallback — restart covers 80% of issues
  return `Pehle ek baar laptop restart karo 🔄 — zyada tar issues isse theek ho jaate hain. Nahi hua toh thoda aur detail mein batao kya problem hai, main specific help karunga! 😊`;
};

// ── Call Claude (Anthropic) ───────────────────────────────────────────────────
const callClaude = async (systemPrompt, history) => {
  if (!anthropic) throw new Error('Anthropic client not initialized');
  const response = await anthropic.messages.create({
    model     : 'claude-3-5-sonnet-20241022',  // upgraded: ChatGPT-level intelligence
    max_tokens: 400,                             // shorter = faster + more natural
    system    : systemPrompt,
    messages  : history
  });
  const text = response.content?.[0]?.text?.trim();
  if (!text) throw new Error('Empty response from Claude');
  return text;
};


// ── Call Groq (LLaMA fallback) ────────────────────────────────────────────────
const callGroq = async (systemPrompt, history) => {
  const completion = await groq.chat.completions.create({
    model      : 'llama-3.3-70b-versatile',  // upgraded: much smarter fallback
    messages   : [{ role: 'system', content: systemPrompt }, ...history],
    temperature: 0.4,   // slightly more natural/varied responses
    max_tokens : 300
  });
  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty response from Groq');
  return text;
};


// ── Parse JSON from raw model output ─────────────────────────────────────────
const parseOutput = (raw) => {
  try {
    const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlock) return JSON.parse(codeBlock[1].trim());
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    if (s !== -1 && e > s) return JSON.parse(raw.slice(s, e + 1));
    return JSON.parse(raw);
  } catch {
    return { reply: raw, shouldCreateTicket: false, ticketData: null };
  }
};


// ── Main chat function ────────────────────────────────────────────────────────
const chat = async (messages, { empId, empName, source, laptop, laptopSN, dept, floor }) => {
  if (!modelLogged) {
    console.log(`🤖 AI Model: ${activeModel()}`);
    modelLogged = true;
  }

  // Last 30 messages for full context (was 20 before)
  const history = messages.slice(-30).map(m => ({
    role   : m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content
  }));

  const userContext = [
    `Employee: ${empName || empId} (ID: ${empId})`,
    dept     ? `Department: ${dept}`                   : null,
    floor    ? `Floor: ${floor}`                        : null,
    laptop   ? `Assigned Laptop: ${laptop}`             : null,
    laptopSN ? `Serial Number: ${laptopSN}`             : null,
  ].filter(Boolean).join(' | ');

  // Build steps-already-tried list so model never repeats them
  const triedSteps = extractTriedSteps(messages);

  const systemPrompt = SYSTEM_PROMPT
    + `\n\nUSER CONTEXT: ${userContext}`
    + (laptop ? `\nEmployee laptop: ${laptop}${laptopSN ? ` (SN: ${laptopSN})` : ''}` : '')
    + triedSteps;

  // Use Groq directly (fast) — Claude only if ANTHROPIC_API_KEY set
  let raw;
  try {
    raw = anthropic ? await callClaude(systemPrompt, history) : await callGroq(systemPrompt, history);
    console.log('✅ AI responded OK');
  } catch (err) {
    console.error('❌ AI failed:', err.message);
    try {
      raw = await callGroq(systemPrompt, history);
      console.log('✅ Groq fallback OK');
    } catch {
      const lastMsg = history.filter(m => m.role === 'user').pop()?.content || '';
      raw = getKBFallback(lastMsg);
      console.log('⚠️ Using static KB fallback');
    }
  }

  // raw is now plain text (no JSON parsing needed)
  let reply = (raw || '').trim();

  // Safety: if somehow JSON slipped through, extract reply field or use raw
  if (reply.startsWith('{') || reply.includes('"shouldCreateTicket"')) {
    try {
      const s = reply.indexOf('"reply"');
      if (s !== -1) {
        const parsed = JSON.parse(reply.slice(reply.indexOf('{')));
        reply = parsed.reply || reply;
      }
    } catch { /* ignore */ }
    if (reply.startsWith('{')) reply = getKBFallback(history.filter(m=>m.role==='user').pop()?.content||'');
  }

  // ── CRITICAL: Detect system prompt leakage ───────────────────────────────
  // Groq sometimes copies system prompt examples verbatim — catch and replace
  const isLeaked =
    /User:\s*[""“”]/i.test(reply) ||          // 'User: "...' pattern from examples
    /❌\s*(Bot|Step)|✅\s*Real:/i.test(reply) ||         // example diff markers
    /BANNED:|NEVER DO THIS|OFFICE-FRIENDLY TONE/i.test(reply) || // system prompt headings
    /━━━|SABSE ZAROORI|TICKET RULES/i.test(reply);       // prompt section headers
  if (isLeaked) {
    console.warn('⚠️ System prompt leaked in AI response — replacing with fallback');
    const lastUser = history.filter(m => m.role === 'user').pop()?.content || '';
    reply = getKBFallback(lastUser);
  }

  // ── Hard filter: remove informal/banned words no matter what AI says ────
  reply = reply
    .replace(/\barre\s+yaar\b/gi, 'Haan')
    .replace(/\barre\s+bhai\b/gi, 'Haan')
    .replace(/\barre\b/gi, '')
    .replace(/\byaar\b/gi, '')
    .replace(/\bbhai\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,!]+/, '')
    .trim();

  // Strip robotic title lines before "Step 1:" (keep emoji openers)
  const stepIdx = reply.indexOf('Step 1:');
  if (stepIdx > 0) {
    const preStep = reply.slice(0, stepIdx);
    const hasEmoji = /[\u{1F300}-\u{1FFFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|😊|🔧|✅|🙏|🎫|🚨|💻|📶|🤔/u.test(preStep);
    if (!hasEmoji) reply = reply.slice(stepIdx).trim();
  }

  // Check if ticket needed — detect when AI suggests raising a ticket
  // Match: "ticket bhejte hain", "ha type karo", "ticket raise karein", etc.
  const shouldCreateTicket = reply.includes('ticket') && (
    /ticket\s*(bana|raise|create|chahiye|bhejte)/i.test(reply) ||
    /type\s*karo[:\s]*\*?ha\*?/i.test(reply) ||
    /ticket\s*(raise\s*karein|banana|karein)/i.test(reply)
  );

  // Safety: If AI hallucinated "raised successfully" — strip it and set shouldCreateTicket
  const isHallucinated = /ticket\s*(raised|created|submitted)\s*successfully/i.test(reply);
  if (isHallucinated) {
    // Replace with proper confirmation prompt
    reply = 'Koi baat nahi! 😊 IT team ko ticket bhejte hain. Type karo: *ha* ✅';
  }

  return {
    reply             : reply || getKBFallback('generic'),
    shouldCreateTicket: shouldCreateTicket || isHallucinated,
    ticketData        : null
  };
};


// ── Quick single reply (for Slack notifications) ─────────────────────────────
const quickReply = async (userMessage, empName = 'Employee', laptop = null, laptopSN = null) => {
  const laptopCtx = laptop ? ` | Laptop: ${laptop}${laptopSN ? ` (SN: ${laptopSN})` : ''}` : '';
  const sys = SYSTEM_PROMPT + `\nUser: ${empName}${laptopCtx}. Keep reply under 3 lines.`;
  const history = [{ role: 'user', content: userMessage }];

  let raw;
  try {
    raw = anthropic ? await callClaude(sys, history) : await callGroq(sys, history);
  } catch {
    raw = await callGroq(sys, history);
  }

  const parsed = parseOutput(raw);
  return (typeof parsed.reply === 'string' ? parsed.reply : raw) || userMessage;
};

// ── Direct KB lookup — instant, no AI call needed ────────────────────────────
const getKBAnswer = (problem) => {
  if (!problem) return null;
  const p = problem.toLowerCase().trim();

  // ── User saying issue is resolved / working fine now ───────────────────
  // STRICT: only if NO negative word present AND message is short status update
  const hasNegative = /\b(not|nahi|nahin|nai|nhi|band|kharab|problem|issue|chal nahi|kaam nahi|nahi chal|nahi ho|ho nahi|abhi bhi|still|phir bhi)\b/i.test(p);
  const hasPositive = /\b(normal|noraml|norml|theek|thik|sahi|ho gaya|ho gya|fixed|resolved|kaam kar raha|solve ho|fix ho gaya|theek ho|thik ho|chal raha hai|chal rhi hai|chal gaya|chal gyi|on ho gaya|working|work kar raha|charged|charge ho|connected|connect ho gaya|sorted|done|complete|ho gayi|mil gaya|mil gayi)\b/i.test(p);
  if (hasPositive && !hasNegative && p.split(/\s+/).length <= 8) {
    return `Great! Khushi hui ki resolve ho gaya 😊✅ Aur koi IT help chahiye toh zaroor batao!`;
  }

  // ── Identity questions — broad match, instant reply, no AI needed ───────
  const isIdentityQ =
    /^(kise\s*hai|kise\s*ho|tum\s*kise\s*ho|aap\s*kise\s*ho|tum\s*kaun\s*ho|aap\s*kaun\s*ho|kaun\s*ho|kaun\s*hain|kaun\s*hai|tum\s*kya\s*ho|aap\s*kya\s*ho|kya\s*ho\s*tum|kya\s*hain\s*aap|what\s*are\s*you|who\s*are\s*you|bot\s*hai\s*kya|kya\s*tum\s*bot|are\s*you\s*a\s*bot|introduce|apna\s*parichay|apne\s*bare\s*mein\s*batao)\s*\??$/i.test(p.trim()) ||
    /\b(kise|kaun)\s*(ho|hain|hai)\b/i.test(p) && p.split(/\s+/).length <= 5;
  if (isIdentityQ) {
    return `Main *Zivon* hoon — WIOM ka IT helpdesk assistant ⚡\nLaptop, WiFi, software, password — kisi bhi IT problem mein help karta hoon.\nBatao kya issue hai! 😊`;
  }

  // ── Ticket status / ETA questions (typo-tolerant: tiket/tikket/ticket) ──
  const pTicket = p.replace(/ti+ke+t/gi, 'ticket');
  if (/ticket\s*(kab|kb|kab\s*tak|kab\s*solve|kab\s*hoga|kab\s*fix|status|update|progress|ho\s*gaya|hua\s*kya|abhi\s*tak|kyun\s*nahi|pending)/i.test(pTicket) ||
      /kab\s*tak\s*(hoga|milega|fix\s*hoga|solve\s*hoga|resolve)/i.test(pTicket) ||
      /mera\s*ticket\s*(kab|solve|fix|hoga|ho\s*ga)/i.test(pTicket)) {
    return `Aapka ticket IT team ke paas hai! 📋 Usually same day resolve hota hai — priority ke hisaab se.\nStatus dekhne ke liye type karo: *my tickets* 👀\nUrgent hai toh batao, main priority mark kar deta hoon! 🎫`;
  }

  // ── WiFi password — strict match only ───────────────────────────────────
  const isWifiPassword =
    /wifi\s*(ka|ke|ki)?\s*(password|pass|pwd|pasword|passward)/i.test(p) ||
    /password\s*(wifi|wi-fi|wiom|network)/i.test(p) ||
    /^(wifi|wi-fi|network)\s*(password|pass|pwd)\s*\??$/i.test(p.trim()) ||
    /^(pass|pwd|password)\s*\??$/i.test(p.trim()) ||
    /network\s*ka\s*pass/i.test(p) ||
    /office\s*(wifi|network|wi-fi)\s*(password|pass)/i.test(p);

  if (isWifiPassword) {
    return `WiFi Password! 📶\n\n🔑 *Password:* \`spartans500\` — sabhi networks ke liye same\n\n*Networks:*\n• Wiom office 5g-Test — Ground floor\n• Wiom office Guest\n• Wiom office 3rd floor\n• Wiomnet — Saket office *(Password: \`Password@12345\`)*\n\nHo gaya? Batao! 😊`;
  }

  // ── Instant KB answers — Zivon tone, no Step 1/2/3 ─────────────────────
  // MATCHING RULES:
  //   - Multi-word keys (contains space): exact substring match in p
  //   - Single-word keys: anchored start match (prevents 'mail' matching 'email', etc.)
  //     BUT suffix-flexible so 'charge' still matches 'charger'/'charging'
  // ORDER: specific app/device entries FIRST, general hardware LAST
  // Reason: "teams slow hai" should match 'teams' entry, not 'slow'
  const matchKey = (text, key) => {
    if (key.includes(' ')) return text.includes(key);
    // Word-start boundary only — allows suffixes like charger/charging/charging
    // but prevents mid-word matches like 'mail' inside 'email'
    return new RegExp(`(?<![a-z])${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(text);
  };

  // ── Only EXACT FACTS in KB — everything else → Claude asks follow-up ────
  // Fan emergency (safety critical — must be instant)
  if (/fan\s*(nahi\s*chal|band|kaam\s*nahi|not\s*work|chal\s*nahi)/i.test(p)) {
    return `Fan nahi chal raha — laptop abhi band karo aur charger nikaal do ⚠️ Hardware damage ho sakta hai. Type karo *ha*, ticket abhi bhejta hoon 🎫`;
  }

  // Virus (urgent — must be instant)
  if (/\b(virus|malware|ransomware|hack)\b/i.test(p)) {
    return `Abhi Windows Security → Virus & threat protection → Quick Scan karo 🦠 Kuch suspicious mila? Internet band karo aur type karo *ha* — IT ko turant batata hoon 🎫`;
  }

  return null; // Everything else → Claude handles with follow-up questions
};

module.exports = { chat, quickReply, getKBAnswer };

