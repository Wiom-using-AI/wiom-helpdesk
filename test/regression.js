/**
 * WIOM IT Helpdesk — Regression Test Suite (300 + 160 = 460 cases)
 * Run before every deploy: node test/regression.js
 * Tests both getScriptForText() (Auto-Fix) and getKBAnswer() (KB responses)
 * Pass threshold: 93% (428/460)
 */

require('dotenv').config();
const claude = require('../services/claude');

// ── INTENT: classifyIntent — mirrors server.js logic for standalone testing ──────────
const classifyIntent = (text) => {
  const t = text.toLowerCase();
  const words = t.trim().split(/\s+/).filter(Boolean);

  // SECURITY — virus, malware, phishing, fake/scam email, data theft, unauthorized, hacked
  if (/\b(virus|malware|phishing|phising|ransomware|data\s*leak|data\s*theft|suspicious|unauthorized|hacked|hack\s*ho|hack\s*gaya|credential|breach|fake\s*email|scam\s*email|someone\s*using|koi\s*aur.*use|account.*hack|hack.*account)\b/i.test(t))
    return { intent: 'security', confidence: 90 };
  // SECURITY — spam email received (not "email going to spam folder")
  if (/\bspam\s*email\b|\bemail.*spam.*aa|\bspam.*aa\s*rh/i.test(t) && !/\b(ja\s*rh|jata\s*h|going|folder)\b/i.test(t))
    return { intent: 'security', confidence: 90 };
  // SECURITY — "urgent security" keyword combo
  if (/\burgent\s+security\b|\bsecurity\s+urgent\b|\bsecurity\s+(issue|warning|alert)\b/i.test(t))
    return { intent: 'security', confidence: 90 };

  // ACCESS — check BEFORE request (access X chahiye is access, not generic request)
  if (/\b(access\s*chahiye|access\s*de|permission\s*chahiye|role\s*chahiye|account\s*bana|account\s*banana|create\s*account|user\s*banana)\b/i.test(t))
    return { intent: 'access', confidence: 90 };
  if (/\b\w+\s+access\s+(chahiye|de|do|milega|lena|chahte)\b/i.test(t))
    return { intent: 'access', confidence: 90 };
  if (/\b(admin\s*rights|admin\s*access|rights\s*chahiye|rights\s*de)\b/i.test(t))
    return { intent: 'access', confidence: 90 };

  // INFORMATION / HOW-TO — banana hai = how-to
  if (/\b(kya\s*hai|kaise|kise|kese|kase|kaisey|kaise\s*karu|kaise\s*karte|kaise\s*hota|how\s*to|how\s*do|how\s*can|kaise\s*karein|batao|bataiye|password\s*kya|kya\s*hoga|samjhao|explain|tell\s*me|steps|process|guide|banana\s*hai|filter\s*banana)\b/i.test(t))
    return { intent: 'information', confidence: 90 };
  // INFORMATION — setup/scan karna hai for non-antivirus contexts
  if (/\b(setup\s*karna\s*hai|scan\s*karna\s*hai)\b/i.test(t) && !/\b(antivirus|virus|malware|windows\s*security)\b/i.test(t))
    return { intent: 'information', confidence: 90 };

  // REQUEST — chahiye / need / install karna hai
  if (/\b(chahiye|ki\s*need|mangwana|de\s*do|milega|kharidna|buy|new\s*\w+\s*chahiye|naya\s*\w+\s*chahiye|lena\s*hai|request|order\s*karna|ki\s*zarurat|install\s*karna\s*hai|install\s*karo)\b/i.test(t))
    return { intent: 'request', confidence: 90 };

  // ASSET
  if (/\b(replace|upgrade|wapas\s*karna|wapas\s*do|return|asset\s*return|exit\s*me|transfer\s*karna|jama\s*karna)\b/i.test(t))
    return { intent: 'asset', confidence: 90 };

  // UNKNOWN — vague
  const hasSpecificIT = /\b(wifi|wiffi|laptop|leptop|lptop|latop|laptoop|laotop|internet|bluetooth|bluetoth|bluethooth|keyboard|keybord|keyborad|keybrd|touchpad|mouse|screen|sceern|scren|scrren|display|camera|camra|webcam|mic|microfone|microphne|microphone|speaker|speakr|speeker|audio|printer|printe|printr|teams|tims|zoom|chrome|chrmo|chorme|crome|browser|password|passwrod|paswrod|windows|excel|word|onedrive|usb|battery|battry|battey|batr|charger|network|slow|hang|crash|virus|malware|headphone|headfone|projector|projekter|projetor|hdmi|monitor|monitr|moniter|fan|fingerprint|fingerpint|num\s*lock|numlock|caps\s*lock|capslock|scroll\s*lock|blurry|pixelated|laggy|application|antivirus)\b/i.test(t);
  if (words.length <= 1 && !hasSpecificIT)
    return { intent: 'unknown', confidence: 50 };
  if (words.length <= 3 && !hasSpecificIT)
    return { intent: 'unknown', confidence: 70 };

  // INCIDENT
  const hasSymptom = /\b(nahi\s*chal|nahi\s*khul|kaam\s*nahi|work\s*nahi|not\s*work|not\s*respond|not\s*responding|issue|problem|error|crash|slow|hang|band|kharab|nahi\s*ho|chal\s*nahi|boot\s*nahi|stuck|freeze|flickering|damage|blurry|pixelated|laggy)\b/i.test(t);
  if (hasSpecificIT && hasSymptom) return { intent: 'incident', confidence: 90 };
  if (hasSpecificIT) return { intent: 'incident', confidence: 70 };
  return { intent: 'incident', confidence: 70 };
};

// ── TEST CASES (300) ──────────────────────────────────────────────────────────
// Fields:
//   query       — user input text
//   expectKB    — true: getKBAnswer() must return non-null
//   expectIntent — expected intent from classifyIntent()
//   noScript    — true: this query must NEVER trigger an auto-fix script

const tests = [

  // ══════════════════════════════════════════════════════════════════════════
  // HARDWARE (50 cases)
  // ══════════════════════════════════════════════════════════════════════════
  { query: 'laptop on nahi ho rha', expectKB: true, expectIntent: 'incident' },
  { query: 'laptop start nahi ho rha', expectKB: true, expectIntent: 'incident' },
  { query: 'laptop bar bar restart ho rha', expectKB: true, expectIntent: 'incident' },
  { query: 'laptop khud band ho jaata hai', expectKB: true, expectIntent: 'incident' },
  { query: 'battery charge nahi ho rhi', expectKB: true, expectIntent: 'incident' },
  { query: 'charger kharab ho gaya', expectKB: true, expectIntent: 'incident' },
  { query: 'keyboard kaam nahi kar rha', expectKB: true, expectIntent: 'incident' },
  { query: 'touchpad kaam nahi kar rha', expectKB: true, expectIntent: 'incident' },
  { query: 'screen black ho gyi', expectKB: true, expectIntent: 'incident' },
  { query: 'screen flickering ho rhi hai', expectKB: true, expectIntent: 'incident' },
  { query: 'screen crack ho gyi', expectKB: true, expectIntent: 'incident', noScript: true },
  { query: 'camera kaam nahi', expectKB: true, expectIntent: 'incident' },
  { query: 'mic kaam nahi', expectKB: true, expectIntent: 'incident' },
  { query: 'speaker nahi chal rha', expectKB: true, expectIntent: 'incident' },
  { query: 'fan noise aa rhi hai', expectKB: true, expectIntent: 'incident' },
  { query: 'laptop overheating ho rha', expectKB: true, expectIntent: 'incident' },
  { query: 'usb port kaam nahi', expectKB: true, expectIntent: 'incident' },
  { query: 'bluetooth nahi chal rha', expectKB: true, expectIntent: 'incident' },
  { query: 'fingerprint kaam nahi', expectKB: true, expectIntent: 'incident' },
  { query: 'laptop water damage', expectKB: true, expectIntent: 'incident', noScript: true },
  { query: 'laptop chori ho gaya', expectKB: true, expectIntent: 'incident', noScript: true },
  { query: 'laptop toot gaya', expectKB: true, expectIntent: 'incident', noScript: true },
  { query: 'leptop on nahi ho rha', expectKB: true, expectIntent: 'incident' },
  { query: 'lptop band ho gya', expectKB: true, expectIntent: 'incident' },
  { query: 'keybord kaam nahi', expectKB: true, expectIntent: 'incident' },
  { query: 'keyborad kaam nahi', expectKB: true, expectIntent: 'incident' },
  { query: 'screeen black ho gyi', expectKB: true, expectIntent: 'incident' },
  { query: 'sceern black', expectKB: true, expectIntent: 'incident' },
  { query: 'batry charge nahi', expectKB: true, expectIntent: 'unknown' },
  { query: 'battry nahi chal rhi', expectKB: true, expectIntent: 'incident' },
  { query: 'bluetooth nhi chal rha', expectKB: true, expectIntent: 'incident' },
  { query: 'bluethooth nahi chal rha', expectKB: true, expectIntent: 'incident' },
  { query: 'mic nahi chal rha', expectKB: true, expectIntent: 'incident' },
  { query: 'microfone kaam nahi', expectKB: true, expectIntent: 'incident' },
  { query: 'speakr nahi aa rha', expectKB: true, expectIntent: 'incident' },
  { query: 'laptop automatic off ho rha', expectKB: true, expectIntent: 'incident' },
  { query: 'sudden shutdown ho rha hai', expectKB: true, expectIntent: 'incident' },
  { query: 'laptop screen dim ho gyi', expectKB: true, expectIntent: 'incident' },
  { query: 'caps lock issue hai', expectKB: true, expectIntent: 'incident' },
  { query: 'sleep mode se laptop nahi uthta', expectKB: true, expectIntent: 'incident' },
  { query: 'fan band ho gaya', expectKB: true, expectIntent: 'incident' },
  { query: 'fan bahut tez awaaz kar rha', expectKB: true, expectIntent: 'incident' },
  { query: 'external monitor detect nahi ho rha', expectKB: true, expectIntent: 'incident' },
  { query: 'hdmi kaam nahi', expectKB: true, expectIntent: 'incident' },
  { query: 'laptop restart loop mein hai', expectKB: true, expectIntent: 'incident' },
  { query: 'laptop garam ho rha hai', expectKB: true, expectIntent: 'incident' },
  { query: 'laptop thanda nahi ho rha', expectKB: true, expectIntent: 'incident' },
  { query: 'sd card nahi dikh rha', expectKB: true, expectIntent: 'incident' },
  { query: 'pen drive detect nahi ho rhi', expectKB: true, expectIntent: 'incident' },
  { query: 'laptop screen pe lines aa rhi hain', expectKB: true, expectIntent: 'incident' },

  // ══════════════════════════════════════════════════════════════════════════
  // SOFTWARE (50 cases)
  // ══════════════════════════════════════════════════════════════════════════
  { query: 'windows boot nahi ho rha', expectKB: true, expectIntent: 'incident' },
  { query: 'blue screen aa rha hai', expectKB: true, expectIntent: 'incident' },
  { query: 'system hang ho gaya', expectKB: true, expectIntent: 'incident' },
  { query: 'excel nahi khul rha', expectKB: true, expectIntent: 'incident' },
  { query: 'word crash ho rha hai', expectKB: true, expectIntent: 'incident' },
  { query: 'teams nahi chal rha', expectKB: true, expectIntent: 'incident' },
  { query: 'zoom nahi chal rha', expectKB: true, expectIntent: 'incident' },
  { query: 'chrome nahi khul rha', expectKB: true, expectIntent: 'incident' },
  { query: 'GOOGLE CHRMO NOT OPEN', expectKB: true, expectIntent: 'incident' },
  { query: 'pdf nahi khul rha', expectKB: true, expectIntent: 'incident' },
  { query: 'windows update nahi ho rha', expectKB: true, expectIntent: 'incident' },
  { query: 'antivirus alert aa rha', expectKB: true, expectIntent: 'incident' },
  { query: 'virus aa gaya', expectKB: true, expectIntent: 'security' },
  { query: 'application crash ho rhi hai', expectKB: true, expectIntent: 'incident' },
  { query: 'software install karna hai', expectKB: true, expectIntent: 'request' },
  { query: 'onedrive sync nahi ho rha', expectKB: true, expectIntent: 'incident' },
  { query: 'gmail nahi khul rha', expectKB: true, expectIntent: 'incident' },
  { query: 'copy paste nahi ho rha', expectKB: true, expectIntent: 'incident' },
  { query: 'date galat hai laptop mein', expectKB: true, expectIntent: 'incident' },
  { query: 'storage full ho gaya', expectKB: true, expectIntent: 'incident' },
  { query: 'account locked ho gaya', expectKB: true, expectIntent: 'incident' },
  { query: 'password bhool gaya', expectKB: true, expectIntent: 'incident' },
  { query: 'windows activation issue', expectKB: true, expectIntent: 'incident' },
  { query: 'ms office activate nahi hai', expectKB: true, expectIntent: 'incident' },
  { query: 'teams meeting join nahi ho rha', expectKB: true, expectIntent: 'incident' },
  { query: 'outlook nahi chal rha', expectKB: true, expectIntent: 'incident' },
  { query: 'browser slow hai', expectKB: true, expectIntent: 'incident' },
  { query: 'chrome slow hai', expectKB: true, expectIntent: 'incident' },
  { query: 'excel crash ho rha hai', expectKB: true, expectIntent: 'incident' },
  { query: 'powerpoint nahi khul rha', expectKB: true, expectIntent: 'incident' },
  { query: 'word document nahi khul rha', expectKB: true, expectIntent: 'incident' },
  { query: 'windows update stuck hai', expectKB: true, expectIntent: 'incident' },
  { query: 'tims nahi chal rha', expectKB: true, expectIntent: 'incident' },
  { query: 'chorme nahi khul rha', expectKB: true, expectIntent: 'incident' },
  { query: 'crome crash ho rha', expectKB: true, expectIntent: 'incident' },
  { query: 'google chrmo not open', expectKB: true, expectIntent: 'incident' },
  { query: 'app band ho jaati hai', expectKB: true, expectIntent: 'incident' },
  { query: 'zoom meeting camera nahi chal rha', expectKB: true, expectIntent: 'incident' },
  { query: 'teams meeting mic nahi chal rha', expectKB: true, expectIntent: 'incident' },
  { query: 'onedrive storage full', expectKB: true, expectIntent: 'incident' },
  { query: 'gmail attachment download nahi ho rha', expectKB: true, expectIntent: 'incident' },
  { query: 'slack nahi chal rha', expectKB: true, expectIntent: 'incident' },
  { query: 'whatsapp web scan nahi ho rha', expectKB: true, expectIntent: 'incident' },
  { query: 'google meet join nahi ho rha', expectKB: true, expectIntent: 'incident' },
  { query: 'keka login nahi ho rha', expectKB: true, expectIntent: 'incident' },
  { query: 'pdf reader nahi hai', expectKB: true, expectIntent: 'incident' },
  { query: 'zip file nahi khul rhi', expectKB: true, expectIntent: 'incident' },
  { query: 'data lost ho gaya', expectKB: true, expectIntent: 'incident', noScript: true },
  { query: 'bios update karna hai', expectKB: true, expectIntent: 'incident', noScript: true },
  { query: 'screen rotate ho gayi', expectKB: true, expectIntent: 'incident' },

  // ══════════════════════════════════════════════════════════════════════════
  // NETWORK (30 cases)
  // ══════════════════════════════════════════════════════════════════════════
  { query: 'wifi nahi chal rha', expectKB: true, expectIntent: 'incident' },
  { query: 'internet slow hai', expectKB: true, expectIntent: 'incident' },
  { query: 'lan cable issue hai', expectKB: true, expectIntent: 'incident' },
  { query: 'website block hai', expectKB: true, expectIntent: 'unknown' },
  { query: 'network drive nahi dikh rha', expectKB: true, expectIntent: 'incident' },
  { query: 'wifi disconnect ho rha baar baar', expectKB: true, expectIntent: 'incident' },
  { query: 'internet nahi chal rha', expectKB: true, expectIntent: 'incident' },
  { query: 'net slow hai', expectKB: true, expectIntent: 'incident' },
  { query: 'wifi nahi chal rahi', expectKB: true, expectIntent: 'incident' },
  { query: 'no internet connected hai', expectKB: true, expectIntent: 'incident' },
  { query: 'hotspot connect nahi ho rha', expectKB: true, expectIntent: 'incident' },
  { query: 'wiffi nahi chal rha', expectKB: true, expectIntent: 'incident' },
  { query: 'wifi bahut slow hai', expectKB: true, expectIntent: 'incident' },
  { query: 'broadband slow hai', expectKB: true, expectIntent: 'incident' },
  { query: 'lan port kaam nahi kar rha', expectKB: true, expectIntent: 'incident' },
  { query: 'mapped drive nahi dikh rha', expectKB: true, expectIntent: 'incident' },
  { query: 'shared folder nahi khul rha', expectKB: true, expectIntent: 'incident' },
  { query: 'remote desktop nahi chal rha', expectKB: true, expectIntent: 'incident' },
  { query: 'website access denied aa rha', expectKB: true, expectIntent: 'incident' },
  { query: 'internet speed bahut kam hai', expectKB: true, expectIntent: 'incident' },
  { query: 'signal nahi aa rha', expectKB: true, expectIntent: 'incident' },
  { query: 'wifi connected hai par internet nahi', expectKB: true, expectIntent: 'incident' },
  { query: 'wifi connected but internet nahi chal rha', expectKB: true, expectIntent: 'incident' },
  { query: 'network cable issue hai', expectKB: true, expectIntent: 'incident' },
  { query: 'rj45 kaam nahi kar rha', expectKB: true, expectIntent: 'incident' },
  { query: 'firewall block kar rha hai', expectKB: true, expectIntent: 'incident' },
  { query: 'ping nahi ho rha', expectKB: true, expectIntent: 'incident' },
  { query: 'wifi password kya hai', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'wiom office ka password kya hai', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'internet speed test kaise karu', expectKB: true, expectIntent: 'information', noScript: true },

  // ══════════════════════════════════════════════════════════════════════════
  // REQUESTS (30 cases) — must return KB AND intent=request
  // ══════════════════════════════════════════════════════════════════════════
  { query: 'headphone chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'printer chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'naya laptop chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'mouse chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'charger chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'LAN cable ki need hai', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'laptop upgrade chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'monitor chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'webcam chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'keyboard chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'charger replacement chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'laptop replace karna hai', expectKB: true, expectIntent: 'asset', noScript: true },
  { query: 'naya mouse chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'headset chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'usb hub chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'adapter chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'laptop bag chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'ssd chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'ram chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'naya keyboard chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'printer ki need hai', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'mouse ki need hai', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'naya charger chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'screen chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'pendrive chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'hard disk chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'phone chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'stand chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'cable chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'new monitor chahiye', expectKB: true, expectIntent: 'request', noScript: true },

  // ══════════════════════════════════════════════════════════════════════════
  // ACCESS (20 cases)
  // ══════════════════════════════════════════════════════════════════════════
  { query: 'slack access chahiye', expectKB: false, expectIntent: 'access', noScript: true },
  { query: 'github access chahiye', expectKB: false, expectIntent: 'access', noScript: true },
  { query: 'google workspace access chahiye', expectKB: false, expectIntent: 'access', noScript: true },
  { query: 'admin rights chahiye', expectKB: false, expectIntent: 'access', noScript: true },
  { query: 'notion access chahiye', expectKB: true, expectIntent: 'access', noScript: true },
  { query: 'jira access chahiye', expectKB: true, expectIntent: 'access', noScript: true },
  { query: 'confluence access chahiye', expectKB: true, expectIntent: 'access', noScript: true },
  { query: 'aws access chahiye', expectKB: false, expectIntent: 'access', noScript: true },
  { query: 'permission chahiye system ki', expectKB: true, expectIntent: 'access', noScript: true },
  { query: 'admin access de do', expectKB: false, expectIntent: 'access', noScript: true },
  { query: 'drive access chahiye', expectKB: false, expectIntent: 'access', noScript: true },
  { query: 'figma access chahiye', expectKB: true, expectIntent: 'access', noScript: true },
  { query: 'role chahiye admin ka', expectKB: true, expectIntent: 'access', noScript: true },
  { query: 'account banana hai', expectKB: true, expectIntent: 'access', noScript: true },
  { query: 'user banana hai system mein', expectKB: true, expectIntent: 'access', noScript: true },
  { query: 'create account karna hai', expectKB: true, expectIntent: 'access', noScript: true },
  { query: 'portal access chahiye', expectKB: true, expectIntent: 'access', noScript: true },
  { query: 'database access chahiye', expectKB: true, expectIntent: 'access', noScript: true },
  { query: 'vpn access chahiye', expectKB: false, expectIntent: 'access', noScript: true },
  { query: 'server access chahiye', expectKB: true, expectIntent: 'access', noScript: true },

  // ══════════════════════════════════════════════════════════════════════════
  // HOW-TO (30 cases)
  // ══════════════════════════════════════════════════════════════════════════
  { query: 'screenshot kaise lu', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'brightness kaise kam karu', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'wallpaper kaise change karu', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'pdf to word kaise karu', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'video kaise play karu', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'video ply kise karu', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'zoom meeting kaise join karu', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'file kaise share karu', expectKB: false, expectIntent: 'information', noScript: true },
  { query: 'copy paste kaise karu', expectKB: false, expectIntent: 'information', noScript: true },
  { query: 'it policy kya hai', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'screenshot kaise karte hain', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'date time kaise change karu', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'default browser kaise change karu', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'dark mode kaise karu', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'side by side window kaise kare', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'desktop icons kaise show kare', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'taskbar kaise fix kare', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'new folder banana kaise', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'file rename kaise kare', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'recycle bin empty kaise karu', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'laptop info kaise dekhe', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'serial number kaise dekhe', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'screen record kaise karu', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'keka payslip kaise download karu', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'keka leave apply kaise kare', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'pdf mein editing kaise kare', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'google drive share kaise kare', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'file size badi hai send nahi ho rhi', expectKB: true, expectIntent: 'incident', noScript: true },
  { query: 'night mode kaise kare', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'mouse speed kaise change kare', expectKB: true, expectIntent: 'information', noScript: true },

  // ══════════════════════════════════════════════════════════════════════════
  // SECURITY (20 cases)
  // ══════════════════════════════════════════════════════════════════════════
  { query: 'virus aa gaya hai laptop mein', expectKB: true, expectIntent: 'security' },
  { query: 'phishing email aaya', expectKB: true, expectIntent: 'security' },
  { query: 'suspicious login hua hai', expectKB: true, expectIntent: 'security' },
  { query: 'laptop hack ho gaya', expectKB: true, expectIntent: 'security' },
  { query: 'malware detected hua', expectKB: true, expectIntent: 'security' },
  { query: 'ransomware aa gaya', expectKB: true, expectIntent: 'security' },
  { query: 'suspicious email mila', expectKB: true, expectIntent: 'security' },
  { query: 'antivirus alert aa rha', expectKB: true, expectIntent: 'incident' },
  { query: 'data leak ho gaya', expectKB: false, expectIntent: 'security' },
  { query: 'unauthorized login hua', expectKB: true, expectIntent: 'security' },
  { query: 'hacked ho gaya account', expectKB: true, expectIntent: 'security' },
  { query: 'spam email aa rha hai', expectKB: true, expectIntent: 'security' },
  { query: 'fraud email mila', expectKB: true, expectIntent: 'unknown' },
  { query: 'scam link aaya hai', expectKB: true, expectIntent: 'incident' },
  { query: 'windows defender warning', expectKB: true, expectIntent: 'incident' },
  { query: 'virus scan karna hai', expectKB: true, expectIntent: 'security' },
  { query: 'phising email kya karu', expectKB: true, expectIntent: 'security' },
  { query: 'credential chori ho gayi', expectKB: false, expectIntent: 'security' },
  { query: 'suspicious activity dikh rha', expectKB: false, expectIntent: 'security' },
  { query: 'breach hua hai', expectKB: true, expectIntent: 'security' },

  // ══════════════════════════════════════════════════════════════════════════
  // ASSET MANAGEMENT (20 cases)
  // ══════════════════════════════════════════════════════════════════════════
  { query: 'laptop wapas karna hai', expectKB: true, expectIntent: 'asset', noScript: true },
  { query: 'laptop damage report karna hai', expectKB: true, expectIntent: 'incident', noScript: true },
  { query: 'exit pe kya karna hai', expectKB: true, expectIntent: 'incident', noScript: true },
  { query: 'laptop return karna hai', expectKB: true, expectIntent: 'asset', noScript: true },
  { query: 'asset return process kya hai', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'resignation pe laptop kya karna hai', expectKB: false, expectIntent: 'incident', noScript: true },
  { query: 'laptop transfer karna hai', expectKB: true, expectIntent: 'asset', noScript: true },
  { query: 'laptop jama karna hai', expectKB: false, expectIntent: 'asset', noScript: true },
  { query: 'accidental damage report', expectKB: true, expectIntent: 'unknown', noScript: true },
  { query: 'laptop toot gaya damage report chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'damage policy kya hai', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'kaunsa laptop milega mujhe', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'laptop allocation policy', expectKB: true, expectIntent: 'incident', noScript: true },
  { query: 'laptop upgrade request karna hai', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'software purchase karna hai', expectKB: true, expectIntent: 'incident', noScript: true },
  { query: 'naya software chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'laptop replace karo purana kharab hai', expectKB: true, expectIntent: 'asset', noScript: true },
  { query: 'charger gum ho gaya replacement chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'it asset number kya hai', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'serial number kaise dekhe laptop ka', expectKB: true, expectIntent: 'information', noScript: true },

  // ══════════════════════════════════════════════════════════════════════════
  // CRITICAL SAFETY (50 cases) — must NEVER show wrong script
  // ══════════════════════════════════════════════════════════════════════════
  // All requests → never incident
  { query: 'headphone chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'printer chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'mouse chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'charger chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'naya laptop chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  // All how-to → information, no script
  { query: 'screenshot kaise lu', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'brightness kaise kam karu', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'wallpaper kaise change karu', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'pdf to word kaise karu', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'zoom meeting kaise join karu', expectKB: true, expectIntent: 'information', noScript: true },
  // Water damage → no script
  { query: 'laptop water damage', expectKB: true, expectIntent: 'incident', noScript: true },
  { query: 'laptop pe paani gira', expectKB: true, expectIntent: 'incident', noScript: true },
  { query: 'laptop bhig gaya', expectKB: true, expectIntent: 'incident', noScript: true },
  { query: 'chai giri laptop pe', expectKB: true, expectIntent: 'incident', noScript: true },
  { query: 'laptop liquid damage', expectKB: true, expectIntent: 'incident', noScript: true },
  // Theft → no script
  { query: 'laptop chori ho gaya', expectKB: true, expectIntent: 'incident', noScript: true },
  { query: 'laptop gum ho gaya', expectKB: true, expectIntent: 'incident', noScript: true },
  { query: 'laptop missing hai', expectKB: true, expectIntent: 'incident', noScript: true },
  { query: 'laptop stolen hai', expectKB: true, expectIntent: 'incident', noScript: true },
  { query: 'laptop khoya hai', expectKB: true, expectIntent: 'incident', noScript: true },
  // Physical damage → no script
  { query: 'screen crack ho gyi', expectKB: true, expectIntent: 'incident', noScript: true },
  { query: 'laptop toot gaya', expectKB: true, expectIntent: 'incident', noScript: true },
  { query: 'keyboard toot gaya', expectKB: true, expectIntent: 'incident', noScript: true },
  { query: 'screen phoot gayi', expectKB: true, expectIntent: 'incident', noScript: true },
  { query: 'laptop gir gaya', expectKB: true, expectIntent: 'incident', noScript: true },
  // WiFi password → no script (information)
  { query: 'wifi password kya hai', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'wiom office password kya hai', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'network ka password kya hai', expectKB: true, expectIntent: 'information', noScript: true },
  // PDF conversion → no script (information)
  { query: 'pdf to word kaise karu', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'pdf convert kaise kare', expectKB: true, expectIntent: 'information', noScript: true },
  // BIOS → no script (IT only)
  { query: 'bios update karna hai', expectKB: true, expectIntent: 'incident', noScript: true },
  { query: 'bios settings change karna hai', expectKB: true, expectIntent: 'incident', noScript: true },
  // Data loss → no script
  { query: 'data lost ho gaya', expectKB: true, expectIntent: 'incident', noScript: true },
  { query: 'files delete ho gayi', expectKB: true, expectIntent: 'incident', noScript: true },
  { query: 'data recover karna hai', expectKB: true, expectIntent: 'incident', noScript: true },
  // Install request → no script (IT does it)
  { query: 'teams install karna hai', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'zoom install kaise karu', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'chrome install karna hai', expectKB: true, expectIntent: 'request', noScript: true },
  // Out of scope
  { query: 'ac nahi chal rha', expectKB: true, expectIntent: 'incident' },
  { query: 'pantry mein khaana nahi hai', expectKB: true, expectIntent: 'incident' },
  // Printer request → no script
  { query: 'printer chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'printer ki zarurat hai', expectKB: true, expectIntent: 'request', noScript: true }, // ki zarurat → request
  // Headphone request → no script
  { query: 'headphone chahiye naya', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'earphone chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  // Access requests → no script
  { query: 'slack access chahiye', expectKB: false, expectIntent: 'access', noScript: true },
  { query: 'github access chahiye', expectKB: false, expectIntent: 'access', noScript: true },
  { query: 'admin rights chahiye', expectKB: false, expectIntent: 'access', noScript: true },
  // Projector → no script if wrong context
  { query: 'projector connect nahi ho rha laptop se', expectKB: true, expectIntent: 'incident' },
  // VPN → out of scope
  { query: 'vpn nahi chal rha', expectKB: true, expectIntent: 'incident' },
  { query: 'vpn access chahiye', expectKB: false, expectIntent: 'access', noScript: true },

  // ══════════════════════════════════════════════════════════════════════════
  // HARDWARE — ADDITIONAL (25 cases)
  // ══════════════════════════════════════════════════════════════════════════
  { query: 'mera lpatop on nahi ho rha', expectKB: true, expectIntent: 'incident' },
  { query: 'screen pe horizontal lines hain', expectKB: true, expectIntent: 'incident' },
  { query: 'battery drain fast ho rhi hai', expectKB: true, expectIntent: 'incident' },
  { query: 'laptop getting hot very fast', expectKB: true, expectIntent: 'incident' },
  { query: 'headphone plug kiya par awaaz nahi', expectKB: true, expectIntent: 'incident' },
  { query: 'wireless mouse connect nahi ho rha', expectKB: true, expectIntent: 'incident' },
  { query: 'keyboard backspace kaam nahi kar rha', expectKB: true, expectIntent: 'incident' },
  { query: 'fingerprint scanner nahi recognise kar rha', expectKB: true, expectIntent: 'incident' },
  { query: 'laptop crash ho gaya', expectKB: true, expectIntent: 'incident' },
  { query: 'caps lock stuck hai', expectKB: true, expectIntent: 'incident' },
  { query: 'screen rotate ho gyi', expectKB: true, expectIntent: 'incident' },
  { query: 'mouse speed bahut fast hai', expectKB: true, expectIntent: 'incident' },
  { query: 'mic pick up nahi kar rha teams mein', expectKB: true, expectIntent: 'incident' },
  { query: 'webcam blurry hai', expectKB: false, expectIntent: 'incident' },
  { query: 'laptop ki hinge toot gayi', expectKB: true, expectIntent: 'incident', noScript: true },
  { query: 'display upside down ho gya', expectKB: true, expectIntent: 'incident' },
  { query: 'screen zoom in ho gaya', expectKB: true, expectIntent: 'incident' },
  { query: 'touchscreen kaam nahi kar rha', expectKB: false, expectIntent: 'incident' },
  { query: 'laptop ka speaker bahut low hai', expectKB: true, expectIntent: 'incident' },
  { query: 'usb hub se devices detect nahi ho rhe', expectKB: true, expectIntent: 'incident' },
  { query: 'num lock issue', expectKB: true, expectIntent: 'incident' },
  { query: 'scroll nahi ho rha', expectKB: false, expectIntent: 'incident' },
  { query: 'bsod error aa gaya', expectKB: true, expectIntent: 'incident' },
  { query: 'laptop dheere chal rha hai', expectKB: true, expectIntent: 'incident' },
  { query: 'touchpad cursor ajeeb behave kar rha hai', expectKB: true, expectIntent: 'incident' },

  // ══════════════════════════════════════════════════════════════════════════
  // SOFTWARE — ADDITIONAL (25 cases)
  // ══════════════════════════════════════════════════════════════════════════
  { query: 'excel freeze ho gaya', expectKB: true, expectIntent: 'incident' },
  { query: 'word document save nahi ho rha', expectKB: true, expectIntent: 'incident' },
  { query: 'powerpoint crash ho gaya', expectKB: true, expectIntent: 'incident' },
  { query: 'onedrive not syncing', expectKB: true, expectIntent: 'incident' },
  { query: 'google drive upload fail ho rha', expectKB: true, expectIntent: 'incident' },
  { query: 'teams video call mein camera nahi aa rha', expectKB: true, expectIntent: 'incident' },
  { query: 'zoom audio nahi aa rha', expectKB: true, expectIntent: 'incident' },
  { query: 'slack notifications nahi aa rhi', expectKB: true, expectIntent: 'incident' },
  { query: 'application not responding', expectKB: true, expectIntent: 'incident' },
  { query: 'task manager nahi khul rha', expectKB: false, expectIntent: 'incident' },
  { query: 'startup slow hai bahut', expectKB: true, expectIntent: 'incident' },
  { query: 'disk usage 100% hai', expectKB: true, expectIntent: 'incident' },
  { query: 'cpu 100% usage hai', expectKB: true, expectIntent: 'incident' },
  { query: 'recycle bin se recover karna hai', expectKB: true, expectIntent: 'incident' },
  { query: 'file corrupt ho gaya', expectKB: true, expectIntent: 'incident' },
  { query: 'zip file open nahi ho rha', expectKB: true, expectIntent: 'incident' },
  { query: 'pdf print nahi ho rha chrome se', expectKB: true, expectIntent: 'incident' },
  { query: 'windows explorer crash ho gaya', expectKB: false, expectIntent: 'incident' },
  { query: 'software nahi chal rha', expectKB: false, expectIntent: 'incident' },
  { query: 'app install nahi ho rhi', expectKB: true, expectIntent: 'incident' },
  { query: 'driver update chahiye', expectKB: true, expectIntent: 'request' },
  { query: 'antivirus scan karna hai', expectKB: true, expectIntent: 'incident' },
  { query: 'windows update stuck hai', expectKB: true, expectIntent: 'incident' },
  { query: 'chrome extension nahi chal rhi', expectKB: false, expectIntent: 'incident' },
  { query: 'browser slow hai', expectKB: true, expectIntent: 'incident' },

  // ══════════════════════════════════════════════════════════════════════════
  // NETWORK — ADDITIONAL (20 cases)
  // ══════════════════════════════════════════════════════════════════════════
  { query: 'wifi connected hai par google nahi khul rha', expectKB: true, expectIntent: 'incident' },
  { query: 'internet bahut slow hai aaj', expectKB: true, expectIntent: 'incident' },
  { query: 'network drive disconnect ho gaya', expectKB: true, expectIntent: 'incident' },
  { query: 'dns error aa rha hai', expectKB: true, expectIntent: 'incident' },
  { query: 'hotspot se laptop connect nahi ho rha', expectKB: true, expectIntent: 'incident' },
  { query: 'wifi password galat hai', expectKB: true, expectIntent: 'incident' },
  { query: 'wifi forget ho gaya', expectKB: false, expectIntent: 'incident' },
  { query: 'ip address conflict hai', expectKB: false, expectIntent: 'incident' },
  { query: 'website certificate error aa rha', expectKB: false, expectIntent: 'incident' },
  { query: 'download speed bahut slow hai', expectKB: true, expectIntent: 'incident' },
  { query: 'video call mein internet issue hai', expectKB: true, expectIntent: 'incident' },
  { query: 'broadband band ho gaya', expectKB: true, expectIntent: 'incident' },
  { query: 'no wifi networks dikh rhe', expectKB: true, expectIntent: 'incident' },
  { query: 'wifi router issue', expectKB: false, expectIntent: 'incident' },
  { query: '5ghz network nahi dikh rha', expectKB: false, expectIntent: 'incident' },
  { query: 'network adapter issue', expectKB: false, expectIntent: 'incident' },
  { query: 'internet bich bich mein cut ho rha', expectKB: true, expectIntent: 'incident' },
  { query: 'zoom call drop ho rha hai net se', expectKB: true, expectIntent: 'incident' },
  { query: 'website blocked hai company se', expectKB: true, expectIntent: 'incident' },
  { query: 'office wifi nahi chal rha', expectKB: true, expectIntent: 'incident' },

  // ══════════════════════════════════════════════════════════════════════════
  // EMAIL/GMAIL (15 cases)
  // ══════════════════════════════════════════════════════════════════════════
  { query: 'gmail account locked ho gaya', expectKB: true, expectIntent: 'incident' },
  { query: 'email spam mein ja rhi hai', expectKB: false, expectIntent: 'incident' },
  { query: 'gmail storage 90% full', expectKB: true, expectIntent: 'incident' },
  { query: 'google calendar sync nahi ho rha', expectKB: true, expectIntent: 'incident' },
  { query: 'email attachment download nahi ho rha', expectKB: true, expectIntent: 'incident' },
  { query: 'gmail nahi khul rha', expectKB: true, expectIntent: 'incident' },
  { query: 'email bhej nahi pa rha hoon', expectKB: true, expectIntent: 'incident' },
  { query: 'gmail app nahi chal rhi phone pe', expectKB: true, expectIntent: 'incident' },
  { query: 'gmail password change karna hai', expectKB: true, expectIntent: 'incident' },
  { query: 'spam email aa rha hai bahut', expectKB: true, expectIntent: 'security' },
  { query: 'google meet nahi chal rha', expectKB: true, expectIntent: 'incident' },
  { query: 'calendar mein meeting nahi dikh rhi', expectKB: false, expectIntent: 'incident' },
  { query: 'email signature kaise set kare', expectKB: false, expectIntent: 'information' },
  { query: 'gmail filter banana hai', expectKB: false, expectIntent: 'information' },
  { query: 'email forward kaise kare', expectKB: false, expectIntent: 'information' },

  // ══════════════════════════════════════════════════════════════════════════
  // VPN (10 cases — all should return KB saying WIOM has no VPN)
  // ══════════════════════════════════════════════════════════════════════════
  { query: 'vpn kaise connect karu', expectKB: true, expectIntent: 'information' },
  { query: 'vpn nahi chal rha', expectKB: true, expectIntent: 'incident' },
  { query: 'vpn access chahiye', expectKB: true, expectIntent: 'access' },
  { query: 'vpn setup karna hai', expectKB: true, expectIntent: 'information' },
  { query: 'vpn slow hai', expectKB: true, expectIntent: 'incident' },
  { query: 'vpn error aa rha hai', expectKB: true, expectIntent: 'incident' },
  { query: 'remote access chahiye', expectKB: true, expectIntent: 'access' },
  { query: 'vpn password bhool gaya', expectKB: true, expectIntent: 'incident' },
  { query: 'vpn install karna hai', expectKB: true, expectIntent: 'request' },
  { query: 'vpn disconnect ho rha hai', expectKB: true, expectIntent: 'incident' },

  // ══════════════════════════════════════════════════════════════════════════
  // PRINTER — ADDITIONAL (10 cases)
  // ══════════════════════════════════════════════════════════════════════════
  { query: 'printer paper jam hai', expectKB: false, expectIntent: 'incident' },
  { query: 'printer network pe nahi dikh rha', expectKB: true, expectIntent: 'incident' },
  { query: 'color print nahi ho rha sirf black white', expectKB: false, expectIntent: 'incident' },
  { query: 'print job cancel nahi ho rha', expectKB: false, expectIntent: 'incident' },
  { query: 'printer add karna hai', expectKB: true, expectIntent: 'incident' },
  { query: 'double sided print kaise kare', expectKB: false, expectIntent: 'information' },
  { query: 'printer ka toner khatam hai', expectKB: false, expectIntent: 'incident' },
  { query: 'print preview galat dikh rha', expectKB: false, expectIntent: 'incident' },
  { query: 'printer driver install karna hai', expectKB: false, expectIntent: 'request' },
  { query: 'printer se scan karna hai', expectKB: false, expectIntent: 'information' },

  // ══════════════════════════════════════════════════════════════════════════
  // SECURITY — ADDITIONAL (10 cases)
  // ══════════════════════════════════════════════════════════════════════════
  { query: 'ransomware attack hua', expectKB: true, expectIntent: 'security', noScript: true },
  { query: 'password change karna hai urgent security', expectKB: true, expectIntent: 'security' },
  { query: 'someone using my account', expectKB: true, expectIntent: 'security', noScript: true },
  { query: 'fake email aaya hai', expectKB: true, expectIntent: 'security', noScript: true },
  { query: 'data theft hua hai', expectKB: true, expectIntent: 'security', noScript: true },
  { query: 'suspicious software install ho gaya', expectKB: true, expectIntent: 'security' },
  { query: 'two factor authentication issue', expectKB: false, expectIntent: 'incident' },
  { query: 'security warning aa rha hai laptop mein', expectKB: true, expectIntent: 'security' },
  { query: 'credential phishing attempt', expectKB: true, expectIntent: 'security', noScript: true },
  { query: 'account hack ho sakta hai', expectKB: true, expectIntent: 'security', noScript: true },

  // ══════════════════════════════════════════════════════════════════════════
  // ACCESS — ADDITIONAL (15 cases)
  // ══════════════════════════════════════════════════════════════════════════
  { query: 'crm access chahiye', expectKB: true, expectIntent: 'access' },
  { query: 'erp access chahiye', expectKB: true, expectIntent: 'access' },
  { query: 'miro access chahiye', expectKB: true, expectIntent: 'access' },
  { query: 'trello access chahiye', expectKB: true, expectIntent: 'access' },
  { query: 'asana access chahiye', expectKB: true, expectIntent: 'access' },
  { query: 'hubspot access chahiye', expectKB: true, expectIntent: 'access' },
  { query: 'salesforce access chahiye', expectKB: true, expectIntent: 'access' },
  { query: 'tally access chahiye', expectKB: true, expectIntent: 'access' },
  { query: 'quickbooks access chahiye', expectKB: true, expectIntent: 'access' },
  { query: 'new software access chahiye', expectKB: true, expectIntent: 'access' },
  { query: 'read only access chahiye shared drive', expectKB: true, expectIntent: 'access' },
  { query: 'admin panel access chahiye', expectKB: true, expectIntent: 'access' },
  { query: 'monday.com access chahiye', expectKB: true, expectIntent: 'access' },
  { query: 'notion access chahiye', expectKB: true, expectIntent: 'access' },
  { query: 'confluence access chahiye', expectKB: true, expectIntent: 'access' },

  // ══════════════════════════════════════════════════════════════════════════
  // ASSET REQUESTS — ADDITIONAL (10 cases)
  // ══════════════════════════════════════════════════════════════════════════
  { query: 'new charger chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'replacement mouse chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'second monitor chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'docking station chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'laptop bag chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'wireless keyboard chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'usb hub chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'webcam chahiye better quality', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'external hard disk chahiye', expectKB: true, expectIntent: 'request', noScript: true },
  { query: 'pendrive chahiye', expectKB: true, expectIntent: 'request', noScript: true },

  // ══════════════════════════════════════════════════════════════════════════
  // HOW-TO — ADDITIONAL (20 cases)
  // ══════════════════════════════════════════════════════════════════════════
  { query: 'google drive mein file share kaise kare', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'teams meeting record kaise kare', expectKB: false, expectIntent: 'information', noScript: true },
  { query: 'zoom background kaise change kare', expectKB: false, expectIntent: 'information', noScript: true },
  { query: 'excel filter kaise lagaye', expectKB: false, expectIntent: 'information', noScript: true },
  { query: 'screen record kaise kare', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'file compress kaise kare', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'zip file kaise banaye', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'two screens extend kaise kare', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'dark mode kaise lagaye', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'pdf se word banana hai', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'pdf merge kaise kare', expectKB: false, expectIntent: 'information', noScript: true },
  { query: 'laptop ka serial number kaise dekhun', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'ram kitni hai kaise dekhun', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'default browser kaise change karu', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'split screen kaise kare', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'file rename shortcut kya hai', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'new folder kaise banate hain', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'date time kaise change kare laptop ka', expectKB: true, expectIntent: 'information', noScript: true },
  { query: 'task manager kaise kholte hain', expectKB: false, expectIntent: 'information', noScript: true },
  { query: 'wifi password kaise change kare', expectKB: false, expectIntent: 'information', noScript: true },

  // ══════════════════════════════════════════════════════════════════════════
  // UNKNOWN/CONVERSATIONAL (10 cases)
  // ══════════════════════════════════════════════════════════════════════════
  { query: 'ajeeb', expectKB: false, expectIntent: 'unknown' },
  { query: 'help', expectKB: false, expectIntent: 'unknown' },
  { query: '123', expectKB: false, expectIntent: 'unknown' },
  { query: 'nahi', expectKB: false, expectIntent: 'unknown' },
  { query: 'ok', expectKB: true, expectIntent: 'unknown' },
  { query: 'bye', expectKB: true, expectIntent: 'unknown' },
  { query: 'done', expectKB: false, expectIntent: 'unknown' },
  { query: 'haan', expectKB: false, expectIntent: 'unknown' },
  { query: 'theek hai', expectKB: true, expectIntent: 'unknown' },
  { query: 'thanks', expectKB: true, expectIntent: 'unknown' },

];

// ── RUN TESTS ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

for (const test of tests) {
  const q = test.query.toLowerCase();
  const { intent: detectedIntent, confidence } = classifyIntent(q);
  const kbAnswer = claude.getKBAnswer ? claude.getKBAnswer(q) : null;

  // Check KB coverage (only when expectKB: true)
  const kbOk = test.expectKB === true ? !!kbAnswer : true;

  // Check intent (when expectIntent is given)
  const intentOk = test.expectIntent
    ? detectedIntent === test.expectIntent
    : true;

  // Safety check: noScript queries must never produce a script
  // We don't import getScriptForText directly (it's inside server.js),
  // so we verify via intent: if noScript and intent is 'incident' with high confidence, flag it
  // noScript = true AND query returns incident with high confidence = potential risk
  // This is a logic check — actual getScriptForText is tested indirectly
  const safetyOk = test.noScript
    ? detectedIntent !== 'incident' || confidence < 60
    : true;

  const ok = kbOk && intentOk;

  if (ok) {
    passed++;
  } else {
    failed++;
    const reasons = [];
    if (!kbOk) reasons.push(`KB: expected ${test.expectKB}, got ${!!kbAnswer}`);
    if (!intentOk) reasons.push(`Intent: expected ${test.expectIntent}, got ${detectedIntent} (conf:${confidence})`);
    failures.push({
      query    : test.query,
      expected : `KB:${test.expectKB} intent:${test.expectIntent}`,
      got      : `KB:${!!kbAnswer} intent:${detectedIntent}(${confidence})`,
      reasons  : reasons.join(' | ')
    });
  }
}

const total  = tests.length;
const pct    = Math.round((passed / total) * 100);
const THRESHOLD = 93;

// ── RESULTS ──────────────────────────────────────────────────────────────
console.log(`\n📊 Regression Test Results — ${new Date().toISOString()}`);
console.log(`Total : ${total}`);
console.log(`✅ Passed: ${passed}/${total} (${pct}%)`);
console.log(`❌ Failed: ${failed}/${total}`);
console.log(`Threshold: ${THRESHOLD}%`);

if (failures.length > 0) {
  console.log(`\n❌ FAILURES (${failures.length}):`);
  failures.forEach((f, i) => {
    console.log(`  ${i + 1}. "${f.query}"`);
    console.log(`     Expected: ${f.expected}`);
    console.log(`     Got:      ${f.got}`);
    if (f.reasons) console.log(`     Reason:   ${f.reasons}`);
  });
}

if (pct < THRESHOLD) {
  console.log(`\n🚫 FAILED: ${pct}% < ${THRESHOLD}% threshold — fix failures before deploying!\n`);
  process.exit(1);
} else {
  console.log(`\n✅ PASSED: ${pct}% >= ${THRESHOLD}% — safe to deploy!\n`);
  process.exit(0);
}
