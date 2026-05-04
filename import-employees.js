const https = require('https');
const fs = require('fs');

const RAILWAY_IP = '151.101.2.15';
const RAILWAY_HOST = 'web-production-ef6c1.up.railway.app';

// ── Read HTML file ────────────────────────────────────────────────────────────
const html = fs.readFileSync('C:\\Users\\Wiom\\Desktop\\Wiom IT Helpdesk — Ghar Ka Net 1-5.html', 'utf8');

// ── Extract employee DB ───────────────────────────────────────────────────────
const empMatch = html.match(/var\s+(?:WIOM_)?(?:EMP|emp)[^=]*=\s*\{([\s\S]*?)\};\s*\/\//);
const empSection = html.match(/'(\d{7})':\{name:'([^']+)',dept:'([^']+)',isAdmin:(true|false)\}/g) || [];

const employees = {};
empSection.forEach(e => {
  const m = e.match(/'(\d+)':\{name:'([^']+)',dept:'([^']+)',isAdmin:(true|false)\}/);
  if (m) employees[m[1]] = { empId: m[1], name: m[2], department: m[3], isAdmin: m[4]==='true' };
});

console.log(`Found ${Object.keys(employees).length} employees`);

// ── Extract asset data ────────────────────────────────────────────────────────
const assetMatches = html.match(/\{emp:'([^']+)',empId:'([^']+)',model:'([^']+)',serial:'([^']+)',date:'([^']*)',cond:'([^']+)',dept:'([^']+)',status:'([^']+)'\}/g) || [];

const assets = {};
assetMatches.forEach(a => {
  const m = a.match(/\{emp:'([^']+)',empId:'([^']+)',model:'([^']+)',serial:'([^']+)',date:'([^']*)',cond:'([^']+)',dept:'([^']+)',status:'([^']+)'\}/);
  if (m && !assets[m[2]]) { // First entry per empId
    assets[m[2]] = { laptop: m[3], serialNo: m[4], laptopCondition: m[6] };
  }
});

console.log(`Found ${Object.keys(assets).length} laptop assets`);

// ── Merge and build employee list ─────────────────────────────────────────────
const employeeList = Object.values(employees).map(emp => ({
  empId      : emp.empId,
  name       : emp.name,
  department : emp.department,
  email      : emp.name.toLowerCase().replace(/\s+/g,'.')
               .replace(/[^a-z.]/g,'') + '@wiom.in',
  floor      : ['Technology','Product','Analytics','Solution Design','Tech For Future','Founders Office'].includes(emp.department)
               ? '2nd Floor' : '1st Floor',
  laptop     : assets[emp.empId]?.laptop || '',
  laptopSN   : assets[emp.empId]?.serialNo || '',
  isAdmin    : emp.isAdmin
}));

console.log(`\nTotal employees to import: ${employeeList.length}`);
console.log('Sample:', JSON.stringify(employeeList[0], null, 2));

// ── API call helper ───────────────────────────────────────────────────────────
function apiPost(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      host: RAILWAY_IP, port: 443, path, method: 'POST',
      servername: RAILWAY_HOST,
      headers: {
        'Content-Type': 'application/json',
        'Host': RAILWAY_HOST,
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = https.request(options, (res) => {
      let resp = '';
      res.on('data', d => resp += d);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(resp) }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ── Login to get token ────────────────────────────────────────────────────────
async function main() {
  console.log('\nLogging in...');
  const login = await apiPost('/api/auth/admin-login', { username: 'sajan', password: 'Wiom@2024' });
  if (!login.body.token) { console.log('Login failed!', login.body); return; }
  const token = login.body.token;
  console.log('Login successful!');

  // ── Import in batches of 50 ───────────────────────────────────────────────
  const BATCH = 50;
  let imported = 0, skipped = 0, errors = 0;

  for (let i = 0; i < employeeList.length; i += BATCH) {
    const batch = employeeList.slice(i, i + BATCH);
    try {
      const data = JSON.stringify({ employees: batch });
      const result = await new Promise((resolve, reject) => {
        const options = {
          host: RAILWAY_IP, port: 443, path: '/api/employees/bulk', method: 'POST',
          servername: RAILWAY_HOST,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Host': RAILWAY_HOST,
            'Content-Length': Buffer.byteLength(data)
          }
        };
        const req = https.request(options, (res) => {
          let resp = '';
          res.on('data', d => resp += d);
          res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(resp) }));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      if (result.status === 200 || result.status === 201) {
        const r = result.body;
        imported += r.inserted || r.imported || r.created || 0;
        skipped  += r.updated || r.skipped || 0;
        console.log(`Batch ${Math.ceil(i/BATCH)+1}: ✅ inserted=${r.inserted||0}, updated=${r.updated||0}`);
      } else {
        console.log(`Batch ${Math.ceil(i/BATCH)+1}: ❌ Status ${result.status}`, result.body);
        errors++;
      }
    } catch(e) {
      console.log(`Batch ${Math.ceil(i/BATCH)+1}: ❌ Error:`, e.message);
      errors++;
    }
  }

  console.log(`\n🎉 Import Complete!`);
  console.log(`✅ Imported: ${imported}`);
  console.log(`⏭  Skipped/Updated: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`📊 Total processed: ${employeeList.length}`);
}

main().catch(console.error);
