export function PoweredByRecoverpeBadge({
  sticky = false,
}: {
  sticky?: boolean;
}) {
  return (
    <footer
      className={`border-t border-recoverpe-grey-light bg-recoverpe-white px-5 py-4 ${
        sticky ? "sticky bottom-0" : ""
      }`}
    >
      <div className="mx-auto flex max-w-md items-center justify-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-recoverpe-grey-medium">
          Powered by
        </span>
        <span className="text-sm font-semibold tracking-tight text-recoverpe-black">
          Recoverpe
        </span>
      </div>
    </footer>
  );
}
