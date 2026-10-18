import { redirect } from "next/navigation";

/** Phase one only migrates the admin dashboard. */
export default function Home() {
  redirect("/admin");
}
