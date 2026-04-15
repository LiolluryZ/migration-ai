import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = path.resolve(
  __dirname,
  process.env.DB_PATH ?? '../../../legacy/db.sqlite3',
);
const DB_BACKUP_PATH = DB_PATH + '.e2e-backup';

export default async function globalSetup(): Promise<void> {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`Base de donnees introuvable : ${DB_PATH}\nVeuillez demarrer le serveur et verifier le chemin.`);
  }
  fs.copyFileSync(DB_PATH, DB_BACKUP_PATH);
  console.log(`[setup] DB sauvegardee → ${DB_BACKUP_PATH}`);
}
