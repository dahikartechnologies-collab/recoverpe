export default function KhataQrLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-recoverpe-white text-recoverpe-black">
      {children}
    </div>
  );
}
