/**
 * Reads a newline-delimited JSON response body.
 *
 * Both client services hand-rolled this loop, and they had drifted: the analysis
 * reader flushed whatever was left in the buffer when the stream ended, the chat
 * reader did not - so a final frame arriving without a trailing newline was
 * silently dropped from chat. This flushes the tail, which is the correct
 * behaviour for NDJSON.
 *
 * A malformed line throws rather than being skipped. The previous code logged and
 * continued, which meant a corrupt frame produced silently incomplete output; the
 * caller's existing catch turns this into an error the user sees.
 */
export async function* readNdjson<T>(body: ReadableStream<Uint8Array>): AsyncGenerator<T> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });

			let boundary = buffer.indexOf('\n');
			while (boundary !== -1) {
				const line = buffer.slice(0, boundary).trim();
				buffer = buffer.slice(boundary + 1);
				if (line) yield JSON.parse(line) as T;
				boundary = buffer.indexOf('\n');
			}
		}

		const tail = buffer.trim();
		if (tail) yield JSON.parse(tail) as T;
	} finally {
		reader.releaseLock();
	}
}
