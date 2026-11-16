import { redirect } from "next/navigation";

// No landing page yet: send visitors to the Overview (which asks them to log in).
export default function Home() {
  redirect("/dashboard");
}
