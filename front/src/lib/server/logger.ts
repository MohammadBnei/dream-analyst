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

// Some request loggers (ours or third-party) call console.error for any
// non-2xx response, e.g. "[404] GET /path" — a 404 isn't a real error.
function downgradeClientErrors(level: Level, message: string): Level {
	if (level !== 'error') return level;
	const status = Number(message.match(/\[(\d{3})\]/)?.[1]);
	return status >= 400 && status < 500 ? 'warn' : level;
}

export function toJsonLine(level: Level, args: unknown[]): string {
	const message = args.map(formatArg).join(' ');
	return JSON.stringify({
		time: new Date().toISOString(),
		level: downgradeClientErrors(level, message),
		message
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

	const notFoundLine = JSON.parse(toJsonLine('error', ['[404] GET /staging/phpinfo.php']));
	console.assert(notFoundLine.level === 'warn', '4xx should downgrade to warn');

	const serverErrLine = JSON.parse(toJsonLine('error', ['[500] GET /api/dreams']));
	console.assert(serverErrLine.level === 'error', '5xx should stay error');

	console.log('logger self-check passed');
}
