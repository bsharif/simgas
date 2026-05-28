const QR_MIN_SIZE_PX = 160
const QR_MAX_SIZE_PX = 280

export function getQrCodeSize(containerWidth: number): number {
  const availableWidth = Math.floor(containerWidth * 0.85)
  return Math.max(QR_MIN_SIZE_PX, Math.min(QR_MAX_SIZE_PX, availableWidth))
}
