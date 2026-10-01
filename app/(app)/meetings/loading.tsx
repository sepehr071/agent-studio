import { ListRowsSkeleton } from "@/components/app/route-skeletons";

export default function Loading() {
  return <ListRowsSkeleton count={7} maxWidth="max-w-4xl" />;
}
