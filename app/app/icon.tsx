import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: '#FF385C',
          borderRadius: 115,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            color: '#ffffff',
            fontSize: 280,
            fontWeight: 700,
            fontFamily: 'sans-serif',
            lineHeight: 1,
            marginTop: 20,
          }}
        >
          J
        </span>
      </div>
    ),
    { ...size }
  )
}
