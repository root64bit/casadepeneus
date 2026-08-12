import assert from 'node:assert/strict';
import fs from 'node:fs';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const connectionString=process.env.DATABASE_URL;
if(!connectionString)throw new Error('DATABASE_URL missing in .env');
const migrationSql=fs.readFileSync('supabase/migrations/20260812120000_042_reconciled_paginated_stock_history.sql','utf8')
  .replace(/^\uFEFF?\s*BEGIN;\s*/i,'').replace(/\s*COMMIT;\s*$/i,'');
const client=new pg.Client({connectionString,ssl:{rejectUnauthorized:false}});
try{
  await client.connect();await client.query('BEGIN');await client.query(migrationSql);
  const user=await client.query(`SELECT up.id FROM public.user_profiles up WHERE EXISTS(
    SELECT 1 FROM public.user_roles ur JOIN public.role_permissions rp ON rp.role_id=ur.role_id
    JOIN public.permissions p ON p.id=rp.permission_id
    WHERE ur.user_id=up.id AND p.code IN('stock.read','products.read')) LIMIT 1`);
  assert.equal(user.rowCount,1,'No stock reader found');
  await client.query(`SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)`,[user.rows[0].id]);

  const page=(await client.query(`SELECT public.get_stock_movements_page_v2(NULL,NULL,'ALL',NULL,25,0) data`)).rows[0].data;
  assert.equal(page.rows.length,25,'Movement page size differs');
  assert.ok(Number(page.total_count)>25,'Total count is not server-side');
  const entryPage=(await client.query(`SELECT public.get_stock_movements_page_v2(NULL,NULL,'ENTRADA',NULL,25,0) data`)).rows[0].data;
  assert.ok(entryPage.rows.every((row)=>Number(row.quantity_in)>0&&Number(row.quantity_out)===0),'Entry page contains exits');

  const productId=page.rows[0].product_id;
  const extract=(await client.query(`SELECT public.get_stock_movement_extract_v2($1,NULL,NULL,'ALL',50,0) data`,[productId])).rows[0].data;
  assert.ok(extract.movements.length<=50,'Extract is not paginated');
  for(const movement of extract.movements){
    const expected=await client.query(`WITH stock AS(
      SELECT COALESCE(SUM(quantity),0) value FROM public.inventory_balances WHERE product_id=$1
    ),newer AS(
      SELECT COALESCE(SUM(quantity_in-quantity_out),0) value FROM public.stock_movements
      WHERE product_id=$1 AND (created_at,id)>($2::timestamptz,$3::uuid)
    ) SELECT stock.value-newer.value expected FROM stock,newer`,[productId,movement.created_at,movement.id]);
    assert.equal(Number(movement.running_balance),Number(expected.rows[0].expected),'Running balance differs from current stock reconciliation');
  }
  console.log(`Stock history validation passed: ${page.total_count} total movements; page and balances reconciled.`);
}finally{await client.query('ROLLBACK').catch(()=>{});await client.end().catch(()=>{});}
