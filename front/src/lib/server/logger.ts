type Level = 'debug' | 'info' | 'warn' | 'error';

function formatArg(arg: unknown): string {
	if (arg instanceof Error) return arg.stack ?? arg.message;
	if (typeof arg === 'string') return arg;
	try {
		return JSON.stringify(arg);
	} catch {
		return String(arg);
	}
}

export function toJsonLine(level: Level, args: unknown[]): string {
	return JSON.stringify({
		time: new Date().toISOString(),
		level,
		message: args.map(formatArg).join(' ')
	});
}

if (process.env.NODE_ENV === 'production') {
	const write =
		(level: Level, stream: NodeJS.WriteStream) =>
		(...args: unknown[]) => {
			stream.write(toJsonLine(level, args) + '\n');
		};

	console.debug = write('debug', process.stdout);
	console.log = write('info', process.stdout);
	console.info = write('info', process.stdout);
	console.warn = write('warn', process.stderr);
	console.error = write('error', process.stderr);
}

if (import.meta.main) {
	const stringLine = JSON.parse(toJsonLine('info', ['hello']));
	console.assert(stringLine.level === 'info' && stringLine.message === 'hello', 'string arg failed');

	const errLine = JSON.parse(toJsonLine('error', [new Error('boom')]));
	console.assert(errLine.message.startsWith('Error: boom'), 'error arg failed');

	const objLine = JSON.parse(toJsonLine('info', [{ userId: 1 }]));
	console.assert(objLine.message === '{"userId":1}', 'object arg failed');

	console.log('logger self-check passed');
}
