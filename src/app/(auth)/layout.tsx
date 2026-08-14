import { RecoverpeLogo } from "@/components/brand/RecoverpeLogo";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-recoverpe-white px-4 py-8">
      <div className="mb-6 flex justify-center">
        <RecoverpeLogo size="md" priority />
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
