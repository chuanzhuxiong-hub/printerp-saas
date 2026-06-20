import { HelpTopicPage } from "@/components/help/help-topic-page";
import { helpTopicMap } from "@/lib/help-content";

export default function ReportsHelpPage() {
  return <HelpTopicPage topic={helpTopicMap.get("help-reports")!} />;
}
