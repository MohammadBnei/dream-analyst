#!/usr/bin/env tsx
/**
 * Services Test Script
 * Verifies Phase 2 services exist and are properly structured
 */

import fs from 'fs';
import path from 'path';

console.log('🧪 Testing Phase 2 Services...\n');

try {
	// Test 1: Verify service files exist
	console.log('Test 1: Checking service files exist...');
	const servicesDir = './src/lib/server/services';
	const expectedFiles = [
		'MetadataConfigService.ts',
		'SymbolService.ts',
		'DreamService.ts',
		'MetaAnalystService.ts',
		'index.ts'
	];

	for (const file of expectedFiles) {
		const filePath = path.join(servicesDir, file);
		if (fs.existsSync(filePath)) {
			console.log(`  ✅ ${file} exists`);
		} else {
			console.log(`  ❌ ${file} missing`);
			process.exit(1);
		}
	}

	// Test 2: Check exports from index.ts
	console.log('\nTest 2: Verifying service exports...');
	const indexContent = fs.readFileSync('./src/lib/server/services/index.ts', 'utf8');

	const expectedExports = [
		'MetadataConfigService',
		'metadataConfigService',
		'SymbolService',
		'symbolService',
		'DreamService',
		'dreamService',
		'MetaAnalystService',
		'metaAnalystService'
	];

	for (const exportName of expectedExports) {
		if (indexContent.includes(exportName)) {
			console.log(`  ✅ ${exportName} exported`);
		} else {
			console.log(`  ❌ ${exportName} not found in exports`);
			process.exit(1);
		}
	}

	// Test 3: Verify type definitions
	console.log('\nTest 3: Checking type definition files...');
	const typesDir = './src/lib/types';

	if (fs.existsSync(path.join(typesDir, 'structuredAnalysis.ts'))) {
		console.log('  ✅ structuredAnalysis.ts exists');
	} else {
		console.log('  ❌ structuredAnalysis.ts missing');
		process.exit(1);
	}

	if (fs.existsSync(path.join(typesDir, 'insights.ts'))) {
		console.log('  ✅ insights.ts exists');
	} else {
		console.log('  ❌ insights.ts missing');
		process.exit(1);
	}

	// Test 4: Check for key methods in MetaAnalystService
	console.log('\nTest 4: Verifying MetaAnalystService structure...');
	const metaServiceContent = fs.readFileSync(
		'./src/lib/server/services/MetaAnalystService.ts',
		'utf8'
	);

	const expectedMethods = [
		'generateMetaAnalysis',
		'generateWeeklyReport',
		'shouldTriggerMetaAnalysis',
		'getUnreadReports',
		'markReportAsRead'
	];

	for (const method of expectedMethods) {
		if (metaServiceContent.includes(method)) {
			console.log(`  ✅ ${method} method found`);
		} else {
			console.log(`  ❌ ${method} method missing`);
			process.exit(1);
		}
	}

	console.log('\n✅ All service tests passed!\n');
} catch (error) {
	console.error('\n❌ Service test failed:', error);
	process.exit(1);
}
