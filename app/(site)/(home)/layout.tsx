import { HomeLayout } from "fumadocs-ui/layouts/home";
import { homeOptions } from "../layout.config";

export default function Layout({ children }: LayoutProps<"/">) {
  return <HomeLayout {...homeOptions}>{children}</HomeLayout>;
}
