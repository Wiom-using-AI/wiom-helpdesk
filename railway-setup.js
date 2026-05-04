const https = require('https');

const TOKEN = '2b10b2a0-1a60-4b6c-a152-32a567c99204';
const PROJECT_ID = 'd08e7be2-1a6d-41c6-a2e7-0c4b3a6224fb';
const SERVICE_ID = 'ba46fbcd-2914-4a81-a059-f13218d625f9';
const ENV_ID = '82384005-c839-4f83-b9a5-dd027c0efbb7';

function railwayRequest(query, variables) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    const options = {
      hostname: 'backboard.railway.app', port: 443, path: '/graphql/v2', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN, 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (d) => data += d);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function upsertVariable(name, value) {
  const mutation = 'mutation($input: VariableUpsertInput!) { variableUpsert(input: $input) }';
  const r = await railwayRequest(mutation, {
    input: { projectId: PROJECT_ID, serviceId: SERVICE_ID, environmentId: ENV_ID, name, value }
  });
  if (r.errors) { console.log('❌', name, ':', r.errors[0].message); }
  else { console.log('✅', name); }
}

async function main() {
  await upsertVariable('ADMIN_JWT_TOKEN', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5ZjRiY2ZkM2VhZWU2ZjBjZGJmZmI5OCIsInVzZXJuYW1lIjoic2FqYW4iLCJyb2xlIjoic3VwZXJhZG1pbiIsIm5hbWUiOiJTYWphbiBLdW1hciIsImlhdCI6MTc3Nzg2ODI4MywiZXhwIjoxNzc3ODk3MDgzfQ.7h5kpYva1qGZZN9X9nTKVucLLoTa8Ro4un6LgtdCuo8');
  console.log('\n🎉 All done!');
}

main().catch(console.error);
