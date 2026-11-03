import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/site/legal-page";
import { absoluteUrl, site } from "@/lib/site/config";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How better-vault handles your data: notebooks stay on your device, requests go only to the services you choose, and Google Drive access is limited to files you pick.",
  alternates: { canonical: absoluteUrl("/privacy") },
};

const UPDATED = "November 3, 2026";

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated={UPDATED}
      intro={
        <p>
          better-vault is open-source software that runs on your own device: in your browser, or as
          a desktop app on your computer. This policy explains what data it handles and where that
          data goes. The short version: your notebooks stay with you, and we, the project, never
          receive them.
        </p>
      }
    >
      <LegalSection title="Who we are">
        <p>
          better-vault is an MIT-licensed open-source project maintained by {site.author} and its
          contributors. Its source code is public at{" "}
          <a href={site.repo}>github.com/better-vault/better-vault</a>, so you can check everything
          this policy says.
        </p>
      </LegalSection>

      <LegalSection title="What we collect">
        <p>
          <strong>Nothing.</strong> better-vault has no accounts and no server database. We do not
          collect, store, sell or share your notebooks, sources, chats, files, API keys, Google
          account information or usage data. The app contains no analytics or tracking, and neither
          does this website.
        </p>
      </LegalSection>

      <LegalSection title="Data on your device">
        <p>
          Your notebooks, sources, chats, Studio outputs, settings and API keys are stored on your
          device: in your browser&apos;s storage (IndexedDB) for the web app, or in a file in the
          app&apos;s data folder for the desktop app. You can export them as a backup, and delete
          them at any time in <strong>Settings → Data</strong>.
        </p>
      </LegalSection>

      <LegalSection title="Services you choose to use">
        <p>
          better-vault only sends data to the services you set up yourself, and only what a request
          needs:
        </p>
        <ul className="flex list-disc flex-col gap-2 ps-5">
          <li>
            <strong>AI providers</strong> (such as OpenAI, Anthropic, Google, OpenCode, ElevenLabs,
            or Ollama and LM Studio on your own machine) receive your question, the relevant
            passages of your sources and your key, and return the answer. Their own privacy policies
            apply.
          </li>
          <li>
            <strong>Storage services</strong> (Google Drive, Amazon S3, Cloudflare R2) receive the
            files you choose to save there, such as backups and exports, and send back the files you
            choose to open.
          </li>
          <li>
            <strong>Web pages</strong> you add as sources are fetched to read their text.
          </li>
        </ul>
        <p>
          These requests pass through the app&apos;s own API, which runs on your computer in the
          desktop app, or on the server that hosts the web app. It forwards each request and keeps
          nothing; keys and content are never logged.
        </p>
      </LegalSection>

      <LegalSection title="Google user data">
        <p>
          When you connect Google Drive, better-vault asks for one permission:{" "}
          <strong>
            access to the files you pick in Google&apos;s file picker and the files better-vault
            creates
          </strong>{" "}
          (the <code>drive.file</code> scope). It cannot see the rest of your Drive. Google also
          shares your name and email address so the app can show which account is connected.
        </p>
        <p>
          better-vault uses this access only to do what you ask: read the files you pick so they can
          become sources in a notebook, and save the backups and exports you choose into a
          &quot;better-vault&quot; folder in your Drive. The files&apos; contents are stored only on
          your device, as part of your notebooks.
        </p>
        <p>
          Google user data is never transferred to us or to anyone else, never used for advertising,
          never sold, never used to train AI models, and never read by people. The only exception is
          the part of a file you choose to use as a source in a chat or Studio request, which goes
          to the AI provider you picked for that request.
        </p>
        <p>
          better-vault&apos;s use and transfer of information received from Google APIs adheres to
          the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
        <p>
          The access token that Google issues stays on your device: in your browser&apos;s memory
          for the web app, or in a file only you can read in the desktop app&apos;s data folder.
          Disconnect Google Drive in <strong>Settings → Storage</strong> to sign out and revoke the
          access, or remove it at any time at{" "}
          <a href="https://myaccount.google.com/connections">myaccount.google.com/connections</a>.
        </p>
      </LegalSection>

      <LegalSection title="Updates">
        <p>
          The desktop app checks GitHub for new versions. GitHub receives a standard web request
          (your IP address and the app&apos;s version) and its own privacy policy applies.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          better-vault is not directed at children under 13 and collects no personal information
          from anyone.
        </p>
      </LegalSection>

      <LegalSection title="Changes and contact">
        <p>
          When this policy changes, the date above changes with it, and the history is public in the
          repository. For questions, open an issue at{" "}
          <a href={`${site.repo}/issues`}>github.com/better-vault/better-vault/issues</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
