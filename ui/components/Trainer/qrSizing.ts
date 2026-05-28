const QR_PADDING_PX = 24
const QR_MIN_SIZE_PX = 96
const QR_MAX_SIZE_PX = 180

export function getQrCodeSize(containerWidth: number, containerHeight: number): number {
  const availableSize = Math.floor(Math.min(containerWidth, containerHeight) - QR_PADDING_PX)
  return Math.max(QR_MIN_SIZE_PX, Math.min(QR_MAX_SIZE_PX, availableSize))
}
