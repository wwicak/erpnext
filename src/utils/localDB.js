import * as SQLite from 'wa-sqlite';

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
        sync_status TEXT DEFAULT 'pending',
        transaction_date TEXT, 
        items_json TEXT, 
        payments_json TEXT, 
        error_message TEXT, 
        local_stock_issue INTEGER DEFAULT 0
      );
    `);
    console.log("'offline_transactions' table schema ensured.");

    await SQLite.exec(db, `
      CREATE TABLE IF NOT EXISTS held_carts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        cart_data_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("'held_carts' table schema ensured.");

    await SQLite.exec(db, `
      CREATE TABLE IF NOT EXISTS clerk_activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        clerk_id TEXT,
        clerk_name TEXT,
        activity_type TEXT, 
        details_json TEXT NULLABLE
      );
    `);
    console.log("'clerk_activity_log' table schema ensured.");

    await SQLite.exec(db, `
      CREATE TABLE IF NOT EXISTS api_sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        offline_transaction_id TEXT,
        erpnext_invoice_id TEXT NULLABLE,
        status TEXT, -- 'SUCCESS', 'FAILED', 'ATTEMPTING'
        http_status_code INTEGER NULLABLE,
        request_payload_json TEXT NULLABLE,
        response_body_json TEXT NULLABLE,
        error_message TEXT NULLABLE,
        FOREIGN KEY (offline_transaction_id) REFERENCES offline_transactions(offline_id) ON DELETE CASCADE
      );
    `);
    console.log("'api_sync_log' table schema ensured.");
    console.log("Database fully initialized with all tables.");

  } catch (error) {
    console.error("Failed to initialize wa-sqlite DB:", error);
    db = null; 
    throw error;
  }
  return db;
}

// --- API Sync Log Functions ---
export async function logApiSyncAttempt(logData) {
  if (!db) await initDB();
  const {
    offline_transaction_id,
    erpnext_invoice_id = null,
    status,
    http_status_code = null,
    request_payload_json = null, // Can be string or object
    response_body_json = null, // Can be string or object
    error_message = null,
  } = logData;

  const reqPayload = typeof request_payload_json === 'string' ? request_payload_json : JSON.stringify(request_payload_json);
  const resBody = typeof response_body_json === 'string' ? response_body_json : JSON.stringify(response_body_json);

  const query = `
    INSERT INTO api_sync_log (
      offline_transaction_id, erpnext_invoice_id, status, http_status_code, 
      request_payload_json, response_body_json, error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?);
  `;
  try {
    await SQLite.exec_stmt(db, query, undefined, undefined, [
      offline_transaction_id, erpnext_invoice_id, status, http_status_code,
      reqPayload, resBody, error_message
    ]);
    console.log(`API Sync attempt logged for ${offline_transaction_id}, status: ${status}`);
  } catch (error) {
    console.error("Error logging API sync attempt:", error, logData);
  }
}

export async function getApiSyncLogs(filters = {}) {
  if (!db) await initDB();
  let query = "SELECT * FROM api_sync_log";
  const params = [];
  const conditions = [];

  if (filters.offlineId) {
    conditions.push("offline_transaction_id LIKE ?");
    params.push(`%${filters.offlineId}%`);
  }
  if (filters.status) {
    conditions.push("status = ?");
    params.push(filters.status);
  }
  if (filters.dateStart) {
    conditions.push("timestamp >= ?"); // Assumes YYYY-MM-DD HH:MM:SS or YYYY-MM-DD
    params.push(filters.dateStart); 
  }
  if (filters.dateEnd) {
    conditions.push("timestamp <= ?"); // Assumes YYYY-MM-DD HH:MM:SS or YYYY-MM-DD
    params.push(filters.dateEnd); 
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }
  
  query += " ORDER BY timestamp DESC";
  
  if (filters.limit) {
    query += " LIMIT ?";
    params.push(filters.limit);
  } else {
    query += " LIMIT 100"; // Default limit if not specified
  }

  const stmt = await SQLite.prepare_stmt(db, query);
  if (params.length > 0) {
    await SQLite.bind_values(stmt, params);
  }
  
  const logs = [];
  while (await SQLite.step(stmt) === SQLite.SQLITE_ROW) {
    const row = SQLite.row_obj(stmt);
    // Deserialize JSON fields if needed (currently they are stored as text)
    // For display, it might be better to keep them as strings or parse in component
    // if (row.request_payload_json) row.request_payload = JSON.parse(row.request_payload_json);
    // if (row.response_body_json) row.response_body = JSON.parse(row.response_body_json);
    logs.push(row);
  }
  await SQLite.finalize(stmt);
  return logs;
}


// --- Clerk Activity Log Functions ---
// ... (keep existing functions: logClerkActivity, getClerkActivityLogs)
export async function logClerkActivity(clerkId, clerkName, activityType, details = null) {
  if (!db) await initDB();
  const details_json = details ? JSON.stringify(details) : null;
  const query = "INSERT INTO clerk_activity_log (clerk_id, clerk_name, activity_type, details_json) VALUES (?, ?, ?, ?);";
  try {
    await SQLite.exec_stmt(db, query, undefined, undefined, [clerkId, clerkName, activityType, details_json]);
  } catch (error) {
    console.error("Error logging clerk activity:", error);
  }
}

export async function getClerkActivityLogs(filters = {}) {
  if (!db) await initDB();
  let query = "SELECT * FROM clerk_activity_log";
  const params = [];
  const conditions = [];
  if (filters.clerkId) { conditions.push("clerk_id = ? OR clerk_name LIKE ?"); params.push(filters.clerkId, `%${filters.clerkId}%`); }
  if (filters.activityType) { conditions.push("activity_type LIKE ?"); params.push(`%${filters.activityType}%`); }
  if (filters.dateStart) { conditions.push("timestamp >= ?"); params.push(filters.dateStart); } 
  if (filters.dateEnd) { conditions.push("timestamp <= ?"); params.push(filters.dateEnd); } 
  if (conditions.length > 0) query += " WHERE " + conditions.join(" AND ");
  query += " ORDER BY timestamp DESC";
  if (filters.limit) { query += " LIMIT ?"; params.push(filters.limit); }

  const stmt = await SQLite.prepare_stmt(db, query);
  if (params.length > 0) await SQLite.bind_values(stmt, params);
  const logs = [];
  while (await SQLite.step(stmt) === SQLite.SQLITE_ROW) {
    const row = SQLite.row_obj(stmt);
    if (row.details_json) {
      try { row.details = JSON.parse(row.details_json); }
      catch (e) { console.error('Error parsing details_json for log:', row.id, e); row.details = { error: "Failed to parse details" }; }
    } else { row.details = null; }
    delete row.details_json;
    logs.push(row);
  }
  await SQLite.finalize(stmt);
  return logs;
}


// --- Offline Transaction Functions ---
// ... (keep existing functions: saveOfflineTransaction, getPendingTransactions, updateTransactionStatus, getAllSalesForReporting)
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
  if (await SQLite.step(stmt) === SQLite.SQLITE_ROW) rowId = SQLite.row(stmt)[0];
  await SQLite.finalize(stmt);
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
      row.items = []; row.payments = [];
      row.error_message = (row.error_message || "") + " Failed to parse items/payments JSON.";
    }
    delete row.items_json; delete row.payments_json;
    transactions.push(row);
  }
  await SQLite.finalize(stmt);
  return transactions;
}

export async function updateTransactionStatus(offline_id, sync_status, error_message = null) {
  if (!db) await initDB();
  const query = "UPDATE offline_transactions SET sync_status = ?, error_message = ? WHERE offline_id = ?;";
  await SQLite.exec_stmt(db, query, undefined, undefined, [sync_status, error_message, offline_id]);
}

export async function getAllSalesForReporting(filters = {}) {
  if (!db) await initDB();
  let query = "SELECT * FROM offline_transactions"; 
  const params = [];
  const conditions = [];
  if (filters.dateStart) { conditions.push("posting_date >= ?"); params.push(filters.dateStart); }
  if (filters.dateEnd) { conditions.push("posting_date <= ?"); params.push(filters.dateEnd); }
  if (conditions.length > 0) query += " WHERE " + conditions.join(" AND ");
  query += " ORDER BY posting_date ASC, posting_time ASC"; 

  const stmt = await SQLite.prepare_stmt(db, query);
  if (params.length > 0) await SQLite.bind_values(stmt, params);
  const sales = [];
  while (await SQLite.step(stmt) === SQLite.SQLITE_ROW) {
    const row = SQLite.row_obj(stmt);
    try {
      row.items = JSON.parse(row.items_json);
      row.payments = JSON.parse(row.payments_json);
    } catch(e) {
      row.items = []; row.payments = [];
    }
    delete row.items_json; delete row.payments_json;
    sales.push(row);
  }
  await SQLite.finalize(stmt);
  return sales;
}

// --- Held Cart Functions ---
// ... (keep existing functions: saveHeldCart, getHeldCarts, deleteHeldCart)
export async function saveHeldCart(cartData, optionalName = null) {
  if (!db) await initDB();
  const cart_data_json = JSON.stringify(cartData);
  const name = optionalName || `Held at ${new Date().toLocaleTimeString()}`;
  const query = "INSERT INTO held_carts (name, cart_data_json) VALUES (?, ?);";
  await SQLite.exec_stmt(db, query, undefined, undefined, [name, cart_data_json]);
  const stmt = await SQLite.prepare_stmt(db, "SELECT last_insert_rowid();");
  let rowId = null;
  if (await SQLite.step(stmt) === SQLite.SQLITE_ROW) rowId = SQLite.row(stmt)[0];
  await SQLite.finalize(stmt);
  return rowId;
}

export async function getHeldCarts() {
  if (!db) await initDB();
  const stmt = await SQLite.prepare_stmt(db, "SELECT * FROM held_carts ORDER BY created_at DESC;");
  const heldCarts = [];
  while (await SQLite.step(stmt) === SQLite.SQLITE_ROW) {
    const row = SQLite.row_obj(stmt);
    try {
      row.cart_data = JSON.parse(row.cart_data_json);
    } catch (e) {
      row.cart_data = {};
    }
    delete row.cart_data_json;
    heldCarts.push(row);
  }
  await SQLite.finalize(stmt);
  return heldCarts;
}

export async function deleteHeldCart(heldCartId) {
  if (!db) await initDB();
  const query = "DELETE FROM held_carts WHERE id = ?;";
  await SQLite.exec_stmt(db, query, undefined, undefined, [heldCartId]);
}


export async function closeDB() {
    if (db) {
        await SQLite.close_db(db);
        db = null;
    }
}
