import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/login", label: "Login" },
  { href: "/register", label: "Get Started" },
  { href: "mailto:admin@recoverpe.com", label: "Contact" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refunds", label: "Refunds" },
  { href: "/contact", label: "Contact Us" },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-recoverpe-grey-light bg-recoverpe-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-recoverpe-black">Recoverpe</p>
            <p className="mt-2 max-w-sm text-sm text-recoverpe-grey-medium">
              Intelligent collections for Indian MSMEs. A product of Dahikar
              Technologies Pvt. Ltd.
            </p>
            <p className="mt-3 text-sm text-recoverpe-grey-medium">
              <a
                href="mailto:admin@recoverpe.com"
                className="text-recoverpe-black underline-offset-2 hover:underline"
              >
                admin@recoverpe.com
              </a>
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-recoverpe-grey-medium transition-colors hover:text-recoverpe-black"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-8 border-t border-recoverpe-grey-light pt-6 text-xs text-recoverpe-grey-medium">
          © {new Date().getFullYear()} Dahikar Technologies Pvt. Ltd. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
