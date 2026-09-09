"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Bot,
  FileText,
  MessageSquare,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import {
  fadeUp,
  scaleOnHover,
  staggerContainer,
} from "@/components/marketing/motion";
import { Button } from "@/components/ui/Button";

const TRUST_ITEMS = [
  "Compliant with MSMED Act, 2006",
  "256-bit Encryption",
  "Razorpay Secure Partner",
];

const FEATURES = [
  {
    title: "AI Voice Agents (Sneha)",
    description:
      "Deploy human-like Hindi voice callers that negotiate payment timelines and log outcomes automatically.",
    icon: Bot,
    className: "md:col-span-2",
  },
  {
    title: "Automated WhatsApp Cadence",
    description:
      "TRAI-compliant reminder sequences on Day 0, 3, and 7 — without manual follow-ups.",
    icon: MessageSquare,
    className: "md:col-span-1",
  },
  {
    title: "1-Click Legal Notices",
    description:
      "Generate advocate-signed formal demand notices and dispatch them instantly to delinquent buyers.",
    icon: FileText,
    className: "md:col-span-1",
  },
  {
    title: "UPI Payment Links",
    description:
      "Share branded pay pages with QR codes so debtors can settle outstanding balances in seconds.",
    icon: Wallet,
    className: "md:col-span-2",
  },
];

const PRICING_PLANS = [
  {
    name: "Free",
    price: "₹0",
    period: "forever",
    description: "Get started with core ledger tracking and manual outreach.",
    features: [
      "Basic ledger tracking",
      "Manual WhatsApp reminders",
      "Day 0 / 3 / 7 automations",
      "Recoverpe branding on invoices",
    ],
    cta: "Start for Free",
    href: "/register",
    highlighted: false,
  },
  {
    name: "Premium",
    price: "₹1,999",
    period: "/month",
    altPrice: "or ₹17,999/year",
    description: "Full automation for high-volume recovery teams.",
    features: [
      "Full WhatsApp automation",
      "AI voice calling (Sneha)",
      "Zero watermarks on invoices",
      "Priority support",
    ],
    cta: "Upgrade to Premium",
    href: "/register",
    highlighted: true,
  },
];

const PAY_PER_USE = [
  {
    name: "Legal Notice",
    price: "₹999",
    description: "Advocate-signed formal demand notice with PDF delivery.",
  },
  {
    name: "Samadhaan Kit",
    price: "₹499",
    description: "MSME Samadhaan evidence docket for delayed payment claims.",
  },
];

function TrustBanner() {
  return (
    <section className="border-y border-recoverpe-grey-light bg-recoverpe-grey-light/60 py-3">
      <div className="overflow-hidden">
        <div className="trust-marquee flex w-max items-center gap-8 px-4">
          {[...TRUST_ITEMS, ...TRUST_ITEMS].map((item, index) => (
            <div
              key={`${item}-${index}`}
              className="flex items-center gap-2 whitespace-nowrap text-xs font-medium uppercase tracking-wide text-recoverpe-grey-medium sm:text-sm"
            >
              <ShieldCheck className="h-4 w-4 shrink-0 text-recoverpe-black" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-recoverpe-white">
      <MarketingHeader />

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20 sm:pb-24">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="mx-auto max-w-3xl text-center"
          >
            <motion.p
              variants={fadeUp}
              className="text-xs font-medium uppercase tracking-[0.2em] text-recoverpe-grey-medium"
            >
              Collections OS for Indian MSMEs
            </motion.p>
            <motion.h1
              variants={fadeUp}
              className="mt-4 text-balance text-4xl font-semibold tracking-tight text-recoverpe-black sm:text-5xl lg:text-6xl"
            >
              Recover Bad Debt on Autopilot
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="mx-auto mt-6 max-w-2xl text-balance text-base leading-7 text-recoverpe-grey-medium sm:text-lg"
            >
              The intelligent collections engine for Indian MSMEs. Automate
              WhatsApp reminders, deploy AI voice callers, and issue formal legal
              notices with one click.
            </motion.p>
            <motion.div
              variants={staggerContainer}
              className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <motion.div variants={fadeUp}>
                <Link href="/register">
                  <Button className="min-w-[220px]">
                    Start Recovering for Free
                  </Button>
                </Link>
              </motion.div>
              <motion.div variants={fadeUp}>
                <Link href="/login">
                  <Button variant="secondary" className="min-w-[220px]">
                    Sign In
                  </Button>
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>
        </section>

        <TrustBanner />

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={fadeUp}
            className="max-w-2xl"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-recoverpe-grey-medium">
              Platform
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-recoverpe-black sm:text-4xl">
              Everything you need to collect faster
            </h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={staggerContainer}
            className="mt-10 grid gap-4 md:grid-cols-3"
          >
            {FEATURES.map((feature) => {
              const Icon = feature.icon;

              return (
                <motion.div
                  key={feature.title}
                  variants={fadeUp}
                  {...scaleOnHover}
                  className={`rounded-lg border border-recoverpe-grey-light bg-recoverpe-white p-6 ${feature.className}`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-md border border-recoverpe-grey-light bg-recoverpe-grey-light">
                    <Icon className="h-5 w-5 text-recoverpe-black" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-recoverpe-black">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-recoverpe-grey-medium">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
        </section>

        <section className="border-y border-recoverpe-grey-light bg-recoverpe-grey-light/40">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={fadeUp}
              className="text-center"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-recoverpe-grey-medium">
                Pricing
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-recoverpe-black sm:text-4xl">
                Simple plans. Serious recovery.
              </h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              variants={staggerContainer}
              className="mt-10 grid gap-4 lg:grid-cols-2"
            >
              {PRICING_PLANS.map((plan) => (
                <motion.div
                  key={plan.name}
                  variants={fadeUp}
                  className={`rounded-lg border p-6 sm:p-8 ${
                    plan.highlighted
                      ? "border-recoverpe-black bg-recoverpe-black text-recoverpe-white"
                      : "border-recoverpe-grey-light bg-recoverpe-white"
                  }`}
                >
                  <p
                    className={`text-xs font-medium uppercase tracking-wide ${
                      plan.highlighted
                        ? "text-recoverpe-grey-light"
                        : "text-recoverpe-grey-medium"
                    }`}
                  >
                    {plan.name}
                  </p>
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <p className="text-4xl font-semibold tabular-nums">
                      {plan.price}
                    </p>
                    <p
                      className={`pb-1 text-sm ${
                        plan.highlighted
                          ? "text-recoverpe-grey-light"
                          : "text-recoverpe-grey-medium"
                      }`}
                    >
                      {plan.period}
                    </p>
                  </div>
                  {"altPrice" in plan && plan.altPrice ? (
                    <p
                      className={`mt-1 text-sm ${
                        plan.highlighted
                          ? "text-recoverpe-grey-light"
                          : "text-recoverpe-grey-medium"
                      }`}
                    >
                      {plan.altPrice}
                    </p>
                  ) : null}
                  <p
                    className={`mt-4 text-sm ${
                      plan.highlighted
                        ? "text-recoverpe-grey-light"
                        : "text-recoverpe-grey-medium"
                    }`}
                  >
                    {plan.description}
                  </p>
                  <ul className="mt-6 space-y-2">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className={`text-sm ${
                          plan.highlighted
                            ? "text-recoverpe-white"
                            : "text-recoverpe-black"
                        }`}
                      >
                        — {feature}
                      </li>
                    ))}
                  </ul>
                  <Link href={plan.href} className="mt-8 inline-block">
                    <Button
                      variant={plan.highlighted ? "secondary" : "primary"}
                      className={
                        plan.highlighted
                          ? "border-recoverpe-white bg-recoverpe-white text-recoverpe-black hover:bg-recoverpe-grey-light"
                          : ""
                      }
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </motion.div>
              ))}
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              variants={fadeUp}
              className="mt-10 rounded-lg border border-recoverpe-grey-light bg-recoverpe-white p-6 sm:p-8"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-recoverpe-grey-medium">
                Pay-Per-Use
              </p>
              <h3 className="mt-2 text-xl font-semibold text-recoverpe-black">
                Escalate only when you need to
              </h3>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {PAY_PER_USE.map((item) => (
                  <div
                    key={item.name}
                    className="rounded-md border border-recoverpe-grey-light p-4"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-medium text-recoverpe-black">
                        {item.name}
                      </p>
                      <p className="text-lg font-semibold tabular-nums text-recoverpe-black">
                        {item.price}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-recoverpe-grey-medium">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={fadeUp}
            className="rounded-lg border border-recoverpe-black bg-recoverpe-black px-6 py-10 text-center sm:px-10 sm:py-14"
          >
            <h2 className="text-2xl font-semibold text-recoverpe-white sm:text-3xl">
              Stop chasing. Start recovering.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-recoverpe-grey-light sm:text-base">
              Join MSMEs using Recoverpe to automate polite persistence,
              escalate with confidence, and get paid faster.
            </p>
            <Link href="/register" className="mt-8 inline-block">
              <Button
                variant="secondary"
                className="border-recoverpe-white bg-recoverpe-white text-recoverpe-black hover:bg-recoverpe-grey-light"
              >
                Start Recovering for Free
              </Button>
            </Link>
          </motion.div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
