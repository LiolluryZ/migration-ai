import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = path.resolve(
  __dirname,
  process.env.DB_PATH ?? '../../../legacy/db.sqlite3',
);
const DB_BACKUP_PATH = DB_PATH + '.e2e-backup';

export default async function globalTeardown(): Promise<void> {
  if (!fs.existsSync(DB_BACKUP_PATH)) {
    console.warn(`[teardown] Aucun backup trouve, restauration ignoree : ${DB_BACKUP_PATH}`);
    return;
  }
  fs.copyFileSync(DB_BACKUP_PATH, DB_PATH);
  fs.unlinkSync(DB_BACKUP_PATH);
  console.log(`[teardown] DB restauree ← ${DB_BACKUP_PATH}`);
}
