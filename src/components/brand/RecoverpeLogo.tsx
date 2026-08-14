import Image from "next/image";
import Link from "next/link";

const SIZE_MAP = {
  sm: { width: 140, className: "h-auto w-[140px]" },
  md: { width: 180, className: "h-auto w-[180px]" },
  lg: { width: 220, className: "h-auto w-[220px]" },
} as const;

interface RecoverpeLogoProps {
  size?: keyof typeof SIZE_MAP;
  href?: string;
  className?: string;
  priority?: boolean;
}

export function RecoverpeLogo({
  size = "md",
  href = "/",
  className = "",
  priority = false,
}: RecoverpeLogoProps) {
  const { width, className: sizeClassName } = SIZE_MAP[size];

  const image = (
    <Image
      src="/logo.png"
      alt="Recoverpe"
      width={width}
      height={Math.round(width * 0.35)}
      priority={priority}
      className={`${sizeClassName} ${className}`.trim()}
    />
  );

  if (!href) {
    return image;
  }

  return (
    <Link href={href} className="inline-block">
      {image}
    </Link>
  );
}
