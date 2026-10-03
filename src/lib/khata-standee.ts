import QRCode from "qrcode";
import { getKhataQrUrl } from "@/lib/khata-qr";

export const STANDEE_NAVY = "#0A192F";
export const STANDEE_EMERALD = "#10B981";
export const STANDEE_TEAL = "#00695C";
export const STANDEE_GREY = "#E5E7EB";
export const STANDEE_INK = "#0A0A0A";

const POSTER_WIDTH = 1080;
const POSTER_HEIGHT = 1520;
const SAFE_INSET = 64;
const FOOTER_SAFE_HEIGHT = 210;

export async function fetchPublicAssetDataUrl(src: string): Promise<string | null> {
  try {
    const response = await fetch(src);

    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3
): number {
  const words = text.split(/\s+/);
  let line = "";
  let y = startY;
  let lines = 0;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const metrics = context.measureText(testLine);

    if (metrics.width > maxWidth && line) {
      context.fillText(line, centerX, y);
      line = word;
      y += lineHeight;
      lines += 1;
      if (lines >= maxLines - 1) {
        break;
      }
    } else {
      line = testLine;
    }
  }

  if (line) {
    context.fillText(line, centerX, y);
    y += lineHeight;
  }

  return y;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function drawBadge(
  context: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number
) {
  roundRect(context, x, y, width, height, 12);
  context.fillStyle = "#FFFFFF";
  context.fill();
  context.strokeStyle = STANDEE_GREY;
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = STANDEE_TEAL;
  context.font = "700 22px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, x + width / 2, y + height / 2);
}

export async function generateKhataStandeePoster(input: {
  businessId: string;
  businessName: string;
}): Promise<string> {
  const qrUrl = getKhataQrUrl(input.businessId);
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    width: 480,
    margin: 2,
    color: {
      dark: STANDEE_NAVY,
      light: "#FFFFFF",
    },
  });

  const canvas = document.createElement("canvas");
  canvas.width = POSTER_WIDTH;
  canvas.height = POSTER_HEIGHT;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Failed to initialize poster canvas.");
  }

  context.fillStyle = "#F8FAFC";
  context.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);

  context.fillStyle = STANDEE_NAVY;
  context.fillRect(0, 0, POSTER_WIDTH, 240);
  context.fillStyle = STANDEE_EMERALD;
  context.fillRect(0, 240, POSTER_WIDTH, 8);

  context.fillStyle = "#FFFFFF";
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.font = "600 22px Inter, system-ui, sans-serif";
  context.fillText("KHATA PAYMENT STAND", POSTER_WIDTH / 2, 72);
  context.font = "700 48px Inter, system-ui, sans-serif";
  wrapCanvasText(
    context,
    input.businessName,
    POSTER_WIDTH / 2,
    140,
    POSTER_WIDTH - 160,
    56,
    2
  );

  const cardX = 150;
  const cardY = 300;
  const cardW = POSTER_WIDTH - 300;
  const cardH = 760;
  context.shadowColor = "rgba(10, 25, 47, 0.08)";
  context.shadowBlur = 24;
  context.shadowOffsetY = 10;
  context.fillStyle = "#FFFFFF";
  roundRect(context, cardX, cardY, cardW, cardH, 28);
  context.fill();
  context.shadowColor = "transparent";
  context.strokeStyle = STANDEE_GREY;
  context.lineWidth = 2;
  roundRect(context, cardX, cardY, cardW, cardH, 28);
  context.stroke();

  const qrImage = await loadImage(qrDataUrl);
  const qrSize = 480;
  const qrX = (POSTER_WIDTH - qrSize) / 2;
  const qrY = cardY + 56;
  context.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  context.fillStyle = STANDEE_INK;
  context.font = "600 32px Inter, system-ui, sans-serif";
  context.fillText("Scan to Pay & Open Khata", POSTER_WIDTH / 2, qrY + qrSize + 64);
  context.fillStyle = STANDEE_TEAL;
  context.font = "500 20px Inter, system-ui, sans-serif";
  context.fillText("UPI · Instant settlement · Digital ledger", POSTER_WIDTH / 2, qrY + qrSize + 108);

  const badges = ["UPI", "RuPay", "BHIM", "BharatQR"];
  const badgeW = 150;
  const badgeH = 48;
  const badgeGap = 16;
  const badgesWidth = badges.length * badgeW + (badges.length - 1) * badgeGap;
  let badgeX = (POSTER_WIDTH - badgesWidth) / 2;
  const badgeY = POSTER_HEIGHT - FOOTER_SAFE_HEIGHT - 88;
  context.fillStyle = STANDEE_INK;
  context.font = "600 18px Inter, system-ui, sans-serif";
  context.fillText("Accepted Here", POSTER_WIDTH / 2, badgeY - 28);
  for (const badge of badges) {
    drawBadge(context, badge, badgeX, badgeY, badgeW, badgeH);
    badgeX += badgeW + badgeGap;
  }

  const footerTop = POSTER_HEIGHT - FOOTER_SAFE_HEIGHT;
  context.fillStyle = "#FFFFFF";
  context.fillRect(0, footerTop, POSTER_WIDTH, FOOTER_SAFE_HEIGHT);
  context.fillStyle = STANDEE_TEAL;
  context.fillRect(SAFE_INSET, footerTop, POSTER_WIDTH - SAFE_INSET * 2, 3);

  context.fillStyle = "#0A0A0A";
  context.font = "700 28px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "alphabetic";

  try {
    const logo = await loadImage("/recoverpelogo.png");
    const maxLogoHeight = 96;
    const maxLogoWidth = 440;
    const scale = Math.min(maxLogoWidth / logo.width, maxLogoHeight / logo.height);
    const cappedWidth = logo.width * scale;
    const cappedHeight = logo.height * scale;
    const logoY = footerTop + 22;
    context.drawImage(
      logo,
      (POSTER_WIDTH - cappedWidth) / 2,
      logoY,
      cappedWidth,
      cappedHeight
    );
    context.fillStyle = "#374151";
    context.font = "600 22px Inter, system-ui, sans-serif";
    context.fillText("Powered by RecoverPe", POSTER_WIDTH / 2, logoY + cappedHeight + 36);
  } catch {
    context.fillText("RecoverPe", POSTER_WIDTH / 2, footerTop + 88);
    context.fillStyle = "#374151";
    context.font = "600 22px Inter, system-ui, sans-serif";
    context.fillText("Powered by RecoverPe", POSTER_WIDTH / 2, footerTop + 128);
  }

  return canvas.toDataURL("image/png");
}
