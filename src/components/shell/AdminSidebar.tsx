"use client";

import { HomeIcon, ShieldCheckIcon, StoreIcon, TicketPercentIcon, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarLink {
  name: string;
  href: string;
  icon: LucideIcon;
  /** Pages not migrated in phase one are shown but not clickable. */
  migrated: boolean;
}

const LINKS: SidebarLink[] = [
  { name: "Dashboard", href: "/admin", icon: HomeIcon, migrated: true },
  { name: "Stores", href: "/admin/stores", icon: StoreIcon, migrated: false },
  { name: "Approve Store", href: "/admin/approve", icon: ShieldCheckIcon, migrated: false },
  { name: "Coupons", href: "/admin/coupons", icon: TicketPercentIcon, migrated: false },
];

/** GoCart's admin sidebar (components/admin/AdminSidebar.jsx). */
export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <div className="inline-flex h-full flex-col gap-5 border-r border-slate-200 sm:min-w-60">
      <div className="flex flex-col gap-3 justify-center items-center pt-8 max-sm:hidden">
        <Image className="w-14 h-14 rounded-full" src="/gs_logo.jpg" alt="" width={80} height={80} />
        <p className="text-slate-700">Hi, GreatStack</p>
      </div>

      <div className="max-sm:mt-6">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          const className = `relative flex items-center gap-3 text-slate-500 hover:bg-slate-50 p-2.5 transition ${active ? "bg-slate-100 sm:text-slate-600" : ""}`;
          const content = (
            <>
              <link.icon size={18} className="sm:ml-5" />
              <p className="max-sm:hidden">{link.name}</p>
              {active && <span className="absolute bg-green-500 right-0 top-1.5 bottom-1.5 w-1 sm:w-1.5 rounded-l" />}
            </>
          );
          return link.migrated ? (
            <Link key={link.href} href={link.href} className={className}>
              {content}
            </Link>
          ) : (
            <span key={link.href} className={`${className} cursor-not-allowed`} title="Not migrated yet (phase one covers the dashboard only)">
              {content}
            </span>
          );
        })}
      </div>
    </div>
  );
}
