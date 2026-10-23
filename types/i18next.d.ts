import "i18next";
import type { resources } from "@/lib/i18n/resources";

// Typed translation keys: `t("missing.key")` is a type error.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: (typeof resources)["en"];
    returnNull: false;
  }
}
