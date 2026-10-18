import type { Metadata } from "next";
import AdminNavbar from "@/components/shell/AdminNavbar";
import AdminSidebar from "@/components/shell/AdminSidebar";

export const metadata: Metadata = {
  title: "GoCart. - Admin",
  description: "GoCart. - Admin",
};

/**
 * GoCart's admin shell (components/admin/AdminLayout.jsx), kept as plain React.
 * Phase one has no login, so the "is admin" check is left to the tools.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-col h-screen">
      <AdminNavbar />
      <div className="flex flex-1 items-start h-full overflow-y-scroll no-scrollbar">
        <AdminSidebar />
        <div className="flex-1 h-full p-5 lg:pl-12 lg:pt-12 overflow-y-scroll">{children}</div>
      </div>
    </div>
  );
}
