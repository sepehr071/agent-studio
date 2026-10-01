import { CardGridSkeleton } from "@/components/app/route-skeletons";

export default function Loading() {
  return <CardGridSkeleton columns={3} count={6} />;
}
