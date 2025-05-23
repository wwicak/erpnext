import * as SQLite from 'wa-sqlite';
// Dynamic imports for wa-sqlite async module and VFS, as per instruction example
// This helps with Vite/bundler compatibility for WASM.

let db = null;

export async function initDB() {
  if (db) return db;

  try {
    const { default: SQLiteAsyncModule } = await import('wa-sqlite/dist/wa-sqlite-async.mjs');
    const { IDBBatchAtomicVFS } = await import('wa-sqlite/dist/IDBBatchAtomicVFS.mjs');
    
    const module = await SQLiteAsyncModule();
    SQLite.register_module(module);
    
    const vfs = new IDBBatchAtomicVFS('offline_pos_db');
    db = await SQLite.open_db(vfs.name, vfs.name); 
    
    await SQLite.exec(db, `
      PRAGMA journal_mode=TRUNCATE;
      PRAGMA page_size=4096;
      PRAGMA cache_size=1000;
      PRAGMA locking_mode=EXCLUSIVE;
      PRAGMA synchronous=NORMAL;
      PRAGMA temp_store=MEMORY;
    `);
    console.log("Database common PRAGMAs executed.");

    // Create table for offline transactions
    await SQLite.exec(db, `
      CREATE TABLE IF NOT EXISTS offline_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        offline_id TEXT UNIQUE,
        pos_profile TEXT,
        company TEXT,
        customer TEXT,
        posting_date TEXT,
        posting_time TEXT,
        subtotal REAL,
        grand_total REAL,
        total_taxes_and_charges REAL,
        paid_amount REAL,
        change_amount REAL,
        currency TEXT,
        conversion_rate REAL,
        selling_price_list TEXT,
        update_stock INTEGER,
        sync_status TEXT DEFAULT 'pending', -- pending, synced, failed
        transaction_date TEXT,
        items_json TEXT, 
        payments_json TEXT, 
        error_message TEXT, 
        local_stock_issue INTEGER DEFAULT 0
      );
    `);
    console.log("'offline_transactions' table schema ensured.");

    // Create table for held carts
    await SQLite.exec(db, `
      CREATE TABLE IF NOT EXISTS held_carts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT, -- Optional name for the held cart
        cart_data_json TEXT, -- Store cart items, customer, applied payments, etc. as JSON
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("'held_carts' table schema ensured.");
    console.log("Database fully initialized.");

  } catch (error) {
    console.error("Failed to initialize wa-sqlite DB:", error);
    db = null; 
    throw error;
  }
  return db;
}

export async function saveOfflineTransaction(txData) {
  if (!db) await initDB();
  
  const { items, payments, ...otherData } = txData;
  const items_json = JSON.stringify(items);
  const payments_json = JSON.stringify(payments);

  const query = `
    INSERT INTO offline_transactions (
      offline_id, pos_profile, company, customer, posting_date, posting_time,
      subtotal, grand_total, total_taxes_and_charges, paid_amount, change_amount,
      currency, conversion_rate, selling_price_list, update_stock, sync_status,
      transaction_date, items_json, payments_json, local_stock_issue
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `;
  const params = [
    otherData.offline_id, otherData.pos_profile, otherData.company, otherData.customer,
    otherData.posting_date, otherData.posting_time, otherData.subtotal, otherData.grand_total,
    otherData.total_taxes_and_charges, otherData.paid_amount, otherData.change_amount,
    otherData.currency, otherData.conversion_rate, otherData.selling_price_list,
    otherData.update_stock ? 1 : 0, 
    otherData.sync_status || 'pending', otherData.transaction_date,
    items_json, payments_json, otherData.local_stock_issue ? 1 : 0
  ];
  
  await SQLite.exec_stmt(db, query, undefined, undefined, params);
  
  const stmt = await SQLite.prepare_stmt(db, "SELECT last_insert_rowid();");
  let rowId = null;
  if (await SQLite.step(stmt) === SQLite.SQLITE_ROW) {
    const row = SQLite.row(stmt);
    rowId = row[0];
  }
  await SQLite.finalize(stmt);
  console.log('Offline transaction saved, DB row ID:', rowId);
  return rowId;
}

export async function getPendingTransactions() {
  if (!db) await initDB();
  const stmt = await SQLite.prepare_stmt(db, "SELECT * FROM offline_transactions WHERE sync_status = 'pending' ORDER BY id ASC;");
  const transactions = [];
  while (await SQLite.step(stmt) === SQLite.SQLITE_ROW) {
    const row = SQLite.row_obj(stmt);
    try {
      row.items = JSON.parse(row.items_json);
      row.payments = JSON.parse(row.payments_json);
    } catch(e) {
      console.error('Error parsing JSON for transaction:', row.offline_id, e);
      row.items = [];
      row.payments = [];
      row.error_message = (row.error_message || "") + " Failed to parse items/payments JSON.";
    }
    delete row.items_json;
    delete row.payments_json;
    transactions.push(row);
  }
  await SQLite.finalize(stmt);
  return transactions;
}

export async function updateTransactionStatus(offline_id, sync_status, error_message = null) {
  if (!db) await initDB();
  const query = "UPDATE offline_transactions SET sync_status = ?, error_message = ? WHERE offline_id = ?;";
  await SQLite.exec_stmt(db, query, undefined, undefined, [sync_status, error_message, offline_id]);
  console.log(`Transaction ${offline_id} status updated to ${sync_status}`);
}

// --- Held Cart Functions ---

export async function saveHeldCart(cartData, optionalName = null) {
  if (!db) await initDB();
  const cart_data_json = JSON.stringify(cartData);
  const name = optionalName || `Held at ${new Date().toLocaleTimeString()}`; // Default name if not provided

  const query = "INSERT INTO held_carts (name, cart_data_json) VALUES (?, ?);";
  await SQLite.exec_stmt(db, query, undefined, undefined, [name, cart_data_json]);

  const stmt = await SQLite.prepare_stmt(db, "SELECT last_insert_rowid();");
  let rowId = null;
  if (await SQLite.step(stmt) === SQLite.SQLITE_ROW) {
    const row = SQLite.row(stmt);
    rowId = row[0];
  }
  await SQLite.finalize(stmt);
  console.log('Cart held, DB row ID:', rowId, 'Name:', name);
  return rowId;
}

export async function getHeldCarts() {
  if (!db) await initDB();
  const stmt = await SQLite.prepare_stmt(db, "SELECT * FROM held_carts ORDER BY created_at DESC;"); // Newest first
  const heldCarts = [];
  while (await SQLite.step(stmt) === SQLite.SQLITE_ROW) {
    const row = SQLite.row_obj(stmt);
    try {
      row.cart_data = JSON.parse(row.cart_data_json);
    } catch (e) {
      console.error('Error parsing JSON for held cart:', row.id, e);
      row.cart_data = {}; // Avoid crashing, provide empty data
    }
    delete row.cart_data_json; // Remove the raw JSON string
    heldCarts.push(row);
  }
  await SQLite.finalize(stmt);
  return heldCarts;
}

export async function deleteHeldCart(heldCartId) {
  if (!db) await initDB();
  const query = "DELETE FROM held_carts WHERE id = ?;";
  await SQLite.exec_stmt(db, query, undefined, undefined, [heldCartId]);
  console.log(`Held cart with ID ${heldCartId} deleted.`);
}


// Optional: A function to close the DB if ever needed
export async function closeDB() {
    if (db) {
        await SQLite.close_db(db);
        db = null;
        console.log("Database closed.");
    }
}
