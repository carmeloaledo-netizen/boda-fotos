import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { AdminDashboard } from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAuthenticated())) {
    redirect("/admin/login");
  }
  return <AdminDashboard />;
}
