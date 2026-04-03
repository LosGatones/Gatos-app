import { useParams } from "react-router-dom";
import { RoutePlaceholder } from "@/components/ui/RoutePlaceholder";

export function ProcessDetailRoute() {
  const params = useParams();

  return (
    <RoutePlaceholder
      title="Process detail"
      description={`Route shell for process ${params.processId ?? ""} in cat ${params.catId ?? ""}.`}
    />
  );
}
