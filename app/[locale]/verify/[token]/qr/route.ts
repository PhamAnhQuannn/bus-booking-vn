/**
 * GET /verify/[token]/qr — PNG QR image for the receipt.
 *
 * Unlike the boarding ticket QR (which encodes the bare token for the operator's
 * paste-scan tool), THIS QR encodes the full `${origin}/verify/${token}` URL, so a
 * generic phone camera scanning it opens the public receipt page directly. Embedded
 * as an <img> in the ticketReady receipt email (Resend HTML loads remote images;
 * SVG/data-URIs are stripped by many clients, so we serve a real PNG via sharp).
 *
 * The token is a 192-bit signed capability: an invalid/tampered/unknown token → 404
 * (no QR minted for a bad token). runtime=nodejs — sharp is a native module.
 */

import type { NextRequest } from 'next/server';
import sharp from 'sharp';
import { verifyTicketToken, ticketQrMatrix } from '@/lib/ticketing';

export const runtime = 'nodejs';

/** Pixels per QR module and quiet-zone width (modules) — scannable at typical sizes. */
const MODULE_PX = 8;
const QUIET_MODULES = 4;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;

  // Only mint a QR for a valid, signed token.
  const claims = await verifyTicketToken(token);
  if (!claims) {
    return new Response('Not found', { status: 404 });
  }

  // Encode the ABSOLUTE receipt URL (same origin that served this route).
  const verifyUrl = `${req.nextUrl.origin}/verify/${encodeURIComponent(token)}`;
  const matrix = ticketQrMatrix(verifyUrl);
  const count = matrix.length;
  const dimModules = count + QUIET_MODULES * 2;
  const size = dimModules * MODULE_PX;

  // Grayscale raster: white (255) background, black (0) dark modules. One channel.
  const raw = new Uint8Array(size * size).fill(255);
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (!matrix[r][c]) continue;
      const y0 = (r + QUIET_MODULES) * MODULE_PX;
      const x0 = (c + QUIET_MODULES) * MODULE_PX;
      for (let dy = 0; dy < MODULE_PX; dy++) {
        const rowStart = (y0 + dy) * size + x0;
        raw.fill(0, rowStart, rowStart + MODULE_PX);
      }
    }
  }

  const png = await sharp(Buffer.from(raw), {
    raw: { width: size, height: size, channels: 1 },
  })
    .png()
    .toBuffer();

  return new Response(new Uint8Array(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      // The token is immutable and the QR content is deterministic — cache hard.
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  });
}
