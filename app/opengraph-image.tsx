import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

/**
 * Default OpenGraph / Twitter share image (1200×630). Next auto-wires this file
 * to `og:image` + `twitter:image` for every route that doesn't override it.
 *
 * NOTE: rendered with the ImageResponse default font. The ASCII "BBVN" wordmark
 * always renders; the Vietnamese subline is a placeholder — embed Be Vietnam Pro
 * here if diacritic fidelity matters for the launch share card (design follow-up).
 */

export const alt = 'BBVN — Đặt vé xe khách liên tỉnh';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage() {
  const logo = await readFile(join(process.cwd(), 'public/brand/logo-horizontal-white.png'));
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 40,
          background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={640} height={260} alt="" />
        <div style={{ fontSize: 44, fontWeight: 600, opacity: 0.95 }}>
          Đặt vé xe khách liên tỉnh
        </div>
        <div style={{ fontSize: 30, opacity: 0.85 }}>Tìm chuyến · Đặt vé · Xác nhận qua email</div>
      </div>
    ),
    { ...size },
  );
}
