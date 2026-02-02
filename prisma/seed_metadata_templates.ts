import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = `${process.env.DATABASE_URL}`

const adapter = new PrismaPg({ connectionString })

const prisma = new PrismaClient({
	adapter
});

const DEFAULT_TEMPLATES = [
	{
		name: 'default',
		description: 'Simple sleep quality and lucidity tracking',
		isDefault: true,
		isGlobal: true,
		schema: {
			version: '1.0',
			fields: [
				{
					id: 'sleepQuality',
					label: 'Sleep Quality',
					type: 'scale',
					min: 1,
					max: 5,
					labels: ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent']
				},
				{
					id: 'lucidityLevel',
					label: 'Lucidity Level',
					type: 'scale',
					min: 0,
					max: 3,
					labels: ['None', 'Low', 'Medium', 'High']
				}
			]
		}
	},
	{
		name: 'advanced',
		description: 'Comprehensive tracking with mood and life factors',
		isGlobal: true,
		schema: {
			version: '1.0',
			fields: [
				{ id: 'preSleepMood', label: 'Pre-Sleep Mood', type: 'scale', min: 1, max: 5 },
				{ id: 'postWakeMood', label: 'Post-Wake Mood', type: 'scale', min: 1, max: 5 },
				{ id: 'sleepQuality', label: 'Sleep Quality', type: 'scale', min: 1, max: 5 },
				{
					id: 'sleepDuration',
					label: 'Sleep Duration (hours)',
					type: 'number',
					min: 0,
					max: 24,
					step: 0.5
				},
				{ id: 'lucidityLevel', label: 'Lucidity Level', type: 'scale', min: 0, max: 3 },
				{
					id: 'externalFactors',
					label: 'External Factors',
					type: 'multiselect',
					options: [
						'Stress / Work pressure',
						'Physical illness',
						'Medication / Substances',
						'Travel / Time zone change',
						'Relationship conflict',
						'Major life event',
						'Media consumption',
						'Physical exercise',
						'Meditation / Spiritual practice',
						'Diet changes',
						'Sleep deprivation'
					]
				},
				{ id: 'notes', label: 'Additional Notes', type: 'textarea', maxLength: 500 }
			]
		}
	}
];

async function seed() {
	console.log('Seeding metadata templates...');

	for (const template of DEFAULT_TEMPLATES) {
		await prisma.metadataConfig.upsert({
			where: { name: template.name },
			create: {
				name: template.name,
				description: template.description,
				isDefault: template.isDefault,
				isGlobal: template.isGlobal,
				schema: template.schema
			},
			update: {
				description: template.description,
				isDefault: template.isDefault,
				isGlobal: template.isGlobal,
				schema: template.schema
			}
		});
		console.log(`  ✓ ${template.name}`);
	}

	console.log('\n✓ Seeded metadata templates successfully');
}

seed()
	.catch(console.error)
	.finally(() => prisma.$disconnect());
