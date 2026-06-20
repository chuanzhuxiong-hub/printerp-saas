import { HelpTopicPage } from "@/components/help/help-topic-page";
import { helpTopicMap } from "@/lib/help-content";

export default function PddImportHelpPage() {
  return <HelpTopicPage topic={helpTopicMap.get("help-pdd-import")!} />;
}
