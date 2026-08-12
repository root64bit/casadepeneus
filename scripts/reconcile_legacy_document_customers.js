import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL missing in .env');

const apply = process.argv.includes('--apply');
const posDirectory = path.join(process.cwd(), 'pos_latest', 'Pos');
const cp850High = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ ';

function decodeCp850(buffer) {
  let result = '';
  for (const byte of buffer) {
    result += byte < 128 ? String.fromCharCode(byte) : (cp850High[byte - 128] ?? '?');
  }
  return result.trim();
}

function readDbf(fileName) {
  const buffer = fs.readFileSync(path.join(posDirectory, fileName));
  const recordCount = buffer.readUInt32LE(4);
  const headerLength = buffer.readUInt16LE(8);
  const recordLength = buffer.readUInt16LE(10);
  const fields = [];

  for (let offset = 32; offset < headerLength && buffer[offset] !== 0x0d; offset += 32) {
    fields.push({
      name: buffer.subarray(offset, offset + 11).toString('ascii').split('\0')[0].trim(),
      length: buffer[offset + 16],
    });
  }

  const records = [];
  for (let index = 0, offset = headerLength; index < recordCount && offset + recordLength <= buffer.length; index += 1, offset += recordLength) {
    if (buffer[offset] === 0x2a) continue;
    let fieldOffset = offset + 1;
    const record = {};
    for (const field of fields) {
      record[field.name] = decodeCp850(buffer.subarray(fieldOffset, fieldOffset + field.length));
      fieldOffset += field.length;
    }
    records.push(record);
  }
  return records;
}

const cleanSnapshotValue = (value, fallback = 'N/A') => {
  const cleaned = String(value ?? '').replace(/[|\]]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || fallback;
};

function buildLegacySnapshots() {
  const customers = new Map(
    readDbf('FACMTCF.DBF')
      .filter((row) => row.MODULO === 'C')
      .map((row) => [String(Number(row.CODIGO)), row]),
  );
  const cashSaleSnapshots = new Map(readDbf('FACMTVD.DBF').map((row) => [row.DOC, row]));
  const documents = readDbf('FACMTFA.DBF').filter((row) => /^(CV|CF|FN|CG)/.test(row.DOC));
  const snapshots = new Map();

  for (const row of documents) {
    const prefix = row.DOC.slice(0, 2);
    const type = prefix === 'CV' ? 'VD' : prefix === 'CG' ? 'GR' : 'FT';
    const year = row.DATA.slice(0, 4);
    const sequence = String(Number(row.DOC.replace(/\D/g, ''))).padStart(6, '0');
    const displayNumber = `${type}-${year}/${sequence}`;
    const customer = customers.get(String(Number(row.NUMCF)));
    const documentSnapshot = cashSaleSnapshots.get(row.DOC);
    const sourceName = documentSnapshot?.NOME || customer?.NOME || '';
    const name = /^VENDA AO PUBLICO$/i.test(sourceName.trim()) ? 'Cliente Pontual' : cleanSnapshotValue(sourceName, 'Cliente Pontual');
    const address = cleanSnapshotValue(
      [documentSnapshot?.MORADA, documentSnapshot?.MORADA2, customer?.MORADA, customer?.MORADA2]
        .filter(Boolean)
        .join(' '),
    );
    const nuit = cleanSnapshotValue(documentSnapshot?.NCONTRIB || customer?.NCONTRIB);
    snapshots.set(displayNumber, { displayNumber, sourceDocument: row.DOC, customerNumber: String(Number(row.NUMCF)), name, nuit, address });
  }
  return snapshots;
}

async function main() {
  const snapshots = buildLegacySnapshots();
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const result = await client.query(`
      SELECT id, display_number, notes
      FROM public.documents
      WHERE display_number ~ '^(FT|VD|GR)-'
        AND COALESCE(notes, '') NOT LIKE '[CLIENTE:%'
        AND COALESCE(notes, '') ILIKE '%Migrado de Pos.zip%'
      ORDER BY display_number, id
    `);

    const changes = result.rows.flatMap((document) => {
      const snapshot = snapshots.get(document.display_number);
      if (!snapshot) return [];
      const oldNotes = String(document.notes ?? '').trim();
      const newNotes = `[CLIENTE: ${snapshot.name} | NUIT: ${snapshot.nuit} | MORADA: ${snapshot.address}] ${oldNotes}`.trim();
      return [{ id: document.id, old_notes: oldNotes, new_notes: newNotes, source_document: snapshot.sourceDocument, customer_number: snapshot.customerNumber }];
    });

    const named = changes.filter((change) => !change.new_notes.startsWith('[CLIENTE: Cliente Pontual |')).length;
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'preview', sourceSnapshots: snapshots.size, candidates: result.rowCount, matched: changes.length, namedCustomers: named, sample: changes.slice(0, 5) }, null, 2));
    if (!apply || changes.length === 0) return;

    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS migration.legacy_document_customer_backup_20260811 (
        document_id UUID PRIMARY KEY,
        old_notes TEXT,
        new_notes TEXT NOT NULL,
        source_document TEXT NOT NULL,
        customer_number TEXT,
        backed_up_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    for (let offset = 0; offset < changes.length; offset += 500) {
      const batch = changes.slice(offset, offset + 500);
      await client.query(`
        WITH payload AS (
          SELECT * FROM jsonb_to_recordset($1::jsonb)
            AS item(id UUID, old_notes TEXT, new_notes TEXT, source_document TEXT, customer_number TEXT)
        )
        INSERT INTO migration.legacy_document_customer_backup_20260811(document_id,old_notes,new_notes,source_document,customer_number)
        SELECT id,old_notes,new_notes,source_document,customer_number FROM payload
        ON CONFLICT (document_id) DO NOTHING
      `, [JSON.stringify(batch)]);
      await client.query(`
        WITH payload AS (
          SELECT * FROM jsonb_to_recordset($1::jsonb)
            AS item(id UUID, new_notes TEXT)
        )
        UPDATE public.documents document
        SET notes=payload.new_notes, updated_at=now()
        FROM payload
        WHERE document.id=payload.id
          AND COALESCE(document.notes,'') NOT LIKE '[CLIENTE:%'
      `, [JSON.stringify(batch)]);
    }
    await client.query('COMMIT');
    console.log(`Reconciled ${changes.length} historical documents. Original notes are recoverable in migration.legacy_document_customer_backup_20260811.`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
