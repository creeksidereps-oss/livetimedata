import { ADS_ENABLED } from "@/config/adSlots";
import AdSlot from "./AdSlot";

type AdPlaceholderProps = {
  label?: string;
};

export default function AdPlaceholder({ label = "auto" }: AdPlaceholderProps) {
  if (!ADS_ENABLED) return null;
  return <AdSlot slot={label} />;
}
