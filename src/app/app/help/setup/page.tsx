import { HelpTopicPage } from "@/components/help/help-topic-page";
import { requireSession } from "@/lib/auth";
import { helpTopicMap } from "@/lib/help-content";
import { getOnboardingStatus } from "@/lib/onboarding";

export default async function SetupHelpPage() {
  const session = await requireSession();
  return <HelpTopicPage topic={helpTopicMap.get("help-setup")!} onboarding={await getOnboardingStatus(session.tenantId)} />;
}
