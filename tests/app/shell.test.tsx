import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/admin" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: ComponentProps<"img">) => <img {...props} />,
}));
vi.mock("next/link", () => ({
  default: ({ href, ...props }: ComponentProps<"a"> & { href: string }) => <a href={href} {...props} />,
}));

import AdminNavbar from "@/components/shell/AdminNavbar";
import AdminSidebar from "@/components/shell/AdminSidebar";
import Loading from "@/components/Loading";

describe("AdminNavbar", () => {
  it("shows the logo linking to the dashboard and the greeting", () => {
    render(<AdminNavbar />);
    expect(screen.getByText("Hi, Admin")).toBeTruthy();
    expect(screen.getByText("Admin").closest("a")?.getAttribute("href")).toBe("/admin");
  });
});

describe("AdminSidebar", () => {
  it("makes Dashboard a link and marks it active on /admin", () => {
    nav.pathname = "/admin";
    render(<AdminSidebar />);
    const dashboard = screen.getByText("Dashboard").closest("a");
    expect(dashboard?.getAttribute("href")).toBe("/admin");
    expect(dashboard?.className).toContain("bg-slate-100");
    expect(dashboard?.querySelector(".bg-green-500")).not.toBeNull();
  });

  it.each(["Stores", "Approve Store", "Coupons"])("shows %s but does not link to it yet", (name) => {
    render(<AdminSidebar />);
    const item = screen.getByText(name).parentElement;
    expect(item?.tagName).toBe("SPAN");
    expect(item?.getAttribute("title")).toContain("Not migrated yet");
  });

  it("marks nothing active on another path", () => {
    nav.pathname = "/elsewhere";
    const { container } = render(<AdminSidebar />);
    expect(container.querySelector(".bg-green-500")).toBeNull();
  });

  it("shows the profile picture and name", () => {
    render(<AdminSidebar />);
    expect(screen.getByText("Hi, GreatStack")).toBeTruthy();
    expect(document.querySelector('img[src="/gs_logo.jpg"]')).not.toBeNull();
  });
});

describe("Loading", () => {
  it("shows a spinner", () => {
    const { container } = render(<Loading />);
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });
});
