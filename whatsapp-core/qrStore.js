// qrStore.js
let ultimoQrCode = null;

export function setQrCode(qr) {
  ultimoQrCode = qr;
}

export function getQrCode() {
  return ultimoQrCode;
}
