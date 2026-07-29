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

await Promise.all([
	pipeLines(proc.stdout, (line) => console.log(line)),
	pipeLines(proc.stderr, (line) => console.error(line))
]);

process.exit(await proc.exited);
