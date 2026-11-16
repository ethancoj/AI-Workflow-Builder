import { redirect } from "next/navigation";

// No landing page yet: send visitors straight to the builder (which asks them to log in).
export default function Home() {
  redirect("/builder");
}
