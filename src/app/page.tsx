import { redirect } from "next/navigation";

/**
 * Root page - redirects to Cultivate tool
 */
export default function HomePage() {
  redirect("/cultivate");
}
