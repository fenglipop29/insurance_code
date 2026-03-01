const fs = require('fs');
const { Client } = require('pg');
(async () => {
  const db = JSON.parse(fs.readFileSync('server/data/db.json', 'utf8'));
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: false });
  await c.connect();
  await c.query(`CREATE TABLE IF NOT EXISTS runtime_state (id smallint PRIMARY KEY CHECK (id=1), payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
  await c.query(`INSERT INTO runtime_state(id,payload,updated_at) VALUES (1,$1::jsonb,now()) ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload, updated_at=now()`, [JSON.stringify(db)]);
  const r = await c.query(`SELECT jsonb_array_length(payload->'users') users, jsonb_array_length(payload->'activities') activities, jsonb_array_length(payload->'mallItems') mall_items FROM runtime_state WHERE id=1`);
  console.log('seed ok:', r.rows[0]);
  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
