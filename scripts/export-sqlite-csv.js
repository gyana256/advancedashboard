#!/usr/bin/env node
// Simple helper: export transactions from local SQLite DB to CSV
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'data.db');
const out = process.env.OUT || path.join(process.cwd(), 'transactions-export.csv');

if(!fs.existsSync(dbPath)){
  console.error('SQLite DB not found at', dbPath);
  process.exit(2);
}

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err)=>{
  if(err){ console.error('Failed to open DB', err.message); process.exit(2);} 
});

db.serialize(()=>{
  db.all('SELECT type,name,date,amount,created_by,updated_by FROM transactions ORDER BY id ASC', (err, rows)=>{
    if(err){ console.error('Query failed', err.message); process.exit(2); }
    const hdr = 'type,name,date,amount,created_by,updated_by\n';
    const body = rows.map(r=> `${r.type},"${(r.name||'').replace(/"/g,'""')}",${r.date},${r.amount},${r.created_by||''},${r.updated_by||''}`).join('\n');
    fs.writeFileSync(out, hdr + body, 'utf8');
    console.log('Exported', rows.length, 'rows to', out);
    db.close();
  });
});
