import http2 from 'node:http2';
import { createHmac } from 'node:crypto';
import { env } from '$env/dynamic/private';

/**
 * Client for ukubi-stt (ADR-0044 / ADR-0046), replacing the n8n webhook.
 *
 * Talks NATIVE gRPC over plaintext h2c to the in-cluster address. Not
 * stt.bnei.dev: both services run in this cluster, so going out to the ingress
 * would add TLS, Traefik, the gRPC-Web translation and a WAN hairpin for
 * nothing. STT_ADDR exists so local dev can point at the public host instead.
 *
 * WHY THE WIRE FORMAT IS HAND-WRITTEN
 * The request has four fields and the response three. Generating this would
 * mean a buf toolchain, protoc plugins and a codegen step in CI for ~150 lines
 * of output — in a repo whose build is `bun ci` and nothing else. The framing
 * below was validated against the live service before it was written into
 * anything (native gRPC unary under Bun's node:http2: HTTP 200, grpc-status=0).
 *
 * The schema it encodes, from ukubi-stt's proto/stt/v1/stt.proto:
 *   RecognizeRequest  { RecognitionConfig config = 1; bytes audio = 2;
 *                       string session_id = 3; reserved 4; bool last = 5; }
 *   RecognitionConfig { int32 sample_rate_hertz = 1; string language = 2; }
 *   RecognizeResponse { string text = 1; float audio_seconds = 2;
 *                       float decode_seconds = 3; }
 * A field-number change there breaks this loudly (a parse error or a non-zero
 * grpc-status), not silently.
 */

const ADDR = env.STT_ADDR || 'http://ukubi-stt.ukubi-stt.svc.cluster.local:9090';
const TOKEN = env.STT_TOKEN_DREAMER || '';
const SAMPLE_RATE = 16000;

/** ukubi-stt caps a request at 16MB; stay well under it. */
const MAX_CHUNK_BYTES = 4 * 1024 * 1024;

function varint(n: number): Buffer {
	const out: number[] = [];
	while (n > 127) {
		out.push((n & 0x7f) | 0x80);
		n >>>= 7;
	}
	out.push(n);
	return Buffer.from(out);
}

function lengthDelimited(field: number, payload: Buffer): Buffer {
	return Buffer.concat([Buffer.from([(field << 3) | 2]), varint(payload.length), payload]);
}

function encodeRequest(pcm: Buffer, sessionId: string, last: boolean, lang: string): Buffer {
	let config = Buffer.concat([Buffer.from([(1 << 3) | 0]), varint(SAMPLE_RATE)]);
	if (lang) config = Buffer.concat([config, lengthDelimited(2, Buffer.from(lang, 'utf8'))]);

	let body = lengthDelimited(1, config);
	if (sessionId) body = Buffer.concat([body, lengthDelimited(3, Buffer.from(sessionId, 'utf8'))]);
	// proto3 omits false; so do we.
	if (last) body = Buffer.concat([body, Buffer.from([(5 << 3) | 0, 1])]);
	// Audio last: it is the bulk, and keeping it last makes the header cheap to read.
	body = Buffer.concat([body, lengthDelimited(2, pcm)]);

	const header = Buffer.alloc(5);
	header.writeUInt8(0, 0); // not compressed
	header.writeUInt32BE(body.length, 1);
	return Buffer.concat([header, body]);
}

function decodeResponse(buf: Buffer): { text: string; audioSeconds: number; decodeSeconds: number } {
	const out = { text: '', audioSeconds: 0, decodeSeconds: 0 };
	let i = 0;
	while (i + 5 <= buf.length) {
		const compressed = buf[i];
		const len = buf.readUInt32BE(i + 1);
		const payload = buf.subarray(i + 5, i + 5 + len);
		i += 5 + len;
		if (compressed !== 0) continue; // trailers-only frame
		let j = 0;
		while (j < payload.length) {
			const key = payload[j++];
			const field = key >> 3;
			const wire = key & 7;
			if (wire === 2) {
				let l = 0;
				let shift = 0;
				let b: number;
				do {
					b = payload[j++];
					l |= (b & 0x7f) << shift;
					shift += 7;
				} while (b & 0x80);
				const val = payload.subarray(j, j + l);
				j += l;
				if (field === 1) out.text = val.toString('utf8');
			} else if (wire === 5) {
				const v = payload.readFloatLE(j);
				j += 4;
				if (field === 2) out.audioSeconds = v;
				else if (field === 3) out.decodeSeconds = v;
			} else if (wire === 0) {
				while (payload[j++] & 0x80);
			} else if (wire === 1) {
				j += 8;
			} else {
				throw new Error(`unsupported protobuf wire type ${wire}`);
			}
		}
	}
	return out;
}

export class SttError extends Error {
	constructor(
		message: string,
		readonly grpcStatus: number | null,
		readonly retryable: boolean
	) {
		super(message);
	}
}

/**
 * Derive the STT session id from the authenticated user.
 *
 * HMAC, not a plain hash: the client supplies half the input and can often guess
 * the other half, and ukubi-stt keys its recognizer state on whatever id it is
 * given, so a derivable id would let one user interleave audio into another
 * user's stream.
 *
 * Keyed on the STT token itself, NOT on JWT_SECRET. The first version used
 * JWT_SECRET on the assumption it was configured; it is not set in this
 * deployment, so every transcription failed with a 500. Keying on the token
 * makes the feature self-contained — the same secret that authorises the call
 * derives the id, so there is no way to be half-configured.
 *
 * Reusing the bearer token as an HMAC key is safe here: HMAC does not leak its
 * key through its output, and the only party that sees these ids is ukubi-stt,
 * which already holds the token. Rotating the token rotates every session id,
 * which is harmless — sessions are ephemeral and swept after 120s idle.
 */
export function sessionIdFor(userId: string, clientStreamId: string): string {
	if (!TOKEN) throw new SttError('STT_TOKEN_DREAMER is not set', null, false);
	return createHmac('sha256', TOKEN)
		.update(`${userId}:${clientStreamId}`)
		.digest('hex')
		.slice(0, 32);
}

/** One chunk of a streaming dictation. Returns only the NEW text for it. */
export function transcribeChunk(
	pcm: Buffer,
	sessionId: string,
	last: boolean,
	lang: string
): Promise<{ text: string; audioSeconds: number; decodeSeconds: number }> {
	if (!TOKEN) return Promise.reject(new SttError('STT_TOKEN_DREAMER is not set', null, false));
	if (pcm.length > MAX_CHUNK_BYTES)
		return Promise.reject(new SttError(`chunk of ${pcm.length} bytes is too large`, null, false));

	return new Promise((resolve, reject) => {
		const session = http2.connect(ADDR);
		const done = (fn: () => void) => {
			session.close();
			fn();
		};
		session.on('error', (e) => reject(new SttError(`transport: ${e.message}`, null, true)));

		const req = session.request({
			':method': 'POST',
			':path': '/stt.v1.Stt/Recognize',
			'content-type': 'application/grpc',
			te: 'trailers',
			authorization: `Bearer ${TOKEN}`
		});

		let grpcStatus: number | null = null;
		let grpcMessage = '';
		const parts: Buffer[] = [];

		// gRPC carries its real status in TRAILERS, and a failed call is still
		// HTTP 200 — so checking the HTTP status here would report every error
		// as success.
		req.on('response', (h) => {
			if (h['grpc-status'] !== undefined) grpcStatus = Number(h['grpc-status']);
			if (h['grpc-message']) grpcMessage = decodeURIComponent(String(h['grpc-message']));
		});
		req.on('trailers', (t) => {
			if (t['grpc-status'] !== undefined) grpcStatus = Number(t['grpc-status']);
			if (t['grpc-message']) grpcMessage = decodeURIComponent(String(t['grpc-message']));
		});
		req.on('data', (d: Buffer) => parts.push(d));
		req.on('error', (e) => done(() => reject(new SttError(`request: ${e.message}`, null, true))));
		req.on('end', () =>
			done(() => {
				if (grpcStatus !== null && grpcStatus !== 0) {
					// 8 = RESOURCE_EXHAUSTED (session cap or a busy batch GPU),
					// 14 = UNAVAILABLE. Both are worth another go; INVALID_ARGUMENT
					// means the audio is wrong and will be wrong again.
					const retryable = grpcStatus === 8 || grpcStatus === 14;
					reject(new SttError(grpcMessage || `grpc-status ${grpcStatus}`, grpcStatus, retryable));
					return;
				}
				try {
					resolve(decodeResponse(Buffer.concat(parts)));
				} catch (e) {
					reject(new SttError(`decoding response: ${(e as Error).message}`, null, false));
				}
			})
		);
		req.end(encodeRequest(pcm, sessionId, last, lang));
	});
}
