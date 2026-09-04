import { describe, expect, it } from 'bun:test';
import { readNdjson } from './ndjson';

const streamOf = (...chunks: string[]) =>
	new ReadableStream<Uint8Array>({
		start(c) {
			for (const chunk of chunks) c.enqueue(new TextEncoder().encode(chunk));
			c.close();
		}
	});

const collect = async <T>(s: ReadableStream<Uint8Array>) => {
	const out: T[] = [];
	for await (const v of readNdjson<T>(s)) out.push(v);
	return out;
};

describe('readNdjson', () => {
	it('yields one object per line', async () => {
		expect(await collect(streamOf('{"a":1}\n{"a":2}\n'))).toEqual([{ a: 1 }, { a: 2 }]);
	});

	it('reassembles objects split across chunk boundaries', async () => {
		expect(await collect(streamOf('{"a":', '1}\n{"b":2', '}\n'))).toEqual([{ a: 1 }, { b: 2 }]);
	});

	it('flushes a final line with no trailing newline', async () => {
		// The chat reader used to drop this; NDJSON does not require a trailing
		// newline on the last line.
		expect(await collect(streamOf('{"a":1}\n{"last":true}'))).toEqual([{ a: 1 }, { last: true }]);
	});

	it('ignores blank lines', async () => {
		expect(await collect(streamOf('{"a":1}\n\n\n{"a":2}\n'))).toEqual([{ a: 1 }, { a: 2 }]);
	});

	it('handles multi-byte characters split across chunks', async () => {
		const bytes = new TextEncoder().encode('{"t":"phénix"}\n');
		const stream = new ReadableStream<Uint8Array>({
			start(c) {
				c.enqueue(bytes.slice(0, 9));
				c.enqueue(bytes.slice(9));
				c.close();
			}
		});
		expect(await collect(stream)).toEqual([{ t: 'phénix' }]);
	});

	it('throws on a malformed line rather than silently skipping it', async () => {
		// Skipping produced silently incomplete output; the caller's catch turns
		// this into a visible error.
		expect(collect(streamOf('{"a":1}\nnot json\n'))).rejects.toThrow();
	});

	it('yields nothing for an empty body', async () => {
		expect(await collect(streamOf(''))).toEqual([]);
	});
});
