// SPDX-License-Identifier: MIT

export async function audit(client, { table, recordId, action, oldValues, newValues, userId, reason }) {
  await client.query(
    `INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, user_id, reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [table, recordId, action, oldValues ?? null, newValues ?? null, userId ?? null, reason ?? null],
  );
}
