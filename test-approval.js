#!/usr/bin/env node

/**
 * Test script for Product Hunt Finder approval functionality
 * This script helps test the approval process and Google Sheets integration
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';
const AUTH_HEADER = 'Basic ' + Buffer.from('admin:admin123').toString('base64');

async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': AUTH_HEADER,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const data = await response.json();
    return { success: response.ok, status: response.status, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function testServerStatus() {
  console.log('🔍 Testing server status...');
  const result = await makeRequest(`${BASE_URL}/api/health`);
  
  if (result.success) {
    console.log('✅ Server is running');
    return true;
  } else {
    console.log('❌ Server is not responding');
    return false;
  }
}

async function testGoogleSheetsStatus() {
  console.log('🔍 Testing Google Sheets integration...');
  const result = await makeRequest(`${BASE_URL}/api/sheets/status`);
  
  if (result.success && result.data.googleSheets?.available) {
    console.log('✅ Google Sheets integration is working');
    console.log(`   Sheet: ${result.data.googleSheets.sheetName}`);
    console.log(`   Rows: ${result.data.googleSheets.totalRows}`);
    return true;
  } else {
    console.log('⚠️  Google Sheets integration not configured');
    console.log('   This is optional - approvals will still work without it');
    return false;
  }
}

async function getPendingMakers() {
  console.log('🔍 Getting pending makers...');
  const result = await makeRequest(`${BASE_URL}/api/makers?status=pending`);
  
  if (result.success) {
    const count = result.data.makers?.length || 0;
    console.log(`✅ Found ${count} pending makers`);
    return result.data.makers || [];
  } else {
    console.log('❌ Failed to get pending makers');
    return [];
  }
}

async function testApproval(makerId, makerName) {
  console.log(`🔍 Testing approval for: ${makerName} (${makerId})`);
  const result = await makeRequest(`${BASE_URL}/api/makers/${makerId}/approve`, {
    method: 'POST'
  });
  
  if (result.success) {
    console.log('✅ Approval successful');
    if (result.data.sheets?.synced) {
      console.log('✅ Successfully synced to Google Sheets');
    } else if (result.data.sheets?.error) {
      console.log(`⚠️  Approval successful but Google Sheets sync failed: ${result.data.sheets.error}`);
    }
    return true;
  } else {
    console.log(`❌ Approval failed: ${result.data.error?.message || 'Unknown error'}`);
    return false;
  }
}

async function testResyncSheets() {
  console.log('🔍 Testing manual Google Sheets resync...');
  const result = await makeRequest(`${BASE_URL}/api/cron/resync-sheets`, {
    method: 'POST'
  });
  
  if (result.success) {
    console.log(`✅ Resync completed: ${result.data.successCount} successful, ${result.data.failureCount} failed`);
    return true;
  } else {
    console.log(`❌ Resync failed: ${result.data.error?.message || 'Unknown error'}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Product Hunt Finder - Approval Test Script');
  console.log('='.repeat(50));
  
  // Test server status
  const serverOk = await testServerStatus();
  if (!serverOk) {
    console.log('\n❌ Server is not running. Please start the server first:');
    console.log('   npm start');
    process.exit(1);
  }
  
  console.log('');
  
  // Test Google Sheets
  const sheetsOk = await testGoogleSheetsStatus();
  console.log('');
  
  // Get pending makers
  const pendingMakers = await getPendingMakers();
  console.log('');
  
  if (pendingMakers.length === 0) {
    console.log('ℹ️  No pending makers found to test approval with');
    console.log('   You can run the RSS fetch to get new makers:');
    console.log('   curl -X POST http://localhost:3000/api/cron/fetch');
  } else {
    // Test approval with the first pending maker
    const testMaker = pendingMakers[0];
    console.log(`🧪 Testing approval with: ${testMaker.name} by ${testMaker.makerName}`);
    console.log('');
    
    const approvalOk = await testApproval(testMaker.id, testMaker.name);
    console.log('');
    
    if (approvalOk && sheetsOk) {
      console.log('✅ All tests passed! The approval system is working correctly.');
    } else if (approvalOk && !sheetsOk) {
      console.log('⚠️  Approval works but Google Sheets is not configured.');
      console.log('   See GOOGLE_SHEETS_SETUP_COMPLETE.md for setup instructions.');
    }
  }
  
  // Test manual resync if Google Sheets is configured
  if (sheetsOk) {
    console.log('');
    await testResyncSheets();
  }
  
  console.log('');
  console.log('🏁 Test completed!');
  console.log('');
  console.log('💡 Useful commands:');
  console.log('   • Check status: curl http://localhost:3000/api/status');
  console.log('   • Get makers: curl -H "Authorization: Basic YWRtaW46YWRtaW4xMjM=" http://localhost:3000/api/makers');
  console.log('   • Fetch new products: curl -X POST http://localhost:3000/api/cron/fetch');
  console.log('   • Admin panel: http://localhost:3000 (use admin/admin123)');
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error.message);
  process.exit(1);
});

// Run the test
main().catch(console.error);
