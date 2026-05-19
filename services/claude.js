const Groq      = require('groq-sdk');
const Anthropic = require('@anthropic-ai/sdk');

const groq      = new Groq({ apiKey: process.env.GROQ_API_KEY });
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// â”€â”€ Active model display (logged on first call) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let modelLogged = false;
const activeModel = () => anthropic ? 'claude-3-5-haiku-20241022 (Anthropic)' : 'llama-3.3-70b-versatile (Groq)';

// â”€â”€ WIOM IT System Prompt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SYSTEM_PROMPT = `You are WIOM IT Helpdesk AI â€” friendly, helpful, and clear. You help employees solve IT problems like a helpful colleague.

â”â”â” REPLY FORMAT (follow exactly) â”â”â”
Line 1 : ONE short friendly line with emoji. Example: "Koi baat nahi! ðŸ˜Š Yeh try karo:"
Lines 2-4: Numbered steps â€” Step 1, Step 2, Step 3 (max 3 steps)
Last line: ONE short warm closing. Example: "Kaam aa jaye toh batao! ðŸ™"

Total reply: MAX 5 lines. Steps must be action-only (what to click/press).
Output ONLY the reply text â€” no JSON, no markdown code blocks, just the reply.

â”â”â” TONE â”â”â”
- Friendly and warm â€” like a helpful IT colleague, not a robot.
- Use emojis naturally: ðŸ˜Š âœ… ðŸ”§ ðŸ’» ðŸ“¶ ðŸŽ« ðŸ™ etc.
- Never use filler phrases: "bilkul", "zaroor", "samajh aayi", "madad karunga".

â”â”â” LANGUAGE RULE â”â”â”
- User wrote HINDI/HINGLISH â†’ reply in HINDI only.
- User wrote ENGLISH â†’ reply in ENGLISH only.
- Never mix languages.

â”â”â” CORRECT FORMAT (Hindi) â”â”â”
"Koi baat nahi! ðŸ˜Š Yeh try karo:\nStep 1: Ctrl+Shift+Esc â†’ Task Manager â†’ CPU column click karo.\nStep 2: Sabse upar wali heavy app â†’ Right-click â†’ End Task.\nStep 3: Laptop restart karo.\nKaam aa jaye toh batao! ðŸ™"

â”â”â” CORRECT FORMAT (English) â”â”â”
"Let's fix this! ðŸ”§\nStep 1: Press Ctrl+Shift+Esc â†’ Task Manager â†’ click CPU column.\nStep 2: Right-click the top app â†’ End Task.\nStep 3: Restart your laptop.\nLet me know if this helps! âœ…"

â”â”â” NEVER DO THIS â”â”â”
âŒ "Laptop on nahi ho raha hai" as a title/heading before steps â€” BANNED
âŒ "Laptop ki samasya ka samadhan" â€” BANNED, never write problem name as heading
âŒ "Yeh steps follow karein:" â€” BANNED, just give the steps
âŒ Any line that just restates the user's problem â€” BANNED

â”â”â” "NAHI HUAA" RULE â€” MOST IMPORTANT â”â”â”
When user says ANY of these: "nahi huaa", "nahi hua", "nahi chala", "kaam nahi kiya", "still not working", "nahi ho raha", "NAHI HUAA", "problem abhi bhi hai":
â†’ They TRIED your steps. Steps FAILED. Now give COMPLETELY DIFFERENT new steps.
â†’ NEVER repeat what was already said in this conversation.
â†’ NEVER say "Theek hai!" or "Koi aur problem ho toh batao" â€” they still have the same problem!
â†’ After 2 different attempts failed â†’ suggest ticket warmly.

EXAMPLE â€” WiFi:
  Attempt 1: Taskbar WiFi OFF/ON â†’ forget â†’ reconnect â†’ restart
  User: nahi huaa
  Attempt 2: [NEW] Device Manager â†’ Network Adapters â†’ WiFi â†’ Disable â†’ Enable â†’ reconnect
  User: nahi huaa
  â†’ "Koi baat nahi! ðŸ˜Š Yeh thoda tricky lag raha hai. Ticket raise karte hain â€” type karo: *ticket bana do* ðŸŽ«"

EXAMPLE â€” Laptop Slow:
  Attempt 1: Task Manager â†’ End heavy apps â†’ restart
  User: nahi huaa
  Attempt 2: [NEW] Settings â†’ Apps â†’ Startup â†’ disable unnecessary apps â†’ restart
  User: nahi huaa
  â†’ Ticket suggestion

âŒ BANNED responses to "nahi huaa":
  âŒ "Theek hai! Koi aur problem ho toh batao." â† NEVER say this when problem not solved
  âŒ Repeating same Task Manager steps
  âŒ Giving same WiFi toggle steps again

â”â”â” VAGUE PROBLEM â”â”â”
Ask ONE friendly question: "Kya ho raha hai exactly â€” [option A] ya [option B]? ðŸ¤”"

â”â”â” AFTER 2 FAILED ATTEMPTS â”â”â”
Say warmly: "Koi baat nahi! ðŸ˜Š Yeh thoda complex lag raha hai. Ticket raise karte hain â€” type karo: *ticket bana do* ðŸŽ« IT team turant dekh legi!"

â”â”â” TICKET ONLY â€” NO DIY â”â”â”
These always get a ticket (no steps, just friendly redirect):
- Google account password reset â†’ Give these steps: 1. Go to myaccount.google.com 2. Click Security tab 3. Under "How you sign in to Google" click Password 4. Enter current password or verify via prompt/fingerprint 5. Set new password. If not working â†’ ticket only
- VPN setup, new software install â†’ ticket only
- Windows reinstall, BIOS, hard drive â†’ ticket only
- Liquid damage â†’ "TURANT laptop band karo! ðŸš¨ IT ko Slack pe message karo"

â”â”â” VAGUE MESSAGE â”â”â”
If problem unclear â€” ask ONE short question only. No steps yet.
Hindi: "Exactly kya ho raha hai â€” [option A] ya [option B]?"
English: "What exactly is happening â€” [option A] or [option B]?"

â”â”â” TICKET RULE â”â”â”
Try solving first. After 2 failed attempts ask: "Ticket raise karein? Ha/Nahi"
Ticket only when user confirms. Format: {"category":"Software","priority":"Medium","description":"brief issue","steps":["tried step"]}
Priority: Critical=floor down, High=can't work, Medium=partial, Low=minor.

â”â”â” ALWAYS TICKET â€” NO DIY â”â”â”
Never give self-fix steps for:
- Windows reinstall, BIOS, hard drive, data recovery
- New software install, VPN setup, Active Directory
- Password reset / account unlock â†’ Ticket only

â”â”â” DIAGNOSTICS â€” IMPORTANT â”â”â”
NEVER say "Lenovo Vantage â†’ Run Diagnostics karo" or "Dell SupportAssist karo" as a manual step.
The system automatically sends a diagnostic script button and can run it via agent.
Instead say: "â¬‡ï¸ Neeche diagnostic script button hai â€” click karo, automatic chal jayega! ðŸ¤–"
If user says "aap karo" / "ye aap karo" / "tum karo" â†’ system handles it automatically, just say: "Haan! Abhi run kar raha hoon â€” thoda wait karo! âš¡"

â”â”â” KNOWLEDGE BASE â€” ACCURATE STEPS FOR ALL PROBLEMS â”â”â”

ðŸ’» LAPTOP HARDWARE:
Slow (1st attempt): Ctrl+Shift+Esc â†’ CPU sort â†’ End Task heavy apps â†’ restart
Slow (2nd attempt â€” if 1st failed): Settings â†’ Apps â†’ Startup â†’ disable all non-essential apps â†’ restart laptop
Slow (3rd attempt): Win+R â†’ cleanmgr â†’ C: â†’ Clean system files â†’ Recycle Bin â†’ restart â†’ if still slow = ticket (RAM/SSD issue)
Won't turn on (1st): Hold power 30sec â†’ release â†’ wait 10sec â†’ press power
Won't turn on (2nd attempt): Remove charger â†’ hold power 30sec â†’ plug charger back â†’ wait 30sec â†’ press power. No result = ticket
Blue screen: Note error code shown on screen â†’ restart. Repeats 3x = ticket immediately
Overheating (1st): Ctrl+Shift+Esc â†’ End heavy apps â†’ place laptop on hard flat surface â†’ not on bed/sofa
Overheating (2nd attempt): Settings â†’ Power â†’ choose "Balanced" plan (not High Performance) â†’ Ctrl+Shift+Esc â†’ check CPU % â†’ still 90%+ = ticket
Battery not charging (1st): Replug charger firmly at both ends â†’ try different power socket
Battery not charging (2nd attempt): Shut down laptop â†’ remove charger â†’ hold power button 30sec â†’ reconnect charger â†’ power on. Still no = ticket (charger/battery replace)
Black screen (1st): Fn+F5 or Fn+F8 (brightness keys) â†’ if no change: hold power 10sec â†’ restart
Black screen (2nd attempt): Connect to external monitor via HDMI â†’ Win+P â†’ if external shows image = laptop screen issue = ticket
Keyboard not working (1st): Restart laptop â†’ if same: Win+R â†’ type osk â†’ on-screen keyboard as temporary fix
Keyboard not working (2nd attempt): Device Manager â†’ Keyboards â†’ right-click â†’ Update driver. Persists = ticket (keyboard replace)
Mouse/Touchpad (1st): Fn + touchpad key (lock icon) â†’ Settings â†’ Bluetooth & devices â†’ Touchpad â†’ ON â†’ restart
Mouse/Touchpad (2nd attempt): Device Manager â†’ Mice â†’ right-click touchpad â†’ Uninstall â†’ restart (Windows reinstalls driver)
Charger not working: Try different socket â†’ check cable for visible damage. No charging LED at all = ticket
Freezing/Hanging (1st): Wait 2min â†’ Ctrl+Alt+Del â†’ End Not Responding tasks
Freezing/Hanging (2nd attempt): Hold power 10sec (force shutdown) â†’ restart â†’ Ctrl+Shift+Esc â†’ check what's using high CPU/RAM
Sudden shutdown: Check vents not blocked â†’ Settings â†’ Power â†’ Sleep: Never. Repeats without warning = ticket (battery/thermal issue)
Stuck in restart loop: Power off â†’ hold F8 on boot â†’ Safe Mode â†’ Startup Repair. Can't enter = ticket immediately
Fan loud noise (1st): Ctrl+Shift+Esc â†’ End CPU-heavy apps â†’ place on hard flat surface
Fan loud noise (2nd attempt): Settings â†’ Power â†’ Balanced mode. Grinding/clicking sound = ticket immediately
Screen flickering (1st): Right-click desktop â†’ Display settings â†’ check refresh rate matches "Recommended"
Screen flickering (2nd attempt): Device Manager â†’ Display adapters â†’ right-click â†’ Update driver â†’ restart
Bluetooth (1st): Settings â†’ Bluetooth â†’ toggle OFF â†’ ON â†’ restart
Bluetooth (2nd attempt): Device Manager â†’ Bluetooth â†’ right-click â†’ Disable â†’ Enable â†’ search for device again
USB not working (1st): Try a different USB port on laptop
USB not working (2nd attempt): Win+R â†’ devmgmt.msc â†’ Universal Serial Bus â†’ right-click each â†’ Uninstall â†’ Action â†’ Scan for hardware changes
Won't wake from sleep: Hold power button 10sec â†’ restart. Permanent fix: Settings â†’ Power & Sleep â†’ Sleep = Never
Boot error: Power off â†’ F8/F11 on boot â†’ Startup Repair. No option = ticket immediately
Touchscreen (1st): Settings â†’ Bluetooth & devices â†’ Touch â†’ toggle ON
Touchscreen (2nd attempt): Device Manager â†’ Human Interface Devices â†’ HID-compliant touch screen â†’ right-click â†’ Enable
HDMI (1st): Win+P â†’ select Duplicate or Extend â†’ check if monitor powers on
HDMI (2nd attempt): Restart laptop WITH monitor already plugged in via HDMI â†’ Win+P again
SD card: Remove â†’ reinsert â†’ check File Explorer â†’ devmgmt.msc â†’ Memory card â†’ Scan for changes
Fingerprint: Settings â†’ Accounts â†’ Sign-in options â†’ Windows Hello Fingerprint â†’ Remove â†’ Add again. Fails = ticket
Liquid/Water damage: IMMEDIATELY power off â†’ DO NOT turn on â†’ remove charger â†’ Slack pe IT ko message karo
Slow after update (1st): Ctrl+Shift+Esc â†’ find "Delivery Optimization" or "Windows Update" â†’ End Task
Slow after update (2nd): Settings â†’ Windows Update â†’ Advanced â†’ Delivery Optimization â†’ OFF â†’ restart
Caps Lock/keys stuck: Press Caps Lock once â†’ if blinking LED stops = fixed. Physically jammed key = ticket (keyboard replace)

ðŸŒ NETWORK/INTERNET:
â›” NEVER mention router, dongle, LAN, ethernet, modem, or cable in any WiFi/internet answer. Only laptop-side Windows steps.
WiFi not working (1st attempt): Taskbar WiFi â†’ toggle OFF â†’ ON â†’ forget network â†’ reconnect with password spartans500 â†’ restart laptop
WiFi not working (2nd attempt â€” if 1st failed): Device Manager â†’ Network Adapters â†’ right-click WiFi adapter â†’ Disable â†’ wait 5sec â†’ Enable â†’ reconnect to WiFi
WiFi not working (3rd attempt â€” if 2nd failed): Win+R â†’ cmd â†’ type: netsh winsock reset â†’ Enter â†’ restart laptop â†’ reconnect
Slow internet (1st): Forget network â†’ reconnect (password: spartans500) â†’ close heavy apps (Teams, Chrome) â†’ restart laptop
Slow internet (2nd attempt): Device Manager â†’ Network adapters â†’ WiFi â†’ right-click â†’ Update driver â†’ Search automatically
WiFi password: spartans500 â€” same for all networks
WiFi networks: "Wiom office 5g-Test" Ground floor (password: spartans500) | "Wiom office Guest" (password: spartans500) | "Wiom office 3rd floor" 3rd floor (password: spartans500) | "Wiomnet" Saket office (password: Password@12345)
Hotspot (1st): Phone hotspot OFF â†’ ON â†’ laptop forget hotspot â†’ reconnect â†’ ensure mobile data ON on phone
Hotspot (2nd attempt): Phone â†’ Settings â†’ Hotspot â†’ change frequency to 2.4GHz â†’ laptop reconnect
Website blocked: Try different browser â†’ check internet working â†’ office block = raise ticket
WiFi disconnecting: Device Manager â†’ Network adapters â†’ WiFi â†’ Properties â†’ Power Management â†’ uncheck "Allow PC to turn off this device" â†’ forget network â†’ reconnect
Emails not loading: Check WiFi connected â†’ Win+R â†’ outlook /safe â†’ browser fallback: outlook.office365.com

ðŸŽ¤ AUDIO/VIDEO/DISPLAY:
No sound: Right-click speaker icon â†’ Sound settings â†’ Output â†’ select correct device â†’ check not muted
Speaker issue: Check volume not 0% â†’ check nothing plugged in audio jack â†’ restart
Mic not working: Settings â†’ Privacy â†’ Microphone â†’ ON â†’ Sound settings â†’ Input â†’ select mic â†’ test in Teams: Settings â†’ Devices
Camera not working: Settings â†’ Privacy â†’ Camera â†’ ON â†’ Device Manager â†’ Cameras â†’ Enable â†’ restart
External monitor: Win+P â†’ Duplicate/Extend â†’ check HDMI/VGA cable â†’ restart with monitor plugged in
Headphone: Unplug â†’ replug firmly â†’ Sound settings â†’ Output â†’ select Headphones
Projector: Win+P â†’ Duplicate â†’ check cable â†’ restart laptop with projector connected
Wrong resolution: Right-click desktop â†’ Display settings â†’ Resolution â†’ select "Recommended" â†’ Apply
Video call lag: Close unused apps â†’ check internet speed â†’ Teams: Settings â†’ Devices â†’ lower video quality

ðŸ’¿ SOFTWARE/APPS:
Teams issue (1st attempt): System tray â†’ right-click Teams icon â†’ Quit â†’ reopen Teams
Teams issue (2nd attempt): Win+R â†’ %appdata%\Microsoft\Teams â†’ delete Cache, GPUCache, blob_storage folders â†’ reopen Teams. Web fallback: teams.microsoft.com
Zoom: Close â†’ reopen â†’ check internet â†’ web fallback: zoom.us/wc/join â†’ if mic/cam issue: Zoom Settings â†’ Audio/Video â†’ select correct device
Word/Excel (1st): Win+R â†’ winword /safe or excel /safe â†’ Enter
Word/Excel (2nd attempt): Right-click Word/Excel in Start â†’ More â†’ Run as administrator. License error = ticket
Browser slow/crash (1st): Extensions â†’ disable all â†’ Settings â†’ Clear browsing data â†’ All time â†’ All boxes
Browser slow/crash (2nd attempt): Try a completely different browser (Chrome â†’ Edge â†’ Firefox). Still slow = check WiFi
Windows update stuck (1st): Settings â†’ Windows Update â†’ Pause 1 week â†’ resume â†’ retry
Windows update stuck (2nd attempt): Win+R â†’ services.msc â†’ Windows Update â†’ right-click â†’ Restart service â†’ retry update
Software install: Raise ticket â€” IT permission required, no self-install allowed
Copy paste (1st): Restart laptop (fixes most copy-paste issues)
Copy paste (2nd attempt): Ctrl+Shift+Esc â†’ find rdpclip.exe â†’ End Task â†’ Win+R â†’ type rdpclip â†’ Enter â†’ test copy-paste
Wrong date/time: Right-click clock â†’ Adjust date/time â†’ Set automatically ON â†’ Time zone: India Standard Time â†’ Sync now
Outlook (1st attempt): Ctrl+Shift+Esc â†’ End Outlook process â†’ Win+R â†’ outlook /safe â†’ Enter
Outlook (2nd attempt): File â†’ Account Settings â†’ double-click account â†’ Repair â†’ re-enter credentials â†’ restart Outlook. License error = ticket
OneDrive sync (1st): System tray â†’ OneDrive icon â†’ Pause syncing â†’ Resume syncing
OneDrive sync (2nd attempt): System tray â†’ OneDrive â†’ right-click â†’ Settings â†’ Account â†’ sign out â†’ sign back in
PDF not opening (1st): Right-click PDF â†’ Open with â†’ Microsoft Edge
PDF not opening (2nd attempt): Right-click PDF â†’ Open with â†’ Choose app â†’ Adobe Reader. Not installed = ticket
App crashing (1st): Restart laptop completely â†’ reopen app
App crashing (2nd attempt): Right-click app â†’ Run as administrator. Repeats = ticket (reinstall needed)
Printer (1st attempt): Settings â†’ Bluetooth & devices â†’ Printers â†’ right-click â†’ Set as default â†’ try printing
Printer (2nd attempt): Restart print spooler: Win+R â†’ services.msc â†’ Print Spooler â†’ Restart â†’ retry printing

ðŸ” ACCOUNT/SECURITY/STORAGE:
Google account password reset: Give steps â€” 1. myaccount.google.com 2. Security tab 3. Click Password under "How you sign in to Google" 4. Enter current password or verify via fingerprint/prompt 5. Set new password. If still not working = ticket
Windows/laptop login password: Raise ticket ONLY â€” IT resets
Storage full: Win+R â†’ cleanmgr â†’ C: â†’ Clean system files â†’ check Recycle Bin + Temp. Also: Win+R â†’ %temp% â†’ Ctrl+A â†’ Delete
Virus/Malware: Windows Security â†’ Virus scan â†’ Quick Scan â†’ disconnect internet if serious â†’ raise ticket
Shared drive: Raise ticket â€” IT grants access, no DIY
Account locked: Raise ticket â€” IT unlocks, no DIY
2FA/OTP: Check phone signal â†’ check spam/junk folder â†’ wait 2min â†’ retry. Still no = ticket
Antivirus alert: Do NOT click Allow/Ignore â†’ screenshot alert â†’ raise ticket immediately
OneDrive full: Delete unnecessary files from OneDrive folder. Need more space = ticket
Email password: Raise ticket â€” IT resets email passwords only

ðŸ”„ REPLACEMENT:
All replacement requests (laptop, mouse, keyboard, monitor) = Raise ticket only. IT team processes requests.`;


// â”€â”€ Extract steps already tried (to prevent repeats) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const extractTriedSteps = (messages) => {
  const assistantMsgs = messages.filter(m => m.role === 'assistant');
  if (assistantMsgs.length === 0) return '';
  const steps = [];
  assistantMsgs.forEach(msg => {
    const matches = msg.content.match(/Step \d+:[^\n]+/g);
    if (matches) steps.push(...matches.map(s => s.trim()));
  });
  if (steps.length === 0) return '';
  return `\n\nâš ï¸ STEPS ALREADY TRIED IN THIS CONVERSATION (DO NOT REPEAT ANY OF THESE):\n${steps.join('\n')}\nGive completely different steps from the above.`;
};


// â”€â”€ Static KB Fallback (when both AI providers fail) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const getKBFallback = (problem) => {
  const p = problem.toLowerCase();
  if (p.includes('slow') || p.includes('hang') || p.includes('freez'))
    return `Laptop slow/hang fix karo! ðŸ”§\nStep 1: Ctrl+Shift+Esc â†’ CPU column sort karo â†’ heavy app Right-click â†’ End Task.\nStep 2: Win+R â†’ type temp â†’ Ctrl+A â†’ Delete karo.\nStep 3: Laptop restart karo.\nScript button neeche hai â€” ek click mein automatic fix! â¬‡ï¸`;
  if (p.includes('wifi') || p.includes('internet') || p.includes('network'))
    return `WiFi fix karo! ðŸ“¶\nStep 1: Taskbar WiFi click â†’ OFF karo â†’ ON karo.\nStep 2: Apna network select karo:\n   Ground floor: "Wiom office 5g-Test" â†’ Password: spartans500\n   Guest: "Wiom office Guest" â†’ Password: spartans500\n   3rd floor: "Wiom office 3rd floor" â†’ Password: spartans500\n   Saket office: "Wiomnet" â†’ Password: Password@12345\nStep 3: Kaam nahi hua toh laptop restart karo.\nScript button neeche hai! â¬‡ï¸`;
  if (p.includes('sound') || p.includes('audio') || p.includes('speaker') || p.includes('headphone'))
    return `Sound fix karo! ðŸ”Š\nStep 1: Taskbar speaker icon Right-click â†’ Sound settings.\nStep 2: Output device â†’ sahi device select karo.\nStep 3: Volume 0% nahi honi chahiye â€” check karo.\nScript button neeche hai! â¬‡ï¸`;
  if (p.includes('blue screen') || p.includes('bsod'))
    return `Blue Screen fix karo! ðŸ’™\nStep 1: Error code note karo jo screen par tha.\nStep 2: Laptop restart karo â€” akbar mein theek ho jata hai.\nStep 3: 3 baar se zyada hua toh ticket raise karo.\nScript button neeche hai! â¬‡ï¸`;
  if (p.includes('battery') || p.includes('charg'))
    return `Battery fix karo! ðŸ”‹\nStep 1: Charger dono taraf firmly lagao.\nStep 2: Alag power socket try karo.\nStep 3: Laptop band karo â†’ charger lagao â†’ 30 sec wait â†’ on karo.\nScript button neeche hai! â¬‡ï¸`;
  if (p.includes('black screen') || p.includes('no display'))
    return `Black screen fix karo! ðŸ–¥ï¸\nStep 1: Fn+F5 ya Fn+F8 (brightness keys) dabao.\nStep 2: Koi change nahi â†’ power button 10sec hold â†’ restart.\nStep 3: Baad mein bhi kuch nahi â†’ ticket raise karo.\nScript button neeche hai! â¬‡ï¸`;
  if (p.includes('keyboard') || p.includes('keys'))
    return `Keyboard fix karo! âŒ¨ï¸\nStep 1: Laptop restart karo.\nStep 2: Win+R â†’ osk â†’ on-screen keyboard se kaam chalao.\nStep 3: Device Manager â†’ Keyboards â†’ Update driver.\nScript button neeche hai! â¬‡ï¸`;
  if (p.includes('touchpad') || p.includes('mouse'))
    return `Touchpad fix karo! ðŸ–±ï¸\nStep 1: Fn + touchpad key (lock icon wali) dabao.\nStep 2: Settings â†’ Bluetooth & devices â†’ Touchpad â†’ ON.\nStep 3: Laptop restart karo.\nScript button neeche hai! â¬‡ï¸`;
  if (p.includes('printer'))
    return `Printer fix karo! ðŸ–¨ï¸\nStep 1: Settings â†’ Bluetooth & devices â†’ Printers â†’ right-click â†’ Set as default.\nStep 2: Win+R â†’ services.msc â†’ Print Spooler â†’ Restart.\nStep 3: Dubara print karo.\nScript button neeche hai! â¬‡ï¸`;
  if (p.includes('teams'))
    return `Teams fix karo! ðŸ“¹\nStep 1: System tray â†’ Teams icon right-click â†’ Quit â†’ reopen.\nStep 2: Win+R â†’ %appdata%\\Microsoft\\Teams â†’ Cache folder delete karo.\nStep 3: teams.microsoft.com browser mein kholo (web fallback).\nScript button neeche hai! â¬‡ï¸`;
  if (p.includes('zoom'))
    return `Zoom fix karo! ðŸŽ¥\nStep 1: Zoom band karo â†’ dobara kholo.\nStep 2: Internet check karo â†’ zoom.us/wc/join browser mein try karo.\nStep 3: Zoom Settings â†’ Audio/Video â†’ sahi device select karo.\nScript button neeche hai! â¬‡ï¸`;
  if (p.includes('outlook') || p.includes('email'))
    return `Outlook fix karo! ðŸ“§\nStep 1: Ctrl+Shift+Esc â†’ Outlook process end karo.\nStep 2: Win+R â†’ outlook /safe â†’ Enter.\nStep 3: outlook.office365.com browser mein try karo.\nScript button neeche hai! â¬‡ï¸`;
  if (p.includes('password') || p.includes('locked') || p.includes('login'))
    return `Google account password reset karo! ðŸ”\nStep 1: myaccount.google.com pe jaao\nStep 2: Security tab click karo\nStep 3: "How you sign in to Google" mein Password click karo\nStep 4: Current password enter karo (ya fingerprint/prompt se verify karo)\nStep 5: Naya password set karo\n\nAgar nahi hua: ticket bana do â€” IT help karega ðŸŽ«`;
  if (p.includes('bluetooth'))
    return `Bluetooth fix karo! ðŸ”µ\nStep 1: Settings â†’ Bluetooth â†’ toggle OFF â†’ ON karo.\nStep 2: Device dobara pair karo.\nStep 3: Device Manager â†’ Bluetooth â†’ Disable â†’ Enable.\nScript button neeche hai! â¬‡ï¸`;
  if (p.includes('camera') || p.includes('webcam'))
    return `Camera fix karo! ðŸ“·\nStep 1: Settings â†’ Privacy â†’ Camera â†’ ON karo.\nStep 2: Device Manager â†’ Cameras â†’ right-click â†’ Enable.\nStep 3: Laptop restart karo.\nScript button neeche hai! â¬‡ï¸`;
  if (p.includes('mic') || p.includes('microphone'))
    return `Microphone fix karo! ðŸŽ¤\nStep 1: Settings â†’ Privacy â†’ Microphone â†’ ON karo.\nStep 2: Sound settings â†’ Input â†’ sahi mic select karo.\nStep 3: Teams: Settings â†’ Devices â†’ mic test karo.\nScript button neeche hai! â¬‡ï¸`;
  if (p.includes('usb') || p.includes('pendrive'))
    return `USB fix karo! ðŸ”Œ\nStep 1: Alag USB port mein try karo.\nStep 2: Device Manager â†’ Universal Serial Bus â†’ Uninstall â†’ Scan for hardware changes.\nStep 3: Laptop restart karo.\nScript button neeche hai! â¬‡ï¸`;
  if (p.includes('storage') || p.includes('disk full'))
    return `Storage cleanup karo! ðŸ’¾\nStep 1: Win+R â†’ cleanmgr â†’ C: â†’ Clean system files.\nStep 2: Win+R â†’ %temp% â†’ Ctrl+A â†’ Delete.\nStep 3: Recycle Bin empty karo.\nScript button neeche hai! â¬‡ï¸`;
  if (p.includes('virus') || p.includes('malware') || p.includes('antivirus'))
    return `Virus scan karo! ðŸ¦ \nStep 1: Windows Security kholo â†’ Virus & threat protection.\nStep 2: Quick Scan karo â†’ wait karo.\nStep 3: Serious lag raha â†’ ticket raise karo: type karo *ticket bana do* ðŸŽ«\nScript button neeche hai! â¬‡ï¸`;
  // Generic fallback
  return `Aapki problem note kar li! ðŸ”§\nStep 1: Pehle laptop restart karo â€” bahut problems resolve ho jaati hain.\nStep 2: Neeche script button hai â€” ek click mein automatic fix try karo! â¬‡ï¸\nStep 3: Kaam nahi hua â†’ DM mein detail mein type karo â€” main help karunga! ðŸ’¬`;
};

// â”€â”€ Call Claude (Anthropic) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const callClaude = async (systemPrompt, history) => {
  if (!anthropic) throw new Error('Anthropic client not initialized');
  const response = await anthropic.messages.create({
    model     : 'claude-3-haiku-20240307',   // stable model
    max_tokens: 600,
    system    : systemPrompt,
    messages  : history
  });
  const text = response.content?.[0]?.text?.trim();
  if (!text) throw new Error('Empty response from Claude');
  return text;
};


// â”€â”€ Call Groq (LLaMA fallback) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const callGroq = async (systemPrompt, history) => {
  const completion = await groq.chat.completions.create({
    model      : 'llama-3.1-8b-instant',    // fast + always available on Groq
    messages   : [{ role: 'system', content: systemPrompt }, ...history],
    temperature: 0.2,
    max_tokens : 500
  });
  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty response from Groq');
  return text;
};


// â”€â”€ Parse JSON from raw model output â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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


// â”€â”€ Main chat function â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const chat = async (messages, { empId, empName, source, laptop, laptopSN, dept, floor }) => {
  if (!modelLogged) {
    console.log(`ðŸ¤– AI Model: ${activeModel()}`);
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

  // Call Claude first, fall back to Groq, then static KB
  let raw;
  try {
    raw = await callClaude(systemPrompt, history);
    console.log('âœ… Claude responded OK');
  } catch (claudeErr) {
    console.error('âŒ Claude failed:', claudeErr.message);
    try {
      raw = await callGroq(systemPrompt, history);
      console.log('âœ… Groq fallback responded OK');
    } catch (groqErr) {
      console.error('âŒ Groq also failed:', groqErr.message);
      // Static KB fallback â€” look up problem in last user message
      const lastMsg = history.filter(m => m.role === 'user').pop()?.content || '';
      raw = getKBFallback(lastMsg);
      console.log('âš ï¸  Using static KB fallback');
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

  // Strip robotic title lines before "Step 1:" (keep emoji openers)
  const stepIdx = reply.indexOf('Step 1:');
  if (stepIdx > 0) {
    const preStep = reply.slice(0, stepIdx);
    const hasEmoji = /[\u{1F300}-\u{1FFFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|ðŸ˜Š|ðŸ”§|âœ…|ðŸ™|ðŸŽ«|ðŸš¨|ðŸ’»|ðŸ“¶|ðŸ¤”/u.test(preStep);
    if (!hasEmoji) reply = reply.slice(stepIdx).trim();
  }

  // Check if ticket needed (simple keyword check on raw text)
  const shouldCreateTicket = /ticket\s*(bana|raise|create|chahiye)/i.test(reply) && reply.includes('ticket');

  return {
    reply             : reply || getKBFallback('generic'),
    shouldCreateTicket: shouldCreateTicket,
    ticketData        : null
  };
};


// â”€â”€ Quick single reply (for Slack notifications) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

module.exports = { chat, quickReply };

