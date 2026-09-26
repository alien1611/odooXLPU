/**
 * Phase 2 Automated Verification Suite
 * Tests Auth, RBAC, Password Reset (Demo OTP), Master Data CRUD, Validations, and Audit Logging.
 */

const { newDb } = require('pg-mem');
const fs = require('fs');
const path = require('path');
const http = require('http');

async function runTests() {
  console.log('=== STARTING PHASE 2 AUTOMATED TEST SUITE ===');

  // 1. Initialize In-Memory PostgreSQL instance with real migrations
  const memDb = newDb();
  
  memDb.public.registerFunction({
    name: 'version',
    implementation: () => 'PostgreSQL 18.0 (pg-mem)'
  });

  const sql1 = fs.readFileSync(path.resolve(__dirname, '../src/db/migrations/001_initial_schema.sql'), 'utf8');
  const sql2 = fs.readFileSync(path.resolve(__dirname, '../src/db/migrations/002_phase2_auth_and_master_data.sql'), 'utf8');
  
  memDb.public.none(sql1);
  memDb.public.none(sql2);
  console.log('✔ Migrations 001 and 002 applied cleanly into in-memory Postgres.');

  // Bind the pg adapter from pg-mem to our pool
  const pgAdapter = memDb.adapters.createPg();
  const pool = require('../src/db/pool');
  const originalQuery = pool.query;
  const mockPool = new pgAdapter.Pool();

  pool.query = (text, params) => mockPool.query(text, params);

  // Import app without auto-starting listener
  const express = require('express');
  const cors = require('cors');
  const apiRoutes = require('../src/routes');
  const { errorHandler, notFoundHandler } = require('../src/middleware/errorHandler');

  const testApp = express();
  testApp.use(cors());
  testApp.use(express.json());
  testApp.use('/api', apiRoutes);
  testApp.use(notFoundHandler);
  testApp.use(errorHandler);

  const server = http.createServer(testApp);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;
  console.log(`✔ Express test server running on port ${port}.`);

  let managerToken = '';
  let staffToken = '';
  let managerId = null;

  async function api(endpoint, options = {}) {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, data: json };
  }

  try {
    // ----------------------------------------------------
    // TEST 1: Health Check
    // ----------------------------------------------------
    console.log('\n--- 1. Testing Health Endpoint ---');
    const health = await api('/health');
    if (health.status === 200 && health.data.status === 'ok') {
      console.log('✔ GET /api/health returned 200 OK');
    } else {
      throw new Error(`Health check failed: ${JSON.stringify(health)}`);
    }

    // ----------------------------------------------------
    // TEST 2: Signup Validation & Role Enforcement
    // ----------------------------------------------------
    console.log('\n--- 2. Testing Signup & Role Validation ---');
    
    // Invalid role
    const invRole = await api('/auth/signup', {
      method: 'POST',
      body: { name: 'Invalid User', email: 'inv@test.com', password: 'password123', role: 'super_admin' }
    });
    if (invRole.status === 400 && invRole.data.error.code === 'VALIDATION_ERROR') {
      console.log('✔ Rejected invalid role with 400 VALIDATION_ERROR');
    } else {
      throw new Error(`Failed to reject invalid role: ${JSON.stringify(invRole)}`);
    }

    // Invalid email format
    const invEmail = await api('/auth/signup', {
      method: 'POST',
      body: { name: 'Invalid User', email: 'notanemail', password: 'password123', role: 'inventory_manager' }
    });
    if (invEmail.status === 400 && invEmail.data.error.code === 'VALIDATION_ERROR') {
      console.log('✔ Rejected malformed email with 400 VALIDATION_ERROR');
    } else {
      throw new Error(`Failed to reject malformed email: ${JSON.stringify(invEmail)}`);
    }

    // Short password
    const shortPass = await api('/auth/signup', {
      method: 'POST',
      body: { name: 'Invalid User', email: 'valid@test.com', password: '123', role: 'inventory_manager' }
    });
    if (shortPass.status === 400 && shortPass.data.error.code === 'VALIDATION_ERROR') {
      console.log('✔ Rejected short password with 400 VALIDATION_ERROR');
    } else {
      throw new Error(`Failed to reject short password: ${JSON.stringify(shortPass)}`);
    }

    // Valid Signup - Inventory Manager
    const signupMgr = await api('/auth/signup', {
      method: 'POST',
      body: { name: 'Alice Manager', email: 'Alice.Manager@Stockyard.com', password: 'SecurePassword123!', role: 'inventory_manager' }
    });
    if (signupMgr.status === 201 && signupMgr.data.success && signupMgr.data.data.token) {
      managerToken = signupMgr.data.data.token;
      managerId = signupMgr.data.data.user.id;
      console.log('✔ Successful signup for inventory_manager (normalized email, returned JWT)');
      if (signupMgr.data.data.user.password_hash) {
        throw new Error('Security flaw: password_hash exposed in signup response!');
      }
    } else {
      throw new Error(`Manager signup failed: ${JSON.stringify(signupMgr)}`);
    }

    // Duplicate Email Signup
    const dupSignup = await api('/auth/signup', {
      method: 'POST',
      body: { name: 'Alice Duplicate', email: 'alice.manager@stockyard.com', password: 'SecurePassword123!', role: 'inventory_manager' }
    });
    if (dupSignup.status === 409 && dupSignup.data.error.code === 'DUPLICATE_EMAIL') {
      console.log('✔ Rejected duplicate signup with 409 DUPLICATE_EMAIL');
    } else {
      throw new Error(`Failed to reject duplicate email: ${JSON.stringify(dupSignup)}`);
    }

    // Valid Signup - Warehouse Staff
    const signupStaff = await api('/auth/signup', {
      method: 'POST',
      body: { name: 'Bob Staff', email: 'bob.staff@stockyard.com', password: 'StaffPassword123!', role: 'warehouse_staff' }
    });
    if (signupStaff.status === 201 && signupStaff.data.success && signupStaff.data.data.token) {
      staffToken = signupStaff.data.data.token;
      console.log('✔ Successful signup for warehouse_staff (returned JWT)');
    } else {
      throw new Error(`Staff signup failed: ${JSON.stringify(signupStaff)}`);
    }

    // ----------------------------------------------------
    // TEST 3: Login Authentication
    // ----------------------------------------------------
    console.log('\n--- 3. Testing Login Authentication ---');
    
    // Invalid Password
    const badPass = await api('/auth/login', {
      method: 'POST',
      body: { email: 'alice.manager@stockyard.com', password: 'WrongPassword!' }
    });
    if (badPass.status === 401 && badPass.data.error.code === 'INVALID_CREDENTIALS') {
      console.log('✔ Rejected invalid password with 401 INVALID_CREDENTIALS');
    } else {
      throw new Error(`Failed to reject wrong password: ${JSON.stringify(badPass)}`);
    }

    // Non-existent User
    const noUser = await api('/auth/login', {
      method: 'POST',
      body: { email: 'nobody@stockyard.com', password: 'SomePassword123!' }
    });
    if (noUser.status === 401 && noUser.data.error.code === 'INVALID_CREDENTIALS') {
      console.log('✔ Rejected non-existent user with 401 INVALID_CREDENTIALS without leakage');
    } else {
      throw new Error(`Failed on non-existent user: ${JSON.stringify(noUser)}`);
    }

    // Valid Login
    const validLogin = await api('/auth/login', {
      method: 'POST',
      body: { email: 'ALICE.MANAGER@STOCKYARD.COM', password: 'SecurePassword123!' }
    });
    if (validLogin.status === 200 && validLogin.data.success && validLogin.data.data.token) {
      console.log('✔ Successful login with case-insensitive email and bcrypt verification');
      if (validLogin.data.data.user.password_hash) {
        throw new Error('Security flaw: password_hash exposed in login response!');
      }
    } else {
      throw new Error(`Login failed: ${JSON.stringify(validLogin)}`);
    }

    // ----------------------------------------------------
    // TEST 4: OTP Password Reset Flow (Demo Mode)
    // ----------------------------------------------------
    console.log('\n--- 4. Testing OTP Password Reset Flow (Demo Mode) ---');
    
    // Request OTP
    const reqOtp = await api('/auth/request-otp', {
      method: 'POST',
      body: { email: 'alice.manager@stockyard.com' }
    });
    if (reqOtp.status === 200 && reqOtp.data.success && reqOtp.data.data.demo_otp) {
      const generatedOtp = reqOtp.data.data.demo_otp;
      console.log(`✔ Request OTP generated 6-digit OTP (${generatedOtp}) with demo notice: "${reqOtp.data.data.demo_notice}"`);

      // Reset with Wrong OTP
      const wrongOtpReset = await api('/auth/reset-password', {
        method: 'POST',
        body: { email: 'alice.manager@stockyard.com', otp: '000000', new_password: 'BrandNewPassword123!' }
      });
      if (wrongOtpReset.status === 400 && wrongOtpReset.data.error.code === 'INVALID_OTP') {
        console.log('✔ Rejected invalid OTP code with 400 INVALID_OTP');
      } else {
        throw new Error(`Failed to reject invalid OTP: ${JSON.stringify(wrongOtpReset)}`);
      }

      // Reset with Valid OTP
      const validReset = await api('/auth/reset-password', {
        method: 'POST',
        body: { email: 'alice.manager@stockyard.com', otp: generatedOtp, new_password: 'BrandNewPassword123!' }
      });
      if (validReset.status === 200 && validReset.data.success) {
        console.log('✔ Password reset successful with valid OTP');
      } else {
        throw new Error(`Password reset failed: ${JSON.stringify(validReset)}`);
      }

      // Attempt Reuse of Same OTP
      const reuseReset = await api('/auth/reset-password', {
        method: 'POST',
        body: { email: 'alice.manager@stockyard.com', otp: generatedOtp, new_password: 'AnotherPassword123!' }
      });
      if (reuseReset.status === 400 && reuseReset.data.error.code === 'INVALID_OTP') {
        console.log('✔ Verified OTP cannot be reused after being marked used');
      } else {
        throw new Error(`Security flaw: OTP was reusable: ${JSON.stringify(reuseReset)}`);
      }

      // Verify login with new password
      const loginNew = await api('/auth/login', {
        method: 'POST',
        body: { email: 'alice.manager@stockyard.com', password: 'BrandNewPassword123!' }
      });
      if (loginNew.status === 200 && loginNew.data.success) {
        managerToken = loginNew.data.data.token;
        console.log('✔ Successfully authenticated with the updated password');
      } else {
        throw new Error(`Login with new password failed: ${JSON.stringify(loginNew)}`);
      }
    } else {
      throw new Error(`Request OTP failed: ${JSON.stringify(reqOtp)}`);
    }

    // ----------------------------------------------------
    // TEST 5: RBAC & Token Protection
    // ----------------------------------------------------
    console.log('\n--- 5. Testing RBAC & Protected Endpoints ---');

    // Missing token
    const noToken = await api('/categories');
    if (noToken.status === 401 && noToken.data.error.code === 'UNAUTHORIZED') {
      console.log('✔ Protected endpoint rejected request missing Bearer token (401 UNAUTHORIZED)');
    } else {
      throw new Error(`Failed to reject missing token: ${JSON.stringify(noToken)}`);
    }

    // Malformed token
    const badToken = await api('/categories', {
      headers: { 'Authorization': 'Bearer completely_bogus_token' }
    });
    if (badToken.status === 401 && badToken.data.error.code === 'INVALID_TOKEN') {
      console.log('✔ Protected endpoint rejected invalid token (401 INVALID_TOKEN)');
    } else {
      throw new Error(`Failed to reject bogus token: ${JSON.stringify(badToken)}`);
    }

    // Staff user attempting manager-only action (POST /api/categories)
    const staffForbidden = await api('/categories', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${staffToken}` },
      body: { name: 'Restricted Category' }
    });
    if (staffForbidden.status === 403 && staffForbidden.data.error.code === 'FORBIDDEN') {
      console.log('✔ RBAC correctly blocked warehouse_staff from creating category (403 FORBIDDEN)');
    } else {
      throw new Error(`RBAC failure: staff permitted to create master data: ${JSON.stringify(staffForbidden)}`);
    }

    // ----------------------------------------------------
    // TEST 6: Categories Master Data
    // ----------------------------------------------------
    console.log('\n--- 6. Testing Categories Master Data ---');

    // Create Category as Manager
    const createCat = await api('/categories', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${managerToken}` },
      body: { name: 'Electronics & Sensors', description: 'Industrial components' }
    });
    let categoryId = null;
    if (createCat.status === 201 && createCat.data.success && createCat.data.data.id) {
      categoryId = createCat.data.data.id;
      console.log(`✔ Created category (ID: ${categoryId}) as inventory_manager`);
    } else {
      throw new Error(`Create category failed: ${JSON.stringify(createCat)}`);
    }

    // Duplicate Category Rejection
    const dupCat = await api('/categories', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${managerToken}` },
      body: { name: 'Electronics & Sensors' }
    });
    if (dupCat.status === 409 && dupCat.data.error.code === 'DUPLICATE_CATEGORY') {
      console.log('✔ Rejected duplicate category name (409 DUPLICATE_CATEGORY)');
    } else {
      throw new Error(`Failed to reject duplicate category: ${JSON.stringify(dupCat)}`);
    }

    // List Categories
    const listCat = await api('/categories', {
      headers: { 'Authorization': `Bearer ${staffToken}` }
    });
    if (listCat.status === 200 && Array.isArray(listCat.data.data) && listCat.data.data.length >= 1) {
      console.log('✔ Listed categories successfully for warehouse_staff');
    } else {
      throw new Error(`List categories failed: ${JSON.stringify(listCat)}`);
    }

    // ----------------------------------------------------
    // TEST 7: UoM Master Data
    // ----------------------------------------------------
    console.log('\n--- 7. Testing UoM Master Data ---');

    // Invalid conversion_to_base
    const badUom = await api('/uom', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${managerToken}` },
      body: { name: 'Zero UoM', code: 'ZERO', conversion_to_base: 0 }
    });
    if (badUom.status === 400 && badUom.data.error.code === 'VALIDATION_ERROR') {
      console.log('✔ Rejected invalid conversion_to_base <= 0 with 400 VALIDATION_ERROR');
    } else {
      throw new Error(`Failed to reject invalid conversion_to_base: ${JSON.stringify(badUom)}`);
    }

    // Valid UoM Creation
    const createUom = await api('/uom', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${managerToken}` },
      body: { name: 'Kilogram', code: 'KG', category: 'weight', conversion_to_base: 1.0 }
    });
    let uomId = null;
    if (createUom.status === 201 && createUom.data.success && createUom.data.data.id) {
      uomId = createUom.data.data.id;
      console.log(`✔ Created Unit of Measure (ID: ${uomId}, Code: KG)`);
    } else {
      throw new Error(`Create UoM failed: ${JSON.stringify(createUom)}`);
    }

    // ----------------------------------------------------
    // TEST 8: Warehouses Master Data
    // ----------------------------------------------------
    console.log('\n--- 8. Testing Warehouses Master Data ---');

    const createWh = await api('/warehouses', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${managerToken}` },
      body: { name: 'Central Logistics Hub', code: 'WH-MAIN', address: '100 Industrial Parkway' }
    });
    let warehouseId = null;
    if (createWh.status === 201 && createWh.data.success && createWh.data.data.id) {
      warehouseId = createWh.data.data.id;
      console.log(`✔ Created Warehouse (ID: ${warehouseId}, Code: WH-MAIN)`);
    } else {
      throw new Error(`Create warehouse failed: ${JSON.stringify(createWh)}`);
    }

    // Duplicate Warehouse Code Rejection
    const dupWh = await api('/warehouses', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${managerToken}` },
      body: { name: 'Second Warehouse', code: 'WH-MAIN' }
    });
    if (dupWh.status === 409 && dupWh.data.error.code === 'DUPLICATE_WAREHOUSE_CODE') {
      console.log('✔ Rejected duplicate warehouse code (409 DUPLICATE_WAREHOUSE_CODE)');
    } else {
      throw new Error(`Failed to reject duplicate warehouse code: ${JSON.stringify(dupWh)}`);
    }

    // ----------------------------------------------------
    // TEST 9: Locations Master Data & Foreign Keys
    // ----------------------------------------------------
    console.log('\n--- 9. Testing Locations Master Data & FK Enforcements ---');

    // Missing warehouse_id
    const badLocWh = await api('/locations', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${managerToken}` },
      body: { name: 'Orphan Bin' }
    });
    if (badLocWh.status === 400 && badLocWh.data.error.code === 'VALIDATION_ERROR') {
      console.log('✔ Rejected location missing warehouse_id (400 VALIDATION_ERROR)');
    } else {
      throw new Error(`Failed on missing warehouse_id: ${JSON.stringify(badLocWh)}`);
    }

    // Non-existent warehouse_id
    const noWhLoc = await api('/locations', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${managerToken}` },
      body: { warehouse_id: 999999, name: 'Ghost Location', code: 'GHOST-01' }
    });
    if (noWhLoc.status === 400 && noWhLoc.data.error.code === 'INVALID_FOREIGN_KEY') {
      console.log('✔ Rejected non-existent warehouse_id with 400 INVALID_FOREIGN_KEY');
    } else {
      throw new Error(`Failed on non-existent warehouse: ${JSON.stringify(noWhLoc)}`);
    }

    // Create Root Location
    const createLoc = await api('/locations', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${managerToken}` },
      body: { warehouse_id: warehouseId, name: 'Zone A - Cold Storage', code: 'ZONE-A', type: 'internal' }
    });
    let rootLocId = null;
    if (createLoc.status === 201 && createLoc.data.success && createLoc.data.data.id) {
      rootLocId = createLoc.data.data.id;
      console.log(`✔ Created Root Location (ID: ${rootLocId}, Code: ZONE-A)`);
    } else {
      throw new Error(`Create location failed: ${JSON.stringify(createLoc)}`);
    }

    // Create Sub-Location with parent_location_id
    const subLoc = await api('/locations', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${managerToken}` },
      body: { warehouse_id: warehouseId, parent_location_id: rootLocId, name: 'Rack A-01', code: 'RACK-A01', type: 'internal' }
    });
    if (subLoc.status === 201 && subLoc.data.success && subLoc.data.data.parent_location_id === rootLocId) {
      console.log('✔ Created Child Location with valid parent_location_id hierarchy');
    } else {
      throw new Error(`Create sub-location failed: ${JSON.stringify(subLoc)}`);
    }

    // ----------------------------------------------------
    // TEST 10: Products Master Data & Validation
    // ----------------------------------------------------
    console.log('\n--- 10. Testing Products Master Data & FK Enforcements ---');

    // Missing SKU
    const noSku = await api('/products', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${managerToken}` },
      body: { name: 'Sensor Module', uom_id: uomId }
    });
    if (noSku.status === 400 && noSku.data.error.code === 'VALIDATION_ERROR') {
      console.log('✔ Rejected product missing SKU with 400 VALIDATION_ERROR');
    } else {
      throw new Error(`Failed on missing SKU: ${JSON.stringify(noSku)}`);
    }

    // Invalid UoM FK
    const badUomProd = await api('/products', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${managerToken}` },
      body: { name: 'Sensor Module', sku: 'SKU-SENSOR-01', uom_id: 99999 }
    });
    if (badUomProd.status === 400 && badUomProd.data.error.code === 'INVALID_FOREIGN_KEY') {
      console.log('✔ Rejected product with non-existent uom_id (400 INVALID_FOREIGN_KEY)');
    } else {
      throw new Error(`Failed on non-existent uom_id: ${JSON.stringify(badUomProd)}`);
    }

    // Invalid Category FK
    const badCatProd = await api('/products', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${managerToken}` },
      body: { name: 'Sensor Module', sku: 'SKU-SENSOR-01', uom_id: uomId, category_id: 99999 }
    });
    if (badCatProd.status === 400 && badCatProd.data.error.code === 'INVALID_FOREIGN_KEY') {
      console.log('✔ Rejected product with non-existent category_id (400 INVALID_FOREIGN_KEY)');
    } else {
      throw new Error(`Failed on non-existent category_id: ${JSON.stringify(badCatProd)}`);
    }

    // Valid Product Creation
    const createProd = await api('/products', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${managerToken}` },
      body: {
        name: 'Digital Temperature Sensor Pro',
        sku: 'SKU-TEMP-001',
        category_id: categoryId,
        uom_id: uomId,
        tracking_type: 'lot',
        cost_price: 25.50,
        sale_price: 49.99,
        reorder_point: 100,
        lead_time_days: 7
      }
    });
    if (createProd.status === 201 && createProd.data.success && createProd.data.data.id) {
      console.log(`✔ Created Product: ${createProd.data.data.name} (SKU: ${createProd.data.data.sku}, Reorder Point: 100, Lead Time: 7d)`);
    } else {
      throw new Error(`Create product failed: ${JSON.stringify(createProd)}`);
    }

    // Duplicate SKU Rejection
    const dupSku = await api('/products', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${managerToken}` },
      body: {
        name: 'Duplicate Sensor',
        sku: 'SKU-TEMP-001',
        uom_id: uomId
      }
    });
    if (dupSku.status === 409 && dupSku.data.error.code === 'DUPLICATE_SKU') {
      console.log('✔ Rejected duplicate product SKU (409 DUPLICATE_SKU)');
    } else {
      throw new Error(`Failed to reject duplicate SKU: ${JSON.stringify(dupSku)}`);
    }

    // ----------------------------------------------------
    // TEST 11: Audit Log Verification
    // ----------------------------------------------------
    console.log('\n--- 11. Testing Audit Log Integrity ---');
    const auditRes = await mockPool.query('SELECT action, entity_type, entity_id, user_id FROM audit_log ORDER BY id ASC');
    console.log(`✔ Total audit log entries recorded: ${auditRes.rows.length}`);
    const recordedEntities = new Set(auditRes.rows.map(r => r.entity_type));
    console.log('✔ Audit log contains records for:', Array.from(recordedEntities).join(', '));
    
    if (!recordedEntities.has('users') || !recordedEntities.has('products') || !recordedEntities.has('warehouses')) {
      throw new Error('Audit logging missed expected core master data entities');
    }

    console.log('\n======================================================');
    console.log('🎉 ALL PHASE 2 BACKEND AUTOMATED TESTS PASSED CLEANLY!');
    console.log('======================================================');

  } finally {
    server.close();
    pool.query = originalQuery;
  }
}

runTests().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err.message);
  process.exit(1);
});
