import QRCode from "qrcode";
import { getKhataQrUrl } from "@/lib/khata-qr";

const POSTER_WIDTH = 1080;
const POSTER_HEIGHT = 1520;

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  startY: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(/\s+/);
  let line = "";
  let y = startY;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const metrics = context.measureText(testLine);

    if (metrics.width > maxWidth && line) {
      context.fillText(line, centerX, y);
      line = word;
      y += lineHeight;
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

export async function generateKhataStandeePoster(input: {
  businessId: string;
  businessName: string;
}): Promise<string> {
  const qrUrl = getKhataQrUrl(input.businessId);
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    width: 520,
    margin: 2,
    color: {
      dark: "#0A0A0A",
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

  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);

  context.strokeStyle = "#0A0A0A";
  context.lineWidth = 4;
  context.strokeRect(48, 48, POSTER_WIDTH - 96, POSTER_HEIGHT - 96);

  context.fillStyle = "#0A0A0A";
  context.textAlign = "center";
  context.font = "700 64px Inter, system-ui, sans-serif";

  const nameBottomY = wrapCanvasText(
    context,
    input.businessName,
    POSTER_WIDTH / 2,
    180,
    POSTER_WIDTH - 180,
    72
  );

  const qrImage = await loadImage(qrDataUrl);
  const qrSize = 520;
  const qrY = Math.max(nameBottomY + 48, 360);
  context.drawImage(qrImage, (POSTER_WIDTH - qrSize) / 2, qrY, qrSize, qrSize);

  context.font = "500 36px Inter, system-ui, sans-serif";
  context.fillStyle = "#0A0A0A";
  context.fillText("Scan to Pay & Open Khata", POSTER_WIDTH / 2, qrY + qrSize + 72);

  context.strokeStyle = "#E5E5E5";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(180, POSTER_HEIGHT - 180);
  context.lineTo(POSTER_WIDTH - 180, POSTER_HEIGHT - 180);
  context.stroke();

  try {
    const logo = await loadImage("/logo.png");
    const logoWidth = 220;
    const logoHeight = (logo.height / logo.width) * logoWidth;
    context.drawImage(
      logo,
      (POSTER_WIDTH - logoWidth) / 2,
      POSTER_HEIGHT - 150,
      logoWidth,
      logoHeight
    );
  } catch {
    context.font = "600 24px Inter, system-ui, sans-serif";
    context.fillStyle = "#737373";
    context.fillText("Powered by Recoverpe", POSTER_WIDTH / 2, POSTER_HEIGHT - 120);
  }

  return canvas.toDataURL("image/png");
}
