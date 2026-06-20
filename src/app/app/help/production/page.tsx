import { HelpTopicPage } from "@/components/help/help-topic-page";
import { helpTopicMap } from "@/lib/help-content";

export default function ProductionHelpPage() {
  return <HelpTopicPage topic={helpTopicMap.get("help-production")!} />;
}
