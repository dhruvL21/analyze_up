import { ImageResponse } from 'next/og';

// Image metadata
export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/png';

// Image generation
export default function Icon() {
  return new ImageResponse(
    (
      // ImageResponse JSX element
      <div
        style={{
          background: 'transparent',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#aa8755', // AnalyzeUp primary brand color hex representation of hsl(35, 33%, 50%)
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ width: 24, height: 24 }}
        >
          <path d="M3 20L8.5 12L13 16L21 4" />
          <path d="M15 4H21V10" />
        </svg>
      </div>
    ),
    // ImageResponse options
    {
      ...size,
    }
  );
}


