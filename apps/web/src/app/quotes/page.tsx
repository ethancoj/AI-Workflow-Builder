import RequireAuth from "@/components/auth/RequireAuth";
import QuoteDemo from "@/components/quotes/QuoteDemo";
import AppShell from "@/components/shell/AppShell";

export default function QuotesPage() {
  return (
    <RequireAuth>
      <AppShell active="/quotes">
        <QuoteDemo />
      </AppShell>
    </RequireAuth>
  );
}
