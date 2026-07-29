import '../src/lib/server/logger';

async function pipeLines(stream: ReadableStream<Uint8Array>, log: (line: string) => void) {
	const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
	let buf = '';
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		buf += value;
		const lines = buf.split('\n');
		buf = lines.pop() ?? '';
		for (const line of lines) if (line.trim()) log(line);
	}
	if (buf.trim()) log(buf);
}

const proc = Bun.spawn(['bun', 'run', 'prisma', 'migrate', 'deploy'], {
	stdout: 'pipe',
	stderr: 'pipe'
});

// prisma migrate deploy (and bun run's own command echo) write routine
// status lines to stderr just as often as stdout, so the stream isn't a
// reliable signal of severity. Log everything as info while streaming,
// then escalate once we know whether the process actually failed.
await Promise.all([
	pipeLines(proc.stdout, (line) => console.log(line)),
	pipeLines(proc.stderr, (line) => console.log(line))
]);

const exitCode = await proc.exited;
if (exitCode !== 0) {
	console.error(`prisma migrate deploy failed with exit code ${exitCode}`);
}
process.exit(exitCode);
