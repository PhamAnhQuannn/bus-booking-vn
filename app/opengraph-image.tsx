import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const alt = 'BBVN — Đặt vé xe khách liên tỉnh';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage() {
  const logoData = await readFile(join(process.cwd(), 'public/logo-dark.png'));
  const logoSrc = `data:image/png;base64,${logoData.toString('base64')}`;

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
          gap: 32,
          background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt="" width={320} height={280} style={{ objectFit: 'contain' }} />
        <div style={{ fontSize: 44, fontWeight: 600, opacity: 0.95 }}>
          Đặt vé xe khách liên tỉnh
        </div>
        <div style={{ fontSize: 30, opacity: 0.85 }}>Tìm chuyến · Đặt vé · Xác nhận qua email</div>
      </div>
    ),
    { ...size },
  );
}
