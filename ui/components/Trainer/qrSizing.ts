const QR_PADDING_PX = 32
const QR_MIN_SIZE_PX = 96
const QR_MAX_SIZE_PX = 156

export function getQrCodeSize(containerWidth: number): number {
  const availableWidth = Math.floor(containerWidth - QR_PADDING_PX)
  return Math.max(QR_MIN_SIZE_PX, Math.min(QR_MAX_SIZE_PX, availableWidth))
}
