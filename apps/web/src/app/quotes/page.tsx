import RequireAuth from "@/components/auth/RequireAuth";
import QuoteDemo from "@/components/quotes/QuoteDemo";

export default function QuotesPage() {
  return (
    <RequireAuth>
      <QuoteDemo />
    </RequireAuth>
  );
}
