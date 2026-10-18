import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ redirect, usePathname: () => "/admin" }));
vi.mock("next/font/google", () => ({ Outfit: () => ({ className: "font-outfit" }) }));
vi.mock("@/openui/PageRenderer", () => ({
  default: ({ layout }: { layout: string }) => <div data-testid="page-renderer">{layout}</div>,
}));
vi.mock("@/components/shell/AdminNavbar", () => ({ default: () => <header>navbar</header> }));
vi.mock("@/components/shell/AdminSidebar", () => ({ default: () => <nav>sidebar</nav> }));

import AdminLayout, { metadata as adminMetadata } from "@/app/admin/layout";
import AdminDashboardPage from "@/app/admin/page";
import RootLayout, { metadata as rootMetadata } from "@/app/layout";
import Home from "@/app/page";

describe("app pages", () => {
  it("/ redirects to the admin dashboard", () => {
    Home();
    expect(redirect).toHaveBeenCalledWith("/admin");
  });

  it("/admin draws the admin-dashboard recipe", () => {
    render(<AdminDashboardPage />);
    expect(screen.getByTestId("page-renderer").textContent).toBe("admin-dashboard");
  });

  it("the admin layout wraps the page in the navbar and sidebar", () => {
    render(
      <AdminLayout params={Promise.resolve({})}>
        <p>page body</p>
      </AdminLayout>,
    );
    expect(screen.getByText("navbar")).toBeTruthy();
    expect(screen.getByText("sidebar")).toBeTruthy();
    expect(screen.getByText("page body")).toBeTruthy();
    expect(adminMetadata.title).toBe("GoCart. - Admin");
  });

  it("the root layout applies GoCart's font to the body", () => {
    const html = RootLayout({ children: <p>x</p>, params: Promise.resolve({}) }) as ReactElement<{
      lang: string;
      children: ReactElement<{ className: string }>;
    }>;
    expect(html.props.lang).toBe("en");
    expect(html.props.children.props.className).toContain("font-outfit");
    expect(rootMetadata.title).toBe("GoCart. - Shop smarter");
  });
});
