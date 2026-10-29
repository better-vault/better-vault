import Image from "next/image";
import type { BaseLayoutProps, LinkItemType } from "fumadocs-ui/layouts/shared";
import { GithubStars } from "@/components/site/github-stars";
import { site } from "@/lib/site/config";

/** The mark and the wordmark. Both marks render; CSS shows the one for the theme. */
const navTitle = (
  <span className="inline-flex items-center gap-2">
    <Image
      src="/brand/logo-light-transparent.png"
      alt=""
      width={26}
      height={26}
      className="dark:hidden"
      priority
    />
    <Image
      src="/brand/logo-dark-transparent.png"
      alt=""
      width={26}
      height={26}
      className="hidden dark:block"
      priority
    />
    <span className="font-heading text-base font-semibold tracking-tight">{site.name}</span>
  </span>
);

const docsLink: LinkItemType = { type: "main", text: "Docs", url: "/docs", active: "nested-url" };

const roadmapLink: LinkItemType = {
  type: "main",
  text: "Roadmap",
  url: "/docs/roadmap",
  active: "url",
};

/** The desktop app's download page. */
const downloadLink: LinkItemType = {
  type: "main",
  text: "Download",
  url: "/download",
  active: "url",
};

/** The call to action: the guide to installing and using better-vault. */
const startLink: LinkItemType = { type: "button", text: "Get started", url: "/docs/quickstart", secondary: true };

const PLAIN_NAV_LINK =
  "inline-flex items-center gap-1.5 p-2 text-sm text-fd-muted-foreground transition-colors hover:text-fd-accent-foreground";

/** GitHub on the docs pages: an ordinary nav link with the star count. */
const githubDocsLink: LinkItemType = {
  type: "main",
  text: <GithubStars />,
  url: site.repo,
  external: true,
};

/*
 * GitHub on the home page. The home header only puts `secondary` items in its
 * trailing group, and `main` items can't be secondary, so this is a custom
 * item (an <li>, since it lands in a list). The phone menu gets a button.
 */
const githubHomeLink: LinkItemType = {
  type: "custom",
  secondary: true,
  on: "nav",
  children: (
    <li className="flex">
      <a href={site.repo} target="_blank" rel="noreferrer noopener" className={PLAIN_NAV_LINK}>
        <GithubStars />
      </a>
    </li>
  ),
};

const githubMenuLink: LinkItemType = {
  type: "button",
  text: <GithubStars />,
  url: site.repo,
  external: true,
  secondary: true,
  on: "menu",
};

/** Shared by the docs and home layouts. */
export const baseOptions: BaseLayoutProps = {
  nav: { title: navTitle, url: "/" },
  githubUrl: undefined,
  links: [docsLink, roadmapLink, downloadLink, githubDocsLink, startLink],
};

export const homeOptions: BaseLayoutProps = {
  ...baseOptions,
  links: [docsLink, roadmapLink, downloadLink, githubHomeLink, githubMenuLink, startLink],
};
