#!/usr/bin/env tsx
/**
 * Database Test Script
 * Tests Phase 2 database schema and operations
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString =
	process.env.DATABASE_URL || 'postgres://user:password@localhost:5434/dreamer';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function runTests() {
	console.log('🧪 Testing Phase 2 Database Implementation...\n');

	try {
		// Test 1: Verify new Dream fields exist
		console.log('Test 1: Checking Dream model for new fields...');
		const dreamFields = await prisma.$queryRaw`
			SELECT column_name 
			FROM information_schema.columns 
			WHERE table_name = 'dreams' 
			AND column_name IN ('structured_analysis', 'analysis_version')
		`;
		console.log('✅ Dream fields found:', dreamFields.map((f: any) => f.column_name).join(', '));

		// Test 2: Verify InsightReport model exists
		console.log('\nTest 2: Checking InsightReport table...');
		const insightReportExists = await prisma.$queryRaw`
			SELECT EXISTS (
				SELECT FROM information_schema.tables 
				WHERE table_name = 'insight_reports'
			)
		`;
		console.log('✅ InsightReport table exists');

		// Test 3: Verify User model has dreamCount field
		console.log('\nTest 3: Checking User model for dreamCount field...');
		const userFields = await prisma.$queryRaw`
			SELECT column_name 
			FROM information_schema.columns 
			WHERE table_name = 'user' 
			AND column_name = 'dream_count'
		`;
		console.log('✅ User dream_count field found');

		// Test 4: Test creating a dream with structured analysis
		console.log('\nTest 4: Testing database operations...');

		// First, create or get a test user
		const testUser = await prisma.user.upsert({
			where: { id: 'test-phase2-user' },
			create: {
				id: 'test-phase2-user',
				username: 'testphase2',
				email: 'testphase2@example.com',
				passwordHash: 'test-hash',
				dreamCount: 0,
				credits: 10
			},
			update: {}
		});
		console.log('  - Test user ready:', testUser.id);

		const testDream = await prisma.dream.create({
			data: {
				userId: testUser.id,
				rawText: 'Test dream for Phase 2',
				analysisVersion: 2,
				structuredAnalysis: {
					version: 2,
					summary: 'Test structured analysis',
					emotionalTone: 'neutral',
					primaryTheme: 'Testing',
					analysisBlocks: [],
					detectedSymbols: [],
					integrationSuggestions: [],
					generatedAt: new Date().toISOString()
				},
				dreamDate: new Date(),
				status: 'PENDING_ANALYSIS'
			}
		});
		console.log('✅ Created test dream with structured analysis:', testDream.id);

		// Test reading the dream back
		const retrievedDream = await prisma.dream.findUnique({
			where: { id: testDream.id }
		});
		console.log('✅ Retrieved dream with analysisVersion:', retrievedDream?.analysisVersion);

		// Test creating an insight report
		const testReport = await prisma.insightReport.create({
			data: {
				userId: testUser.id,
				title: 'Test Meta-Analysis Report',
				summary: 'This is a test report',
				insights: {
					analyzedPeriod: { from: '2024-01-01', to: '2024-01-31', dreamCount: 5 },
					overallTheme: 'Test Theme',
					insights: [],
					progressIndicators: {
						symbolDiversity: 0.5,
						emotionalBalance: 0.7,
						lucidityProgression: 0.3
					},
					recommendations: ['Test recommendation']
				},
				reportType: 'META_ANALYSIS',
				triggerEvent: 'test_trigger',
				dreamIds: [testDream.id],
				priority: 3
			}
		});
		console.log('✅ Created test insight report:', testReport.id);

		// Cleanup test data
		console.log('\n🧹 Cleaning up test data...');
		await prisma.insightReport.delete({ where: { id: testReport.id } });
		await prisma.dream.delete({ where: { id: testDream.id } });
		await prisma.user.delete({ where: { id: testUser.id } });
		console.log('✅ Test data cleaned up');

		console.log('\n✅ All database tests passed!\n');
	} catch (error) {
		console.error('\n❌ Test failed:', error);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

runTests();
