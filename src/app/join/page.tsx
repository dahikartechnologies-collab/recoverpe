import { redirect } from "next/navigation";

interface JoinPageProps {
  searchParams: Promise<{ ref?: string }>;
}

export default async function JoinPage({ searchParams }: JoinPageProps) {
  const params = await searchParams;
  const referralCode = params.ref?.trim();

  if (referralCode) {
    redirect(`/register?ref=${encodeURIComponent(referralCode)}`);
  }

  redirect("/register");
}
