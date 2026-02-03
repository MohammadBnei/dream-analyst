import { PrismaClient, UserRole, DreamStatus } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
	console.log('Start seeding...');

	// Create an admin user
	const adminPassword = await hash('admin123', 10);
	const adminUser = await prisma.user.upsert({
		where: { email: 'admin@example.com' },
		update: {},
		create: {
			username: 'adminuser',
			email: 'admin@example.com',
			passwordHash: adminPassword,
			role: UserRole.ADMIN,
			credits: 100 // Give admin some credits
		}
	});
	console.log(`Created admin user: ${adminUser.username}`);

	// Create a basic user
	const basicPassword = await hash('basic123', 10);
	const basicUser = await prisma.user.upsert({
		where: { email: 'basic@example.com' },
		update: {},
		create: {
			username: 'basicuser',
			email: 'basic@example.com',
			passwordHash: basicPassword,
			role: UserRole.BASIC,
			credits: 50 // Give basic user some credits
		}
	});
	console.log(`Created basic user: ${basicUser.username}`);

	// Dreams for admin user
	const adminDreams = [
		'I dreamt I was flying over a city made of glass, but it started to crack beneath me.',
		'I was in a library where all the books were blank, and I desperately tried to write in one.',
		'A recurring dream of being chased by a shadow figure through a dense forest.',
		'I found myself in an endless desert, searching for water, but only finding sand.',
		'Dreamt I was taking an exam I hadn\'t studied for, and the questions were in a foreign language.'
	];

	for (const dreamText of adminDreams) {
		await prisma.dream.create({
			data: {
				userId: adminUser.id,
				rawText: dreamText,
				status: DreamStatus.ANALYSIS_FAILED,
				promptType: 'jungian' // Default prompt type
			}
		});
	}
	console.log(`Created ${adminDreams.length} dreams for admin user.`);

	// Dreams for basic user
	const basicDreams = [
		'I was swimming in an ocean of stars, feeling weightless and free.',
		'Dreamt I lost my voice right before a big presentation, and no one could hear me.',
		'I was building a sandcastle on a beach, but the tide kept washing it away.',
		'A dream where I could talk to animals, and they shared ancient secrets with me.',
		'I was trapped in a maze, and every turn led me back to the beginning.'
	];

	for (const dreamText of basicDreams) {
		await prisma.dream.create({
			data: {
				userId: basicUser.id,
				rawText: dreamText,
				status: DreamStatus.ANALYSIS_FAILED,
				promptType: 'freudian' // Another prompt type
			}
		});
	}
	console.log(`Created ${basicDreams.length} dreams for basic user.`);

	console.log('Seeding finished.');
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
