const pg = require('pg');

(async () => {
  const p = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
  const c = await p.connect();
  try {
    await c.query('BEGIN');

    const u = await c.query("select id from users where mobile_enc='18616135811' limit 1");
    if (!u.rows.length) throw new Error('USER_NOT_FOUND');
    const uid = Number(u.rows[0].id);

    const sign = await c.query('select id from app_sign_ins where user_id=$1 order by id desc limit 1', [uid]);
    const tx = await c.query("select id from point_transactions where user_id=$1 and source_type='daily_sign_in' order by id desc limit 1", [uid]);

    if (sign.rows[0]) {
      await c.query('delete from app_sign_ins where id=$1', [Number(sign.rows[0].id)]);
    }
    if (tx.rows[0]) {
      await c.query('delete from point_transactions where id=$1', [Number(tx.rows[0].id)]);
    }

    const latest = await c.query('select balance_after from point_transactions where user_id=$1 order by id desc limit 1', [uid]);
    const bal = latest.rows[0] ? Number(latest.rows[0].balance_after) : 0;

    await c.query(
      'insert into point_accounts(user_id,balance,updated_at) values($1,$2,now()) on conflict (user_id) do update set balance=excluded.balance, updated_at=now()',
      [uid, bal]
    );

    await c.query('COMMIT');
    console.log(JSON.stringify({ ok: true, userId: uid, removedSignId: sign.rows[0]?.id || null, removedTxId: tx.rows[0]?.id || null, newBalance: bal }));
  } catch (e) {
    await c.query('ROLLBACK');
    console.error(e.message || e);
    process.exit(1);
  } finally {
    c.release();
    await p.end();
  }
})();
